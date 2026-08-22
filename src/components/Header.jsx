import React from 'react';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  DownloadCloud, 
  Settings, 
  ExternalLink, 
  Copy, 
  Plus, 
  Play, 
  Square,
  Sparkles,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  serverStatus, 
  modelsCount, 
  theme = 'system',
  onThemeChange,
  onQuickAddClick,
  addToast 
}) {
  const isRunning = serverStatus?.status === 'RUNNING';
  const isStarting = serverStatus?.status === 'STARTING';
  const isError = serverStatus?.status === 'ERROR';

  const copyEndpoint = (e) => {
    e.stopPropagation();
    if (serverStatus?.endpoint) {
      navigator.clipboard.writeText(serverStatus.endpoint);
      addToast({ type: 'success', title: '已复制', message: `接口地址 ${serverStatus.endpoint} 已复制到剪贴板` });
    }
  };

  const themeOptions = [
    { id: 'system', label: '系统', icon: <Monitor size={13} />, title: '跟随系统色彩偏好' },
    { id: 'dark', label: 'Dark', icon: <Moon size={13} />, title: '暗色极简主题' },
    { id: 'light', label: 'Light', icon: <Sun size={13} />, title: '亮色极简主题' }
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-color)',
      background: 'var(--header-bg)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      transition: 'background-color 0.25s ease, border-color 0.25s ease'
    }}>
      <div className="app-container" style={{ padding: '14px 24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* 左侧 Logo 与 标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--c-llama-sky) 0%, var(--c-emerald) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(14, 165, 233, 0.35)',
              fontSize: '20px'
            }}>
              🦙
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }} className="gradient-text">
                  Llama.cpp 控制台
                </h1>
                <span className="badge badge-primary" style={{ fontSize: '10px' }}>CUDA 13.3</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                本地大模型调度 · 极简 WebUI · HuggingFace 镜像极速下载
              </p>
            </div>
          </div>

          {/* 中间 服务状态胶囊 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--bg-card)',
            padding: '6px 14px',
            borderRadius: '999px',
            border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isRunning && <span className="status-dot-green" />}
              {isStarting && <span className="status-dot-amber" />}
              {isError && <span className="status-dot-red" />}
              {!isRunning && !isStarting && !isError && <span className="status-dot-gray" />}

              <span style={{ 
                fontWeight: 600, 
                color: isRunning ? 'var(--c-emerald)' : isStarting ? 'var(--c-amber)' : isError ? 'var(--c-rose)' : 'var(--text-muted)' 
              }}>
                {isRunning ? `服务运行中 (:${serverStatus.port})` : isStarting ? '正在加载模型...' : isError ? '服务异常' : '服务未启动'}
              </span>
            </div>

            {isRunning && (
              <>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <span style={{ 
                  color: 'var(--text-muted)', 
                  maxWidth: '180px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap' 
                }}>
                  {serverStatus.activeModel}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={copyEndpoint}
                    title="复制 API 端点"
                    className="btn btn-ghost"
                    style={{ padding: '3px 8px', height: '24px', fontSize: '11px', borderRadius: '6px' }}
                  >
                    <Copy size={12} />
                    端点
                  </button>
                  <a
                    href={serverStatus.endpoint}
                    target="_blank"
                    rel="noreferrer"
                    title="在浏览器中打开原生 llama.cpp WebUI"
                    className="btn btn-primary"
                    style={{ padding: '3px 8px', height: '24px', fontSize: '11px', borderRadius: '6px', textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} />
                    WebUI
                  </a>
                </div>
              </>
            )}
          </div>

          {/* 右侧 快速操作 & 主题切换器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 三态主题切换胶囊 (系统/Dark/Light) */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '2px',
                gap: '2px'
              }}
              title="切换界面风格 (系统 / 暗色 / 亮色)"
            >
              {themeOptions.map((opt) => {
                const isActive = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onThemeChange?.(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      fontSize: '11.5px',
                      fontWeight: isActive ? 600 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive 
                        ? 'linear-gradient(135deg, var(--c-llama-sky) 0%, var(--c-emerald) 100%)' 
                        : 'transparent',
                      color: isActive ? 'var(--c-canvas-light)' : 'var(--text-muted)',
                      boxShadow: isActive ? '0 2px 8px rgba(14, 165, 233, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={opt.title}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onQuickAddClick}
              className="btn btn-secondary"
              style={{
                borderColor: 'rgba(14, 165, 233, 0.35)',
                background: 'rgba(14, 165, 233, 0.08)',
                color: 'var(--c-llama-sky)',
                fontSize: '13px',
                padding: '6px 14px'
              }}
            >
              <Plus size={15} />
              添加 / 下载 HF 模型
            </button>
          </div>
        </div>

        {/* 下方 Tab 导航条 */}
        <nav style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '10px',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '10px' }}
          >
            <Server size={15} />
            🚀 服务控制台
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`btn ${activeTab === 'models' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '10px' }}
          >
            <HardDrive size={15} />
            📦 本地模型库
            {modelsCount > 0 && (
              <span style={{
                background: activeTab === 'models' ? 'rgba(255,255,255,0.2)' : 'rgba(100, 116, 139, 0.2)',
                padding: '1px 6px',
                borderRadius: '999px',
                fontSize: '11px'
              }}>
                {modelsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('download')}
            className={`btn ${activeTab === 'download' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '10px' }}
          >
            <DownloadCloud size={15} />
            🌐 HF 下载与收藏中心
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '10px' }}
          >
            <Settings size={15} />
            ⚙️ 系统与接口设置
          </button>
        </nav>
      </div>
    </header>
  );
}
