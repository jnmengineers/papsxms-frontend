import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useWindowWidth from '../hooks/useWindowWidth';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import { gradeInfo } from '../utils/grading';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { schoolName, schoolShortName, schoolMotto, schoolContact, logoLeftUrl, logoRightUrl } from '../utils/school';

// ── Bootstrap Icon helper ─────────────────────────────────────────────────────
const Bi = ({ name, style }) => (
    <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />
);

// ── Orientation Toggle ────────────────────────────────────────────────────────
const OrientationToggle = ({ value, onChange }) => (
    <span className="no-print" style={{ display: 'flex', gap: '3px' }}>
        {['portrait', 'landscape'].map(o => (
            <button key={o} onClick={() => onChange(o)} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '6px', cursor: 'pointer', border: `1.5px solid ${value === o ? '#1F3864' : '#ccc'}`, background: value === o ? '#1F3864' : 'white', color: value === o ? 'white' : '#666', fontWeight: value === o ? 'bold' : 'normal', textTransform: 'capitalize' }}>{o}</button>
        ))}
    </span>
);

// ── Printable Blank Mark Sheet ────────────────────────────────────────────────
const PrintableMarkSheet = React.forwardRef(({ students, subjects, className, examName, academicYear, term }, ref) => (
    <div ref={ref} style={pStyles.page}>
        <div style={pStyles.header}>
            <div style={pStyles.headerRow}>
                <img src={logoLeftUrl()} alt="" style={pStyles.logo} />
                <div style={pStyles.schoolInfo}>
                    <h1 style={pStyles.schoolName}>{schoolName().toUpperCase()}</h1>
                    <p style={pStyles.motto}>{schoolMotto()}</p>
                    <p style={pStyles.contact}>{schoolContact()}</p>
                </div>
                <img src={logoRightUrl()} alt="" style={pStyles.logo} />
            </div>
            <div style={pStyles.sheetTitleBar}><h2 style={pStyles.sheetTitle}>MARK ENTRY SHEET</h2></div>
        </div>
        <div style={pStyles.infoRow}>
            <span style={pStyles.infoItem}><strong>Class:</strong> {className}</span>
            <span style={pStyles.infoItem}><strong>Exam:</strong> {examName}</span>
            <span style={pStyles.infoItem}><strong>Year:</strong> {academicYear}</span>
            <span style={pStyles.infoItem}><strong>Term:</strong> {term}</span>
            <span style={pStyles.infoItem}><strong>Date:</strong> _______________</span>
            <span style={pStyles.infoItem}><strong>Teacher:</strong> _______________</span>
        </div>
        <div style={pStyles.tableWrapper}>
            <table style={pStyles.table}>
                <thead>
                    <tr>
                        <th style={{ ...pStyles.th, ...pStyles.stickyCol }}>#</th>
                        <th style={{ ...pStyles.th, ...pStyles.admCol }}>Adm No</th>
                        <th style={{ ...pStyles.th, ...pStyles.nameCol }}>Student Name</th>
                        {subjects.map(sub => (
                            <th key={sub.subjectId} style={pStyles.subjectTh}>
                                <div style={pStyles.rotatedHeader}>{sub.subjectName}</div>
                            </th>
                        ))}
                        <th style={pStyles.subjectTh}><div style={pStyles.rotatedHeader}>Total</div></th>
                        <th style={pStyles.subjectTh}><div style={pStyles.rotatedHeader}>Average</div></th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => (
                        <tr key={student.studentId} style={index % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                            <td style={{ ...pStyles.td, ...pStyles.stickyCol, textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ ...pStyles.td, ...pStyles.admCol }}>{student.admissionNumber}</td>
                            <td style={{ ...pStyles.td, ...pStyles.nameCol }}>{student.firstName} {student.lastName}</td>
                            {subjects.map(sub => <td key={sub.subjectId} style={pStyles.markTd}></td>)}
                            <td style={pStyles.markTd}></td>
                            <td style={pStyles.markTd}></td>
                        </tr>
                    ))}
                    <tr style={pStyles.avgRow}>
                        <td colSpan={3} style={{ ...pStyles.td, fontWeight: 'bold', fontSize: '10px' }}>Subject Average</td>
                        {subjects.map(sub => <td key={sub.subjectId} style={pStyles.markTd}></td>)}
                        <td style={pStyles.markTd}></td>
                        <td style={pStyles.markTd}></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div style={pStyles.footer}>
            <div style={pStyles.signBox}>
                <p style={pStyles.signLabel}>Class Teacher: _________________________</p>
                <p style={pStyles.signLabel}>Signature: _____________ Date: _________</p>
            </div>
            <div style={pStyles.signBox}>
                <p style={pStyles.signLabel}>Invigilator: _________________________</p>
                <p style={pStyles.signLabel}>Signature: _____________ Date: _________</p>
            </div>
            <div style={pStyles.signBox}>
                <p style={pStyles.signLabel}>Principal: _________________________</p>
                <p style={pStyles.signLabel}>Signature: _____________ Date: _________</p>
            </div>
        </div>
        <p style={pStyles.footerNote}>{schoolShortName()} — Official Mark Entry Sheet — {new Date().toLocaleDateString()}</p>
    </div>
));

// A mark is invalid if something was typed but it isn't a number from 0 to 100
const isInvalidMark = (v) => {
    if (v === '' || v === undefined || v === null) return false;
    const n = parseFloat(v);
    return isNaN(n) || n < 0 || n > 100;
};

