import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

// ✅ Outside parent — prevents keyboard dismiss on mobile
const ScheduleForm = ({ formData, setFormData, exams, classes, subjects, onSubmit, onCancel, submitLabel }) => (
    <form onSubmit={onSubmit} style={{ marginTop:'10px' }}>
        <div style={styles.formGrid}>
            <div style={styles.formGroup}>
                <label style={styles.label}>📝 Exam</label>
                <select style={styles.input} value={formData.exam.examId}
                    onChange={e => setFormData(prev => ({...prev, exam: { examId: e.target.value }}))} required>
                    <option value="">Select Exam</option>
                    {exams.map(ex => (
                        <option key={ex.examId} value={ex.examId}>
                            {ex.examName} — Term {ex.term} {ex.academicYear}
                        </option>
                    ))}
                </select>
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>🏫 Class</label>
                <select style={styles.input} value={formData.schoolClass.classId}
                    onChange={e => setFormData(prev => ({...prev, schoolClass: { classId: e.target.value }}))} required>
                    <option value="">Select Class</option>
                    {classes.map(cls => (
                        <option key={cls.classId} value={cls.classId}>{cls.className}</option>
                    ))}
                </select>
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>📚 Subject</label>
                <select style={styles.input} value={formData.subject.subjectId}
                    onChange={e => setFormData(prev => ({...prev, subject: { subjectId: e.target.value }}))} required>
                    <option value="">Select Subject</option>
                    {subjects.map(sub => (
                        <option key={sub.subjectId} value={sub.subjectId}>{sub.subjectName}</option>
                    ))}
                </select>
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>🗓️ Exam Date</label>
                <input type="date" style={styles.input} value={formData.examDate}
                    onChange={e => setFormData(prev => ({...prev, examDate: e.target.value}))} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>⏰ Start Time</label>
                <input type="time" style={styles.input} value={formData.startTime}
                    onChange={e => setFormData(prev => ({...prev, startTime: e.target.value}))} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>⏰ End Time</label>
                <input type="time" style={styles.input} value={formData.endTime}
                    onChange={e => setFormData(prev => ({...prev, endTime: e.target.value}))} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>📍 Venue</label>
                <input style={styles.input} value={formData.venue}
                    onChange={e => setFormData(prev => ({...prev, venue: e.target.value}))}
                    placeholder="e.g. Hall 1, Classroom 3A" />
            </div>
        </div>
        <div style={styles.btnGroup}>
            <button type="submit" style={styles.submitBtn}>{submitLabel}</button>
            <button type="button" onClick={onCancel} style={styles.cancelBtn}>✕ Cancel</button>
        </div>
    </form>
);

