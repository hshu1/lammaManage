import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  getAllUserSettings, 
  getUserSetting, 
  setUserSetting, 
  clearAllUserSettings,
  getUserPresets,
  saveUserPresets
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG_DIR = path.join(__dirname, 'defaultConfig');
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, 'config.default.json');

/**
 * 递归检索指定目录下的指定文件 (默认深度 3)
 */
export function findFileInDir(baseDir, filename, maxDepth = 3, currentDepth = 0) {
  if (!fs.existsSync(baseDir) || currentDepth > maxDepth) return null;
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
        return path.join(baseDir, entry.name);
      }
    }
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
export function searchForLlamaServer() {
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

  return path.join(workspaceRoot, 'lamma', targetBin);
}

/**
 * 自动定位或推导默认的 models 存储目录
 */
export function searchForModelsDir() {
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

  return path.join(workspaceRoot, 'models');
}

/**
 * 读取 JSON 初始化基准配置（只读出厂默认）
 */
export function getInitialConfig() {
  let rawConfig = {};

  if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
      rawConfig = JSON.parse(data);
    } catch (e) {
      console.error('[ConfigManager] 读取 JSON 初始化配置失败:', e);
    }
  }

  const defaultExe = searchForLlamaServer();
  const defaultModels = searchForModelsDir();

  // 若 JSON 初始化参数中路径为空或不存在，采用系统自动推导
  let exePath = rawConfig.executablePath;
  if (!exePath || !fs.existsSync(exePath)) {
    exePath = defaultExe;
  }

  let modelsDir = rawConfig.modelsPath;
  if (!modelsDir || !fs.existsSync(modelsDir)) {
    modelsDir = defaultModels;
  }

  return {
    executablePath: exePath,
    modelsPath: modelsDir,
    defaultHost: rawConfig.defaultHost || "127.0.0.1",
    defaultPort: rawConfig.defaultPort || 8080,
    hfMirror: rawConfig.hfMirror || "https://hf-mirror.com",
    hfToken: rawConfig.hfToken || "",
    activeModel: rawConfig.activeModel || "",
    launchParams: rawConfig.launchParams || {
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
    presets: Array.isArray(rawConfig.presets) ? rawConfig.presets : []
  };
}

/**
 * 获取当前生效配置 (核心覆盖机制):
 * 优先使用 SQLite 中的个人参数，当不存在个人参数时使用 JSON 初始化参数
 */
export function getEffectiveConfig() {
  const initial = getInitialConfig();
  const userSettings = getAllUserSettings();
  const userPresets = getUserPresets();

  const overriddenKeys = [];

  // 合并顶层基础字段
  const result = { ...initial };

  const checkKeys = [
    'executablePath',
    'modelsPath',
    'defaultHost',
    'defaultPort',
    'hfMirror',
    'hfToken',
    'activeModel'
  ];

  for (const key of checkKeys) {
    if (userSettings[key] !== undefined && userSettings[key] !== null) {
      result[key] = userSettings[key];
      overriddenKeys.push(key);
    }
  }

  // 合并 launchParams (深度合并)
  if (userSettings.launchParams && typeof userSettings.launchParams === 'object') {
    result.launchParams = {
      ...initial.launchParams,
      ...userSettings.launchParams
    };
    overriddenKeys.push('launchParams');
  }

  // 合并 presets
  if (userPresets && userPresets.length > 0) {
    result.presets = userPresets;
    overriddenKeys.push('presets');
  }

  const isCustomized = overriddenKeys.length > 0;

  return {
    config: result,
    overriddenKeys,
    isCustomized,
    initialConfig: initial
  };
}

/**
 * 保存用户个人参数到 SQLite (不修改 JSON 初始文件)
 */
export function saveUserConfig(updates = {}) {
  if (!updates || typeof updates !== 'object') return getEffectiveConfig();

  const stringKeys = [
    'executablePath',
    'modelsPath',
    'defaultHost',
    'hfMirror',
    'hfToken',
    'activeModel'
  ];

  for (const key of stringKeys) {
    if (updates[key] !== undefined) {
      setUserSetting(key, updates[key]);
    }
  }

  if (updates.defaultPort !== undefined) {
    const port = parseInt(updates.defaultPort, 10);
    setUserSetting('defaultPort', isNaN(port) ? 8080 : port);
  }

  if (updates.launchParams && typeof updates.launchParams === 'object') {
    // 获取当前已有的个人 launchParams 或初始化 launchParams
    const currentPersonal = getUserSetting('launchParams') || {};
    const mergedLaunchParams = {
      ...currentPersonal,
      ...updates.launchParams
    };
    setUserSetting('launchParams', mergedLaunchParams);
  }

  if (Array.isArray(updates.presets) && updates.presets.length > 0) {
    saveUserPresets(updates.presets);
  }

  return getEffectiveConfig();
}

/**
 * 重置配置：清空 SQLite 个人参数，立即回退为 JSON 初始化参数
 */
export function resetToDefaultConfig() {
  clearAllUserSettings();
  return getEffectiveConfig();
}
