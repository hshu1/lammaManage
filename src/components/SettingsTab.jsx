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
  RotateCcw
} from 'lucide-react';
import { api } from '../api/client.js';
import FileBrowserModal from './FileBrowserModal.jsx';

export default function SettingsTab({
  config,
  configMeta = {},
  onSaveConfig,
  onResetConfig,
  onOpenFolder,
  addToast
}) {
  const [formData, setFormData] = useState({
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

  const handleResetDefaults = async () => {
    if (!window.confirm('确定要清空 SQLite 个人参数并恢复为出厂默认初始化配置 (JSON) 吗？')) {
      return;
    }
    setResetting(true);
    try {
      if (onResetConfig) {
        await onResetConfig();
      }
    } catch (e) {
      addToast?.({ type: 'error', title: '重置失败', message: e.message });
    } finally {
      setResetting(false);
    }
  };

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
        executablePath: config.executablePath || '',
        modelsPath: config.modelsPath || '',
        defaultHost: config.defaultHost || '127.0.0.1',
        defaultPort: config.defaultPort || 8080,
        hfMirror: config.hfMirror || 'https://hf-mirror.com',
        hfToken: config.hfToken || ''
      });
    }
  }, [config]);

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
        // 若原生系统弹窗受限，自动弹出内置可视化目录选择器
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig(formData);
      addToast?.({ type: 'success', title: '保存成功', message: '系统设置与路径配置已成功持久化' });
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
      {/* 路径与网络核心配置 */}
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
              <Settings size={22} style={{ color: '#38bdf8' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>系统路径与网络接口设置</h2>
            </div>
            
            {/* 存储模式指示器 */}
            <span 
              className={`badge ${configMeta.isCustomized ? 'badge-amber' : 'badge-green'}`} 
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
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                background: 'rgba(56, 189, 248, 0.08)'
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
                  style={{ fontSize: '12px', padding: '3px 8px', color: '#38bdf8' }}
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
                  style={{ fontSize: '12px', padding: '3px 8px', color: '#38bdf8' }}
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
            borderTop: '1px solid rgba(255,255,255,0.06)'
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
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={resetting || saving}
              className="btn btn-ghost"
              style={{
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.05)',
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

      {/* 接口文档与第三方客户端对接指南 */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Globe size={22} style={{ color: '#a855f7' }} />
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
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#38bdf8', marginBottom: '6px' }}>
              Cherry Studio / Chatbox
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <div>• 提供商选择: <strong>OpenAI 兼容 / 自定义</strong></div>
              <div>• API Base URL: <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{currentEndpoint}/v1</strong></div>
              <div>• API Key: <strong>任意填写 (如 123)</strong></div>
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#a855f7', marginBottom: '6px' }}>
              NextChat (ChatGPT-Next-Web)
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <div>• 接口地址: <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{currentEndpoint}</strong></div>
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
            background: 'rgba(5, 8, 15, 0.95)',
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
