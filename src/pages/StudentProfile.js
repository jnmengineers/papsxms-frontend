import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { gradeOf as scaleGrade, pctColor, gradeColor as scaleColor } from '../utils/grading';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import Spinner from '../components/Spinner';
import { classDisplayName, streamLabel } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

// ── Helpers ───────────────────────────────────────────────────────────────────
const Bi = ({ name, style }) => (
    <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />
);

const num = (v) => { const n = Number(v); return v === null || v === undefined || v === '' || isNaN(n) ? null : n; };

// Grades come from the Grading Scales table (utils/grading), same as every other page
const gradeOf = (pct) => scaleGrade(pct);
const gradeColor = (g) => scaleColor(g);
const fmtPct = (v) => v === null ? '-' : v.toFixed(1) + '%';

// A result as a percentage (marks may be out of something other than 100)
const resultPct = (r) => {
    const m = num(r.marksObtained);
    if (m === null) return null;
    const max = num(r.maxMarks) || 100;
    return Math.min(100, Math.max(0, (m / max) * 100));
};

// Newest exam first: year, then term, then exam id
const examSortKey = (exam) => [num(exam?.academicYear) ?? 0, num(exam?.term) ?? 0, num(exam?.examId) ?? 0];
const newestFirst = (a, b) => {
    const A = examSortKey(a), B = examSortKey(b);
    return B[0] - A[0] || B[1] - A[1] || B[2] - A[2];
};

const fmtDate = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isMale = (g) => String(g || '').toUpperCase().startsWith('M');

