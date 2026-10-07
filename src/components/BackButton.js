import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { recordVisit, previousEntry, entryLabel, parentOf, pageLabel } from '../utils/navTrail';

/**
 * Smart Back.
 *   • came from another page in the app → goes back there, and says where ("Back to Students")
 *   • opened directly (bookmark, refresh, link) → goes to the page's natural parent (usually Dashboard)
 * Uses real browser history, so it always agrees with the browser's own Back button (and Alt + ←).
 */
export function useSmartBack() {
    const navigate = useNavigate();
    const location = useLocation();
    const prev = previousEntry();
    if (prev) return { label: entryLabel(prev), go: () => navigate(-1) };
    const parent = parentOf(location.pathname);
    // replace, not push: going "up" shouldn't leave a way to bounce back and forth
    return { label: pageLabel(parent) || 'Dashboard', go: () => navigate(parent, { replace: true }) };
}

/** Records each page visited (used once, in the top bar that every page shows). */
export function useTrailRecorder() {
    const location = useLocation();
    const navType = useNavigationType();
    useEffect(() => { recordVisit(location, navType); }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
}

const HIDDEN_ON = ['/', '/dashboard', '/unauthorized'];

function BackButton() {
    const location = useLocation();
    const back = useSmartBack();
    const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 640px)').matches);
    useEffect(() => {
        const mq = window.matchMedia?.('(max-width: 640px)');
        if (!mq) return undefined;
        const on = (e) => setNarrow(e.matches);
        mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
        return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
    }, []);
    if (HIDDEN_ON.includes(location.pathname)) return null;
    const text = `Back to ${back.label}`;
    return (
        <button type="button" onClick={back.go} style={{ ...styles.pill, padding: narrow ? '6px 10px' : '6px 14px 6px 10px' }}
            title={`${text}  (Alt + ←)`} aria-label={text}>
            <i className="bi bi-arrow-left" aria-hidden="true" style={{ fontSize: '15px' }} />
            {!narrow && <span style={styles.text}>{back.label}</span>}
        </button>
    );
}

const styles = {
    pill: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '14px',
        background: 'rgba(255,255,255,0.14)', color: 'white', border: '1px solid rgba(255,255,255,0.35)',
        borderRadius: '999px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, lineHeight: 1.2,
        maxWidth: '260px', transition: 'background 0.15s',
    },
    text: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

export default BackButton;
