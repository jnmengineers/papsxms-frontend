/**
 * Bank reconciliation: read a bank statement (text copied from the statement PDF, or rows from
 * the bank's Excel/CSV) and match every line to what the school recorded.
 *
 *   Money in  → fee payments, by the transaction code in the particulars (M-Pesa code,
 *               deposit slip number…). Several payments with the SAME code are added up —
 *               e.g. one bank deposit split by the bursar between siblings.
 *               A line with a value date and no code match (e.g. "UG8S90TJMP PIPELINE
 *               ADVENTIST PRIMARY SC") is a daily M-Pesa settlement → compared with that
 *               day's total of M-Pesa payments not matched elsewhere.
 *   Money out → expenses, by reference (e.g. cheque number).
 */

const MONEY = /^-?[\d,]+\.\d{2}$/;
const toNum = (s) => Number(String(s).replace(/,/g, ''));
const round2 = (n) => Math.round(n * 100) / 100;
const iso = (d) => { const [dd, mm, yyyy] = d.split(/[-/]/); return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`; };
const OUT_WORDS = /(charge|chq|cheque|withdraw|sal upld|debit|fee\b|commission|excise|levy)/i;

/**
 * Text → statement lines. Accepts:
 *   07-07-2026  MERCY KAJUJU MUT-BY:EMMANUELA G1/6188140   2,000.00   4,489,434.69 Cr
 *   08-07-2026 07-07 UG8S90TJMP PIPELINE ADVENTIST PRIMARY SC 91,190.00 4,590,374.69 Cr
 *   (tab-separated rows pasted from Excel work too)
 */
export function parseStatement(text) {
    const lines = [];
    let prevBalance = null;
    const raw = String(text || '').replace(/\r/g, '').split('\n');
    for (const rawLine of raw) {
        const l = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
        if (!l) continue;
        const bf = l.match(/(balance\s*(b\/f|brought forward)|opening balance)\D*([\d,]+\.\d{2})/i);
        if (bf) { prevBalance = toNum(bf[3]); continue; }
        const m = l.match(/^(\d{2}[-/]\d{2}[-/]\d{4})\s+(?:(\d{2}[-/]\d{2})(?:[-/]\d{2,4})?\s+)?(.+)$/);
        if (!m) continue;
        const [, date, valueDate, rest] = m;
        const tokens = rest.split(' ');
        let crdr = '';
        if (/^(cr|dr)$/i.test(tokens[tokens.length - 1])) crdr = tokens.pop().toUpperCase();
        const nums = [];
        while (tokens.length && MONEY.test(tokens[tokens.length - 1]) && nums.length < 3) nums.unshift(tokens.pop());
        if (nums.length < 2) continue;                          // needs at least amount + balance
        const particulars = tokens.join(' ').trim();
        let balance = toNum(nums[nums.length - 1]);
        if (crdr === 'DR') balance = -balance;
        let moneyIn = 0, moneyOut = 0;
        if (nums.length === 3) { moneyOut = toNum(nums[0]); moneyIn = toNum(nums[1]); }
        else {
            const amt = toNum(nums[0]);
            if (prevBalance !== null && Math.abs(round2(prevBalance + amt) - balance) < 0.005) moneyIn = amt;
            else if (prevBalance !== null && Math.abs(round2(prevBalance - amt) - balance) < 0.005) moneyOut = amt;
            else if (OUT_WORDS.test(particulars)) moneyOut = amt;     // first line: decide by the words
            else moneyIn = amt;
        }
        const year = date.slice(-4);
        lines.push({
            no: lines.length + 1, date: iso(date), valueDate: valueDate ? iso(`${valueDate.replace('/', '-')}-${year}`) : null,
            particulars, moneyIn, moneyOut, balance, codes: codesIn(particulars),
        });
        prevBalance = balance;
    }
    return lines;
}

/** Transaction codes inside the particulars: 6+ letters/digits with at least one digit, and cheque numbers. */
export function codesIn(particulars) {
    const out = [];
    const up = String(particulars).toUpperCase();
    for (const t of up.split(/[\s/:.,;()-]+/)) {
        if (t.length >= 6 && /\d/.test(t) && /^[A-Z0-9]+$/.test(t) && !out.includes(t)) out.push(t);
    }
    // Cheque numbers are short: "CATHERINE-CHQ-934", "ChequeNo.000935" → 934, 935 (leading zeros dropped)
    for (const m of up.matchAll(/(?:CHQ|CHEQUE)\s*(?:NO)?[\s.:#-]*(\d{2,})/g)) {
        const n = m[1].replace(/^0+/, '');
        if (n && !out.includes(n)) out.push(n);
    }
    return out;
}
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Does a statement code point to this reference? Exact, or cut short by the bank (6+ characters). */
const codeHits = (code, ref) => code === ref || (code.length >= 6 && ref.length >= 6 && (ref.startsWith(code) || code.startsWith(ref)));

/**
 * Match statement lines to payments and expenses.
 * payments: [{ paymentId, receiptNumber, amount, method, reference, paidOn, reversed, student }]
 * expenses: [{ expenseId, voucherNumber, amount, reference, spentOn, voided, approvalStatus }]
 */
export function reconcile(lines, payments, expenses) {
    const live = payments.filter(p => !p.reversed && norm(p.reference));
    const used = new Set();
    const byRef = new Map();
    live.forEach(p => { const r = norm(p.reference); if (!byRef.has(r)) byRef.set(r, []); byRef.get(r).push(p); });
    const results = lines.map(l => ({ ...l, status: '', matched: [], note: '', hitCodes: [], dateNote: '' }));
    // A payment may be recorded with a different date from the bank's — the CODE decides; the date is only noted
    const noteDates = (r, recs, key) => {
        const other = [...new Set(recs.map(x => x[key]).filter(d => d && d !== r.date))];
        const nice = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        r.dateNote = other.length ? `Recorded on ${other.map(nice).join(', ')} — the bank shows ${nice(r.date)}. Matched by the code.` : '';
    };

    // 1) Money in: by code — all payments sharing the code are added up
    for (const r of results.filter(x => x.moneyIn > 0)) {
        const refs = [...byRef.keys()].filter(ref => r.codes.some(c => codeHits(c, ref)));
        const found = refs.flatMap(ref => byRef.get(ref)).filter(p => !used.has(p.paymentId));
        if (!found.length) continue;
        const sum = round2(found.reduce((a, p) => a + Number(p.amount), 0));
        found.forEach(p => used.add(p.paymentId));
        r.matched = found;
        r.hitCodes = r.codes.filter(c => refs.some(ref => codeHits(c, ref)));   // the code(s) that gave the match
        noteDates(r, found, 'paidOn');
        if (Math.abs(sum - r.moneyIn) < 0.005) {
            r.status = found.length > 1 ? 'SPLIT' : 'MATCHED';
            r.note = found.length > 1 ? `One bank code shared by ${found.length} payments (e.g. siblings) — they add up.` : '';
        } else {
            r.status = 'AMOUNT_DIFF';
            const shareTotal = found.map(p => Number(p.codeTotal || 0)).find(x => x > 0);
            r.note = shareTotal && sum < r.moneyIn
                ? `Shared code: only ${sum.toFixed(2)} of ${r.moneyIn.toFixed(2)} has been given to children so far — record the rest (Record Payment → Several children, or tick "shared" for the next child).`
                : `Recorded ${sum.toFixed(2)} under this code; the bank shows ${r.moneyIn.toFixed(2)} (difference ${(r.moneyIn - sum).toFixed(2)}).`;
        }
    }

    // 2) Money in with a value date and no code match → daily M-Pesa settlement vs that day's M-Pesa total
    for (const r of results.filter(x => x.moneyIn > 0 && !x.status && x.valueDate)) {
        const day = live.filter(p => !used.has(p.paymentId) && p.method === 'MPESA' && p.paidOn === r.valueDate);
        if (!day.length) continue;
        const sum = round2(day.reduce((a, p) => a + Number(p.amount), 0));
        r.matched = day;
        day.forEach(p => used.add(p.paymentId));
        r.status = Math.abs(sum - r.moneyIn) < 0.005 ? 'DAY_TOTAL' : 'AMOUNT_DIFF';
        r.note = r.status === 'DAY_TOTAL'
            ? `M-Pesa settlement for ${r.valueDate}: ${day.length} payment(s) add up.`
            : `M-Pesa settlement for ${r.valueDate}: recorded ${sum.toFixed(2)}, the bank shows ${r.moneyIn.toFixed(2)} (difference ${(r.moneyIn - sum).toFixed(2)}).`;
    }
    results.filter(x => x.moneyIn > 0 && !x.status).forEach(x => {
        x.status = 'NOT_FOUND';
        x.note = x.codes.length ? `No payment recorded with code ${x.codes.join(' / ')}.` : 'No transaction code on this line.';
    });

    // 3) Money out: expenses by reference (cheque numbers etc.)
    const liveExp = expenses.filter(e => !e.voided && norm(e.reference));
    const usedExp = new Set();
    for (const r of results.filter(x => x.moneyOut > 0)) {
        const hitsExp = (c, e) => codeHits(c, norm(e.reference)) || codeHits(c.replace(/^0+/, ''), norm(e.reference).replace(/^0+/, ''));
        const found = liveExp.filter(e => !usedExp.has(e.expenseId) && r.codes.some(c => hitsExp(c, e)));
        if (!found.length) { r.status = /charge|excise|commission/i.test(r.particulars) ? 'BANK_CHARGE' : 'OUT_NOT_FOUND'; continue; }
        const sum = round2(found.reduce((a, e) => a + Number(e.amount), 0));
        found.forEach(e => usedExp.add(e.expenseId));
        r.matched = found;
        r.hitCodes = r.codes.filter(c => found.some(e => hitsExp(c, e)));
        noteDates(r, found, 'paidOn');
        r.status = Math.abs(sum - r.moneyOut) < 0.005 ? 'OUT_MATCHED' : 'AMOUNT_DIFF';
        if (r.status === 'AMOUNT_DIFF') r.note = `Expense recorded as ${sum.toFixed(2)}; the bank shows ${r.moneyOut.toFixed(2)}.`;
    }

    // Confirmed already (saved from an earlier check)? A line is confirmed when all its records are.
    results.forEach(r => { r.confirmed = r.matched.length > 0 && r.matched.every(m => m.bankConfirmedOn); });
    // Recorded but not on this statement — leaving out what an earlier statement already confirmed
    const notOnStatement = live.filter(p => !used.has(p.paymentId) && p.method !== 'CASH' && !p.bankConfirmedOn);
    return { lines: results, notOnStatement };
}

/**
 * Split the particulars into pieces, marking the codes that gave the match, e.g.
 * "MUT-BY:EMMANUELA G1/6188140" + ["6188140"] → [{text:'MUT-BY:EMMANUELA G1/'}, {text:'6188140', hit:true}]
 * (cheque "000935" also marks "000935" when the code used was "935").
 */
export function markCodes(particulars, hitCodes) {
    const text = String(particulars || '');
    const codes = (hitCodes || []).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!codes.length) return [{ text }];
    const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${codes.map(c => (/^\d+$/.test(c) ? `0*${esc(c)}` : esc(c))).join('|')})`, 'ig');
    const out = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
        if (m.index > last) out.push({ text: text.slice(last, m.index) });
        out.push({ text: m[0], hit: true });
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
}

/** Results that can be confirmed in the books (good matches). */
export const CONFIRMABLE = new Set(['MATCHED', 'SPLIT', 'DAY_TOTAL', 'OUT_MATCHED']);

export const STATUS = {
    MATCHED: ['Matched', '#1e7e34'], SPLIT: ['Matched — shared code', '#0f766e'], DAY_TOTAL: ['M-Pesa day total', '#2E75B6'],
    AMOUNT_DIFF: ['Amount differs', '#b8860b'], NOT_FOUND: ['Not recorded', '#b02a37'],
    OUT_MATCHED: ['Expense matched', '#1e7e34'], OUT_NOT_FOUND: ['Expense not recorded', '#b02a37'], BANK_CHARGE: ['Bank charge', '#6c757d'],
};
