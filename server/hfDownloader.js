import { spawn, exec } from 'child_process';
import path from 'path';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 智能解析各类 HuggingFace 链接与命令行输入
 */
export function parseHfInput(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('请输入有效的 HuggingFace 链接或命令');
  }

  let text = input.trim();

  // 1. 去除多余的引单引号与双引号
  text = text.replace(/^['"]+|['"]+$/g, '').trim();

  let repoId = '';
  let filename = '';

  // 模式 1: "hf download hf://owner/repo/filename.gguf" 或 "hf://owner/repo/filename.gguf"
  const hfProtocolMatch = text.match(/(?:hf\s+download\s+)?hf:\/\/([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\/([^\s?#]+\.gguf)/i);
  if (hfProtocolMatch) {
    repoId = hfProtocolMatch[1];
    filename = hfProtocolMatch[2];
  }

  // 模式 2: "huggingface-cli download owner/repo filename.gguf"
  if (!repoId) {
    const cliMatch = text.match(/huggingface-cli\s+download\s+([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\s+([^\s]+\.gguf)/i);
    if (cliMatch) {
      repoId = cliMatch[1];
      filename = cliMatch[2];
    }
  }

  // 模式 3: "https://huggingface.co/owner/repo/blob/main/filename.gguf" 或 resolve/main 或 hf-mirror.com
  if (!repoId) {
    const webUrlMatch = text.match(/https?:\/\/(?:huggingface\.co|hf-mirror\.com)\/([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\/(?:blob|resolve)\/[^/]+\/([^\s?#]+\.gguf)/i);
    if (webUrlMatch) {
      repoId = webUrlMatch[1];
      filename = webUrlMatch[2];
    }
  }

  // 模式 4: "owner/repo/filename.gguf"
  if (!repoId) {
    const directMatch = text.match(/^([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)\/([^\s?#]+\.gguf)$/i);
    if (directMatch) {
      repoId = directMatch[1];
      filename = directMatch[2];
    }
  }

  // 模式 5: 仅提供了 owner/repo，没有指定具体 gguf 文件
  if (!repoId) {
    const repoOnlyMatch = text.match(/^(?:https?:\/\/(?:huggingface\.co|hf-mirror\.com)\/)?([a-zA-Z0-9_\-.]+\/[a-zA-Z0-9_\-.]+)$/i);
    if (repoOnlyMatch) {
      repoId = repoOnlyMatch[1];
      filename = ''; // 需要用户或接口选取具体 gguf
    }
  }

  if (!repoId) {
    throw new Error('未能识别 HuggingFace 仓库信息，请检查输入格式（例如: hf download hf://empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf）');
  }

  // 生成展示友好名称
  let suggestedName = filename ? filename.replace(/\.gguf$/i, '') : repoId.split('/')[1];

  return {
    rawInput: input,
    repoId,
    filename,
    suggestedName,
    sourceUrl: text.startsWith('http') || text.startsWith('hf://') ? text : `hf://${repoId}/${filename}`
  };
}

class HfDownloader extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map(); // id -> job object
  }

  getJobs() {
    return Array.from(this.jobs.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  startDownload({ repoId, filename, localDir, endpoint = 'https://hf-mirror.com', token = '' }) {
    if (!repoId || !filename || !localDir) {
      throw new Error('缺少必要参数: repoId, filename, localDir');
    }

    // 检查是否已在下载相同的模型
    for (const existing of this.jobs.values()) {
      if (existing.filename === filename && (existing.status === 'downloading' || existing.status === 'queued')) {
        throw new Error(`模型 ${filename} 正在下载中，请勿重复发起`);
      }
    }

    const jobId = 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const scriptPath = path.join(__dirname, 'download_worker.py');

    const job = {
      id: jobId,
      repoId,
      filename,
      localDir,
      endpoint,
      status: 'downloading', // queued, downloading, completed, failed, cancelled
      percent: 0,
      downloadedFormatted: '0 B',
      totalFormatted: '计算中...',
      speed: '0 B/s',
      etaSeconds: 0,
      error: null,
      filePath: null,
      createdAt: new Date().toISOString(),
      process: null,
      logs: []
    };

    this.jobs.set(jobId, job);
    this.emit('download_started', job);

    const args = [
      scriptPath,
      '--repo_id', repoId,
      '--filename', filename,
      '--local_dir', localDir,
      '--endpoint', endpoint
    ];

    if (token) {
      args.push('--token', token);
    }

    const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
    const pyProcess = spawn(pythonBin, args, { windowsHide: true });
    job.process = pyProcess;

    let buffer = '';

    pyProcess.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留未完整的最后一行

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line.trim());
          this.handleWorkerMessage(jobId, data);
        } catch (e) {
          job.logs.push(line);
        }
      }
    });

    pyProcess.stderr.on('data', (data) => {
      const errText = data.toString();
      job.logs.push(errText);
    });

    pyProcess.on('error', (err) => {
      job.status = 'failed';
      job.error = `无法启动 Python 下载器: ${err.message}`;
      this.emit('download_updated', job);
    });

    pyProcess.on('close', (code) => {
      job.process = null;
      if (job.status === 'downloading') {
        if (code === 0) {
          job.status = 'completed';
          job.percent = 100;
        } else {
          job.status = 'failed';
          if (!job.error) {
            job.error = `下载异常终止 (退出码: ${code})`;
          }
        }
      }
      this.emit('download_updated', job);
    });

    return job;
  }

  handleWorkerMessage(jobId, msg) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (msg.type === 'progress') {
      job.percent = msg.percent;
      job.downloadedFormatted = msg.downloaded_formatted;
      job.totalFormatted = msg.total_formatted;
      job.speed = msg.speed;
      job.etaSeconds = msg.eta_seconds;
      this.emit('download_progress', job);
    } else if (msg.type === 'start') {
      job.totalFormatted = msg.total_formatted;
      this.emit('download_updated', job);
    } else if (msg.type === 'completed') {
      job.status = 'completed';
      job.percent = 100;
      job.filePath = msg.file_path;
      job.speed = '完成';
      this.emit('download_completed', job);
    } else if (msg.type === 'error' || msg.type === 'stream_error') {
      job.logs.push(msg.message);
      if (msg.type === 'error') {
        job.status = 'failed';
        job.error = msg.message;
        this.emit('download_updated', job);
      }
    }
  }

  cancelDownload(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('未找到下载任务');
    }

    if (job.status !== 'downloading' && job.status !== 'queued') {
      return { success: true, message: '任务已非下载状态' };
    }

    job.status = 'cancelled';
    if (job.process) {
      const pid = job.process.pid;
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${pid} /T /F`, () => {});
      } else {
        job.process.kill('SIGKILL');
      }
      job.process = null;
    }

    this.emit('download_updated', job);
    return { success: true, message: '下载已取消' };
  }
}

export const hfDownloader = new HfDownloader();
