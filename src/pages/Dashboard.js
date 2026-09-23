import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

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

    const getBarColor = (avg) => {
        if (avg >= 75) return '#28a745';
        if (avg >= 55) return '#2E75B6';
        if (avg >= 40) return '#ffc107';
        return '#dc3545';
    };

    const allMenuItems = [
        { icon: 'bi-mortarboard-fill', label: 'Students', path: '/students', count: stats.students, color: '#2E75B6', roles: ['ADMIN', 'TEACHER'] },
        { icon: 'bi-person-workspace', label: 'Teachers', path: '/teachers', count: stats.teachers, color: '#1F3864', roles: ['ADMIN'] },
        { icon: 'bi-building', label: 'Classes', path: '/classes', count: stats.classes, color: '#28a745', roles: ['ADMIN'] },
        { icon: 'bi-book-fill', label: 'Subjects', path: '/subjects', count: stats.subjects, color: '#fd7e14', roles: ['ADMIN'] },
        { icon: 'bi-file-earmark-text-fill', label: 'Exams', path: '/exams', count: stats.exams, color: '#6f42c1', roles: ['ADMIN'] },
        { icon: 'bi-bar-chart-fill', label: 'Results', path: '/results', count: stats.results, color: '#e83e8c', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: 'bi-clipboard-data-fill', label: 'Report Cards', path: '/reportcards', count: stats.reportCards, color: '#20c997', roles: ['ADMIN', 'TEACHER'] },
        { icon: 'bi-pencil-square', label: 'Mark Entry', path: '/mark-entry', count: null, color: '#28a745', roles: ['ADMIN', 'TEACHER'] },
        { icon: 'bi-graph-up-arrow', label: 'Progressive Report', path: '/progressive-report', count: null, color: '#e07a2f', roles: ['ADMIN', 'TEACHER'] },
        { icon: 'bi-link-45deg', label: 'Class Subjects', path: '/class-subjects', count: null, color: '#17a2b8', roles: ['ADMIN'] },
        { icon: 'bi-pie-chart-fill', label: 'Section Report', path: '/section-report', count: null, color: '#6f42c1', roles: ['ADMIN'] },
        { icon: 'bi-calendar3', label: 'Academic Years', path: '/academic-years', count: null, color: '#17a2b8', roles: ['ADMIN'] },
        { icon: 'bi-calendar-check-fill', label: 'Exam Schedules', path: '/exam-schedules', count: null, color: '#ffc107', roles: ['ADMIN'] },
        { icon: 'bi-sliders', label: 'Grading Scales', path: '/grading-scales', count: null, color: '#dc3545', roles: ['ADMIN'] },
        { icon: 'bi-people-fill', label: 'Users', path: '/users', count: stats.users, color: '#343a40', roles: ['ADMIN'] },
        { icon: 'bi-key-fill', label: 'Change Password', path: '/change-password', count: null, color: '#6c757d', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: 'bi-box-arrow-in-down', label: 'Import Data', path: '/import', count: null, color: '#17a2b8', roles: ['ADMIN'] },
    ];

    const menuItems = allMenuItems.filter(item => item.roles.includes(role));

    const statItems = [
        { label: 'Students', value: stats.students, color: '#2E75B6', icon: 'bi-mortarboard-fill' },
        { label: 'Teachers', value: stats.teachers, color: '#1F3864', icon: 'bi-person-workspace' },
        { label: 'Classes', value: stats.classes, color: '#28a745', icon: 'bi-building' },
        { label: 'Exams', value: stats.exams, color: '#6f42c1', icon: 'bi-file-earmark-text-fill' },
        { label: 'Results Entered', value: stats.results, color: '#e83e8c', icon: 'bi-bar-chart-fill' },
        { label: 'Report Cards', value: stats.reportCards, color: '#20c997', icon: 'bi-clipboard-data-fill' },
    ];

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <h2 style={styles.welcome}>
                        Welcome, {username}!
                        <i className="bi bi-emoji-smile-fill" style={{ marginLeft: '10px', fontSize: '22px', color: '#fd7e14' }} />
                    </h2>
                    <p style={styles.subtitle}>Exam Management System — Dashboard</p>

                    {role !== 'CLERK' && (
                        <div style={styles.statsRow}>
                            {statItems.map((stat, i) => {
                                return (
                                    <div key={i} style={styles.statCard}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>
                                        <div style={{ ...styles.statIconBadge, backgroundColor: stat.color + '18' }}>
                                            <i className={`bi ${stat.icon}`} style={{ fontSize: '20px', color: stat.color }} />
                                        </div>
                                        <div style={{ ...styles.statNumber, color: stat.color }}>{stat.value}</div>
                                        <div style={styles.statLabel}>{stat.label}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {role === 'ADMIN' && subjectPerformance.length > 0 && (
                        <div style={styles.chartsRow}>
                            <div style={styles.chartCard}>
                                <h3 style={styles.chartTitle}>
                                    <i className="bi bi-bar-chart-fill" style={{ fontSize: '16px', color: '#2E75B6' }} />
                                    Subject Average Performance
                                </h3>
                                <div style={styles.barChart}>
                                    {subjectPerformance.map((sub, i) => (
                                        <div key={i} style={styles.barItem}>
                                            <div style={styles.barLabel}>{sub.name}</div>
                                            <div style={styles.barWrapper}>
                                                <div style={{ ...styles.bar, width: `${sub.avg}%`, backgroundColor: getBarColor(sub.avg) }} />
                                                <span style={styles.barValue}>{sub.avg}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={styles.chartCard}>
                                <h3 style={styles.chartTitle}>
                                    <i className="bi bi-building" style={{ fontSize: '16px', color: '#28a745' }} />
                                    Students by Section
                                </h3>
                                <div style={styles.sectionChart}>
                                    {sectionStats.map((s, i) => (
                                        <div key={i} style={styles.sectionItem}>
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
                        </div>
                    )}

                    <h3 style={styles.sectionTitle}>Quick Access</h3>
                    <div style={styles.cardGrid}>
                        {menuItems.map((item, index) => {
                            return (
                                <div key={index}
                                    style={styles.card}
                                    onClick={() => navigate(item.path)}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.borderColor = item.color; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'transparent'; }}>
                                    <div style={{ ...styles.cardIconBadge, backgroundColor: item.color + '18' }}>
                                        <i className={`bi ${item.icon}`} style={{ fontSize: '24px', color: item.color }} />
                                    </div>
                                    <h3 style={styles.cardTitle}>{item.label}</h3>
                                    {item.count !== null && (
                                        <div style={{ ...styles.cardCount, backgroundColor: item.color }}>{item.count} records</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
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
    welcome: { color: '#1F3864', fontSize: '26px', margin: '0 0 5px 0', fontWeight: 700, display: 'flex', alignItems: 'center' },
    subtitle: { color: '#888', marginBottom: '28px', fontSize: '14px' },

    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px', marginBottom: '28px' },
    statCard: {
        backgroundColor: 'white', padding: '20px 16px', borderRadius: '14px', textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default'
    },
    statIconBadge: {
        width: '44px', height: '44px', borderRadius: '12px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
    },
    statNumber: { fontSize: '26px', fontWeight: 800, lineHeight: 1 },
    statLabel: { color: '#888', fontSize: '11.5px', marginTop: '6px', fontWeight: 500 },

    chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' },
    chartCard: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    chartTitle: { color: '#1F3864', marginBottom: '18px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
    barChart: { display: 'flex', flexDirection: 'column', gap: '12px' },
    barItem: { display: 'flex', alignItems: 'center', gap: '12px' },
    barLabel: { fontSize: '12px', color: '#666', minWidth: '130px', textAlign: 'right', fontWeight: 500 },
    barWrapper: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px' },
    bar: { height: '16px', borderRadius: '8px', transition: 'width 0.5s ease', minWidth: '4px' },
    barValue: { fontSize: '12px', fontWeight: 700, color: '#333', minWidth: '35px' },

    sectionChart: { display: 'flex', flexDirection: 'column', gap: '16px' },
    sectionItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    sectionLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '150px' },
    sectionDot: { width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0 },
    sectionName: { fontSize: '13px', fontWeight: 700, color: '#333' },
    sectionMeta: { fontSize: '11px', color: '#999' },
    sectionRight: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
    sectionBarWrapper: { flex: 1, height: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px', overflow: 'hidden' },
    sectionBar: { height: '100%', borderRadius: '5px', transition: 'width 0.5s ease' },
    sectionCount: { fontSize: '14px', fontWeight: 700, minWidth: '30px', textAlign: 'right' },

    sectionTitle: { color: '#1F3864', marginBottom: '16px', fontSize: '17px', fontWeight: 700 },
    cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' },
    card: {
        backgroundColor: 'white', padding: '20px 14px', borderRadius: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', textAlign: 'center',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        border: '2px solid transparent'
    },
    cardIconBadge: {
        width: '52px', height: '52px', borderRadius: '14px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
    },
    cardTitle: { color: '#1F3864', margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700 },
    cardCount: { color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', display: 'inline-block', fontWeight: 600 }
};

export default Dashboard;