import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import HomeView from './components/HomeView.jsx';

import DownloadModal from './components/DownloadTab.jsx';
import SettingsModal from './components/SettingsTab.jsx';
import QuickAddModal from './components/QuickAddModal.jsx';
import ToastContainer from './components/Toast.jsx';
import { api } from './api/client.js';
import { resolveActualTheme } from './theme/themeConfig.js';

export default function App() {
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('lamma_theme') || 'system');
  const [config, setConfig] = useState(null);
  const [configMeta, setConfigMeta] = useState({ isCustomized: false, overriddenKeys: [] });
  const [models, setModels] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [downloadJobs, setDownloadJobs] = useState([]);
  const [serverStatus, setServerStatus] = useState({ status: 'STOPPED' });
  const [logs, setLogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // 动态同步主题到 DOM 根节点及系统偏好监听
  useEffect(() => {
    const applyTheme = () => {
      const actual = resolveActualTheme(theme);
      document.documentElement.setAttribute('data-theme', actual);
    };

    applyTheme();

    if (theme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(listener);
        return () => mediaQuery.removeListener(listener);
      }
    }
  }, [theme]);

  const addToast = useCallback(({ type = 'info', title, message }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 加载系统配置
  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.getConfig();
      if (res.success) {
        setConfig(res.config);
        if (res.config.theme) {
          setTheme(res.config.theme);
          localStorage.setItem('lamma_theme', res.config.theme);
        }
        setConfigMeta({
          isCustomized: res.isCustomized || false,
          overriddenKeys: res.overriddenKeys || []
        });
      }
    } catch (e) {
      console.error('Error fetching config:', e);
    }
  }, []);

  // 加载本地模型
  const fetchModels = useCallback(async () => {
    try {
      const res = await api.getModels();
      if (res.success) {
        setModels(res.models || []);
      }
    } catch (e) {
      console.error('Error fetching models:', e);
    }
  }, []);

  // 加载收藏夹
  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await api.getBookmarks();
      if (res.success) {
        setBookmarks(res.bookmarks || []);
      }
    } catch (e) {
      console.error('Error fetching bookmarks:', e);
    }
  }, []);

  // 加载下载任务
  const fetchDownloadJobs = useCallback(async () => {
    try {
      const res = await api.getDownloadJobs();
      if (res.success) {
        setDownloadJobs(res.jobs || []);
      }
    } catch (e) {
      console.error('Error fetching download jobs:', e);
    }
  }, []);

  // 加载服务状态与初始日志
  const fetchServerStatusAndLogs = useCallback(async () => {
    try {
      const statusRes = await api.getServerStatus();
      if (statusRes.success) {
        setServerStatus(statusRes.status);
      }
      const logsRes = await api.getLogs();
      if (logsRes.success) {
        setLogs(logsRes.logs || []);
      }
    } catch (e) {
      console.error('Error fetching server info:', e);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    fetchConfig();
    fetchModels();
    fetchBookmarks();
    fetchDownloadJobs();
    fetchServerStatusAndLogs();
  }, [fetchConfig, fetchModels, fetchBookmarks, fetchDownloadJobs, fetchServerStatusAndLogs]);

  // 建立 SSE 实时事件通信
  useEffect(() => {
    const unsubscribe = api.subscribeEvents((event, data) => {
      if (event === 'status') {
        setServerStatus(data);
      } else if (event === 'log') {
        setLogs((prev) => [...prev, data].slice(-2000));
      } else if (event === 'download_progress') {
        setDownloadJobs((prev) => {
          const index = prev.findIndex((j) => j.id === data.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...data };
            return updated;
          }
          return [data, ...prev];
        });
      } else if (event === 'download_updated') {
        setDownloadJobs((prev) => {
          const index = prev.findIndex((j) => j.id === data.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...data };
            return updated;
          }
          return [data, ...prev];
        });

        if (data.status === 'completed') {
          addToast({
            type: 'success',
            title: '模型下载完成',
            message: `模型 ${data.filename} 已下载完毕，已自动载入本地模型库！`
          });
          fetchModels();
          fetchBookmarks();
        } else if (data.status === 'failed') {
          addToast({
            type: 'error',
            title: '下载失败',
            message: data.error || `模型 ${data.filename} 下载异常终止`
          });
        }
      }
    });

    return () => unsubscribe();
  }, [addToast, fetchModels, fetchBookmarks]);

  // 启动服务处理
  const handleStartServer = async (payload) => {
    try {
      await api.startServer(payload);
      addToast({ type: 'info', title: '启动指令已下发', message: '正在启动 llama-server 并加载模型...' });
    } catch (e) {
      addToast({ type: 'error', title: '启动失败', message: e.message });
    }
  };

  // 停止服务处理
  const handleStopServer = async () => {
    try {
      await api.stopServer();
      addToast({ type: 'info', title: '正在停止', message: '正在安全关闭 llama-server 服务...' });
    } catch (e) {
      addToast({ type: 'error', title: '停止失败', message: e.message });
    }
  };

  // 重启服务处理
  const handleRestartServer = async () => {
    try {
      await api.stopServer();
      setTimeout(async () => {
        if (serverStatus.activeModel) {
          await api.startServer({
            modelFilename: serverStatus.activeModel,
            params: serverStatus.currentParams || config.launchParams
          });
          addToast({ type: 'info', title: '正在重启', message: '服务正在重启中...' });
        }
      }, 1000);
    } catch (e) {
      addToast({ type: 'error', title: '重启失败', message: e.message });
    }
  };

  // 从本地模型库或收藏夹一键载入并启动
  const handleStartSpecificModel = async (filename) => {
    try {
      if (serverStatus.status === 'RUNNING') {
        await api.stopServer();
        await new Promise((r) => setTimeout(r, 800));
      }
      await api.startServer({
        modelFilename: filename,
        params: config?.launchParams
      });
      
      addToast({ type: 'success', title: '已切换模型', message: `正在启动 ${filename}...` });
    } catch (e) {
      addToast({ type: 'error', title: '启动失败', message: e.message });
    }
  };

  // 删除模型
  const handleDeleteModel = async (filename) => {
    await api.deleteModel(filename);
    await fetchModels();
  };

  // 打开目录
  const handleOpenFolder = async (folderPath) => {
    try {
      await api.openFolder(folderPath);
      addToast({ type: 'success', title: '已打开资源管理器', message: `已为您定位并打开目录: ${folderPath || '模型存储目录'}` });
    } catch (e) {
      addToast({ type: 'error', title: '打开失败', message: e.message });
    }
  };

  // 保存系统配置
  const handleSaveConfig = async (newConfig) => {
    const res = await api.saveConfig(newConfig);
    if (res.success) {
      setConfig(res.config);
      setConfigMeta({
        isCustomized: res.isCustomized || false,
        overriddenKeys: res.overriddenKeys || []
      });
      await fetchModels();
    }
  };

  // 重置系统配置回初始化参数
  const handleResetConfig = async () => {
    try {
      const res = await api.resetConfig();
      if (res.success) {
        setConfig(res.config);
        setConfigMeta({
          isCustomized: false,
          overriddenKeys: []
        });
        await fetchModels();
        addToast({
          type: 'success',
          title: '已重置配置',
          message: '已清空 SQLite 个人参数，系统已恢复为 JSON 出厂初始化配置！'
        });
      }
    } catch (e) {
      addToast({
        type: 'error',
        title: '重置失败',
        message: e.message
      });
    }
  };

  // 一键重置收藏夹为出厂默认
  const handleResetBookmarks = async () => {
    try {
      const res = await api.resetBookmarks();
      if (res.success) {
        setBookmarks(res.bookmarks || []);
        addToast({
          type: 'success',
          title: '已重置收藏夹',
          message: '已成功恢复出厂默认推荐模型收藏列表！'
        });
      }
    } catch (e) {
      addToast({ type: 'error', title: '重置失败', message: e.message });
    }
  };

  // 收藏模型
  const handleSaveBookmark = async (bookmark) => {
    const res = await api.saveBookmark(bookmark);
    if (res.success) {
      setBookmarks(res.bookmarks);
    }
  };

  // 删除收藏
  const handleDeleteBookmark = async (id) => {
    try {
      const res = await api.deleteBookmark(id);
      if (res.success) {
        setBookmarks(res.bookmarks);
        addToast({ type: 'info', title: '已移除', message: '已从收藏夹中移除该模型' });
      }
    } catch (e) {
      addToast({ type: 'error', title: '删除失败', message: e.message });
    }
  };

  // 发起下载
  const handleStartDownload = async (payload) => {
    try {
      const res = await api.startDownload(payload);
      if (res.success) {
        addToast({ type: 'info', title: '下载已开始', message: `正在从 ${payload.endpoint || 'hf-mirror'} 下载 ${payload.filename}` });
        fetchDownloadJobs();
      }
    } catch (e) {
      addToast({ type: 'error', title: '发起下载失败', message: e.message });
    }
  };

  // 取消下载
  const handleCancelDownload = async (jobId) => {
    try {
      await api.cancelDownload(jobId);
      addToast({ type: 'info', title: '已取消', message: '下载任务已取消' });
    } catch (e) {
      addToast({ type: 'error', title: '取消失败', message: e.message });
    }
  };

  // 切换并持久化主题
  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('lamma_theme', newTheme);
    const themeLabels = { system: '跟随系统', dark: '简约暗色', light: '简约亮色' };
    addToast({
      type: 'info',
      title: '已切换主题',
      message: `界面主题已切换为: ${themeLabels[newTheme] || newTheme}`
    });
    try {
      await handleSaveConfig({ theme: newTheme });
    } catch (e) {
      console.warn('Persisting theme to backend failed:', e);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航 */}
      <Header
        theme={theme}
        onThemeChange={handleThemeChange}
        onDownloadClick={() => setIsDownloadOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        addToast={addToast}
      />

            {/* 主体内容 */}
      <main className="app-container" style={{ flex: 1, padding: '24px' }}>
        {config && (
          <HomeView
            config={config}
            models={models}
            serverStatus={serverStatus}
            logs={logs}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onRestartServer={handleRestartServer}
            onClearLogs={() => setLogs([])}
            addToast={addToast}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        configMeta={configMeta}
        theme={theme}
        onThemeChange={handleThemeChange}
        onSaveConfig={handleSaveConfig}
        onResetConfig={handleResetConfig}
        onOpenFolder={handleOpenFolder}
        addToast={addToast}
      />

      <DownloadModal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        config={config}
        models={models}
        bookmarks={bookmarks}
        downloadJobs={downloadJobs}
        onStartDownload={handleStartDownload}
        onCancelDownload={handleCancelDownload}
        onSaveBookmark={handleSaveBookmark}
        onDeleteBookmark={handleDeleteBookmark}
        onResetBookmarks={handleResetBookmarks}
        onStartModel={handleStartSpecificModel}
        addToast={addToast}
      />

      {/* 快捷弹窗 */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        config={config}
        onSaveBookmark={handleSaveBookmark}
        onStartDownload={handleStartDownload}
        addToast={addToast}
      />

      {/* 浮动提示通知 */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
