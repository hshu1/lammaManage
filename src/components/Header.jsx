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
  Sparkles
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  serverStatus, 
  modelsCount, 
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

  return (
    <header style={{
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div className="app-container" style={{ padding: '16px 24px' }}>
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
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 50%, #818cf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
              fontSize: '22px'
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
                本地大模型服务调度 · 参数调优 · HuggingFace 极速下载
              </p>
            </div>
          </div>

          {/* 中间 服务状态胶囊 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.7)',
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

              <span style={{ fontWeight: 600, color: isRunning ? '#34d399' : isStarting ? '#fbbf24' : isError ? '#fb7185' : '#94a3b8' }}>
                {isRunning ? `服务运行中 (:${serverStatus.port})` : isStarting ? '正在加载模型...' : isError ? '服务异常' : '服务未启动'}
              </span>
            </div>

            {isRunning && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
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
                    style={{ padding: '4px 8px', height: '24px', fontSize: '11px', borderRadius: '6px' }}
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
                    style={{ padding: '4px 8px', height: '24px', fontSize: '11px', borderRadius: '6px', textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} />
                    WebUI
                  </a>
                </div>
              </>
            )}
          </div>

          {/* 右侧 快速操作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onQuickAddClick}
              className="btn btn-secondary"
              style={{
                borderColor: 'rgba(168, 85, 247, 0.4)',
                background: 'rgba(168, 85, 247, 0.1)',
                color: '#d8b4fe'
              }}
            >
              <Plus size={16} />
              添加 / 下载 HF 模型
            </button>
          </div>
        </div>

        {/* 下方 Tab 导航条 */}
        <nav style={{
          display: 'flex',
          gap: '8px',
          marginTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '12px',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '10px' }}
          >
            <Server size={16} />
            🚀 服务控制台
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`btn ${activeTab === 'models' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '10px' }}
          >
            <HardDrive size={16} />
            📦 本地模型库
            {modelsCount > 0 && (
              <span style={{
                background: activeTab === 'models' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
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
            <DownloadCloud size={16} />
            🌐 HF 下载与收藏中心
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '10px' }}
          >
            <Settings size={16} />
            ⚙️ 系统与接口设置
          </button>
        </nav>
      </div>
    </header>
  );
}
