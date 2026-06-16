import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function ExamSchedules() {
    const [schedules, setSchedules] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [filterExam, setFilterExam] = useState('');
    const [search, setSearch] = useState('');
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

    useEffect(() => {
        let data = schedules;
        if (filterExam) data = data.filter(s => String(s.exam?.examId) === String(filterExam));
        if (search) {
            data = data.filter(s =>
                s.schoolClass?.className?.toLowerCase().includes(search.toLowerCase()) ||
                s.subject?.subjectName?.toLowerCase().includes(search.toLowerCase()) ||
                s.venue?.toLowerCase().includes(search.toLowerCase())
            );
        }
        setFiltered(data);
    }, [filterExam, search, schedules]);

    const fetchSchedules = async () => {
        try {
            const response = await api.get('/api/exam-schedules');
            setSchedules(response.data);
            setFiltered(response.data);
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

    const handleEdit = (schedule) => {
        setEditingSchedule(schedule);
        setFormData({
            examDate: schedule.examDate || '',
            startTime: schedule.startTime || '',
            endTime: schedule.endTime || '',
            venue: schedule.venue || '',
            exam: { examId: schedule.exam?.examId || '' },
            schoolClass: { classId: schedule.schoolClass?.classId || '' },
            subject: { subjectId: schedule.subject?.subjectId || '' }
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSchedule) {
                await api.put(`/api/exam-schedules/${editingSchedule.scheduleId}`, formData);
                setSuccessMsg('Schedule updated successfully!');
            } else {
                await api.post('/api/exam-schedules', formData);
                setSuccessMsg('Schedule added successfully!');
            }
            setShowForm(false);
            setEditingSchedule(null);
            setFormData({
                examDate: '', startTime: '', endTime: '', venue: '',
                exam: { examId: '' }, schoolClass: { classId: '' }, subject: { subjectId: '' }
            });
            fetchSchedules();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError('Failed to save exam schedule');
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

    const handleCancel = () => {
        setShowForm(false);
        setEditingSchedule(null);
        setFormData({
            examDate: '', startTime: '', endTime: '', venue: '',
            exam: { examId: '' }, schoolClass: { classId: '' }, subject: { subjectId: '' }
        });
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
                    <h2 style={styles.title}>🗓️ Exam Schedules ({filtered.length})</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingSchedule(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Schedule'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Add/Edit Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingSchedule ? '✏️ Edit Schedule' : '➕ Add New Schedule'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Exam</label>
                                    <select style={styles.input} value={formData.exam.examId}
                                        onChange={e => setFormData({...formData, exam: { examId: e.target.value }})} required>
                                        <option value="">Select Exam</option>
                                        {exams.map(ex => (
                                            <option key={ex.examId} value={ex.examId}>{ex.examName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Class</label>
                                    <select style={styles.input} value={formData.schoolClass.classId}
                                        onChange={e => setFormData({...formData, schoolClass: { classId: e.target.value }})} required>
                                        <option value="">Select Class</option>
                                        {classes.map(cls => (
                                            <option key={cls.classId} value={cls.classId}>{cls.className}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Subject</label>
                                    <select style={styles.input} value={formData.subject.subjectId}
                                        onChange={e => setFormData({...formData, subject: { subjectId: e.target.value }})} required>
                                        <option value="">Select Subject</option>
                                        {subjects.map(sub => (
                                            <option key={sub.subjectId} value={sub.subjectId}>{sub.subjectName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Exam Date</label>
                                    <input type="date" style={styles.input} value={formData.examDate}
                                        onChange={e => setFormData({...formData, examDate: e.target.value})} required />
                                </div>
                                {/* ✅ Fixed — changed from date to time */}
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Start Time</label>
                                    <input type="time" style={styles.input} value={formData.startTime}
                                        onChange={e => setFormData({...formData, startTime: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>End Time</label>
                                    <input type="time" style={styles.input} value={formData.endTime}
                                        onChange={e => setFormData({...formData, endTime: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Venue</label>
                                    <input style={styles.input} value={formData.venue}
                                        onChange={e => setFormData({...formData, venue: e.target.value})}
                                        placeholder="e.g. Hall 1" />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingSchedule ? '✅ Update' : '💾 Save Schedule'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filter & Search */}
                <div style={styles.searchBar}>
                    <select style={styles.filterSelect} value={filterExam}
                        onChange={e => setFilterExam(e.target.value)}>
                        <option value="">All Exams</option>
                        {exams.map(ex => (
                            <option key={ex.examId} value={ex.examId}>{ex.examName}</option>
                        ))}
                    </select>
                    <input style={styles.searchInput} placeholder="🔍 Search by class, subject or venue..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <button onClick={() => { setSearch(''); setFilterExam(''); }} style={styles.clearBtn}>Clear</button>
                </div>

                {/* Table */}
                {loading ? <p>Loading schedules...</p> : (
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeader}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Exam</th>
                                    <th style={styles.th}>Class</th>
                                    <th style={styles.th}>Subject</th>
                                    <th style={styles.th}>Exam Date</th>
                                    <th style={styles.th}>Start Time</th>
                                    <th style={styles.th}>End Time</th>
                                    <th style={styles.th}>Venue</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((schedule, index) => (
                                    <tr key={schedule.scheduleId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                        <td style={styles.td}>{index + 1}</td>
                                        <td style={styles.td}>{schedule.exam?.examName}</td>
                                        <td style={styles.td}>
                                            <span style={styles.classBadge}>{schedule.schoolClass?.className}</span>
                                        </td>
                                        <td style={styles.td}>{schedule.subject?.subjectName}</td>
                                        <td style={styles.td}>{schedule.examDate}</td>
                                        <td style={styles.td}>{schedule.startTime}</td>
                                        <td style={styles.td}>{schedule.endTime}</td>
                                        <td style={styles.td}>{schedule.venue || '-'}</td>
                                        <td style={styles.td}>
                                            <button onClick={() => handleEdit(schedule)} style={styles.editBtn}>Edit</button>
                                            <button onClick={() => handleDelete(schedule.scheduleId)} style={styles.deleteBtn}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="9" style={{textAlign:'center',padding:'20px',color:'#666'}}>No schedules found</td></tr>
                                )}
                            </tbody>
                        </table>
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { color: '#1F3864', margin: 0 },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },
    form: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '13px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' },
    filterSelect: { padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '900px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', whiteSpace: 'nowrap' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    classBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 8px', borderRadius: '3px', fontSize: '12px' }
};

export default ExamSchedules;
