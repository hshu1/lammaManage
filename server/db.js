import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_CONFIG_DIR = path.join(__dirname, 'config');
const DEFAULT_CONFIG_DIR = path.join(__dirname, 'defaultConfig');

const DB_PATH = path.join(USER_CONFIG_DIR, 'lamma.db');
const DEFAULT_BOOKMARKS_JSON = path.join(DEFAULT_CONFIG_DIR, 'bookmarks.default.json');

// 确保用户配置目录与默认配置目录存在
if (!fs.existsSync(USER_CONFIG_DIR)) {
  fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(DEFAULT_CONFIG_DIR)) {
  fs.mkdirSync(DEFAULT_CONFIG_DIR, { recursive: true });
}

let dbInstance = null;

/**
 * 获取或初始化 SQLite 数据库实例
 */
export function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = new DatabaseSync(DB_PATH);

  // 开启 WAL 模式以获得最佳并发与读写性能
  try {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  } catch (e) {
    // 忽略特定环境警告
  }

  // 初始化数据库表
  initSchema(dbInstance);

  // 尝试自动迁移旧版 JSON 数据（如果数据库为空且存在历史数据）
  migrateLegacyJsonData(dbInstance);

  return dbInstance;
}

/**
 * 初始化数据表结构
 */
function initSchema(db) {
  // 1. 用户个人易变参数表 (Key-Value)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. 个人预设方案表
  db.exec(`
    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      desc TEXT,
      tags TEXT,
      raw_command TEXT,
      params TEXT,
      is_custom INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);

  // 3. 模型收藏夹表
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repo_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      source_url TEXT,
      description TEXT,
      tags TEXT,
      size TEXT DEFAULT '未知',
      added_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

/**
 * 平滑迁移或初始化默认 JSON 文件数据到 SQLite
 */
function migrateLegacyJsonData(db) {
  try {
    const countQuery = db.prepare('SELECT COUNT(*) as count FROM bookmarks');
    const { count } = countQuery.get();
    if (count === 0 && fs.existsSync(DEFAULT_BOOKMARKS_JSON)) {
      try {
        const raw = fs.readFileSync(DEFAULT_BOOKMARKS_JSON, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          const insertStmt = db.prepare(`
            INSERT INTO bookmarks (id, name, repo_id, filename, source_url, description, tags, size, added_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const item of list) {
            insertStmt.run(
              item.id || ('bm_' + Date.now() + Math.random().toString(36).substring(2, 6)),
              item.name || item.filename || '未命名',
              item.repoId || '',
              item.filename || '',
              item.sourceUrl || '',
              item.description || '',
              JSON.stringify(item.tags || []),
              item.size || '未知',
              item.addedAt || new Date().toISOString(),
              new Date().toISOString()
            );
          }
          console.log(`[Storage] 已成功从 bookmarks.default.json 载入 ${list.length} 条默认收藏数据至 SQLite 数据库。`);
        }
      } catch (err) {
        console.error('[Storage] 自动载入默认 bookmarks 失败:', err);
      }
    }
  } catch (e) {
    console.error('[Storage] 迁移检查异常:', e);
  }
}

// ----------------- 用户个人参数 (user_settings) 接口 -----------------

/**
 * 获取单个个人参数
 */
export function getUserSetting(key) {
  const db = getDb();
  const stmt = db.prepare('SELECT value FROM user_settings WHERE key = ?');
  const row = stmt.get(key);
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

/**
 * 检查是否存在某个个人参数
 */
export function hasUserSetting(key) {
  const db = getDb();
  const stmt = db.prepare('SELECT 1 FROM user_settings WHERE key = ?');
  return !!stmt.get(key);
}

/**
 * 设置单个个人参数
 */
export function setUserSetting(key, val) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO user_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  const serialized = typeof val === 'string' ? JSON.stringify(val) : JSON.stringify(val);
  stmt.run(key, serialized, new Date().toISOString());
}

/**
 * 删除单个个人参数
 */
export function deleteUserSetting(key) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM user_settings WHERE key = ?');
  stmt.run(key);
}

/**
 * 获取所有个人参数对象
 */
export function getAllUserSettings() {
  const db = getDb();
  const stmt = db.prepare('SELECT key, value FROM user_settings');
  const rows = stmt.all();
  const result = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return result;
}

/**
 * 清空所有个人参数与自定义预设（恢复默认）
 */
export function clearAllUserSettings() {
  const db = getDb();
  db.exec('DELETE FROM user_settings;');
  db.exec('DELETE FROM presets;');
}

// ----------------- 个人预设 (presets) 接口 -----------------

/**
 * 获取用户个人保存的所有预设（若无个人预设返回 null）
 */
