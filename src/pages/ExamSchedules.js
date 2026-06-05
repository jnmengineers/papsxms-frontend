import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function ExamSchedules() {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [formData, setFormData] = useState({
        examDate: '',
        startTime: '',
        endTime: '',
        venue: '',
        exam: { examId: '' },
        schoolClass: { classId: '' },
        subject: { subjectId: '' }
    });

    useEffect(() => {
        fetchSchedules();
        fetchExams();
        fetchClasses();
        fetchSubjects();
    }, []);

    const fetchSchedules = async () => {
        try {
            const response = await api.get('/api/exam-schedules');
            setSchedules(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load exam schedules');
            setLoading(false);
        }
    };

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    const fetchSubjects = async () => {
        const response = await api.get('/api/subjects');
        setSubjects(response.data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/exam-schedules', formData);
            setShowForm(false);
            setFormData({
                examDate: '',
                startTime: '',
                endTime: '',
                venue: '',
                exam: { examId: '' },
                schoolClass: { classId: '' },
                subject: { subjectId: '' }
            });
            fetchSchedules();
        } catch (err) {
            setError('Failed to add exam schedule');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/exam-schedules/${id}`);
                fetchSchedules();
            } catch (err) {
                setError('Failed to delete exam schedule');
            }
        }
    };

    return (
        <div style={styles.container}>
            {/* Navbar */}
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
                    <h2 style={styles.title}>🗓️ Exam Schedules</h2>
                    <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Schedule'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {/* Add Schedule Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3>Add New Exam Schedule</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Exam</label>
                                    <select
                                        style={styles.input}
                                        value={formData.exam.examId}
                                        onChange={e => setFormData({...formData, exam: { examId: e.target.value }})}
                                        required
                                    >
                                        <option value="">Select Exam</option>
                                        {exams.map(ex => (
                                            <option key={ex.examId} value={ex.examId}>
                                                {ex.examName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Class</label>
                                    <select
                                        style={styles.input}
                                        value={formData.schoolClass.classId}
                                        onChange={e => setFormData({...formData, schoolClass: { classId: e.target.value }})}
                                        required
                                    >
                                        <option value="">Select Class</option>
                                        {classes.map(cls => (
                                            <option key={cls.classId} value={cls.classId}>
                                                {cls.className}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Subject</label>
                                    <select
                                        style={styles.input}
                                        value={formData.subject.subjectId}
                                        onChange={e => setFormData({...formData, subject: { subjectId: e.target.value }})}
                                        required
                                    >
                                        <option value="">Select Subject</option>
                                        {subjects.map(sub => (
                                            <option key={sub.subjectId} value={sub.subjectId}>
                                                {sub.subjectName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Exam Date</label>
                                    <input
                                        type="date"
                                        style={styles.input}
                                        value={formData.examDate}
                                        onChange={e => setFormData({...formData, examDate: e.target.value})}
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Start Time</label>
                                    <input
                                        type="date"
                                        style={styles.input}
                                        value={formData.startTime}
                                        onChange={e => setFormData({...formData, startTime: e.target.value})}
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>End Time</label>
                                    <input
                                        type="date"
                                        style={styles.input}
                                        value={formData.endTime}
                                        onChange={e => setFormData({...formData, endTime: e.target.value})}
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Venue</label>
                                    <input
                                        style={styles.input}
                                        value={formData.venue}
                                        onChange={e => setFormData({...formData, venue: e.target.value})}
                                        placeholder="e.g. Hall 1"
                                    />
                                </div>
                            </div>
                            <button type="submit" style={styles.submitBtn}>Save Schedule</button>
                        </form>
                    </div>
                )}

                {/* Schedules Table */}
                {loading ? (
                    <p>Loading schedules...</p>
                ) : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Exam</th>
                                <th style={styles.th}>Class</th>
                                <th style={styles.th}>Subject</th>
                                <th style={styles.th}>Exam Date</th>
                                <th style={styles.th}>Venue</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.map((schedule, index) => (
                                <tr key={schedule.scheduleId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{schedule.exam?.examName}</td>
                                    <td style={styles.td}>{schedule.schoolClass?.className}</td>
                                    <td style={styles.td}>{schedule.subject?.subjectName}</td>
                                    <td style={styles.td}>{schedule.examDate}</td>
                                    <td style={styles.td}>{schedule.venue || '-'}</td>
                                    <td style={styles.td}>
                                        <button
                                            onClick={() => handleDelete(schedule.scheduleId)}
                                            style={styles.deleteBtn}>
                                            Delete
                                        </button>
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
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default ExamSchedules;