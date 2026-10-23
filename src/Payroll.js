import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useTabParam } from '../utils/useTabParam';
import { openPayrollPrint, PAYSLIP_CSS, SUMMARY_CSS, payslipsHtml, summaryHtml, paymentListHtml, money } from '../utils/payrollPrint';
import { hasRole } from '../utils/roles';

/**
 * Payroll (admin and bursar only)
 *   Pay runs — one per month: Draft → Approved → Paid (paid = recorded as an expense)
 *   Staff    — who is paid, basic pay, regular allowances/deductions, with a live net-pay preview
 *   Rates    — PAYE bands, relief, NSSF, SHIF, Housing Levy (change when KRA/NSSF/SHA change them)
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 400) return d; return d?.message || d?.error || fallback; };
const n = (v) => Number(v || 0);
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const STATUS = { DRAFT: ['Draft', '#fd7e14'], APPROVED: ['Approved', '#2E75B6'], PAID: ['Paid', '#28a745'] };
const CATEGORY = { TEACHING: 'Teaching', SUPPORT: 'Support', ADMINISTRATION: 'Administration' };
const METHOD = { BANK: 'Bank', MPESA: 'M-Pesa', CASH: 'Cash', CHEQUE: 'Cheque' };
const TAB_NAMES = { runs: 'Pay runs', staff: 'Staff', rates: 'Rates' };
const isAmount = (s) => /^\d{1,9}(\.\d{1,2})?$/.test(String(s ?? '').trim());

function Payroll() {
    const [tab, setTab] = useTabParam('runs', TAB_NAMES);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const flash = useCallback((m) => { setSuccess(m); setTimeout(() => setSuccess(''), 4500); }, []);
    const blocked = () => setError('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    return (
        <div style={st.container}>
            <Navbar />
            <div style={st.layoutRow}>
                <Sidebar />
                <div style={st.content}>
                    <h2 style={st.title}><Icon name="person-vcard-fill" style={{ marginRight: '10px' }} />Payroll</h2>
                    <p style={st.subtitle}>Staff pay, payslips and statutory deductions (PAYE, NSSF, SHIF, Housing Levy).</p>
                    {error && <div style={st.error} role="alert"><Icon name="exclamation-triangle-fill" /><span style={{ flex: 1, whiteSpace: 'pre-line' }}>{error}</span><button onClick={() => setError('')} style={st.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button></div>}
                    {success && <p style={st.success}><Icon name="check-circle-fill" />{success}</p>}
                    <div style={st.tabs} role="tablist">
                        {[['runs', 'calendar2-month-fill', 'Pay runs'], ['staff', 'people-fill', 'Staff'], ['rates', 'percent', 'Rates']].map(([k, ic, l]) => (
                            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setError(''); setTab(k); }}
                                style={{ ...st.tab, backgroundColor: tab === k ? '#1F3864' : 'white', color: tab === k ? 'white' : '#1F3864' }}><Icon name={ic} />{l}</button>
                        ))}
                    </div>
                    {tab === 'runs' && <RunsTab setError={setError} flash={flash} blocked={blocked} />}
                    {tab === 'staff' && <StaffTab setError={setError} flash={flash} />}
                    {tab === 'rates' && <RatesTab setError={setError} flash={flash} />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

// ══ Pay runs ═════════════════════════════════════════════════════════════════
function RunsTab({ setError, flash, blocked }) {
    const [runs, setRuns] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [run, setRun] = useState(null);
    const [period, setPeriod] = useState(thisMonth());
    const [busy, setBusy] = useState('');
    const [adjusting, setAdjusting] = useState(null);   // payslip being given this month's items
    const [paying, setPaying] = useState(null);         // pay form
    const [groups, setGroups] = useState([]);
    const [terms, setTerms] = useState([]);

    const loadRuns = useCallback(() => api.get('/api/payroll/runs').then(r => setRuns(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load pay runs.'))), [setError]);
    const loadRun = useCallback((id) => api.get(`/api/payroll/runs/${id}`).then(r => setRun(r.data)).catch(err => setError(serverMessage(err, 'Could not load the pay run.'))), [setError]);
    useEffect(() => { loadRuns(); }, [loadRuns]);
    useEffect(() => { if (openId) loadRun(openId); else setRun(null); }, [openId, loadRun]);

    const act = async (key, fn, after) => {
        setBusy(key); setError('');
        try { const r = await fn(); flash(r.data.message); if (after) await after(r.data); }
        catch (err) { setError(serverMessage(err, 'That did not work.')); }
        setBusy('');
    };
    const create = () => act('create', () => api.post('/api/payroll/runs', { period }), async (d) => { await loadRuns(); setOpenId(d.runId); });
    const refresh = async () => { await loadRuns(); if (openId) await loadRun(openId); };

    const openPay = async () => {
        try {
            const [g, y] = await Promise.all([api.get('/api/finance/groups'), api.get('/api/academic-years')]);
            const gs = (g.data.groups || []).filter(x => x.active);
            setGroups(gs);
            const ys = (y.data || []).map(x => ({ key: `${x.yearLabel}|${x.term}`, label: `${x.yearLabel} Term ${x.term}`, active: x.isActive ?? x.active }));
            setTerms(ys);
            const salaries = gs.find(x => /salar|staff|payroll|general/i.test(x.name)) || gs[0];
            setPaying({ paidOn: today(), groupId: salaries ? String(salaries.groupId) : '', termKey: (ys.find(x => x.active) || ys[0] || {}).key || '', method: 'BANK', reference: '' });
        } catch (err) { setError(serverMessage(err, 'Could not load money groups and terms.')); }
    };
    const markPaid = () => {
        const [yearLabel, term] = String(paying.termKey).split('|');
        if (!paying.groupId || !yearLabel) { setError('Choose the money group and the term.'); return; }
        act('paid', () => api.post(`/api/payroll/runs/${run.runId}/paid`, { paidOn: paying.paidOn, groupId: Number(paying.groupId), yearLabel, term: Number(term), method: paying.method, reference: paying.reference }),
            async () => { setPaying(null); await refresh(); });
    };

    // The bank's salary upload file (the bank's own Excel layout)
    const bankFile = async () => {
        try {
            const c = (await api.get(`/api/payroll/runs/${run.runId}/bank-file/check`)).data;
            if (!c.debitAccount) { setError("Enter the school's bank account number first: Payroll → Rates → Bank upload file."); return; }
            const lines = [`${c.rows} staff paid by bank — KES ${money(n(c.total))} from account ${c.debitAccount}.`];
            if (c.missing.length) lines.push('', 'LEFT OUT until fixed on the Staff tab:', ...c.missing.map(x => `• ${x}`));
            if (c.notInFile.length) lines.push('', 'Not in the bank file (paid another way):', ...c.notInFile.map(x => `• ${x}`));
            if (!window.confirm([...lines, '', 'Download the bank file?'].join('\n'))) return;
            const r = await api.get(`/api/payroll/runs/${run.runId}/bank-file`, { responseType: 'blob' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = `Salaries ${run.label}.xlsx`;
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } catch (err) {
            let msg = serverMessage(err, 'Could not make the bank file.');
            if (err?.response?.data instanceof Blob) { try { const t = JSON.parse(await err.response.data.text()); msg = t.message || msg; } catch (e) { /* keep */ } }
            setError(msg);
        }
    };

    const csv = () => {
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const head = ['Staff no', 'Name', 'Position', 'KRA PIN', 'NSSF no', 'SHA no', 'Basic', 'Gross', 'Taxable pay', 'NSSF', 'SHIF', 'Housing Levy', 'PAYE', 'Other deductions', 'Net pay', 'Employer NSSF', 'Employer Housing Levy', 'Paid by', 'Bank', 'Account', 'Phone'];
        const rows = run.payslips.map(p => [p.staffNumber, p.fullName, p.jobTitle, p.kraPin, p.nssfNumber, p.shaNumber, n(p.basic), n(p.gross), n(p.taxablePay), n(p.nssf), n(p.shif), n(p.housingLevy), n(p.paye), n(p.otherDeductions), n(p.net), n(p.employerNssf), n(p.employerHousing), METHOD[p.payMethod], p.bankName, p.accountNumber, p.phone].map(q).join(','));
        const blob = new Blob(['\uFEFF' + [head.map(q).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Payroll ${run.label}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    if (openId && run) {
        const [sl, sc] = STATUS[run.status] || [run.status, '#666'];
        const draft = run.status === 'DRAFT';
        return (
            <div>
                <div style={st.panel}>
                    <div style={st.bar}>
                        <button onClick={() => setOpenId(null)} style={st.link}><Icon name="arrow-left" />All pay runs</button>
                        <h3 style={{ ...st.h3, margin: 0 }}>{run.label}</h3>
                        <span style={{ ...st.pill, backgroundColor: sc }}>{sl}</span>
                        {run.expenseId ? <span style={{ ...st.pill, backgroundColor: '#1e7e34' }}><Icon name="journal-check" />In the books: expense recorded {run.paidOn}</span>
                            : run.paidOn && <span style={st.muted}>paid {run.paidOn}</span>}
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {draft && <button disabled={!!busy} onClick={() => act('recalc', () => api.post(`/api/payroll/runs/${run.runId}/recalculate`), refresh)} style={st.secondary} title="Use the current staff details and rates"><Icon name="arrow-repeat" />Recalculate</button>}
                            {draft && <button disabled={!!busy} onClick={() => { if (window.confirm(`Delete the draft pay run for ${run.label}?`)) act('del', () => api.delete(`/api/payroll/runs/${run.runId}`), async () => { setOpenId(null); await loadRuns(); }); }} style={{ ...st.secondary, color: '#b02a37', borderColor: '#b02a37' }}><Icon name="trash" />Delete</button>}
                            {draft && (!run.treasurerApproval || hasRole('TREASURER')) && <button disabled={!!busy} onClick={() => { if (window.confirm(`Approve ${run.label}? It will be locked (it can be reopened until it is paid).`)) act('approve', () => api.post(`/api/payroll/runs/${run.runId}/approve`), refresh); }} style={st.primary}><Icon name="check2-circle" />Approve</button>}
                            {draft && run.treasurerApproval && !hasRole('TREASURER') && <span style={{ ...st.pill, backgroundColor: '#b8860b' }}><Icon name="hourglass-split" />Waiting for the treasurer to approve</span>}
                            {run.status === 'APPROVED' && <button disabled={!!busy} onClick={() => { if (window.confirm(`Reopen ${run.label} for changes?${run.expenseId ? '\n\nIts salary expense will be voided (taken out of the books) until it is approved again.' : ''}`)) act('reopen', () => api.post(`/api/payroll/runs/${run.runId}/reopen`), refresh); }} style={st.secondary}><Icon name="unlock" />Reopen</button>}
                            {run.status === 'APPROVED' && !run.expenseId && <button disabled={!!busy} onClick={openPay} style={st.primary}><Icon name="cash-coin" />Mark as paid</button>}
                        </span>
                    </div>
                    <div style={st.cards}>
                        {[['Gross pay', run.totalGross, '#1F3864'], ['PAYE', run.totalPaye, '#b02a37'], ['NSSF', run.totalNssf, '#6f42c1'], ['SHIF', run.totalShif, '#17a2b8'],
                          ['Housing Levy', run.totalHousing, '#fd7e14'], ['Other deductions', run.totalOtherDeductions, '#6c757d'], ['Net pay', run.totalNet, '#28a745'], ['Cost to school', run.totalEmployerCost, '#343a40']].map(([l, v, c]) => (
                            <div key={l} style={{ ...st.card, borderTopColor: c }}><b>{money(v)}</b><span>{l}</span></div>
                        ))}
                    </div>
                    <div style={st.bar}>
                        <button onClick={() => openPayrollPrint(`Payslips — ${run.label}`, payslipsHtml(run.payslips, run.label), PAYSLIP_CSS, false, blocked)} style={st.secondary}><Icon name="printer-fill" />Payslips</button>
                        <button onClick={() => openPayrollPrint(`Payroll summary — ${run.label}`, summaryHtml(run), SUMMARY_CSS, true, blocked)} style={st.secondary}><Icon name="table" />Summary &amp; remittances</button>
                        <button onClick={() => openPayrollPrint(`Payment list — ${run.label}`, paymentListHtml(run), SUMMARY_CSS, false, blocked)} style={st.secondary}><Icon name="bank" />Payment list</button>
                        <button onClick={csv} style={st.secondary}><Icon name="file-earmark-spreadsheet" />Excel</button>
                        {!draft && <button onClick={bankFile} style={st.secondary} title="The bank's salary upload file"><Icon name="bank2" />Bank file (Excel)</button>}
                        {draft && <span style={st.muted}>Draft: check each person, add this month's overtime or advances, then approve. Approving records the salaries as an expense automatically.</span>}
                    </div>
                </div>

                <div style={{ ...st.panel, overflowX: 'auto' }}>
                    <table style={st.table}>
                        <thead><tr>{['Staff', 'Gross', 'NSSF', 'SHIF', 'Housing', 'PAYE', 'Other', 'Net pay', ''].map((h, i) => <th key={h + i} style={i && i < 8 ? st.thN : st.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {run.payslips.map((p, i) => (
                                <tr key={p.payslipId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                    <td style={st.td}><strong>{p.fullName}</strong><div style={st.small}>{p.staffNumber} · {p.jobTitle || CATEGORY[p.category]} · {METHOD[p.payMethod]}</div>
                                        {(p.adjustments || []).length > 0 && <div style={{ ...st.small, color: '#1F3864' }}>This month: {p.adjustments.map(a => `${a.kind === 'EARNING' ? '+' : '−'}${a.name} ${money(a.amount)}`).join(', ')}</div>}</td>
                                    <td style={st.tdN}>{money(p.gross)}</td><td style={st.tdN}>{money(p.nssf)}</td><td style={st.tdN}>{money(p.shif)}</td><td style={st.tdN}>{money(p.housingLevy)}</td>
                                    <td style={st.tdN}>{money(p.paye)}</td><td style={st.tdN}>{money(p.otherDeductions)}</td><td style={{ ...st.tdN, fontWeight: 800, color: '#1e7e34' }}>{money(p.net)}</td>
                                    <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                        {draft && <button onClick={() => setAdjusting({ payslip: p, items: (p.adjustments || []).map(a => ({ ...a, amount: String(a.amount) })) })} style={st.link} title="Overtime, an advance… for this month only"><Icon name="plus-slash-minus" />This month</button>}
                                        <button onClick={() => openPayrollPrint(`Payslip — ${p.fullName}`, payslipsHtml([p], run.label), PAYSLIP_CSS, false, blocked)} style={st.link} title="Print this payslip"><i className="bi bi-printer" aria-label="Print payslip" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {adjusting && (
                    <Modal title={`This month only — ${adjusting.payslip.fullName}`} onClose={() => setAdjusting(null)}>
                        <p style={st.small}>Extra pay or deductions for {run.label} only (overtime, a one-off bonus, a salary advance…). Regular items are set on the Staff tab.</p>
                        <ItemsEditor items={adjusting.items} onChange={(items) => setAdjusting(a => ({ ...a, items }))} />
                        <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '12px' }}>
                            <button onClick={() => setAdjusting(null)} style={st.secondary}>Cancel</button>
                            <button disabled={!!busy} onClick={() => {
                                const bad = adjusting.items.find(i => !String(i.name || '').trim() || !isAmount(i.amount) || !n(i.amount));
                                if (bad) { setError('Every item needs a name and an amount.'); return; }
                                act('adj', () => api.put(`/api/payroll/payslips/${adjusting.payslip.payslipId}/adjustments`, adjusting.items.map(i => ({ ...i, amount: String(i.amount).trim() }))), async () => { setAdjusting(null); await refresh(); });
                            }} style={st.primary}><Icon name="save-fill" />Save</button>
                        </div>
                    </Modal>
                )}

                {paying && (
                    <Modal title={`Mark ${run.label} as paid`} onClose={() => setPaying(null)}>
                        <p style={st.small}>Records the month's cost to the school — <b>KES {money(run.totalEmployerCost)}</b> (gross pay + employer NSSF + employer Housing Levy) — as an expense, so it appears in Money In &amp; Out.</p>
                        <div style={st.grid}>
                            <label style={st.lbl}>Date paid<input type="date" style={st.input} value={paying.paidOn} max={today()} onChange={e => setPaying(p => ({ ...p, paidOn: e.target.value }))} /></label>
                            <label style={st.lbl}>Term<select style={st.input} value={paying.termKey} onChange={e => setPaying(p => ({ ...p, termKey: e.target.value }))}>{terms.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
                            <label style={st.lbl}>Money group<select style={st.input} value={paying.groupId} onChange={e => setPaying(p => ({ ...p, groupId: e.target.value }))}>{groups.map(g => <option key={g.groupId} value={String(g.groupId)}>{g.name}</option>)}</select></label>
                            <label style={st.lbl}>Paid by<select style={st.input} value={paying.method} onChange={e => setPaying(p => ({ ...p, method: e.target.value }))}>{Object.entries(METHOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                            <label style={st.lbl}>Reference (optional)<input style={st.input} maxLength={60} value={paying.reference} placeholder={`PAYROLL ${run.period}`} onChange={e => setPaying(p => ({ ...p, reference: e.target.value }))} /></label>
                        </div>
                        <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '12px' }}>
                            <button onClick={() => setPaying(null)} style={st.secondary}>Cancel</button>
                            <button disabled={!!busy} onClick={markPaid} style={st.primary}><Icon name="cash-coin" />Mark as paid</button>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    return (
        <div>
            <div style={{ ...st.panel, ...st.bar }}>
                <label style={st.lbl}>Month<input type="month" style={st.input} value={period} onChange={e => setPeriod(e.target.value)} /></label>
                <button disabled={!!busy || !period} onClick={create} style={{ ...st.primary, alignSelf: 'flex-end' }}><Icon name="plus-circle-fill" />New pay run</button>
                <span style={{ ...st.muted, alignSelf: 'flex-end' }}>Creates a draft payslip for every active staff member, using the current rates.</span>
            </div>
            {!runs ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : !runs.length ? (
                <div style={st.panel}><p style={{ margin: 0, color: '#666' }}>No pay runs yet. Add your staff on the Staff tab, then create the first month here.</p></div>
            ) : (
                <div style={{ ...st.panel, overflowX: 'auto' }}>
                    <table style={st.table}>
                        <thead><tr>{['Month', 'Status', 'Staff', 'Gross', 'Net pay', 'Cost to school', ''].map((h, i) => <th key={h + i} style={i >= 3 && i <= 5 ? st.thN : st.th}>{h}</th>)}</tr></thead>
                        <tbody>{runs.map((r, i) => { const [l, c] = STATUS[r.status] || [r.status, '#666']; return (
                            <tr key={r.runId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa', cursor: 'pointer' }} onClick={() => setOpenId(r.runId)}>
                                <td style={st.td}><strong>{r.label}</strong></td><td style={st.td}><span style={{ ...st.pill, backgroundColor: c }}>{l}</span></td><td style={st.td}>{r.staffCount}</td>
                                <td style={st.tdN}>{money(r.totalGross)}</td><td style={{ ...st.tdN, fontWeight: 700 }}>{money(r.totalNet)}</td><td style={st.tdN}>{money(r.totalEmployerCost)}</td>
                                <td style={st.td}><button style={st.link}>Open <i className="bi bi-chevron-right" aria-hidden="true" /></button></td>
                            </tr>); })}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ══ Staff ════════════════════════════════════════════════════════════════════
const EMPTY_STAFF = { staffId: null, staffNumber: '', fullName: '', jobTitle: '', category: 'TEACHING', teacherId: '', phone: '', kraPin: '', nssfNumber: '', shaNumber: '',
    payMethod: 'BANK', bankName: '', bankBranch: '', accountNumber: '', bankCode: '', basicSalary: '', statutory: true, active: true, startDate: '', notes: '', items: [] };

function StaffTab({ setError, flash }) {
    const [staff, setStaff] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [form, setForm] = useState(null);
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [saving, setSaving] = useState(false);
    const load = useCallback(() => api.get('/api/payroll/staff').then(r => setStaff(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load staff.'))), [setError]);
    useEffect(() => { load(); api.get('/api/teachers').then(r => setTeachers(r.data || [])).catch(() => {}); }, [load]);

    const save = async (e) => {
        e.preventDefault();
        if (!isAmount(form.basicSalary)) { setError('Enter the basic salary (numbers only).'); return; }
        const bad = form.items.find(i => !String(i.name || '').trim() || !isAmount(i.amount) || !n(i.amount));
        if (bad) { setError('Every allowance and deduction needs a name and an amount.'); return; }
        setSaving(true); setError('');
        try {
            const r = await api.put('/api/payroll/staff', { ...form, teacherId: form.teacherId ? Number(form.teacherId) : null, startDate: form.startDate || null,
                basicSalary: String(form.basicSalary).trim(), items: form.items.map(i => ({ ...i, amount: String(i.amount).trim() })) });
            flash(r.data.message); setForm(null); await load();
        } catch (err) { setError(serverMessage(err, 'Could not save.')); }
        setSaving(false);
    };

    const q = search.trim().toLowerCase();
    const shown = (staff || []).filter(s => (showInactive || s.active) && (!q || `${s.fullName} ${s.staffNumber} ${s.jobTitle}`.toLowerCase().includes(q)));
    const monthly = (staff || []).filter(s => s.active).reduce((a, s) => a + n(s.basicSalary), 0);

    if (form) return <StaffForm form={form} setForm={setForm} teachers={teachers} save={save} saving={saving} setError={setError} />;
    return (
        <div>
            <div style={{ ...st.panel, ...st.bar }}>
                <button onClick={() => setForm({ ...EMPTY_STAFF })} style={st.primary}><Icon name="person-plus-fill" />Add staff member</button>
                <input style={{ ...st.input, flex: 1, minWidth: '180px' }} placeholder="Find by name, number or position…" value={search} onChange={e => setSearch(e.target.value)} />
                <label style={st.check}><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Show people who have left</label>
                {staff && <span style={st.muted}>{staff.filter(s => s.active).length} active · basic pay {money(monthly)} a month</span>}
            </div>
            {!staff ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : (
                <div style={{ ...st.panel, overflowX: 'auto' }}>
                    <table style={st.table}>
                        <thead><tr>{['No', 'Name', 'Position', 'Basic', 'Allowances', 'Deductions', 'Paid by', ''].map((h, i) => <th key={h + i} style={i >= 3 && i <= 5 ? st.thN : st.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {shown.map((s, i) => (
                                <tr key={s.staffId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa', opacity: s.active ? 1 : 0.5 }}>
                                    <td style={st.td}>{s.staffNumber}</td>
                                    <td style={st.td}><strong>{s.fullName}</strong>{!s.statutory && <div style={{ ...st.small, color: '#856404' }}>no NSSF / SHIF / Housing Levy</div>}{!s.active && <div style={st.small}>left</div>}</td>
                                    <td style={st.td}>{s.jobTitle || '—'}<div style={st.small}>{CATEGORY[s.category]}</div></td>
                                    <td style={st.tdN}>{money(s.basicSalary)}</td>
                                    <td style={st.tdN}>{money(s.items.filter(x => x.kind === 'EARNING').reduce((a, x) => a + n(x.amount), 0))}</td>
                                    <td style={st.tdN}>{money(s.items.filter(x => x.kind === 'DEDUCTION').reduce((a, x) => a + n(x.amount), 0))}</td>
                                    <td style={st.td}>{METHOD[s.payMethod]}<div style={st.small}>{s.payMethod === 'BANK' ? `${s.bankName || ''} ${s.accountNumber || ''}` : s.payMethod === 'MPESA' ? s.phone : ''}</div></td>
                                    <td style={st.td}><button onClick={() => setForm({ ...EMPTY_STAFF, ...s, teacherId: s.teacherId ?? '', basicSalary: String(n(s.basicSalary)), startDate: s.startDate || '',
                                        items: s.items.map(x => ({ ...x, amount: String(n(x.amount)) })) })} style={st.link}><Icon name="pencil" />Edit</button></td>
                                </tr>
                            ))}
                            {!shown.length && <tr><td colSpan={8} style={{ ...st.td, textAlign: 'center', color: '#888', padding: '20px' }}>{staff.length ? 'Nobody matches.' : 'No staff yet — add the first person.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function StaffForm({ form, setForm, teachers, save, saving }) {
    const [preview, setPreview] = useState(null);
    const timer = useRef(null);
    const set = (patch) => setForm(f => ({ ...f, ...patch }));
    // Live net-pay preview (server works it out with the current rates)
    useEffect(() => {
        clearTimeout(timer.current);
        if (!isAmount(form.basicSalary)) { setPreview(null); return undefined; }
        const items = form.items.filter(i => String(i.name || '').trim() && isAmount(i.amount) && n(i.amount));
        timer.current = setTimeout(() => {
            api.post('/api/payroll/preview', { basicSalary: String(form.basicSalary).trim(), statutory: form.statutory, items: items.map(i => ({ ...i, amount: String(i.amount).trim() })) })
                .then(r => setPreview(r.data)).catch(() => setPreview(null));
        }, 350);
        return () => clearTimeout(timer.current);
    }, [form.basicSalary, form.statutory, form.items]);
    const pickTeacher = (id) => {
        const t = teachers.find(x => String(x.teacherId) === String(id));
        set({ teacherId: id, ...(t && !form.fullName ? { fullName: `${t.firstName || ''} ${t.lastName || ''}`.trim().toUpperCase(), jobTitle: form.jobTitle || 'Teacher', phone: form.phone || t.phone || '' } : {}) });
    };
    return (
        <form onSubmit={save} style={st.twoCol}>
            <div style={st.panel}>
                <h3 style={st.h3}>{form.staffId ? `Edit — ${form.fullName}` : 'Add staff member'}</h3>
                <div style={st.grid}>
                    <label style={st.lbl}>Staff number<input style={st.input} maxLength={20} value={form.staffNumber} onChange={e => set({ staffNumber: e.target.value.toUpperCase() })} required /></label>
                    <label style={st.lbl}>Teacher record (optional)<select style={st.input} value={form.teacherId} onChange={e => pickTeacher(e.target.value)}>
                        <option value="">— not a teacher / not linked —</option>
                        {teachers.map(t => <option key={t.teacherId} value={String(t.teacherId)}>{`${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>)}
                    </select></label>
                    <label style={{ ...st.lbl, gridColumn: 'span 2' }}>Full name<input style={{ ...st.input, textTransform: 'uppercase' }} maxLength={100} value={form.fullName} onChange={e => set({ fullName: e.target.value.toUpperCase() })} required /></label>
                    <label style={st.lbl}>Position<input style={st.input} maxLength={60} value={form.jobTitle || ''} placeholder="Teacher, Cook, Driver…" onChange={e => set({ jobTitle: e.target.value })} /></label>
                    <label style={st.lbl}>Category<select style={st.input} value={form.category} onChange={e => set({ category: e.target.value })}>{Object.entries(CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                    <label style={st.lbl}>KRA PIN<input style={{ ...st.input, textTransform: 'uppercase' }} maxLength={20} value={form.kraPin || ''} onChange={e => set({ kraPin: e.target.value.toUpperCase() })} /></label>
                    <label style={st.lbl}>NSSF number<input style={st.input} maxLength={20} value={form.nssfNumber || ''} onChange={e => set({ nssfNumber: e.target.value })} /></label>
                    <label style={st.lbl}>SHA number<input style={st.input} maxLength={20} value={form.shaNumber || ''} onChange={e => set({ shaNumber: e.target.value })} /></label>
                    <label style={st.lbl}>Phone{form.payMethod === 'MPESA' && ' (M-Pesa)'}<input style={st.input} maxLength={20} value={form.phone || ''} onChange={e => set({ phone: e.target.value })} /></label>
                    <label style={st.lbl}>Paid by<select style={st.input} value={form.payMethod} onChange={e => set({ payMethod: e.target.value })}>{Object.entries(METHOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                    {form.payMethod === 'BANK' && <>
                        <label style={st.lbl}>Bank<input style={st.input} maxLength={60} value={form.bankName || ''} onChange={e => set({ bankName: e.target.value })} /></label>
                        <label style={st.lbl}>Branch<input style={st.input} maxLength={60} value={form.bankBranch || ''} onChange={e => set({ bankBranch: e.target.value })} /></label>
                        <label style={st.lbl}>Account number<input style={st.input} maxLength={40} value={form.accountNumber || ''} onChange={e => set({ accountNumber: e.target.value.replace(/\s/g, '') })} /></label>
                        <label style={st.lbl}>Bank code (for the bank file)<input style={{ ...st.input, textTransform: 'uppercase' }} maxLength={20} value={form.bankCode || ''} placeholder="e.g. 01 for KCB" onChange={e => set({ bankCode: e.target.value.toUpperCase() })} /></label>
                    </>}
                    <label style={st.lbl}>Basic salary (KES a month)<input style={{ ...st.input, fontWeight: 700 }} inputMode="decimal" value={form.basicSalary} onChange={e => set({ basicSalary: e.target.value.replace(/[^\d.]/g, '') })} required /></label>
                    <label style={st.lbl}>Started on<input type="date" style={st.input} value={form.startDate || ''} onChange={e => set({ startDate: e.target.value })} /></label>
                </div>
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', margin: '10px 0' }}>
                    <label style={st.check}><input type="checkbox" checked={form.statutory} onChange={e => set({ statutory: e.target.checked })} />NSSF, SHIF and Housing Levy apply</label>
                    <label style={st.check}><input type="checkbox" checked={form.active} onChange={e => set({ active: e.target.checked })} />Still working here (untick when they leave)</label>
                </div>
                <h4 style={st.h4}>Regular allowances and deductions (every month)</h4>
                <ItemsEditor items={form.items} onChange={(items) => set({ items })} />
                <label style={{ ...st.lbl, marginTop: '10px' }}>Notes<input style={st.input} maxLength={200} value={form.notes || ''} onChange={e => set({ notes: e.target.value })} /></label>
                <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button type="button" onClick={() => setForm(null)} style={st.secondary}>Cancel</button>
                    <button type="submit" disabled={saving} style={st.primary}><Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
            <div style={{ ...st.panel, position: 'sticky', top: '84px', alignSelf: 'start' }}>
                <h4 style={st.h4}><Icon name="calculator" />Monthly pay (current rates)</h4>
                {!preview ? <p style={st.muted}>Enter the basic salary to see the pay.</p> : (
                    <table style={{ width: '100%', fontSize: '13px' }}><tbody>
                        {[['Gross pay', preview.gross, true], ['NSSF', -preview.nssf], ['SHIF', -preview.shif], ['Housing Levy', -preview.housingLevy],
                          ['PAYE', -preview.paye], ['Other deductions', -preview.otherDeductions]].map(([l, v, bold]) => (
                            <tr key={l}><td style={{ padding: '3px 0', fontWeight: bold ? 700 : 400 }}>{l}</td><td style={{ textAlign: 'right', color: n(v) < 0 ? '#b02a37' : '#222', fontWeight: bold ? 700 : 400 }}>{money(Math.abs(n(v)))}</td></tr>
                        ))}
                        <tr><td style={{ paddingTop: '8px', fontWeight: 800, color: '#1e7e34', borderTop: '2px solid #1F3864' }}>Net pay</td><td style={{ textAlign: 'right', paddingTop: '8px', fontWeight: 800, fontSize: '18px', color: '#1e7e34', borderTop: '2px solid #1F3864' }}>{money(preview.net)}</td></tr>
                        <tr><td colSpan={2} style={{ ...st.small, paddingTop: '8px' }}>Taxable pay {money(preview.taxablePay)} · PAYE {money(preview.payeBeforeRelief)} − relief {money(preview.relief)}<br />Cost to school {money(preview.employerCost)} (incl. employer NSSF &amp; Housing Levy)</td></tr>
                    </tbody></table>
                )}
            </div>
        </form>
    );
}

/** Allowances (EARNING) and deductions (DEDUCTION): name, amount, taxable. */
function ItemsEditor({ items, onChange }) {
    const setItem = (i, patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    return (
        <div>
            {items.map((x, i) => (
                <div key={i} style={st.itemRow}>
                    <select style={{ ...st.input, width: '130px' }} value={x.kind} onChange={e => setItem(i, { kind: e.target.value, taxable: e.target.value === 'EARNING' })} aria-label="Allowance or deduction">
                        <option value="EARNING">Allowance</option><option value="DEDUCTION">Deduction</option>
                    </select>
                    <input style={{ ...st.input, flex: 1, minWidth: '120px' }} maxLength={60} value={x.name} placeholder={x.kind === 'EARNING' ? 'House allowance, Overtime…' : 'Sacco, Salary advance, Loan…'} onChange={e => setItem(i, { name: e.target.value })} aria-label="Name" />
                    <input style={{ ...st.input, width: '110px' }} inputMode="decimal" value={x.amount} placeholder="Amount" onChange={e => setItem(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Amount" />
                    {x.kind === 'EARNING' && <label style={{ ...st.check, fontSize: '12px' }} title="Most allowances are taxed. Untick only for allowances KRA treats as non-taxable."><input type="checkbox" checked={x.taxable !== false} onChange={e => setItem(i, { taxable: e.target.checked })} />taxed</label>}
                    <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} style={{ ...st.link, color: '#b02a37' }} aria-label="Remove"><i className="bi bi-x-lg" /></button>
                </div>
            ))}
            <div style={{ display: 'flex', gap: '14px' }}>
                <button type="button" onClick={() => onChange([...items, { kind: 'EARNING', name: '', amount: '', taxable: true }])} style={st.link}><Icon name="plus-circle" />Allowance</button>
                <button type="button" onClick={() => onChange([...items, { kind: 'DEDUCTION', name: '', amount: '', taxable: false }])} style={st.link}><Icon name="dash-circle" />Deduction</button>
            </div>
        </div>
    );
}

// ══ Rates ════════════════════════════════════════════════════════════════════
function RatesTab({ setError, flash }) {
    const [r, setR] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => { api.get('/api/payroll/rates').then(x => setR({ ...x.data, payeBands: (x.data.payeBands || []).map(b => ({ upTo: b.upTo ?? '', rate: b.rate })) })).catch(err => setError(serverMessage(err, 'Could not load the rates.'))); }, [setError]);
    if (!r) return <p style={st.center}><Icon name="hourglass-split" />Loading…</p>;
    const set = (patch) => setR(x => ({ ...x, ...patch }));
    const setBand = (i, patch) => set({ payeBands: r.payeBands.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
    const num = (k, label, suffix) => (
        <label style={st.lbl}>{label}<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input style={st.input} inputMode="decimal" value={r[k] ?? ''} onChange={e => set({ [k]: e.target.value.replace(/[^\d.]/g, '') })} />{suffix}</span></label>
    );
    const save = async () => {
        setSaving(true); setError('');
        try {
            const body = { ...r, payeBands: r.payeBands.map((b, i) => ({ upTo: i === r.payeBands.length - 1 || b.upTo === '' ? null : Number(b.upTo), rate: Number(b.rate) })) };
            const x = await api.put('/api/payroll/rates', body); flash(x.data.message);
        } catch (err) { setError(serverMessage(err, 'Could not save the rates.')); }
        setSaving(false);
    };
    return (
        <div style={st.panel}>
            <p style={st.warn}><Icon name="exclamation-triangle-fill" />These rates change with Finance Acts and NSSF / SHA notices. Check KRA, NSSF and SHA before changing them. New pay runs use them; old payslips never change.</p>
            <h4 style={st.h4}>PAYE bands (monthly)</h4>
            {r.payeBands.map((b, i) => (
                <div key={i} style={st.itemRow}>
                    <span style={{ width: '70px', fontSize: '13px' }}>{i === 0 ? 'First' : 'Next'}</span>
                    {i === r.payeBands.length - 1 ? <span style={{ ...st.input, width: '150px', color: '#666', backgroundColor: '#f5f5f5' }}>everything above</span>
                        : <input style={{ ...st.input, width: '150px' }} inputMode="decimal" value={b.upTo} placeholder="up to (KES)" onChange={e => setBand(i, { upTo: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Up to" />}
                    <input style={{ ...st.input, width: '80px' }} inputMode="decimal" value={b.rate} onChange={e => setBand(i, { rate: e.target.value.replace(/[^\d.]/g, '') })} aria-label="Rate" />%
                    {r.payeBands.length > 1 && <button onClick={() => set({ payeBands: r.payeBands.filter((_, k) => k !== i) })} style={{ ...st.link, color: '#b02a37' }} aria-label="Remove band"><i className="bi bi-x-lg" /></button>}
                </div>
            ))}
            <button onClick={() => { const bands = [...r.payeBands]; bands.splice(bands.length - 1, 0, { upTo: '', rate: '' }); set({ payeBands: bands }); }} style={st.link}><Icon name="plus-circle" />Add a band</button>
            <div style={{ ...st.grid, marginTop: '14px' }}>
                {num('personalRelief', 'Personal relief (KES a month)')}
                {num('nssfRate', 'NSSF rate', '%')}
                {num('nssfUpperLimit', 'NSSF upper earnings limit (KES)')}
                {num('shifRate', 'SHIF rate', '%')}
                {num('shifMinimum', 'SHIF minimum (KES a month)')}
                {num('housingRate', 'Housing Levy — staff', '%')}
                {num('housingEmployerRate', 'Housing Levy — employer', '%')}
                <label style={st.lbl}>Rates last checked on<input type="date" style={st.input} value={r.checkedOn || ''} onChange={e => set({ checkedOn: e.target.value })} /></label>
            </div>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', margin: '12px 0' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1F3864' }}>Taken off pay before PAYE:</span>
                {[['nssfBeforePaye', 'NSSF'], ['shifBeforePaye', 'SHIF'], ['housingBeforePaye', 'Housing Levy']].map(([k, l]) => (
                    <label key={k} style={st.check}><input type="checkbox" checked={r[k] !== false} onChange={e => set({ [k]: e.target.checked })} />{l}</label>
                ))}
            </div>
            <h4 style={{ ...st.h4, marginTop: '16px' }}><Icon name="bank2" />Bank upload file (salaries)</h4>
            <p style={{ ...st.muted, marginTop: 0 }}>Used for the bank's salary Excel. Staff whose bank is the school's bank get <b>BT</b>; others get <b>LBT</b> with the payment type below.</p>
            <div style={st.grid}>
                {[['debitAccount', "School's account number (debit account)"], ['schoolBankName', "School's bank (name)"], ['schoolBankCode', "School's bank code (optional)"],
                  ['purposeCode', 'Purpose code'], ['currency', 'Currency'], ['otherBankPaymentType', 'Payment type for other banks'], ['remarks', 'Remarks (optional)']].map(([k, l]) => (
                    <label key={k} style={st.lbl}>{l}<input style={st.input} maxLength={40} value={(r.bankFile || {})[k] || ''}
                        onChange={e => set({ bankFile: { ...(r.bankFile || {}), [k]: k === 'debitAccount' ? e.target.value.replace(/\s/g, '') : e.target.value } })} /></label>
                ))}
            </div>
            <label style={{ ...st.lbl, marginTop: '12px' }}>Sources / notes<textarea style={{ ...st.input, minHeight: '60px', fontFamily: 'inherit' }} value={r.sources || ''} onChange={e => set({ sources: e.target.value })} /></label>
            <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '12px' }}>
                <button disabled={saving} onClick={save} style={st.primary}><Icon name={saving ? 'hourglass-split' : 'save-fill'} />Save rates</button>
            </div>
        </div>
    );
}

function Modal({ title, children, onClose }) {
    useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return (
        <div style={st.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={st.dialog} role="dialog" aria-modal="true" aria-label={title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ ...st.h3, margin: 0 }}>{title}</h3>
                    <button onClick={onClose} style={st.link} aria-label="Close"><i className="bi bi-x-lg" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

const st = {
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex', flex: 1, minWidth: 0 },
    content: { flex: 1, minWidth: 0, padding: '20px' },
    title: { color: '#1F3864', margin: '0 0 4px' },
    subtitle: { color: '#666', margin: '0 0 14px', fontSize: '14px' },
    error: { display: 'flex', alignItems: 'flex-start', gap: '6px', backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' },
    success: { backgroundColor: '#d4edda', color: '#155724', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    warn: { backgroundColor: '#fff3cd', color: '#856404', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginTop: 0 },
    tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' },
    tab: { padding: '9px 14px', border: '1px solid #1F3864', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '12px', alignItems: 'start' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', margin: '12px 0' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '8px 10px', backgroundColor: '#fafbfd', fontSize: '12px', color: '#555' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222', backgroundColor: 'white', minWidth: 0 },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' },
    itemRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    h3: { color: '#1F3864', margin: '0 0 10px', fontSize: '17px' },
    h4: { color: '#1F3864', margin: '8px 0', fontSize: '14px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '760px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px' },
    thN: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'right', fontSize: '12px' },
    td: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    tdN: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' },
    pill: { color: 'white', borderRadius: '10px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
    center: { textAlign: 'center', color: '#666', padding: '20px' },
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '12px' },
    dialog: { backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', padding: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' },
};

export default Payroll;
