import axios from 'axios';

// ✅ Use live Render backend in production, localhost in development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to every request automatically
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW: when the server says the login is no longer valid (401), go back to the
// login page with a clear message instead of leaving a broken page.
// ─────────────────────────────────────────────────────────────────────────────

// Screen preferences that survive logging out (same as the Navbar logout)
const KEEP_ON_LOGOUT = ['sidebarCollapsed', 'sidebarOpenGroups'];
let redirecting = false;

/** Clears the login and returns to the login page, which shows `message`. */
const endSession = (message) => {
    if (redirecting) return;            // several requests can fail at once — redirect only once
    redirecting = true;
    const kept = {};
    KEEP_ON_LOGOUT.forEach((k) => { const v = localStorage.getItem(k); if (v !== null) kept[k] = v; });
    localStorage.clear();
    Object.entries(kept).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.setItem('loginNotice', message);
    window.location.replace('/');       // replace: Back can't return to the logged-out page
};

// 401 from the server = not logged in any more (expired, deleted or disabled account).
// 403 is NOT handled here: that means "logged in, but not allowed" and each page shows its message.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const url = error.config?.url || '';
        const onLoginPage = window.location.pathname === '/';
        if (status === 401 && !url.includes('/api/auth/login') && !onLoginPage && localStorage.getItem('token')) {
            const d = error.response?.data;
            endSession((d && typeof d === 'object' && d.message) || 'Your session has expired. Please log in again.');
        }
        return Promise.reject(error);
    }
);

export default api;
