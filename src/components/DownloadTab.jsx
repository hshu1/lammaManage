import React, { useState } from 'react';
import { 
  DownloadCloud, 
  Bookmark, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X, 
  Zap, 
  Copy, 
  ExternalLink,
  Sparkles,
  ArrowRight,
  Filter,
  RotateCcw
} from 'lucide-react';
import { parseHfCommand } from '../utils/hfParser.js';
import { formatDuration } from '../utils/formatters.js';

export default function DownloadModal({
  isOpen,
  onClose,
  config,
  models = [],
  bookmarks = [],
  downloadJobs = [],
  onStartDownload,
  onCancelDownload,
  onSaveBookmark,
  onDeleteBookmark,
  onResetBookmarks,
  onStartModel,
  addToast
}) {
  const [inputStr, setInputStr] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, DOWNLOADED, PENDING
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [selectedMirror, setSelectedMirror] = useState(config?.hfMirror || 'https://hf-mirror.com');

  // 即时解析结果
  const parsed = parseHfCommand(inputStr);

  // 本地已下载文件名集合，用于判断收藏的模型是否已就绪
  const localFilenames = new Set(models.map(m => m.filename.toLowerCase()));

  const handleQuickAdd = async (autoDownload = false) => {
    if (!parsed) {
      addToast?.({ type: 'warning', title: '解析失败', message: '请检查输入的 HuggingFace 链接或命令格式' });
      return;
    }

    try {
      const bookmarkData = {
        name: customName.trim() || parsed.suggestedName,
        repoId: parsed.repoId,
        filename: parsed.filename,
        sourceUrl: inputStr.trim(),
        description: customDesc.trim() || '从 HuggingFace 导入的模型',
        tags: ['GGUF', parsed.repoId.split('/')[0]],
        size: '未知'
      };

      await onSaveBookmark(bookmarkData);
      addToast?.({ type: 'success', title: '收藏成功', message: `模型 ${bookmarkData.name} 已添加至收藏夹` });

      if (autoDownload) {
        onStartDownload({
          repoId: parsed.repoId,
          filename: parsed.filename,
          endpoint: selectedMirror
        });
      }

      setInputStr('');
      setCustomName('');
      setCustomDesc('');
    } catch (e) {
      addToast?.({ type: 'error', title: '操作失败', message: e.message });
    }
  };

  const handleDownloadBookmark = (bm) => {
    onStartDownload({
      repoId: bm.repoId,
      filename: bm.filename,
      endpoint: selectedMirror
    });
  };

  const handleCopyCommand = (bm) => {
    const cmd = `hf download hf://${bm.repoId}/${bm.filename}`;
    navigator.clipboard.writeText(cmd);
    addToast?.({ type: 'success', title: '已复制命令', message: cmd });
  };

  const handleResetDefaultBookmarks = async () => {
    if (!window.confirm('确定要将收藏夹重置为出厂默认的推荐模型列表 (JSON 模板) 吗？')) {
      return;
    }
    try {
      if (onResetBookmarks) {
        await onResetBookmarks();
      }
    } catch (e) {
      addToast?.({ type: 'error', title: '重置失败', message: e.message });
    }
  };

  // 过滤收藏夹
  const filteredBookmarks = bookmarks.filter((bm) => {
    const isDownloaded = localFilenames.has(bm.filename.toLowerCase());
    if (filterType === 'DOWNLOADED') return isDownloaded;
    if (filterType === 'PENDING') return !isDownloaded;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '40px'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '800px', maxHeight: '100%', overflowY: 'auto',
        position: 'relative', padding: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>☁️ HF 模型下载中心</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <DownloadCloud size={24} style={{ color: '#38bdf8' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>HuggingFace 模型解析、收藏与下载中心</h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
          支持直接粘贴类似 <code style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>hf download hf://empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf</code> 或网页 URL、repo/filename。
        </p>

        {/* 智能大输入框 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              rows={2}
              value={inputStr}
              onChange={(e) => setInputStr(e.target.value)}
              placeholder="请输入 HF 链接或下载命令，例如: hf download hf://empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf"
              className="input-text"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13.5px',
                padding: '12px 16px',
                lineHeight: '1.5'
              }}
            />
          </div>

          {/* 解析成功即时预览卡片 */}
          {parsed && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Sparkles size={16} style={{ color: '#38bdf8' }} />
                  <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc' }}>
                    已成功解析 HuggingFace 资源:
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span>仓库: <strong style={{ color: '#38bdf8' }}>{parsed.repoId}</strong></span>
                  <span>文件: <strong style={{ color: '#a855f7' }}>{parsed.filename}</strong></span>
                </div>
              </div>

              {/* 镜像选择与下载按钮 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={selectedMirror}
                  onChange={(e) => setSelectedMirror(e.target.value)}
                  className="input-select"
                  style={{ width: '180px', padding: '6px 10px', fontSize: '12px' }}
                >
                  <option value="https://hf-mirror.com">hf-mirror.com (国内极速)</option>
                  <option value="https://huggingface.co">huggingface.co (官方原站)</option>
                </select>

                <button
                  onClick={() => handleQuickAdd(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '13px' }}
                >
                  <Bookmark size={15} />
                  仅收藏
                </button>

                <button
                  onClick={() => handleQuickAdd(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '13px' }}
                >
                  <DownloadCloud size={16} />
                  收藏并立即下载
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 活跃下载任务进度列表 */}
      {downloadJobs.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Zap size={20} style={{ color: '#fbbf24' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>实时下载任务 ({downloadJobs.length})</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {downloadJobs.map((job) => {
              const isDownloading = job.status === 'downloading';
              const isCompleted = job.status === 'completed';
              const isFailed = job.status === 'failed';
              const isCancelled = job.status === 'cancelled';

              return (
                <div
                  key={job.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(10, 15, 29, 0.8)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {/* 任务头部 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>
                          {job.filename}
                        </span>
                        {isDownloading && <span className="badge badge-amber">下载中</span>}
                        {isCompleted && <span className="badge badge-emerald">下载完成</span>}
                        {isFailed && <span className="badge badge-rose">下载失败</span>}
                        {isCancelled && <span className="badge badge-neutral">已取消</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        来源: {job.repoId} · 镜像: {job.endpoint}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isDownloading && (
                        <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          <span>速度: <strong style={{ color: '#38bdf8' }}>{job.speed || '0 B/s'}</strong></span>
                          {job.etaSeconds > 0 && <span>剩余: <strong style={{ color: '#a855f7' }}>{formatDuration(job.etaSeconds)}</strong></span>}
                        </div>
                      )}

                      {isDownloading && (
                        <button
                          onClick={() => onCancelDownload(job.id)}
                          className="btn btn-ghost"
                          style={{ color: '#fb7185', padding: '4px 8px', fontSize: '12px' }}
                        >
                          <X size={14} />
                          取消
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          onClick={() => onStartModel(job.filename)}
                          className="btn btn-success"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                          <Play size={13} />
                          立即启动服务
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 进度条 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      flex: 1,
                      height: '8px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${job.percent || (isCompleted ? 100 : 0)}%`,
                        height: '100%',
                        borderRadius: '4px',
                        background: isCompleted ? '#10b981' : isFailed ? '#f43f5e' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', minWidth: '45px', textAlign: 'right' }}>
                      {job.percent ? `${job.percent}%` : isCompleted ? '100%' : '0%'}
                    </span>
                  </div>

                  {/* 底部字节大小与错误提示 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                    <span>已下载: {job.downloadedFormatted} / {job.totalFormatted}</span>
                    {job.error && <span style={{ color: '#fb7185' }}>错误: {job.error}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 收藏夹模型列表 */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bookmark size={20} style={{ color: '#a855f7' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>模型收藏夹</h3>
              <span className="badge badge-purple">{bookmarks.length}</span>
            </div>

            {/* 恢复出厂默认推荐按钮 */}
            <button
              type="button"
              onClick={handleResetDefaultBookmarks}
              className="btn btn-ghost"
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                color: '#c084fc',
                borderColor: 'rgba(192, 132, 252, 0.3)',
                background: 'rgba(192, 132, 252, 0.08)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="一键将收藏夹重置为出厂默认的推荐模型列表 (bookmarks.default.json)"
            >
              <RotateCcw size={13} />
              恢复默认推荐
            </button>
          </div>

          {/* 状态过滤器 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setFilterType('ALL')}
              className={`btn ${filterType === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '999px' }}
            >
              全部 ({bookmarks.length})
            </button>
            <button
              onClick={() => setFilterType('DOWNLOADED')}
              className={`btn ${filterType === 'DOWNLOADED' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '999px' }}
            >
              已下载 ✅
            </button>
            <button
              onClick={() => setFilterType('PENDING')}
              className={`btn ${filterType === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '999px' }}
            >
              未下载 ⬇️
            </button>
          </div>
        </div>

        {/* 收藏列表网格 */}
        {filteredBookmarks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Bookmark size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px' }}>当前筛选下暂无收藏的模型</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px'
          }}>
            {filteredBookmarks.map((bm) => {
              const isDownloaded = localFilenames.has(bm.filename.toLowerCase());
              return (
                <div
                  key={bm.id}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'var(--bg-card)'
                  }}
                >
                  <div>
                    {/* 头部状态指示 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(bm.tags || []).map((t, idx) => (
                          <span key={idx} className="badge badge-neutral" style={{ fontSize: '10px' }}>{t}</span>
                        ))}
                        {bm.size && bm.size !== '未知' ? (
                          <span className="badge badge-primary" style={{ fontSize: '10px' }}>{bm.size}</span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>未知大小</span>
                        )}
                      </div>

                      {isDownloaded ? (
                        <span className="badge badge-emerald">已在本地就绪</span>
                      ) : (
                        <span className="badge badge-amber">未下载</span>
                      )}
                    </div>

                    {/* 模型标题与描述 */}
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                      {bm.name}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px', lineHeight: '1.4' }}>
                      {bm.description || '无详细描述'}
                    </p>

                    {/* 仓库与文件 */}
                    <div style={{
                      fontSize: '11.5px',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      color: 'var(--text-muted)',
                      marginBottom: '14px',
                      wordBreak: 'break-all'
                    }}>
                      <div>Repo: <span style={{ color: '#38bdf8' }}>{bm.repoId}</span></div>
                      <div>File: <span style={{ color: '#a855f7' }}>{bm.filename}</span></div>
                      <div style={{ marginTop: '3px' }}>
                        Size: <span style={{ color: (!bm.size || bm.size === '未知') ? 'var(--text-dim)' : '#34d399' }}>{bm.size || '未知'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 底部动作 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleCopyCommand(bm)}
                        className="btn btn-ghost"
                        style={{ padding: '6px', height: '28px' }}
                        title="复制 hf download 指令"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="btn btn-ghost"
                        style={{ padding: '6px', height: '28px', color: '#fb7185' }}
                        title="移除收藏"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {isDownloaded ? (
                      <button
                        onClick={() => onStartModel(bm.filename)}
                        className="btn btn-success"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                      >
                        <Play size={13} />
                        启动服务
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadBookmark(bm)}
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                      >
                        <DownloadCloud size={13} />
                        一键下载
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
