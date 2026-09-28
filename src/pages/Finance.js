import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import PriceEditor from '../components/PriceEditor';
import ClassPrintsTab from './FinancePrints';
import FinanceHome from './FinanceHome';
import ExpensesTab from './FinanceExpenses';
import MoneyReportTab from './FinanceReports';
import MoneyGroupsTab from './FinanceSetup';
import { letterheadHtml, paymentHtml } from '../utils/school';
import { SECTION_NAMES_LIVE, gradeRankOf } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

// Payment methods mirror the backend's Payment.Method (a code-level rule, not a setting)
const METHODS = [
    { key: 'MPESA', label: 'M-Pesa', ref: 'M-Pesa code', placeholder: 'e.g. SJK4XY7ZQ1' },
    { key: 'BANK', label: 'Bank deposit', ref: 'Bank slip number', placeholder: 'e.g. 004512' },
    { key: 'CHEQUE', label: 'Cheque', ref: 'Cheque number', placeholder: 'e.g. 000781' },
];
const methodOf = (k) => METHODS.find(m => m.key === k) || { label: k, ref: 'Reference' };

const pad2 = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtDate = (s) => { if (!s) return '-'; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
const money = (n) => (n === null || n === undefined || n === '' ? '-' : Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const kes = (n) => `KES ${money(n)}`;
const isAmount = (s) => /^\d{1,8}(\.\d{1,2})?$/.test(String(s).trim()) && Number(s) > 0;
// Optional amount: empty is fine (means "not set")
const isOptionalAmount = (s) => s === null || s === undefined || String(s).trim() === '' || isAmount(s);
const blankToNull = (s) => (s === null || s === undefined || String(s).trim() === '' ? null : String(s).trim());
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (v) => String(v ?? '').trim().toLowerCase();
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
const isActiveTerm = (y) => !!(y?.isActive ?? y?.active);
// Section names and grade order from School Settings
const sectionLabel = (code) => SECTION_NAMES_LIVE[code] || String(code || '');
const gradeRank = (g) => gradeRankOf(String(g || '').toUpperCase());

const openPrint = (title, bodyHtml, onBlocked) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
        body{font-family:'Times New Roman',serif;font-size:12px;color:#000;padding:15px;max-width:780px;margin:0 auto}
        .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
        .head{text-align:center;border-bottom:3px solid #1F3864;padding-bottom:8px;margin-bottom:12px}
        .school{color:#1F3864;font-weight:bold;font-size:15px;text-transform:uppercase}.motto{color:#2E75B6;font-style:italic;font-size:11px}
        .doc{font-weight:bold;font-size:14px;margin-top:6px;letter-spacing:1px}
        table{width:100%;border-collapse:collapse}th{background:#1F3864;color:#fff;padding:6px;text-align:left}td{border:1px solid #bbb;padding:5px 7px}
        .num{text-align:right;white-space:nowrap}.kv td{border:none;padding:4px 6px}.kv td:first-child{color:#555;width:38%}
        .big{font-size:18px;font-weight:bold}.rev{color:#b02a37;text-decoration:line-through}.muted{color:#777;font-size:10px}
        @media print{.bar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:12mm}}
    </style></head><body>
    <div class="bar"><strong>${esc(title)}</strong><button onclick="window.print()" style="background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer">Print / Save PDF</button></div>
    <div class="head">${letterheadHtml()}<div class="doc">${esc(title.toUpperCase())}</div></div>
    ${bodyHtml}
    <p class="muted" style="text-align:center;margin-top:14px">Printed ${esc(new Date().toLocaleString('en-GB'))}</p></body></html>`;
    const win = window.open('', '_blank');
    if (!win) { onBlocked?.(); return; }
    win.document.write(html); win.document.close(); win.focus();
};

const receiptHtml = (p) => `
    <table class="kv">
        <tr><td>Receipt number</td><td><b>${esc(p.receiptNumber)}</b>${p.reversed ? ' <span style="color:#b02a37;font-weight:bold">(REVERSED)</span>' : ''}</td></tr>
        <tr><td>Date paid</td><td>${esc(fmtDate(p.paidOn))}</td></tr>
        <tr><td>Learner</td><td><b>${esc(p.student?.name)}</b> — Adm ${esc(p.student?.admissionNumber)}</td></tr>
        <tr><td>Class</td><td>${esc(p.student?.className || '-')}</td></tr>
        <tr><td>Amount</td><td class="big">${esc(kes(p.amount))}</td></tr>
        <tr><td>Paid by</td><td>${esc(methodOf(p.method).label)} — ${esc(methodOf(p.method).ref)}: <b>${esc(p.reference)}</b></td></tr>
        ${p.payerName ? `<tr><td>Payer</td><td>${esc(p.payerName)}</td></tr>` : ''}
        ${p.newBalance !== undefined ? `<tr><td>Balance after this payment</td><td><b>${esc(kes(p.newBalance))}</b>${Number(p.newBalance) < 0 ? ' (credit)' : ''}</td></tr>` : ''}
        <tr><td>Received by</td><td>${esc(p.recordedBy || '')}</td></tr>
    </table>
    <p style="margin-top:30px">Signature: ______________________ &nbsp;&nbsp; Stamp:</p>`;

// ── Learner picker (search by name or admission number) ─────────────────────
const LearnerPicker = ({ students, value, onPick }) => {
    const [q, setQ] = useState('');
    const matches = q.trim().length < 2 ? [] : students.filter(s =>
        norm(`${s.firstName} ${s.lastName}`).includes(norm(q)) || norm(s.admissionNumber).includes(norm(q))).slice(0, 8);
    return (
        <div style={{ position: 'relative', maxWidth: '460px' }}>
            <div style={styles.searchBox}>
                <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                <input style={styles.searchInput} value={q} onChange={e => setQ(e.target.value)}
                    placeholder={value ? 'Search another learner…' : 'Type a name or admission number…'}
                    onKeyDown={e => { if (e.key === 'Enter' && matches.length === 1) { onPick(matches[0]); setQ(''); } }} />
            </div>
            {matches.length > 0 && (
                <div style={styles.dropdown}>
                    {matches.map(s => (
                        <button key={s.studentId} type="button" style={styles.dropItem} onClick={() => { onPick(s); setQ(''); }}>
                            <strong>{s.firstName} {s.lastName}</strong>
                            <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>{s.admissionNumber} · {s.schoolClass ? classDisplayName(s.schoolClass) : 'No class'}</span>
                        </button>
                    ))}
                </div>
            )}
            {q.trim().length >= 2 && matches.length === 0 && <p style={{ fontSize: '12px', color: '#888', margin: '6px 2px' }}>No learner matches "{q}".</p>}
        </div>
    );
};

function Finance() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [tab, setTab] = useState('home');
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [years, setYears] = useState([]);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const successTimer = useRef(null);

    const [learner, setLearner] = useState(null);          // selected student (full object)

    useEffect(() => {
        Promise.allSettled([api.get('/api/classes'), api.get('/api/students'), api.get('/api/academic-years')]).then(([c, s, y]) => {
            if (c.status === 'fulfilled') setClasses([...(c.value.data || [])].sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true })));
            if (s.status === 'fulfilled') setStudents([...(s.value.data || [])].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
            if (y.status === 'fulfilled') setYears(y.value.data || []);
            if ([c, s, y].some(x => x.status === 'rejected')) setError('Some lists could not be loaded. Refresh the page.');
        });
        return () => clearTimeout(successTimer.current);
    }, []);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 4500);
    };
    const blocked = () => setError('Your browser blocked the print window. Allow pop-ups for this site, then try again.');

    // Terms from Academic Years (database), newest first; the current term is the default
    const termOptions = [...years].sort((a, b) => String(b.yearLabel).localeCompare(String(a.yearLabel)) || Number(b.term) - Number(a.term))
        .map(y => ({ value: `${y.yearLabel}|${y.term}`, label: `${y.yearLabel} — Term ${y.term}${isActiveTerm(y) ? ' (current)' : ''}`, active: isActiveTerm(y) }));
    const defaultTerm = (termOptions.find(t => t.active) || termOptions[0])?.value || '';

    // Sections come from the classes in the database
    const sections = [...new Set(classes.map(c => c.section).filter(Boolean))]
        .sort((a, b) => Math.min(...classes.filter(c => c.section === a).map(c => gradeRank(c.gradeLevel)))
            - Math.min(...classes.filter(c => c.section === b).map(c => gradeRank(c.gradeLevel))));

    const openLearner = (s, where) => {
        const full = students.find(x => String(x.studentId) === String(s.studentId)) || s;
        setLearner(full); setTab(where);
    };

    // Tabs grouped by job: pick a group, then a page within it
    const TAB_GROUPS = [
        { key: 'home', icon: 'house-door-fill', label: 'Home', tabs: [['home', 'house-door-fill', 'Home']] },
        { key: 'learners', icon: 'people-fill', label: 'Learners', tabs: [['balances', 'wallet2', 'Balances'], ['payment', 'cash-coin', 'Record Payment'], ['statement', 'journal-text', 'Statement'], ['prints', 'printer-fill', 'Class Printouts']] },
        { key: 'charges', icon: 'tags-fill', label: 'Charges', tabs: [['structures', 'tags-fill', 'Fee Structures'], ['extras', 'check2-square', 'Extra Charges'], ['billing', 'receipt-cutoff', 'Billing']] },
        { key: 'money', icon: 'arrow-left-right', label: 'Money In & Out', tabs: [['daybook', 'list-check', 'Payments Received'], ['expenses', 'bag-dash-fill', 'Expenses']] },
        { key: 'reports', icon: 'bar-chart-fill', label: 'Reports', tabs: [['report', 'bar-chart-fill', 'Money In & Out Report']] },
        { key: 'setup', icon: 'gear-fill', label: 'Setup', tabs: [['setup', 'collection-fill', 'Money Groups']] },
    ];
    const activeGroup = TAB_GROUPS.find(g => g.tabs.some(([k]) => k === tab)) || TAB_GROUPS[0];
    const go = (k) => { setError(''); setTab(k); };

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <h2 style={styles.title}><Icon name="cash-stack" style={{ marginRight: '10px' }} />Finance</h2>
                    <p style={styles.subtitle}>School fees: charges, payments, receipts and balances</p>

                    {error && (
                        <div style={styles.error} role="alert">
                            <Icon name="exclamation-triangle-fill" /><span style={{ flex: 1, whiteSpace: 'pre-line' }}>{error}</span>
                            <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                        </div>
                    )}
                    {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                    <div style={styles.tabs} role="tablist" aria-label="Finance sections">
                        {TAB_GROUPS.map(g => (
                            <button key={g.key} role="tab" aria-selected={activeGroup.key === g.key} onClick={() => go(g.tabs[0][0])}
                                style={{ ...styles.tab, backgroundColor: activeGroup.key === g.key ? '#1F3864' : 'white', color: activeGroup.key === g.key ? 'white' : '#1F3864' }}>
                                <Icon name={g.icon} />{g.label}
                            </button>
                        ))}
                    </div>
                    {activeGroup.tabs.length > 1 && (
                        <div style={styles.subTabs} role="tablist" aria-label={activeGroup.label}>
                            {activeGroup.tabs.map(([k, ic, label]) => (
                                <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}
                                    style={{ ...styles.subTab, borderBottomColor: tab === k ? '#1F3864' : 'transparent', color: tab === k ? '#1F3864' : '#666', fontWeight: tab === k ? 700 : 500 }}>
                                    <Icon name={ic} />{label}
                                </button>
                            ))}
                        </div>
                    )}

                    {tab === 'home' && <FinanceHome onGo={go} />}
                    {tab === 'expenses' && <ExpensesTab termOptions={termOptions} defaultTerm={defaultTerm} setError={setError} flashSuccess={flashSuccess} blocked={blocked} />}
                    {tab === 'report' && <MoneyReportTab termOptions={termOptions} defaultTerm={defaultTerm} setError={setError} blocked={blocked} />}
                    {tab === 'setup' && <MoneyGroupsTab setError={setError} flashSuccess={flashSuccess} />}

                    {tab === 'balances' && <BalancesTab classes={classes} onPay={s => openLearner(s, 'payment')} onStatement={s => openLearner(s, 'statement')} setError={setError} blocked={blocked} />}
                    {tab === 'payment' && <PaymentTab students={students} learner={learner} setLearner={setLearner} setError={setError} flashSuccess={flashSuccess} blocked={blocked} onStatement={s => openLearner(s, 'statement')} />}
                    {tab === 'statement' && <StatementTab students={students} learner={learner} setLearner={setLearner} setError={setError} flashSuccess={flashSuccess} blocked={blocked} onPay={s => openLearner(s, 'payment')} />}
                    {tab === 'daybook' && <DayBookTab setError={setError} flashSuccess={flashSuccess} blocked={blocked} />}
                    {tab === 'prints' && <ClassPrintsTab termOptions={termOptions} defaultTerm={defaultTerm} classes={classes} sections={sections} setError={setError} blocked={blocked} />}
                    {tab === 'structures' && <StructuresTab termOptions={termOptions} defaultTerm={defaultTerm} sections={sections} setError={setError} flashSuccess={flashSuccess} />}
                    {tab === 'extras' && <ExtrasTab termOptions={termOptions} defaultTerm={defaultTerm} classes={classes} sections={sections} setError={setError} flashSuccess={flashSuccess} />}
                    {tab === 'billing' && <BillingTab termOptions={termOptions} defaultTerm={defaultTerm} setError={setError} flashSuccess={flashSuccess} />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

// ══ Balances ═══════════════════════════════════════════════════════════════
const BalancesTab = ({ classes, onPay, onStatement, setError, blocked }) => {
    const [classId, setClassId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [owingOnly, setOwingOnly] = useState(false);

    const load = async () => {
        setLoading(true);
        try { const r = await api.get('/api/finance/balances', { params: classId ? { classId } : {} }); setData(r.data); }
        catch (err) { setError(serverMessage(err, 'Failed to load balances.')); }
        setLoading(false);
    };
    useEffect(() => { load(); }, [classId]);

    const rows = (data?.students || []).filter(r =>
        (!owingOnly || Number(r.balance) > 0) &&
        (!search.trim() || norm(r.name).includes(norm(search)) || norm(r.admissionNumber).includes(norm(search))));
    const cls = classes.find(c => String(c.classId) === String(classId));

    const print = () => openPrint(`Fee Balances${cls ? ' — ' + classDisplayName(cls) : ''}`, `
        <table><thead><tr><th>#</th><th>Adm</th><th>Learner</th><th>Class</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.admissionNumber)}</td><td>${esc(r.name)}</td><td>${esc(r.className || '-')}</td><td class="num">${money(r.billed)}</td><td class="num">${money(r.paid)}</td><td class="num"><b>${money(r.balance)}</b></td></tr>`).join('')}
        </tbody></table>
        <p style="text-align:right;margin-top:8px"><b>Total outstanding: ${esc(kes(rows.reduce((s, r) => s + Math.max(0, Number(r.balance)), 0)))}</b></p>
        ${paymentHtml()}`, blocked);

    return (
        <div>
            <div style={styles.bar}>
                <select style={styles.select} value={classId} onChange={e => setClassId(e.target.value)} aria-label="Class">
                    <option value="">All classes</option>
                    {classes.map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                </select>
                <div style={{ ...styles.searchBox, flex: 1, minWidth: '180px' }}>
                    <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                    <input style={styles.searchInput} placeholder="Search learner or admission no…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <label style={styles.check}><input type="checkbox" checked={owingOnly} onChange={e => setOwingOnly(e.target.checked)} /> Owing only</label>
                <button onClick={print} style={styles.secondaryBtn} disabled={!rows.length}><Icon name="printer-fill" />Print</button>
            </div>

            {data && (
                <div style={styles.cards}>
                    <div style={{ ...styles.card, borderTopColor: '#1F3864' }}><div style={styles.cardNum}>{kes(data.totalBilled)}</div><div style={styles.cardLbl}>Billed</div></div>
                    <div style={{ ...styles.card, borderTopColor: '#28a745' }}><div style={{ ...styles.cardNum, color: '#1e7e34' }}>{kes(data.totalPaid)}</div><div style={styles.cardLbl}>Paid</div></div>
                    <div style={{ ...styles.card, borderTopColor: '#dc3545' }}><div style={{ ...styles.cardNum, color: '#b02a37' }}>{kes(data.totalOwed)}</div><div style={styles.cardLbl}>Outstanding</div></div>
                </div>
            )}

            {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading…</p> : (
                <div style={styles.panel}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ ...styles.table, minWidth: '720px' }}>
                            <thead><tr>
                                <th style={styles.th}>Learner</th><th style={styles.th}>Class</th>
                                <th style={styles.thNum}>Billed</th><th style={styles.thNum}>Paid</th><th style={styles.thNum}>Balance</th><th style={styles.th}></th>
                            </tr></thead>
                            <tbody>
                                {rows.map((r, i) => {
                                    const bal = Number(r.balance);
                                    return (
                                        <tr key={r.studentId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                            <td style={styles.td}><strong style={{ color: '#1F3864' }}>{r.name}</strong><div style={styles.adm}>{r.admissionNumber}</div></td>
                                            <td style={styles.td}>{r.className || <span style={{ color: '#bbb' }}>—</span>}</td>
                                            <td style={styles.tdNum}>{money(r.billed)}</td>
                                            <td style={styles.tdNum}>{money(r.paid)}</td>
                                            <td style={{ ...styles.tdNum, fontWeight: 800, color: bal > 0 ? '#b02a37' : bal < 0 ? '#1e7e34' : '#333' }}>
                                                {money(Math.abs(bal))}{bal < 0 && <span style={styles.creditTag}>credit</span>}
                                            </td>
                                            <td style={{ ...styles.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                <button onClick={() => onPay(r)} style={styles.smallBtn}><Icon name="cash-coin" style={{ marginRight: '4px' }} />Pay</button>
                                                <button onClick={() => onStatement(r)} style={{ ...styles.smallBtn, backgroundColor: '#6c757d' }}><Icon name="journal-text" style={{ marginRight: '4px' }} />Statement</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!rows.length && <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#888', padding: '24px' }}>No learners to show.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// ══ Record payment ═════════════════════════════════════════════════════════
const PaymentTab = ({ students, learner, setLearner, setError, flashSuccess, blocked, onStatement }) => {
    const empty = { amount: '', method: 'MPESA', reference: '', payerName: '', paidOn: todayISO() };
    const [form, setForm] = useState(empty);
    const [balance, setBalance] = useState(null);
    const [saving, setSaving] = useState(false);
    const [receipt, setReceipt] = useState(null);

    useEffect(() => {
        setBalance(null);
        if (!learner) return;
        api.get(`/api/finance/students/${learner.studentId}/statement`).then(r => setBalance(r.data.balance)).catch(() => setBalance(undefined));
    }, [learner?.studentId]);

    const m = methodOf(form.method);
    const submit = async (e) => {
        e.preventDefault();
        if (!learner || saving) return;
        if (!isAmount(form.amount)) { setError('Enter a valid amount, e.g. 15000 or 15000.50.'); return; }
        if (form.reference.trim().length < 4) { setError(`Enter the ${m.ref}.`); return; }
        if (!window.confirm(`Record ${kes(form.amount)} for ${learner.firstName} ${learner.lastName}?\n\n${m.label} — ${m.ref}: ${form.reference.trim().toUpperCase()}\nDate: ${fmtDate(form.paidOn)}`)) return;
        setSaving(true); setError('');
        try {
            const r = await api.post('/api/finance/payments', {
                studentId: learner.studentId, amount: form.amount.trim(), method: form.method,
                reference: form.reference, payerName: form.payerName, paidOn: form.paidOn,
            });
            setReceipt(r.data);
            setBalance(r.data.newBalance);
            setForm({ ...empty, method: form.method });
            flashSuccess(r.data.message || 'Payment recorded.');
        } catch (err) { setError(serverMessage(err, 'Failed to record the payment.')); }
        setSaving(false);
    };

    return (
        <div style={styles.panel}>
            <h3 style={styles.h3}><Icon name="person-fill" />Learner</h3>
            <LearnerPicker students={students} value={learner} onPick={s => { setLearner(s); setReceipt(null); }} />
            {learner && (
                <div style={styles.learnerCard}>
                    <div>
                        <strong style={{ color: '#1F3864', fontSize: '15px' }}>{learner.firstName} {learner.lastName}</strong>
                        <div style={styles.adm}>Adm {learner.admissionNumber} · {learner.schoolClass ? classDisplayName(learner.schoolClass) : 'No class'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#666' }}>Current balance</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: Number(balance) > 0 ? '#b02a37' : '#1e7e34' }}>
                            {balance === null ? '…' : balance === undefined ? '-' : `${kes(Math.abs(balance))}${Number(balance) < 0 ? ' credit' : ''}`}
                        </div>
                        <button onClick={() => onStatement(learner)} style={styles.linkBtn}>View statement</button>
                    </div>
                </div>
            )}

            {learner && (
                <form onSubmit={submit} style={{ marginTop: '18px' }}>
                    <h3 style={styles.h3}><Icon name="cash-coin" />Payment</h3>
                    <div style={styles.methodRow} role="radiogroup" aria-label="Payment method">
                        {METHODS.map(x => (
                            <button key={x.key} type="button" role="radio" aria-checked={form.method === x.key}
                                onClick={() => setForm({ ...form, method: x.key })}
                                style={{ ...styles.methodBtn, backgroundColor: form.method === x.key ? '#1F3864' : 'white', color: form.method === x.key ? 'white' : '#1F3864' }}>
                                {x.label}
                            </button>
                        ))}
                    </div>
                    <div style={styles.formGrid}>
                        <label style={styles.field}>Amount (KES)
                            <input style={styles.input} inputMode="decimal" value={form.amount} placeholder="e.g. 15000"
                                onChange={e => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })} required />
                        </label>
                        <label style={styles.field}>{m.ref}
                            <input style={{ ...styles.input, textTransform: 'uppercase' }} value={form.reference} placeholder={m.placeholder} maxLength={40}
                                onChange={e => setForm({ ...form, reference: e.target.value })} required />
                        </label>
                        <label style={styles.field}>Date paid
                            <input type="date" style={styles.input} value={form.paidOn} max={todayISO()} onChange={e => setForm({ ...form, paidOn: e.target.value })} required />
                        </label>
                        <label style={styles.field}>Paid by (optional)
                            <input style={styles.input} value={form.payerName} maxLength={100} placeholder="Parent / guardian name" onChange={e => setForm({ ...form, payerName: e.target.value })} />
                        </label>
                    </div>
                    <button type="submit" disabled={saving} style={{ ...styles.primaryBtn, opacity: saving ? 0.7 : 1 }}>
                        <Icon name={saving ? 'hourglass-split' : 'check-circle-fill'} />{saving ? 'Saving…' : 'Record Payment'}
                    </button>
                </form>
            )}

            {receipt && (
                <div style={styles.receiptBox}>
                    <div>
                        <strong style={{ color: '#155724' }}><Icon name="receipt" />Receipt {receipt.receiptNumber}</strong>
                        <div style={{ fontSize: '13px', color: '#333', marginTop: '4px' }}>{kes(receipt.amount)} · {methodOf(receipt.method).label} {receipt.reference} · New balance {kes(receipt.newBalance)}</div>
                    </div>
                    <button onClick={() => openPrint(`Official Receipt ${receipt.receiptNumber}`, receiptHtml(receipt), blocked)} style={styles.primaryBtn}>
                        <Icon name="printer-fill" />Print Receipt
                    </button>
                </div>
            )}
        </div>
    );
};

// ══ Statement ══════════════════════════════════════════════════════════════
const StatementTab = ({ students, learner, setLearner, setError, flashSuccess, blocked, onPay }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState({});

    const load = async (id) => {
        setLoading(true);
        try { const r = await api.get(`/api/finance/students/${id}/statement`); setData(r.data); }
        catch (err) { setError(serverMessage(err, 'Failed to load the statement.')); }
        setLoading(false);
    };
    useEffect(() => { setData(null); if (learner) load(learner.studentId); }, [learner?.studentId]);

    const reverse = async (p) => {
        const reason = window.prompt(`Reverse receipt ${p.receiptNumber} (${kes(p.amount)})?\n\nThe payment stays on record, marked REVERSED, and no longer counts.\nReason (e.g. "cheque bounced"):`);
        if (reason === null) return;
        if (reason.trim().length < 3) { setError('Give a reason for the reversal.'); return; }
        try {
            const r = await api.post(`/api/finance/payments/${p.paymentId}/reverse`, { reason });
            flashSuccess(r.data.message);
            load(learner.studentId);
        } catch (err) { setError(serverMessage(err, 'Failed to reverse the payment.')); }
    };

    const print = () => data && openPrint(`Fee Statement — ${data.student.name}`, `
        <table class="kv"><tr><td>Learner</td><td><b>${esc(data.student.name)}</b> — Adm ${esc(data.student.admissionNumber)}</td></tr>
        <tr><td>Class</td><td>${esc(data.student.className || '-')}</td></tr></table><br>
        <table><thead><tr><th>Date</th><th>Details</th><th class="num">Charges</th><th class="num">Payments</th><th class="num">Balance</th></tr></thead><tbody>
        ${data.entries.map(e => `<tr${(e.reversed || e.cancelled) ? ' class="rev"' : ''}><td>${esc(fmtDate(e.date))}</td><td>${esc(e.description)}${e.receiptNumber ? ` <span class="muted">${esc(e.receiptNumber)}</span>` : ''}</td><td class="num">${e.debit != null ? money(e.debit) : ''}</td><td class="num">${e.credit != null ? money(e.credit) : ''}</td><td class="num">${money(e.balance)}</td></tr>`).join('')}
        </tbody></table>
        <p style="text-align:right;margin-top:8px" class="big">Balance: ${esc(kes(Math.abs(data.balance)))}${Number(data.balance) < 0 ? ' (credit)' : ''}</p>
        ${paymentHtml()}`, blocked);

    return (
        <div style={styles.panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <LearnerPicker students={students} value={learner} onPick={setLearner} />
                {data && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => onPay(learner)} style={styles.secondaryBtn}><Icon name="cash-coin" />Record payment</button>
                        <button onClick={print} style={styles.secondaryBtn}><Icon name="printer-fill" />Print</button>
                    </div>
                )}
            </div>
            {!learner && <p style={{ color: '#666', marginTop: '14px' }}>Search for a learner to see their fee statement.</p>}
            {loading && <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading…</p>}
            {data && !loading && (
                <>
                    <div style={styles.learnerCard}>
                        <div><strong style={{ color: '#1F3864', fontSize: '15px' }}>{data.student.name}</strong><div style={styles.adm}>Adm {data.student.admissionNumber} · {data.student.className || 'No class'}</div></div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', color: '#666' }}>Balance</div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: Number(data.balance) > 0 ? '#b02a37' : '#1e7e34' }}>{kes(Math.abs(data.balance))}{Number(data.balance) < 0 ? ' credit' : ''}</div>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                        <table style={{ ...styles.table, minWidth: '700px' }}>
                            <thead><tr>
                                <th style={styles.th}>Date</th><th style={styles.th}>Details</th>
                                <th style={styles.thNum}>Charges</th><th style={styles.thNum}>Payments</th><th style={styles.thNum}>Balance</th><th style={styles.th}></th>
                            </tr></thead>
                            <tbody>
                                {data.entries.map((e, i) => (
                                    <React.Fragment key={i}>
                                        <tr style={{ backgroundColor: (e.reversed || e.cancelled) ? '#fdecea' : i % 2 ? 'white' : '#fafafa', color: (e.reversed || e.cancelled) ? '#999' : undefined }}>
                                            <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                                            <td style={styles.td}>
                                                <span style={{ textDecoration: (e.reversed || e.cancelled) ? 'line-through' : 'none' }}>{e.description}</span>
                                                {e.cancelled && <div style={{ fontSize: '11px', color: '#b02a37' }}>{e.cancelReason}</div>}
                                                {e.receiptNumber && <div style={styles.adm}>{e.receiptNumber}{e.payerName ? ` · ${e.payerName}` : ''}</div>}
                                                {e.reversed && <div style={{ fontSize: '11px', color: '#b02a37' }}>Reversed: {e.reversalReason}{e.reversedBy ? ` (by ${e.reversedBy})` : ''}</div>}
                                                {e.lines && <button onClick={() => setOpen(o => ({ ...o, [i]: !o[i] }))} style={styles.linkBtn}>{open[i] ? 'Hide' : 'Show'} items</button>}
                                            </td>
                                            <td style={styles.tdNum}>{e.debit != null ? money(e.debit) : ''}</td>
                                            <td style={{ ...styles.tdNum, color: '#1e7e34' }}>{e.credit != null ? money(e.credit) : ''}</td>
                                            <td style={{ ...styles.tdNum, fontWeight: 700 }}>{money(e.balance)}</td>
                                            <td style={{ ...styles.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                {e.type === 'PAYMENT' && (
                                                    <>
                                                        <button onClick={() => openPrint(`Official Receipt ${e.receiptNumber}`, receiptHtml({ ...e, student: data.student }), blocked)} style={{ ...styles.smallBtn, backgroundColor: '#6c757d' }} title="Reprint receipt"><i className="bi bi-printer-fill" aria-hidden="true" /></button>
                                                        {!e.reversed && <button onClick={() => reverse(e)} style={{ ...styles.smallBtn, backgroundColor: '#dc3545' }} title="Reverse this payment"><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /></button>}
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                        {e.lines && open[i] && e.lines.map((l, j) => (
                                            <tr key={`${i}-${j}`} style={{ backgroundColor: '#f7fbff' }}>
                                                <td style={styles.td}></td>
                                                <td style={{ ...styles.td, paddingLeft: '28px', fontSize: '12px', color: '#555' }}>{l.name}</td>
                                                <td style={{ ...styles.tdNum, fontSize: '12px', color: '#555' }}>{money(l.amount)}</td>
                                                <td colSpan={3} style={styles.td}></td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                                {!data.entries.length && <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#888', padding: '24px' }}>No charges or payments yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

// ══ Payments (day book) ═════════════════════════════════════════════════════
const DayBookTab = ({ setError, flashSuccess, blocked }) => {
    const [from, setFrom] = useState(todayISO());
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        if (from > to) { setError('The start date must be before the end date.'); return; }
        setLoading(true);
        try { const r = await api.get('/api/finance/payments', { params: { from, to } }); setData(r.data); }
        catch (err) { setError(serverMessage(err, 'Failed to load payments.')); }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const reverse = async (p) => {
        const reason = window.prompt(`Reverse receipt ${p.receiptNumber} (${kes(p.amount)} for ${p.student?.name})?\n\nReason (e.g. "cheque bounced"):`);
        if (reason === null) return;
        if (reason.trim().length < 3) { setError('Give a reason for the reversal.'); return; }
        try { const r = await api.post(`/api/finance/payments/${p.paymentId}/reverse`, { reason }); flashSuccess(r.data.message); load(); }
        catch (err) { setError(serverMessage(err, 'Failed to reverse the payment.')); }
    };

    const print = () => data && openPrint(`Payments ${fmtDate(from)}${from !== to ? ' – ' + fmtDate(to) : ''}`, `
        <table><thead><tr><th>Date</th><th>Receipt</th><th>Learner</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead><tbody>
        ${data.payments.map(p => `<tr${p.reversed ? ' class="rev"' : ''}><td>${esc(fmtDate(p.paidOn))}</td><td>${esc(p.receiptNumber)}</td><td>${esc(p.student?.name)}</td><td>${esc(methodOf(p.method).label)}</td><td>${esc(p.reference)}</td><td class="num">${money(p.amount)}</td></tr>`).join('')}
        </tbody></table>
        <table class="kv" style="margin-top:10px;width:auto;margin-left:auto">${METHODS.map(m => `<tr><td>${esc(m.label)}</td><td class="num">${money(data.byMethod?.[m.key])}</td></tr>`).join('')}
        <tr><td><b>Total received</b></td><td class="num big">${money(data.total)}</td></tr></table>`, blocked);

    return (
        <div>
            <div style={styles.bar}>
                <label style={styles.check}>From <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={styles.dateInput} /></label>
                <label style={styles.check}>To <input type="date" value={to} max={todayISO()} onChange={e => setTo(e.target.value)} style={styles.dateInput} /></label>
                <button onClick={load} style={styles.secondaryBtn}><Icon name="arrow-repeat" />Show</button>
                <button onClick={print} style={{ ...styles.secondaryBtn, marginLeft: 'auto' }} disabled={!data?.payments?.length}><Icon name="printer-fill" />Print</button>
            </div>
            {data && (
                <div style={styles.cards}>
                    {METHODS.map(m => <div key={m.key} style={{ ...styles.card, borderTopColor: '#2E75B6' }}><div style={styles.cardNum}>{kes(data.byMethod?.[m.key])}</div><div style={styles.cardLbl}>{m.label}</div></div>)}
                    <div style={{ ...styles.card, borderTopColor: '#28a745' }}><div style={{ ...styles.cardNum, color: '#1e7e34' }}>{kes(data.total)}</div><div style={styles.cardLbl}>Total received</div></div>
                </div>
            )}
            {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading…</p> : data && (
                <div style={{ ...styles.panel, overflowX: 'auto' }}>
                    <table style={{ ...styles.table, minWidth: '760px' }}>
                        <thead><tr>
                            <th style={styles.th}>Date</th><th style={styles.th}>Receipt</th><th style={styles.th}>Learner</th><th style={styles.th}>Method · Ref</th><th style={styles.thNum}>Amount</th><th style={styles.th}></th>
                        </tr></thead>
                        <tbody>
                            {data.payments.map((p, i) => (
                                <tr key={p.paymentId} style={{ backgroundColor: p.reversed ? '#fdecea' : i % 2 ? 'white' : '#fafafa', color: p.reversed ? '#999' : undefined }}>
                                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{fmtDate(p.paidOn)}</td>
                                    <td style={styles.td}><span style={{ textDecoration: p.reversed ? 'line-through' : 'none' }}>{p.receiptNumber}</span>{p.reversed && <div style={{ fontSize: '11px', color: '#b02a37' }}>Reversed: {p.reversalReason}</div>}</td>
                                    <td style={styles.td}><strong style={{ color: '#1F3864' }}>{p.student?.name}</strong><div style={styles.adm}>{p.student?.admissionNumber} · {p.student?.className || '-'}</div></td>
                                    <td style={styles.td}>{methodOf(p.method).label}<div style={styles.adm}>{p.reference}</div></td>
                                    <td style={{ ...styles.tdNum, fontWeight: 700 }}>{money(p.amount)}</td>
                                    <td style={{ ...styles.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        <button onClick={() => openPrint(`Official Receipt ${p.receiptNumber}`, receiptHtml(p), blocked)} style={{ ...styles.smallBtn, backgroundColor: '#6c757d' }} title="Reprint receipt"><i className="bi bi-printer-fill" aria-hidden="true" /></button>
                                        {!p.reversed && <button onClick={() => reverse(p)} style={{ ...styles.smallBtn, backgroundColor: '#dc3545' }} title="Reverse this payment"><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /></button>}
                                    </td>
                                </tr>
                            ))}
                            {!data.payments.length && <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#888', padding: '24px' }}>No payments in this period.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ══ Fee structures ═════════════════════════════════════════════════════════
const StructuresTab = ({ termOptions, defaultTerm, sections, setError, flashSuccess }) => {
    const [termKey, setTermKey] = useState('');
    const [all, setAll] = useState([]);
    const [drafts, setDrafts] = useState({});      // section -> [{name, amount}]
    const [savingSec, setSavingSec] = useState('');

    useEffect(() => { if (!termKey && defaultTerm) setTermKey(defaultTerm); }, [defaultTerm]);
    const [year, term] = termKey.split('|');

    const loadAll = async () => {
        try { const r = await api.get('/api/finance/structures'); setAll(r.data || []); }
        catch (err) { setError(serverMessage(err, 'Failed to load fee structures.')); }
    };
    useEffect(() => { loadAll(); }, []);

    const current = (sec) => all.find(s => s.section === sec && String(s.yearLabel) === year && String(s.term) === term);
    // Most recent structure for this section BEFORE the chosen term (for "Copy previous")
    const previous = (sec) => all.filter(s => s.section === sec && (String(s.yearLabel) < year || (String(s.yearLabel) === year && Number(s.term) < Number(term))))
        .sort((a, b) => String(b.yearLabel).localeCompare(String(a.yearLabel)) || b.term - a.term)[0];

    useEffect(() => {
        const d = {};
        sections.forEach(sec => { const s = current(sec); d[sec] = s ? s.items.map(i => ({ name: i.name, amount: String(i.amount) })) : []; });
        setDrafts(d);
    }, [termKey, all, sections.join(',')]);

    const setItem = (sec, idx, patch) => setDrafts(d => ({ ...d, [sec]: d[sec].map((it, i) => i === idx ? { ...it, ...patch } : it) }));
    const addItem = (sec) => setDrafts(d => ({ ...d, [sec]: [...(d[sec] || []), { name: '', amount: '' }] }));
    const removeItem = (sec, idx) => setDrafts(d => ({ ...d, [sec]: d[sec].filter((_, i) => i !== idx) }));
    const copyPrev = (sec) => { const p = previous(sec); if (p) setDrafts(d => ({ ...d, [sec]: p.items.map(i => ({ name: i.name, amount: String(i.amount) })) })); };

    const save = async (sec) => {
        const items = (drafts[sec] || []).filter(i => i.name.trim() || i.amount.trim());
        if (!items.length) { setError(`Add at least one fee item for ${sectionLabel(sec)}.`); return; }
        const bad = items.find(i => !i.name.trim() || !/^\d{1,8}(\.\d{1,2})?$/.test(i.amount.trim()));
        if (bad) { setError(`${sectionLabel(sec)}: every item needs a name and an amount like 15000 or 15000.50.`); return; }
        setSavingSec(sec); setError('');
        try {
            const r = await api.put('/api/finance/structures', { section: sec, yearLabel: year, term: Number(term), items: items.map(i => ({ name: i.name.trim(), amount: i.amount.trim() })) });
            flashSuccess(`${sectionLabel(sec)}: ${r.data.message}`);
            await loadAll();
        } catch (err) { setError(serverMessage(err, 'Failed to save the fees.')); }
        setSavingSec('');
    };

    if (!termOptions.length) return <div style={styles.panel}><p style={{ margin: 0, color: '#666' }}>No terms found. Add terms on the Academic Years page first.</p></div>;

    return (
        <div>
            <div style={styles.bar}>
                <label style={styles.check}>Term
                    <select style={styles.select} value={termKey} onChange={e => setTermKey(e.target.value)}>
                        {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </label>
                <span style={{ fontSize: '12px', color: '#666' }}>Each section has its own fees. Changing fees does not change learners already billed.</span>
            </div>
            <div style={styles.secGrid}>
                {sections.map(sec => {
                    const items = drafts[sec] || [];
                    const saved = current(sec);
                    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                    const dirty = JSON.stringify(items.map(i => [i.name.trim(), Number(i.amount) || 0])) !== JSON.stringify((saved?.items || []).map(i => [i.name, Number(i.amount)]));
                    const prev = previous(sec);
                    return (
                        <div key={sec} style={styles.secCard}>
                            <div style={styles.secHead}>
                                <strong style={{ color: '#1F3864' }}>{sectionLabel(sec)}</strong>
                                <span style={{ ...styles.pill, backgroundColor: saved ? '#d4edda' : '#fff3cd', color: saved ? '#155724' : '#856404' }}>{saved ? 'Set' : 'Not set'}</span>
                            </div>
                            {items.map((it, idx) => (
                                <div key={idx} style={styles.itemRow}>
                                    <input style={{ ...styles.input, flex: 2 }} value={it.name} placeholder="e.g. Tuition" maxLength={80} onChange={e => setItem(sec, idx, { name: e.target.value })} aria-label="Item name" />
                                    <input style={{ ...styles.input, flex: 1, textAlign: 'right' }} inputMode="decimal" value={it.amount} placeholder="0.00" onChange={e => setItem(sec, idx, { amount: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Amount" />
                                    <button onClick={() => removeItem(sec, idx)} style={styles.iconBtn} aria-label="Remove item"><i className="bi bi-x-lg" /></button>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '6px 0 10px' }}>
                                <button onClick={() => addItem(sec)} style={styles.linkBtn}><Icon name="plus-circle" style={{ marginRight: '3px' }} />Add item</button>
                                {!items.length && prev && <button onClick={() => copyPrev(sec)} style={styles.linkBtn}><Icon name="files" style={{ marginRight: '3px' }} />Copy from {prev.yearLabel} T{prev.term}</button>}
                            </div>
                            <div style={styles.secFoot}>
                                <span>Total: <strong>{kes(total)}</strong></span>
                                <button onClick={() => save(sec)} disabled={savingSec === sec || !dirty} style={{ ...styles.primaryBtn, padding: '8px 16px', opacity: savingSec === sec || !dirty ? 0.55 : 1 }}>
                                    <Icon name={savingSec === sec ? 'hourglass-split' : 'save-fill'} />{savingSec === sec ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ══ Extra charges (optional / one-off) ════════════════════════════════════
const KIND_LABEL = { PER_TERM: 'Each term (opt-in)', ONCE: 'Once per learner' };
const emptyCharge = { chargeId: null, name: '', amount: '', kind: 'PER_TERM', sections: [], active: true, monthlyAmount: '', dailyAmount: '',
    perSection: false, sectionAmounts: {}, onlyClasses: false, classIds: [], teacherCanTick: false, groupId: '' };
// A saved charge → the edit form
const chargeToForm = (c) => ({
    ...emptyCharge, ...c, amount: String(c.amount ?? ''), monthlyAmount: c.monthlyAmount ?? '', dailyAmount: c.dailyAmount ?? '',
    perSection: Object.keys(c.sectionAmounts || {}).length > 0,
    sectionAmounts: Object.fromEntries(Object.entries(c.sectionAmounts || {}).map(([k, v]) => [k, String(v)])),
    onlyClasses: (c.classIds || []).length > 0, classIds: (c.classIds || []).map(Number), teacherCanTick: !!c.teacherCanTick,
    groupId: c.groupId ?? '',
});
const hasSectionPrices = (c) => Object.keys(c?.sectionAmounts || {}).length > 0;

const ExtrasTab = ({ termOptions, defaultTerm, classes, sections, setError, flashSuccess }) => {
    const [charges, setCharges] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [termKey, setTermKey] = useState('');
    const [classId, setClassId] = useState('');
    const [list, setList] = useState(null);          // learners from the server
    const [ticks, setTicks] = useState(new Set());   // what's ticked on screen
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null);    // charge being added / edited
    const [pricing, setPricing] = useState(null);    // learner whose price is being set
    const latest = useRef('');

    useEffect(() => { if (!termKey && defaultTerm) setTermKey(defaultTerm); }, [defaultTerm]);
    const [year, term] = termKey.split('|');

    const [moneyGroups, setMoneyGroups] = useState([]);
    const loadCharges = async () => {
        try { const r = await api.get('/api/finance/charges'); setCharges(r.data || []); }
        catch (err) { setError(serverMessage(err, 'Failed to load extra charges.')); }
        try { const g = await api.get('/api/finance/groups'); setMoneyGroups(g.data.groups || []); } catch (e) { /* groups are optional here */ }
    };
    useEffect(() => { loadCharges(); }, []);

    const charge = charges.find(c => String(c.chargeId) === String(selectedId));
    const originalTicked = new Set((list?.learners || []).filter(l => l.ticked).map(l => l.studentId));
    const toAdd = [...ticks].filter(id => !originalTicked.has(id));
    const toRemove = [...originalTicked].filter(id => !ticks.has(id));
    const dirty = toAdd.length > 0 || toRemove.length > 0;

    const loadList = async () => {
        if (!selectedId || !termKey) { setList(null); return; }
        const key = `${selectedId}|${termKey}|${classId}`;
        latest.current = key;
        setLoading(true);
        try {
            const r = await api.get(`/api/finance/charges/${selectedId}/learners`, { params: { yearLabel: year, term, ...(classId ? { classId } : {}) } });
            if (latest.current !== key) return;
            setList(r.data);
            setTicks(new Set(r.data.learners.filter(l => l.ticked).map(l => l.studentId)));
        } catch (err) { if (latest.current === key) setError(serverMessage(err, 'Failed to load the list.')); }
        if (latest.current === key) setLoading(false);
    };
    useEffect(() => { loadList(); }, [selectedId, termKey, classId]);

    const guard = (fn) => (...a) => { if (!dirty || window.confirm('You have unsaved ticks. Discard them?')) fn(...a); };
    const pickCharge = guard((id) => { setSelectedId(id); setClassId(''); setSearch(''); });
    const pickTerm = guard((v) => setTermKey(v));
    const pickClass = guard((v) => setClassId(v));

    const toggle = (l) => {
        if (l.locked) return;
        setTicks(t => { const n = new Set(t); n.has(l.studentId) ? n.delete(l.studentId) : n.add(l.studentId); return n; });
    };
    const shown = (list?.learners || []).filter(l => !search.trim() || norm(l.name).includes(norm(search)) || norm(l.admissionNumber).includes(norm(search)));
    const tickAllShown = (on) => setTicks(t => { const n = new Set(t); shown.forEach(l => { if (!l.locked) on ? n.add(l.studentId) : n.delete(l.studentId); }); return n; });

    // "Copy from last term" — tick whoever took this charge in the previous term
    const idx = termOptions.findIndex(t => t.value === termKey);
    const prevTerm = idx >= 0 ? termOptions[idx + 1] : null;
    const copyPrevious = async () => {
        if (!prevTerm) return;
        const [py, pt] = prevTerm.value.split('|');
        try {
            const r = await api.get(`/api/finance/charges/${selectedId}/learners`, { params: { yearLabel: py, term: pt, ...(classId ? { classId } : {}) } });
            const prev = new Set(r.data.learners.filter(l => l.ticked).map(l => l.studentId));
            const here = new Set((list?.learners || []).map(l => l.studentId));
            setTicks(t => { const n = new Set(t); prev.forEach(id => { if (here.has(id)) n.add(id); }); return n; });
            flashSuccess(`Ticked ${[...prev].filter(id => here.has(id)).length} learner(s) who had ${charge.name} in ${prevTerm.label.replace(' (current)', '')}. Check, then Save.`);
        } catch (err) { setError(serverMessage(err, 'Could not read last term\'s list.')); }
    };

    const save = async () => {
        if (!dirty || saving) return;
        const byId = new Map((list?.learners || []).map(l => [l.studentId, l]));
        const addTotal = toAdd.reduce((s, id) => s + Number(byId.get(id)?.standardAmount ?? charge.amount ?? 0), 0);
        if (!window.confirm(`${charge.name} — ${year} Term ${term}\n\nCharge ${toAdd.length} learner(s): ${kes(addTotal)}\n${toRemove.length ? `Remove ${toRemove.length} learner(s) (their charge is cancelled)\n` : ''}\nSave?`)) return;
        setSaving(true); setError('');
        try {
            const r = await api.post(`/api/finance/charges/${selectedId}/apply`, { yearLabel: year, term: Number(term), add: toAdd, remove: toRemove });
            flashSuccess(r.data.message);
            await loadList();
        } catch (err) { setError(serverMessage(err, 'Failed to save. Nothing was changed.')); }
        setSaving(false);
    };

    // ── add / edit a charge ──
    const saveCharge = async (e) => {
        e.preventDefault();
        if (!editing.name.trim()) { setError('Give the charge a name.'); return; }
        if (!editing.perSection && !isAmount(editing.amount)) { setError('Enter a valid amount, e.g. 3200.'); return; }
        if (!editing.sections.length) { setError('Tick at least one section.'); return; }
        if (!isOptionalAmount(editing.monthlyAmount) || !isOptionalAmount(editing.dailyAmount)) { setError('Monthly and daily rates must be valid amounts, or left empty.'); return; }
        if (editing.perSection) {
            const missing = editing.sections.find(sec => !isAmount(editing.sectionAmounts[sec] ?? ''));
            if (missing) { setError(`Enter a valid price for ${sectionLabel(missing)}.`); return; }
        }
        const chosenClasses = editing.onlyClasses ? editing.classIds.filter(id => classes.some(c => Number(c.classId) === id && editing.sections.includes(c.section))) : [];
        if (editing.onlyClasses && !chosenClasses.length) { setError('Tick at least one class, or untick "Only some classes".'); return; }
        try {
            const sectionAmounts = editing.perSection ? Object.fromEntries(editing.sections.map(sec => [sec, String(editing.sectionAmounts[sec]).trim()])) : {};
            const r = await api.put('/api/finance/charges', {
                chargeId: editing.chargeId, kind: editing.kind, sections: editing.sections, active: editing.active,
                name: editing.name.trim(),
                // With a price per section, the first section's price is kept as the standard amount
                amount: editing.perSection ? sectionAmounts[editing.sections[0]] : String(editing.amount).trim(),
                sectionAmounts, classIds: chosenClasses, teacherCanTick: !!editing.teacherCanTick,
                groupId: editing.groupId ? Number(editing.groupId) : null,
                monthlyAmount: editing.kind === 'PER_TERM' ? blankToNull(editing.monthlyAmount) : null,
                dailyAmount: editing.kind === 'PER_TERM' ? blankToNull(editing.dailyAmount) : null,
            });
            flashSuccess(r.data.message);
            setEditing(null);
            await loadCharges();
            setSelectedId(String(r.data.chargeId));
        } catch (err) { setError(serverMessage(err, 'Failed to save the charge.')); }
    };

    const classesForCharge = charge ? classes.filter(c => charge.sections.includes(c.section)
        && (!(charge.classIds || []).length || charge.classIds.map(Number).includes(Number(c.classId)))) : [];
    // Ticked total: what each learner is actually charged (their own price), full price for new ticks
    const priceOf = (l) => (l.ticked && l.amount !== null && l.amount !== undefined ? Number(l.amount) : Number(l.standardAmount ?? charge?.amount) || 0);
    const tickedTotal = (list?.learners || []).filter(l => ticks.has(l.studentId)).reduce((s, l) => s + priceOf(l), 0);

    const savePrice = async (l, p) => {
        try {
            const r = await api.put(`/api/finance/charges/${selectedId}/price`, { studentId: l.studentId, yearLabel: year, term: Number(term), ...p });
            flashSuccess(r.data.message);
            await loadList();
            return true;
        } catch (err) { setError(serverMessage(err, 'Failed to save the price.')); return false; }
    };

    return (
        <div style={styles.extrasLayout}>
            {/* ── list of charges ── */}
            <div style={{ ...styles.panel, flex: '1 1 260px', maxWidth: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ ...styles.h3, margin: 0 }}><Icon name="list-ul" />Charges</h3>
                    <button onClick={() => setEditing({ ...emptyCharge })} style={styles.linkBtn}><Icon name="plus-circle" style={{ marginRight: '3px' }} />New</button>
                </div>
                {charges.length === 0 && <p style={{ fontSize: '13px', color: '#666' }}>No extra charges yet. Run the extra charges script or click New.</p>}
                {charges.map(c => (
                    <button key={c.chargeId} type="button" onClick={() => pickCharge(String(c.chargeId))}
                        style={{ ...styles.chargeItem, borderColor: String(c.chargeId) === String(selectedId) ? '#1F3864' : '#eee', backgroundColor: String(c.chargeId) === String(selectedId) ? '#eef3fb' : 'white', opacity: c.active ? 1 : 0.55 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                            <strong style={{ color: '#1F3864', textAlign: 'left' }}>{c.name}</strong>
                            <span style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{hasSectionPrices(c) ? 'by section' : money(c.amount)}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '3px', textAlign: 'left' }}>
                            <span style={{ ...styles.pill, backgroundColor: c.kind === 'ONCE' ? '#fff3cd' : '#e3f2fd', color: c.kind === 'ONCE' ? '#856404' : '#1F3864', marginRight: '6px' }}>{KIND_LABEL[c.kind]}</span>
                            {c.sections.map(sectionLabel).join(', ')}{(c.classIds || []).length > 0 && ` · ${c.classIds.length} class${c.classIds.length === 1 ? '' : 'es'} only`}{!c.active && ' · switched off'}
                            {c.teacherCanTick && <span style={{ ...styles.pill, backgroundColor: '#e8f5e9', color: '#1e7e34', marginLeft: '6px' }}>teachers tick</span>}
                        </div>
                    </button>
                ))}
            </div>

            {/* ── right side: edit form or tick list ── */}
            <div style={{ flex: '999 1 420px', minWidth: 0 }}>
                {editing ? (
                    <form onSubmit={saveCharge} style={styles.panel}>
                        <h3 style={styles.h3}><Icon name={editing.chargeId ? 'pencil-fill' : 'plus-circle'} />{editing.chargeId ? 'Edit charge' : 'New charge'}</h3>
                        <div style={styles.formGrid}>
                            <label style={styles.field}>Name<input style={styles.input} value={editing.name} maxLength={80} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Lunch" /></label>
                            {!editing.perSection && (
                                <label style={styles.field}>Amount (KES)<input style={styles.input} inputMode="decimal" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="e.g. 3200" /></label>
                            )}
                            <label style={styles.field}>Charged
                                <select style={styles.input} value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value })}>
                                    <option value="PER_TERM">Each term, to learners who opt in</option>
                                    <option value="ONCE">Once per learner (admission, a trip…)</option>
                                </select>
                            </label>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1F3864', marginBottom: '6px' }}>Applies to</div>
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {sections.map(sec => (
                                <label key={sec} style={styles.check}>
                                    <input type="checkbox" checked={editing.sections.includes(sec)}
                                        onChange={e => setEditing({ ...editing, sections: e.target.checked ? [...editing.sections, sec] : editing.sections.filter(x => x !== sec) })} />
                                    {sectionLabel(sec)}
                                </label>
                            ))}
                        </div>
                        {/* ── money group (for money in & out reports) ── */}
                        {moneyGroups.length > 0 && (
                            <label style={{ ...styles.field, maxWidth: '320px', marginBottom: '10px' }}>Money group (for reports)
                                <select style={styles.input} value={editing.groupId ?? ''} onChange={e => setEditing({ ...editing, groupId: e.target.value })}>
                                    <option value="">{(moneyGroups.find(g => g.feesDefault) || {}).name || 'Fees group'} (default)</option>
                                    {moneyGroups.filter(g => g.active && !g.feesDefault).map(g => <option key={g.groupId} value={String(g.groupId)}>{g.name}</option>)}
                                </select>
                            </label>
                        )}

                        {/* ── price per section (e.g. a trip that costs more for older learners) ── */}
                        <div style={styles.optBox}>
                            <label style={styles.check}>
                                <input type="checkbox" checked={editing.perSection} onChange={e => setEditing({ ...editing, perSection: e.target.checked })} />
                                <strong>Different price for each section</strong>
                            </label>
                            {editing.perSection && (
                                editing.sections.length ? (
                                    <div style={{ ...styles.formGrid, marginTop: '8px', marginBottom: 0 }}>
                                        {editing.sections.map(sec => (
                                            <label key={sec} style={styles.field}>{sectionLabel(sec)} (KES)
                                                <input style={styles.input} inputMode="decimal" value={editing.sectionAmounts[sec] ?? ''}
                                                    onChange={e => setEditing({ ...editing, sectionAmounts: { ...editing.sectionAmounts, [sec]: e.target.value.replace(/[^\d.]/g, '') } })} />
                                            </label>
                                        ))}
                                    </div>
                                ) : <p style={styles.optHint}>Tick the sections above first.</p>
                            )}
                        </div>

                        {/* ── only some classes ── */}
                        <div style={styles.optBox}>
                            <label style={styles.check}>
                                <input type="checkbox" checked={editing.onlyClasses} onChange={e => setEditing({ ...editing, onlyClasses: e.target.checked })} />
                                <strong>Only some classes</strong> <span style={{ color: '#888', fontSize: '12px' }}>(e.g. a Grade 6 trip)</span>
                            </label>
                            {editing.onlyClasses && (
                                <div style={{ display: 'flex', gap: '10px 16px', flexWrap: 'wrap', marginTop: '8px' }}>
                                    {classes.filter(c => editing.sections.includes(c.section)).map(c => (
                                        <label key={c.classId} style={styles.check}>
                                            <input type="checkbox" checked={editing.classIds.includes(Number(c.classId))}
                                                onChange={e => setEditing({ ...editing, classIds: e.target.checked ? [...editing.classIds, Number(c.classId)] : editing.classIds.filter(x => x !== Number(c.classId)) })} />
                                            {classDisplayName(c)}
                                        </label>
                                    ))}
                                    {!classes.some(c => editing.sections.includes(c.section)) && <p style={styles.optHint}>Tick the sections above first.</p>}
                                </div>
                            )}
                        </div>

                        {/* ── teachers ── */}
                        <div style={styles.optBox}>
                            <label style={styles.check}>
                                <input type="checkbox" checked={editing.teacherCanTick} onChange={e => setEditing({ ...editing, teacherCanTick: e.target.checked })} />
                                <strong>Class teachers can tick learners for this</strong>
                            </label>
                            <p style={styles.optHint}>On their Meals &amp; Transport page: own class, current term, no amounts shown. Learners you give a special price stay locked for them.</p>
                        </div>

                        {editing.kind === 'PER_TERM' && (
                            <>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1F3864', marginBottom: '6px' }}>Part-term rates <span style={{ fontWeight: 'normal', color: '#888' }}>(optional — for learners who take it only some months or days)</span></div>
                                <div style={styles.formGrid}>
                                    <label style={styles.field}>Per month (KES)<input style={styles.input} inputMode="decimal" value={editing.monthlyAmount ?? ''} onChange={e => setEditing({ ...editing, monthlyAmount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="leave empty if not offered" /></label>
                                    <label style={styles.field}>Per day (KES)<input style={styles.input} inputMode="decimal" value={editing.dailyAmount ?? ''} onChange={e => setEditing({ ...editing, dailyAmount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="leave empty if not offered" /></label>
                                </div>
                            </>
                        )}
                        {editing.chargeId && (
                            <label style={{ ...styles.check, marginBottom: '12px' }}>
                                <input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                                Active (untick to stop using it; past charges stay)
                            </label>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="submit" style={styles.primaryBtn}><Icon name="save-fill" />Save</button>
                            <button type="button" onClick={() => setEditing(null)} style={styles.secondaryBtn}>Cancel</button>
                        </div>
                        {editing.chargeId && <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>Changing the amount does not change what learners were already charged.</p>}
                    </form>
                ) : !charge ? (
                    <div style={styles.panel}><p style={{ margin: 0, color: '#666' }}><Icon name="arrow-left" />Pick a charge to tick the learners who take it.</p></div>
                ) : (
                    <div style={styles.panel}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                            <div>
                                <h3 style={{ ...styles.h3, margin: 0 }}>{charge.name}{hasSectionPrices(charge) ? '' : ` — ${kes(charge.amount)}`}</h3>
                                {hasSectionPrices(charge) && (
                                    <div style={{ fontSize: '13px', color: '#1F3864', fontWeight: 600 }}>
                                        {Object.entries(charge.sectionAmounts).map(([sec, v]) => `${sectionLabel(sec)} ${money(v)}`).join(' · ')}
                                    </div>
                                )}
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                    {KIND_LABEL[charge.kind]} · {charge.sections.map(sectionLabel).join(', ')}
                                    {charge.monthlyAmount ? ` · ${kes(charge.monthlyAmount)}/month` : ''}{charge.dailyAmount ? ` · ${kes(charge.dailyAmount)}/day` : ''}
                                </div>
                            </div>
                            <button onClick={() => setEditing(chargeToForm(charge))} style={styles.secondaryBtn}><Icon name="pencil-fill" />Edit</button>
                        </div>

                        <div style={{ ...styles.bar, boxShadow: 'none', padding: '0 0 10px', borderBottom: '1px solid #eee', borderRadius: 0 }}>
                            <label style={styles.check}>Term
                                <select style={styles.select} value={termKey} onChange={e => pickTerm(e.target.value)}>
                                    {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </label>
                            <select style={styles.select} value={classId} onChange={e => pickClass(e.target.value)} aria-label="Class">
                                <option value="">All classes</option>
                                {classesForCharge.map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                            </select>
                            <div style={{ ...styles.searchBox, flex: 1, minWidth: '160px' }}>
                                <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                                <input style={styles.searchInput} placeholder="Find learner…" value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
                            <button onClick={() => tickAllShown(true)} style={styles.linkBtn}>Tick all shown</button>
                            <button onClick={() => tickAllShown(false)} style={styles.linkBtn}>Untick all shown</button>
                            {charge.kind === 'PER_TERM' && prevTerm && <button onClick={copyPrevious} style={styles.linkBtn}><Icon name="files" style={{ marginRight: '3px' }} />Copy from {prevTerm.label.replace(' (current)', '')}</button>}
                            <span style={{ marginLeft: 'auto', fontSize: '13px' }}><strong>{ticks.size}</strong> ticked · {kes(tickedTotal)}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px' }}>
                            Ticking charges the full {charge.kind === 'ONCE' ? 'amount' : 'term'}. For part of a term or a different figure, use <strong>Price</strong> on the learner's row.
                        </p>

                        {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading…</p> : (
                            <div style={{ maxHeight: '460px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                                {shown.map((l, i) => {
                                    const on = ticks.has(l.studentId);
                                    const changed = on !== originalTicked.has(l.studentId);
                                    return (
                                        <label key={l.studentId} style={{ ...styles.tickRow, backgroundColor: changed ? '#fff8e1' : on ? '#eef8f0' : i % 2 ? 'white' : '#fafafa', cursor: l.locked ? 'not-allowed' : 'pointer' }}>
                                            <input type="checkbox" checked={on} disabled={l.locked} onChange={() => toggle(l)} style={{ width: '18px', height: '18px' }} />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <strong style={{ color: '#1F3864' }}>{l.name}</strong>
                                                <span style={{ ...styles.adm, marginLeft: '8px' }}>{l.admissionNumber} · {l.className}</span>
                                            </span>
                                            {l.locked && <span style={{ ...styles.pill, backgroundColor: '#e9ecef', color: '#555' }}>charged {l.chargedIn}</span>}
                                            {l.ticked && !l.locked && !changed && (
                                                <span style={{ ...styles.pill, backgroundColor: l.basis && l.basis !== 'TERM' ? '#e8f5e9' : '#f1f3f5', color: '#1F3864', whiteSpace: 'nowrap' }} title={l.priceNote || ''}>
                                                    {money(l.amount)}{l.priceLabel ? ` · ${l.priceLabel.replace(/[()]/g, '')}` : ''}
                                                </span>
                                            )}
                                            {!l.locked && (
                                                <button type="button" disabled={dirty}
                                                    title={dirty ? 'Save or undo your ticks first' : 'Full term, some months, some days, or an agreed amount'}
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!dirty) setPricing(l); }}
                                                    style={{ ...styles.linkBtn, opacity: dirty ? 0.4 : 1, whiteSpace: 'nowrap' }}>
                                                    <Icon name="tag" style={{ marginRight: '3px' }} />Price
                                                </button>
                                            )}
                                            {changed && <span style={{ ...styles.pill, backgroundColor: '#fff3cd', color: '#856404' }}>{on ? 'will charge' : 'will remove'}</span>}
                                        </label>
                                    );
                                })}
                                {!shown.length && <p style={{ padding: '16px', margin: 0, color: '#888', textAlign: 'center' }}>No learners.</p>}
                            </div>
                        )}

                        {pricing && (
                            <PriceEditor
                                title={`${charge.name} — ${pricing.name}`}
                                subtitle={`${year} Term ${term} · ${pricing.className}`}
                                rates={{ term: pricing.standardAmount ?? charge.amount, monthly: charge.monthlyAmount, daily: charge.dailyAmount }}
                                allowParts={charge.kind === 'PER_TERM'}
                                current={pricing.ticked ? { basis: pricing.basis, quantity: pricing.quantity, amount: pricing.amount, note: pricing.priceNote } : null}
                                saveLabel={pricing.ticked ? 'Save price' : 'Charge this learner'}
                                onSave={(p) => savePrice(pricing, p)}
                                onClose={() => setPricing(null)} />
                        )}
                        <div style={styles.secFoot}>
                            <span style={{ fontSize: '13px' }}>{dirty ? <>Charge <strong>{toAdd.length}</strong>, remove <strong>{toRemove.length}</strong></> : 'No unsaved changes'}</span>
                            <button onClick={save} disabled={!dirty || saving} style={{ ...styles.primaryBtn, opacity: !dirty || saving ? 0.55 : 1 }}>
                                <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ══ Billing ════════════════════════════════════════════════════════════════
const BillingTab = ({ termOptions, defaultTerm, setError, flashSuccess }) => {
    const [termKey, setTermKey] = useState('');
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    useEffect(() => { if (!termKey && defaultTerm) setTermKey(defaultTerm); }, [defaultTerm]);
    const [year, term] = termKey.split('|');

    const load = async () => {
        if (!termKey) return;
        setLoading(true);
        try { const r = await api.get('/api/finance/billing/preview', { params: { yearLabel: year, term } }); setPreview(r.data); }
        catch (err) { setError(serverMessage(err, 'Failed to prepare billing.')); }
        setLoading(false);
    };
    useEffect(() => { load(); }, [termKey]);

    const toBill = preview ? preview.sections.reduce((n, s) => n + s.toBill, 0) : 0;
    const amount = preview ? preview.sections.reduce((n, s) => n + s.toBill * (Number(s.feeTotal) || 0), 0) : 0;

    const run = async () => {
        if (!toBill) return;
        if (!window.confirm(`Bill ${toBill} learner(s) for ${year} Term ${term}?\n\nTotal to be charged: ${kes(amount)}\n\nLearners already billed for this term are skipped.`)) return;
        setRunning(true); setError('');
        try {
            const r = await api.post('/api/finance/billing/run', null, { params: { yearLabel: year, term } });
            flashSuccess(`${r.data.message} Total charged: ${kes(r.data.createdTotal)}.`);
            setPreview(r.data);
        } catch (err) { setError(serverMessage(err, 'Billing failed. Nothing was charged.')); }
        setRunning(false);
    };

    if (!termOptions.length) return <div style={styles.panel}><p style={{ margin: 0, color: '#666' }}>No terms found. Add terms on the Academic Years page first.</p></div>;

    return (
        <div>
            <div style={styles.bar}>
                <label style={styles.check}>Term
                    <select style={styles.select} value={termKey} onChange={e => setTermKey(e.target.value)}>
                        {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </label>
                <button onClick={load} style={styles.secondaryBtn}><Icon name="arrow-repeat" />Refresh</button>
            </div>
            {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Checking…</p> : preview && (
                <div style={styles.panel}>
                    <table style={styles.table}>
                        <thead><tr>
                            <th style={styles.th}>Section</th><th style={styles.thNum}>Fees per learner</th><th style={styles.thNum}>Learners</th>
                            <th style={styles.thNum}>Already billed</th><th style={styles.thNum}>To bill now</th>
                        </tr></thead>
                        <tbody>
                            {preview.sections.filter(s => s.learners > 0 || s.hasFees).map((s, i) => (
                                <tr key={s.section} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                    <td style={styles.td}><strong>{sectionLabel(s.section)}</strong></td>
                                    <td style={styles.tdNum}>{s.hasFees ? money(s.feeTotal) : <span style={{ color: '#b26a00', fontWeight: 600 }}>Not set</span>}</td>
                                    <td style={styles.tdNum}>{s.learners}</td>
                                    <td style={styles.tdNum}>{s.alreadyBilled}</td>
                                    <td style={{ ...styles.tdNum, fontWeight: 700 }}>{s.toBill}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {preview.sections.some(s => !s.hasFees && s.learners - s.alreadyBilled > 0) && (
                        <p style={styles.warn}><Icon name="exclamation-circle-fill" />Sections marked "Not set" won't be billed. Set their fees on the Fee Structures tab first.</p>
                    )}
                    {preview.learnersWithoutClass > 0 && (
                        <p style={styles.warn}><Icon name="exclamation-circle-fill" />{preview.learnersWithoutClass} learner(s) have no class and won't be billed.</p>
                    )}
                    <div style={styles.secFoot}>
                        <span>{toBill ? <>Will charge <strong>{toBill}</strong> learner(s), <strong>{kes(amount)}</strong> in total.</> : 'Everyone with fees set is already billed for this term.'}</span>
                        <button onClick={run} disabled={!toBill || running} style={{ ...styles.primaryBtn, opacity: !toBill || running ? 0.55 : 1 }}>
                            <Icon name={running ? 'hourglass-split' : 'receipt-cutoff'} />{running ? 'Billing…' : `Bill ${year} Term ${term}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    subTabs: { display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid #dde3ec', marginBottom: '14px' },
    subTab: { background: 'none', border: 'none', borderBottom: '3px solid transparent', padding: '8px 12px', cursor: 'pointer', fontSize: '14px' },
    optBox: { border: '1px solid #e3e7ee', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', backgroundColor: '#fafbfd' },
    optHint: { fontSize: '12px', color: '#666', margin: '6px 0 0 24px' },
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' },
    layoutRow: { display: 'flex', flex: 1 },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: '0 0 18px 0', fontSize: '14px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'flex-start' },
    dismissBtn: { marginLeft: '8px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    tabs: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
    tab: { border: '2px solid #1F3864', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    bar: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'white', padding: '12px 16px', borderRadius: '12px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    select: { padding: '9px 10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    searchBox: { display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    dropdown: { position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', marginTop: '4px', overflow: 'hidden' },
    dropItem: { display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid #f0f0f0', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#333' },
    dateInput: { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' },
    card: { backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', borderTop: '4px solid', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    cardNum: { fontSize: '18px', fontWeight: 800, color: '#1F3864' },
    cardLbl: { fontSize: '12px', color: '#666', marginTop: '2px' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },
    panel: { backgroundColor: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '14px' },
    h3: { color: '#1F3864', fontSize: '15px', margin: '0 0 10px 0', display: 'flex', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap' },
    thNum: { backgroundColor: '#1F3864', color: 'white', padding: '10px 12px', textAlign: 'right', fontSize: '12px', whiteSpace: 'nowrap' },
    td: { padding: '9px 12px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' },
    tdNum: { padding: '9px 12px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
    adm: { fontSize: '11px', color: '#888', fontFamily: 'monospace' },
    creditTag: { marginLeft: '6px', backgroundColor: '#d4edda', color: '#155724', fontSize: '10px', padding: '1px 6px', borderRadius: '6px' },
    smallBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px', display: 'inline-flex', alignItems: 'center' },
    secondaryBtn: { backgroundColor: 'white', color: '#1F3864', border: '2px solid #1F3864', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'inline-flex', alignItems: 'center' },
    primaryBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'inline-flex', alignItems: 'center' },
    linkBtn: { background: 'none', border: 'none', color: '#2E75B6', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', padding: 0, display: 'inline-flex', alignItems: 'center' },
    learnerCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: '#f7fbff', border: '1px solid #d6e6f5', borderRadius: '10px', padding: '12px 14px', marginTop: '12px' },
    methodRow: { display: 'inline-flex', border: '2px solid #1F3864', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' },
    methodBtn: { border: 'none', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' },
    field: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white', minWidth: 0 },
    receiptBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: '#e8f5e9', border: '1px solid #b7dfc0', borderRadius: '10px', padding: '12px 14px', marginTop: '16px' },
    secGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' },
    secCard: { backgroundColor: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    secHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    pill: { padding: '2px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' },
    itemRow: { display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' },
    iconBtn: { background: 'none', border: '1px solid #ddd', color: '#dc3545', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer' },
    secFoot: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '6px' },
    extrasLayout: { display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start' },
    chargeItem: { display: 'block', width: '100%', border: '2px solid #eee', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' },
    tickRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    warn: { color: '#856404', backgroundColor: '#fff8e1', border: '1px solid #ffc107', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', margin: '10px 0 0' },
};

export default Finance;
