/**
 * The school's details for pages and printouts — from School Settings (database),
 * loaded after login by SchoolSettingsProvider. Nothing about the school is written in code.
 *
 *   schoolName(), schoolShortName(), schoolMotto(), schoolContact()
 *   logoLeftUrl(), logoRightUrl()        uploaded logos, or the built-in logo images
 *   letterheadHtml()                     logos + name + motto + contact, for printout windows
 *   paymentHtml()                        bank / Paybill details, for fee documents
 *
 * The login page (before anyone is logged in) uses the public name/motto, which is also
 * remembered here so the loading screen can show it next time.
 */
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

const CACHE_KEY = 'schoolPublic';
let profile = null;

const cached = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } };

export function setSchoolProfile(p) {
    profile = p || null;
    if (p) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ name: p.name, shortName: p.shortName, motto: p.motto })); } catch (e) { /* storage full or blocked */ }
    }
}

/** Remember the public details fetched by the login page. */
export function rememberPublicInfo(p) {
    if (!p) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ name: p.name, shortName: p.shortName, motto: p.motto })); } catch (e) { /* ignore */ }
}

export const school = () => profile || cached() || {};
export const schoolName = () => school().name || '';
export const schoolShortName = () => school().shortName || school().name || '';
export const schoolMotto = () => school().motto || '';
export const schoolContact = () => {
    const s = school();
    return [s.postalAddress, s.phones ? `Tel: ${s.phones}` : '', s.email].filter(Boolean).join(' | ');
};

// Printout windows need full addresses for images; uploaded logos are already complete data URLs
const absolute = (src) => { try { return new URL(src, window.location.origin).href; } catch (e) { return src; } };
export const logoLeftUrl = () => school().logoLeft || absolute(logo1);
export const logoRightUrl = () => school().logoRight || absolute(logo2);

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Logos + school name + motto + contact line, as HTML for printout windows. */
export function letterheadHtml({ logoSize = 55 } = {}) {
    const img = (src) => `<img src="${esc(src)}" alt="" onerror="this.style.visibility='hidden'" style="width:${logoSize}px;height:${logoSize}px;object-fit:contain;">`;
    const contact = schoolContact();
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        ${img(logoLeftUrl())}
        <div style="text-align:center;flex:1;">
            <div style="color:#1F3864;font-size:14px;font-weight:bold;text-transform:uppercase;">${esc(schoolName())}</div>
            ${schoolMotto() ? `<div style="color:#2E75B6;font-style:italic;font-size:11px;margin:2px 0;">${esc(schoolMotto())}</div>` : ''}
            ${contact ? `<div style="font-size:10px;color:#555;">${esc(contact)}</div>` : ''}
        </div>
        ${img(logoRightUrl())}
    </div>`;
}

/** How to pay fees (bank, M-Pesa Paybill, note), as HTML. Empty if nothing is set in Settings. */
export function paymentHtml() {
    const s = school();
    const rows = [];
    if (s.bankName || s.bankAccountNumber) {
        rows.push(['Bank', [s.bankName, s.bankBranch ? `${s.bankBranch} branch` : ''].filter(Boolean).join(', ')
            + (s.bankAccountName ? ` — Account name: ${s.bankAccountName}` : '')
            + (s.bankAccountNumber ? ` — Account no: ${s.bankAccountNumber}` : '')]);
    }
    if (s.paybillNumber) rows.push(['M-Pesa Paybill', `${s.paybillNumber}${s.paybillAccountHint ? ` — Account: ${s.paybillAccountHint}` : ''}`]);
    if (!rows.length && !s.paymentNote) return '';
    return `<div style="margin-top:14px;border:1px solid #bbb;border-radius:6px;padding:8px 10px;font-size:11px;">
        <div style="font-weight:bold;color:#1F3864;margin-bottom:4px;">HOW TO PAY</div>
        ${rows.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}
        ${s.paymentNote ? `<div style="color:#b02a37;font-weight:bold;margin-top:4px;">${esc(s.paymentNote)}</div>` : ''}
    </div>`;
}
