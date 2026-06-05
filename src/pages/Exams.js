import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Exams() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingExam, setEditingExam] = useState(null);
    const [formData, setFormData] = useState({
        examName: '',
        academicYear: '',
        term: '',
        startDate: '',
        endDate: '',
        classLevel: ''
    });

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        try {
            const response = await api.get('/api/exams');
            setExams(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load exams');
            setLoading(false);
        }
    };

    const handleEdit = (exam) => {
        setEditingExam(exam);
        setFormData({
            examName: exam.examName,
            academicYear: exam.academicYear,
            term: exam.term,
            startDate: exam.startDate,
            endDate: exam.endDate,
            classLevel: exam.classLevel
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingExam) {
                await api.put(`/api/exams/${editingExam.examId}`, {
                    ...formData,
                    term: parseInt(formData.term)
                });
            } else {
                await api.post('/api/exams', {
                    ...formData,
                    term: parseInt(formData.term)
                });
            }
            setShowForm(false);
            setEditingExam(null);
            setFormData({ examName: '', academicYear: '', term: '', startDate: '', endDate: '', classLevel: '' });
            fetchExams();
        } catch (err) {
            setError('Failed to save exam');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/exams/${id}`);
                fetchExams();
            } catch (err) {
                setError('Failed to delete exam');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingExam(null);
        setFormData({ examName: '', academicYear: '', term: '', startDate: '', endDate: '', classLevel: '' });
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
                    <h2 style={styles.title}>Exam Management</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingExam(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Exam'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingExam ? 'Edit Exam' : 'Add New Exam'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Exam Name</label>
                                    <select style={styles.input} value={formData.examName}
                                        onChange={e => setFormData({...formData, examName: e.target.value})}
                                        placeholder="e.g. End Term 1 2024" required >
                                        <option value="">Select Exam Name</option>
                                        <option value="OPENER   EXAM">OPENER   EXAM</option>
                                        <option value="MID TERM EXAM">MID TERM EXAM</option>
                                        <option value="END TERM EXAM">END TERM EXAM</option>
                                    </select>
                                        
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Academic Year</label>
                                    <input style={styles.input} value={formData.academicYear}
                                        onChange={e => setFormData({...formData, academicYear: e.target.value})}
                                        placeholder="e.g. 2024" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Term</label>
                                    <select style={styles.input} value={formData.term}
                                        onChange={e => setFormData({...formData, term: e.target.value})} required>
                                        <option value="">Select Term</option>
                                        <option value="1">Term 1</option>
                                        <option value="2">Term 2</option>
                                        <option value="3">Term 3</option>
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Start Date</label>
                                    <input type="date" style={styles.input} value={formData.startDate}
                                        onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>End Date</label>
                                    <input type="date" style={styles.input} value={formData.endDate}
                                        onChange={e => setFormData({...formData, endDate: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Class Level</label>
                                    <select style={styles.input} value={formData.classLevel}
                                        onChange={e => setFormData({...formData, classLevel: e.target.value})} required>
                                        <option value="">Select Class Level</option>
                                        <option value="PRE-SCHOOL">PRE-SCHOOL</option>
                                        <option value="LOWER PRIMARY">LOWER PRIMARY</option>
                                        <option value="UPPER PRIMARY">UPPER PRIMARY</option>
                                        <option value="JUNIOR SCHOOL">JUNIOR SCHOOL</option>
                                    </select>                                  
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingExam ? 'Update Exam' : 'Save Exam'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? <p>Loading exams...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Exam Name</th>
                                <th style={styles.th}>Academic Year</th>
                                <th style={styles.th}>Term</th>
                                <th style={styles.th}>Start Date</th>
                                <th style={styles.th}>End Date</th>
                                <th style={styles.th}>Class Level</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.map((exam, index) => (
                                <tr key={exam.examId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{exam.examName}</td>
                                    <td style={styles.td}>{exam.academicYear}</td>
                                    <td style={styles.td}><span style={styles.termBadge}>Term {exam.term}</span></td>
                                    <td style={styles.td}>{exam.startDate}</td>
                                    <td style={styles.td}>{exam.endDate}</td>
                                    <td style={styles.td}>{exam.classLevel}</td>
                                    <td style={styles.td}>
                                        <button onClick={() => handleEdit(exam)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handleDelete(exam.examId)} style={styles.deleteBtn}>Delete</button>
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
    termBadge: { backgroundColor: '#1F3864', color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default Exams;