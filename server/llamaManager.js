import { spawn, exec } from 'child_process';
import fs from 'fs';
import EventEmitter from 'events';
import http from 'http';

class LlamaManager extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.status = 'STOPPED'; // STOPPED, STARTING, RUNNING, STOPPING, ERROR
    this.pid = null;
    this.activeModel = null;
    this.activeModelPath = null;
    this.currentParams = null;
    this.host = '127.0.0.1';
    this.port = 8080;
    this.startTime = null;
    this.errorMsg = null;
    this.logs = [];
    this.maxLogs = 2000;
    this.healthCheckTimer = null;
  }

  addLog(content, source = 'stdout') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      time: timestamp,
      source,
      content: content.toString()
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.emit('log', logEntry);
  }

  getStatus() {
    return {
      status: this.status,
      pid: this.pid,
      activeModel: this.activeModel,
      activeModelPath: this.activeModelPath,
      currentParams: this.currentParams,
      host: this.host,
      port: this.port,
      endpoint: `http://${this.host}:${this.port}`,
      startTime: this.startTime,
      uptime: this.startTime ? Math.floor((Date.now() - new Date(this.startTime).getTime()) / 1000) : 0,
      errorMsg: this.errorMsg
    };
  }

  getLogs(offset = 0) {
    return this.logs.slice(offset);
  }

  clearLogs() {
    this.logs = [];
    this.emit('logs_cleared');
  }

  async startServer({ executablePath, modelPath, params = {}, host = '127.0.0.1', port = 8080 }) {
    if (this.status === 'RUNNING' || this.status === 'STARTING') {
      throw new Error('服务已在运行中，请先停止当前服务后再启动');
    }

    if (!fs.existsSync(executablePath)) {
      throw new Error(`找不到可执行文件: ${executablePath}`);
    }

    if (!fs.existsSync(modelPath)) {
      throw new Error(`找不到模型文件: ${modelPath}`);
    }

    this.status = 'STARTING';
    this.errorMsg = null;
    this.host = host;
    this.port = parseInt(port, 10) || 8080;
    this.activeModel = modelPath.split(/[\\/]/).pop();
    this.activeModelPath = modelPath;
    this.currentParams = params;
    this.startTime = new Date().toISOString();
    this.emit('status_change', this.getStatus());

    this.addLog(`========================================`, 'sys');
    this.addLog(`🚀 正在启动 llama-server 服务...`, 'sys');
    this.addLog(`可执行文件: ${executablePath}`, 'sys');
    this.addLog(`模型文件: ${modelPath}`, 'sys');
    this.addLog(`监听地址: ${this.host}:${this.port}`, 'sys');
    this.addLog(`启动参数: ${JSON.stringify(params)}`, 'sys');
    this.addLog(`========================================`, 'sys');

    // 构建命令行参数
    const args = [
      '-m', modelPath,
      '--host', this.host,
      '--port', this.port.toString(),
      '--n-gpu-layers', (params.nGpuLayers ?? 99).toString(),
      '--ctx-size', (params.ctxSize ?? 8000).toString(),
    ];

    if (params.threads) {
      args.push('-t', params.threads.toString());
    }

    if (params.parallel) {
      args.push('-np', params.parallel.toString());
    }

    if (params.flashAttn) {
      args.push('-fa', 'on');
    }

    if (params.cacheTypeK && params.cacheTypeK !== 'f16') {
      args.push('--cache-type-k', params.cacheTypeK);
    }

    if (params.cacheTypeV && params.cacheTypeV !== 'f16') {
      args.push('--cache-type-v', params.cacheTypeV);
    }

    if (params.mcpProxy) {
      args.push('--webui-mcp-proxy');
    }

    if (params.extraArgs && typeof params.extraArgs === 'string') {
      const extraTokens = params.extraArgs.trim().split(/\s+/).filter(Boolean);
      args.push(...extraTokens);
    }

    this.addLog(`执行命令: "${executablePath}" ${args.join(' ')}`, 'sys');

    try {
      this.process = spawn(executablePath, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', LC_ALL: 'C.UTF-8' }
      });

      this.pid = this.process.pid;
      this.emit('status_change', this.getStatus());

      // 标准输出流处理
      this.process.stdout.on('data', (data) => {
        const text = data.toString();
        this.addLog(text, 'stdout');
        this.checkStartupSuccess(text);
      });

      // llama.cpp 大多数诊断和就绪日志输出在 stderr
      this.process.stderr.on('data', (data) => {
        const text = data.toString();
        this.addLog(text, 'stderr');
        this.checkStartupSuccess(text);
      });

      this.process.on('error', (err) => {
        this.status = 'ERROR';
        this.errorMsg = `进程启动异常: ${err.message}`;
        this.addLog(`❌ 进程错误: ${err.message}`, 'sys');
        this.cleanup();
        this.emit('status_change', this.getStatus());
      });

      this.process.on('close', (code) => {
        this.addLog(`🛑 llama-server 进程已退出 (代码: ${code})`, 'sys');
        this.status = 'STOPPED';
        this.cleanup();
        this.emit('status_change', this.getStatus());
      });

      // 启动健康检查探针
      this.startHealthPolling();

      return { success: true, pid: this.pid, status: this.status };
    } catch (err) {
      this.status = 'ERROR';
      this.errorMsg = err.message;
      this.addLog(`❌ 启动失败: ${err.message}`, 'sys');
      this.cleanup();
      this.emit('status_change', this.getStatus());
      throw err;
    }
  }

  checkStartupSuccess(logText) {
    if (this.status === 'STARTING') {
      // 匹配就绪标志
      if (
        logText.includes('HTTP server is listening') ||
        logText.includes('server is listening on') ||
        logText.includes('main: server is listening') ||
        logText.includes('all slots are idle')
      ) {
        this.status = 'RUNNING';
        this.addLog(`✅ 模型加载完毕，llama-server 现已就绪并在 http://${this.host}:${this.port} 监听！`, 'sys');
        this.emit('status_change', this.getStatus());
      }
    }
  }

  startHealthPolling() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);

    let attempts = 0;
    this.healthCheckTimer = setInterval(() => {
      if (this.status !== 'STARTING' && this.status !== 'RUNNING') {
        clearInterval(this.healthCheckTimer);
        return;
      }

      attempts++;
      const req = http.get(`http://${this.host}:${this.port}/health`, { timeout: 1000 }, (res) => {
        if (res.statusCode === 200 && this.status === 'STARTING') {
          this.status = 'RUNNING';
          this.addLog(`✅ 健康检查通过，服务已成功就绪 (http://${this.host}:${this.port})`, 'sys');
          this.emit('status_change', this.getStatus());
          clearInterval(this.healthCheckTimer);
        }
      });

      req.on('error', () => {
        // 尚未准备好，等待下一次轮询
      });

      req.on('timeout', () => {
        req.destroy();
      });

      if (attempts > 120 && this.status === 'STARTING') {
        // 超过2分钟仍未就绪
        clearInterval(this.healthCheckTimer);
      }
    }, 1500);
  }

  cleanup() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.process = null;
    this.pid = null;
  }

  async stopServer() {
    if (!this.process && this.status === 'STOPPED') {
      return { success: true, message: '服务未在运行' };
    }

    this.status = 'STOPPING';
    this.emit('status_change', this.getStatus());
    this.addLog(`⏳ 正在停止 llama-server (PID: ${this.pid})...`, 'sys');

    const pidToKill = this.pid;

    return new Promise((resolve) => {
      if (process.platform === 'win32' && pidToKill) {
        // Windows 上使用 taskkill 强制连同子树全部终止，释放显存
        exec(`taskkill /pid ${pidToKill} /T /F`, (error) => {
          this.status = 'STOPPED';
          this.cleanup();
          this.addLog(`✅ 服务已停止`, 'sys');
          this.emit('status_change', this.getStatus());
          resolve({ success: true, message: '服务已停止' });
        });
      } else {
        if (this.process) {
          this.process.kill('SIGTERM');
        }
        setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          this.status = 'STOPPED';
          this.cleanup();
          this.addLog(`✅ 服务已停止`, 'sys');
          this.emit('status_change', this.getStatus());
          resolve({ success: true, message: '服务已停止' });
        }, 1500);
      }
    });
  }
}

export const llamaManager = new LlamaManager();