export function getUserPresets() {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM presets');
  const rows = stmt.all();
  if (!rows || rows.length === 0) return null;

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    desc: r.desc || '',
    tags: r.tags ? JSON.parse(r.tags) : [],
    rawCommand: r.raw_command || '',
    params: r.params ? JSON.parse(r.params) : {},
    isCustom: !!r.is_custom
  }));
}

/**
 * 批量持久化保存预设方案列表
 */
export function saveUserPresets(presets) {
  if (!Array.isArray(presets)) return;
  const db = getDb();
  db.exec('DELETE FROM presets;');

  const stmt = db.prepare(`
    INSERT INTO presets (id, name, desc, tags, raw_command, params, is_custom, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of presets) {
    stmt.run(
      p.id,
      p.name || p.id,
      p.desc || '',
      JSON.stringify(p.tags || []),
      p.rawCommand || '',
      JSON.stringify(p.params || {}),
      p.isCustom !== false ? 1 : 0,
      new Date().toISOString()
    );
  }
}

// ----------------- 模型收藏夹 (bookmarks) 接口 -----------------

/**
 * 获取所有收藏条目
 */
export function getAllBookmarks() {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bookmarks ORDER BY rowid DESC');
  const rows = stmt.all();

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    repoId: r.repo_id,
    filename: r.filename,
    sourceUrl: r.source_url || '',
    description: r.description || '',
    tags: r.tags ? JSON.parse(r.tags) : [],
    size: (r.size && r.size.trim()) ? r.size : '未知',
    addedAt: r.added_at,
    updatedAt: r.updated_at
  }));
}

/**
 * 保存或更新单条收藏
 */
export function saveBookmark(bookmark) {
  const db = getDb();
  const now = new Date().toISOString();

  // 检查是否已存在同 repoId 和 filename 的记录
  const findStmt = db.prepare('SELECT id FROM bookmarks WHERE repo_id = ? AND filename = ?');
  const existing = findStmt.get(bookmark.repoId, bookmark.filename);

  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE bookmarks SET
        name = ?,
        source_url = ?,
        description = ?,
        tags = ?,
        size = ?,
        updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(
      bookmark.name || bookmark.filename,
      bookmark.sourceUrl || '',
      bookmark.description || '',
      JSON.stringify(bookmark.tags || []),
      bookmark.size || '未知',
      now,
      existing.id
    );
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO bookmarks (id, name, repo_id, filename, source_url, description, tags, size, added_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      bookmark.id || ('bm_' + Date.now() + Math.random().toString(36).substring(2, 6)),
      bookmark.name || bookmark.filename,
      bookmark.repoId,
      bookmark.filename,
      bookmark.sourceUrl || `hf://${bookmark.repoId}/${bookmark.filename}`,
      bookmark.description || '',
      JSON.stringify(bookmark.tags || []),
      bookmark.size || '未知',
      bookmark.addedAt || now,
      now
    );
  }

  return getAllBookmarks();
}

/**
 * 删除收藏条目
 */
export function deleteBookmark(id) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM bookmarks WHERE id = ?');
  stmt.run(id);
  return getAllBookmarks();
}

/**
 * 更新指定文件的体积大小
 */
export function updateBookmarkSize(filename, size) {
  if (!filename || !size) return false;
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE bookmarks SET size = ?, updated_at = ?
    WHERE filename = ? AND (size != ? OR size IS NULL OR size = '未知')
  `);
  stmt.run(size, new Date().toISOString(), filename, size);
  return true;
}

/**
 * 获取 JSON 默认初始收藏列表 (只读模板)
 */
export function getDefaultBookmarks() {
  if (fs.existsSync(DEFAULT_BOOKMARKS_JSON)) {
    try {
      const raw = fs.readFileSync(DEFAULT_BOOKMARKS_JSON, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('[Storage] 读取默认收藏夹 JSON 失败:', e);
    }
  }
  return [];
}

/**
 * 一键重置收藏夹为出厂默认 JSON 模板
 */
export function resetBookmarksToDefault() {
  const db = getDb();
  db.exec('DELETE FROM bookmarks;');

  const defaultList = getDefaultBookmarks();
  if (Array.isArray(defaultList) && defaultList.length > 0) {
    const insertStmt = db.prepare(`
      INSERT INTO bookmarks (id, name, repo_id, filename, source_url, description, tags, size, added_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const item of defaultList) {
      insertStmt.run(
        item.id || ('bm_' + Date.now() + Math.random().toString(36).substring(2, 6)),
        item.name || item.filename || '未命名',
        item.repoId || '',
        item.filename || '',
        item.sourceUrl || '',
        item.description || '',
        JSON.stringify(item.tags || []),
        item.size || '未知',
        item.addedAt || now,
        now
      );
    }
  }

  return getAllBookmarks();
}
