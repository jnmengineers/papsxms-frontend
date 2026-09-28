import React, { useEffect, useState } from 'react';

/**
 * How one learner is charged for a service this term:
 *   Full term · some months · some days · an agreed amount (with a note).
 * Used by Finance → Extra Charges (meals etc.) and Transport → Riders.
 *
 * Props:
 *   title        e.g. "Lunch — Jane Doe"
 *   subtitle     e.g. "2026 Term 1"
 *   rates        { term, monthly, daily } — monthly/daily may be empty (option then unavailable)
 *   allowParts   false for once-only charges (no months/days)
 *   current      { basis, quantity, amount, note } or null
 *   saveLabel    button text (default "Save price")
 *   onSave(p)    async; p = { basis, quantity, amount, note } — return true to close
 *   onClose()
 */
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
const kes = (v) => `KES ${Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function PriceEditor({ title, subtitle, rates = {}, allowParts = true, current, saveLabel = 'Save price', onSave, onClose }) {
    const termRate = num(rates.term);
    const monthly = num(rates.monthly);
    const daily = num(rates.daily);
    const [basis, setBasis] = useState(current?.basis || 'TERM');
    const [months, setMonths] = useState(current?.basis === 'MONTHS' ? String(current.quantity || '') : '1');
    const [days, setDays] = useState(current?.basis === 'DAYS' ? String(current.quantity || '') : '');
    const [amount, setAmount] = useState(current?.basis === 'CUSTOM' ? String(num(current.amount) ?? '') : '');
    const [note, setNote] = useState(current?.note || '');
    const [saving, setSaving] = useState(false);
    const [problem, setProblem] = useState('');

    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onClose, saving]);

    const qMonths = parseInt(months, 10);
    const qDays = parseInt(days, 10);
    const total = basis === 'TERM' ? termRate
        : basis === 'MONTHS' ? (monthly && qMonths > 0 ? monthly * qMonths : null)
        : basis === 'DAYS' ? (daily && qDays > 0 ? daily * qDays : null)
        : num(amount);
    const diff = total !== null && termRate !== null ? termRate - total : null;

    const check = () => {
        if (basis === 'MONTHS' && !(qMonths >= 1 && qMonths <= 12)) return 'Enter the number of months (1–12).';
        if (basis === 'DAYS' && !(qDays >= 1 && qDays <= 200)) return 'Enter the number of days (1–200).';
        if (basis === 'CUSTOM') {
            if (num(amount) === null || num(amount) < 0) return 'Enter the agreed amount (0 or more).';
            if (note.trim().length < 3) return 'Add a short note saying why (e.g. "joined in week 6", "bursary").';
        }
        return '';
    };

    const submit = async (e) => {
        e.preventDefault();
        const p = check();
        if (p) { setProblem(p); return; }
        setProblem(''); setSaving(true);
        const ok = await onSave({
            basis,
            quantity: basis === 'MONTHS' ? qMonths : basis === 'DAYS' ? qDays : null,
            amount: basis === 'CUSTOM' ? String(amount).trim() : null,
            note: note.trim() || null,
        });
        setSaving(false);
        if (ok) onClose();
    };

    // A plain function (not a component) so the inputs inside keep focus while typing
    const option = ({ value, label, disabled, hint }, children) => (
        <label key={value} style={{ ...s.option, borderColor: basis === value ? '#1F3864' : '#ddd', backgroundColor: basis === value ? '#eef3fb' : disabled ? '#f7f7f7' : 'white', opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="radio" name="price-basis" checked={basis === value} disabled={disabled} onChange={() => { setBasis(value); setProblem(''); }} />
                <strong style={{ color: '#1F3864' }}>{label}</strong>
            </span>
            {hint && <span style={s.hint}>{hint}</span>}
            {basis === value && children}
        </label>
    );

    return (
        <div style={s.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
            <form onSubmit={submit} style={s.dialog} role="dialog" aria-modal="true" aria-label={title}>
                <div style={s.head}>
                    <div>
                        <div style={s.title}><i className="bi bi-tag-fill" aria-hidden="true" style={{ marginRight: '6px' }} />{title}</div>
                        {subtitle && <div style={s.sub}>{subtitle}</div>}
                    </div>
                    <button type="button" onClick={onClose} style={s.x} aria-label="Close">×</button>
                </div>

                {option({ value: 'TERM', label: 'Full term', hint: termRate !== null ? kes(termRate) : '' })}
                {allowParts && option({ value: 'MONTHS', label: 'Some months', disabled: !monthly, hint: monthly ? `${kes(monthly)} a month` : 'No monthly rate set' },
                    <span style={s.qtyRow}>
                        <input style={s.qty} type="number" min="1" max="12" value={months} onChange={e => setMonths(e.target.value)} aria-label="Months" autoFocus /> month(s) × {kes(monthly)}
                    </span>)}
                {allowParts && option({ value: 'DAYS', label: 'Some days', disabled: !daily, hint: daily ? `${kes(daily)} a day` : 'No daily rate set' },
                    <span style={s.qtyRow}>
                        <input style={s.qty} type="number" min="1" max="200" value={days} onChange={e => setDays(e.target.value)} aria-label="Days" autoFocus /> day(s) × {kes(daily)}
                    </span>)}
                {option({ value: 'CUSTOM', label: 'Agreed amount', hint: 'Any figure the accountant decides' },
                    <span style={s.qtyRow}>
                        KES <input style={{ ...s.qty, width: '120px' }} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Agreed amount" autoFocus />
                    </span>)}

                <label style={s.noteLbl}>
                    Note {basis === 'CUSTOM' ? <span style={{ color: '#dc3545' }}>(required)</span> : <span style={{ color: '#888', fontWeight: 'normal' }}>(optional — shows on the statement)</span>}
                    <input style={s.note} value={note} maxLength={200} onChange={e => setNote(e.target.value)}
                        placeholder={basis === 'DAYS' ? 'e.g. joined on 14 Oct' : basis === 'MONTHS' ? 'e.g. September and October only' : 'e.g. sibling discount, bursary'} />
                </label>

                <div style={s.totalBox}>
                    <span>Charge this term</span>
                    <strong style={{ fontSize: '20px', color: '#1F3864' }}>{total !== null ? kes(total) : '—'}</strong>
                    {diff !== null && diff !== 0 && basis !== 'TERM' && (
                        <span style={{ fontSize: '12px', color: diff > 0 ? '#28a745' : '#dc3545' }}>
                            {diff > 0 ? `${kes(diff)} less than full term` : `${kes(-diff)} more than full term`}
                        </span>
                    )}
                </div>

                {problem && <div style={s.problem} role="alert">{problem}</div>}
                <div style={s.actions}>
                    <button type="button" onClick={onClose} style={s.cancel} disabled={saving}>Cancel</button>
                    <button type="submit" style={{ ...s.save, opacity: saving ? 0.6 : 1 }} disabled={saving}>
                        <i className={`bi bi-${saving ? 'hourglass-split' : 'check-lg'}`} aria-hidden="true" style={{ marginRight: '6px' }} />{saving ? 'Saving…' : saveLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}

const s = {
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '12px' },
    dialog: { backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto', padding: '18px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' },
    head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' },
    title: { fontWeight: 700, color: '#1F3864', fontSize: '16px' },
    sub: { fontSize: '12px', color: '#666', marginTop: '2px' },
    x: { border: 'none', background: 'none', fontSize: '24px', lineHeight: 1, cursor: 'pointer', color: '#888' },
    option: { display: 'flex', flexDirection: 'column', gap: '6px', border: '2px solid #ddd', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' },
    hint: { fontSize: '12px', color: '#666', marginLeft: '26px' },
    qtyRow: { display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '26px', fontSize: '13px', flexWrap: 'wrap' },
    qty: { width: '70px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px' },
    noteLbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864', margin: '6px 0 12px' },
    note: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal' },
    totalBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', backgroundColor: '#f5f8fc', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#555' },
    problem: { marginTop: '10px', backgroundColor: '#f8d7da', color: '#721c24', padding: '8px 10px', borderRadius: '6px', fontSize: '13px' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' },
    cancel: { padding: '8px 14px', border: '1px solid #ccc', background: 'white', borderRadius: '6px', cursor: 'pointer' },
    save: { padding: '8px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
};

export default PriceEditor;
