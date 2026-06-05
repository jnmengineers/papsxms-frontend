import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Results() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingResult, setEditingResult] = useState(null);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [exams, setExams] = useState([]);
    const [formData, setFormData] = useState({
        marksObtained: '',
        maxMarks: '100',
        student: { studentId: '' },
        subject: { subjectId: '' },
        exam: { examId: '' }
    });

    useEffect(() => {
        fetchResults();
        fetchStudents();
        fetchSubjects();
        fetchExams();
    }, []);

    const [search, setSearch] = useState('');
const [filtered, setFiltered] = useState([]);
const [filterExam, setFilterExam] = useState('');

useEffect(() => {
    let data = results;
    if (search) {
        data = data.filter(r =>
            r.student?.firstName.toLowerCase().includes(search.toLowerCase()) ||
            r.student?.lastName.toLowerCase().includes(search.toLowerCase())
        );
    }
    if (filterExam) {
        data = data.filter(r => r.exam?.examId === parseInt(filterExam));
    }
    setFiltered(data);
}, [search, filterExam, results]);         

    const fetchResults = async () => {
        try {
            const response = await api.get('/api/results');
            setResults(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load results');
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        const response = await api.get('/api/students');
        setStudents(response.data);
    };

    const fetchSubjects = async () => {
        const response = await api.get('/api/subjects');
        setSubjects(response.data);
    };

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    const handleEdit = (result) => {
        setEditingResult(result);
        setFormData({
            marksObtained: result.marksObtained,
            maxMarks: result.maxMarks,
            student: { studentId: result.student?.studentId },
            subject: { subjectId: result.subject?.subjectId },
            exam: { examId: result.exam?.examId }
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingResult) {
                await api.put(`/api/results/${editingResult.resultId}`, {
                    marksObtained: parseFloat(formData.marksObtained),
                    maxMarks: parseFloat(formData.maxMarks)
                });
            } else {
                await api.post('/api/results', formData);
            }
            setShowForm(false);
            setEditingResult(null);
            setFormData({ marksObtained: '', maxMarks: '100', student: { studentId: '' }, subject: { subjectId: '' }, exam: { examId: '' } });
            fetchResults();
        } catch (err) {
            setError('Failed to save result');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/results/${id}`);
                fetchResults();
            } catch (err) {
                setError('Failed to delete result');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingResult(null);
        setFormData({ marksObtained: '', maxMarks: '100', student: { studentId: '' }, subject: { subjectId: '' }, exam: { examId: '' } });
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
                <div style={styles.header}>
                    <h2 style={styles.title}>📊 Results</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingResult(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Result'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                <div style={styles.searchBar}>
    <input
        style={styles.searchInput}
        placeholder="🔍 Search by student name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
    />
    <select style={styles.filterSelect} value={filterExam}
        onChange={e => setFilterExam(e.target.value)}>
        <option value="">All Exams</option>
        {exams.map(e => (
            <option key={e.examId} value={e.examId}>{e.examName}</option>
        ))}
    </select>
    <button onClick={() => { setSearch(''); setFilterExam(''); }} style={styles.clearBtn}>Clear</button>
</div>

                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingResult ? 'Edit Result' : 'Add New Result'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                {!editingResult && (
                                    <>
                                        <div style={styles.formGroup}>
                                            <label>Student</label>
                                            <select style={styles.input} value={formData.student.studentId}
                                                onChange={e => setFormData({...formData, student: { studentId: e.target.value }})} required>
                                                <option value="">Select Student</option>
                                                {students.map(s => (
                                                    <option key={s.studentId} value={s.studentId}>
                                                        {s.firstName} {s.lastName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={styles.formGroup}>
                                            <label>Subject</label>
                                            <select style={styles.input} value={formData.subject.subjectId}
                                                onChange={e => setFormData({...formData, subject: { subjectId: e.target.value }})} required>
                                                <option value="">Select Subject</option>
                                                {subjects.map(s => (
                                                    <option key={s.subjectId} value={s.subjectId}>
                                                        {s.subjectName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={styles.formGroup}>
                                            <label>Exam</label>
                                            <select style={styles.input} value={formData.exam.examId}
                                                onChange={e => setFormData({...formData, exam: { examId: e.target.value }})} required>
                                                <option value="">Select Exam</option>
                                                {exams.map(e => (
                                                    <option key={e.examId} value={e.examId}>
                                                        {e.examName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                                <div style={styles.formGroup}>
                                    <label>Marks Obtained</label>
                                    <input type="number" min="0" max="100" style={styles.input}
                                        value={formData.marksObtained}
                                        onChange={e => setFormData({...formData, marksObtained: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Max Marks</label>
                                    <input type="number" style={styles.input} value={formData.maxMarks}
                                        onChange={e => setFormData({...formData, maxMarks: e.target.value})} required />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingResult ? 'Update Result' : 'Save Result'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? <p>Loading results...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Student</th>
                                <th style={styles.th}>Subject</th>
                                <th style={styles.th}>Exam</th>
                                <th style={styles.th}>Marks</th>
                                <th style={styles.th}>Max Marks</th>
                                <th style={styles.th}>Grade</th>
                                <th style={styles.th}>Remarks</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((result, index) => (
                                <tr key={result.resultId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{result.student?.firstName} {result.student?.lastName}</td>
                                    <td style={styles.td}>{result.subject?.subjectName}</td>
                                    <td style={styles.td}>{result.exam?.examName}</td>
                                    <td style={styles.td}>{result.marksObtained}</td>
                                    <td style={styles.td}>{result.maxMarks}</td>
                                    <td style={styles.td}>
                                        <span style={{...styles.gradeBadge, backgroundColor:
                                            result.grade === 'A' ? '#28a745' :
                                            result.grade === 'B' ? '#2E75B6' :
                                            result.grade === 'C' ? '#ffc107' : '#dc3545'}}>
                                            {result.grade}
                                        </span>
                                    </td>
                                    <td style={styles.td}>{result.remarks}</td>
                                    <td style={styles.td}>
                                        <button onClick={() => handleEdit(result)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handleDelete(result.resultId)} style={styles.deleteBtn}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { color: '#1F3864', margin: 0 },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    error: { color: 'red', marginBottom: '15px' },
    form: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    input: { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' },
filterSelect: { padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default Results;