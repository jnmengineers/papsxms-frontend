import React from 'react';

function Unauthorized() {
    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.icon}>🚫</div>
                <h2 style={styles.title}>Access Denied</h2>
                <p style={styles.message}>
                    You do not have permission to access this page.
                </p>
                <button
                    onClick={() => window.location.href = '/dashboard'}
                    style={styles.btn}>
                    ← Go to Dashboard
                </button>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f0f2f5'
    },
    card: {
        backgroundColor: 'white',
        padding: '50px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '400px'
    },
    icon: { fontSize: '64px', marginBottom: '20px' },
    title: { color: '#dc3545', marginBottom: '15px' },
    message: { color: '#666', marginBottom: '30px' },
    btn: {
        backgroundColor: '#1F3864',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '14px'
    }
};

export default Unauthorized;