function StudentProfile() {
    useSchoolSettings();   // re-draws when the grading scale (database) has loaded
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [student, setStudent] = useState(null);
    const [results, setResults] = useState([]);
    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const latestRequest = useRef(null);

    useEffect(() => { setActiveTab('overview'); fetchAll(); }, [studentId]);

    // Load one student directly; fall back to the full list if that endpoint doesn't exist
    const fetchStudent = async () => {
        try {
            const r = await api.get(`/api/students/${studentId}`);
            if (r.data && String(r.data.studentId) === String(studentId)) return r.data;
        } catch (e) { /* fall through */ }
        const all = await api.get('/api/students');
        return (all.data || []).find(s => String(s.studentId) === String(studentId)) || null;
    };

    const fetchAll = async () => {
        const requestId = studentId;
        latestRequest.current = requestId;
        setLoading(true); setError(''); setWarning('');
        const [studentRes, resultsRes, cardsRes] = await Promise.allSettled([
            fetchStudent(),
            api.get(`/api/results/by-student/${studentId}`),
            api.get(`/api/reportCards/by-student/${studentId}`)
        ]);
        if (latestRequest.current !== requestId) return; // user opened another student meanwhile

        if (studentRes.status === 'rejected') {
            setError('Could not load this student. Check your connection and try again.');
            setStudent(null);
        } else {
            setStudent(studentRes.value);
        }
        setResults(resultsRes.status === 'fulfilled' ? (resultsRes.value.data || []) : []);
        setReportCards(cardsRes.status === 'fulfilled' ? [...(cardsRes.value.data || [])].sort((a, b) => newestFirst(a.exam, b.exam)) : []);
        const failed = [resultsRes.status === 'rejected' && 'results', cardsRes.status === 'rejected' && 'report cards'].filter(Boolean);
        if (failed.length) setWarning(`Some information couldn't be loaded (${failed.join(' and ')}). Try again.`);
        setLoading(false);
    };

    const goBack = () => { if (window.history.length > 1) navigate(-1); else navigate('/students'); };

    // Group results by EXAM (not exam name — every term has an "End Term")
    const examGroups = Object.values(results.reduce((acc, r) => {
        const key = r.exam?.examId != null ? String(r.exam.examId) : 'unknown';
        if (!acc[key]) acc[key] = { exam: r.exam || null, results: [] };
        acc[key].results.push(r);
        return acc;
    }, {}))
        .sort((a, b) => newestFirst(a.exam, b.exam))
        .map(g => {
            const rows = [...g.results].sort((a, b) => String(a.subject?.subjectName || '').localeCompare(String(b.subject?.subjectName || '')));
            const pcts = rows.map(resultPct).filter(p => p !== null);
            return { ...g, results: rows, avg: pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null };
        });

    const allPcts = results.map(resultPct).filter(p => p !== null);
    const overallAvg = allPcts.length ? allPcts.reduce((s, p) => s + p, 0) / allPcts.length : null;

    const examLabel = (exam) => exam
        ? `${exam.examName || 'Exam'} — Term ${exam.term ?? '-'} ${exam.academicYear ?? ''}`.trim()
        : 'Unknown exam';

    // Plain function, not a component: keeps Navbar/Sidebar mounted between renders
    const shell = (children) => (
        <div style={styles.container}>
            <Navbar rightContent={
                <button onClick={goBack} style={styles.navBackBtn}><Bi name="arrow-left" />Back</button>
            } />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>{children}</div>
            </div>
            <Footer />
        </div>
    );

    if (loading) return shell(
        <>
            <div style={{ padding: '60px 0' }}><Spinner message="Loading student profile..." size="large" /></div>
        </>
    );

    if (!student) return shell(
        <>
            <div style={styles.emptyState}>
                <Bi name={error ? 'wifi-off' : 'person-x'} style={{ ...styles.emptyIcon, marginRight: 0 }} />
                <h3 style={{ color: '#1F3864' }}>{error ? 'Could not load profile' : 'Student not found'}</h3>
                <p style={{ color: '#666' }}>{error || 'This student may have been removed, or the link is wrong.'}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap' }}>
                    {error && <button onClick={fetchAll} style={styles.primaryBtn}><Bi name="arrow-clockwise" />Try again</button>}
                    <button onClick={() => navigate('/students')} style={styles.secondaryBtn}><Bi name="people-fill" />All Students</button>
                </div>
            </div>
        </>
    );

    const className = student.className || student.schoolClass?.className;
    const stream = student.stream || student.schoolClass?.stream;
    const genderColor = isMale(student.gender) ? '#2E75B6' : '#e83e8c';

    const tabs = [
        { id: 'overview', icon: 'grid-1x2-fill', label: 'Overview' },
        { id: 'results', icon: 'journal-text', label: `Results (${results.length})` },
        { id: 'reportcards', icon: 'clipboard-data', label: `Report Cards (${reportCards.length})` },
    ];

    return shell(
        <>
            {warning && <p style={styles.warning}><Bi name="exclamation-circle-fill" />{warning} <button onClick={fetchAll} style={styles.linkBtn}>Retry</button></p>}

            {/* Profile Header */}
            <div style={styles.profileHeader}>
                <div style={styles.avatarSection}>
                    <div style={{ ...styles.avatar, backgroundColor: genderColor }}>
                        {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                    </div>
                    <div>
                        <h2 style={styles.studentName}>{student.firstName} {student.lastName}</h2>
                        <p style={styles.studentMeta}>
                            <span style={styles.metaBadge}><Bi name="person-vcard" style={{ marginRight: '4px' }} />{student.admissionNumber || '-'}</span>
                            {student.gender && <span style={{ ...styles.metaBadge, backgroundColor: genderColor, color: 'white' }}>{student.gender}</span>}
                            {className && <span style={styles.metaBadge}><Bi name="building" style={{ marginRight: '4px' }} />{classDisplayName({ className, stream })}</span>}
                        </p>
                    </div>
                </div>

                <div style={styles.quickStats}>
                    <div style={styles.quickStat}>
                        <div style={{ ...styles.quickStatNum, color: pctColor(overallAvg) }}>{fmtPct(overallAvg)}</div>
                        <div style={styles.quickStatLabel}>Overall Avg</div>
                    </div>
                    <div style={styles.quickStat}>
                        <div style={{ ...styles.quickStatNum, color: '#6f42c1' }}>{results.length}</div>
                        <div style={styles.quickStatLabel}>Marks Recorded</div>
                    </div>
                    <div style={styles.quickStat}>
                        <div style={{ ...styles.quickStatNum, color: '#20c997' }}>{reportCards.length}</div>
                        <div style={styles.quickStatLabel}>Report Cards</div>
                    </div>
                    <div style={styles.quickStat}>
                        <div style={{ ...styles.quickStatNum, color: '#1F3864' }}>{examGroups.length}</div>
                        <div style={styles.quickStatLabel}>Exams Taken</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={styles.tabs} role="tablist">
                {tabs.map(t => (
                    <button key={t.id} role="tab" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)}
                        style={{ ...styles.tab, backgroundColor: activeTab === t.id ? '#1F3864' : 'white', color: activeTab === t.id ? 'white' : '#1F3864' }}>
                        <Bi name={t.icon} />{t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div>
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}><Bi name="person-fill" />Student Details</h3>
                        <div style={styles.detailGrid}>
                            {[
                                { label: 'Full Name', value: `${student.firstName || ''} ${student.lastName || ''}`.trim() || '-' },
                                { label: 'Admission Number', value: student.admissionNumber || '-' },
                                { label: 'Gender', value: student.gender || '-' },
                                { label: 'Date of Birth', value: fmtDate(student.dateOfBirth) },
                                { label: 'Class', value: className || '-' },
                                { label: 'Stream', value: (stream && streamLabel(stream)) || 'N/A' },
                            ].map((item, i) => (
                                <div key={i} style={styles.detailItem}>
                                    <span style={styles.detailLabel}>{item.label}</span>
                                    <span style={styles.detailValue}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {examGroups.length > 0 && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}><Bi name="graph-up-arrow" />Performance History</h3>
                            <div style={styles.performanceGrid}>
                                {examGroups.map(g => {
                                    const card = reportCards.find(c => String(c.exam?.examId) === String(g.exam?.examId));
                                    return (
                                        <div key={g.exam?.examId ?? 'unknown'} style={{ ...styles.perfCard, borderLeft: `4px solid ${pctColor(g.avg)}` }}>
                                            <div style={styles.perfExam}>{g.exam?.examName || 'Unknown exam'}</div>
                                            <div style={styles.perfTerm}>Term {g.exam?.term ?? '-'} • {g.exam?.academicYear ?? '-'}</div>
                                            <div style={{ ...styles.perfAvg, color: pctColor(g.avg) }}>
                                                {fmtPct(g.avg)}
                                                <span style={{ ...styles.gradePill, backgroundColor: gradeColor(gradeOf(g.avg)) }}>{gradeOf(g.avg)}</span>
                                            </div>
                                            <div style={styles.perfDetails}>
                                                {g.results.length} subject{g.results.length !== 1 ? 's' : ''}
                                                {card && <> | Class rank: {card.classRank || '-'}</>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'results' && (
                <div>
                    {examGroups.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Bi name="journal-x" style={{ ...styles.emptyIcon, marginRight: 0 }} />
                            <p>No marks have been recorded for this student yet</p>
                        </div>
                    ) : examGroups.map(g => (
                        <div key={g.exam?.examId ?? 'unknown'} style={styles.card}>
                            <h3 style={{ ...styles.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                <span><Bi name="journal-text" />{examLabel(g.exam)}</span>
                                <span style={{ fontSize: '14px', color: pctColor(g.avg) }}>Average: {fmtPct(g.avg)}</span>
                            </h3>
                            <div style={styles.tableWrapper}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.tableHeader}>
                                            <th style={styles.th}>#</th>
                                            <th style={styles.th}>Subject</th>
                                            <th style={styles.th}>Marks</th>
                                            <th style={styles.th}>Max</th>
                                            <th style={styles.th}>%</th>
                                            <th style={styles.th}>Grade</th>
                                            <th style={styles.th}>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {g.results.map((r, i) => {
                                            const pct = resultPct(r);
                                            const grade = gradeOf(pct);
                                            return (
                                                <tr key={r.resultId ?? i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                    <td style={styles.td}>{i + 1}</td>
                                                    <td style={styles.td}>{r.subject?.subjectName || '-'}</td>
                                                    <td style={styles.td}><strong>{num(r.marksObtained) ?? '-'}</strong></td>
                                                    <td style={styles.td}>{num(r.maxMarks) || 100}</td>
                                                    <td style={styles.td}>
                                                        <div style={styles.progressBar}>
                                                            <div style={{ ...styles.progressFill, width: `${pct ?? 0}%`, backgroundColor: pctColor(pct) }} />
                                                            <span style={styles.progressText}>{fmtPct(pct)}</span>
                                                        </div>
                                                    </td>
                                                    <td style={styles.td}><span style={{ ...styles.gradeBadge, backgroundColor: gradeColor(grade) }}>{grade}</span></td>
                                                    <td style={styles.td}>{r.remarks || <span style={{ color: '#bbb' }}>-</span>}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                    <p style={styles.legend}>
                        <Bi name="info-circle" />Grades: EE 75–100 · ME 55–74 · AE 40–54 · BE 0–39
                    </p>
                </div>
            )}

            {activeTab === 'reportcards' && (
                <div>
                    {reportCards.length === 0 ? (
                        <div style={styles.emptyState}>
                            <Bi name="clipboard-x" style={{ ...styles.emptyIcon, marginRight: 0 }} />
                            <p>No report cards have been generated for this student yet</p>
                        </div>
                    ) : (
                        <div style={styles.reportCardGrid}>
                            {reportCards.map((card, i) => {
                                const avg = num(card.averageMarks);
                                return (
                                    <div key={card.reportId ?? i} style={styles.reportCard}>
                                        <div style={{ ...styles.rcHeader, backgroundColor: avg === null ? '#6c757d' : pctColor(avg) }}>
                                            <h3 style={styles.rcExam}>{card.exam?.examName || 'Exam'}</h3>
                                            <p style={styles.rcTerm}>Term {card.exam?.term ?? '-'} • {card.exam?.academicYear ?? '-'}</p>
                                        </div>
                                        <div style={styles.rcBody}>
                                            <div style={styles.rcStats}>
                                                <div style={styles.rcStat}>
                                                    <div style={{ ...styles.rcStatNum, color: pctColor(avg) }}>{fmtPct(avg)}</div>
                                                    <div style={styles.rcStatLabel}>Average</div>
                                                </div>
                                                <div style={styles.rcStat}>
                                                    <div style={styles.rcStatNum}>{num(card.totalMarks) ?? '-'}</div>
                                                    <div style={styles.rcStatLabel}>Total</div>
                                                </div>
                                                <div style={styles.rcStat}>
                                                    <div style={styles.rcStatNum}>{card.classRank || '-'}</div>
                                                    <div style={styles.rcStatLabel}>Class Rank</div>
                                                </div>
                                                <div style={styles.rcStat}>
                                                    <div style={styles.rcStatNum}>{card.termRank || '-'}</div>
                                                    <div style={styles.rcStatLabel}>Grade Rank</div>
                                                </div>
                                            </div>
                                            {card.teacherComment && <div style={styles.rcComment}><strong>Teacher:</strong> {card.teacherComment}</div>}
                                            {card.principalComment && <div style={styles.rcComment}><strong>Principal:</strong> {card.principalComment}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    navBackBtn: { backgroundColor: 'transparent', color: 'white', border: '1.5px solid rgba(255,255,255,0.4)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' },
    warning: { color: '#856404', padding: '10px 15px', backgroundColor: '#fff8e1', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffc107' },
    linkBtn: { background: 'none', border: 'none', color: '#1F3864', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold', padding: 0, marginLeft: '6px' },
    primaryBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    secondaryBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },

    profileHeader: { backgroundColor: 'white', padding: '25px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' },
    avatarSection: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
    avatar: { width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '28px', flexShrink: 0 },
    studentName: { color: '#1F3864', margin: '0 0 8px 0', fontSize: '22px', fontWeight: 800 },
    studentMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: 0 },
    metaBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    quickStats: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    quickStat: { textAlign: 'center', backgroundColor: '#f8f9fa', padding: '15px 20px', borderRadius: '10px', minWidth: '90px' },
    quickStatNum: { fontSize: '26px', fontWeight: 'bold' },
    quickStatLabel: { color: '#666', fontSize: '12px', marginTop: '4px' },

    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '10px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s' },

    card: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    cardTitle: { color: '#1F3864', margin: '0 0 15px 0', borderBottom: '2px solid #f0f2f5', paddingBottom: '10px', fontSize: '17px' },
    detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' },
    detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
    detailLabel: { fontSize: '12px', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' },
    detailValue: { fontSize: '14px', color: '#333', fontWeight: 'bold' },

    performanceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' },
    perfCard: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '10px' },
    perfExam: { fontWeight: 'bold', color: '#1F3864', fontSize: '14px', marginBottom: '3px' },
    perfTerm: { color: '#999', fontSize: '12px', marginBottom: '8px' },
    perfAvg: { fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' },
    gradePill: { color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '10px' },
    perfDetails: { color: '#666', fontSize: '12px' },

    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    progressBar: { position: 'relative', backgroundColor: '#e9ecef', borderRadius: '10px', height: '18px', minWidth: '80px', overflow: 'hidden' },
    progressFill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '10px' },
    progressText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#1F3864', lineHeight: '18px', textShadow: '0 0 3px rgba(255,255,255,0.9)' },
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' },
    legend: { color: '#666', fontSize: '12px', margin: '0 0 20px 0' },

    reportCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' },
    reportCard: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    rcHeader: { padding: '15px', color: 'white' },
    rcExam: { margin: '0 0 4px 0', fontSize: '15px' },
    rcTerm: { margin: 0, fontSize: '12px', opacity: 0.9 },
    rcBody: { padding: '15px' },
    rcStats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' },
    rcStat: { textAlign: 'center' },
    rcStatNum: { fontSize: '18px', fontWeight: 'bold', color: '#1F3864' },
    rcStatLabel: { fontSize: '10px', color: '#999' },
    rcComment: { fontSize: '12px', color: '#666', backgroundColor: '#f8f9fa', padding: '8px', borderRadius: '6px', marginBottom: '6px' },

    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px', display: 'inline-block', color: '#BDD7EE' }
};

export default StudentProfile;
