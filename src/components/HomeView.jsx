import React, { useState, useEffect, useMemo } from 'react';
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
  MessageSquare,
  Filter,
  HardDrive,
  Gauge,
  HelpCircle
} from 'lucide-react';
import LogViewer from './LogViewer.jsx';
import ChatPlayground from './ChatPlayground.jsx';
import { formatDuration } from '../utils/formatters.js';
import { estimateFullContextVram } from '../utils/vramCalculator.js';

const DEFAULT_PRESETS = [
  {
    id: 'daily_8k',
    name: '日常8196 (8K 基础版)',
    desc: '全层 GPU 加速，8K 上下文，启动迅速，适合日常极速对话与常规问答。',
    tags: ['日常对话', '8K', '纯GPU', '默认精度'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 8000 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 8000,
      threads: 8,
      parallel: 1,
      flashAttn: false,
      cacheTypeK: 'f16',
      cacheTypeV: 'f16',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_a_32k',
    name: '方案A: 高频长对话 / 代码重构 (32K)',
    desc: '适合高频长对话、大型代码重构与中长篇文档总结，开启 Flash Attention 与 Q4 KV 缓存，平衡显存与速度。',
    tags: ['代码重构', '32K', 'FlashAttn', 'Q4缓存', '中长文档', '纯GPU'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 32768 -np 1 -fa on --cache-type-k q4_0 --cache-type-v q4_0 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 32768,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q4_0',
      cacheTypeV: 'q4_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_b_hybrid_64k',
    name: '方案B: CPU+GPU 混合卸载 (极限 64K~128K)',
    desc: '显存有限但需极限超长上下文，卸载 28 层至 GPU，剩余由 CPU 内存分担，彻底防爆显存。',
    tags: ['混合卸载', '64K', '超长文本', '低显存占用', 'CPU辅助'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 28 --ctx-size 65536 -np 1 -fa on --cache-type-k q4_0 --cache-type-v q4_0 -t 8 --port 8080',
    params: {
      nGpuLayers: 28,
      ctxSize: 65536,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q4_0',
      cacheTypeV: 'q4_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_c_gpu_64k',
    name: '方案C: 纯 GPU 满血加速 (64K 顶配)',
    desc: '大显存显卡专享，全层 GPU 加速 + 64K 超长上下文 + Q4 KV 缓存，极速超长文本推理。',
    tags: ['纯GPU', '64K', '超长文本', '高性能', 'FlashAttn', 'Q4缓存'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 65536 -np 1 -fa on --cache-type-k q4_0 --cache-type-v q4_0 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 65536,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q4_0',
      cacheTypeV: 'q4_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_d_high_precision_32k',
    name: '方案D: 极高精度方案 (32K Q8 Cache)',
    desc: '32K 上下文并启用 Q8_0 高精度量化缓存与 Flash Attention，追求更高注意力精度。',
    tags: ['高精度', '32K', 'Q8缓存', '代码重构', 'FlashAttn', '纯GPU'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 32768 -np 1 -fa on --cache-type-k q8_0 --cache-type-v q8_0 --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 32768,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q8_0',
      cacheTypeV: 'q8_0',
      mcpProxy: false,
      extraArgs: ''
    }
  },
  {
    id: 'scheme_d_plus_mcp_32k',
    name: '方案D+: 极高精度 + MCP 智能体 (32K)',
    desc: '极高精度方案（32k 上下文追求更高注意力精度 + WebUI MCP 代理支持），完美适配智能体工具链。',
    tags: ['高精度', '32K', 'MCP智能体', 'WebUI扩展', 'Q8缓存', 'FlashAttn', '纯GPU'],
    rawCommand: './llama-b9994-bin-win-cuda-13.3-x64/llama-server.exe -m ../models/Qwen3.5-9B-DeepSeek-V4-Flash-Q4_K_M.gguf --n-gpu-layers 99 --ctx-size 32768 -np 1 -fa on --cache-type-k q8_0 --cache-type-v q8_0 --webui-mcp-proxy --port 8080',
    params: {
      nGpuLayers: 99,
      ctxSize: 32768,
      threads: 8,
      parallel: 1,
      flashAttn: true,
      cacheTypeK: 'q8_0',
      cacheTypeV: 'q8_0',
      mcpProxy: true,
      extraArgs: ''
    }
  }
];

export default function HomeView({
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

  const presetList = (config?.presets && config.presets.length > 0) ? config.presets : DEFAULT_PRESETS;

  // 选中的模型
  const [selectedModel, setSelectedModel] = useState(config?.activeModel || (models[0]?.filename || ''));

  // 选中的预设 ID
  const [selectedPresetId, setSelectedPresetId] = useState('daily_8k');

  // 筛选下拉框状态：仅保留 ctx 上下文和总内存/显存占用
  const [ctxFilter, setCtxFilter] = useState('all');
  const [vramFilter, setVramFilter] = useState('all');

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

  // 获取当前选中的模型对象
  const currentModelObj = useMemo(() => {
    return models.find(m => m.filename === selectedModel) || null;
  }, [models, selectedModel]);

  // 根据 CTX 下拉框与 显存/内存占用下拉框 进行双重过滤
  const filteredPresets = useMemo(() => {
    return presetList.filter((preset) => {
      // 1. CTX 上下文大小筛选
      if (ctxFilter !== 'all') {
        const targetCtx = parseInt(ctxFilter, 10);
        if (preset.params.ctxSize !== targetCtx) return false;
      }

      // 2. 满上下文显存/内存占用范围筛选
      if (vramFilter !== 'all') {
        const vramEst = estimateFullContextVram({
          modelSizeBytes: currentModelObj?.size || 0,
          ...preset.params
        });
        const vramNum = vramEst.totalVramNumber;

        if (vramFilter === 'low' && vramNum > 8.0) return false;
        if (vramFilter === 'medium' && (vramNum <= 8.0 || vramNum > 10.0)) return false;
        if (vramFilter === 'high' && vramNum <= 10.0) return false;
        if (vramFilter === 'hybrid' && !vramEst.isPartialOffload) return false;
      }

      return true;
    });
  }, [presetList, ctxFilter, vramFilter, currentModelObj]);

  // 当前参数下满上下文显存占用估算
  const currentParamsVram = useMemo(() => {
    return estimateFullContextVram({
      modelSizeBytes: currentModelObj?.size || 0,
      ...params
    });
  }, [currentModelObj, params]);

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
                <span className="badge badge-primary">CUDA 13.3</span>
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

        
        {/* 新版极简模型列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {models.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              未检测到本地模型，请点击右上角下载图标添加
            </div>
          ) : (
            models.map(m => {
              const isExpanded = selectedModel === m.filename;
              return (
                <div key={m.filename} className="glass-panel glass-panel-hover" style={{ padding: '20px', transition: 'all 0.3s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <HardDrive size={24} style={{ color: 'var(--c-llama-sky)' }} />
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{m.filename}</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {m.sizeFormatted} · {m.quant} · {m.family}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {(isRunning && serverStatus?.activeModel === m.filename) ? (
                        <button onClick={onStopServer} className="btn btn-danger" style={{ padding: '6px 16px' }}>
                          <Square size={14} /> 停止运行
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            if (isRunning) return;
                            setSelectedModel(isExpanded ? null : m.filename);
                          }} 
                          className={isExpanded ? "btn btn-secondary" : "btn btn-primary"}
                          style={{ padding: '6px 16px' }}
                          disabled={isRunning}
                        >
                          {isExpanded ? '收起配置' : (isRunning ? '服务被占用' : '▶ 展开并启动')}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && !isRunning && (
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
{/* 2. 预设方案选择卡片网格与下拉框双维度筛选 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={16} style={{ color: '#38bdf8' }} />
              <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                一键预设方案选择:
              </label>
            </div>

            {/* 仅保留 CTX 和 总显存/内存占用 两个下拉框 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* CTX 筛选下拉框 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>上下文 CTX:</span>
                <select
                  value={ctxFilter}
                  onChange={(e) => setCtxFilter(e.target.value)}
                  className="input-select"
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    width: 'auto',
                    minWidth: '120px',
                    background: 'var(--bg-input)'
                  }}
                >
                  <option value="all">全部上下文</option>
                  <option value="8000">8K (8,000)</option>
                  <option value="32768">32K (32,768)</option>
                  <option value="65536">64K (65,536)</option>
                </select>
              </div>

              {/* 显存/内存占用 筛选下拉框 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>总显存/内存占用:</span>
                <select
                  value={vramFilter}
                  onChange={(e) => setVramFilter(e.target.value)}
                  className="input-select"
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    width: 'auto',
                    minWidth: '145px',
                    background: 'var(--bg-input)'
                  }}
                >
                  <option value="all">全部占用范围</option>
                  <option value="low">轻量 (≤ 8.0 GB)</option>
                  <option value="medium">适中 (8.1 ~ 10.0 GB)</option>
                  <option value="high">满载高配 (&gt; 10.0 GB)</option>
                  <option value="hybrid">CPU 混合卸载</option>
                </select>
              </div>
            </div>
          </div>

          {/* 预设卡片网格 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px'
          }}>
            {filteredPresets.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-subtle)',
                borderRadius: '10px',
                border: '1px dashed var(--border-color)',
                fontSize: '13px'
              }}>
                没有匹配当前所选「上下文」或「显存占用」条件的预设方案，请尝试重置筛选下拉框
              </div>
            ) : (
              filteredPresets.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                const vramEst = estimateFullContextVram({
                  modelSizeBytes: currentModelObj?.size || 0,
                  ...preset.params
                });

                return (
                  <div
                    key={preset.id}
                    onClick={() => !isRunning && handleApplyPreset(preset)}
                    className={`glass-panel glass-panel-hover`}
                    style={{
                      padding: '14px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.7 : 1,
                      background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'var(--bg-card)',
                      borderColor: isSelected ? 'var(--c-llama-sky)' : 'var(--border-color)',
                      boxShadow: isSelected ? 'var(--border-glow)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: isSelected ? 'var(--c-llama-sky)' : 'var(--text-main)' }}>
                          {preset.name}
                        </span>
                        {isSelected && <CheckCircle2 size={16} style={{ color: 'var(--c-llama-sky)' }} />}
                      </div>

                      <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: '1.4', marginBottom: '12px' }}>
                        {preset.desc}
                      </p>
                    </div>

                    <div>
                      {/* 参数徽章 */}
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span className="badge badge-primary" style={{ fontSize: '10px' }}>Ctx: {preset.params.ctxSize}</span>
                        <span className="badge badge-purple" style={{ fontSize: '10px' }}>GPU: {preset.params.nGpuLayers}层</span>
                        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>KV: {preset.params.cacheTypeK}</span>
                        {preset.params.flashAttn && <span className="badge badge-emerald" style={{ fontSize: '10px' }}>FA</span>}
                        {preset.params.mcpProxy && <span className="badge badge-amber" style={{ fontSize: '10px' }}>MCP</span>}
                      </div>

                      {/* 满上下文预估显存量 */}
                      <div style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px dashed var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>满上下文预估显存:</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: vramEst.totalVramNumber > 11 ? 'var(--c-amber)' : vramEst.totalVramNumber > 8 ? 'var(--c-llama-sky)' : 'var(--c-emerald)',
                          background: 'var(--bg-input)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)'
                        }}>
                          🔥 ~{vramEst.totalVram} GB {vramEst.isPartialOffload ? `(+${vramEst.systemRam}G内存)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 满上下文显存即时预算分析条 */}
        <div style={{
          marginBottom: '20px',
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-highlight)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gauge size={18} style={{ color: 'var(--c-llama-sky)' }} />
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                当前启动参数 · 满上下文峰值资源预算:
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                模型权重: <strong style={{ color: '#cbd5e1' }}>~{currentParamsVram.modelWeightVram} GB</strong> · 
                KV缓存: <strong style={{ color: '#cbd5e1' }}>~{currentParamsVram.kvCacheVram} GB</strong> · 
                CUDA/运行时: <strong style={{ color: '#cbd5e1' }}>~{currentParamsVram.overheadVram} GB</strong>
                {currentParamsVram.isPartialOffload && (
                  <span> · CPU内存: <strong style={{ color: '#fbbf24' }}>~{currentParamsVram.systemRam} GB</strong></span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>预估满载显存:</span>
            <span className="badge" style={{
              fontSize: '13px',
              fontWeight: 800,
              padding: '4px 12px',
              background: currentParamsVram.totalVramNumber > 11 
                ? 'rgba(168, 85, 247, 0.2)' 
                : currentParamsVram.totalVramNumber > 8 
                ? 'rgba(56, 189, 248, 0.2)' 
                : 'rgba(16, 185, 129, 0.2)',
              color: currentParamsVram.totalVramNumber > 11 
                ? '#c084fc' 
                : currentParamsVram.totalVramNumber > 8 
                ? '#38bdf8' 
                : '#34d399',
              borderColor: currentParamsVram.totalVramNumber > 11 
                ? 'rgba(168, 85, 247, 0.4)' 
                : currentParamsVram.totalVramNumber > 8 
                ? 'rgba(56, 189, 248, 0.4)' 
                : 'rgba(16, 185, 129, 0.4)'
            }}>
              🔥 ~{currentParamsVram.totalVram} GB
            </span>
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
        
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
           <button onClick={() => onStartServer({ modelFilename: m.filename, params })} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '16px' }}>
             🚀 确认参数并启动服务
           </button>
        </div>
      </div>
    )}
  </div>
              );
            })
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
  </div>
);
}
