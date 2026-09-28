import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/**
 * Bell in the top bar with the number of unread notices. Refreshes every 2 minutes and
 * whenever a notice is read (the Notices page sends a "notices-changed" event).
 */
function NoticeBell() {
    const [unread, setUnread] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        let alive = true;
        const load = () => api.get('/api/announcements/unread-count')
            .then(r => { if (alive) setUnread(Number(r.data?.unread) || 0); })
            .catch(() => { /* the bell is optional — never break the page */ });
        load();
        const timer = setInterval(load, 120000);
        window.addEventListener('notices-changed', load);
        return () => { alive = false; clearInterval(timer); window.removeEventListener('notices-changed', load); };
    }, []);

    return (
        <button type="button" onClick={() => navigate('/announcements')} style={styles.bell}
            aria-label={unread ? `${unread} unread notice${unread === 1 ? '' : 's'}` : 'Notices'} title="Notices">
            <i className={`bi bi-bell${unread ? '-fill' : ''}`} aria-hidden="true" />
            {unread > 0 && <span style={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
        </button>
    );
}

const styles = {
    bell: { position: 'relative', background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', padding: '6px 8px', marginRight: '4px' },
    badge: { position: 'absolute', top: '0px', right: '0px', backgroundColor: '#dc3545', color: 'white', borderRadius: '10px', fontSize: '10px', fontWeight: 700, minWidth: '16px', height: '16px', lineHeight: '16px', padding: '0 4px', textAlign: 'center' },
};

export default NoticeBell;
