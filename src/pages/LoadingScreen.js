import React, { useState, useEffect } from 'react';
import { schoolShortName, logoLeftUrl, logoRightUrl } from '../utils/school';

// Defined once, outside the component
const TIPS = [
    { icon: 'cup-hot-fill', text: 'Waking up the server — this can take up to a minute on first load' },
    { icon: 'journals', text: 'Exam Management System' },
    { icon: 'shield-lock-fill', text: 'Securing your connection' },
    { icon: 'cloud-fill', text: 'Connecting to the cloud database' },
    { icon: 'hourglass-split', text: 'Almost there — thank you for your patience!' }
];

/**
 * Full-screen loading card.
 * Props:
 *   message  – main line, e.g. "Connecting to server"
 *   onCancel – optional; shows a Cancel button after 15 seconds
 */
function LoadingScreen({ message = 'Loading', onCancel }) {
    const [dots, setDots] = useState(0);
    const [tip, setTip] = useState(0);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const dotsInterval = setInterval(() => setDots(d => (d + 1) % 4), 500);
        const tipInterval = setInterval(() => setTip(t => (t + 1) % TIPS.length), 4000);
        const clock = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => { clearInterval(dotsInterval); clearInterval(tipInterval); clearInterval(clock); };
    }, []);

    const current = TIPS[tip];

    return (
        <div style={styles.container}>
            <div style={styles.card} role="status" aria-live="polite" aria-busy="true">
                <div style={styles.logoRow}>
                    <img src={logoLeftUrl()} alt="" style={styles.logo} />
                    <img src={logoRightUrl()} alt="" style={styles.logo} />
                </div>
                {schoolShortName() && <h2 style={styles.schoolName}>{schoolShortName().toUpperCase()}</h2>}
                <p style={styles.subtitle}>Exam Management System</p>

                <div style={styles.spinnerWrapper}>
                    <div className="ls-spinner" style={styles.spinner} />
                </div>

                <p style={styles.message}>
                    {message}
                    {/* Fixed-width dots so the text doesn't wobble left and right */}
                    <span style={styles.dots} aria-hidden="true">{'.'.repeat(dots)}</span>
                </p>

                {/* key={tip} re-runs the fade-in each time the tip changes */}
                <div key={tip} className="ls-fade" style={styles.tipBox}>
                    <i className={`bi bi-${current.icon}`} aria-hidden="true" style={styles.tipIcon} />
                    <p style={styles.tip}>{current.text}</p>
                </div>

                <div style={styles.progressOuter}>
                    <div className="ls-progress" style={styles.progressInner} />
                </div>

                {seconds >= 5 && (
                    <p style={styles.elapsed}>
                        Waiting {seconds}s
                        {seconds >= 45 && ' — still working, the first load of the day is the slowest'}
                    </p>
                )}

                {onCancel && seconds >= 15 && (
                    <button onClick={onCancel} style={styles.cancelBtn}>
                        <i className="bi bi-x-lg" aria-hidden="true" style={{ marginRight: '6px' }} />Cancel
                    </button>
                )}
            </div>

            <style>{`
                @keyframes ls-spin { to { transform: rotate(360deg); } }
                @keyframes ls-progress {
                    0% { width: 0%; } 20% { width: 30%; } 50% { width: 60%; }
                    80% { width: 80%; } 95% { width: 90%; } 100% { width: 95%; }
                }
                @keyframes ls-fadein {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .ls-spinner { animation: ls-spin 1s linear infinite; }
                .ls-progress { animation: ls-progress 60s ease-out forwards; }
                .ls-fade { animation: ls-fadein 0.5s ease; }
                /* Respect users who turn off motion in their device settings */
                @media (prefers-reduced-motion: reduce) {
                    .ls-spinner { animation-duration: 3s; }
                    .ls-fade { animation: none; }
                    .ls-progress { animation: none; width: 50%; }
                }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px', boxSizing: 'border-box'
    },
    card: {
        backgroundColor: 'white', padding: '40px 32px', borderRadius: '18px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)', width: '100%', maxWidth: '440px',
        textAlign: 'center', boxSizing: 'border-box'
    },
    logoRow: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '16px' },
    logo: { width: '65px', height: '65px', objectFit: 'contain' },
    schoolName: { color: '#1F3864', fontSize: '16px', margin: '0 0 5px 0', fontWeight: 700, letterSpacing: '0.3px' },
    subtitle: { color: '#2E75B6', fontSize: '13px', margin: '0 0 28px 0' },
    spinnerWrapper: { display: 'flex', justifyContent: 'center', marginBottom: '22px' },
    spinner: {
        width: '50px', height: '50px',
        border: '4px solid #e3f2fd', borderTop: '4px solid #1F3864', borderRadius: '50%'
    },
    message: { color: '#1F3864', fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', minHeight: '22px' },
    dots: { display: 'inline-block', width: '1.2em', textAlign: 'left' },
    tipBox: {
        backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '13px 16px',
        marginBottom: '22px', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
    },
    tipIcon: { color: '#2E75B6', fontSize: '18px', flexShrink: 0 },
    tip: { color: '#666', fontSize: '13px', margin: 0, lineHeight: '1.5', textAlign: 'left' },
    progressOuter: { height: '5px', backgroundColor: '#e3f2fd', borderRadius: '3px', overflow: 'hidden' },
    progressInner: { height: '100%', backgroundColor: '#1F3864', borderRadius: '3px', width: '0%' },
    elapsed: { color: '#999', fontSize: '12px', margin: '12px 0 0 0' },
    cancelBtn: {
        marginTop: '16px', backgroundColor: 'transparent', color: '#6c757d', border: '1.5px solid #ccc',
        padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
    }
};

export default LoadingScreen;
