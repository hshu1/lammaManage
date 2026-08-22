import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Copy, ArrowDown, Search, Filter, ShieldAlert } from 'lucide-react';

export default function LogViewer({ logs = [], onClear, addToast }) {
  const [filter, setFilter] = useState('all'); // all, stdout, stderr, sys
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.source !== filter) return false;
    if (search && !log.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs.map(l => `[${l.time.substring(11, 19)}] [${l.source}] ${l.content}`).join('\n');
    navigator.clipboard.writeText(text);
    addToast?.({ type: 'success', title: '复制成功', message: `已复制 ${filteredLogs.length} 条日志` });
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '460px' }}>
      {/* 终端控制栏 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--c-llama-sky)', fontWeight: 700, fontSize: '14px' }}>
            <Terminal size={18} />
            <span>实时终端输出</span>
          </div>
          <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
            {logs.length} 行
          </span>
        </div>

        {/* 过滤与搜索 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* 搜索框 */}
          <div style={{ position: 'relative', width: '160px' }}>
            <input
              type="text"
              placeholder="搜索日志..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-text"
              style={{ padding: '4px 8px 4px 28px', fontSize: '12px', height: '28px' }}
            />
            <Search size={12} style={{ position: 'absolute', left: '9px', top: '8px', color: 'var(--text-dim)' }} />
          </div>

          {/* 级别过滤 */}
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '6px', padding: '2px' }}>
            {['all', 'stdout', 'stderr', 'sys'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                style={{
                  background: filter === type ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                  color: filter === type ? 'var(--c-llama-sky)' : 'var(--text-dim)',
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: filter === type ? 600 : 400
                }}
              >
                {type === 'all' ? '全部' : type === 'stdout' ? '标准输出' : type === 'stderr' ? '诊断' : '系统'}
              </button>
            ))}
          </div>

          {/* 自动滚动开关 */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`btn ${autoScroll ? 'btn-secondary' : 'btn-ghost'}`}
            style={{
              padding: '4px 8px',
              height: '28px',
              fontSize: '11px',
              color: autoScroll ? 'var(--c-emerald)' : 'var(--text-dim)',
              borderColor: autoScroll ? 'rgba(16, 185, 129, 0.3)' : 'transparent'
            }}
            title="新日志生成时自动滚动到底部"
          >
            <ArrowDown size={12} />
            自动滚动
          </button>

          {/* 复制 */}
          <button
            onClick={handleCopyLogs}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', height: '28px', fontSize: '11px' }}
            title="复制当前过滤日志"
          >
            <Copy size={12} />
          </button>

          {/* 清屏 */}
          <button
            onClick={onClear}
            className="btn btn-ghost"
            style={{ padding: '4px 8px', height: '28px', fontSize: '11px', color: 'var(--c-rose)' }}
            title="清空日志缓存"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* 终端日志内容区 */}
      <div
        ref={logContainerRef}
        style={{
          flex: 1,
          padding: '12px 16px',
          background: 'var(--terminal-bg)',
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '12.5px',
          lineHeight: '1.6',
          color: '#e2e8f0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          borderBottomLeftRadius: 'var(--radius-lg)',
          borderBottomRightRadius: 'var(--radius-lg)'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '280px',
            color: 'var(--text-dim)',
            gap: '8px'
          }}>
            <Terminal size={32} style={{ opacity: 0.3 }} />
            <span>暂无日志输出，启动服务后即可查看实时运行状态</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = log.time ? log.time.substring(11, 19) : '--:--:--';
            let color = '#cbd5e1';
            let tagBadge = null;

            if (log.source === 'sys') {
              color = 'var(--c-llama-sky)';
              tagBadge = <span style={{ color: 'var(--c-llama-sky)', marginRight: '6px', opacity: 0.8 }}>[SYS]</span>;
            } else if (log.source === 'stderr') {
              if (log.content.includes('error') || log.content.includes('failed') || log.content.includes('CUDA error')) {
                color = 'var(--c-rose)';
              } else if (log.content.includes('warning') || log.content.includes('warn')) {
                color = 'var(--c-amber)';
              } else {
                color = 'var(--c-muted-slate)';
              }
            } else if (log.content.includes('HTTP server is listening') || log.content.includes('✅')) {
              color = 'var(--c-emerald)';
            }

            return (
              <div key={log.id} style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
                <span style={{ color: '#475569', userSelect: 'none', flexShrink: 0 }}>
                  [{timeStr}]
                </span>
                <div style={{ color: color, flex: 1 }}>
                  {tagBadge}
                  {log.content}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
