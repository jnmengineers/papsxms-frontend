import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import { classDisplayName, gradeLabel, streamLabel } from '../utils/classUtils';

// ── Printable Report Card ─────────────────────────────────────────────────────
const PrintableReportCard = React.forwardRef(({ card, results }, ref) => (
    <div ref={ref} style={pStyles.page}>
        <div style={pStyles.header}>
            <div style={pStyles.headerRow}>
                <img src={logo1} alt="Logo 1" style={pStyles.logo} />
                <div style={pStyles.schoolDetails}>
                    <h1 style={pStyles.schoolName}>PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL</h1>
                    <p style={pStyles.motto}>Abreast with the Best in Holistic Education</p>
                    <p style={pStyles.contact}>P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996</p>
                </div>
                <img src={logo2} alt="Logo 2" style={pStyles.logo} />
            </div>
            <h2 style={pStyles.reportTitle}>REPORT CARD</h2>
        </div>

        <div style={pStyles.studentInfo}>
            <div style={pStyles.infoRow}>
                <span style={pStyles.infoLabel}>Student Name:</span>
                <span style={pStyles.infoValue}>{card.student?.firstName} {card.student?.lastName}</span>
                <span style={pStyles.infoLabel}>Admission No:</span>
                <span style={pStyles.infoValue}>{card.student?.admissionNumber || '-'}</span>
            </div>
            <div style={pStyles.infoRow}>
                <span style={pStyles.infoLabel}>Class:</span>
                <span style={pStyles.infoValue}>
                    {gradeLabel(card.student?.schoolClass?.gradeLevel) || card.student?.className}
                </span>
                <span style={pStyles.infoLabel}>Stream:</span>
                <span style={pStyles.infoValue}>
                    {streamLabel(card.student?.stream) || '-'}
                </span>
            </div>
            <div style={pStyles.infoRow}>
                <span style={pStyles.infoLabel}>Exam:</span>
                <span style={pStyles.infoValue}>{card.exam?.examName}</span>
                <span style={pStyles.infoLabel}>Academic Year:</span>
                <span style={pStyles.infoValue}>{card.exam?.academicYear}</span>
            </div>
            <div style={pStyles.infoRow}>
                <span style={pStyles.infoLabel}>Term:</span>
                <span style={pStyles.infoValue}>Term {card.exam?.term}</span>
                <span style={pStyles.infoLabel}>Class Level:</span>
                <span style={pStyles.infoValue}>{card.exam?.classLevel}</span>
            </div>
        </div>

        <table style={pStyles.table}>
            <thead>
                <tr style={pStyles.tableHeader}>
                    <th style={pStyles.th}>#</th>
                    <th style={pStyles.th}>Subject</th>
                    <th style={pStyles.th}>Marks Obtained</th>
                    <th style={pStyles.th}>Max Marks</th>
                    <th style={pStyles.th}>Grade</th>
                    <th style={pStyles.th}>Remarks</th>
                </tr>
            </thead>
            <tbody>
                {results.map((result, index) => (
                    <tr key={result.resultId} style={index % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                        <td style={pStyles.td}>{index + 1}</td>
                        <td style={pStyles.td}>{result.subject?.subjectName}</td>
                        <td style={pStyles.td}>{result.marksObtained}</td>
                        <td style={pStyles.td}>{result.maxMarks}</td>
                        <td style={pStyles.td}><strong>{result.grade}</strong></td>
                        <td style={pStyles.td}>{result.remarks}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        <div style={pStyles.summary}>
            <div style={pStyles.summaryItem}>
                <span style={pStyles.summaryLabel}>Total Marks</span>
                <span style={pStyles.summaryValue}>{card.totalMarks}</span>
            </div>
            <div style={pStyles.summaryItem}>
                <span style={pStyles.summaryLabel}>Average</span>
                <span style={pStyles.summaryValue}>{card.averageMarks?.toFixed(1)}%</span>
            </div>
            <div style={pStyles.summaryItem}>
                <span style={pStyles.summaryLabel}>Term Rank</span>
                <span style={pStyles.summaryValue}>{card.termRank || '-'}</span>
            </div>
            <div style={pStyles.summaryItem}>
                <span style={pStyles.summaryLabel}>Class Rank</span>
                <span style={pStyles.summaryValue}>{card.classRank || '-'}</span>
            </div>
        </div>

        <div style={pStyles.comments}>
            <div style={pStyles.commentBox}>
                <p style={pStyles.commentLabel}>Class Teacher's Comment:</p>
                <p style={pStyles.commentText}>{card.teacherComment || '................................................................'}</p>
                <p style={pStyles.signatureLine}>Signature: ................................ Date: ................</p>
            </div>
            <div style={pStyles.commentBox}>
                <p style={pStyles.commentLabel}>Principal's Comment:</p>
                <p style={pStyles.commentText}>{card.principalComment || '................................................................'}</p>
                <p style={pStyles.signatureLine}>Signature: ................................ Date: ................</p>
            </div>
        </div>

        <div style={pStyles.footer}>
            <img src={logo1} alt="Logo" style={pStyles.footerLogo} />
            <div style={pStyles.footerText}>
                <p>Date Issued: {new Date().toLocaleDateString()}</p>
                <p>This is an official document of Pipeline Adventist School</p>
            </div>
            <img src={logo2} alt="Logo" style={pStyles.footerLogo} />
        </div>
    </div>
));

function ReportCards() {
    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [printCard, setPrintCard] = useState(null);
    const [printResults, setPrintResults] = useState([]);
    const [search, setSearch] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterExam, setFilterExam] = useState('');
    const [filtered, setFiltered] = useState([]);

    // Generate mode: 'student' | 'class'
    const [genMode, setGenMode] = useState('class');
    const [genExam, setGenExam] = useState('');
    const [genClassId, setGenClassId] = useState('');
    const [genStudent, setGenStudent] = useState('');
    const [bulkProgress, setBulkProgress] = useState(null);

    const [editForm, setEditForm] = useState({
        termRank: '', classRank: '', Remarks: '', teacherComment: '', principalComment: ''
    });

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997' }
    ];

    const printRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `ReportCard_${printCard?.student?.firstName}_${printCard?.student?.lastName}`,
    });

    useEffect(() => { fetchReportCards(); fetchStudents(); fetchClasses(); fetchExams(); }, []);

    useEffect(() => {
        let data = reportCards;
        if (search) data = data.filter(c =>
            c.student?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            c.student?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            c.student?.admissionNumber?.toLowerCase().includes(search.toLowerCase())
        );
        if (filterClass) data = data.filter(c => String(c.student?.className) === String(filterClass) ||
            String(c.student?.schoolClass?.classId) === String(filterClass));
        if (filterExam) data = data.filter(c => String(c.exam?.examId) === String(filterExam));
        setFiltered(data);
    }, [search, filterClass, filterExam, reportCards]);

    useEffect(() => {
        if (printCard && printResults.length > 0) handlePrint();
    }, [printCard, printResults]);

    const fetchReportCards = async () => {
        try {
            const r = await api.get('/api/reportCards');
            setReportCards(r.data); setFiltered(r.data); setLoading(false);
        } catch (e) { setError('Failed to load report cards'); setLoading(false); }
    };

    const fetchStudents = async () => {
        const r = await api.get('/api/students');
        setStudents(r.data);
    };

    const fetchClasses = async () => {
        const r = await api.get('/api/classes');
        setClasses(r.data);
    };

    const fetchExams = async () => {
        const r = await api.get('/api/exams');
        setExams(r.data);
    };

    // ── Generate per student ──────────────────────────────────────────────────
    const handleGenerateStudent = async (e) => {
        e.preventDefault();
        if (!genStudent || !genExam) { setError('Select both student and exam'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        try {
            await api.post(`/api/reportCards/generate/student/${genStudent}/exam/${genExam}`);
            setSuccessMsg('✅ Report card generated!');
            setGenStudent('');
            fetchReportCards();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (e) { setError('Failed. Make sure results exist for this student.'); }
        setGenerating(false);
    };

    // ── Generate per class (bulk) ─────────────────────────────────────────────
    const handleGenerateClass = async () => {
        if (!genClassId || !genExam) { setError('Select both class and exam'); return; }
        const classStudents = students.filter(s =>
            String(s.schoolClass?.classId) === String(genClassId)
        );
        if (classStudents.length === 0) { setError('No students found in this class'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        let success = 0, failed = 0;
        setBulkProgress({ done: 0, total: classStudents.length, success: 0, failed: 0 });

        for (let i = 0; i < classStudents.length; i++) {
            try {
                await api.post(`/api/reportCards/generate/student/${classStudents[i].studentId}/exam/${genExam}`);
                success++;
            } catch (e) { failed++; }
            setBulkProgress({ done: i + 1, total: classStudents.length, success, failed });
        }

        setGenerating(false);
        setSuccessMsg(`✅ Generated ${success} report card(s).${failed > 0 ? ` ${failed} failed.` : ''}`);
        setBulkProgress(null);
        fetchReportCards();
        setTimeout(() => setSuccessMsg(''), 5000);
    };

    const handleEdit = (card) => {
        setEditingCard(card);
        setEditForm({
            termRank: card.termRank || '', classRank: card.classRank || '',
            Remarks: card.Remarks || '', teacherComment: card.teacherComment || '',
            principalComment: card.principalComment || ''
        });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/reportCards/${editingCard.reportId}`, {
                totalMarks: editingCard.totalMarks, averageMarks: editingCard.averageMarks,
                termRank: editForm.termRank !== '' ? parseInt(editForm.termRank) : null,
                classRank: editForm.classRank !== '' ? parseInt(editForm.classRank) : null,
                Remarks: editForm.Remarks, teacherComment: editForm.teacherComment,
                principalComment: editForm.principalComment
            });
            setSuccessMsg('✅ Updated!'); setEditingCard(null); fetchReportCards();
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (e) { setError('Failed to update'); }
    };

    const handlePrintCard = async (card) => {
        try {
            const r = await api.get(`/api/results/student/${card.student?.studentId}/exam/${card.exam?.examId}`);
            setPrintResults(r.data); setPrintCard(card);
        } catch (e) { setError('Failed to load results for printing'); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try { await api.delete(`/api/reportCards/${id}`); fetchReportCards(); }
            catch (e) { setError('Failed to delete'); }
        }
    };

    const selectedClass = classes.find(c => String(c.classId) === String(genClassId));
    const classStudentsCount = students.filter(s => String(s.schoolClass?.classId) === String(genClassId)).length;

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
                <p style={styles.subtitle}>Generate, view and print student report cards</p>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* ── Generate Section ── */}
                <div style={styles.genCard}>
                    <div style={styles.genTabs}>
                        <button onClick={() => setGenMode('class')} style={{
                            ...styles.genTab,
                            backgroundColor: genMode === 'class' ? '#1F3864' : 'white',
                            color: genMode === 'class' ? 'white' : '#1F3864'
                        }}>🏫 Generate Per Class (Bulk)</button>
                        <button onClick={() => setGenMode('student')} style={{
                            ...styles.genTab,
                            backgroundColor: genMode === 'student' ? '#1F3864' : 'white',
                            color: genMode === 'student' ? 'white' : '#1F3864'
                        }}>👤 Generate Per Student</button>
                    </div>

                    {/* Shared exam selector */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>📝 Exam</label>
                        <select style={styles.input} value={genExam} onChange={e => setGenExam(e.target.value)}>
                            <option value="">-- Select Exam --</option>
                            {exams.map(ex => (
                                <option key={ex.examId} value={ex.examId}>
                                    {ex.examName} — Term {ex.term} {ex.academicYear}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Per class mode */}
                    {genMode === 'class' && (
                        <div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>🏫 Class</label>
                                <select style={styles.input} value={genClassId} onChange={e => setGenClassId(e.target.value)}>
                                    <option value="">-- Select Class --</option>
                                    {sections.map(section => (
                                        <optgroup key={section.value} label={section.label}>
                                            {classes.filter(c => c.section === section.value).map(cls => (
                                                <option key={cls.classId} value={cls.classId}>
                                                    {classDisplayName(cls)}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            {genClassId && genExam && (
                                <div style={styles.previewRow}>
                                    <span style={styles.previewBadge}>👥 {classStudentsCount} students in {selectedClass ? classDisplayName(selectedClass) : ''}</span>
                                    <span style={styles.previewBadge}>📝 {exams.find(e => String(e.examId) === String(genExam))?.examName}</span>
                                </div>
                            )}
                            {bulkProgress && (
                                <div style={styles.progressBox}>
                                    <div style={styles.progressOuter}>
                                        <div style={{ ...styles.progressInner, width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
                                    </div>
                                    <p style={styles.progressText}>
                                        {bulkProgress.done}/{bulkProgress.total} — ✅ {bulkProgress.success}
                                        {bulkProgress.failed > 0 && ` ❌ ${bulkProgress.failed}`}
                                    </p>
                                </div>
                            )}
                            <button onClick={handleGenerateClass} style={styles.generateBtn}
                                disabled={generating || !genClassId || !genExam}>
                                {generating ? '⏳ Generating...' : `⚡ Generate for All ${classStudentsCount > 0 ? classStudentsCount : ''} Students`}
                            </button>
                        </div>
                    )}

                    {/* Per student mode */}
                    {genMode === 'student' && (
                        <form onSubmit={handleGenerateStudent}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>👤 Student</label>
                                <select style={styles.input} value={genStudent} onChange={e => setGenStudent(e.target.value)} required>
                                    <option value="">-- Select Student --</option>
                                    {students.slice().sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`)).map(s => (
                                        <option key={s.studentId} value={s.studentId}>
                                            {s.firstName} {s.lastName} — {s.className} ({s.admissionNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" style={styles.generateBtn} disabled={generating}>
                                {generating ? '⏳ Generating...' : '⚡ Generate Report Card'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Edit Form */}
                {editingCard && (
                    <div style={styles.editCard}>
                        <h3 style={styles.editTitle}>✏️ Edit — {editingCard.student?.firstName} {editingCard.student?.lastName}</h3>
                        <form onSubmit={handleUpdate}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Term Rank</label>
                                    <input type="number" style={styles.input} value={editForm.termRank}
                                        onChange={e => setEditForm({...editForm, termRank: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Class Rank</label>
                                    <input type="number" style={styles.input} value={editForm.classRank}
                                        onChange={e => setEditForm({...editForm, classRank: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Remarks</label>
                                    <input style={styles.input} value={editForm.Remarks}
                                        onChange={e => setEditForm({...editForm, Remarks: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Teacher Comment</label>
                                    <input style={styles.input} value={editForm.teacherComment}
                                        onChange={e => setEditForm({...editForm, teacherComment: e.target.value})} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Principal Comment</label>
                                    <input style={styles.input} value={editForm.principalComment}
                                        onChange={e => setEditForm({...editForm, principalComment: e.target.value})} />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>✅ Update</button>
                                <button type="button" onClick={() => setEditingCard(null)} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filters */}
                <div style={styles.filterRow}>
                    <input style={styles.searchInput} placeholder="🔍 Search by name or adm no..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <select style={styles.filterSelect} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                        <option value="">All Classes</option>
                        {classes.map(cls => (
                            <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>
                        ))}
                    </select>
                    <select style={styles.filterSelect} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                        <option value="">All Exams</option>
                        {exams.map(ex => <option key={ex.examId} value={ex.examId}>{ex.examName}</option>)}
                    </select>
                    <button onClick={() => { setSearch(''); setFilterClass(''); setFilterExam(''); }} style={styles.clearBtn}>Clear</button>
                </div>

                {/* Table */}
                {loading ? <p style={styles.centerMsg}>⏳ Loading...</p> : (
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeader}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Student</th>
                                    <th style={styles.th}>Adm No</th>
                                    <th style={styles.th}>Class</th>
                                    <th style={styles.th}>Stream</th>
                                    <th style={styles.th}>Exam</th>
                                    <th style={styles.th}>Total</th>
                                    <th style={styles.th}>Average</th>
                                    <th style={styles.th}>Term Rank</th>
                                    <th style={styles.th}>Class Rank</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((card, index) => (
                                    <tr key={card.reportId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                        <td style={styles.td}>{index + 1}</td>
                                        <td style={styles.td}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                        <td style={styles.td}><span style={styles.admNo}>{card.student?.admissionNumber || '-'}</span></td>
                                        <td style={styles.td}>{gradeLabel(card.student?.schoolClass?.gradeLevel) || card.student?.className}</td>
                                        <td style={styles.td}>{streamLabel(card.student?.stream) || '-'}</td>
                                        <td style={styles.td}>{card.exam?.examName}</td>
                                        <td style={styles.td}><strong>{card.totalMarks}</strong></td>
                                        <td style={styles.td}>
                                            <span style={{ ...styles.avgBadge, backgroundColor: card.averageMarks >= 80 ? '#28a745' : card.averageMarks >= 60 ? '#2E75B6' : card.averageMarks >= 40 ? '#ffc107' : '#dc3545' }}>
                                                {card.averageMarks?.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td style={styles.td}>{card.termRank || '-'}</td>
                                        <td style={styles.td}>{card.classRank || '-'}</td>
                                        <td style={styles.td}>
                                            <button onClick={() => handleEdit(card)} style={styles.editBtn}>Edit</button>
                                            <button onClick={() => handlePrintCard(card)} style={styles.printBtn}>🖨️</button>
                                            <button onClick={() => handleDelete(card.reportId)} style={styles.deleteBtn}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No report cards found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Hidden print */}
            <div style={{ display: 'none' }}>
                {printCard && <PrintableReportCard ref={printRef} card={printCard} results={printResults} />}
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
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: '0 0 20px 0', fontSize: '14px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },

    genCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    genTabs: { display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' },
    genTab: { padding: '10px 20px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    input: { padding: '10px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px' },
    previewRow: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' },
    previewBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
    progressBox: { marginBottom: '12px' },
    progressOuter: { height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' },
    progressInner: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s' },
    progressText: { fontSize: '12px', color: '#666', margin: 0 },
    generateBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' },

    editCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid #2E75B6' },
    editTitle: { color: '#2E75B6', margin: '0 0 15px 0' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },

    filterRow: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    searchInput: { flex: 2, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' },
    filterSelect: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '150px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },

    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '900px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '13px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
    avgBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace' },
};

const pStyles = {
    page: { padding: '30px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', color: '#000' },
    header: { borderBottom: '3px solid #1F3864', paddingBottom: '15px', marginBottom: '20px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
    logo: { width: '90px', height: '90px', objectFit: 'contain' },
    schoolDetails: { textAlign: 'center', flex: 1, padding: '0 15px' },
    schoolName: { color: '#1F3864', fontSize: '16px', margin: '0 0 5px 0', textTransform: 'uppercase' },
    motto: { color: '#2E75B6', fontStyle: 'italic', margin: '0 0 5px 0', fontSize: '13px' },
    contact: { fontSize: '11px', color: '#666', margin: 0 },
    reportTitle: { backgroundColor: '#1F3864', color: 'white', padding: '8px', margin: '10px 0 0 0', fontSize: '16px', textAlign: 'center' },
    studentInfo: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '20px' },
    infoRow: { display: 'flex', gap: '20px', marginBottom: '8px' },
    infoLabel: { fontWeight: 'bold', color: '#1F3864', minWidth: '130px', fontSize: '13px' },
    infoValue: { flex: 1, borderBottom: '1px solid #ddd', paddingBottom: '2px', fontSize: '13px' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '8px 12px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '8px 12px', borderBottom: '1px solid #ddd', fontSize: '13px' },
    trEven: { backgroundColor: '#f8f9fa' },
    trOdd: { backgroundColor: 'white' },
    summary: { display: 'flex', gap: '20px', backgroundColor: '#1F3864', padding: '15px', borderRadius: '5px', marginBottom: '20px' },
    summaryItem: { flex: 1, textAlign: 'center' },
    summaryLabel: { color: '#FFD700', fontSize: '12px', display: 'block' },
    summaryValue: { color: 'white', fontSize: '20px', fontWeight: 'bold', display: 'block' },
    comments: { display: 'flex', gap: '20px', marginBottom: '20px' },
    commentBox: { flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '5px' },
    commentLabel: { fontWeight: 'bold', color: '#1F3864', margin: '0 0 8px 0', fontSize: '13px' },
    commentText: { margin: '0 0 15px 0', minHeight: '40px', fontSize: '13px' },
    signatureLine: { margin: 0, color: '#666', fontSize: '11px' },
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #1F3864', paddingTop: '10px' },
    footerLogo: { width: '50px', height: '50px', objectFit: 'contain' },
    footerText: { textAlign: 'center', fontSize: '11px', color: '#666' },
};

export default ReportCards;