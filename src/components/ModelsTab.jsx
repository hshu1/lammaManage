import React, { useState } from 'react';
import { 
  HardDrive, 
  Search, 
  FolderOpen, 
  Play, 
  Copy, 
  Trash2, 
  Sparkles, 
  Clock, 
  ExternalLink,
  Layers,
  Cpu,
  RefreshCw,
  Plus
} from 'lucide-react';
import { formatTime } from '../utils/formatters.js';

export default function ModelsTab({
  models = [],
  config,
  serverStatus,
  onRefreshModels,
  onStartModel,
  onDeleteModel,
  onOpenFolder,
  onNavigateToDownload,
  addToast
}) {
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [modelToDelete, setModelToDelete] = useState(null);

  const activeModelName = serverStatus?.status === 'RUNNING' ? serverStatus?.activeModel : null;

  // 提取所有已存在的家族类别
  const families = ['ALL', ...Array.from(new Set(models.map(m => m.family).filter(Boolean)))];

  const filteredModels = models.filter(m => {
    if (familyFilter !== 'ALL' && m.family !== familyFilter) return false;
    if (search && !m.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCopyPath = (path) => {
    navigator.clipboard.writeText(path);
    addToast?.({ type: 'success', title: '已复制', message: `文件路径已复制到剪贴板` });
  };

  const handleConfirmDelete = async () => {
    if (!modelToDelete) return;
    try {
      await onDeleteModel(modelToDelete.filename);
      addToast?.({ type: 'success', title: '已删除', message: `模型文件 ${modelToDelete.filename} 已成功删除` });
      setModelToDelete(null);
    } catch (e) {
      addToast?.({ type: 'error', title: '删除失败', message: e.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 顶部统计与操作栏 */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HardDrive size={22} style={{ color: 'var(--c-llama-sky)' }} />
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>本地 GGUF 模型库</h2>
              <span className="badge badge-primary">{models.length} 个模型</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              存储目录: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{config?.modelsPath}</span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => onOpenFolder(config.modelsPath)}
              className="btn btn-secondary"
            >
              <FolderOpen size={16} />
              打开模型文件夹
            </button>
            <button
              onClick={onRefreshModels}
              className="btn btn-secondary"
              title="刷新模型列表"
            >
              <RefreshCw size={16} />
              刷新
            </button>
            <button
              onClick={onNavigateToDownload}
              className="btn btn-primary"
            >
              <Plus size={16} />
              下载新模型
            </button>
          </div>
        </div>

        {/* 搜索与分类过滤 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* 搜索框 */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="搜索本地模型名称 / 量化等级..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-text"
              style={{ padding: '8px 12px 8px 34px', fontSize: '13px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} />
          </div>

          {/* 家族分类 Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {families.map((fam) => (
              <button
                key={fam}
                onClick={() => setFamilyFilter(fam)}
                className={`btn ${familyFilter === fam ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '999px' }}
              >
                {fam === 'ALL' ? '全部架构' : fam}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 模型卡片列表网格 */}
      {filteredModels.length === 0 ? (
        <div className="glass-panel" style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <HardDrive size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '8px' }}>
            {search || familyFilter !== 'ALL' ? '未找到符合条件的本地模型' : '本地模型库暂无 GGUF 模型'}
          </h3>
          <p style={{ fontSize: '13px', maxWidth: '460px', margin: '0 auto 20px' }}>
            你可以前往「HF 下载与收藏中心」通过 HuggingFace 链接或命令一键下载模型，也可以手动将 .gguf 文件放入模型文件夹中。
          </p>
          <button onClick={onNavigateToDownload} className="btn btn-primary">
            前往 HuggingFace 下载中心
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '16px'
        }}>
          {filteredModels.map((model) => {
            const isActive = activeModelName === model.filename;
            return (
              <div
                key={model.filename}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: isActive ? 'rgba(14, 165, 233, 0.1)' : 'var(--bg-card)',
                  borderColor: isActive ? 'var(--c-llama-sky)' : 'var(--border-color)',
                  boxShadow: isActive ? 'var(--border-glow)' : 'none'
                }}
              >
                <div>
                  {/* 卡片头部标签 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="badge badge-primary">{model.family}</span>
                      {model.params && <span className="badge badge-neutral">{model.params}</span>}
                      <span className="badge badge-emerald">{model.quant}</span>
                    </div>

                    {isActive && (
                      <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="status-dot-green" style={{ width: '6px', height: '6px' }} />
                        运行中
                      </span>
                    )}
                  </div>

                  {/* 模型文件名 */}
                  <h4 style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    lineHeight: '1.4',
                    wordBreak: 'break-all',
                    marginBottom: '10px'
                  }}>
                    {model.filename}
                  </h4>

                  {/* 元数据指标 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-subtle)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}>
                    <div>
                      文件大小: <strong style={{ color: 'var(--c-llama-sky)' }}>{model.sizeFormatted}</strong>
                    </div>
                    <div>
                      修改日期: <span style={{ color: 'var(--text-muted)' }}>{formatTime(model.modifiedTime)}</span>
                    </div>
                  </div>
                </div>

                {/* 卡片底部操作栏 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleCopyPath(model.fullPath)}
                      className="btn btn-ghost"
                      style={{ padding: '6px', height: '30px' }}
                      title="复制完整路径"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => onOpenFolder(model.fullPath)}
                      className="btn btn-ghost"
                      style={{ padding: '6px', height: '30px' }}
                      title="在文件夹中高亮定位"
                    >
                      <FolderOpen size={14} />
                    </button>
                    <button
                      onClick={() => setModelToDelete(model)}
                      disabled={isActive}
                      className="btn btn-ghost"
                      style={{ padding: '6px', height: '30px', color: 'var(--c-rose)' }}
                      title="删除模型文件"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => onStartModel(model.filename)}
                    className={`btn ${isActive ? 'btn-secondary' : 'btn-success'}`}
                    style={{ padding: '6px 14px', fontSize: '13px' }}
                  >
                    <Play size={14} />
                    {isActive ? '重启该模型' : '一键载入并启动'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 删除确认模态框 */}
      {modelToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', animation: 'scaleUp 0.2s ease-out', background: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--c-rose)', marginBottom: '12px' }}>
              确认删除模型文件？
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '16px' }}>
              即将从磁盘中永久删除模型：<br />
              <strong style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{modelToDelete.filename}</strong>
              <br />
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>体积: {modelToDelete.sizeFormatted}</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setModelToDelete(null)} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleConfirmDelete} className="btn btn-danger">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
