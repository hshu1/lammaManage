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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5175;

app.use(cors());
app.use(express.json());

const CONFIG_PATH = path.join(__dirname, 'config.json');
const BOOKMARKS_PATH = path.join(__dirname, 'data', 'bookmarks.json');

// 确保数据目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
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
  let changed = false;
  for (const bm of bookmarks) {
    // 确保默认 size 字段存在且如果不合法则默认为 '未知'
    if (!bm.size || typeof bm.size !== 'string' || !bm.size.trim()) {
      bm.size = '未知';
      changed = true;
    }
    if (!bm.filename) continue;
    if (modelsPath) {
      const fullPath = path.join(modelsPath, bm.filename);
      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          const formatted = formatBytes(stats.size);
          if (bm.size !== formatted) {
            bm.size = formatted;
            changed = true;
          }
        } catch (e) {}
      }
    }
  }
  if (changed) {
    saveBookmarks(bookmarks);
  }
  return bookmarks;
}

/**
 * 递归检索指定目录下的指定文件 (默认深度 3)
 */
function findFileInDir(baseDir, filename, maxDepth = 3, currentDepth = 0) {
  if (!fs.existsSync(baseDir) || currentDepth > maxDepth) return null;
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    // 优先同级查找
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
        return path.join(baseDir, entry.name);
      }
    }
    // 递归子目录 (忽略隐藏文件夹和 node_modules)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        const found = findFileInDir(path.join(baseDir, entry.name), filename, maxDepth, currentDepth + 1);
        if (found) return found;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * 自动定位或推导默认的 llama-server 可执行文件路径
 */
function searchForLlamaServer() {
  const isWin = process.platform === 'win32';
  const targetBin = isWin ? 'llama-server.exe' : 'llama-server';
  const projectRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(projectRoot, '..');

  const candidateBases = [
    path.join(workspaceRoot, 'lamma'),
    path.join(workspaceRoot, 'llama'),
    path.join(workspaceRoot, 'bin'),
    workspaceRoot,
    path.join(projectRoot, 'bin'),
    projectRoot
  ];

  for (const base of candidateBases) {
    if (!fs.existsSync(base)) continue;
    const found = findFileInDir(base, targetBin, 3);
    if (found) {
      return found;
    }
  }

  // 若均未找到，返回基于当前工作区的相对推导路径
  return path.join(workspaceRoot, 'lamma', targetBin);
}

/**
 * 自动定位或推导默认的 models 存储目录
 */
function searchForModelsDir() {
  const projectRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(projectRoot, '..');

  const candidates = [
    path.join(workspaceRoot, 'models'),
    path.join(projectRoot, 'models'),
    path.join(workspaceRoot, 'models_gguf'),
    path.join(projectRoot, 'models_gguf'),
    path.join(workspaceRoot, 'gguf'),
    workspaceRoot
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      try {
        const stats = fs.statSync(dir);
        if (stats.isDirectory()) {
          return dir;
        }
      } catch (e) {}
    }
  }

  // 默认返回项目同级的 models 目录
  return path.join(workspaceRoot, 'models');
}

