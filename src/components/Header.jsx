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
  theme = 'system',
  onThemeChange,
  onDownloadClick,
  onSettingsClick,
  addToast 
}) {
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
          {/* 左侧标题 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }} className="gradient-text">
              Llama.cpp 控制台
            </h1>
          </div>

          {/* 右侧 快速操作 & 主题切换器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            
            <button
              onClick={onSettingsClick}
              className="btn btn-ghost"
              style={{
                fontSize: '13px',
                padding: '6px 14px'
              }}
              title="系统设置"
            >
              <Settings size={15} />
              设置
            </button>
            
            <button
              onClick={onDownloadClick}
              className="btn btn-secondary"
              style={{
                borderColor: 'var(--primary)',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: '13px',
                padding: '6px 14px'
              }}
            >
              <Plus size={15} />
              添加模型
            </button>

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
              title="切换界面风格"
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
                        ? 'var(--primary)' 
                        : 'transparent',
                      color: isActive ? '#FFFFFF' : 'var(--text-muted)',
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
          </div>
        </div>
      </div>
    </header>
  );
}
