import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes of inactivity
const WARNING_MS = 2 * 60 * 1000;    // show warning 2 minutes before logout

const PUBLIC_PATHS = ['/', '/unauthorized'];

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export default function InactivityTimeout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(WARNING_MS / 1000);
    const logoutTimer = useRef(null);
    const warningTimer = useRef(null);
    const countdownRef = useRef(null);

    const isPublic = PUBLIC_PATHS.includes(location.pathname);

    const logout = useCallback(() => {
        clearTimeout(logoutTimer.current);
        clearTimeout(warningTimer.current);
        clearInterval(countdownRef.current);
        localStorage.clear();
        navigate('/');
    }, [navigate]);

    const resetTimers = useCallback(() => {
        if (isPublic) return;

        setShowWarning(false);
        setSecondsLeft(WARNING_MS / 1000);
        clearTimeout(logoutTimer.current);
        clearTimeout(warningTimer.current);
        clearInterval(countdownRef.current);

        // Show warning when WARNING_MS remains
        warningTimer.current = setTimeout(() => {
            setShowWarning(true);
            setSecondsLeft(WARNING_MS / 1000);

            countdownRef.current = setInterval(() => {
                setSecondsLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, TIMEOUT_MS - WARNING_MS);

        // Auto logout after full timeout
        logoutTimer.current = setTimeout(logout, TIMEOUT_MS);
    }, [isPublic, logout]);

    // Attach / detach activity listeners
    useEffect(() => {
        if (isPublic) {
            clearTimeout(logoutTimer.current);
            clearTimeout(warningTimer.current);
            clearInterval(countdownRef.current);
            setShowWarning(false);
            return;
        }

        resetTimers();
        ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));

        return () => {
            clearTimeout(logoutTimer.current);
            clearTimeout(warningTimer.current);
            clearInterval(countdownRef.current);
            ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimers));
        };
    }, [isPublic, resetTimers]);

    if (!showWarning) return null;

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const timeStr = minutes > 0
        ? `${minutes}:${String(seconds).padStart(2, '0')}`
        : `${seconds}s`;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.iconRow}>⏱️</div>
                <h2 style={styles.title}>Session Expiring Soon</h2>
                <p style={styles.message}>
                    You have been inactive. Your session will automatically end in:
                </p>
                <div style={styles.countdown}>{timeStr}</div>
                <p style={styles.sub}>Move your mouse or press any key to stay logged in.</p>
                <div style={styles.btnRow}>
                    <button style={styles.stayBtn} onClick={resetTimers}>
                        Stay Logged In
                    </button>
                    <button style={styles.logoutBtn} onClick={logout}>
                        Log Out Now
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '36px 32px',
        maxWidth: '420px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    iconRow: {
        fontSize: '48px',
        marginBottom: '12px',
    },
    title: {
        color: '#1F3864',
        margin: '0 0 12px',
        fontSize: '20px',
    },
    message: {
        color: '#444',
        fontSize: '14px',
        marginBottom: '16px',
        lineHeight: '1.5',
    },
    countdown: {
        fontSize: '52px',
        fontWeight: 'bold',
        color: '#c0392b',
        margin: '0 0 12px',
        fontVariantNumeric: 'tabular-nums',
    },
    sub: {
        color: '#777',
        fontSize: '12px',
        marginBottom: '24px',
    },
    btnRow: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
    },
    stayBtn: {
        backgroundColor: '#1F3864',
        color: '#fff',
        border: 'none',
        padding: '11px 24px',
        borderRadius: '7px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
    },
    logoutBtn: {
        backgroundColor: '#fff',
        color: '#c0392b',
        border: '2px solid #c0392b',
        padding: '11px 24px',
        borderRadius: '7px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
    },
};
