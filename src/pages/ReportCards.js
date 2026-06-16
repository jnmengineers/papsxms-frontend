import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import PrintAllReportCards from '../components/PrintAllReportCards';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import Spinner from '../components/Spinner';

// ── Printable Report Card ──────────────────────────────────────────────────
const PrintableReportCard = React.forwardRef(({ card, results }, ref) => (
    <div ref={ref} style={printStyles.page}>
        <div style={printStyles.header}>
            <div style={printStyles.headerRow}>
                <img src={logo1} alt="Logo 1" style={printStyles.logo} />
                <div style={printStyles.schoolDetails}>
                    <h1 style={printStyles.schoolName}>
                        PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL
                    </h1>
                    <p style={printStyles.motto}>Abreast with the Best in Holistic Education</p>
                    <p style={printStyles.contact}>
                        P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996
                    </p>
                </div>
                <img src={logo2} alt="Logo 2" style={printStyles.logo} />
            </div>
            <h2 style={printStyles.reportTitle}>REPORT CARD</h2>
        </div>

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
                <span style={printStyles.infoValue}>{card.student?.stream || '-'}</span>
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
                <span style={printStyles.summaryLabel}>Grade Rank</span>
                <span style={printStyles.summaryValue}>{card.termRank || '-'}</span>
            </div>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Class Rank</span>
                <span style={printStyles.summaryValue}>{card.classRank || '-'}</span>
            </div>
        </div>

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
    const [showPrintAll, setShowPrintAll] = useState(false);

    // Generate tab state
    const [genMode, setGenMode] = useState('class'); // class | student
    const [genExam, setGenExam] = useState('');
    const [genClassId, setGenClassId] = useState('');
    const [genStudent, setGenStudent] = useState('');
    const [classStudents, setClassStudents] = useState([]);
    const [bulkProgress, setBulkProgress] = useState(null); // {done, total, success, failed}

    const [editForm, setEditForm] = useState({
        termRank: '',
        classRank: '',
        Remarks: '',
        teacherComment: '',
        principalComment: ''
    });

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997' }
    ];

    const { toast, showToast, hideToast } = useToast();
    const printRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `ReportCard_${printCard?.student?.firstName}_${printCard?.student?.lastName}`,
    });

    useEffect(() => {
        fetchReportCards();
        fetchStudents();
        fetchClasses();
        fetchExams();
    }, []);

    useEffect(() => {
        let data = reportCards;
        if (search) {
            data = data.filter(c =>
                c.student?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
                c.student?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
                c.student?.admissionNumber?.toLowerCase().includes(search.toLowerCase())
            );
        }
        if (filterClass) data = data.filter(c => c.student?.className === filterClass);
        if (filterExam) data = data.filter(c => String(c.exam?.examId) === String(filterExam));
        setFiltered(data);
    }, [search, filterClass, filterExam, reportCards]);

    useEffect(() => {
        if (printCard && printResults.length > 0) {
            handlePrint();
        }
    }, [printCard, printResults]);

    // Load students for selected class in "Generate per Class" mode
    useEffect(() => {
        if (genClassId) {
            const selectedClass = classes.find(c => String(c.classId) === String(genClassId));
            const cs = students.filter(s =>
                String(s.schoolClass?.classId) === String(genClassId) ||
                s.className === selectedClass?.className
            );
            setClassStudents(cs);
        } else {
            setClassStudents([]);
        }
    }, [genClassId, students, classes]);

    const fetchReportCards = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/reportCards');
            setReportCards(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) {
            showToast('Failed to load report cards', 'error');
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        const response = await api.get('/api/students');
        setStudents(response.data);
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    // ── Generate for single student ──────────────────────────────────────────
    const handleGenerateStudent = async (e) => {
        e.preventDefault();
        if (!genStudent || !genExam) {
            showToast('Select both student and exam', 'error');
            return;
        }
        setGenerating(true);
        try {
            await api.post(`/api/reportCards/generate/student/${genStudent}/exam/${genExam}`);
            showToast('✅ Report card generated successfully!', 'success');
            setGenStudent('');
            fetchReportCards();
        } catch (err) {
            showToast('Failed to generate. Make sure results exist for this student.', 'error');
        }
        setGenerating(false);
    };

    // ── Generate for ALL students in a class ──────────────────────────────────
    const handleGenerateClass = async () => {
        if (!genClassId || !genExam) {
            showToast('Select both class and exam', 'error');
            return;
        }
        if (classStudents.length === 0) {
            showToast('No students found in this class', 'error');
            return;
        }
        setGenerating(true);
        let success = 0, failed = 0;
        setBulkProgress({ done: 0, total: classStudents.length, success: 0, failed: 0 });

        for (let i = 0; i < classStudents.length; i++) {
            const student = classStudents[i];
            try {
                await api.post(`/api/reportCards/generate/student/${student.studentId}/exam/${genExam}`);
                success++;
            } catch (err) {
                failed++;
            }
            setBulkProgress({ done: i + 1, total: classStudents.length, success, failed });
        }

        setGenerating(false);
        showToast(`✅ Generated ${success} report card(s). ${failed > 0 ? `${failed} failed.` : ''}`, failed > 0 ? 'error' : 'success');
        fetchReportCards();
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
                termRank: editForm.termRank !== '' ? parseInt(editForm.termRank) : null,
                classRank: editForm.classRank !== '' ? parseInt(editForm.classRank) : null,
                Remarks: editForm.Remarks,
                teacherComment: editForm.teacherComment,
                principalComment: editForm.principalComment
            });
            showToast('Report card updated!', 'success');
            setEditingCard(null);
            fetchReportCards();
        } catch (err) {
            showToast('Failed to update report card', 'error');
        }
    };

    const handlePrintCard = async (card) => {
        try {
            const response = await api.get(`/api/results/student/${card.student?.studentId}/exam/${card.exam?.examId}`);
            setPrintResults(response.data);
            setPrintCard(card);
        } catch (err) {
            showToast('Failed to load results for printing', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/reportCards/${id}`);
                showToast('Report card deleted!', 'success');
                fetchReportCards();
            } catch (err) {
                showToast('Failed to delete report card', 'error');
            }
        }
    };

    const uniqueClasses = [...new Set(reportCards.map(c => c.student?.className).filter(Boolean))].sort();

    const getSectionColor = (className) => {
        const cls = classes.find(c => c.className === className);
        return sections.find(s => s.value === cls?.section)?.color || '#1F3864';
    };

    const genClassName = classes.find(c => String(c.classId) === String(genClassId))?.className || '';
    const genExamName = exams.find(e => String(e.examId) === String(genExam))?.examName || '';

    return (
        <div style={styles.container}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

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
                <p style={styles.subtitle}>Generate report cards per class (bulk) or per student</p>

                {/* ── Generate Section ── */}
                <div style={styles.genCard}>
                    <div style={styles.genTabs}>
                        <button onClick={() => setGenMode('class')} style={{
                            ...styles.genTab,
                            backgroundColor: genMode === 'class' ? '#1F3864' : 'white',
                            color: genMode === 'class' ? 'white' : '#1F3864'
                        }}>
                            🏫 Generate Per Class (Bulk)
                        </button>
                        <button onClick={() => setGenMode('student')} style={{
                            ...styles.genTab,
                            backgroundColor: genMode === 'student' ? '#1F3864' : 'white',
                            color: genMode === 'student' ? 'white' : '#1F3864'
                        }}>
                            👤 Generate Per Student
                        </button>
                    </div>

                    {/* Exam selector — shared */}
                    <div style={styles.genFormGroup}>
                        <label style={styles.genLabel}>📝 Exam</label>
                        <select style={styles.genInput} value={genExam}
                            onChange={e => setGenExam(e.target.value)}>
                            <option value="">-- Select Exam --</option>
                            {exams.map(ex => (
                                <option key={ex.examId} value={ex.examId}>
                                    {ex.examName} — Term {ex.term} {ex.academicYear}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* ── PER CLASS MODE ── */}
                    {genMode === 'class' && (
                        <div>
                            <div style={styles.genFormGroup}>
                                <label style={styles.genLabel}>🏫 Class</label>
                                <select style={styles.genInput} value={genClassId}
                                    onChange={e => setGenClassId(e.target.value)}>
                                    <option value="">-- Select Class --</option>
                                    {sections.map(section => (
                                        <optgroup key={section.value} label={section.label}>
                                            {classes.filter(c => c.section === section.value).map(cls => (
                                                <option key={cls.classId} value={cls.classId}>
                                                    {cls.className}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {genClassId && genExam && (
                                <div style={styles.genPreview}>
                                    <span style={styles.genPreviewBadge}>
                                        👥 {classStudents.length} students in {genClassName}
                                    </span>
                                    <span style={styles.genPreviewBadge}>
                                        📝 {genExamName}
                                    </span>
                                </div>
                            )}

                            {bulkProgress && (
                                <div style={styles.progressBox}>
                                    <div style={styles.progressBarOuter}>
                                        <div style={{
                                            ...styles.progressBarInner,
                                            width: `${(bulkProgress.done / bulkProgress.total) * 100}%`
                                        }} />
                                    </div>
                                    <p style={styles.progressText}>
                                        Generating {bulkProgress.done} / {bulkProgress.total}
                                        {' '}— ✅ {bulkProgress.success} success
                                        {bulkProgress.failed > 0 && ` — ❌ ${bulkProgress.failed} failed`}
                                    </p>
                                </div>
                            )}

                            <button onClick={handleGenerateClass} style={styles.generateBtn}
                                disabled={generating || !genClassId || !genExam}>
                                {generating ? '⏳ Generating...' : `⚡ Generate Report Cards for All ${classStudents.length || ''} Students`}
                            </button>
                        </div>
                    )}

                    {/* ── PER STUDENT MODE ── */}
                    {genMode === 'student' && (
                        <form onSubmit={handleGenerateStudent}>
                            <div style={styles.genFormGroup}>
                                <label style={styles.genLabel}>👤 Student</label>
                                <select style={styles.genInput} value={genStudent}
                                    onChange={e => setGenStudent(e.target.value)} required>
                                    <option value="">-- Select Student --</option>
                                    {students.slice().sort((a,b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`)).map(s => (
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
                    <div style={styles.form}>
                        <h3>✏️ Edit — {editingCard.student?.firstName} {editingCard.student?.lastName}</h3>
                        <form onSubmit={handleUpdate}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Grade Rank</label>
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
                                <button type="submit" style={styles.submitBtn}>✅ Update</button>
                                <button type="button" onClick={() => setEditingCard(null)} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filters + Print All */}
                <div style={styles.filterCard}>
                    <div style={styles.filterGrid}>
                        <input style={styles.searchInput} placeholder="🔍 Search by name or admission no..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                        <select style={styles.genInput} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                            <option value="">All Classes</option>
                            {uniqueClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                        <select style={styles.genInput} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                            <option value="">All Exams</option>
                            {exams.map(ex => <option key={ex.examId} value={ex.examId}>{ex.examName}</option>)}
                        </select>
                        <button onClick={() => { setSearch(''); setFilterClass(''); setFilterExam(''); }} style={styles.clearBtn}>Clear</button>
                        <button
                            onClick={() => {
                                if (!filterExam || !filterClass) {
                                    showToast('Select both a class and exam filter to print all', 'error');
                                    return;
                                }
                                setShowPrintAll(true);
                            }}
                            style={styles.printAllBtn}>
                            🖨️ Print All (Filtered)
                        </button>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <Spinner message="Loading report cards..." />
                ) : (
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeader}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Student</th>
                                    <th style={styles.th}>Adm No</th>
                                    <th style={styles.th}>Class</th>
                                    <th style={styles.th}>Exam</th>
                                    <th style={styles.th}>Total</th>
                                    <th style={styles.th}>Average</th>
                                    <th style={styles.th}>Class Rank</th>
                                    <th style={styles.th}>Grade Rank</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((card, index) => (
                                    <tr key={card.reportId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                        <td style={styles.td}>{index + 1}</td>
                                        <td style={styles.td}>
                                            <strong>{card.student?.firstName} {card.student?.lastName}</strong>
                                        </td>
                                        <td style={styles.td}>
                                            <span style={styles.admNo}>{card.student?.admissionNumber || '-'}</span>
                                        </td>
                                        <td style={styles.td}>
                                            <span style={{...styles.classBadge, backgroundColor: getSectionColor(card.student?.className)}}>
                                                {card.student?.className}
                                            </span>
                                        </td>
                                        <td style={styles.td}>{card.exam?.examName}</td>
                                        <td style={styles.td}><strong>{card.totalMarks}</strong></td>
                                        <td style={styles.td}>
                                            <span style={{
                                                ...styles.avgBadge,
                                                backgroundColor:
                                                    card.averageMarks >= 80 ? '#28a745' :
                                                    card.averageMarks >= 60 ? '#2E75B6' :
                                                    card.averageMarks >= 40 ? '#ffc107' : '#dc3545'
                                            }}>
                                                {card.averageMarks?.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td style={styles.td}>{card.classRank || '-'}</td>
                                        <td style={styles.td}>{card.termRank || '-'}</td>
                                        <td style={styles.td}>
                                            <button onClick={() => handleEdit(card)} style={styles.editBtn}>Edit</button>
                                            <button onClick={() => handlePrintCard(card)} style={styles.printBtn}>🖨️</button>
                                            <button onClick={() => handleDelete(card.reportId)} style={styles.deleteBtn}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                            No report cards found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
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

            {/* Print All Modal */}
            {showPrintAll && (
                <PrintAllReportCards
                    examId={filterExam}
                    classId={filterClass}
                    className={filterClass}
                    examName={exams.find(ex => String(ex.examId) === String(filterExam))?.examName || ''}
                    onClose={() => setShowPrintAll(false)}
                />
            )}
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
    subtitle: { color: '#666', marginBottom: '20px' },

    // Generate Card
    genCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    genTabs: { display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' },
    genTab: { padding: '10px 20px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    genFormGroup: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' },
    genLabel: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    genInput: { padding: '10px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px' },
    genPreview: { display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' },
    genPreviewBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
    generateBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', width: '100%' },
    progressBox: { marginBottom: '15px' },
    progressBarOuter: { height: '10px', backgroundColor: '#e9ecef', borderRadius: '5px', overflow: 'hidden', marginBottom: '6px' },
    progressBarInner: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s' },
    progressText: { fontSize: '13px', color: '#666', margin: 0 },

    // Filter card
    filterCard: { backgroundColor: 'white', padding: '15px 20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    filterGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: '10px', alignItems: 'center' },
    searchInput: { padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
    printAllBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },

    // Edit form
    form: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    input: { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },

    // Table
    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '900px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', whiteSpace: 'nowrap' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
    avgBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    classBadge: { color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace' },
};

const printStyles = {
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
    footerText: { textAlign: 'center', fontSize: '11px', color: '#666' }
};

export default ReportCards;