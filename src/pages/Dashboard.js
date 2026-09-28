import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { pctColor } from '../utils/grading';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { SECTIONS_LIVE, SECTION_OF_GRADE_LIVE } from '../utils/schoolData';

// Sections come from School Settings
const SECTIONS = SECTIONS_LIVE;
const SECTION_OF_GRADE = SECTION_OF_GRADE_LIVE;

const num = (v) => { const n = Number(v); return v === null || v === undefined || v === '' || isNaN(n) ? null : n; };
// A result as a percentage — marks may not always be out of 100
const pctOf = (r) => { const m = num(r.marksObtained); if (m === null) return null; const max = num(r.maxMarks) || 100; return Math.max(0, Math.min(100, (m / max) * 100)); };
const isActiveTerm = (y) => !!(y?.isActive ?? y?.active);
const examKey = (e) => [num(e?.academicYear) ?? 0, num(e?.term) ?? 0, num(e?.examId) ?? 0];
const newer = (a, b) => { const A = examKey(a), B = examKey(b); return (A[0] - B[0]) || (A[1] - B[1]) || (A[2] - B[2]); };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const getBarColor = (avg) => pctColor(avg);   // colours from the Grading Scales table

function Dashboard() {
    useSchoolSettings();   // re-draws when the grading scale (database) has loaded
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const displayName = localStorage.getItem('displayName') || username;
    const role = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');
    const isAdmin = role === 'ADMIN';
    const isAccountant = role === 'ACCOUNTANT';
    const isTeacherScoped = role === 'TEACHER' && !!linkedClassId && linkedClassId !== 'null';

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({});
    const [unavailable, setUnavailable] = useState([]);
    const [subjectPerformance, setSubjectPerformance] = useState({ exam: null, rows: [] });
    const [sectionStats, setSectionStats] = useState([]);
    const [currentTerm, setCurrentTerm] = useState(null);

    useEffect(() => { fetchStats(); }, []);

    const fetchStats = async () => {
        // Only ask for what this role actually uses; one refused request no longer blanks the page
        // The clerk (school secretary) sees the whole school, like the admin, minus staff/user figures
        // The clerk (school secretary) sees the whole school; the bursar only needs the current term
        const wanted = isAccountant ? ['academicYears']
            : isAdmin
                ? ['students', 'teachers', 'exams', 'results', 'reportCards', 'classes', 'subjects', 'users', 'academicYears']
                : ['students', 'exams', 'results', 'reportCards', 'classes', 'academicYears'];
        const urls = {
            students: '/api/students', teachers: '/api/teachers', exams: '/api/exams', results: '/api/results',
            reportCards: '/api/reportCards', classes: '/api/classes', subjects: '/api/subjects', users: '/api/users',
            academicYears: '/api/academic-years'
        };
        const outs = await Promise.allSettled(wanted.map(k => api.get(urls[k])));
        const data = {};
        const failed = [];
        wanted.forEach((k, i) => {
            if (outs[i].status === 'fulfilled') data[k] = outs[i].value.data || [];
            else if (k !== 'academicYears') failed.push(k);
        });
        setUnavailable(failed);

        const years = data.academicYears || [];
        setCurrentTerm(years.find(isActiveTerm) || null);

        // Teachers see their own class; admins see the whole school
        const inScope = (studentId) => !isTeacherScoped || myStudentIds.has(String(studentId));
        const myStudents = (data.students || []).filter(s => !isTeacherScoped || String(s.schoolClass?.classId) === String(linkedClassId));
        const myStudentIds = new Set(myStudents.map(s => String(s.studentId)));
        const results = (data.results || []).filter(r => inScope(r.student?.studentId));
        const reportCards = (data.reportCards || []).filter(c => inScope(c.student?.studentId));

        setStats({
            students: data.students ? myStudents.length : null,
            teachers: data.teachers ? data.teachers.length : null,
            exams: data.exams ? data.exams.length : null,
            studentsWithResults: data.results ? new Set(results.map(r => r.student?.studentId).filter(Boolean)).size : null,
            reportCards: data.reportCards ? reportCards.length : null,
            classes: data.classes ? data.classes.length : null,
            subjects: data.subjects ? data.subjects.length : null,
            users: data.users ? data.users.length : null
        });

        // Subject averages for the MOST RECENT exam that has marks — mixing every exam of every
        // year, and Pre-School "Mathematics" with Grade 9 "Mathematics", gave meaningless numbers
        if (results.length) {
            const latest = results.map(r => r.exam).filter(Boolean).sort(newer).pop();
            const examResults = results.filter(r => String(r.exam?.examId) === String(latest?.examId));
            const bySubject = {};
            examResults.forEach(r => {
                const s = r.subject; const p = pctOf(r);
                if (!s?.subjectId || p === null) return;
                if (!bySubject[s.subjectId]) bySubject[s.subjectId] = { name: s.subjectName, gradeLevel: s.gradeLevel, total: 0, count: 0 };
                bySubject[s.subjectId].total += p; bySubject[s.subjectId].count++;
            });
            const rows = Object.values(bySubject).map(v => ({ ...v, avg: Math.round(v.total / v.count) }));
            // Same subject name in two sections → add the section so they can be told apart
            const nameCount = {};
            rows.forEach(r => { nameCount[r.name] = (nameCount[r.name] || 0) + 1; });
            rows.forEach(r => {
                if (nameCount[r.name] > 1) {
                    const sec = SECTIONS.find(s => s.key === SECTION_OF_GRADE[String(r.gradeLevel || '').toUpperCase()]);
                    r.name = `${r.name} (${sec ? sec.short : r.gradeLevel || '?'})`;
                }
            });
            setSubjectPerformance({ exam: latest, rows: rows.sort((a, b) => b.avg - a.avg).slice(0, 8) });
        } else setSubjectPerformance({ exam: null, rows: [] });

        if (data.classes && data.students) {
            const classById = Object.fromEntries(data.classes.map(c => [String(c.classId), c]));
            setSectionStats(SECTIONS.map(s => ({
                ...s,
                count: data.classes.filter(c => c.section === s.key).length,
                students: data.students.filter(st => classById[String(st.schoolClass?.classId)]?.section === s.key).length
            })));
        }
        setLoading(false);
    };

    // Counts are "–" while loading or if the server refused, never a misleading 0
    const show = (v) => (loading ? '…' : v === null || v === undefined ? '–' : v);

    const allMenuItems = [
        { icon: 'bi-mortarboard-fill', label: 'Students', path: '/students', count: stats.students, unit: 'students', color: '#2E75B6', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: 'bi-person-workspace', label: 'Teachers', path: '/teachers', count: stats.teachers, unit: 'teachers', color: '#1F3864', roles: ['ADMIN'] },
        { icon: 'bi-building', label: 'Classes', path: '/classes', count: stats.classes, unit: 'classes', color: '#28a745', roles: ['ADMIN'] },
        { icon: 'bi-book-fill', label: 'Subjects', path: '/subjects', count: stats.subjects, unit: 'subjects', color: '#fd7e14', roles: ['ADMIN'] },
        { icon: 'bi-file-earmark-text-fill', label: 'Exams', path: '/exams', count: stats.exams, unit: 'exams', color: '#6f42c1', roles: ['ADMIN'] },
        { icon: 'bi-bar-chart-fill', label: 'Results', path: '/results', count: stats.studentsWithResults, unit: 'students with marks', color: '#e83e8c', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: 'bi-clipboard-data-fill', label: 'Report Cards', path: '/reportcards', count: stats.reportCards, unit: 'cards', color: '#20c997', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: 'bi-pencil-square', label: 'Mark Entry', path: '/mark-entry', color: '#28a745', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: 'bi-calendar2-check-fill', label: 'Attendance', path: '/attendance', color: '#0d9488', roles: ['ADMIN', 'TEACHER'] },
        { icon: 'bi-graph-up-arrow', label: 'Progressive Report', path: '/progressive-report', color: '#e07a2f', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: 'bi-link-45deg', label: 'Class Subjects', path: '/class-subjects', color: '#17a2b8', roles: ['ADMIN'] },
        { icon: 'bi-pie-chart-fill', label: 'Section Report', path: '/section-report', color: '#6f42c1', roles: ['ADMIN'] },
        { icon: 'bi-calendar3', label: 'Academic Years', path: '/academic-years', color: '#17a2b8', roles: ['ADMIN'] },
        { icon: 'bi-calendar-check-fill', label: 'Exam Schedules', path: '/exam-schedules', color: '#b8860b', roles: ['ADMIN'] },
        { icon: 'bi-sliders', label: 'Grading Scales', path: '/grading-scales', color: '#dc3545', roles: ['ADMIN'] },
        { icon: 'bi-people-fill', label: 'Users', path: '/users', count: stats.users, unit: 'users', color: '#343a40', roles: ['ADMIN'] },
        { icon: 'bi-cash-stack', label: 'Finance', path: '/finance', color: '#0f766e', roles: ['ADMIN', 'ACCOUNTANT'] },
        { icon: 'bi-bus-front-fill', label: 'Transport', path: '/transport', color: '#b45309', roles: ['ADMIN', 'ACCOUNTANT'] },
        { icon: 'bi-key-fill', label: 'Change Password', path: '/change-password', color: '#6c757d', roles: ['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT'] },
        { icon: 'bi-box-arrow-in-down', label: 'Import Data', path: '/import', color: '#17a2b8', roles: ['ADMIN'] },
        { icon: 'bi-gear-fill', label: 'School Settings', path: '/settings', color: '#475569', roles: ['ADMIN'] },
    ];
    const menuItems = allMenuItems.filter(item => item.roles.includes(role));

    const statItems = [
        { label: isTeacherScoped ? 'My Students' : 'Students', value: stats.students, color: '#2E75B6', icon: 'bi-mortarboard-fill', path: '/students' },
        ...(isAdmin ? [
            { label: 'Teachers', value: stats.teachers, color: '#1F3864', icon: 'bi-person-workspace', path: '/teachers' },
            { label: 'Classes', value: stats.classes, color: '#28a745', icon: 'bi-building', path: '/classes' },
        ] : []),
        { label: 'Exams', value: stats.exams, color: '#6f42c1', icon: 'bi-file-earmark-text-fill', path: isAdmin ? '/exams' : '/results' },
        { label: 'Students with Marks', value: stats.studentsWithResults, color: '#e83e8c', icon: 'bi-bar-chart-fill', path: '/results' },
        { label: 'Report Cards', value: stats.reportCards, color: '#20c997', icon: 'bi-clipboard-data-fill', path: '/reportcards' },
    ];

    // Real links: keyboard reachable, Ctrl/Cmd-click opens a new tab
    const linkClick = (e, path) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); navigate(path);
    };
    const hoverOn = (color) => e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; if (color) e.currentTarget.style.borderColor = color; };
    const hoverOff = e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'transparent'; };

    const sp = subjectPerformance;

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <h2 style={styles.welcome}>
                        {greeting()}, {displayName}!
                    </h2>
                    <p style={styles.subtitle}>
                        {isTeacherScoped && linkedClassName ? <>Class teacher — <strong>{linkedClassName}</strong> · </> : null}
                        {currentTerm
                            ? <>Current term: <strong>{currentTerm.yearLabel} Term {currentTerm.term}</strong></>
                            : 'Exam Management System — Dashboard'}
                    </p>

                    {unavailable.length > 0 && (
                        <div style={styles.notice}>
                            <i className="bi bi-info-circle-fill" aria-hidden="true" style={{ marginRight: '6px' }} />
                            Some figures couldn't be loaded ({unavailable.join(', ')}). They show as "–".
                            <button onClick={() => { setLoading(true); fetchStats(); }} style={styles.linkBtn}>Retry</button>
                        </div>
                    )}

                    {!isAccountant && (
                        <div style={styles.statsRow}>
                            {statItems.map(stat => (
                                <a key={stat.label} href={stat.path} onClick={e => linkClick(e, stat.path)} style={styles.statCard}
                                    onMouseEnter={hoverOn()} onMouseLeave={hoverOff}>
                                    <div style={{ ...styles.statIconBadge, backgroundColor: stat.color + '18' }}>
                                        <i className={`bi ${stat.icon}`} aria-hidden="true" style={{ fontSize: '20px', color: stat.color }} />
                                    </div>
                                    <div style={{ ...styles.statNumber, color: stat.color }}>{show(stat.value)}</div>
                                    <div style={styles.statLabel}>{stat.label}</div>
                                </a>
                            ))}
                        </div>
                    )}

                    {!isAccountant && !loading && (sp.rows.length > 0 || (isAdmin && sectionStats.length > 0)) && (
                        <div style={styles.chartsRow}>
                            {sp.rows.length > 0 && (
                                <div style={styles.chartCard}>
                                    <h3 style={styles.chartTitle}>
                                        <i className="bi bi-bar-chart-fill" aria-hidden="true" style={{ fontSize: '16px', color: '#2E75B6' }} />
                                        Subject Averages
                                    </h3>
                                    <p style={styles.chartSub}>
                                        {sp.exam ? `${sp.exam.examName} — Term ${sp.exam.term} ${sp.exam.academicYear}` : 'Latest exam'}
                                        {isTeacherScoped && linkedClassName ? ` · ${linkedClassName}` : ''}
                                    </p>
                                    <div style={styles.barChart}>
                                        {sp.rows.map(sub => (
                                            <div key={sub.name} style={styles.barItem}>
                                                <div style={styles.barLabel} title={sub.name}>{sub.name}</div>
                                                <div style={styles.barWrapper}>
                                                    <div style={styles.barTrack}>
                                                        <div style={{ ...styles.bar, width: `${sub.avg}%`, backgroundColor: getBarColor(sub.avg) }} />
                                                    </div>
                                                    <span style={styles.barValue}>{sub.avg}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {isAdmin && sectionStats.length > 0 && (
                                <div style={styles.chartCard}>
                                    <h3 style={styles.chartTitle}>
                                        <i className="bi bi-building" aria-hidden="true" style={{ fontSize: '16px', color: '#28a745' }} />
                                        Students by Section
                                    </h3>
                                    <div style={styles.sectionChart}>
                                        {sectionStats.map(s => (
                                            <div key={s.key} style={styles.sectionItem}>
                                                <div style={styles.sectionLeft}>
                                                    <div style={{ ...styles.sectionDot, backgroundColor: s.color }} />
                                                    <div>
                                                        <div style={styles.sectionName}>{s.label}</div>
                                                        <div style={styles.sectionMeta}>{s.count} classes</div>
                                                    </div>
                                                </div>
                                                <div style={styles.sectionRight}>
                                                    <div style={styles.sectionBarWrapper}>
                                                        <div style={{ ...styles.sectionBar, width: stats.students > 0 ? `${(s.students / stats.students) * 100}%` : '0%', backgroundColor: s.color }} />
                                                    </div>
                                                    <span style={{ ...styles.sectionCount, color: s.color }}>{s.students}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <h3 style={styles.sectionTitle}>Quick Access</h3>
                    <div style={styles.cardGrid}>
                        {menuItems.map(item => (
                            <a key={item.path} href={item.path} onClick={e => linkClick(e, item.path)} style={styles.card}
                                onMouseEnter={hoverOn(item.color)} onMouseLeave={hoverOff}>
                                <div style={{ ...styles.cardIconBadge, backgroundColor: item.color + '18' }}>
                                    <i className={`bi ${item.icon}`} aria-hidden="true" style={{ fontSize: '24px', color: item.color }} />
                                </div>
                                <h3 style={styles.cardTitle}>{item.label}</h3>
                                {item.unit && (
                                    <div style={{ ...styles.cardCount, backgroundColor: item.color }}>{show(item.count)} {item.unit}</div>
                                )}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

const styles = {
    // Flex column so the footer sits at the bottom even when the page is short
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' },
    layoutRow: { display: 'flex', flex: 1 },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    welcome: { color: '#1F3864', fontSize: '26px', margin: '0 0 5px 0', fontWeight: 700, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
    subtitle: { color: '#666', marginBottom: '24px', fontSize: '14px' },
    notice: { color: '#856404', padding: '10px 15px', backgroundColor: '#fff8e1', borderRadius: '10px', marginBottom: '18px', border: '1px solid #ffc107', fontSize: '13px' },
    linkBtn: { background: 'none', border: 'none', color: '#1F3864', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold', padding: 0, marginLeft: '8px' },

    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px', marginBottom: '28px' },
    statCard: {
        backgroundColor: 'white', padding: '20px 16px', borderRadius: '14px', textAlign: 'center', textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', border: '2px solid transparent'
    },
    statIconBadge: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
    statNumber: { fontSize: '26px', fontWeight: 800, lineHeight: 1 },
    statLabel: { color: '#666', fontSize: '12px', marginTop: '6px', fontWeight: 500 },

    chartsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px', marginBottom: '28px' },
    chartCard: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: 0 },
    chartTitle: { color: '#1F3864', margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
    chartSub: { color: '#888', fontSize: '12px', margin: '0 0 16px 0' },
    barChart: { display: 'flex', flexDirection: 'column', gap: '12px' },
    barItem: { display: 'flex', alignItems: 'center', gap: '12px' },
    barLabel: { fontSize: '12px', color: '#555', width: '130px', flexShrink: 0, textAlign: 'right', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    barWrapper: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
    barTrack: { flex: 1, height: '16px', backgroundColor: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' },
    bar: { height: '100%', borderRadius: '8px', transition: 'width 0.5s ease', minWidth: '4px' },
    barValue: { fontSize: '12px', fontWeight: 700, color: '#333', minWidth: '38px' },

    sectionChart: { display: 'flex', flexDirection: 'column', gap: '16px' },
    sectionItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    sectionLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' },
    sectionDot: { width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0 },
    sectionName: { fontSize: '13px', fontWeight: 700, color: '#333' },
    sectionMeta: { fontSize: '11px', color: '#888' },
    sectionRight: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
    sectionBarWrapper: { flex: 1, height: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px', overflow: 'hidden' },
    sectionBar: { height: '100%', borderRadius: '5px', transition: 'width 0.5s ease' },
    sectionCount: { fontSize: '14px', fontWeight: 700, minWidth: '30px', textAlign: 'right' },

    sectionTitle: { color: '#1F3864', marginBottom: '16px', fontSize: '17px', fontWeight: 700 },
    cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px' },
    card: {
        backgroundColor: 'white', padding: '20px 14px', borderRadius: '14px', textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', textAlign: 'center',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        border: '2px solid transparent'
    },
    cardIconBadge: { width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
    cardTitle: { color: '#1F3864', margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700 },
    cardCount: { color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', display: 'inline-block', fontWeight: 600 }
};

export default Dashboard;
