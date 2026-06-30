import { useEffect, useRef, useState } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // check every 5 minutes

async function fetchManifestHash() {
    try {
        // Add a timestamp param to bypass any remaining cache
        const res = await fetch(`/asset-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const text = await res.text();
        return text;
    } catch {
        return null;
    }
}

export default function UpdateChecker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const baseline = useRef(null);

    useEffect(() => {
        // Record what was loaded at startup
        fetchManifestHash().then(hash => { baseline.current = hash; });

        const interval = setInterval(async () => {
            const latest = await fetchManifestHash();
            if (latest && baseline.current && latest !== baseline.current) {
                setUpdateAvailable(true);
                clearInterval(interval);
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    if (!updateAvailable) return null;

    return (
        <div style={styles.banner}>
            <span style={styles.text}>🔄 A new version is available.</span>
            <button style={styles.btn} onClick={() => window.location.reload(true)}>
                Refresh Now
            </button>
            <button style={styles.dismiss} onClick={() => setUpdateAvailable(false)}>✕</button>
        </div>
    );
}

const styles = {
    banner: {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1F3864',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 99999,
        whiteSpace: 'nowrap',
        maxWidth: '90vw',
    },
    text: {
        fontSize: '14px',
        fontWeight: 'bold',
    },
    btn: {
        backgroundColor: '#FFD700',
        color: '#1F3864',
        border: 'none',
        padding: '7px 16px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px',
        cursor: 'pointer',
    },
    dismiss: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '0 4px',
    },
};
