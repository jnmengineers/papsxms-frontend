import React, { useEffect } from 'react';

function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3500);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = {
        success: { bg: '#d4edda', border: '#c3e6cb', color: '#155724', icon: '✅' },
        error: { bg: '#f8d7da', border: '#f5c6cb', color: '#721c24', icon: '❌' },
        info: { bg: '#d1ecf1', border: '#bee5eb', color: '#0c5460', icon: 'ℹ️' },
        warning: { bg: '#fff3cd', border: '#ffeeba', color: '#856404', icon: '⚠️' }
    };

    const c = colors[type] || colors.success;

    return (
        <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            backgroundColor: c.bg, border: `1px solid ${c.border}`,
            color: c.color, padding: '14px 20px', borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '10px',
            minWidth: '280px', maxWidth: '400px',
            animation: 'slideIn 0.3s ease'
        }}>
            <span style={{ fontSize: '18px' }}>{c.icon}</span>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 'bold' }}>{message}</span>
            <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: c.color, fontSize: '16px', fontWeight: 'bold', padding: '0 4px'
            }}>×</button>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

export default Toast;