// ══ Covering for a colleague (marks only, until a date) ═════════════════════
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };
const niceDay = (s) => { const d = new Date(`${s}T00:00:00`); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const coverErr = (err, fb) => { const d = err?.response?.data; return (typeof d === 'string' && d.length < 300) ? d : (d?.message || fb); };

const CoverPanel = ({ role, myClasses, classes, onChanged, setError, setSuccessMsg }) => {
    const isAdmin = role === 'ADMIN';
    const [open, setOpen] = useState(false);
    const [covers, setCovers] = useState([]);
    const [colleagues, setColleagues] = useState([]);
    const [form, setForm] = useState({ coverUserId: '', classId: '', subjectId: '', validUntil: inDays(7), note: '' });
    const [classSubjects, setClassSubjects] = useState([]);
    const [saving, setSaving] = useState(false);

    const loadCovers = () => api.get('/api/mark-cover').then(r => setCovers(r.data || [])).catch(() => {});
    useEffect(() => { loadCovers(); }, []);
    useEffect(() => { if (open && !colleagues.length) api.get('/api/mark-cover/colleagues').then(r => setColleagues(r.data || [])).catch(() => {}); }, [open]);

    // Classes I can hand over: admin → any; teacher → own class or subject classes (not ones I'm covering)
    const handOver = isAdmin ? classes.map(c => ({ ...c, classTeacher: true, subjectIds: [], subjectNames: [] }))
        : myClasses.filter(c => c.classTeacher || (c.subjectIds || []).length);
    const chosen = handOver.find(c => String(c.classId) === String(form.classId));
    const canAll = isAdmin || chosen?.classTeacher;
    useEffect(() => {
        setClassSubjects([]);
        if (!form.classId || !canAll) return;
        api.get(`/api/class-subjects/by-class/${form.classId}`).then(r => setClassSubjects((r.data || []).map(cs => cs.subject).filter(Boolean))).catch(() => {});
    }, [form.classId]);
    const subjectOptions = canAll ? classSubjects
        : (chosen?.subjectIds || []).map((id, i) => ({ subjectId: id, subjectName: (chosen.subjectNames || [])[i] || `Subject ${id}` }));

    const grant = async (e) => {
        e.preventDefault();
        if (!form.coverUserId || !form.classId) { setError('Choose the colleague and the class.'); return; }
        if (!canAll && !form.subjectId) { setError('Choose the subject to hand over.'); return; }
        setSaving(true); setError('');
        try {
            const r = await api.post('/api/mark-cover', { coverUserId: Number(form.coverUserId), classId: Number(form.classId), subjectId: form.subjectId ? Number(form.subjectId) : null, validUntil: form.validUntil, note: form.note });
            setSuccessMsg(r.data.message);
            setForm({ coverUserId: '', classId: '', subjectId: '', validUntil: inDays(7), note: '' });
            await loadCovers(); onChanged?.();
        } catch (err) { setError(coverErr(err, 'Could not arrange the cover.')); }
        setSaving(false);
    };
    const cancel = async (c) => {
        const who = c.heldByMe ? `Hand back ${c.className} ${c.subjectName} to ${c.grantedByName}?` : `Cancel ${c.coverName}'s cover for ${c.className} (${c.subjectName})?`;
        if (!window.confirm(who)) return;
        try { const r = await api.post(`/api/mark-cover/${c.coverId}/cancel`); setSuccessMsg(r.data.message); await loadCovers(); onChanged?.(); }
        catch (err) { setError(coverErr(err, 'Could not cancel the cover.')); }
    };

    return (
        <div style={coverStyles.card}>
            <button type="button" onClick={() => setOpen(o => !o)} style={coverStyles.head} aria-expanded={open}>
                <span><i className="bi bi-person-check-fill" aria-hidden="true" style={{ marginRight: '8px' }} />
                    <strong>Cover for an absent colleague</strong>
                    {covers.length > 0 && <span style={coverStyles.count}>{covers.length} active</span>}
                </span>
                <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" />
            </button>
            {open && (
                <div style={{ marginTop: '12px' }}>
                    <p style={coverStyles.help}>
                        {isAdmin ? 'Let a teacher enter marks for a class or subject they don\'t normally teach, until a date.'
                            : 'Away, or need help? Let a colleague enter marks for your class or subject until a date. It switches off by itself.'}
                        {' '}Cover is for <strong>marks only</strong>.
                    </p>
                    {(isAdmin || handOver.length > 0) && (
                        <form onSubmit={grant} style={coverStyles.form}>
                            <label style={coverStyles.field}>Colleague
                                <select style={coverStyles.input} value={form.coverUserId} onChange={e => setForm({ ...form, coverUserId: e.target.value })}>
                                    <option value="">-- Choose --</option>
                                    {colleagues.map(c => <option key={c.userId} value={String(c.userId)}>{c.name}</option>)}
                                </select>
                            </label>
                            <label style={coverStyles.field}>Class
                                <select style={coverStyles.input} value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, subjectId: '' })}>
                                    <option value="">-- Choose --</option>
                                    {handOver.map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                                </select>
                            </label>
                            <label style={coverStyles.field}>Subject
                                <select style={coverStyles.input} value={form.subjectId} disabled={!form.classId} onChange={e => setForm({ ...form, subjectId: e.target.value })}>
                                    {canAll ? <option value="">All subjects</option> : <option value="">-- Choose --</option>}
                                    {subjectOptions.map(sb => <option key={sb.subjectId} value={String(sb.subjectId)}>{sb.subjectName}</option>)}
                                </select>
                            </label>
                            <label style={coverStyles.field}>Until (inclusive)
                                <input type="date" style={coverStyles.input} value={form.validUntil} min={inDays(0)} max={inDays(60)} onChange={e => setForm({ ...form, validUntil: e.target.value })} />
                            </label>
                            <label style={{ ...coverStyles.field, gridColumn: '1 / -1' }}>Note (optional)
                                <input style={coverStyles.input} value={form.note} maxLength={150} placeholder="e.g. On sick leave" onChange={e => setForm({ ...form, note: e.target.value })} />
                            </label>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <button type="submit" disabled={saving} style={coverStyles.btn}>
                                    <i className={`bi bi-${saving ? 'hourglass-split' : 'check-circle-fill'}`} aria-hidden="true" style={{ marginRight: '6px' }} />{saving ? 'Saving…' : 'Arrange cover'}
                                </button>
                            </div>
                        </form>
                    )}
                    {covers.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={coverStyles.listTitle}>Active cover</div>
                            {covers.map(c => (
                                <div key={c.coverId} style={coverStyles.row}>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <strong>{c.heldByMe ? 'You' : c.coverName}</strong> — {c.className} · {c.subjectName}
                                        <span style={coverStyles.meta}> until {niceDay(c.validUntil)}{c.heldByMe ? ` · for ${c.grantedByName}` : c.givenByMe ? ' · arranged by you' : ` · by ${c.grantedByName}`}{c.note ? ` · ${c.note}` : ''}</span>
                                    </span>
                                    {c.canCancel && <button type="button" onClick={() => cancel(c)} style={coverStyles.cancel}>{c.heldByMe ? 'Hand back' : 'Cancel'}</button>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const coverStyles = {
    card: { backgroundColor: 'white', border: '1px solid #e1e8f0', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' },
    head: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#1F3864', fontSize: '14px', padding: 0, fontFamily: 'inherit' },
    count: { marginLeft: '8px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', padding: '1px 8px', borderRadius: '10px' },
    help: { fontSize: '13px', color: '#555', margin: '0 0 10px' },
    form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' },
    field: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '15px', backgroundColor: 'white' },
    btn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    listTitle: { fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '6px' },
    row: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', backgroundColor: '#f7fbff', borderRadius: '8px', marginBottom: '6px', fontSize: '13px', flexWrap: 'wrap' },
    meta: { color: '#777', fontSize: '12px' },
    cancel: { backgroundColor: 'white', color: '#dc3545', border: '1.5px solid #dc3545', padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
};

function MarkEntry() {
    useSchoolSettings();   // re-draws when the grading scale (database) has loaded
    const role = localStorage.getItem('role');
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth <= 768;
    const linkedClassId = localStorage.getItem('linkedClassId');

    const [classes, setClasses] = useState([]);
    // TEACHER: own class(es) = every subject; subject classes = only the subjects they teach
    const [myClasses, setMyClasses] = useState([]);
    const [myClassesLoaded, setMyClassesLoaded] = useState(false);
    const [exams, setExams] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [mode, setMode] = useState('single');


    const [selectedSubject, setSelectedSubject] = useState('');
    const [marks, setMarks] = useState({});

    const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
    const [multiMarks, setMultiMarks] = useState({});

    const [loading, setLoading] = useState(false);
    const [studentSaveStatus, setStudentSaveStatus] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [step, setStep] = useState(1);
    const [studentSearch, setStudentSearch] = useState('');
    const searchRef = useRef();

    // ── Unsaved-changes tracking ──────────────────────────────────────────────
    // keys: "studentId" (single mode) or "studentId-subjectId" (multi mode)
    const [dirty, setDirty] = useState({});
    const unsavedCount = Object.keys(dirty).length;
    const confirmDiscard = () =>
        unsavedCount === 0 ||
        window.confirm(`You have ${unsavedCount} unsaved mark(s). Discard them and continue?`);

    // Warn before closing or refreshing the tab with unsaved marks
    useEffect(() => {
        if (unsavedCount === 0) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [unsavedCount]);

    const printRef = useRef();
    const [printOrientation, setPrintOrientation] = useState('landscape');
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `MarkSheet_${clsName()}_${examName()}`,
        pageStyle: `@page { size: A4 ${printOrientation}; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`
    });

    function clsName() {
        const cls = classes.find(c => String(c.classId) === String(selectedClass))
            || myClasses.find(c => String(c.classId) === String(selectedClass));
        return cls ? classDisplayName(cls) : '';
    }

    function examName() {
        return exams.find(e => String(e.examId) === String(selectedExam))?.examName || '';
    }

    function activeClassId() {
        return selectedClass;
    }

    // What this teacher may do in the selected class
    const myClass = myClasses.find(c => String(c.classId) === String(selectedClass));
    const coverText = (c) => c.cover ? `covering for ${c.coverFor} (${c.coverAll ? 'all subjects' : (c.coverSubjectNames || []).join(', ')}) until ${niceDay(c.coverUntil)}` : '';
    const myClassLabel = (c) => {
        if (c.classTeacher) return `${classDisplayName(c)} — class teacher (all subjects)`;
        const own = (c.subjectNames || []).join(', ');
        return `${classDisplayName(c)} — ${[own, coverText(c)].filter(Boolean).join(' + ')}`;
    };

    function examObj() {
        return exams.find(e => String(e.examId) === String(selectedExam));
    }

    useEffect(() => { fetchClasses(); fetchExams(); if (role === 'TEACHER') fetchMyClasses(); }, []);

    // A teacher with one class starts on it; otherwise on their own class if they have one
    useEffect(() => {
        if (role !== 'TEACHER' || !myClassesLoaded || selectedClass) return;
        if (myClasses.length === 1) setSelectedClass(String(myClasses[0].classId));
        else {
            const own = myClasses.find(c => c.classTeacher && String(c.classId) === String(linkedClassId)) || myClasses.find(c => c.classTeacher);
            if (own) setSelectedClass(String(own.classId));
        }
    }, [myClassesLoaded]);

    useEffect(() => {
        const classId = activeClassId();
        if (classId) {
            fetchSubjectsByClass(classId);
            fetchStudentsByClass(classId);
        } else {
            setSubjects([]); setStudents([]);
        }
    }, [selectedClass, myClassesLoaded]);

    useEffect(() => {
        if (activeClassId() && selectedExam && selectedSubject && mode === 'single') {
            fetchExistingMarksSingle();
        }
    }, [selectedSubject, selectedExam, mode]);

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data); } catch (e) {}
    };

    const fetchMyClasses = async () => {
        try {
            const r = await api.get('/api/teaching-assignments/mine');
            setMyClasses(r.data || []);
        } catch (e) {
            const status = e.response?.status;
            const detail = e.response?.data?.message;
            // Fall back to the class teacher's own class, so their marks can still be entered
            const ownId = localStorage.getItem('linkedClassId');
            if (ownId && ownId !== 'null') {
                setMyClasses([{
                    classId: Number(ownId),
                    className: localStorage.getItem('linkedClassName') || 'Your class',
                    stream: localStorage.getItem('linkedStream') || null,
                    classTeacher: true, subjectIds: [],
                }]);
            }
            setError(status === 404
                ? 'The server hasn\'t been updated yet (your subject classes can\'t be loaded). Showing your own class only — ask the administrator to restart the backend with the latest files.'
                : `Your subject classes couldn't be loaded (${status ? 'error ' + status : 'no connection'}${detail ? ': ' + detail : ''}). ${ownId && ownId !== 'null' ? 'Showing your own class only.' : 'Refresh the page to try again.'}`);
        }
        setMyClassesLoaded(true);
    };

    const fetchExams = async () => {
        try { const r = await api.get('/api/exams'); setExams(r.data); } catch (e) {}
    };

    const fetchSubjectsByClass = async (classId) => {
        // A subject teacher only sees the subjects they teach in this class
        const mine = role === 'TEACHER' ? myClasses.find(c => String(c.classId) === String(classId)) : null;
        const allowed = mine ? [...(mine.subjectIds || []), ...(mine.coverSubjectIds || [])].map(String) : [];
        const limit = (list) => (mine && !mine.classTeacher && !mine.coverAll)
            ? list.filter(s => allowed.includes(String(s.subjectId)))
            : list;
        try {
            const r = await api.get(`/api/class-subjects/by-class/${classId}`);
            if (r.data?.length > 0) setSubjects(limit(r.data.map(cs => cs.subject).filter(Boolean)));
            else { const f = await api.get('/api/subjects'); setSubjects(limit(f.data)); }
        } catch (e) {
            try { const f = await api.get('/api/subjects'); setSubjects(limit(f.data)); } catch (_) {}
        }
    };

    const fetchStudentsByClass = async (classId) => {
        if (!classId) return;
        try {
            setLoading(true);
            setStudents([]);
            const r = await api.get('/api/students');
            const filtered = r.data.filter(s =>
                String(s.schoolClass?.classId) === String(classId)
            );
            setStudents(filtered);
            setLoading(false);
        } catch (e) {
            setLoading(false);
            setError('Failed to load students');
        }
    };

    const fetchExistingMarksSingle = async () => {
        try {
            const r = await api.get(`/api/results/by-exam/${selectedExam}`);
            const existing = {};
            r.data.filter(res => String(res.subject?.subjectId) === String(selectedSubject))
                .forEach(res => {
                    if (res.student?.studentId) {
                        existing[res.student.studentId] = { marks: res.marksObtained, resultId: res.resultId, exists: true };
                    }
                });
            setMarks(existing);
        } catch (e) {}
    };

    const fetchExistingMarksMulti = async (subjectIds) => {
        try {
            const r = await api.get(`/api/results/by-exam/${selectedExam}`);
            const existing = {};
            r.data.forEach(res => {
                const sid = res.student?.studentId;
                const subId = res.subject?.subjectId;
                if (sid && subId && subjectIds.includes(subId)) {
                    if (!existing[sid]) existing[sid] = {};
                    existing[sid][subId] = { marks: res.marksObtained, resultId: res.resultId, exists: true };
                }
            });
            setMultiMarks(existing);
        } catch (e) {}
    };

    const handleMarkChange = useCallback((studentId, value) => {
        setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], marks: value } }));
        setDirty(prev => ({ ...prev, [studentId]: true }));
    }, []);

    const handleMultiMarkChange = useCallback((studentId, subjectId, value) => {
        setMultiMarks(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [subjectId]: { ...prev[studentId]?.[subjectId], marks: value } }
        }));
        setDirty(prev => ({ ...prev, [`${studentId}-${subjectId}`]: true }));
    }, []);

    const toggleSubject = (subjectId) => {
        setSelectedSubjectIds(prev => prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]);
    };

    const handleSaveSingle = async () => {
        setSaving(true); setError(''); setSuccessMsg('');

        const invalidCount = students.filter(st => isInvalidMark(marks[st.studentId]?.marks)).length;
        if (invalidCount > 0) {
            setSaving(false);
            setError(`${invalidCount} mark(s) are outside 0–100. Fix the boxes highlighted in red, then save again.`);
            return;
        }

        const results = students
            .filter(student => {
                const markData = marks[student.studentId];
                if (!markData || markData.marks === '' || markData.marks === undefined) return false;
                const val = parseFloat(markData.marks);
                return !isNaN(val) && val >= 0 && val <= 100;
            })
            .map(student => {
                const markData = marks[student.studentId];
                return {
                    studentId: student.studentId,
                    subjectId: parseInt(selectedSubject),
                    marksObtained: parseFloat(markData.marks),
                    maxMarks: 100,
                    resultId: markData.resultId || null
                };
            });

        if (results.length === 0) {
            setSaving(false);
            const totalStudents = students.length;
            const totalMarksEntered = Object.values(marks).filter(m => m?.marks !== '' && m?.marks !== undefined).length;
            setError(`No valid marks to save. Students loaded: ${totalStudents}. Marks entered: ${totalMarksEntered}. Make sure marks are between 0-100.`);
            return;
        }

        try {
            const response = await api.post('/api/results/bulk-save', {
                examId: parseInt(selectedExam),
                results
            });
            const data = response.data;
            setSaving(false);
            if (data.failed > 0) {
                setError(`${data.failed} failed. ${data.saved} saved, ${data.updated} updated. ${data.errors?.[0] || ''}`);
            } else {
                setDirty({});
                setSuccessMsg(`${data.saved} new mark(s) saved, ${data.updated} updated! ${data.skipped > 0 ? `(${data.skipped} skipped)` : ''}`);
            }
            fetchExistingMarksSingle();
        } catch (e) {
            setSaving(false);
            setError(`Save failed: ${e.response?.data?.message || e.message}. Please try again.`);
            console.error('Bulk save error:', e.response?.data || e.message);
        }
    };

    const handleSaveMulti = async () => {
        setSaving(true); setError(''); setSuccessMsg('');
        const selectedSubjects = subjects.filter(s => selectedSubjectIds.includes(s.subjectId));

        let invalidCount = 0;
        students.forEach(st => selectedSubjects.forEach(sub => {
            if (isInvalidMark(multiMarks[st.studentId]?.[sub.subjectId]?.marks)) invalidCount++;
        }));
        if (invalidCount > 0) {
            setSaving(false);
            setError(`${invalidCount} mark(s) are outside 0–100. Fix the boxes highlighted in red, then save again.`);
            return;
        }

        const results = [];
        for (const student of students) {
            for (const subject of selectedSubjects) {
                const markData = multiMarks[student.studentId]?.[subject.subjectId];
                if (!markData || markData.marks === '' || markData.marks === undefined) continue;
                const val = parseFloat(markData.marks);
                if (isNaN(val) || val < 0 || val > 100) continue;
                results.push({
                    studentId: student.studentId,
                    subjectId: subject.subjectId,
                    marksObtained: val,
                    maxMarks: 100,
                    resultId: markData.resultId || null
                });
            }
        }

        if (results.length === 0) {
            setSaving(false);
            const totalStudents = students.length;
            const totalMarksEntered = countMultiEntered();
            setError(`No valid marks to save. Students loaded: ${totalStudents}. Marks entered: ${totalMarksEntered}. Make sure marks are between 0-100.`);
            return;
        }

        try {
            const response = await api.post('/api/results/bulk-save', {
                examId: parseInt(selectedExam),
                results
            });
            const data = response.data;
            setSaving(false);
            if (data.failed > 0) {
                setError(`${data.failed} failed. ${data.saved} saved, ${data.updated} updated. ${data.errors?.[0] || ''}`);
            } else {
                setDirty({});
                setSuccessMsg(`${data.saved} new mark(s) saved, ${data.updated} updated! ${data.skipped > 0 ? `(${data.skipped} empty cells skipped)` : ''}`);
            }
            fetchExistingMarksMulti(selectedSubjectIds);
        } catch (e) {
            setSaving(false);
            setError(`Save failed: ${e.response?.data?.message || e.message}. Please try again.`);
            console.error('Bulk save error:', e.response?.data || e.message);
        }
    };

    const handleSaveStudent = async (student) => {
        const selectedSubjects = subjects.filter(s => selectedSubjectIds.includes(s.subjectId));
        const studentMarks = mode === 'single'
            ? [{ subjectId: parseInt(selectedSubject), markData: marks[student.studentId] }]
            : selectedSubjects.map(sub => ({ subjectId: sub.subjectId, markData: multiMarks[student.studentId]?.[sub.subjectId] }));

        const results = studentMarks
            .filter(({ markData }) => markData?.marks !== '' && markData?.marks !== undefined)
            .map(({ subjectId, markData }) => {
                const val = parseFloat(markData.marks);
                if (isNaN(val) || val < 0 || val > 100) return null;
                return {
                    studentId: student.studentId,
                    subjectId,
                    marksObtained: val,
                    maxMarks: 100,
                    resultId: markData.resultId || null
                };
            })
            .filter(Boolean);

        if (results.length === 0) {
            setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'error' }));
            setTimeout(() => setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: null })), 2000);
            return;
        }

        setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'saving' }));
        const examId = parseInt(selectedExam);

        try {
            const payload = { examId, results };
            const response = await api.post('/api/results/bulk-save', payload);
            const data = response.data;
            if (data.failed > 0) {
                setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'error' }));
            } else {
                setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'saved' }));
                setDirty(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(k => {
                        if (k === String(student.studentId) || k.startsWith(`${student.studentId}-`)) delete next[k];
                    });
                    return next;
                });
                if (mode === 'single') {
                    setMarks(prev => ({
                        ...prev,
                        [student.studentId]: {
                            ...prev[student.studentId],
                            exists: true,
                            resultId: prev[student.studentId]?.resultId
                        }
                    }));
                } else {
                    const selectedSubjects = subjects.filter(s => selectedSubjectIds.includes(s.subjectId));
                    setMultiMarks(prev => {
                        const updated = { ...prev };
                        selectedSubjects.forEach(sub => {
                            if (updated[student.studentId]?.[sub.subjectId]) {
                                updated[student.studentId] = {
                                    ...updated[student.studentId],
                                    [sub.subjectId]: {
                                        ...updated[student.studentId][sub.subjectId],
                                        exists: true
                                    }
                                };
                            }
                        });
                        return updated;
                    });
                }
            }
        } catch (e) {
            setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'error' }));
            console.error('Save student failed:', student.firstName, e.response?.data || e.message);
        }
    };

    const handleProceedToSubjectSelect = async () => {
        if (!activeClassId() || !selectedExam) { setError('Select class and exam first'); return; }
        setSelectedSubjectIds([]); setMultiMarks({}); setStep(2);
    };

    const handleProceedToMarkSheet = async () => {
        if (selectedSubjectIds.length === 0) { setError('Select at least one subject'); return; }
        setError(''); setLoading(true);
        await fetchExistingMarksMulti(selectedSubjectIds);
        setLoading(false); setStep(3);
    };

    const handleReset = () => {
        setStep(1); setSelectedSubject(''); setSelectedSubjectIds([]);
        setMarks({}); setMultiMarks({}); setError(''); setSuccessMsg('');
        setStudentSearch('');
        setDirty({});
    };

    // Same grading scale as every other page (Grading Scales table) — was A/B/C at 80/60/40 here
    const getGrade = (mark) => {
        if (!mark && mark !== 0) return null;
        const g = gradeInfo(parseFloat(mark));
        return g.label === '-' ? null : { color: g.color, label: g.label };
    };

    const selectedSubjectsForMulti = subjects.filter(s => selectedSubjectIds.includes(s.subjectId));
    const countMultiEntered = () => {
        let count = 0;
        Object.values(multiMarks).forEach(s => Object.values(s).forEach(m => { if (m?.marks !== '' && m?.marks !== undefined) count++; }));
        return count;
    };

    // ── Student search ────────────────────────────────────────────────────────
    const filteredStudents = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return students;
        return students.filter(s =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
            `${s.lastName} ${s.firstName}`.toLowerCase().includes(q) ||
            String(s.admissionNumber || '').toLowerCase().includes(q)
        );
    }, [students, studentSearch]);

    // Enter in the search box jumps to the first matching student's mark box
    const handleSearchKeyDown = (e, inputIdFor) => {
        if (e.key === 'Enter' && filteredStudents.length > 0) {
            e.preventDefault();
            const el = document.getElementById(inputIdFor(filteredStudents[0]));
            if (el) { el.focus(); el.select(); }
        }
        if (e.key === 'Escape') setStudentSearch('');
    };

    // Keyboard in a mark box:
    //   while searching: Enter jumps back to the search box for the next name
    //   otherwise: Enter / Down moves to the next student, Up to the previous one
    //   (Up/Down would otherwise silently change the number in the box)
    const handleMarkKeyDown = (e, student, subjectId) => {
        if (e.key === 'Enter' && studentSearch) {
            e.preventDefault();
            searchRef.current?.focus();
            searchRef.current?.select();
            return;
        }
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const i = filteredStudents.findIndex(s => s.studentId === student.studentId);
            const next = filteredStudents[i + (e.key === 'ArrowUp' ? -1 : 1)];
            if (!next) return;
            const el = document.getElementById(subjectId ? `mark-${next.studentId}-${subjectId}` : `mark-${next.studentId}`);
            if (el) { el.focus(); el.select(); }
        }
    };

    const renderSearchBar = (inputIdFor) => (
        <div style={styles.searchBar}>
            <div style={styles.searchBox}>
                <Bi name="search" style={{ color: '#888', marginRight: '8px' }} />
                <input
                    ref={searchRef}
                    type="text"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    onKeyDown={e => handleSearchKeyDown(e, inputIdFor)}
                    placeholder="Search by name or admission number, then press Enter"
                    style={styles.searchInput}
                />
                {studentSearch && (
                    <button onClick={() => { setStudentSearch(''); searchRef.current?.focus(); }}
                        style={styles.searchClear} title="Clear search">
                        <Bi name="x-lg" style={{ marginRight: 0 }} />
                    </button>
                )}
            </div>
            {studentSearch && (
                <span style={styles.searchCount}>{filteredStudents.length} of {students.length} students</span>
            )}
        </div>
    );

    const currentExamObj = examObj();
    const currentClsName = clsName();
    const currentExamName = examName();
    const printSubjects = selectedSubjectIds.length > 0 ? selectedSubjectsForMulti : subjects;

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.pageHeader}>
                    <div>
                        <h2 style={styles.title}><Bi name="pencil-square" style={{ marginRight: '10px' }} />Mark Entry</h2>
                        <p style={styles.subtitle}>
                            {role === 'TEACHER'
                                ? (myClass ? (myClass.classTeacher ? `Class teacher — ${classDisplayName(myClass)} (all subjects)` : myClassLabel(myClass)) : 'Choose one of your classes')
                                : 'Enter marks for students'}
                        </p>
                    </div>
                    <div style={styles.headerBtns}>
                        {activeClassId() && students.length > 0 && subjects.length > 0 && (
                            <>
                                <OrientationToggle value={printOrientation} onChange={setPrintOrientation} />
                                <button onClick={handlePrint} style={styles.printBtn}><Bi name="printer-fill" />Print Blank Sheet</button>
                            </>
                        )}
                        {(step > 1 || selectedSubject) && (
                            <button onClick={() => confirmDiscard() && handleReset()} style={styles.resetBtn}><Bi name="arrow-counterclockwise" />Reset</button>
                        )}
                    </div>
                </div>

                {error && <p style={styles.error}><Bi name="exclamation-triangle-fill" />{error}</p>}
                {successMsg && <p style={styles.success}><Bi name="check-circle-fill" />{successMsg}</p>}

                {role === 'TEACHER' && myClassesLoaded && (
                    <div style={styles.infoNote}>
                        <Bi name="info-circle-fill" />
                        {myClasses.length === 0
                            ? <>You have no class or subjects assigned yet. Ask the administrator to make you a class teacher, or to give you subjects (Teachers → By Section).</>
                            : <>You can enter marks for <strong>every subject in your own class</strong>, for <strong>the subjects you teach</strong> in other classes, and for any class you are <strong>covering</strong> for a colleague.</>}
                    </div>
                )}

                {(role === 'TEACHER' || role === 'ADMIN') && (
                    <CoverPanel role={role} myClasses={myClasses} classes={classes}
                        onChanged={() => { if (role === 'TEACHER') fetchMyClasses(); }}
                        setError={setError} setSuccessMsg={setSuccessMsg} />
                )}

                <div style={{ ...styles.modeTabs, flexDirection: 'row' }}>
                    <button onClick={() => { if (mode === 'single' || !confirmDiscard()) return; setMode('single'); handleReset(); }} style={{
                        ...styles.modeTab,
                        backgroundColor: mode === 'single' ? '#1F3864' : 'white',
                        color: mode === 'single' ? 'white' : '#1F3864',
                        padding: isMobile ? '10px 8px' : '12px 15px',
                        fontSize: isMobile ? '13px' : '14px'
                    }}>
                        <span><Bi name="book" />{isMobile ? 'Single' : 'Single Subject'}</span>
                        {!isMobile && <span style={styles.modeTabDesc}>One subject at a time</span>}
                    </button>
                    <button onClick={() => { if (mode === 'multi' || !confirmDiscard()) return; setMode('multi'); handleReset(); }} style={{
                        ...styles.modeTab,
                        backgroundColor: mode === 'multi' ? '#1F3864' : 'white',
                        color: mode === 'multi' ? 'white' : '#1F3864',
                        padding: isMobile ? '10px 8px' : '12px 15px',
                        fontSize: isMobile ? '13px' : '14px'
                    }}>
                        <span><Bi name="journals" />{isMobile ? 'Multi' : 'Multiple Subjects'}</span>
                        {!isMobile && <span style={styles.modeTabDesc}>All subjects in one table</span>}
                    </button>
                </div>

                <div style={styles.card}>
                    <div style={{ ...styles.grid3, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)' }}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Bi name="building" />Class</label>
                            {role === 'TEACHER' ? (
                                myClasses.length === 1 ? (
                                    <div style={styles.classDisplay}>
                                        {classDisplayName(myClasses[0])}
                                        <span style={styles.lockedBadge}><Bi name="lock-fill" style={{ marginRight: '4px' }} />{myClasses[0].classTeacher ? 'Your Class' : (myClasses[0].subjectIds || []).length ? 'Your Subject' : 'Covering'}</span>
                                    </div>
                                ) : (
                                    <select style={styles.select} value={selectedClass}
                                        onChange={e => { if (!confirmDiscard()) return; setSelectedClass(e.target.value); handleReset(); }}>
                                        <option value="">{myClasses.length ? '-- Select one of your classes --' : 'No classes assigned'}</option>
                                        {myClasses.filter(c => c.classTeacher).length > 0 && (
                                            <optgroup label="Your class (all subjects)">
                                                {myClasses.filter(c => c.classTeacher).map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                                            </optgroup>
                                        )}
                                        {myClasses.filter(c => !c.classTeacher && (c.subjectIds || []).length).length > 0 && (
                                            <optgroup label="Classes you teach a subject in">
                                                {myClasses.filter(c => !c.classTeacher && (c.subjectIds || []).length).map(c => <option key={c.classId} value={String(c.classId)}>{myClassLabel(c)}</option>)}
                                            </optgroup>
                                        )}
                                        {myClasses.filter(c => !c.classTeacher && !(c.subjectIds || []).length && c.cover).length > 0 && (
                                            <optgroup label="Covering for a colleague">
                                                {myClasses.filter(c => !c.classTeacher && !(c.subjectIds || []).length && c.cover).map(c => <option key={c.classId} value={String(c.classId)}>{myClassLabel(c)}</option>)}
                                            </optgroup>
                                        )}
                                    </select>
                                )
                            ) : (
                                <select style={styles.select} value={selectedClass}
                                    onChange={e => { if (!confirmDiscard()) return; setSelectedClass(e.target.value); handleReset(); }}>
                                    <option value="">-- Select Class --</option>
                                    {classes.map(cls => (
                                        <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Bi name="file-earmark-text" />Exam</label>
                            <select style={styles.select} value={selectedExam}
                                onChange={e => { if (!confirmDiscard()) return; setSelectedExam(e.target.value); setMarks({}); setMultiMarks({}); setDirty({}); setSuccessMsg(''); }}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(exam => (
                                    <option key={exam.examId} value={exam.examId}>
                                        {exam.examName} — {exam.academicYear} Term {exam.term}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {mode === 'single' && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}><Bi name="book" />Subject</label>
                                <select style={styles.select} value={selectedSubject}
                                    onChange={e => { if (!confirmDiscard()) return; setSelectedSubject(e.target.value); setMarks({}); setDirty({}); setSuccessMsg(''); }}
                                    disabled={!activeClassId()}>
                                    <option value="">-- Select Subject --</option>
                                    {subjects.map(sub => (
                                        <option key={sub.subjectId} value={sub.subjectId}>{sub.subjectName}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {mode === 'multi' && step === 1 && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}>&nbsp;</label>
                                <button onClick={handleProceedToSubjectSelect}
                                    style={styles.proceedBtn}
                                    disabled={!activeClassId() || !selectedExam}>
                                    Continue<Bi name="arrow-right" style={{ marginLeft: '6px', marginRight: '6px' }} />Select Subjects
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {mode === 'single' && activeClassId() && selectedExam && selectedSubject && (
                    <div style={styles.tableCard}>
                        <div style={styles.tableTopBar}>
                            <div>
                                <h3 style={styles.tableTitle}>
                                    <Bi name="clipboard-data" />{subjects.find(s => String(s.subjectId) === String(selectedSubject))?.subjectName}
                                </h3>
                                <p style={styles.tableSubtitle}>{currentClsName} | {currentExamName}</p>
                            </div>
                            <div style={styles.tableBadges}>
                                {unsavedCount > 0 && (
                                    <span style={{ ...styles.badge, backgroundColor: '#fd7e14' }} title="Marks typed but not yet saved">
                                        <Bi name="exclamation-circle-fill" style={{ marginRight: '4px' }} />{unsavedCount} unsaved
                                    </span>
                                )}
                                <span style={styles.badge}><Bi name="people-fill" style={{ marginRight: '4px' }} />{students.length}</span>
                                <span style={styles.badge}><Bi name="check-circle-fill" style={{ marginRight: '4px' }} />{Object.values(marks).filter(m => m?.marks !== '' && m?.marks !== undefined).length}</span>
                            </div>
                        </div>
                        {loading ? <p style={styles.centerMsg}><Bi name="hourglass-split" />Loading students...</p> : students.length === 0 ? (
                            <p style={styles.centerMsg}><Bi name="exclamation-triangle" />No students found in this class</p>
                        ) : (
                            <>
                                {renderSearchBar(st => `mark-${st.studentId}`)}
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={styles.th}>#</th>
                                                <th style={styles.th}>Adm No</th>
                                                <th style={styles.th}>Student Name</th>
                                                <th style={styles.th}>Gender</th>
                                                <th style={styles.th}>Marks (0-100)</th>
                                                <th style={styles.th}>Grade</th>
                                                <th style={styles.th}>Status</th>
                                                <th style={styles.th}>Save</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.length === 0 && (
                                                <tr><td colSpan={8} style={styles.centerMsg}>No students match "{studentSearch}"</td></tr>
                                            )}
                                            {filteredStudents.map((student, index) => {
                                                const markData = marks[student.studentId];
                                                const invalid = isInvalidMark(markData?.marks); const grade = invalid ? null : getGrade(markData?.marks);
                                                return (
                                                    <tr key={student.studentId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={styles.td}>{students.indexOf(student) + 1}</td>
                                                        <td style={styles.td}><span style={styles.admNo}>{student.admissionNumber}</span></td>
                                                        <td style={styles.td}><strong>{student.firstName} {student.lastName}</strong></td>
                                                        <td style={styles.td}>
                                                            <span style={{ backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>
                                                                {student.gender}
                                                            </span>
                                                        </td>
                                                        <td style={styles.td}>
                                                            <input type="number" min="0" max="100"
                                                                id={`mark-${student.studentId}`}
                                                                onKeyDown={e => handleMarkKeyDown(e, student)}
                                                                onWheel={e => e.currentTarget.blur()}
                                                                style={{ ...styles.markInput, borderColor: invalid ? '#dc3545' : grade ? grade.color : '#ddd', backgroundColor: invalid ? '#fff3f3' : 'white' }}
                                                                title={invalid ? 'Marks must be between 0 and 100' : undefined}
                                                                value={markData?.marks ?? ''}
                                                                onChange={e => handleMarkChange(student.studentId, e.target.value)}
                                                                placeholder="—" />
                                                        </td>
                                                        <td style={styles.td}>
                                                            {grade && <span style={{ backgroundColor: grade.color, color: 'white', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px' }}>{grade.label}</span>}
                                                        </td>
                                                        <td style={styles.td}>
                                                            {studentSaveStatus[student.studentId] === 'saving'
                                                                ? <span style={styles.savingBadge}><Bi name="hourglass-split" style={{ marginRight: '4px' }} />Saving...</span>
                                                                : studentSaveStatus[student.studentId] === 'saved'
                                                                    ? <span style={styles.savedBadge}><Bi name="check-circle-fill" style={{ marginRight: '4px' }} />Saved</span>
                                                                    : studentSaveStatus[student.studentId] === 'error'
                                                                        ? <span style={styles.errorBadge}><Bi name="x-circle-fill" style={{ marginRight: '4px' }} />Failed</span>
                                                                        : markData?.exists ? <span style={styles.updateBadge}><Bi name="pencil-fill" style={{ marginRight: '4px' }} />Update</span>
                                                                            : markData?.marks ? <span style={styles.newBadge}><Bi name="plus-circle-fill" style={{ marginRight: '4px' }} />New</span>
                                                                            : <span style={styles.emptyBadge}>—</span>}
                                                        </td>
                                                        <td style={styles.td}>
                                                            <button
                                                                onClick={() => handleSaveStudent(student)}
                                                                style={styles.saveRowBtn}
                                                                title="Save this student"
                                                                disabled={studentSaveStatus[student.studentId] === 'saving'}>
                                                                <Bi name="save-fill" style={{ marginRight: 0 }} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={styles.saveSection}>
                                    <button onClick={handleSaveSingle} style={styles.saveBtn} disabled={saving}>
                                        {saving
                                            ? <><Bi name="hourglass-split" />Saving...</>
                                            : <><Bi name="save-fill" />Save All Marks</>}
                                    </button>
                                    <p style={styles.hint}>
                                        <Bi name="exclamation-triangle" style={{ marginRight: '4px' }} />Empty cells are <strong>not saved</strong>. Enter <strong>0</strong> for absent students or those who scored zero. Press <strong>Enter</strong> or the arrow keys to move between students.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {mode === 'multi' && step === 2 && (
                    <div style={styles.card}>
                        <div style={styles.subjectToolbar}>
                            <h3 style={styles.sectionTitle}><Bi name="journals" />Select Subjects Tested</h3>
                            <div style={styles.toolbarBtns}>
                                <button onClick={() => setSelectedSubjectIds(subjects.map(s => s.subjectId))} style={styles.selectAllBtn}>All</button>
                                <button onClick={() => setSelectedSubjectIds([])} style={styles.clearAllBtn}>Clear</button>
                            </div>
                        </div>
                        <p style={styles.subjectHint}><Bi name="check-circle-fill" style={{ marginRight: '4px', color: '#28a745' }} />{selectedSubjectIds.length}/{subjects.length} selected</p>
                        <div style={styles.subjectGrid}>
                            {subjects.map(sub => {
                                const isSelected = selectedSubjectIds.includes(sub.subjectId);
                                return (
                                    <div key={sub.subjectId} onClick={() => toggleSubject(sub.subjectId)}
                                        style={{ ...styles.subjectTile, backgroundColor: isSelected ? '#e8f5e9' : 'white', border: isSelected ? '2px solid #28a745' : '2px solid #f0f0f0', color: isSelected ? '#28a745' : '#333' }}>
                                        <Bi name={isSelected ? 'check-square-fill' : 'square'} style={{ ...styles.subjectCheck, marginRight: 0, color: isSelected ? '#28a745' : '#bbb' }} />
                                        <span style={styles.subjectName}>{sub.subjectName}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={handleProceedToMarkSheet} style={styles.proceedBtnLarge}
                            disabled={selectedSubjectIds.length === 0 || loading}>
                            {loading
                                ? <><Bi name="hourglass-split" />Loading...</>
                                : <>Continue<Bi name="arrow-right" style={{ marginLeft: '6px', marginRight: '6px' }} />Enter Marks ({selectedSubjectIds.length} subjects)</>}
                        </button>
                    </div>
                )}

                {mode === 'multi' && step === 3 && (
                    <div style={styles.tableCard}>
                        <div style={styles.tableTopBar}>
                            <div>
                                <h3 style={styles.tableTitle}>
                                    <Bi name="clipboard-data" />Multi-Subject Mark Sheet
                                </h3>
                                <p style={styles.tableSubtitle}>{currentClsName} | {currentExamName} | {selectedSubjectsForMulti.length} subjects</p>
                            </div>
                            <div style={styles.tableBadges}>
                                {unsavedCount > 0 && (
                                    <span style={{ ...styles.badge, backgroundColor: '#fd7e14' }} title="Marks typed but not yet saved">
                                        <Bi name="exclamation-circle-fill" style={{ marginRight: '4px' }} />{unsavedCount} unsaved
                                    </span>
                                )}
                                <span style={styles.badge}><Bi name="people-fill" style={{ marginRight: '4px' }} />{students.length}</span>
                                <span style={{ ...styles.badge, backgroundColor: '#28a745' }}><Bi name="check-circle-fill" style={{ marginRight: '4px' }} />{countMultiEntered()}</span>
                            </div>
                        </div>
                        {loading ? <p style={styles.centerMsg}><Bi name="hourglass-split" />Loading...</p> : (
                            <>
                                {renderSearchBar(st => `mark-${st.studentId}-${selectedSubjectsForMulti[0]?.subjectId}`)}
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={{ ...styles.th, position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 2 }}>#</th>
                                                <th style={{ ...styles.th, position: 'sticky', left: '50px', backgroundColor: '#f8f9fa', zIndex: 2, minWidth: '160px' }}>Student Name</th>
                                                {selectedSubjectsForMulti.map(sub => (
                                                    <th key={sub.subjectId} style={{ ...styles.th, textAlign: 'center', minWidth: '90px', backgroundColor: '#2E75B6', color: 'white', fontSize: '11px' }}>
                                                        {sub.subjectName}
                                                    </th>
                                                ))}
                                                <th style={{ ...styles.th, textAlign: 'center', backgroundColor: '#28a745', color: 'white', minWidth: '60px' }}>Save</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.length === 0 && (
                                                <tr><td colSpan={selectedSubjectsForMulti.length + 3} style={styles.centerMsg}>No students match "{studentSearch}"</td></tr>
                                            )}
                                            {filteredStudents.map((student, index) => (
                                                <tr key={student.studentId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                    <td style={{ ...styles.td, position: 'sticky', left: 0, backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', zIndex: 1 }}>{students.indexOf(student) + 1}</td>
                                                    <td style={{ ...styles.td, position: 'sticky', left: '50px', backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', zIndex: 1, borderRight: '2px solid #eee' }}>
                                                        <strong style={{ fontSize: '13px' }}>{student.firstName} {student.lastName}</strong>
                                                        <div style={{ fontSize: '11px', color: '#999' }}>{student.admissionNumber}</div>
                                                    </td>
                                                    {selectedSubjectsForMulti.map(subject => {
                                                        const markData = multiMarks[student.studentId]?.[subject.subjectId];
                                                        const invalid = isInvalidMark(markData?.marks); const grade = invalid ? null : getGrade(markData?.marks);
                                                        return (
                                                            <td key={subject.subjectId} style={{ ...styles.td, textAlign: 'center', padding: '4px' }}>
                                                                <div style={styles.multiMarkCell}>
                                                                    <input type="number" min="0" max="100"
                                                                        id={`mark-${student.studentId}-${subject.subjectId}`}
                                                                        onKeyDown={e => handleMarkKeyDown(e, student, subject.subjectId)}
                                                                        onWheel={e => e.currentTarget.blur()}
                                                                        style={{ ...styles.multiMarkInput, borderColor: invalid ? '#dc3545' : grade ? grade.color : '#ddd', backgroundColor: invalid ? '#fff3f3' : grade ? `${grade.color}15` : 'white' }}
                                                                        title={invalid ? 'Marks must be between 0 and 100' : undefined}
                                                                        value={markData?.marks ?? ''}
                                                                        onChange={e => handleMultiMarkChange(student.studentId, subject.subjectId, e.target.value)}
                                                                        placeholder="—" />
                                                                    {grade && <span style={{ fontSize: '10px', fontWeight: 'bold', color: grade.color }}>{grade.label}</span>}
                                                                    {markData?.exists && <span style={styles.savedDot}>●</span>}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ ...styles.td, textAlign: 'center', padding: '4px' }}>
                                                        {studentSaveStatus[student.studentId] === 'saving'
                                                            ? <span style={styles.savingBadge}><Bi name="hourglass-split" style={{ marginRight: 0 }} /></span>
                                                            : studentSaveStatus[student.studentId] === 'saved'
                                                                ? <span style={styles.savedBadge}><Bi name="check-circle-fill" style={{ marginRight: 0, fontSize: '14px' }} /></span>
                                                                : studentSaveStatus[student.studentId] === 'error'
                                                                    ? <button onClick={() => handleSaveStudent(student)} style={styles.retryBtn}><Bi name="x-circle-fill" style={{ marginRight: '4px' }} />Retry</button>
                                                                    : <button onClick={() => handleSaveStudent(student)} style={styles.saveRowBtn} title="Save this student"><Bi name="save-fill" style={{ marginRight: 0 }} /></button>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={styles.saveSection}>
                                    <button onClick={handleSaveMulti} style={styles.saveBtn} disabled={saving}>
                                        {saving
                                            ? <><Bi name="hourglass-split" />Saving...</>
                                            : <><Bi name="save-fill" />Save All Marks</>}
                                    </button>
                                    <button onClick={() => { if (!confirmDiscard()) return; setDirty({}); setStep(2); }} style={styles.backBtn}><Bi name="arrow-left" />Change Subjects</button>
                                    <p style={styles.hint}>
                                        <Bi name="exclamation-triangle" style={{ marginRight: '4px' }} />Empty cells are <strong>not saved</strong>. Enter <strong>0</strong> for absent or zero-score students. <strong>Enter</strong> / arrow keys move down a column, <strong>Tab</strong> moves across.
                                        ● = already saved in database.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'none' }}>
                <PrintableMarkSheet
                    ref={printRef}
                    students={students}
                    subjects={printSubjects}
                    className={currentClsName}
                    examName={currentExamName}
                    academicYear={currentExamObj?.academicYear || ''}
                    term={currentExamObj?.term || ''}
                />
            </div>
        </div>
        <Footer />
    </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1 },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' },
    headerBtns: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#888', margin: 0, fontSize: '14px' },
    resetBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px' },

    invigilatorCard: { backgroundColor: '#fff8e1', border: '2px solid #ffc107', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' },
    invigilatorRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    invigilatorTitle: { color: '#856404', fontSize: '15px', display: 'block', marginBottom: '4px' },
    invigilatorDesc: { color: '#856404', fontSize: '12px', margin: 0 },
    invigilatorBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    invigilatorBtnActive: { backgroundColor: '#fd7e14', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    invigilatorClassSelect: { marginTop: '12px' },
    invigilatingBadge: { backgroundColor: '#fff3e0', border: '1px solid #fd7e14', color: '#e65100', padding: '9px 14px', borderRadius: '8px', fontSize: '13px', marginTop: '10px', display: 'inline-block' },
    invigilatingNote: { color: '#999', fontSize: '11px' },
    invigilatorTag: { backgroundColor: '#fd7e14', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', marginLeft: '8px' },

    modeTabs: { display: 'flex', gap: '10px', marginBottom: '20px' },
    modeTab: { flex: 1, padding: '12px 15px', borderRadius: '10px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    modeTabDesc: { fontSize: '11px', fontWeight: 'normal', opacity: 0.8 },

    card: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    select: { padding: '10px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    infoNote: { backgroundColor: '#eef5fc', border: '1px solid #cfe2f5', color: '#1F3864', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', lineHeight: 1.5 },
    classDisplay: { padding: '10px 15px', borderRadius: '8px', border: '2px solid #1F3864', fontSize: '14px', backgroundColor: '#e3f2fd', color: '#1F3864', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    lockedBadge: { backgroundColor: '#1F3864', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' },
    proceedBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    proceedBtnLarge: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '13px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%', marginTop: '15px' },

    subjectToolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    sectionTitle: { color: '#1F3864', margin: 0, fontSize: '16px', fontWeight: 700 },
    toolbarBtns: { display: 'flex', gap: '8px' },
    selectAllBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
    clearAllBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
    subjectHint: { color: '#888', fontSize: '13px', marginBottom: '12px' },
    subjectGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '15px' },
    subjectTile: { padding: '13px 10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    subjectCheck: { fontSize: '18px', flexShrink: 0 },
    subjectName: { fontSize: '13px', fontWeight: 'bold' },

    tableCard: { backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '20px' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px', fontWeight: 700 },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    tableBadges: { display: 'flex', gap: '8px' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' },
    centerMsg: { padding: '40px', textAlign: 'center', color: '#666' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
    thead: { backgroundColor: '#f8f9fa' },
    th: { padding: '11px 12px', textAlign: 'left', fontWeight: 'bold', color: '#1F3864', borderBottom: '2px solid #eee', whiteSpace: 'nowrap', fontSize: '12px' },
    td: { padding: '9px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    admNo: { fontFamily: 'monospace', fontSize: '11px', color: '#888' },
    markInput: { width: '90px', padding: '7px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', textAlign: 'center', outline: 'none' },
    multiMarkCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', position: 'relative' },
    multiMarkInput: { width: '65px', padding: '5px 3px', borderRadius: '6px', border: '2px solid #ddd', fontSize: '16px', textAlign: 'center', outline: 'none' },
    savedDot: { position: 'absolute', top: 0, right: 0, color: '#2E75B6', fontSize: '10px' },
    updateBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' },
    newBadge: { backgroundColor: '#d4edda', color: '#155724', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' },
    emptyBadge: { color: '#aaa', fontSize: '12px' },
    saveSection: { padding: '16px 20px', borderTop: '2px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: '#f8f9fa' },
    saveRowBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
    retryBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' },
    savingBadge: { color: '#fd7e14', fontSize: '11px', fontWeight: 'bold' },
    savedBadge: { color: '#28a745', fontSize: '11px', fontWeight: 'bold' },
    errorBadge: { color: '#dc3545', fontSize: '11px', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '11px 30px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '11px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' },
    hint: { color: '#888', fontSize: '12px', fontStyle: 'italic', margin: 0 },

    searchBar: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '2px solid #f0f2f5', flexWrap: 'wrap' },
    searchBox: { display: 'flex', alignItems: 'center', flex: 1, minWidth: '240px', maxWidth: '480px', border: '2px solid #ddd', borderRadius: '10px', padding: '0 10px', backgroundColor: 'white' },
    searchInput: { flex: 1, border: 'none', outline: 'none', padding: '10px 0', fontSize: '16px', backgroundColor: 'transparent' },
    searchClear: { background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '4px', fontSize: '13px' },
    searchCount: { color: '#1F3864', fontSize: '13px', fontWeight: 600 },
};

const pStyles = {
    page: { padding: '15px', fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '10px' },
    header: { borderBottom: '3px solid #1F3864', paddingBottom: '10px', marginBottom: '10px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
    logo: { width: '70px', height: '70px', objectFit: 'contain' },
    schoolInfo: { textAlign: 'center', flex: 1, padding: '0 10px' },
    schoolName: { color: '#1F3864', fontSize: '13px', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 'bold' },
    motto: { color: '#2E75B6', fontStyle: 'italic', margin: '0 0 3px 0', fontSize: '11px' },
    contact: { fontSize: '10px', color: '#666', margin: 0 },
    sheetTitleBar: { backgroundColor: '#1F3864', padding: '5px', textAlign: 'center' },
    sheetTitle: { color: 'white', margin: 0, fontSize: '13px' },
    infoRow: { display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #ddd', marginBottom: '8px', fontSize: '10px' },
    infoItem: { fontSize: '10px' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '9px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '5px 6px', textAlign: 'left', border: '1px solid #999', fontWeight: 'bold', whiteSpace: 'nowrap' },
    stickyCol: { width: '25px', textAlign: 'center' },
    admCol: { minWidth: '70px' },
    nameCol: { minWidth: '130px' },
    subjectTh: { backgroundColor: '#2E75B6', color: 'white', padding: '2px', textAlign: 'center', border: '1px solid #999', width: '55px', verticalAlign: 'bottom' },
    rotatedHeader: { writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: '9px', padding: '4px 2px', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    td: { padding: '4px 5px', border: '1px solid #ccc', fontSize: '9px' },
    markTd: { padding: '4px', border: '1px solid #ccc', width: '55px', minHeight: '22px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    avgRow: { backgroundColor: '#e3f2fd', fontWeight: 'bold' },
    footer: { display: 'flex', gap: '20px', marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '12px' },
    signBox: { flex: 1 },
    signLabel: { fontSize: '10px', margin: '0 0 8px 0', color: '#333' },
    footerNote: { textAlign: 'center', fontSize: '9px', color: '#999', marginTop: '10px' }
};

export default MarkEntry;
