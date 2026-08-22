import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FolderOpen, 
  Terminal, 
  Code, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  Globe,
  Sparkles,
  RefreshCw,
  FolderSearch,
  FileCode,
  HardDrive,
  Database,
  RotateCcw,
  Palette,
  Sun,
  Moon,
  Monitor,
  Check
} from 'lucide-react';
import { api } from '../api/client.js';
import FileBrowserModal from './FileBrowserModal.jsx';
import { PALETTE_COLORS, THEME_OPTIONS, GRADIENT_SPECS } from '../theme/themeConfig.js';

export default function SettingsTab({
  config,
  configMeta = {},
  theme = 'system',
  onThemeChange,
  onSaveConfig,
  onResetConfig,
  onOpenFolder,
  addToast
}) {
  const [formData, setFormData] = useState({
    theme: 'system',
    executablePath: '',
    modelsPath: '',
    defaultHost: '127.0.0.1',
    defaultPort: 8080,
    hfMirror: 'https://hf-mirror.com',
    hfToken: ''
  });

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState('python');

  // 文件/目录树浏览弹窗状态
  const [browserModal, setBrowserModal] = useState({
    isOpen: false,
    mode: 'folder',
    title: '',
    initialPath: '',
    filterExt: '',
    targetField: ''
  });

  useEffect(() => {
    if (config) {
      setFormData({
        theme: config.theme || theme || 'system',
        executablePath: config.executablePath || '',
        modelsPath: config.modelsPath || '',
        defaultHost: config.defaultHost || '127.0.0.1',
        defaultPort: config.defaultPort || 8080,
        hfMirror: config.hfMirror || 'https://hf-mirror.com',
        hfToken: config.hfToken || ''
      });
    }
  }, [config, theme]);

  const handleResetDefaults = async () => {
    if (!window.confirm('确定要清空 SQLite 个人参数并恢复为出厂默认初始化配置 (JSON) 吗？主题也将重置为系统默认。')) {
      return;
    }
    setResetting(true);
    try {
      if (onResetConfig) {
        await onResetConfig();
        onThemeChange?.('system');
      }
    } catch (e) {
      addToast?.({ type: 'error', title: '重置失败', message: e.message });
    } finally {
      setResetting(false);
    }
  };

  // 选择 llama-server.exe 文件
  const handleSelectExecutable = async () => {
    try {
      const res = await api.selectFile({
        title: '选择 llama-server.exe 可执行文件',
        filter: '可执行文件 (*.exe)|*.exe|所有文件 (*.*)|*.*',
        initialPath: formData.executablePath || ''
      });
      if (res.success && res.path) {
        setFormData(prev => ({ ...prev, executablePath: res.path }));
        addToast?.({ type: 'success', title: '已选择文件', message: res.path });
      } else if (res.error) {
        setBrowserModal({
          isOpen: true,
          mode: 'file',
          title: '浏览选择 llama-server.exe 文件',
          initialPath: formData.executablePath || '',
          filterExt: '.exe',
          targetField: 'executablePath'
        });
      }
    } catch (e) {
      setBrowserModal({
        isOpen: true,
        mode: 'file',
        title: '浏览选择 llama-server.exe 文件',
        initialPath: formData.executablePath || '',
        filterExt: '.exe',
        targetField: 'executablePath'
      });
    }
  };

  // 选择 models 模型存储目录
  const handleSelectModelsFolder = async () => {
    try {
      const res = await api.selectFolder({
        title: '选择本地 GGUF 模型存储目录',
        initialPath: formData.modelsPath || ''
      });
      if (res.success && res.path) {
        setFormData(prev => ({ ...prev, modelsPath: res.path }));
        addToast?.({ type: 'success', title: '已选择模型目录', message: res.path });
      } else if (res.error) {
        setBrowserModal({
          isOpen: true,
          mode: 'folder',
          title: '浏览选择本地 GGUF 模型存储目录',
          initialPath: formData.modelsPath || '',
          filterExt: '',
          targetField: 'modelsPath'
        });
      }
    } catch (e) {
      setBrowserModal({
        isOpen: true,
        mode: 'folder',
        title: '浏览选择本地 GGUF 模型存储目录',
        initialPath: formData.modelsPath || '',
        filterExt: '',
        targetField: 'modelsPath'
      });
    }
  };

  const handleAutoDetect = async () => {
    setDetecting(true);
    try {
      let res;
      try {
        res = await api.detectPaths();
      } catch (e1) {
        const configRes = await api.getConfig();
        if (configRes.success && configRes.detected) {
          res = configRes;
        } else if (configRes.success && configRes.config) {
          res = {
            success: true,
            detected: {
              executablePath: configRes.config.executablePath,
              modelsPath: configRes.config.modelsPath
            },
            validation: configRes.validation
          };
        } else {
          throw e1;
        }
      }

      if (res && res.success && res.detected) {
        const { executablePath, modelsPath } = res.detected;
        const { exeExists, modelsDirExists } = res.validation || {};

        setFormData(prev => ({
          ...prev,
          executablePath: executablePath || prev.executablePath,
          modelsPath: modelsPath || prev.modelsPath
        }));

        if (exeExists && modelsDirExists) {
          addToast?.({
            type: 'success',
            title: '自动扫描成功',
            message: '已成功自动识别到 llama-server 及本地模型库路径！'
          });
        } else if (exeExists) {
          addToast?.({
            type: 'info',
            title: '扫描完成',
            message: `已找到 llama-server (${executablePath})，未找到 models 目录`
          });
        } else if (modelsDirExists) {
          addToast?.({
            type: 'info',
            title: '扫描完成',
            message: `已找到模型库目录 (${modelsPath})，未找到 llama-server`
          });
        } else {
          addToast?.({
            type: 'warning',
            title: '已生成推导路径',
            message: '未能自动发现已存在的文件，已填入默认相对推导路径，请确认。'
          });
        }
      }
    } catch (err) {
      addToast?.({ type: 'error', title: '扫描失败', message: err.message });
    } finally {
      setDetecting(false);
    }
  };

  const handleSelectTheme = (themeId) => {
    setFormData(prev => ({ ...prev, theme: themeId }));
    onThemeChange?.(themeId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig(formData);
      addToast?.({ type: 'success', title: '保存成功', message: '系统设置与主题配置已成功持久化到 SQLite' });
    } catch (err) {
      addToast?.({ type: 'error', title: '保存失败', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = (text) => {
    navigator.clipboard.writeText(text);
    addToast?.({ type: 'success', title: '已复制', message: '代码示例已复制到剪贴板' });
  };

  const currentEndpoint = `http://${formData.defaultHost || '127.0.0.1'}:${formData.defaultPort || 8080}`;

  const pythonSnippet = `from openai import OpenAI

# 连接本地已启动的 Llama.cpp 服务
client = OpenAI(
    base_url="${currentEndpoint}/v1",
    api_key="no-key-required"  # 本地服务默认无需 Key
)

response = client.chat.completions.create(
    model="default",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "你好！请写一段快速排序的 Python 实现。"}
    ],
    temperature=0.7,
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
`;

  const curlSnippet = `curl ${currentEndpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "你好，请做个自我介绍"}],
    "temperature": 0.7
  }'`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. UI 主题与极简调色盘设计板块 */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Palette size={22} style={{ color: 'var(--c-llama-sky)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>UI 风格设置与 10 色调色盘规范</h2>
          </div>

          <span className="badge badge-primary" style={{ fontSize: '12px', padding: '4px 10px' }}>
            Llama WebUI 简约调色体系 (≤ 10色)
          </span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.5' }}>
          遵循 Llama / Ollama WebUI 极简克制美学。全站严格收敛于 <strong>10 种单色调色盘</strong>，所有渐变仅允许在这 10 种基础色之间插值生成，杜绝视觉噪点。
        </p>

        {/* 主题选择 3 态卡片 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '14px',
          marginBottom: '24px'
        }}>
          {THEME_OPTIONS.map((opt) => {
            const isSelected = (formData.theme || theme) === opt.id;
            const IconComponent = opt.id === 'system' ? Monitor : opt.id === 'dark' ? Moon : Sun;

            return (
              <div
                key={opt.id}
                onClick={() => handleSelectTheme(opt.id)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                  border: isSelected ? '2px solid var(--c-llama-sky)' : '1px solid var(--border-color)',
                  boxShadow: isSelected ? 'var(--border-glow)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isSelected 
                        ? 'linear-gradient(135deg, var(--c-llama-sky) 0%, var(--c-emerald) 100%)' 
                        : 'var(--bg-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? 'var(--c-canvas-light)' : 'var(--text-muted)'
                    }}>
                      <IconComponent size={16} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: isSelected ? 'var(--c-llama-sky)' : 'var(--text-main)' }}>
                      {opt.label}
                    </span>
                  </div>

                  {isSelected && (
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'var(--c-llama-sky)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Check size={13} strokeWidth={3} />
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.45', margin: 0 }}>
                  {opt.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* 10 色调色盘与渐变规范折叠/展示 */}
        <div style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px'
        }}>
          <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🎨 严格 10 色单色调色盘 (Strict Palette Specs)</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '10px',
            marginBottom: '16px'
          }}>
            {PALETTE_COLORS.map((col, idx) => (
              <div
                key={col.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: col.hex,
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {idx + 1}. {col.name}
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--c-muted-slate)' }}>
                    {col.hex}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 渐变规范示意 */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              ✨ 调色盘内插值渐变 (Gradients Restricted to Defined 10 Colors)
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '8px'
            }}>
              {GRADIENT_SPECS.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                  <div style={{ width: '28px', height: '14px', borderRadius: '4px', background: g.css, flexShrink: 0 }} />
                  <span>{g.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 路径与网络核心配置 */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings size={22} style={{ color: 'var(--c-llama-sky)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>系统路径与网络接口设置</h2>
            </div>
            
            {/* 存储模式指示器 */}
            <span 
              className={`badge ${configMeta.isCustomized ? 'badge-amber' : 'badge-emerald'}`} 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '12px' }}
              title={configMeta.isCustomized ? '已启用 SQLite 个人易变参数覆盖' : '使用出厂 JSON 初始化参数'}
            >
              <Database size={13} />
              {configMeta.isCustomized ? 'SQLite 个人参数 (覆盖生效)' : 'JSON 初始默认配置'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={detecting}
              className="btn btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                color: 'var(--c-llama-sky)',
                borderColor: 'rgba(14, 165, 233, 0.4)',
                background: 'rgba(14, 165, 233, 0.08)'
              }}
            >
              <Sparkles size={15} />
              {detecting ? '正在扫描路径...' : '自动扫描路径'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* 可执行文件路径 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="input-label" style={{ margin: 0 }}>
                llama-server.exe 可执行文件完整路径:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleSelectExecutable}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '3px 10px' }}
                >
                  <FolderOpen size={13} />
                  选择文件
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrowserModal({
                      isOpen: true,
                      mode: 'file',
                      title: '浏览选择 llama-server.exe 文件',
                      initialPath: formData.executablePath || '',
                      filterExt: '.exe',
                      targetField: 'executablePath'
                    });
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '3px 8px', color: 'var(--text-muted)' }}
                  title="在网页内部可视化浏览目录"
                >
                  <FolderSearch size={13} />
                  树形浏览
                </button>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '3px 8px', color: 'var(--c-llama-sky)' }}
                >
                  <Sparkles size={13} />
                  自动扫描
                </button>
              </div>
            </div>
            <input
              type="text"
              value={formData.executablePath}
              onChange={(e) => setFormData({ ...formData, executablePath: e.target.value })}
              className="input-text"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
              placeholder="例如: D:\99_lamma\lamma\llama-b9994-bin-win-cuda-13.3-x64\llama-server.exe"
            />
          </div>

          {/* 模型存放目录 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="input-label" style={{ margin: 0 }}>
                本地 GGUF 模型存储目录 (扫描与下载存放路径):
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleSelectModelsFolder}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '3px 10px' }}
                >
                  <FolderOpen size={13} />
                  选择文件夹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrowserModal({
                      isOpen: true,
                      mode: 'folder',
                      title: '浏览选择模型存储目录',
                      initialPath: formData.modelsPath || '',
                      filterExt: '',
                      targetField: 'modelsPath'
                    });
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '3px 8px', color: 'var(--text-muted)' }}
                  title="在网页内部可视化浏览目录"
                >
                  <FolderSearch size={13} />
                  树形浏览
                </button>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '3px 8px', color: 'var(--c-llama-sky)' }}
                >
                  <Sparkles size={13} />
                  自动扫描
                </button>
              </div>
            </div>
            <input
              type="text"
              value={formData.modelsPath}
              onChange={(e) => setFormData({ ...formData, modelsPath: e.target.value })}
              className="input-text"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
              placeholder="例如: D:\99_lamma\models"
            />
          </div>

          {/* 监听 Host 与 Port */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div>
              <label className="input-label">默认服务监听 Host:</label>
              <select
                value={formData.defaultHost}
                onChange={(e) => setFormData({ ...formData, defaultHost: e.target.value })}
                className="input-select"
              >
                <option value="127.0.0.1">127.0.0.1 (仅允许本机访问，安全)</option>
                <option value="0.0.0.0">0.0.0.0 (允许局域网其他设备访问)</option>
              </select>
            </div>

            <div>
              <label className="input-label">默认服务监听端口 (Port):</label>
              <input
                type="number"
                value={formData.defaultPort}
                onChange={(e) => setFormData({ ...formData, defaultPort: parseInt(e.target.value, 10) || 8080 })}
                className="input-text"
              />
            </div>
          </div>

          {/* HuggingFace 镜像源与 Token */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color)'
          }}>
            <div>
              <label className="input-label">HuggingFace 默认下载源 / 镜像端点:</label>
              <input
                type="text"
                value={formData.hfMirror}
                onChange={(e) => setFormData({ ...formData, hfMirror: e.target.value })}
                className="input-text"
                placeholder="https://hf-mirror.com"
              />
            </div>

            <div>
              <label className="input-label">HF Access Token (访问私有/受限模型选填):</label>
              <input
                type="password"
                value={formData.hfToken}
                onChange={(e) => setFormData({ ...formData, hfToken: e.target.value })}
                className="input-text"
                placeholder="hf_..."
              />
            </div>
          </div>

          {/* 提交保存与恢复默认 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '14px',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={resetting || saving}
              className="btn btn-ghost"
              style={{
                color: 'var(--c-rose)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.06)',
                fontSize: '13px',
                padding: '8px 16px'
              }}
              title="清空 SQLite 中的个人参数，回退至出厂 JSON 初始化模板"
            >
              <RotateCcw size={15} />
              {resetting ? '正在恢复...' : '恢复出厂初始化配置 (JSON)'}
            </button>

            <button 
              type="submit" 
              disabled={saving || resetting} 
              className="btn btn-primary" 
              style={{ padding: '10px 24px' }}
            >
              <Save size={16} />
              {saving ? '正在持久化...' : '保存个人配置 (SQLite)'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. 接口文档与第三方客户端对接指南 */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Globe size={22} style={{ color: 'var(--c-llama-sky)' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>OpenAI 兼容 API 接入与第三方客户端配置</h2>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
          Llama.cpp 服务启动后，全面原生兼容 OpenAI 标准接口协议。无论是 Python、Node.js 还是各大常用大模型桌面客户端（如 Cherry Studio、NextChat、Chatbox、Open-WebUI、Dify 等）均可无缝直接接入。
        </p>

        {/* 常用客户端配置卡片 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--c-llama-sky)', marginBottom: '6px' }}>
              Cherry Studio / Chatbox
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <div>• 提供商选择: <strong>OpenAI 兼容 / 自定义</strong></div>
              <div>• API Base URL: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{currentEndpoint}/v1</strong></div>
              <div>• API Key: <strong>任意填写 (如 123)</strong></div>
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--c-emerald)', marginBottom: '6px' }}>
              NextChat (ChatGPT-Next-Web)
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <div>• 接口地址: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{currentEndpoint}</strong></div>
              <div>• 模型名称: <strong>输入当前运行的模型名称</strong></div>
              <div>• API Key: <strong>空或任意值</strong></div>
            </div>
          </div>
        </div>

        {/* 代码示例切换 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveCodeTab('python')}
                className={`btn ${activeCodeTab === 'python' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 12px', fontSize: '12px' }}
              >
                Python (OpenAI SDK)
              </button>
              <button
                onClick={() => setActiveCodeTab('curl')}
                className={`btn ${activeCodeTab === 'curl' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 12px', fontSize: '12px' }}
              >
                cURL 命令行
              </button>
            </div>

            <button
              onClick={() => copyCode(activeCodeTab === 'python' ? pythonSnippet : curlSnippet)}
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
            >
              <Copy size={13} />
              复制代码
            </button>
          </div>

          <pre style={{
            background: 'var(--terminal-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            color: '#e2e8f0',
            overflowX: 'auto',
            lineHeight: '1.5'
          }}>
            <code>{activeCodeTab === 'python' ? pythonSnippet : curlSnippet}</code>
          </pre>
        </div>
      </div>

      {/* 可视化文件/文件夹树形浏览模态框 */}
      <FileBrowserModal
        isOpen={browserModal.isOpen}
        onClose={() => setBrowserModal(prev => ({ ...prev, isOpen: false }))}
        mode={browserModal.mode}
        title={browserModal.title}
        initialPath={browserModal.initialPath}
        filterExt={browserModal.filterExt}
        onSelect={(selectedPath) => {
          if (browserModal.targetField) {
            setFormData(prev => ({ ...prev, [browserModal.targetField]: selectedPath }));
            addToast?.({ type: 'success', title: '已选择路径', message: selectedPath });
          }
        }}
        addToast={addToast}
      />
    </div>
  );
}
