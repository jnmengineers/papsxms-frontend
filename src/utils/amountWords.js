/** 100000.5 → "One hundred thousand shillings and fifty cents only" (for cheque vouchers). */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
    'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const under1000 = (n) => {
    const h = Math.floor(n / 100), r = n % 100;
    const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : '');
    return [h ? ONES[h] + ' hundred' : '', rest].filter(Boolean).join(h && rest ? ' and ' : '');
};
const whole = (n) => {
    if (n === 0) return 'zero';
    const parts = [];
    for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand'], [1, '']]) {
        const chunk = Math.floor(n / size) % 1000;
        if (!chunk) continue;
        // Cheque wording: "one thousand AND one", "one hundred thousand AND fifty" — a last part under 100 after a bigger one
        if (size === 1 && chunk < 100 && parts.length) parts.push('and ' + under1000(chunk));
        else parts.push(under1000(chunk) + (name ? ' ' + name : ''));
    }
    return parts.join(' ');
};
export const amountInWords = (amount) => {
    const cents = Math.round(Number(amount || 0) * 100);
    const sh = Math.floor(cents / 100), c = cents % 100;
    const s = `${whole(sh)} shilling${sh === 1 ? '' : 's'}${c ? ` and ${whole(c)} cent${c === 1 ? '' : 's'}` : ''} only`;
    return s.charAt(0).toUpperCase() + s.slice(1);
};
