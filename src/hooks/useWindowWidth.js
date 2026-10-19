import { useState, useEffect } from 'react';

/**
 * The window width — updated only when the WIDTH really changes, at most once per frame.
 * (On phones the address bar sliding in/out while scrolling fires "resize" with the same width;
 * re-drawing whole pages for that made scrolling stutter, e.g. on Mark Entry.)
 */
export default function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        let frame = 0;
        const handler = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => { frame = 0; const w = window.innerWidth; setWidth(prev => (prev === w ? prev : w)); });
        };
        window.addEventListener('resize', handler, { passive: true });
        return () => { window.removeEventListener('resize', handler); if (frame) cancelAnimationFrame(frame); };
    }, []);
    return width;
}
