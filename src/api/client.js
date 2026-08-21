const BASE_URL = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`后端接口未响应或未重启 (${res.status})`);
    }
    // 如果返回了 HTML 页面，说明后端服务未启动或未重启
    throw new Error('接口返回非 JSON 内容，请检查后端服务是否已正常启动');
  }

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
  detectPaths: () => request('/api/config/detect-paths', { method: 'POST' }),

  // 本地模型与文件选择
  getModels: (dir) => request(`/api/models${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`),
  deleteModel: (filename) => request(`/api/models/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  openFolder: (targetPath) => request('/api/models/open-folder', { method: 'POST', body: JSON.stringify({ path: targetPath }) }),
  selectFile: (payload) => request('/api/utils/select-file', { method: 'POST', body: JSON.stringify(payload) }),
  selectFolder: (payload) => request('/api/utils/select-folder', { method: 'POST', body: JSON.stringify(payload) }),
  browsePath: (path) => request('/api/utils/browse-path', { method: 'POST', body: JSON.stringify({ path }) }),

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