const DEFAULT_PRESETS = [
  {
    id: 'daily_8k',
    name: '日常8196 (8K 基础版)',
    desc: '全层 GPU 加速，8K 上下文，启动迅速，适合日常极速对话与常规问答。',
    tags: ['日常对话', '8K', '纯GPU', '默认精度'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 8000 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 8000,
      threads: 8,
      parallel: 1,
      flashAttn: false,
      cacheTypeK: 'f16',
      cacheTypeV: 'f16',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_a_32k',
    name: '方案A: 高频长对话 / 代码重构 (32K)',
    desc: '适合高频长对话、大型代码重构与中长篇文档总结，开启 Flash Attention 与 Q4 KV 缓存，平衡显存与速度。',
    tags: ['代码重构', '32K', 'FlashAttn', 'Q4缓存', '中长文档', '纯GPU'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 32768 -np 1 -fa on --cache-type-k q4_0 --cache-type-v q4_0 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 32768,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q4_0',
      cacheTypeV: 'q4_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_b_hybrid_64k',
    name: '方案B: CPU+GPU 混合卸载 (极限 64K~128K)',
    desc: '显存有限但需极限超长上下文，卸载 28 层至 GPU，剩余由 CPU 内存分担，彻底防爆显存。',
    tags: ['混合卸载', '64K', '超长文本', '低显存占用', 'CPU辅助'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 28 --ctx-size 65536 -np 1 -fa on --cache-type-k q4_0 --cache-type-v q4_0 -t 8 --port 8080',
    params: {
      nGpuLayers: 28,
      ctxSize: 65536,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q4_0',
      cacheTypeV: 'q4_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_c_gpu_64k',
    name: '方案C: 纯 GPU 满血加速 (64K 顶配)',
    desc: '大显存显卡专享，全层 GPU 加速 + 64K 超长上下文 + Q4 KV 缓存，极速超长文本推理。',
    tags: ['纯GPU', '64K', '超长文本', '高性能', 'FlashAttn', 'Q4缓存'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 65536 -np 1 -fa on --cache-type-k q4_0 --cache-type-v q4_0 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 65536,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q4_0',
      cacheTypeV: 'q4_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_d_high_precision_32k',
    name: '方案D: 极高精度方案 (32K Q8 Cache)',
    desc: '32K 上下文并启用 Q8_0 高精度量化缓存与 Flash Attention，追求更高注意力精度。',
    tags: ['高精度', '32K', 'Q8缓存', '代码重构', 'FlashAttn', '纯GPU'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 32768 -np 1 -fa on --cache-type-k q8_0 --cache-type-v q8_0 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 32768,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q8_0',
      cacheTypeV: 'q8_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_d_plus_mcp_32k',
    name: '方案D+: 极高精度 + MCP 智能体 (32K)',
    desc: '极高精度方案（32k 上下文追求更高注意力精度 + WebUI MCP 代理支持），完美适配智能体工具链。',
    tags: ['高精度', '32K', 'MCP智能体', 'WebUI扩展', 'Q8缓存', 'FlashAttn', '纯GPU'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 32768 -np 1 -fa on --cache-type-k q8_0 --cache-type-v q8_0 --webui-mcp-proxy --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 32768,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q8_0',
      cacheTypeV: 'q8_0',
      mcpProxy: true,
      extraArgs: ''
    }
  }
];

function loadConfig() {
  let config = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      config = JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }

  const defaultExe = searchForLlamaServer();
  const defaultModels = searchForModelsDir();

  // 如果配置不存在或配置中的路径在当前文件系统不存在，采用相对动态路径
  let exePath = config.executablePath;
  if (!exePath || !fs.existsSync(exePath)) {
    if (exePath && fs.existsSync(path.resolve(__dirname, '..', exePath))) {
      exePath = path.resolve(__dirname, '..', exePath);
    } else {
      exePath = defaultExe;
    }
  }

  let modelsDir = config.modelsPath;
  if (!modelsDir || !fs.existsSync(modelsDir)) {
    if (modelsDir && fs.existsSync(path.resolve(__dirname, '..', modelsDir))) {
      modelsDir = path.resolve(__dirname, '..', modelsDir);
    } else {
      modelsDir = defaultModels;
    }
  }

  return {
    executablePath: exePath,
    modelsPath: modelsDir,
    defaultHost: config.defaultHost || "127.0.0.1",
    defaultPort: config.defaultPort || 8080,
    hfMirror: config.hfMirror || "https://hf-mirror.com",
    hfToken: config.hfToken || "",
    activeModel: config.activeModel || "",
    launchParams: config.launchParams || {
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
    presets: (config.presets && config.presets.length > 0) ? config.presets : DEFAULT_PRESETS
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

  const detectedExe = searchForLlamaServer();
  const detectedModels = searchForModelsDir();

  res.json({
    success: true,
    config,
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

app.post('/api/config', (req, res) => {
  try {
    const current = loadConfig();
    const newConfig = {
      ...current,
      ...req.body,
      presets: (req.body.presets && req.body.presets.length > 0) ? req.body.presets : current.presets
    };
    saveConfig(newConfig);
    res.json({ success: true, message: '配置已保存', config: newConfig });
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
app.get('/api/bookmarks', async (req, res) => {
  const config = loadConfig();
  let bookmarks = loadBookmarks();
  bookmarks = syncBookmarksWithSize(bookmarks, config.modelsPath);

  // 针对仍然为 "未知" 的条目，异步尝试拉取远程大小并回写（若联网成功则更新，否则保持未知）
  const unknownList = bookmarks.filter(b => (!b.size || b.size === '未知') && b.repoId && b.filename);
  if (unknownList.length > 0) {
    Promise.all(unknownList.map(async (bm) => {
      const remoteSize = await fetchRemoteFileSize(bm.repoId, bm.filename, config.hfMirror);
      if (remoteSize) {
        bm.size = remoteSize;
        return true;
      }
      bm.size = '未知';
      return false;
    })).then(results => {
      if (results.some(r => r === true)) {
        saveBookmarks(bookmarks);
      }
    }).catch(() => {});
  }

  // 确保每个收藏条目的 size 都有确切值，获取不到统一为 '未知'
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

    const config = loadConfig();
    const bookmarks = loadBookmarks();
    const existingIndex = bookmarks.findIndex(
      b => b.repoId === bookmark.repoId && b.filename === bookmark.filename
    );

    // 优先检查本地磁盘是否已有该模型
    let calculatedSize = bookmark.size;
    const fullPath = path.join(config.modelsPath, bookmark.filename);
    if (fs.existsSync(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        calculatedSize = formatBytes(stats.size);
      } catch (e) {}
    } else if (!calculatedSize || calculatedSize === '未知') {
      // 尝试远程获取一次（未联网或拉取失败时返回 null）
      const remoteSize = await fetchRemoteFileSize(bookmark.repoId, bookmark.filename, config.hfMirror);
      if (remoteSize) {
        calculatedSize = remoteSize;
      }
    }

    const finalSize = (calculatedSize && typeof calculatedSize === 'string' && calculatedSize.trim()) ? calculatedSize : '未知';

    if (existingIndex >= 0) {
      bookmarks[existingIndex] = { 
        ...bookmarks[existingIndex], 
        ...bookmark,
        size: finalSize
      };
    } else {
      const newBm = {
        id: 'bm_' + Date.now(),
        name: bookmark.name || bookmark.filename,
        repoId: bookmark.repoId,
        filename: bookmark.filename,
        sourceUrl: bookmark.sourceUrl || `hf://${bookmark.repoId}/${bookmark.filename}`,
        description: bookmark.description || '',
        tags: bookmark.tags || [],
        size: finalSize,
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
  req.setTimeout(0);
  res.setTimeout(0);

  const status = llamaManager.getStatus();
  if (status.status !== 'RUNNING') {
    return res.status(503).json({ error: 'Llama 服务尚未启动或未就绪' });
  }

  const { prompt, messages, temperature = 0.7, max_tokens = 4096, stream = true } = req.body;

  const chatMessages = messages || [
    { role: 'user', content: prompt || '你好，请用一句话介绍你自己。' }
  ];

  const targetUrl = `http://${status.host}:${status.port}/v1/chat/completions`;

  try {
    const postData = JSON.stringify({
      messages: chatMessages,
      temperature,
      top_p: 0.9,
      max_tokens: max_tokens || 4096,
      stream: stream,
      stop: ["<|im_end|>", "<|im_start|>", "<|endoftext|>", "\n<|im_end|>", "\n<|im_start|>"]
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
      },
      timeout: 0
    }, (proxyRes) => {
      if (stream) {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        proxyRes.pipe(res);
      } else {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          res.status(proxyRes.statusCode || 200).send(body);
        });
      }
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: `连接 llama-server 失败: ${err.message}` });
      }
    });

    proxyReq.write(postData);
    proxyReq.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// 全局下载完成监听：自动回写更新收藏夹条目的模型体积大小
hfDownloader.on('download_completed', (job) => {
  try {
    const config = loadConfig();
    let bookmarks = loadBookmarks();
    let updated = false;
    for (const bm of bookmarks) {
      if (bm.filename === job.filename) {
        if (job.totalFormatted && job.totalFormatted !== '未知' && job.totalFormatted !== '计算中...') {
          bm.size = job.totalFormatted;
          updated = true;
        } else if (job.filePath && fs.existsSync(job.filePath)) {
          const stats = fs.statSync(job.filePath);
          bm.size = formatBytes(stats.size);
          updated = true;
        }
      }
    }
    if (updated) {
      saveBookmarks(bookmarks);
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
  console.log(`  🦙 Llama.cpp 管理后台服务已在端口 ${PORT} 启动`);
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

