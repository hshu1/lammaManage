const BASE_URL = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export const api = {
  // 系统配置
  getConfig: () => request('/api/config'),
  saveConfig: (config) => request('/api/config', { method: 'POST', body: JSON.stringify(config) }),

  // 本地模型
  getModels: (dir) => request(`/api/models${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`),
  deleteModel: (filename) => request(`/api/models/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  openFolder: (targetPath) => request('/api/models/open-folder', { method: 'POST', body: JSON.stringify({ path: targetPath }) }),

  // 服务控制
  getServerStatus: () => request('/api/server/status'),
  startServer: (payload) => request('/api/server/start', { method: 'POST', body: JSON.stringify(payload) }),
  stopServer: () => request('/api/server/stop', { method: 'POST' }),
  getLogs: (offset = 0) => request(`/api/server/logs?offset=${offset}`),
  clearLogs: () => request('/api/server/logs/clear', { method: 'POST' }),

  // 收藏夹
  getBookmarks: () => request('/api/bookmarks'),
  saveBookmark: (bookmark) => request('/api/bookmarks', { method: 'POST', body: JSON.stringify(bookmark) }),
  deleteBookmark: (id) => request(`/api/bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // HF 链接解析与下载
  parseHf: (input) => request('/api/hf/parse', { method: 'POST', body: JSON.stringify({ input }) }),
  getDownloadJobs: () => request('/api/download/jobs'),
  startDownload: (payload) => request('/api/download/start', { method: 'POST', body: JSON.stringify(payload) }),
  cancelDownload: (jobId) => request('/api/download/cancel', { method: 'POST', body: JSON.stringify({ jobId }) }),

  // SSE 实时连接
  subscribeEvents: (onMessage) => {
    const es = new EventSource('/api/events');
    
    es.addEventListener('status', (e) => {
      onMessage('status', JSON.parse(e.data));
    });

    es.addEventListener('log', (e) => {
      onMessage('log', JSON.parse(e.data));
    });

    es.addEventListener('download_progress', (e) => {
      onMessage('download_progress', JSON.parse(e.data));
    });

    es.addEventListener('download_updated', (e) => {
      onMessage('download_updated', JSON.parse(e.data));
    });

    return () => es.close();
  }
};
