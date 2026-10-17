import { letterheadHtml, schoolName } from './school';

/** Printouts for admissions: the application (for the file) and the admission letter. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (d) => (d ? new Date(String(d).length > 10 ? d : d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const CSS = `@page{size:A4;margin:15mm}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;margin:0}
.bar{background:#1F3864;color:#fff;padding:10px 16px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:0;padding:6px 14px;border-radius:5px;font-weight:700;cursor:pointer}
.page{max-width:760px;margin:0 auto;padding:14px}h2{text-align:center;color:#1F3864;border-top:2px solid #1F3864;border-bottom:2px solid #1F3864;padding:5px 0;font-size:14px;letter-spacing:1px}
table{width:100%;border-collapse:collapse}td{padding:7px 6px;border-bottom:1px solid #e3e7ee;vertical-align:top}td:first-child{width:34%;font-weight:700;color:#1F3864}
.box{border:1px solid #ccd3df;border-radius:6px;padding:10px;margin-top:12px;min-height:60px}.sig{display:flex;justify-content:space-between;margin-top:36px}
p{line-height:1.7}@media print{.bar{display:none}.page{padding:0}}`;
const open = (title, body) => {
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups for this site to print.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="bar"><b>${esc(title)}</b><button onclick="window.print()">Print / Save PDF</button></div><div class="page">${letterheadHtml({ logoSize: 55 })}${body}</div></body></html>`);
    w.document.close(); w.focus();
};
const STAGES = { NEW: 'New', CONTACTED: 'Contacted', INTERVIEW: 'Interview / assessment', ADMITTED: 'Admitted', NOT_ADMITTED: 'Not admitted', CLOSED: 'Closed' };

export function printApplication(e) {
    open(`Application - ${e.learnerName || e.parentName}`, `<h2>ADMISSION APPLICATION</h2>
    <table>
      <tr><td>Application no.</td><td>APP-${esc(e.enquiryId)}</td></tr><tr><td>Received</td><td>${day(e.createdAt)}</td></tr>
      <tr><td>Learner's name</td><td>${esc(e.learnerName)}</td></tr><tr><td>Grade applied for</td><td>${esc(e.gradeWanted)}</td></tr>
      ${e.preferredInterviewDate ? `<tr><td>Preferred interview date</td><td>${day(e.preferredInterviewDate)}</td></tr>` : ''}
      <tr><td>Parent / guardian</td><td>${esc(e.parentName)}</td></tr><tr><td>Phone</td><td>${esc(e.phone)}</td></tr><tr><td>Email</td><td>${esc(e.email)}</td></tr>
      <tr><td>Message</td><td>${esc(e.message)}</td></tr><tr><td>Stage</td><td>${esc(STAGES[e.status] || e.status)}${e.interviewDate ? ` — interview ${day(e.interviewDate)}` : ''}</td></tr>
      ${e.admittedAs ? `<tr><td>Admitted as</td><td>${esc(e.admittedAs)}</td></tr>` : ''}
      ${e.staffNote ? `<tr><td>Office note</td><td>${esc(e.staffNote)}</td></tr>` : ''}
    </table>
    <div class="box"><b>Interview / assessment remarks:</b></div>
    <div class="box"><b>Decision:</b> &nbsp; ☐ Admitted &nbsp; ☐ Not admitted &nbsp;&nbsp; Class: ____________</div>
    <div class="sig"><span>Interviewed by: ____________________</span><span>Head teacher: ____________________</span></div>`);
}

/** a = { learnerName, admissionNumber, className, parentName, date } */
export function printAdmissionLetter(a) {
    open(`Admission letter - ${a.learnerName}`, `<p style="text-align:right">${day(a.date || new Date().toISOString())}</p>
    <p>Dear ${esc(a.parentName || 'Parent / Guardian')},</p>
    <h2>LETTER OF ADMISSION</h2>
    <p>We are pleased to inform you that <b>${esc(a.learnerName)}</b> has been admitted to <b>${esc(schoolName())}</b> in <b>${esc(a.className)}</b>.</p>
    <table><tr><td>Admission number</td><td><b>${esc(a.admissionNumber)}</b></td></tr><tr><td>Class</td><td>${esc(a.className)}</td></tr><tr><td>Reporting date</td><td>____________________</td></tr></table>
    <p>Please quote the admission number on all fee payments and correspondence. The fee structure and the list of requirements are available from the school office.</p>
    <p>We look forward to partnering with you in your child's education.</p>
    <div class="sig"><span>____________________<br>Head teacher</span><span>School stamp</span></div>`);
}
