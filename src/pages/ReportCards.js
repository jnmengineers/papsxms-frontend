import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

// Printable Report Card Component
const PrintableReportCard = React.forwardRef(({ card, results }, ref) => (
    <div ref={ref} style={printStyles.page}>
        {/* School Header with Logos */}
        <div style={printStyles.header}>
            <div style={printStyles.headerRow}>
                {/* Left Logo */}
                <img src={logo1} alt="Logo 1" style={printStyles.logo} />

                {/* School Name Center */}
                <div style={printStyles.schoolDetails}>
                    <h1 style={printStyles.schoolName}>
                        PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL
                    </h1>
                    <p style={printStyles.motto}>
                        Abreast with the Best in Holistic Education
                    </p>
                    <p style={printStyles.contact}>
                        P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996
                    </p>
                </div>

                {/* Right Logo */}
                <img src={logo2} alt="Logo 2" style={printStyles.logo} />
            </div>
            <h2 style={printStyles.reportTitle}> REPORT CARD</h2>
        </div>

        {/* Student Info */}
        <div style={printStyles.studentInfo}>
            <div style={printStyles.infoRow}>
                <span style={printStyles.infoLabel}>Student Name:</span>
                <span style={printStyles.infoValue}>{card.student?.firstName} {card.student?.lastName}</span>
                <span style={printStyles.infoLabel}>Admission No:</span>
                <span style={printStyles.infoValue}>{card.student?.admissionNumber || '-'}</span>
            </div>
            <div style={printStyles.infoRow}>
                <span style={printStyles.infoLabel}>Class:</span>
                <span style={printStyles.infoValue}>{card.student?.className}</span>
                <span style={printStyles.infoLabel}>Stream:</span>
                <span style={printStyles.infoValue}>{card.student?.stream}</span>
            </div>
            <div style={printStyles.infoRow}>
                <span style={printStyles.infoLabel}>Exam:</span>
                <span style={printStyles.infoValue}>{card.exam?.examName}</span>
                <span style={printStyles.infoLabel}>Academic Year:</span>
                <span style={printStyles.infoValue}>{card.exam?.academicYear}</span>
            </div>
            <div style={printStyles.infoRow}>
                <span style={printStyles.infoLabel}>Term:</span>
                <span style={printStyles.infoValue}>Term {card.exam?.term}</span>
                <span style={printStyles.infoLabel}>Class Level:</span>
                <span style={printStyles.infoValue}>{card.exam?.classLevel}</span>
            </div>
        </div>

        {/* Results Table */}
        <table style={printStyles.table}>
            <thead>
                <tr style={printStyles.tableHeader}>
                    <th style={printStyles.th}>#</th>
                    <th style={printStyles.th}>Subject</th>
                    <th style={printStyles.th}>Marks Obtained</th>
                    <th style={printStyles.th}>Max Marks</th>
                    <th style={printStyles.th}>Grade</th>
                    <th style={printStyles.th}>Remarks</th>
                </tr>
            </thead>
            <tbody>
                {results.map((result, index) => (
                    <tr key={result.resultId} style={index % 2 === 0 ? printStyles.trEven : printStyles.trOdd}>
                        <td style={printStyles.td}>{index + 1}</td>
                        <td style={printStyles.td}>{result.subject?.subjectName}</td>
                        <td style={printStyles.td}>{result.marksObtained}</td>
                        <td style={printStyles.td}>{result.maxMarks}</td>
                        <td style={printStyles.td}><strong>{result.grade}</strong></td>
                        <td style={printStyles.td}>{result.remarks}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Summary */}
        <div style={printStyles.summary}>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Total Marks</span>
                <span style={printStyles.summaryValue}>{card.totalMarks}</span>
            </div>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Average Marks</span>
                <span style={printStyles.summaryValue}>{card.averageMarks?.toFixed(2)}%</span>
            </div>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Term Rank</span>
                <span style={printStyles.summaryValue}>{card.termRank || '-'}</span>
            </div>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Class Rank</span>
                <span style={printStyles.summaryValue}>{card.classRank || '-'}</span>
            </div>
        </div>

        {/* Comments */}
        <div style={printStyles.comments}>
            <div style={printStyles.commentBox}>
                <p style={printStyles.commentLabel}>Class Teacher's Comment:</p>
                <p style={printStyles.commentText}>
                    {card.teacherComment || '................................................................'}
                </p>
                <p style={printStyles.signatureLine}>Signature: ................................ Date: ................</p>
            </div>
            <div style={printStyles.commentBox}>
                <p style={printStyles.commentLabel}>Principal's Comment:</p>
                <p style={printStyles.commentText}>
                    {card.principalComment || '................................................................'}
                </p>
                <p style={printStyles.signatureLine}>Signature: ................................ Date: ................</p>
            </div>
        </div>

        {/* Footer with Logos */}
        <div style={printStyles.footer}>
            <img src={logo1} alt="Logo" style={printStyles.footerLogo} />
            <div style={printStyles.footerText}>
                <p>Date Issued: {new Date().toLocaleDateString()}</p>
                <p>This is an official document of Pipeline Adventist School</p>
            </div>
            <img src={logo2} alt="Logo" style={printStyles.footerLogo} />
        </div>
    </div>
));

function ReportCards() {
    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [students, setStudents] = useState([]);
    const [exams, setExams] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [generating, setGenerating] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [editingCard, setEditingCard] = useState(null);
    const [printCard, setPrintCard] = useState(null);
    const [printResults, setPrintResults] = useState([]);
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState([]);
    const [editForm, setEditForm] = useState({
        termRank: '',
        classRank: '',
        Remarks: '',
        teacherComment: '',
        principalComment: ''
    });

   const printRef = useRef();

    const handlePrint = useReactToPrint({
            contentRef: printRef,
            documentTitle: `ReportCard_${printCard?.student?.firstName}_${printCard?.student?.lastName}`,
        });

    useEffect(() => {
        fetchReportCards();
        fetchStudents();
        fetchExams();
    }, []);

    useEffect(() => {
        let data = reportCards;
        if (search) {
            data = data.filter(c =>
                c.student?.firstName.toLowerCase().includes(search.toLowerCase()) ||
                c.student?.lastName.toLowerCase().includes(search.toLowerCase())
            );
        }
        setFiltered(data);
    }, [search, reportCards]);

    const fetchReportCards = async () => {
        try {
            const response = await api.get('/api/reportCards');
            setReportCards(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load report cards');
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        const response = await api.get('/api/students');
        setStudents(response.data);
    };

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setGenerating(true);
        setError('');
        setSuccessMsg('');
        try {
            await api.post(`/api/reportCards/generate/student/${selectedStudent}/exam/${selectedExam}`);
            setSuccessMsg('Report card generated successfully!');
            setSelectedStudent('');
            setSelectedExam('');
            fetchReportCards();
        } catch (err) {
            setError('Failed to generate report card. Make sure results exist for this student.');
        }
        setGenerating(false);
    };

    const handleEdit = (card) => {
        setEditingCard(card);
        setEditForm({
            termRank: card.termRank || '',
            classRank: card.classRank || '',
            Remarks: card.Remarks || '',
            teacherComment: card.teacherComment || '',
            principalComment: card.principalComment || ''
        });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/reportCards/${editingCard.reportId}`, {
                totalMarks: editingCard.totalMarks,
                averageMarks: editingCard.averageMarks,
                termRank: parseInt(editForm.termRank),
                classRank: parseInt(editForm.classRank),
                Remarks: editForm.Remarks,
                teacherComment: editForm.teacherComment,
                principalComment: editForm.principalComment
            });
            setEditingCard(null);
            fetchReportCards();
        } catch (err) {
            setError('Failed to update report card');
        }
    };

    const handlePrintCard = async (card) => {
        try {
            const response = await api.get(`/api/results/student/${card.student?.studentId}/exam/${card.exam?.examId}`);
            setPrintResults(response.data);
            setPrintCard(card);
        } catch (err) {
            setError('Failed to load results for printing');
        }
    };

        useEffect(() => {
            if (printCard && printResults.length > 0) {
                handlePrint();
            }
        }, [printCard, printResults]);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/reportCards/${id}`);
                fetchReportCards();
            } catch (err) {
                setError('Failed to delete report card');
            }
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                 <div style={styles.navLeft}>
                    <img src={logo1} alt="Logo" style={styles.navLogo} />
                    <h2 style={styles.navTitle}>Pipeline Adventist School</h2>
                </div>
                <div style={styles.navRight}>
                    <button onClick={() => window.location.href = '/dashboard'} style={styles.navBtn}>← Dashboard</button>
                    <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                <h2 style={styles.title}>📋 Report Cards</h2>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Generate */}
                <div style={styles.form}>
                    <h3>Generate Report Card</h3>
                    <form onSubmit={handleGenerate}>
                        <div style={styles.formGrid}>
                            <div style={styles.formGroup}>
                                <label>Student</label>
                                <select style={styles.input} value={selectedStudent}
                                    onChange={e => setSelectedStudent(e.target.value)} required>
                                    <option value="">Select Student</option>
                                    {students.map(s => (
                                        <option key={s.studentId} value={s.studentId}>
                                            {s.firstName} {s.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={styles.formGroup}>
                                <label>Exam</label>
                                <select style={styles.input} value={selectedExam}
                                    onChange={e => setSelectedExam(e.target.value)} required>
                                    <option value="">Select Exam</option>
                                    {exams.map(e => (
                                        <option key={e.examId} value={e.examId}>
                                            {e.examName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button type="submit" style={styles.generateBtn} disabled={generating}>
                            {generating ? 'Generating...' : '⚡ Generate Report Card'}
                        </button>
                    </form>
                </div>

                {/* Edit Form */}
                {editingCard && (
                    <div style={styles.form}>
                        <h3>Edit Report Card — {editingCard.student?.firstName} {editingCard.student?.lastName}</h3>
                        <form onSubmit={handleUpdate}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Term Rank</label>
                                    <input type="number" style={styles.input} value={editForm.termRank}
                                        onChange={e => setEditForm({...editForm, termRank: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Class Rank</label>
                                    <input type="number" style={styles.input} value={editForm.classRank}
                                        onChange={e => setEditForm({...editForm, classRank: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Remarks</label>
                                    <input style={styles.input} value={editForm.Remarks}
                                        onChange={e => setEditForm({...editForm, Remarks: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Teacher Comment</label>
                                    <input style={styles.input} value={editForm.teacherComment}
                                        onChange={e => setEditForm({...editForm, teacherComment: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Principal Comment</label>
                                    <input style={styles.input} value={editForm.principalComment}
                                        onChange={e => setEditForm({...editForm, principalComment: e.target.value})} />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>Update</button>
                                <button type="button" onClick={() => setEditingCard(null)} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Search */}
                <div style={styles.searchBar}>
                    <input style={styles.searchInput} placeholder="🔍 Search by student name..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <button onClick={() => setSearch('')} style={styles.clearBtn}>Clear</button>
                </div>

                {/* Table */}
                {loading ? <p>Loading report cards...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Student</th>
                                <th style={styles.th}>Exam</th>
                                <th style={styles.th}>Total</th>
                                <th style={styles.th}>Average</th>
                                <th style={styles.th}>Term Rank</th>
                                <th style={styles.th}>Class Rank</th>
                                <th style={styles.th}>Teacher Comment</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((card, index) => (
                                <tr key={card.reportId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{card.student?.firstName} {card.student?.lastName}</td>
                                    <td style={styles.td}>{card.exam?.examName}</td>
                                    <td style={styles.td}><strong>{card.totalMarks}</strong></td>
                                    <td style={styles.td}>
                                        <span style={{...styles.avgBadge, backgroundColor:
                                            card.averageMarks >= 80 ? '#28a745' :
                                            card.averageMarks >= 60 ? '#2E75B6' :
                                            card.averageMarks >= 40 ? '#ffc107' : '#dc3545'}}>
                                            {card.averageMarks?.toFixed(2)}%
                                        </span>
                                    </td>
                                    <td style={styles.td}>{card.termRank || '-'}</td>
                                    <td style={styles.td}>{card.classRank || '-'}</td>
                                    <td style={styles.td}>{card.teacherComment || '-'}</td>
                                    <td style={styles.td}>
                                        <button onClick={() => handleEdit(card)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handlePrintCard(card)} style={styles.printBtn}>🖨️ Print</button>
                                        <button onClick={() => handleDelete(card.reportId)} style={styles.deleteBtn}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="9" style={{...styles.td, textAlign: 'center', color: '#666'}}>
                                        No report cards found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Hidden Printable Component */}
            <div style={{ display: 'none' }}>
                {printCard && (
                    <PrintableReportCard
                        ref={printRef}
                        card={printCard}
                        results={printResults}
                    />
                )}
            </div>
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    navbar: { backgroundColor: '#1F3864', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    navTitle: { color: 'white', margin: 0, fontSize: '18px' },
    navRight: { display: 'flex', gap: '10px' },
    navBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: '30px' },
    title: { color: '#1F3864', marginBottom: '20px' },
    error: { color: 'red', marginBottom: '15px' },
    success: { color: 'green', marginBottom: '15px' },
    form: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    input: { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    btnGroup: { display: 'flex', gap: '10px' },
    generateBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    avgBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

const printStyles = {
    page: { padding: '30px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', color: '#000' },

    // Updated header styles
    header: { borderBottom: '3px solid #1F3864', paddingBottom: '15px', marginBottom: '20px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
    logo: { width: '90px', height: '90px', objectFit: 'contain' },
    schoolDetails: { textAlign: 'center', flex: 1, padding: '0 15px' },
    schoolName: { color: '#1F3864', fontSize: '16px', margin: '0 0 5px 0', textTransform: 'uppercase' },
    motto: { color: '#2E75B6', fontStyle: 'italic', margin: '0 0 5px 0', fontSize: '13px' },
    contact: { fontSize: '11px', color: '#666', margin: 0 },
    reportTitle: { backgroundColor: '#1F3864', color: 'white', padding: '8px', margin: '10px 0 0 0', fontSize: '16px', textAlign: 'center' },

    // Student info
    studentInfo: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '20px' },
    infoRow: { display: 'flex', gap: '20px', marginBottom: '8px' },
    infoLabel: { fontWeight: 'bold', color: '#1F3864', minWidth: '130px', fontSize: '13px' },
    infoValue: { flex: 1, borderBottom: '1px solid #ddd', paddingBottom: '2px', fontSize: '13px' },

    // Table
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '8px 12px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '8px 12px', borderBottom: '1px solid #ddd', fontSize: '13px' },
    trEven: { backgroundColor: '#f8f9fa' },
    trOdd: { backgroundColor: 'white' },

    // Summary
    summary: { display: 'flex', gap: '20px', backgroundColor: '#1F3864', padding: '15px', borderRadius: '5px', marginBottom: '20px' },
    summaryItem: { flex: 1, textAlign: 'center' },
    summaryLabel: { color: '#FFD700', fontSize: '12px', display: 'block' },
    summaryValue: { color: 'white', fontSize: '20px', fontWeight: 'bold', display: 'block' },

    // Comments
    comments: { display: 'flex', gap: '20px', marginBottom: '20px' },
    commentBox: { flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '5px' },
    commentLabel: { fontWeight: 'bold', color: '#1F3864', margin: '0 0 8px 0', fontSize: '13px' },
    commentText: { margin: '0 0 15px 0', minHeight: '40px', fontSize: '13px' },
    signatureLine: { margin: 0, color: '#666', fontSize: '11px' },

    // Footer
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #1F3864', paddingTop: '10px' },
    footerLogo: { width: '50px', height: '50px', objectFit: 'contain' },
    footerText: { textAlign: 'center', fontSize: '11px', color: '#666' },

    
};


    



export default ReportCards;S