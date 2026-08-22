import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { llamaManager } from './llamaManager.js';
import { 
  getLocalModels, 
  deleteModelFile, 
  openInExplorer, 
  formatBytes,
  openNativeFilePicker,
  openNativeFolderPicker,
  browseFilesystem
} from './modelManager.js';
import { hfDownloader, parseHfInput } from './hfDownloader.js';
import { 
  getEffectiveConfig, 
  saveUserConfig, 
  resetToDefaultConfig,
  searchForLlamaServer, 
  searchForModelsDir 
} from './configManager.js';
import { 
  getAllBookmarks, 
  saveBookmark, 
  deleteBookmark, 
  updateBookmarkSize,
  resetBookmarksToDefault
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5175;

app.use(cors());
app.use(express.json());

// 确保配置与默认配置目录存在
if (!fs.existsSync(path.join(__dirname, 'config'))) {
  fs.mkdirSync(path.join(__dirname, 'config'), { recursive: true });
}
if (!fs.existsSync(path.join(__dirname, 'defaultConfig'))) {
  fs.mkdirSync(path.join(__dirname, 'defaultConfig'), { recursive: true });
}

/**
 * 尝试通过 HEAD 请求获取远程 HuggingFace 文件的真实大小
 */
async function fetchRemoteFileSize(repoId, filename, endpoint = 'https://hf-mirror.com') {
  if (!repoId || !filename) return null;
  try {
    const baseEndpoint = (endpoint || 'https://hf-mirror.com').replace(/\/+$/, '');
    const url = `${baseEndpoint}/${repoId}/resolve/main/${encodeURIComponent(filename)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'LlamaManage/1.0' }
    });
    clearTimeout(timeout);
    if (res.ok) {
      const contentLength = res.headers.get('content-length');
      if (contentLength) {
        const bytes = parseInt(contentLength, 10);
        if (!isNaN(bytes) && bytes > 0) {
          return formatBytes(bytes);
        }
      }
    }
  } catch (e) {
    // 忽略网络超时或解析错误
  }
  return null;
}

/**
 * 将收藏夹条目与本地磁盘模型自动同步大小
 */
function syncBookmarksWithSize(bookmarks, modelsPath) {
  if (!Array.isArray(bookmarks)) return [];
  for (const bm of bookmarks) {
    if (!bm.filename) continue;
    if (modelsPath) {
      const fullPath = path.join(modelsPath, bm.filename);
      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          const formatted = formatBytes(stats.size);
          if (bm.size !== formatted) {
            bm.size = formatted;
            updateBookmarkSize(bm.filename, formatted);
          }
        } catch (e) {}
      }
    }
  }
  return bookmarks;
}

// ----------------- API 路由 -----------------

// 获取系统配置 (包含 SQLite 个人参数与覆盖状态)
app.get('/api/config', (req, res) => {
  const { config, overriddenKeys, isCustomized, initialConfig } = getEffectiveConfig();
  // 检查路径有效性
  const exeExists = fs.existsSync(config.executablePath);
  const modelsDirExists = fs.existsSync(config.modelsPath);

  const detectedExe = searchForLlamaServer();
  const detectedModels = searchForModelsDir();

  res.json({
    success: true,
    config,
    isCustomized,
    overriddenKeys,
    detected: {
      executablePath: detectedExe,
      modelsPath: detectedModels
    },
    validation: {
      exeExists,
      modelsDirExists
    }
  });
});

// 保存用户个人配置 (写入 SQLite 易变参数，不污染 JSON 初始文件)
app.post('/api/config', (req, res) => {
  try {
    const { config, overriddenKeys, isCustomized } = saveUserConfig(req.body);
    res.json({ 
      success: true, 
      message: '个人配置已成功保存至 SQLite 存储', 
      config,
      isCustomized,
      overriddenKeys
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 一键恢复出厂默认初始化配置 (清空 SQLite 个人参数，回退为 JSON 初始化参数)
app.post('/api/config/reset', (req, res) => {
  try {
    const { config } = resetToDefaultConfig();
    res.json({ 
      success: true, 
      message: '已恢复出厂默认初始化配置 (JSON)', 
      config 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 一键自动扫描与探测系统路径 (支持 GET 和 POST)
const handleDetectPaths = (req, res) => {
  try {
    const detectedExe = searchForLlamaServer();
    const detectedModels = searchForModelsDir();

    const exeExists = fs.existsSync(detectedExe);
    const modelsDirExists = fs.existsSync(detectedModels);

    res.json({
      success: true,
      detected: {
        executablePath: detectedExe,
        modelsPath: detectedModels
      },
      validation: {
        exeExists,
        modelsDirExists
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

app.get('/api/config/detect-paths', handleDetectPaths);
app.post('/api/config/detect-paths', handleDetectPaths);

// 获取本地模型列表
app.get('/api/models', async (req, res) => {
  const { config } = getEffectiveConfig();
  const modelsDir = req.query.dir || config.modelsPath;
  const result = await getLocalModels(modelsDir);
  res.json(result);
});

// 删除本地模型
app.delete('/api/models/:filename', async (req, res) => {
  try {
    const { config } = getEffectiveConfig();
    const result = await deleteModelFile(config.modelsPath, req.params.filename);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// 在资源管理器中打开模型所在文件夹
app.post('/api/models/open-folder', async (req, res) => {
  try {
    const { config } = getEffectiveConfig();
    const target = req.body.path || config.modelsPath;
    await openInExplorer(target);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 弹出 Windows 原生文件选择对话框
app.post('/api/utils/select-file', async (req, res) => {
  try {
    const { title, filter } = req.body || {};
    const result = await openNativeFilePicker(title, filter);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 弹出 Windows 原生文件夹选择对话框
app.post('/api/utils/select-folder', async (req, res) => {
  try {
    const { title } = req.body || {};
    const result = await openNativeFolderPicker(title);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 网页内置目录树/磁盘浏览与选择接口
app.post('/api/utils/browse-path', async (req, res) => {
  try {
    const { path: targetPath } = req.body || {};
    const result = await browseFilesystem(targetPath);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Llama 服务控制
app.get('/api/server/status', (req, res) => {
  res.json({ success: true, status: llamaManager.getStatus() });
});

app.post('/api/server/start', async (req, res) => {
  try {
    const { config } = getEffectiveConfig();
    const {
      executablePath = config.executablePath,
      modelFilename,
      params = config.launchParams,
      host = config.defaultHost || '127.0.0.1',
      port = config.defaultPort || 8080
    } = req.body;

    if (!modelFilename) {
      return res.status(400).json({ success: false, error: '请指定要启动的模型文件' });
    }

    const modelPath = path.isAbsolute(modelFilename) 
      ? modelFilename 
      : path.join(config.modelsPath, modelFilename);

    // 记忆当前激活模型与最新启动参数（写入 SQLite 个人易变参数库）
    saveUserConfig({
      activeModel: path.basename(modelPath),
      launchParams: params
    });

    const result = await llamaManager.startServer({
      executablePath,
      modelPath,
      params,
      host,
      port
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/server/stop', async (req, res) => {
  try {
    const result = await llamaManager.stopServer();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/server/logs', (req, res) => {
  const offset = parseInt(req.query.offset, 10) || 0;
  res.json({ success: true, logs: llamaManager.getLogs(offset) });
});

app.post('/api/server/logs/clear', (req, res) => {
  llamaManager.clearLogs();
  res.json({ success: true });
});

// 收藏模型管理 (SQLite 持久化)
app.get('/api/bookmarks', async (req, res) => {
  const { config } = getEffectiveConfig();
  let bookmarks = getAllBookmarks();
  bookmarks = syncBookmarksWithSize(bookmarks, config.modelsPath);

  // 针对仍然为 "未知" 的条目，异步尝试拉取远程大小并回写
  const unknownList = bookmarks.filter(b => (!b.size || b.size === '未知') && b.repoId && b.filename);
  if (unknownList.length > 0) {
    Promise.all(unknownList.map(async (bm) => {
      const remoteSize = await fetchRemoteFileSize(bm.repoId, bm.filename, config.hfMirror);
      if (remoteSize) {
        bm.size = remoteSize;
        updateBookmarkSize(bm.filename, remoteSize);
        return true;
      }
      return false;
    })).catch(() => {});
  }

  // 确保每个收藏条目的 size 都有确切值
  bookmarks = bookmarks.map(b => ({
    ...b,
    size: (b.size && typeof b.size === 'string' && b.size.trim()) ? b.size : '未知'
  }));

  res.json({ success: true, bookmarks });
});

app.post('/api/bookmarks', async (req, res) => {
  try {
    const bookmark = req.body;
    if (!bookmark.repoId || !bookmark.filename) {
      return res.status(400).json({ success: false, error: '缺少 repoId 或 filename' });
    }

    const { config } = getEffectiveConfig();

    // 优先检查本地磁盘是否已有该模型
    let calculatedSize = bookmark.size;
    const fullPath = path.join(config.modelsPath, bookmark.filename);
    if (fs.existsSync(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        calculatedSize = formatBytes(stats.size);
      } catch (e) {}
    } else if (!calculatedSize || calculatedSize === '未知') {
      // 尝试远程获取一次
      const remoteSize = await fetchRemoteFileSize(bookmark.repoId, bookmark.filename, config.hfMirror);
      if (remoteSize) {
        calculatedSize = remoteSize;
      }
    }

    const finalSize = (calculatedSize && typeof calculatedSize === 'string' && calculatedSize.trim()) ? calculatedSize : '未知';

    const savedList = saveBookmark({
      ...bookmark,
      size: finalSize
    });

    res.json({ success: true, bookmarks: savedList });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/bookmarks/:id', (req, res) => {
  try {
    const updatedList = deleteBookmark(req.params.id);
    res.json({ success: true, bookmarks: updatedList });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 一键重置收藏夹为出厂默认推荐列表 (JSON 模板)
app.post('/api/bookmarks/reset', (req, res) => {
  try {
    const bookmarks = resetBookmarksToDefault();
    res.json({ 
      success: true, 
      message: '已恢复出厂默认推荐模型收藏夹', 
      bookmarks 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// HuggingFace 智能链接解析
app.post('/api/hf/parse', (req, res) => {
  try {
    const { input } = req.body;
    const parsed = parseHfInput(input);
    res.json({ success: true, parsed });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// 下载管理
app.get('/api/download/jobs', (req, res) => {
  res.json({ success: true, jobs: hfDownloader.getJobs() });
});

app.post('/api/download/start', (req, res) => {
  try {
    const { config } = getEffectiveConfig();
    const {
      repoId,
      filename,
      localDir = config.modelsPath,
      endpoint = config.hfMirror || 'https://hf-mirror.com',
      token = config.hfToken || ''
    } = req.body;

    const job = hfDownloader.startDownload({
      repoId,
      filename,
      localDir,
      endpoint,
      token
    });

    res.json({ success: true, job });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/download/cancel', (req, res) => {
  try {
    const { jobId } = req.body;
    const result = hfDownloader.cancelDownload(jobId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// 简易测试对谈转发 (OpenAI 兼容代理)
app.post('/api/test-chat', async (req, res) => {
  req.setTimeout(0);
  res.setTimeout(0);

  const status = llamaManager.getStatus();
  if (status.status !== 'RUNNING') {
    return res.status(503).json({ error: 'Llama 服务尚未启动或未就绪' });
  }

  const { host, port } = status;
  const { messages = [], stream = false, temperature = 0.7, max_tokens = 1024 } = req.body;

  const llamaReqBody = JSON.stringify({
    messages,
    stream,
    temperature,
    max_tokens
  });

  const llamaReq = http.request({
    hostname: host,
    port: port,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(llamaReqBody)
    }
  }, (llamaRes) => {
    res.writeHead(llamaRes.statusCode, llamaRes.headers);
    llamaRes.pipe(res);
  });

  llamaReq.on('error', (err) => {
    if (!res.headersSent) {
      if (err.code === 'ECONNREFUSED') {
        res.status(500).json({ error: `连接 llama-server 失败: 服务未就绪 (http://${host}:${port})` });
      } else {
        res.status(500).json({ error: `连接 llama-server 失败: ${err.message}` });
      }
    }
  });

  try {
    llamaReq.write(llamaReqBody);
    llamaReq.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// 全局下载完成监听：自动回写更新 SQLite 收藏夹条目的模型体积大小
hfDownloader.on('download_completed', (job) => {
  try {
    let size = null;
    if (job.totalFormatted && job.totalFormatted !== '未知' && job.totalFormatted !== '计算中...') {
      size = job.totalFormatted;
    } else if (job.filePath && fs.existsSync(job.filePath)) {
      const stats = fs.statSync(job.filePath);
      size = formatBytes(stats.size);
    }
    if (size && job.filename) {
      updateBookmarkSize(job.filename, size);
    }
  } catch (e) {
    console.error('Error updating bookmark size on download completed:', e);
  }
});

// Server-Sent Events (SSE) 实时事件通道
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // 发送初始状态
  sendEvent('status', llamaManager.getStatus());

  const onLog = (log) => sendEvent('log', log);
  const onStatusChange = (st) => sendEvent('status', st);
  const onDownloadProgress = (job) => sendEvent('download_progress', job);
  const onDownloadUpdated = (job) => sendEvent('download_updated', job);

  llamaManager.on('log', onLog);
  llamaManager.on('status_change', onStatusChange);
  hfDownloader.on('download_progress', onDownloadProgress);
  hfDownloader.on('download_started', onDownloadUpdated);
  hfDownloader.on('download_updated', onDownloadUpdated);
  hfDownloader.on('download_completed', onDownloadUpdated);

  req.on('close', () => {
    llamaManager.off('log', onLog);
    llamaManager.off('status_change', onStatusChange);
    hfDownloader.off('download_progress', onDownloadProgress);
    hfDownloader.off('download_started', onDownloadUpdated);
    hfDownloader.off('download_updated', onDownloadUpdated);
    hfDownloader.off('download_completed', onDownloadUpdated);
  });
});

// 静态托管前端打包后的文件 (如果存在)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/events')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  🦙 Llama.cpp 管理后台服务已在端口 ${PORT} 启动 (SQLite + JSON 分层存储架构)`);
  console.log(`  🚀 运行进程 PID: ${process.pid}`);
  console.log(`  🌐 本地 IPv4 访问: http://127.0.0.1:${PORT}`);
  console.log(`  🌐 本地 IPv6/域名: http://localhost:${PORT}`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n[INFO] 端口 ${PORT} 正在等待系统释放，1 秒后自动重试绑定...`);
    setTimeout(() => {
      server.close(() => {
        server.listen(PORT, '0.0.0.0');
      });
    }, 1000);
  } else {
    console.error('Server error:', err);
  }
});
