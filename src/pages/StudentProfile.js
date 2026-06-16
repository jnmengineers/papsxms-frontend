import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import Spinner from '../components/Spinner';

function StudentProfile() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [student, setStudent] = useState(null);
    const [results, setResults] = useState([]);
    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        fetchAll();
    }, [studentId]);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [studentsRes, resultsRes, reportCardsRes] = await Promise.all([
                api.get('/api/students'),
                api.get(`/api/results/by-student/${studentId}`),
                api.get(`/api/reportCards/by-student/${studentId}`)
            ]);
            const found = studentsRes.data.find(s => String(s.studentId) === String(studentId));
            setStudent(found);
            setResults(resultsRes.data);
            setReportCards(reportCardsRes.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load student profile');
            setLoading(false);
        }
    };

    const getGradeColor = (grade) => {
        if (grade === 'A') return '#28a745';
        if (grade === 'B') return '#2E75B6';
        if (grade === 'C') return '#ffc107';
        return '#dc3545';
    };

    const getAvgColor = (avg) => {
        if (avg >= 80) return '#28a745';
        if (avg >= 60) return '#2E75B6';
        if (avg >= 40) return '#ffc107';
        return '#dc3545';
    };

    // Group results by exam
    const resultsByExam = results.reduce((acc, r) => {
        const examName = r.exam?.examName || 'Unknown';
        if (!acc[examName]) acc[examName] = [];
        acc[examName].push(r);
        return acc;
    }, {});

    const overallAvg = results.length > 0
        ? (results.reduce((sum, r) => sum + r.marksObtained, 0) / results.length).toFixed(1)
        : 0;

    if (loading) return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}>
                    <img src={logo1} alt="Logo" style={styles.navLogo} />
                    <h2 style={styles.navTitle}>Pipeline Adventist School</h2>
                </div>
            </div>
            <Spinner message="Loading student profile..." size="large" />
        </div>
    );

    if (!student) return (
        <div style={styles.container}>
            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Student not found</p>
        </div>
    );

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}>
                    <img src={logo1} alt="Logo" style={styles.navLogo} />
                    <h2 style={styles.navTitle}>Pipeline Adventist School</h2>
                </div>
                <div style={styles.navRight}>
                    <button onClick={() => navigate('/students')} style={styles.navBtn}>← Students</button>
                    <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
                    <button onClick={() => { localStorage.clear(); navigate('/'); }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                {error && <p style={styles.error}>{error}</p>}

                {/* Profile Header */}
                <div style={styles.profileHeader}>
                    <div style={styles.avatarSection}>
                        <div style={{
                            ...styles.avatar,
                            backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c'
                        }}>
                            {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                        </div>
                        <div>
                            <h2 style={styles.studentName}>{student.firstName} {student.lastName}</h2>
                            <p style={styles.studentMeta}>
                                <span style={styles.metaBadge}>📋 {student.admissionNumber}</span>
                                <span style={{...styles.metaBadge, backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c'}}>
                                    {student.gender}
                                </span>
                                <span style={styles.metaBadge}>🏫 {student.className}</span>
                                {student.stream && <span style={styles.metaBadge}>🎨 {student.stream}</span>}
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div style={styles.quickStats}>
                        <div style={styles.quickStat}>
                            <div style={{...styles.quickStatNum, color: getAvgColor(parseFloat(overallAvg))}}>{overallAvg}%</div>
                            <div style={styles.quickStatLabel}>Overall Avg</div>
                        </div>
                        <div style={styles.quickStat}>
                            <div style={{...styles.quickStatNum, color: '#6f42c1'}}>{results.length}</div>
                            <div style={styles.quickStatLabel}>Total Results</div>
                        </div>
                        <div style={styles.quickStat}>
                            <div style={{...styles.quickStatNum, color: '#20c997'}}>{reportCards.length}</div>
                            <div style={styles.quickStatLabel}>Report Cards</div>
                        </div>
                        <div style={styles.quickStat}>
                            <div style={{...styles.quickStatNum, color: '#1F3864'}}>{Object.keys(resultsByExam).length}</div>
                            <div style={styles.quickStatLabel}>Exams Taken</div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    {['overview', 'results', 'reportcards'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            style={{
                                ...styles.tab,
                                backgroundColor: activeTab === tab ? '#1F3864' : 'white',
                                color: activeTab === tab ? 'white' : '#1F3864'
                            }}>
                            {tab === 'overview' && '📊 Overview'}
                            {tab === 'results' && `📝 Results (${results.length})`}
                            {tab === 'reportcards' && `📋 Report Cards (${reportCards.length})`}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div>
                        {/* Student Details */}
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>👤 Student Details</h3>
                            <div style={styles.detailGrid}>
                                {[
                                    { label: 'Full Name', value: `${student.firstName} ${student.lastName}` },
                                    { label: 'Admission Number', value: student.admissionNumber },
                                    { label: 'Gender', value: student.gender },
                                    { label: 'Date of Birth', value: student.dateOfBirth },
                                    { label: 'Class', value: student.className },
                                    { label: 'Stream', value: student.stream || 'N/A' },
                                ].map((item, i) => (
                                    <div key={i} style={styles.detailItem}>
                                        <span style={styles.detailLabel}>{item.label}</span>
                                        <span style={styles.detailValue}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Performance by Exam */}
                        {reportCards.length > 0 && (
                            <div style={styles.card}>
                                <h3 style={styles.cardTitle}>📈 Performance History</h3>
                                <div style={styles.performanceGrid}>
                                    {reportCards.map((card, i) => (
                                        <div key={i} style={{
                                            ...styles.perfCard,
                                            borderLeft: `4px solid ${getAvgColor(card.averageMarks)}`
                                        }}>
                                            <div style={styles.perfExam}>{card.exam?.examName}</div>
                                            <div style={styles.perfTerm}>Term {card.exam?.term} • {card.exam?.academicYear}</div>
                                            <div style={{...styles.perfAvg, color: getAvgColor(card.averageMarks)}}>
                                                {card.averageMarks?.toFixed(1)}%
                                            </div>
                                            <div style={styles.perfDetails}>
                                                Total: {card.totalMarks} | Rank: {card.classRank || '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'results' && (
                    <div>
                        {Object.keys(resultsByExam).length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>📝</div>
                                <p>No results found for this student</p>
                            </div>
                        ) : (
                            Object.entries(resultsByExam).map(([examName, examResults]) => (
                                <div key={examName} style={styles.card}>
                                    <h3 style={styles.cardTitle}>📝 {examName}</h3>
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
                                                {examResults.map((r, i) => {
                                                    const pct = ((r.marksObtained / r.maxMarks) * 100).toFixed(1);
                                                    return (
                                                        <tr key={r.resultId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                            <td style={styles.td}>{i + 1}</td>
                                                            <td style={styles.td}>{r.subject?.subjectName}</td>
                                                            <td style={styles.td}><strong>{r.marksObtained}</strong></td>
                                                            <td style={styles.td}>{r.maxMarks}</td>
                                                            <td style={styles.td}>
                                                                <div style={{...styles.progressBar}}>
                                                                    <div style={{...styles.progressFill, width: `${pct}%`, backgroundColor: getAvgColor(parseFloat(pct))}} />
                                                                    <span style={styles.progressText}>{pct}%</span>
                                                                </div>
                                                            </td>
                                                            <td style={styles.td}>
                                                                <span style={{...styles.gradeBadge, backgroundColor: getGradeColor(r.grade)}}>
                                                                    {r.grade}
                                                                </span>
                                                            </td>
                                                            <td style={styles.td}>{r.remarks}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'reportcards' && (
                    <div>
                        {reportCards.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>📋</div>
                                <p>No report cards found for this student</p>
                            </div>
                        ) : (
                            <div style={styles.reportCardGrid}>
                                {reportCards.map((card, i) => (
                                    <div key={i} style={styles.reportCard}>
                                        <div style={{...styles.rcHeader, backgroundColor: getAvgColor(card.averageMarks)}}>
                                            <h3 style={styles.rcExam}>{card.exam?.examName}</h3>
                                            <p style={styles.rcTerm}>Term {card.exam?.term} • {card.exam?.academicYear}</p>
                                        </div>
                                        <div style={styles.rcBody}>
                                            <div style={styles.rcStats}>
                                                <div style={styles.rcStat}>
                                                    <div style={{...styles.rcStatNum, color: getAvgColor(card.averageMarks)}}>
                                                        {card.averageMarks?.toFixed(1)}%
                                                    </div>
                                                    <div style={styles.rcStatLabel}>Average</div>
                                                </div>
                                                <div style={styles.rcStat}>
                                                    <div style={styles.rcStatNum}>{card.totalMarks}</div>
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
                                            {card.teacherComment && (
                                                <div style={styles.rcComment}>
                                                    <strong>Teacher:</strong> {card.teacherComment}
                                                </div>
                                            )}
                                            {card.principalComment && (
                                                <div style={styles.rcComment}>
                                                    <strong>Principal:</strong> {card.principalComment}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
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
    navRight: { display: 'flex', gap: '10px' },
    navBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: '30px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },

    // Profile Header
    profileHeader: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' },
    avatarSection: { display: 'flex', alignItems: 'center', gap: '20px' },
    avatar: { width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '28px', flexShrink: 0 },
    studentName: { color: '#1F3864', margin: '0 0 8px 0', fontSize: '22px' },
    studentMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: 0 },
    metaBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
    quickStats: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
    quickStat: { textAlign: 'center', backgroundColor: '#f8f9fa', padding: '15px 20px', borderRadius: '8px', minWidth: '80px' },
    quickStatNum: { fontSize: '28px', fontWeight: 'bold' },
    quickStatLabel: { color: '#666', fontSize: '12px', marginTop: '4px' },

    // Tabs
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s' },

    // Cards
    card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    cardTitle: { color: '#1F3864', marginBottom: '15px', borderBottom: '2px solid #f0f2f5', paddingBottom: '10px' },
    detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
    detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
    detailLabel: { fontSize: '12px', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' },
    detailValue: { fontSize: '14px', color: '#333', fontWeight: 'bold' },

    // Performance
    performanceGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
    perfCard: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px' },
    perfExam: { fontWeight: 'bold', color: '#1F3864', fontSize: '14px', marginBottom: '3px' },
    perfTerm: { color: '#999', fontSize: '12px', marginBottom: '8px' },
    perfAvg: { fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' },
    perfDetails: { color: '#666', fontSize: '12px' },

    // Table
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    progressBar: { position: 'relative', backgroundColor: '#f0f0f0', borderRadius: '10px', height: '18px', minWidth: '70px', overflow: 'hidden' },
    progressFill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '10px' },
    progressText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: 'white', lineHeight: '18px', textShadow: '0 0 3px rgba(0,0,0,0.5)' },
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px' },

    // Report Cards
    reportCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
    reportCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    rcHeader: { padding: '15px', color: 'white' },
    rcExam: { margin: '0 0 4px 0', fontSize: '15px' },
    rcTerm: { margin: 0, fontSize: '12px', opacity: 0.85 },
    rcBody: { padding: '15px' },
    rcStats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' },
    rcStat: { textAlign: 'center' },
    rcStatNum: { fontSize: '20px', fontWeight: 'bold', color: '#1F3864' },
    rcStatLabel: { fontSize: '10px', color: '#999' },
    rcComment: { fontSize: '12px', color: '#666', backgroundColor: '#f8f9fa', padding: '8px', borderRadius: '5px', marginBottom: '6px' },

    // Empty
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' }
};

export default StudentProfile;