function ExamSchedules() {
    const [schedules, setSchedules] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [filterExam, setFilterExam] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        examDate:'', startTime:'', endTime:'', venue:'',
        exam:{ examId:'' }, schoolClass:{ classId:'' }, subject:{ subjectId:'' }
    });

    const emptyForm = { examDate:'', startTime:'', endTime:'', venue:'', exam:{examId:''}, schoolClass:{classId:''}, subject:{subjectId:''} };

    useEffect(() => { fetchSchedules(); fetchExams(); fetchClasses(); fetchSubjects(); fetchAcademicYears(); }, []);

    useEffect(() => {
        let data = schedules;
        if (filterYear) data = data.filter(s => s.exam?.academicYear === filterYear);
        if (filterExam) data = data.filter(s => String(s.exam?.examId) === String(filterExam));
        if (filterClass) data = data.filter(s => String(s.schoolClass?.classId) === String(filterClass));
        if (search) data = data.filter(s =>
            s.schoolClass?.className?.toLowerCase().includes(search.toLowerCase()) ||
            s.subject?.subjectName?.toLowerCase().includes(search.toLowerCase()) ||
            s.venue?.toLowerCase().includes(search.toLowerCase())
        );
        setFiltered(data);
    }, [filterExam, filterYear, filterClass, search, schedules]);

    const fetchSchedules = async () => {
        try { const r = await api.get('/api/exam-schedules'); setSchedules(r.data); setFiltered(r.data); setLoading(false); }
        catch (err) { setError('Failed to load exam schedules'); setLoading(false); }
    };
    const fetchExams = async () => { try { const r = await api.get('/api/exams'); setExams(r.data); } catch(e) {} };
    const fetchClasses = async () => { try { const r = await api.get('/api/classes'); setClasses(r.data); } catch(e) {} };
    const fetchAcademicYears = async () => { try { const r = await api.get('/api/academic-years'); setAcademicYears(r.data); } catch(e) {} };
    const fetchSubjects = async () => { try { const r = await api.get('/api/subjects'); setSubjects(r.data); } catch(e) {} };

    const handleEdit = (schedule) => {
        if (editingSchedule?.scheduleId === schedule.scheduleId) { setEditingSchedule(null); return; }
        setEditingSchedule(schedule);
        setFormData({
            examDate: schedule.examDate || '', startTime: schedule.startTime || '',
            endTime: schedule.endTime || '', venue: schedule.venue || '',
            exam: { examId: schedule.exam?.examId || '' },
            schoolClass: { classId: schedule.schoolClass?.classId || '' },
            subject: { subjectId: schedule.subject?.subjectId || '' }
        });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => { setEditingSchedule(null); setFormData(emptyForm); };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/exam-schedules', formData);
            setShowAddForm(false); setFormData(emptyForm); fetchSchedules();
            setSuccessMsg('✅ Schedule added!'); setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to save exam schedule'); }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/exam-schedules/${editingSchedule.scheduleId}`, formData);
            setEditingSchedule(null); setFormData(emptyForm); fetchSchedules();
            setSuccessMsg('✅ Schedule updated!'); setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to update exam schedule'); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Delete this schedule?')) {
            try {
                await api.delete(`/api/exam-schedules/${id}`);
                if (editingSchedule?.scheduleId === id) setEditingSchedule(null);
                fetchSchedules();
                setSuccessMsg('Deleted'); setTimeout(() => setSuccessMsg(''), 2000);
            } catch (err) { setError('Failed to delete exam schedule'); }
        }
    };

    const handlePrint = () => {
        const html = `<!DOCTYPE html><html><head><title>Exam Schedule</title>
        <style>body{font-family:Times New Roman,serif;font-size:12px;padding:15px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#1F3864;color:white;padding:8px;}
        td{padding:6px 8px;border:1px solid #ddd;}
        tr:nth-child(even){background:#f8f9fa;}
        h2{color:#1F3864;text-align:center;}
        .header{text-align:center;margin-bottom:15px;border-bottom:3px solid #1F3864;padding-bottom:10px;}
        </style></head><body>
        <div class="header">
            <h3 style="color:#1F3864;margin:0;text-transform:uppercase;">PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL</h3>
            <p style="color:#666;margin:4px 0;">Exam Schedule — ${filterExam ? exams.find(e=>String(e.examId)===filterExam)?.examName : 'All Exams'}</p>
        </div>
        <table><thead><tr>
            <th>#</th><th>Exam</th><th>Class</th><th>Subject</th><th>Date</th><th>Start</th><th>End</th><th>Venue</th>
        </tr></thead><tbody>
        ${filtered.map((s,i) => `<tr>
            <td>${i+1}</td>
            <td>${s.exam?.examName||''}</td>
            <td>${s.schoolClass?.className||''}</td>
            <td>${s.subject?.subjectName||''}</td>
            <td>${s.examDate||''}</td>
            <td>${s.startTime||''}</td>
            <td>${s.endTime||''}</td>
            <td>${s.venue||'-'}</td>
        </tr>`).join('')}
        </tbody></table>
        <p style="text-align:center;font-size:10px;color:#999;margin-top:10px;">Printed: ${new Date().toLocaleDateString()}</p>
        </body></html>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); }
    };

    // Group filtered schedules by date
    const groupedByDate = filtered.reduce((groups, schedule) => {
        const date = schedule.examDate || 'No Date';
        if (!groups[date]) groups[date] = [];
        groups[date].push(schedule);
        return groups;
    }, {});

    const uniqueYears = [...new Set(exams.map(e => e.academicYear))].filter(Boolean).sort().reverse();

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}><img src={logo1} alt="Logo" style={styles.navLogo} /><h2 style={styles.navTitle}>Pipeline Adventist School</h2></div>
                <div style={styles.navRight}>
                    <button onClick={() => window.location.href = '/dashboard'} style={styles.navBtn}>← Dashboard</button>
                    <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}>🗓️ Exam Schedules</h2>
                        <p style={styles.subtitle}>{filtered.length} schedule(s) shown</p>
                    </div>
                    <div style={{ display:'flex', gap:'10px' }}>
                        <button onClick={handlePrint} style={styles.printBtn}>🖨️ Print Schedule</button>
                        <button onClick={() => { setShowAddForm(!showAddForm); setEditingSchedule(null); }} style={styles.addBtn}>
                            {showAddForm ? '✕ Cancel' : '+ Add Schedule'}
                        </button>
                    </div>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}>➕ Add New Schedule</h3>
                        <ScheduleForm formData={formData} setFormData={setFormData}
                            exams={exams} classes={classes} subjects={subjects}
                            onSubmit={handleSubmitAdd}
                            onCancel={() => { setShowAddForm(false); setFormData(emptyForm); }}
                            submitLabel="💾 Save Schedule" />
                    </div>
                )}

                {/* Filters */}
                <div style={styles.searchBar}>
                    <select style={styles.filterSelect} value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterExam(''); }}>
                        <option value="">All Years</option>
                        {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select style={styles.filterSelect} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                        <option value="">All Exams</option>
                        {exams.filter(e => !filterYear || e.academicYear === filterYear).map(ex => (
                            <option key={ex.examId} value={ex.examId}>{ex.examName} — {ex.academicYear}</option>
                        ))}
                    </select>
                    <select style={styles.filterSelect} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                        <option value="">All Classes</option>
                        {classes.map(cls => <option key={cls.classId} value={cls.classId}>{cls.className}</option>)}
                    </select>
                    <input style={styles.searchInput} placeholder="🔍 Search subject, venue..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <button onClick={() => { setSearch(''); setFilterExam(''); setFilterYear(''); setFilterClass(''); }} style={styles.clearBtn}>✕ Clear</button>
                </div>

                {loading ? <p style={{ textAlign:'center', padding:'40px', color:'#666' }}>⏳ Loading schedules...</p> : filtered.length === 0 ? (
                    <div style={styles.emptyState}><div style={{ fontSize:'48px', marginBottom:'15px' }}>🗓️</div><h3>No Schedules Found</h3><p>Click + Add Schedule to create one</p></div>
                ) : (
                    // Group by date
                    Object.entries(groupedByDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, daySchedules]) => (
                        <div key={date} style={styles.dateGroup}>
                            <div style={styles.dateHeader}>
                                <span>📅 {date !== 'No Date' ? new Date(date).toLocaleDateString('en-KE', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : 'No Date Set'}</span>
                                <span style={{ fontSize:'12px', opacity:0.8 }}>{daySchedules.length} session(s)</span>
                            </div>
                            <div style={styles.tableWrapper}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.tableHeader}>
                                            <th style={styles.th}>#</th>
                                            <th style={styles.th}>Exam</th>
                                            <th style={styles.th}>Class</th>
                                            <th style={styles.th}>Subject</th>
                                            <th style={styles.th}>Start</th>
                                            <th style={styles.th}>End</th>
                                            <th style={styles.th}>Venue</th>
                                            <th style={styles.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {daySchedules.map((schedule, index) => {
                                            const isEditing = editingSchedule?.scheduleId === schedule.scheduleId;
                                            return (
                                                <React.Fragment key={schedule.scheduleId}>
                                                    <tr style={{ ...(index%2===0?styles.trEven:styles.trOdd), outline: isEditing?'2px solid #2E75B6':'none', outlineOffset:'-2px' }}>
                                                        <td style={styles.td}>{index+1}</td>
                                                        <td style={styles.td}><span style={styles.examBadge}>{schedule.exam?.examName}</span></td>
                                                        <td style={styles.td}><span style={styles.classBadge}>{schedule.schoolClass?.className}</span></td>
                                                        <td style={styles.td}>{schedule.subject?.subjectName}</td>
                                                        <td style={styles.td}><strong>{schedule.startTime}</strong></td>
                                                        <td style={styles.td}>{schedule.endTime}</td>
                                                        <td style={styles.td}>{schedule.venue || <span style={{ color:'#ccc' }}>—</span>}</td>
                                                        <td style={styles.td}>
                                                            <div style={{ display:'flex', gap:'5px' }}>
                                                                <button onClick={() => handleEdit(schedule)} style={isEditing?styles.cancelEditBtn:styles.editBtn}>
                                                                    {isEditing ? '✕' : 'Edit'}
                                                                </button>
                                                                <button onClick={() => handleDelete(schedule.scheduleId)} style={styles.deleteBtn}>Del</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isEditing && (
                                                        <tr>
                                                            <td colSpan="8" style={{ padding:0, border:'none' }}>
                                                                <div style={{ backgroundColor:'#f0f7ff', padding:'15px 20px', borderLeft:'4px solid #2E75B6', borderBottom:'1px solid #ddd' }}>
                                                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                                                                        <h4 style={{ color:'#2E75B6', margin:0, fontSize:'13px' }}>
                                                                            ✏️ Editing: {schedule.exam?.examName} — {schedule.schoolClass?.className} — {schedule.subject?.subjectName}
                                                                        </h4>
                                                                        <button onClick={handleCancelEdit} style={{ background:'none', border:'none', fontSize:'16px', cursor:'pointer', color:'#999' }}>✕</button>
                                                                    </div>
                                                                    <ScheduleForm formData={formData} setFormData={setFormData}
                                                                        exams={exams} classes={classes} subjects={subjects}
                                                                        onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                                                                        submitLabel="✅ Update Schedule" />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

const styles = {
    container: { minHeight:'100vh', backgroundColor:'#f0f2f5' },
    navbar: { backgroundColor:'#1F3864', padding:'15px 30px', display:'flex', justifyContent:'space-between', alignItems:'center' },
    navLeft: { display:'flex', alignItems:'center', gap:'10px' },
    navLogo: { width:'45px', height:'45px', objectFit:'contain' },
    navTitle: { color:'white', margin:0, fontSize:'18px' },
    navRight: { display:'flex', gap:'10px' },
    navBtn: { backgroundColor:'transparent', color:'white', border:'1px solid white', padding:'8px 16px', borderRadius:'5px', cursor:'pointer' },
    logoutBtn: { backgroundColor:'transparent', color:'white', border:'1px solid white', padding:'8px 16px', borderRadius:'5px', cursor:'pointer' },
    content: { padding:'clamp(15px,3vw,30px)' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'10px' },
    title: { color:'#1F3864', margin:'0 0 5px 0', fontSize:'24px' },
    subtitle: { color:'#666', margin:0, fontSize:'14px' },
    addBtn: { backgroundColor:'#1F3864', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' },
    printBtn: { backgroundColor:'#28a745', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' },
    error: { color:'red', padding:'10px', backgroundColor:'#fff3f3', borderRadius:'5px', marginBottom:'15px' },
    success: { color:'#155724', padding:'10px', backgroundColor:'#d4edda', borderRadius:'5px', marginBottom:'15px' },
    addFormCard: { backgroundColor:'white', padding:'20px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.12)', border:'2px solid #1F3864' },
    formTitle: { color:'#1F3864', margin:'0 0 5px 0' },
    formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'12px', marginBottom:'12px' },
    formGroup: { display:'flex', flexDirection:'column', gap:'5px' },
    label: { fontSize:'12px', fontWeight:'bold', color:'#1F3864' },
    input: { padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px' },
    btnGroup: { display:'flex', gap:'10px', marginTop:'5px' },
    submitBtn: { backgroundColor:'#2E75B6', color:'white', border:'none', padding:'10px 22px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' },
    cancelBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'10px 18px', borderRadius:'5px', cursor:'pointer', fontSize:'14px' },
    searchBar: { display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap' },
    searchInput: { flex:1, padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px', minWidth:'180px' },
    filterSelect: { padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px' },
    clearBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'10px 15px', borderRadius:'5px', cursor:'pointer' },
    dateGroup: { marginBottom:'20px' },
    dateHeader: { backgroundColor:'#2E75B6', color:'white', padding:'10px 15px', borderRadius:'8px 8px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight:'bold', fontSize:'14px' },
    tableWrapper: { overflowX:'auto', borderRadius:'0 0 8px 8px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    table: { width:'100%', borderCollapse:'collapse', backgroundColor:'white', minWidth:'700px' },
    tableHeader: { backgroundColor:'#1F3864' },
    th: { color:'white', padding:'10px 12px', textAlign:'left', whiteSpace:'nowrap', fontSize:'12px' },
    td: { padding:'9px 12px', borderBottom:'1px solid #eee', fontSize:'13px' },
    trEven: { backgroundColor:'#f9f9f9' },
    trOdd: { backgroundColor:'white' },
    editBtn: { backgroundColor:'#2E75B6', color:'white', border:'none', padding:'5px 10px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    cancelEditBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'5px 10px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    deleteBtn: { backgroundColor:'#dc3545', color:'white', border:'none', padding:'5px 10px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    classBadge: { backgroundColor:'#e3f2fd', color:'#1F3864', padding:'2px 8px', borderRadius:'3px', fontSize:'12px', fontWeight:'bold' },
    examBadge: { backgroundColor:'#fff3cd', color:'#856404', padding:'2px 8px', borderRadius:'3px', fontSize:'12px', fontWeight:'bold' },
    emptyState: { backgroundColor:'white', padding:'60px', borderRadius:'10px', textAlign:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
};

export default ExamSchedules;