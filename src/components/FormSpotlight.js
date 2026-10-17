import { useEffect } from 'react';

/**
 * System-wide: when a click (Edit, Add, New…) shows a form that is out of view — typically at the
 * top of a long page — jump straight to it, flash an outline and put the cursor in its first box.
 * Forms inside pop-ups (fixed position) are left alone.
 */
const FORMS = 'form, [data-form]';
const inPopup = (el) => { for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
const offScreen = (el) => { const r = el.getBoundingClientRect(); return r.top < 60 || r.top > window.innerHeight - 120; };

function spotlight(f) {
    if (offScreen(f)) { f.scrollIntoView({ behavior: 'instant', block: 'start' }); window.scrollBy({ top: -80, behavior: 'instant' }); }
    f.animate?.([{ boxShadow: '0 0 0 4px rgba(200,16,46,0.55)' }, { boxShadow: '0 0 0 0 rgba(200,16,46,0)' }], { duration: 1500, easing: 'ease-out' });
    f.querySelector('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])')?.focus({ preventScroll: true });
}

export default function FormSpotlight() {
    useEffect(() => {
        const onClick = (e) => {
            const btn = e.target.closest('button, a, [role="button"]');
            if (!btn || btn.closest(FORMS)) return;                     // clicks inside a form (Save, Cancel…) are ignored
            const before = new Set(document.querySelectorAll(FORMS));
            const label = `${btn.textContent || ''} ${btn.title || ''} ${btn.getAttribute('aria-label') || ''}`;
            setTimeout(() => {
                const visible = [...document.querySelectorAll(FORMS)].filter(f => f.offsetParent !== null && !inPopup(f));
                const fresh = visible.find(f => !before.has(f));
                if (fresh) return spotlight(fresh);
                // "Edit" that fills a form already on the page (often far above)
                if (/edit/i.test(label)) { const f = visible.find(offScreen); if (f) spotlight(f); }
            }, 120);
        };
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, []);
    return null;
}
