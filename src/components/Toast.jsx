import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '420px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => {
        let icon = <Info size={18} style={{ color: '#38bdf8' }} />;
        let border = 'rgba(56, 189, 248, 0.3)';
        let bg = 'rgba(15, 23, 42, 0.95)';

        if (toast.type === 'success') {
          icon = <CheckCircle2 size={18} style={{ color: '#10b981' }} />;
          border = 'rgba(16, 185, 129, 0.4)';
        } else if (toast.type === 'error') {
          icon = <AlertCircle size={18} style={{ color: '#f43f5e' }} />;
          border = 'rgba(244, 63, 94, 0.4)';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle size={18} style={{ color: '#f59e0b' }} />;
          border = 'rgba(245, 158, 11, 0.4)';
        }

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: bg,
              border: `1px solid ${border}`,
              backdropFilter: 'blur(12px)',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              color: '#f8fafc',
              fontSize: '14px',
              lineHeight: '1.4',
              animation: 'slideIn 0.2s ease-out'
            }}
          >
            <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>
            <div style={{ flex: 1, wordBreak: 'break-word' }}>
              {toast.title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{toast.title}</div>}
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
