import React, { useState, useEffect } from 'react';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

function LoadingScreen({ message = 'Loading...' }) {
    const [dots, setDots] = useState('');
    const [tip, setTip] = useState(0);

    const tips = [
        '☕ Waking up the server — this takes up to 60 seconds on first load...',
        '📚 Pipeline Adventist School Exam Management System',
        '🔐 Securing your connection...',
        '🌐 Connecting to the cloud database...',
        '⏳ Almost there — thank you for your patience!'
    ];

    useEffect(() => {
        const dotsInterval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);

        const tipInterval = setInterval(() => {
            setTip(prev => (prev + 1) % tips.length);
        }, 3000);

        return () => { clearInterval(dotsInterval); clearInterval(tipInterval); };
    }, []);

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logoRow}>
                    <img src={logo1} alt="Logo 1" style={styles.logo} />
                    <img src={logo2} alt="Logo 2" style={styles.logo} />
                </div>
                <h2 style={styles.schoolName}>PIPELINE ADVENTIST SCHOOL</h2>
                <p style={styles.subtitle}>Exam Management System</p>

                <div style={styles.spinnerWrapper}>
                    <div style={styles.spinner} />
                </div>

                <p style={styles.message}>{message}{dots}</p>

                <div style={styles.tipBox}>
                    <p style={styles.tip}>{tips[tip]}</p>
                </div>

                <div style={styles.progressOuter}>
                    <div style={styles.progressInner} />
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes progress {
                    0% { width: 0%; }
                    20% { width: 30%; }
                    50% { width: 60%; }
                    80% { width: 80%; }
                    95% { width: 90%; }
                    100% { width: 95%; }
                }
                @keyframes fadein {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px'
    },
    card: {
        backgroundColor: 'white', padding: '48px 40px', borderRadius: '18px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)', width: '100%', maxWidth: '440px',
        textAlign: 'center'
    },
    logoRow: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '16px' },
    logo: { width: '65px', height: '65px', objectFit: 'contain' },
    schoolName: { color: '#1F3864', fontSize: '16px', margin: '0 0 5px 0', fontWeight: 700, letterSpacing: '0.3px' },
    subtitle: { color: '#2E75B6', fontSize: '13px', margin: '0 0 32px 0' },
    spinnerWrapper: { display: 'flex', justifyContent: 'center', marginBottom: '22px' },
    spinner: {
        width: '50px', height: '50px',
        border: '4px solid #e3f2fd',
        borderTop: '4px solid #1F3864',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    message: { color: '#1F3864', fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', minHeight: '22px' },
    tipBox: {
        backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '13px 16px',
        marginBottom: '22px', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadein 0.5s ease'
    },
    tip: { color: '#666', fontSize: '13px', margin: 0, lineHeight: '1.5' },
    progressOuter: { height: '5px', backgroundColor: '#e3f2fd', borderRadius: '3px', overflow: 'hidden' },
    progressInner: {
        height: '100%', backgroundColor: '#1F3864', borderRadius: '3px',
        animation: 'progress 60s ease-out forwards'
    }
};

export default LoadingScreen;