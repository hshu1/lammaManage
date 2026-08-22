import React, { useState } from 'react';
import { X, Sparkles, DownloadCloud, Bookmark, Plus } from 'lucide-react';
import { parseHfCommand } from '../utils/hfParser.js';

export default function QuickAddModal({
  isOpen,
  onClose,
  config,
  onSaveBookmark,
  onStartDownload,
  addToast
}) {
  if (!isOpen) return null;

  const [inputStr, setInputStr] = useState('');
  const [selectedMirror, setSelectedMirror] = useState(config?.hfMirror || 'https://hf-mirror.com');
  const [customName, setCustomName] = useState('');

  const parsed = parseHfCommand(inputStr);

  const handleAction = async (autoDownload = false) => {
    if (!parsed) {
      addToast?.({ type: 'warning', title: '格式错误', message: '请检查输入的 HuggingFace 命令或链接' });
      return;
    }

    try {
      const bookmarkData = {
        name: customName.trim() || parsed.suggestedName,
        repoId: parsed.repoId,
        filename: parsed.filename,
        sourceUrl: inputStr.trim(),
        description: '从快捷弹窗导入的模型',
        tags: ['GGUF', parsed.repoId.split('/')[0]],
        size: '未知'
      };

      await onSaveBookmark(bookmarkData);
      addToast?.({ type: 'success', title: '已收藏', message: `已成功收藏 ${bookmarkData.name}` });

      if (autoDownload) {
        onStartDownload({
          repoId: parsed.repoId,
          filename: parsed.filename,
          endpoint: selectedMirror
        });
      }

      onClose();
    } catch (e) {
      addToast?.({ type: 'error', title: '操作失败', message: e.message });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="glass-panel" style={{
        width: '560px',
        maxWidth: '92vw',
        padding: '24px',
        animation: 'scaleUp 0.2s ease-out',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-panel)'
      }}>
        {/* 弹窗头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} style={{ color: 'var(--c-llama-sky)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>快速解析与导入 HuggingFace 模型</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          粘贴你的 HuggingFace 下载命令或文件链接：
        </p>

        <textarea
          rows={3}
          value={inputStr}
          onChange={(e) => setInputStr(e.target.value)}
          placeholder="例如: hf download hf://empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf"
          className="input-text"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', marginBottom: '14px' }}
        />

        {parsed && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-highlight)',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--c-llama-sky)', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
              <Sparkles size={14} />
              <span>解析成功</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <div>Repo: <strong style={{ color: 'var(--text-main)' }}>{parsed.repoId}</strong></div>
              <div>File: <strong style={{ color: 'var(--c-llama-sky)' }}>{parsed.filename}</strong></div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label className="input-label">自定义模型名称 (选填):</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={parsed?.suggestedName || '模型名称'}
              className="input-text"
            />
          </div>

          <div style={{ width: '180px' }}>
            <label className="input-label">下载镜像源:</label>
            <select
              value={selectedMirror}
              onChange={(e) => setSelectedMirror(e.target.value)}
              className="input-select"
            >
              <option value="https://hf-mirror.com">hf-mirror.com (加速)</option>
              <option value="https://huggingface.co">huggingface.co (官方)</option>
            </select>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
          <button onClick={() => handleAction(false)} disabled={!parsed} className="btn btn-secondary">
            <Bookmark size={15} />
            仅收藏
          </button>
          <button onClick={() => handleAction(true)} disabled={!parsed} className="btn btn-primary">
            <DownloadCloud size={16} />
            收藏并立即下载
          </button>
        </div>
      </div>
    </div>
  );
}
