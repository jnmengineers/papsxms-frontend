import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Dashboard() {
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    const [stats, setStats] = useState({
        students: 0, teachers: 0, exams: 0,
        results: 0, reportCards: 0, classes: 0,
        subjects: 0, users: 0
    });
    const [subjectPerformance, setSubjectPerformance] = useState([]);
    const [sectionStats, setSectionStats] = useState([]);

    useEffect(() => { fetchStats(); }, []);

    const fetchStats = async () => {
        try {
            const [students, teachers, exams, results, reportCards, classes, subjects, users] =
                await Promise.all([
                    api.get('/api/students'),
                    api.get('/api/teachers'),
                    api.get('/api/exams'),
                    api.get('/api/results'),
                    api.get('/api/reportCards'),
                    api.get('/api/classes'),
                    api.get('/api/subjects'),
                    api.get('/api/users')
                ]);
            setStats({
                students: students.data.length,
                teachers: teachers.data.length,
                exams: exams.data.length,
                results: [...new Set(results.data.map(r => r.student?.studentId).filter(Boolean))].length,
                reportCards: reportCards.data.length,
                classes: classes.data.length,
                subjects: subjects.data.length,
                users: users.data.length
            });

            if (results.data.length > 0) {
                const subjectMap = {};
                results.data.forEach(r => {
                    const name = r.subject?.subjectName;
                    if (name) {
                        if (!subjectMap[name]) subjectMap[name] = { total: 0, count: 0 };
                        subjectMap[name].total += r.marksObtained;
                        subjectMap[name].count++;
                    }
                });
                const perfData = Object.entries(subjectMap)
                    .map(([name, data]) => ({ name, avg: Math.round(data.total / data.count) }))
                    .sort((a, b) => b.avg - a.avg)
                    .slice(0, 8);
                setSubjectPerformance(perfData);
            }

            const sections = [
                { label: 'Pre-School', key: 'PRE_SCHOOL', color: '#6f42c1' },
                { label: 'Lower Primary', key: 'LOWER_PRIMARY', color: '#2E75B6' },
                { label: 'Upper Primary', key: 'UPPER_PRIMARY', color: '#fd7e14' },
                { label: 'Junior School', key: 'JUNIOR_SCHOOL', color: '#20c997' }
            ];
            const sData = sections.map(s => ({
                ...s,
                count: classes.data.filter(c => c.section === s.key).length,
                students: students.data.filter(st => {
                    const cls = classes.data.find(c => c.classId === st.schoolClass?.classId);
                    return cls?.section === s.key;
                }).length
            }));
            setSectionStats(sData);
        } catch (err) {
            console.error('Failed to load stats');
        }
    };

    const handleLogout = () => { localStorage.clear(); navigate('/'); };
    const getBarColor = (avg) => {
        if (avg >= 75) return '#28a745';
        if (avg >= 55) return '#2E75B6';
        if (avg >= 40) return '#ffc107';
        return '#dc3545';
    };

    const allMenuItems = [
        { icon: '🎓', label: 'Students', path: '/students', count: stats.students, color: '#2E75B6', roles: ['ADMIN', 'TEACHER'] },
        { icon: '👨\u200d🏫', label: 'Teachers', path: '/teachers', count: stats.teachers, color: '#1F3864', roles: ['ADMIN'] },
        { icon: '🏫', label: 'Classes', path: '/classes', count: stats.classes, color: '#28a745', roles: ['ADMIN'] },
        { icon: '📚', label: 'Subjects', path: '/subjects', count: stats.subjects, color: '#fd7e14', roles: ['ADMIN'] },
        { icon: '📝', label: 'Exams', path: '/exams', count: stats.exams, color: '#6f42c1', roles: ['ADMIN'] },
        { icon: '📊', label: 'Results', path: '/results', count: stats.results, color: '#e83e8c', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: '📋', label: 'Report Cards', path: '/reportcards', count: stats.reportCards, color: '#20c997', roles: ['ADMIN', 'TEACHER'] },
        { icon: '✏️', label: 'Mark Entry', path: '/mark-entry', count: null, color: '#28a745', roles: ['ADMIN', 'TEACHER'] },
        { icon: '📈', label: 'Progressive Report', path: '/progressive-report', count: null, color: '#e07a2f', roles: ['ADMIN', 'TEACHER'] },
        { icon: '🔗', label: 'Class Subjects', path: '/class-subjects', count: null, color: '#17a2b8', roles: ['ADMIN'] },
        { icon: '📈', label: 'Section Report', path: '/section-report', count: null, color: '#6f42c1', roles: ['ADMIN'] },
        { icon: '📅', label: 'Academic Years', path: '/academic-years', count: null, color: '#17a2b8', roles: ['ADMIN'] },
        { icon: '🗓️', label: 'Exam Schedules', path: '/exam-schedules', count: null, color: '#ffc107', roles: ['ADMIN'] },
        { icon: '📊', label: 'Grading Scales', path: '/grading-scales', count: null, color: '#dc3545', roles: ['ADMIN'] },
        { icon: '👤', label: 'Users', path: '/users', count: stats.users, color: '#343a40', roles: ['ADMIN'] },
        { icon: '🔐', label: 'Change Password', path: '/change-password', count: null, color: '#6c757d', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: '📥', label: 'Import Data', path: '/import', count: null, color: '#17a2b8', roles: ['ADMIN'] },
    ];

    const menuItems = allMenuItems.filter(item => item.roles.includes(role));

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}>
                    <img src={logo1} alt="Logo" style={styles.navLogo} />
                    <h2 style={styles.navTitle}>Pipeline Adventist School</h2>
                </div>
                <div style={styles.navRight}>
                    <span style={styles.navUser}>👤 {username} ({role})</span>
                    <button onClick={() => navigate('/change-password')} style={styles.pwdBtn}>🔐 Password</button>
                    <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                <h2 style={styles.welcome}>Welcome, {username}! 👋</h2>
                <p style={styles.subtitle}>Exam Management System — Dashboard</p>

                {role !== 'CLERK' && (
                    <div style={styles.statsRow}>
                        {[
                            { label: 'Students', value: stats.students, color: '#2E75B6', icon: '🎓' },
                            { label: 'Teachers', value: stats.teachers, color: '#1F3864', icon: '👨\u200d🏫' },
                            { label: 'Classes', value: stats.classes, color: '#28a745', icon: '🏫' },
                            { label: 'Exams', value: stats.exams, color: '#6f42c1', icon: '📝' },
                            { label: 'Results Entered', value: stats.results, color: '#e83e8c', icon: '📊' },
                            { label: 'Report Cards', value: stats.reportCards, color: '#20c997', icon: '📋' },
                        ].map((stat, i) => (
                            <div key={i} style={{...styles.statCard, borderTop: `4px solid ${stat.color}`}}>
                                <div style={styles.statIcon}>{stat.icon}</div>
                                <div style={{...styles.statNumber, color: stat.color}}>{stat.value}</div>
                                <div style={styles.statLabel}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {role === 'ADMIN' && subjectPerformance.length > 0 && (
                    <div style={styles.chartsRow}>
                        <div style={styles.chartCard}>
                            <h3 style={styles.chartTitle}>📊 Subject Average Performance</h3>
                            <div style={styles.barChart}>
                                {subjectPerformance.map((sub, i) => (
                                    <div key={i} style={styles.barItem}>
                                        <div style={styles.barLabel}>{sub.name}</div>
                                        <div style={styles.barWrapper}>
                                            <div style={{...styles.bar, width: `${sub.avg}%`, backgroundColor: getBarColor(sub.avg)}} />
                                            <span style={styles.barValue}>{sub.avg}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={styles.chartCard}>
                            <h3 style={styles.chartTitle}>🏫 Students by Section</h3>
                            <div style={styles.sectionChart}>
                                {sectionStats.map((s, i) => (
                                    <div key={i} style={styles.sectionItem}>
                                        <div style={styles.sectionLeft}>
                                            <div style={{...styles.sectionDot, backgroundColor: s.color}} />
                                            <div>
                                                <div style={styles.sectionName}>{s.label}</div>
                                                <div style={styles.sectionMeta}>{s.count} classes</div>
                                            </div>
                                        </div>
                                        <div style={styles.sectionRight}>
                                            <div style={styles.sectionBarWrapper}>
                                                <div style={{...styles.sectionBar, width: stats.students > 0 ? `${(s.students / stats.students) * 100}%` : '0%', backgroundColor: s.color}} />
                                            </div>
                                            <span style={{...styles.sectionCount, color: s.color}}>{s.students}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <h3 style={styles.sectionTitle}>Quick Access</h3>
                <div style={styles.cardGrid}>
                    {menuItems.map((item, index) => (
                        <div key={index}
                            style={{...styles.card, borderTop: `4px solid ${item.color}`}}
                            onClick={() => navigate(item.path)}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                            <div style={styles.cardIcon}>{item.icon}</div>
                            <h3 style={styles.cardTitle}>{item.label}</h3>
                            {item.count !== null && (
                                <div style={{...styles.cardCount, backgroundColor: item.color}}>{item.count} records</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    navbar: { backgroundColor: '#1F3864', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
    navTitle: { color: 'white', margin: 0, fontSize: '18px' },
    navRight: { display: 'flex', alignItems: 'center', gap: '10px' },
    navUser: { color: '#FFD700', fontSize: '14px' },
    pwdBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: '30px' },
    welcome: { color: '#1F3864', fontSize: '26px', margin: '0 0 5px 0' },
    subtitle: { color: '#666', marginBottom: '25px' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '25px' },
    statCard: { backgroundColor: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    statIcon: { fontSize: '24px', marginBottom: '5px' },
    statNumber: { fontSize: '28px', fontWeight: 'bold' },
    statLabel: { color: '#666', fontSize: '11px', marginTop: '3px' },
    chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' },
    chartCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    chartTitle: { color: '#1F3864', marginBottom: '15px', fontSize: '15px' },
    barChart: { display: 'flex', flexDirection: 'column', gap: '10px' },
    barItem: { display: 'flex', alignItems: 'center', gap: '10px' },
    barLabel: { fontSize: '12px', color: '#555', minWidth: '130px', textAlign: 'right' },
    barWrapper: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px' },
    bar: { height: '18px', borderRadius: '9px', transition: 'width 0.5s ease', minWidth: '4px' },
    barValue: { fontSize: '12px', fontWeight: 'bold', color: '#333', minWidth: '35px' },
    sectionChart: { display: 'flex', flexDirection: 'column', gap: '15px' },
    sectionItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    sectionLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '150px' },
    sectionDot: { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
    sectionName: { fontSize: '13px', fontWeight: 'bold', color: '#333' },
    sectionMeta: { fontSize: '11px', color: '#999' },
    sectionRight: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
    sectionBarWrapper: { flex: 1, height: '12px', backgroundColor: '#f0f0f0', borderRadius: '6px', overflow: 'hidden' },
    sectionBar: { height: '100%', borderRadius: '6px', transition: 'width 0.5s ease' },
    sectionCount: { fontSize: '14px', fontWeight: 'bold', minWidth: '30px', textAlign: 'right' },
    sectionTitle: { color: '#1F3864', marginBottom: '15px' },
    cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' },
    card: { backgroundColor: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s' },
    cardIcon: { fontSize: '30px', marginBottom: '8px' },
    cardTitle: { color: '#1F3864', margin: '0 0 8px 0', fontSize: '13px' },
    cardCount: { color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', display: 'inline-block' }
};

export default Dashboard;