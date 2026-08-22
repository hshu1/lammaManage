import React, { useState, useEffect } from 'react';
import { 
  X, 
  Folder, 
  FolderOpen, 
  FileText, 
  HardDrive, 
  ArrowUp, 
  Check, 
  Sparkles, 
  Terminal, 
  ExternalLink,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { api } from '../api/client.js';

export default function FileBrowserModal({
  isOpen,
  onClose,
  onSelect,
  initialPath = '',
  mode = 'folder', // 'folder' | 'file'
  title = '选择路径',
  filterExt = '', // e.g. '.exe'
  addToast
}) {
  if (!isOpen) return null;

  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [parentPath, setParentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const loadDirectory = async (targetPath) => {
    setLoading(true);
    try {
      const res = await api.browsePath(targetPath);
      if (res.success) {
        setCurrentPath(res.currentPath);
        setParentPath(res.parentPath || '');
        setItems(res.items || []);
        setSelectedItem(null);
      } else {
        addToast?.({ type: 'warning', title: '无法打开目录', message: res.error || '路径不存在或无权限访问' });
      }
    } catch (e) {
      addToast?.({ type: 'error', title: '浏览错误', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory(initialPath);
    }
  }, [isOpen, initialPath]);

  // 打开 Windows 原生系统文件/文件夹选择框
  const handleOpenNativeDialog = async () => {
    try {
      let res;
      if (mode === 'file') {
        res = await api.selectFile({
          title: title || '选择文件',
          filter: filterExt === '.exe' ? '可执行文件 (*.exe)|*.exe|所有文件 (*.*)|*.*' : '所有文件 (*.*)|*.*',
          initialPath: currentPath || initialPath || ''
        });
      } else {
        res = await api.selectFolder({
          title: title || '选择文件夹',
          initialPath: currentPath || initialPath || ''
        });
      }

      if (res.success && res.path) {
        onSelect(res.path);
        addToast?.({ type: 'success', title: '已选择路径', message: res.path });
        onClose();
      }
    } catch (e) {
      addToast?.({ type: 'error', title: '系统弹窗失败', message: e.message });
    }
  };

  const handleConfirm = () => {
    if (mode === 'folder') {
      if (selectedItem && selectedItem.isDir) {
        onSelect(selectedItem.path);
      } else if (currentPath) {
        onSelect(currentPath);
      }
      onClose();
    } else {
      if (selectedItem && !selectedItem.isDir) {
        onSelect(selectedItem.path);
        onClose();
      } else {
        addToast?.({ type: 'warning', title: '请选择文件', message: '请在列表中点击选定一个文件' });
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div className="glass-panel" style={{
        width: '680px',
        maxWidth: '94vw',
        height: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        animation: 'scaleUp 0.2s ease-out',
        background: 'rgba(15, 23, 42, 0.98)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
      }}>
        {/* 头部标题与原生系统弹窗触发 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={20} style={{ color: '#38bdf8' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 800 }}>{title}</h3>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              {mode === 'file' ? '文件选择模式' : '文件夹选择模式'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleOpenNativeDialog}
              className="btn btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                background: 'rgba(56, 189, 248, 0.08)'
              }}
              title="打开 Windows 系统的文件资源管理器弹窗进行选择"
            >
              <ExternalLink size={13} />
              调用系统窗口
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 路径栏与上级导航 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          background: 'rgba(0,0,0,0.3)',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => loadDirectory(parentPath)}
            disabled={!parentPath || loading}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: '12px', color: parentPath ? '#38bdf8' : 'var(--text-dim)' }}
            title="返回上一级目录"
          >
            <ArrowUp size={14} />
            上一级
          </button>

          <button
            onClick={() => loadDirectory('__DOCUMENTS__')}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: '12px', color: '#38bdf8' }}
            title="快速定位到系统我的文档目录"
          >
            <Folder size={13} />
            我的文档
          </button>

          <button
            onClick={() => loadDirectory('')}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--text-muted)' }}
            title="查看所有盘符"
          >
            <HardDrive size={13} />
            磁盘列表
          </button>

          <div style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            color: '#cbd5e1'
          }}>
            {currentPath || '磁盘盘符列表'}
          </div>

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="btn btn-ghost"
            style={{ padding: '4px' }}
            title="刷新当前目录"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* 目录项列表区域 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          borderRadius: '8px',
          background: 'rgba(5, 8, 15, 0.6)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '6px'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#38bdf8' }} />
              正在读取文件列表...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              当前目录下无内容或无访问权限
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {items.map((item, idx) => {
                const isSelected = selectedItem?.path === item.path;
                const isMatchFilter = !filterExt || item.isDir || item.name.toLowerCase().endsWith(filterExt.toLowerCase());

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (item.isDir) {
                        setSelectedItem(item);
                      } else if (mode === 'file') {
                        setSelectedItem(item);
                      }
                    }}
                    onDoubleClick={() => {
                      if (item.isDir) {
                        loadDirectory(item.path);
                      } else if (mode === 'file') {
                        onSelect(item.path);
                        onClose();
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected 
                        ? 'rgba(56, 189, 248, 0.15)' 
                        : 'transparent',
                      border: isSelected 
                        ? '1px solid rgba(56, 189, 248, 0.4)' 
                        : '1px solid transparent',
                      opacity: isMatchFilter ? 1 : 0.4,
                      transition: 'all 0.15s ease'
                    }}
                    className="dir-item-hover"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      {item.isDrive ? (
                        <HardDrive size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
                      ) : item.isDir ? (
                        <Folder size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      ) : item.isExe ? (
                        <Terminal size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
                      ) : (
                        <FileText size={16} style={{ color: '#a855f7', flexShrink: 0 }} />
                      )}

                      <span style={{
                        fontSize: '13px',
                        color: isSelected ? '#f8fafc' : '#cbd5e1',
                        fontWeight: isSelected || item.isDir ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.name}
                      </span>
                    </div>

                    {item.isDir && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadDirectory(item.path);
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '2px 6px', fontSize: '11px', color: '#38bdf8' }}
                      >
                        进入 <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部确认栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' }}>
            已选: <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {selectedItem?.path || (mode === 'folder' ? currentPath : '尚未选定文件')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="btn btn-secondary">
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={mode === 'file' && !selectedItem}
              className="btn btn-primary"
              style={{ padding: '8px 20px' }}
            >
              <Check size={15} />
              {mode === 'folder' ? '选择当前目录' : '确认选择该文件'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
