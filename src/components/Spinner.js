import React from 'react';

function Spinner({ message = 'Loading...', size = 'medium' }) {
    const sizes = {
        small: { spinner: 24, font: 12 },
        medium: { spinner: 40, font: 14 },
        large: { spinner: 60, font: 16 }
    };
    const s = sizes[size] || sizes.medium;

    return (
        <div style={styles.wrapper}>
            <div style={{
                width: s.spinner, height: s.spinner,
                border: `4px solid #f0f2f5`,
                borderTop: `4px solid #1F3864`,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
            }} />
            {message && <p style={{ color: '#666', fontSize: s.font, margin: '10px 0 0 0' }}>{message}</p>}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

const styles = {
    wrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }
};

export default Spinner;
