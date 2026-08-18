import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  ExternalLink, 
  Copy, 
  Sliders, 
  Layers, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Terminal,
  MessageSquare
} from 'lucide-react';
import LogViewer from './LogViewer.jsx';
import ChatPlayground from './ChatPlayground.jsx';
import { formatDuration } from '../utils/formatters.js';

export default function DashboardTab({
  config,
  models,
  serverStatus,
  logs,
  onStartServer,
  onStopServer,
  onRestartServer,
  onClearLogs,
  addToast,
  onNavigateToModels
}) {
  const isRunning = serverStatus?.status === 'RUNNING';
  const isStarting = serverStatus?.status === 'STARTING';
  const isStopping = serverStatus?.status === 'STOPPING';
  const isBusy = isStarting || isStopping;

  // 选中的模型
  const [selectedModel, setSelectedModel] = useState(config?.activeModel || (models[0]?.filename || ''));

  // 选中的预设 ID
  const [selectedPresetId, setSelectedPresetId] = useState('daily');

  // 当前细化参数
  const [params, setParams] = useState({
    nGpuLayers: 99,
    ctxSize: 8000,
    threads: 8,
    parallel: 1,
    flashAttn: false,
    cacheTypeK: 'f16',
    cacheTypeV: 'f16',
    mcpProxy: false,
    extraArgs: ''
  });

  // 高级参数面板折叠状态
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 下半部分 Tab 切换：'logs' 或 'chat'
  const [bottomTab, setBottomTab] = useState('logs');

  // 同步 config 变更
  useEffect(() => {
    if (config?.activeModel && !selectedModel) {
      setSelectedModel(config.activeModel);
    }
    if (config?.launchParams) {
      setParams(prev => ({ ...prev, ...config.launchParams }));
    }
  }, [config]);

  // 当 models 列表首次加载且 selectedModel 为空时赋初值
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].filename);
    }
  }, [models]);

  // 选择预设方案
  const handleApplyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setParams({ ...preset.params });
    addToast?.({
      type: 'info',
      title: '已应用预设',
      message: `已切换至「${preset.name}」`
    });
  };

  const handleStart = () => {
    if (!selectedModel) {
      addToast?.({ type: 'warning', title: '请选择模型', message: '请先在启动器中选择一个 GGUF 模型文件' });
      return;
    }
    onStartServer({
      modelFilename: selectedModel,
      params
    });
  };

  const copyEndpoint = () => {
    const ep = serverStatus?.endpoint || `http://${config.defaultHost}:${config.defaultPort}`;
    navigator.clipboard.writeText(ep);
    addToast?.({ type: 'success', title: '已复制', message: `API 接口地址已复制: ${ep}` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 顶部服务状态卡片 */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* 左侧状态指标 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: isRunning 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.4))' 
                : isStarting 
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.4))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
              border: isRunning ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRunning ? '0 0 25px rgba(16, 185, 129, 0.3)' : 'none'
            }}>
              <Activity size={24} style={{ color: isRunning ? '#34d399' : isStarting ? '#fbbf24' : '#64748b' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
                  {isRunning ? 'Llama.cpp 服务运行中' : isStarting ? '服务启动中...' : isStopping ? '服务停止中...' : '服务已停止'}
                </h2>
                {isRunning && <span className="badge badge-emerald">HEALTHY</span>}
                {isStarting && <span className="badge badge-amber">LOADING</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>PID: <strong style={{ color: '#f8fafc' }}>{serverStatus?.pid || '--'}</strong></span>
                <span>•</span>
                <span>监听: <strong style={{ color: '#f8fafc' }}>{serverStatus?.host || config.defaultHost}:{serverStatus?.port || config.defaultPort}</strong></span>
                {isRunning && (
                  <>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} />
                      运行时间: <strong style={{ color: '#38bdf8' }}>{formatDuration(serverStatus?.uptime)}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 右侧快捷动作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isRunning && (
              <>
                <button onClick={copyEndpoint} className="btn btn-secondary">
                  <Copy size={15} />
                  复制端点
                </button>
                <a
                  href={serverStatus?.endpoint}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  <ExternalLink size={15} />
                  打开 WebUI
                </a>
              </>
            )}

            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={isBusy || models.length === 0}
                className="btn btn-success"
                style={{ padding: '10px 24px', fontSize: '15px' }}
              >
                <Play size={18} />
                {isStarting ? '启动中...' : '启动 Llama 服务'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={onRestartServer}
                  disabled={isBusy}
                  className="btn btn-secondary"
                  title="重启服务"
                >
                  <RotateCcw size={16} />
                  重启
                </button>
                <button
                  onClick={onStopServer}
                  disabled={isBusy}
                  className="btn btn-danger"
                  style={{ padding: '10px 20px' }}
                >
                  <Square size={16} />
                  {isStopping ? '正在停止...' : '停止服务'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 活跃模型信息条 */}
        {isRunning && serverStatus?.activeModel && (
          <div style={{
            marginTop: '16px',
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} style={{ color: '#38bdf8' }} />
              <span>当前加载模型: <strong style={{ color: '#38bdf8' }}>{serverStatus.activeModel}</strong></span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-purple">GPU Layers: {serverStatus.currentParams?.nGpuLayers ?? '99'}</span>
              <span className="badge badge-primary">Context: {serverStatus.currentParams?.ctxSize ?? '8000'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 模型与启动参数配置区 */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} style={{ color: '#38bdf8' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>启动模型与参数配置</h3>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="btn btn-ghost"
            style={{ fontSize: '13px' }}
          >
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showAdvanced ? '收起高级参数' : '展开高级微调参数'}
          </button>
        </div>

        {/* 1. 模型选择器 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="input-label" style={{ margin: 0 }}>
              选择待加载的 GGUF 模型:
            </label>
            <button
              onClick={onNavigateToModels}
              className="btn btn-ghost"
              style={{ fontSize: '12px', padding: '2px 6px', color: '#38bdf8' }}
            >
              管理本地模型库 ({models.length}) →
            </button>
          </div>

          {models.length === 0 ? (
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fb7185',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>未在模型目录 ({config.modelsPath}) 中检测到任何 .gguf 模型文件</span>
              <button onClick={onNavigateToModels} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
                前往下载/导入模型
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isRunning || isBusy}
                className="input-select"
                style={{ fontSize: '14px', fontWeight: 600 }}
              >
                {models.map((m) => (
                  <option key={m.filename} value={m.filename}>
                    {m.filename} ({m.sizeFormatted} · {m.quant} · {m.family})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 2. 预设方案选择卡片网格 */}
        <div style={{ marginBottom: '20px' }}>
          <label className="input-label">一键预设方案选择:</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px'
          }}>
            {(config.presets || []).map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => !isRunning && handleApplyPreset(preset)}
                  className={`glass-panel glass-panel-hover`}
                  style={{
                    padding: '14px',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    opacity: isRunning ? 0.7 : 1,
                    background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                    borderColor: isSelected ? '#38bdf8' : 'var(--border-color)',
                    boxShadow: isSelected ? '0 0 15px rgba(56, 189, 248, 0.2)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                        {preset.name}
                      </span>
                      {isSelected && <CheckCircle2 size={15} style={{ color: '#38bdf8' }} />}
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: '1.4', marginBottom: '10px' }}>
                      {preset.desc}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="badge badge-primary" style={{ fontSize: '10px' }}>Ctx: {preset.params.ctxSize}</span>
                    <span className="badge badge-purple" style={{ fontSize: '10px' }}>GPU: {preset.params.nGpuLayers}</span>
                    {preset.params.flashAttn && <span className="badge badge-emerald" style={{ fontSize: '10px' }}>FA</span>}
                    {preset.params.mcpProxy && <span className="badge badge-amber" style={{ fontSize: '10px' }}>MCP</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. 高级微调参数抽屉 */}
        {showAdvanced && (
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            background: 'rgba(10, 15, 29, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}>
              {/* GPU 卸载层数 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="input-label" style={{ margin: 0 }}>GPU 卸载层数 (--n-gpu-layers):</label>
                  <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}>{params.nGpuLayers}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="99"
                  value={params.nGpuLayers}
                  onChange={(e) => setParams({ ...params, nGpuLayers: parseInt(e.target.value, 10) })}
                  disabled={isRunning}
                  className="range-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  <span>0 (纯CPU)</span>
                  <span>30 (显存适中)</span>
                  <span>99 (全层显存)</span>
                </div>
              </div>

              {/* 上下文窗口大小 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="input-label" style={{ margin: 0 }}>上下文窗口 Token 数 (--ctx-size):</label>
                  <span style={{ color: '#a855f7', fontWeight: 700, fontSize: '13px' }}>{params.ctxSize}</span>
                </div>
                <select
                  value={params.ctxSize}
                  onChange={(e) => setParams({ ...params, ctxSize: parseInt(e.target.value, 10) })}
                  disabled={isRunning}
                  className="input-select"
                >
                  <option value={4096}>4,096 (超轻量)</option>
                  <option value={8000}>8,000 (日常 8K 推荐)</option>
                  <option value={16384}>16,384 (16K)</option>
                  <option value={32768}>32,768 (32K 长对话/代码)</option>
                  <option value={65536}>65,536 (64K 极限长文本)</option>
                  <option value={131072}>131,072 (128K 超长上下文)</option>
                </select>
              </div>

              {/* CPU 线程数 */}
              <div>
                <label className="input-label">CPU 推理线程数 (-t):</label>
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={params.threads}
                  onChange={(e) => setParams({ ...params, threads: parseInt(e.target.value, 10) || 8 })}
                  disabled={isRunning}
                  className="input-text"
                />
              </div>

              {/* 并行插槽 Parallel */}
              <div>
                <label className="input-label">并发请求数 (-np / --parallel):</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={params.parallel}
                  onChange={(e) => setParams({ ...params, parallel: parseInt(e.target.value, 10) || 1 })}
                  disabled={isRunning}
                  className="input-text"
                />
              </div>

              {/* KV Cache K 量化 */}
              <div>
                <label className="input-label">KV 缓存 K 量化 (--cache-type-k):</label>
                <select
                  value={params.cacheTypeK}
                  onChange={(e) => setParams({ ...params, cacheTypeK: e.target.value })}
                  disabled={isRunning}
                  className="input-select"
                >
                  <option value="f16">f16 (标准精度)</option>
                  <option value="q8_0">q8_0 (8-bit 高精度压缩)</option>
                  <option value="q4_0">q4_0 (4-bit 极限显存节省)</option>
                  <option value="q4_1">q4_1 (4-bit 精度平衡)</option>
                </select>
              </div>

              {/* KV Cache V 量化 */}
              <div>
                <label className="input-label">KV 缓存 V 量化 (--cache-type-v):</label>
                <select
                  value={params.cacheTypeV}
                  onChange={(e) => setParams({ ...params, cacheTypeV: e.target.value })}
                  disabled={isRunning}
                  className="input-select"
                >
                  <option value="f16">f16 (标准精度)</option>
                  <option value="q8_0">q8_0 (8-bit 高精度压缩)</option>
                  <option value="q4_0">q4_0 (4-bit 极限显存节省)</option>
                  <option value="q4_1">q4_1 (4-bit 精度平衡)</option>
                </select>
              </div>
            </div>

            {/* 开关选项 */}
            <div style={{
              display: 'flex',
              gap: '24px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexWrap: 'wrap'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={params.flashAttn}
                  onChange={(e) => setParams({ ...params, flashAttn: e.target.checked })}
                  disabled={isRunning}
                  style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                />
                <span>启用 Flash Attention 闪光注意力 (-fa on)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={params.mcpProxy}
                  onChange={(e) => setParams({ ...params, mcpProxy: e.target.checked })}
                  disabled={isRunning}
                  style={{ width: '16px', height: '16px', accentColor: '#a855f7' }}
                />
                <span>启用 WebUI MCP 代理支持 (--webui-mcp-proxy)</span>
              </label>
            </div>

            {/* 自定义附加参数 */}
            <div style={{ marginTop: '16px' }}>
              <label className="input-label">其他附加参数 (Extra Flags):</label>
              <input
                type="text"
                value={params.extraArgs}
                onChange={(e) => setParams({ ...params, extraArgs: e.target.value })}
                disabled={isRunning}
                placeholder="例如: --embeddings --pooling cls"
                className="input-text"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 底部功能分区：实时终端日志 vs 测试对话 Playground */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <button
            onClick={() => setBottomTab('logs')}
            className={`btn ${bottomTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '8px', padding: '6px 14px', fontSize: '13px' }}
          >
            <Terminal size={15} />
            实时终端日志
          </button>
          <button
            onClick={() => setBottomTab('chat')}
            className={`btn ${bottomTab === 'chat' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: '8px', padding: '6px 14px', fontSize: '13px' }}
          >
            <MessageSquare size={15} />
            快速推断对话 Playground
          </button>
        </div>

        {bottomTab === 'logs' ? (
          <LogViewer logs={logs} onClear={onClearLogs} addToast={addToast} />
        ) : (
          <ChatPlayground serverStatus={serverStatus} addToast={addToast} />
        )}
      </div>
    </div>
  );
}
