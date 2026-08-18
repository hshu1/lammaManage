import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { llamaManager } from './llamaManager.js';
import { getLocalModels, deleteModelFile, openInExplorer } from './modelManager.js';
import { hfDownloader, parseHfInput } from './hfDownloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const CONFIG_PATH = path.join(__dirname, 'config.json');
const BOOKMARKS_PATH = path.join(__dirname, 'data', 'bookmarks.json');

// 确保数据目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return {
    executablePath: "D:\\99_lamma\\lamma\\llama-b9994-bin-win-cuda-13.3-x64\\llama-server.exe",
    modelsPath: "D:\\99_lamma\\models",
    defaultHost: "127.0.0.1",
    defaultPort: 8080,
    hfMirror: "https://hf-mirror.com",
    hfToken: "",
    activeModel: "",
    launchParams: {
      nGpuLayers: 99,
      ctxSize: 8000,
      threads: 8,
      parallel: 1,
      flashAttn: false,
      cacheTypeK: "f16",
      cacheTypeV: "f16",
      mcpProxy: false,
      extraArgs: ""
    },
    presets: []
  };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function loadBookmarks() {
  try {
    if (fs.existsSync(BOOKMARKS_PATH)) {
      return JSON.parse(fs.readFileSync(BOOKMARKS_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading bookmarks:', e);
  }
  return [];
}

function saveBookmarks(bookmarks) {
  fs.writeFileSync(BOOKMARKS_PATH, JSON.stringify(bookmarks, null, 2), 'utf-8');
}

// ----------------- API 路由 -----------------

// 获取与保存系统配置
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  // 检查路径有效性
  const exeExists = fs.existsSync(config.executablePath);
  const modelsDirExists = fs.existsSync(config.modelsPath);

  res.json({
    success: true,
    config,
    validation: {
      exeExists,
      modelsDirExists
    }
  });
});

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    saveConfig(newConfig);
    res.json({ success: true, message: '配置已保存', config: newConfig });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取本地模型列表
app.get('/api/models', async (req, res) => {
  const config = loadConfig();
  const modelsDir = req.query.dir || config.modelsPath;
  const result = await getLocalModels(modelsDir);
  res.json(result);
});

// 删除本地模型
app.delete('/api/models/:filename', async (req, res) => {
  try {
    const config = loadConfig();
    const result = await deleteModelFile(config.modelsPath, req.params.filename);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// 在资源管理器中打开模型所在文件夹
app.post('/api/models/open-folder', async (req, res) => {
  try {
    const config = loadConfig();
    const target = req.body.path || config.modelsPath;
    await openInExplorer(target);
    res.json({ success: true });
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
    const config = loadConfig();
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

    // 记忆当前激活模型
    config.activeModel = path.basename(modelPath);
    config.launchParams = params;
    saveConfig(config);

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

// 收藏模型管理
app.get('/api/bookmarks', (req, res) => {
  const bookmarks = loadBookmarks();
  res.json({ success: true, bookmarks });
});

app.post('/api/bookmarks', (req, res) => {
  try {
    const bookmark = req.body;
    if (!bookmark.repoId || !bookmark.filename) {
      return res.status(400).json({ success: false, error: '缺少 repoId 或 filename' });
    }

    const bookmarks = loadBookmarks();
    const existingIndex = bookmarks.findIndex(
      b => b.repoId === bookmark.repoId && b.filename === bookmark.filename
    );

    if (existingIndex >= 0) {
      bookmarks[existingIndex] = { ...bookmarks[existingIndex], ...bookmark };
    } else {
      const newBm = {
        id: 'bm_' + Date.now(),
        name: bookmark.name || bookmark.filename,
        repoId: bookmark.repoId,
        filename: bookmark.filename,
        sourceUrl: bookmark.sourceUrl || `hf://${bookmark.repoId}/${bookmark.filename}`,
        description: bookmark.description || '',
        tags: bookmark.tags || [],
        size: bookmark.size || '未知',
        addedAt: new Date().toISOString()
      };
      bookmarks.unshift(newBm);
    }

    saveBookmarks(bookmarks);
    res.json({ success: true, bookmarks });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/bookmarks/:id', (req, res) => {
  try {
    let bookmarks = loadBookmarks();
    bookmarks = bookmarks.filter(b => b.id !== req.params.id);
    saveBookmarks(bookmarks);
    res.json({ success: true, bookmarks });
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
    const config = loadConfig();
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
  const status = llamaManager.getStatus();
  if (status.status !== 'RUNNING') {
    return res.status(503).json({ error: 'Llama 服务尚未启动或未就绪' });
  }

  const { prompt, messages, temperature = 0.7, max_tokens = 1024, stream = true } = req.body;

  const chatMessages = messages || [
    { role: 'user', content: prompt || '你好，请用一句话介绍你自己。' }
  ];

  const targetUrl = `http://${status.host}:${status.port}/v1/chat/completions`;

  try {
    const postData = JSON.stringify({
      messages: chatMessages,
      temperature,
      max_tokens,
      stream: stream
    });

    const parsedUrl = new URL(targetUrl);
    const proxyReq = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (proxyRes) => {
      if (stream) {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        proxyRes.pipe(res);
      } else {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          res.status(proxyRes.statusCode).send(body);
        });
      }
    });

    proxyReq.on('error', (err) => {
      res.status(500).json({ error: `连接 llama-server 失败: ${err.message}` });
    });

    proxyReq.write(postData);
    proxyReq.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
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

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  🦙 Llama.cpp 管理后台服务已在端口 ${PORT} 启动`);
  console.log(`  控制台 Web 地址: http://127.0.0.1:${PORT}`);
  console.log(`====================================================`);
});

