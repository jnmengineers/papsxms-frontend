import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import '../index.css';
import { classDisplayName } from '../utils/classUtils';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} style={{ marginRight: '6px', ...style }} />;

// Outside parent — prevents keyboard dismiss on re-render
const StudentFormFields = ({ formData, setFormData, classId, setClassId, sections, classes, onSubmit, onCancel, submitLabel, submitIcon, showClassField = false }) => (
    <form onSubmit={onSubmit} style={styles.inlineForm}>
        <div style={styles.formGrid}>
            <div style={styles.formGroup}>
                <label style={styles.label}>First Name</label>
                <input style={styles.input} value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Last Name</label>
                <input style={styles.input} value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Date of Birth</label>
                <input type="date" style={styles.input} value={formData.dateOfBirth}
                    onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Gender</label>
                <select style={styles.input} value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})} required>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                </select>
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Admission Number</label>
                <input style={styles.input} value={formData.admissionNumber}
                    onChange={e => setFormData({...formData, admissionNumber: e.target.value})} required />
            </div>
            {showClassField && (
                <div style={styles.formGroup}>
                    <label style={styles.label}>Class</label>
                    <select style={styles.input} value={classId}
                        onChange={e => setClassId(e.target.value)} required>
                        <option value="">Select Class</option>
                        {sections.map(section => (
                            <optgroup key={section.value} label={section.label}>
                                {classes.filter(c => c.section === section.value).map(cls => (
                                    <option key={cls.classId} value={cls.classId}>{cls.className}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
            )}
        </div>
        <div style={styles.btnGroup}>
            <button type="submit" style={styles.submitBtn}><Icon name={submitIcon || 'save-fill'} />{submitLabel}</button>
            <button type="button" onClick={onCancel} style={styles.cancelBtn}><Icon name="x-lg" />Cancel</button>
        </div>
    </form>
);

function Students() {
    const [students, setStudents] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [search, setSearch] = useState('');
    const [filterGender, setFilterGender] = useState('');
    const [selectedClassFilter, setSelectedClassFilter] = useState('');
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: ''
    });
    const [classId, setClassId] = useState('');
    const [classes, setClasses] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [view, setView] = useState('grades');
    const [selectedClass, setSelectedClass] = useState(null);
    const navigate = useNavigate();
    const { toast, showToast, hideToast } = useToast();

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1', light: '#f3e5f5', grades: ['PG', 'PP1', 'PP2'], target: 80 },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6', light: '#e3f2fd', grades: ['G1', 'G2', 'G3'], target: 80 },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14', light: '#fff3e0', grades: ['G4', 'G5', 'G6'], target: 70 },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997', light: '#e0f7f1', grades: ['G7', 'G8', 'G9'], target: 65 }
    ];

    const streamColors = {
        YELLOW: '#ffc107', BLUE: '#2E75B6', RED: '#dc3545', GREEN: '#28a745', default: '#1F3864'
    };

    useEffect(() => { fetchStudents(); fetchClasses(); }, []);

    useEffect(() => {
        let data = students;
        if (search) data = data.filter(s =>
            s.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            s.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            s.admissionNumber?.toLowerCase().includes(search.toLowerCase())
        );
        if (filterGender) data = data.filter(s => s.gender === filterGender);
        if (selectedClassFilter) data = data.filter(s =>
            String(s.schoolClass?.classId) === String(selectedClassFilter)
        );
        setFiltered(data);
    }, [search, filterGender, selectedClassFilter, students]);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/students');
            setStudents(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load students');
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    const extractGrade = (className) => {
        if (!className) return '';
        const name = className.trim().toUpperCase();
        if (name.startsWith('PP2')) return 'PP2';
        if (name.startsWith('PP1')) return 'PP1';
        if (name.startsWith('PG')) return 'PG';
        const match = name.match(/^(G[1-9])\b/);
        return match ? match[1] : '';
    };

    const extractSection = (grade) => {
        if (['PG','PP1','PP2'].includes(grade)) return 'PRE_SCHOOL';
        if (['G1','G2','G3'].includes(grade)) return 'LOWER_PRIMARY';
        if (['G4','G5','G6'].includes(grade)) return 'UPPER_PRIMARY';
        if (['G7','G8','G9'].includes(grade)) return 'JUNIOR_SCHOOL';
        return '';
    };

    const getUniqueGrades = () => {
        const grades = {};
        classes.forEach(cls => {
            const grade = cls.gradeLevel || extractGrade(cls.className);
            const section = cls.section || extractSection(grade);
            if (grade && section) {
                if (!grades[grade]) grades[grade] = { gradeLevel: grade, section, count: 0, classes: [] };
                grades[grade].count++;
                grades[grade].classes.push(cls);
            }
        });
        return Object.values(grades);
    };

    const getClassesForGrade = (gradeLevel) =>
        classes.filter(c => (c.gradeLevel || extractGrade(c.className)) === gradeLevel);

    const getStudentsForClass = (className, classId) => {
        if (classId) {
            return students.filter(s => String(s.schoolClass?.classId) === String(classId));
        }
        return students.filter(s =>
            s.className === className || s.schoolClass?.className === className
        );
    };

    const findClassForStudent = (student) =>
        classes.find(c =>
            String(c.classId) === String(student.schoolClass?.classId) ||
            c.className === student.className
        );

    const gradesBySection = () => {
        const grouped = {};
        sections.forEach(s => { grouped[s.value] = []; });
        getUniqueGrades().forEach(g => {
            if (grouped[g.section]) grouped[g.section].push(g);
        });
        Object.keys(grouped).forEach(s => grouped[s].sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel)));
        return grouped;
    };

    const getSectionInfo = (key) => sections.find(s => s.value === key);
    const getStreamColor = (stream) => streamColors[stream?.toUpperCase()] || streamColors.default;

    const handleGradeClick = (grade) => { setSelectedGrade(grade); setSelectedClass(null); setView('streams'); };
    const handleClassClick = (cls) => {
        setSelectedClass(cls);
        setSelectedClassFilter(cls.classId);
        setView('students');
    };
    const handleBack = () => {
        if (view === 'students') { setView('streams'); setSelectedClass(null); setSelectedClassFilter(''); setEditingStudent(null); }
        else if (view === 'streams') { setView('grades'); setSelectedGrade(null); }
    };

    const handleEdit = (student) => {
        if (editingStudent?.studentId === student.studentId) {
            setEditingStudent(null);
            return;
        }
        setEditingStudent(student);
        setFormData({
            firstName: student.firstName, lastName: student.lastName,
            dateOfBirth: student.dateOfBirth, gender: student.gender,
            admissionNumber: student.admissionNumber
        });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => {
        setEditingStudent(null);
        setFormData({ firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: '' });
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/students/${editingStudent.studentId}`, {
                ...formData, className: editingStudent.className, stream: editingStudent.stream
            });
            showToast('Student updated successfully!', 'success');
            setEditingStudent(null);
            setFormData({ firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: '' });
            fetchStudents();
        } catch (err) {
            showToast('Failed to update student.', 'error');
        }
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/api/students?classId=${classId}`, formData);
            showToast('Student added successfully!', 'success');
            setShowAddForm(false);
            setFormData({ firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: '' });
            setClassId('');
            fetchStudents();
        } catch (err) {
            showToast('Failed to add student. Please check all fields.', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this student?')) {
            try {
                await api.delete(`/api/students/${id}`);
                showToast('Student deleted!', 'success');
                if (editingStudent?.studentId === id) setEditingStudent(null);
                fetchStudents();
            } catch (err) {
                showToast('Failed to delete student', 'error');
            }
        }
    };

    const grouped = gradesBySection();

    return (
        <div style={styles.container}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.header}>
                        <div style={styles.headerLeft}>
                            {view !== 'grades' && (
                                <button onClick={handleBack} style={styles.backBtn}><Icon name="arrow-left" style={{ marginRight: '4px' }} />Back</button>
                            )}
                            <div>
                                <h2 style={styles.title}>
                                    <Icon name="mortarboard-fill" style={{ color: '#1F3864' }} />Students
                                    {selectedGrade && ` › ${selectedGrade.gradeLevel}`}
                                    {selectedClass && ` › ${selectedClass.className}`}
                                </h2>
                                <p style={styles.breadcrumb}>
                                    {view === 'grades' && `${students.length} total students across all classes`}
                                    {view === 'streams' && `${getClassesForGrade(selectedGrade?.gradeLevel).length} class(es) in ${selectedGrade?.gradeLevel}`}
                                    {view === 'students' && `${getStudentsForClass(selectedClass?.className, selectedClass?.classId).length} student(s) in ${selectedClass?.className}`}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => { setShowAddForm(!showAddForm); setEditingStudent(null); }} style={styles.addBtn}>
                            {showAddForm ? <><Icon name="x-lg" />Cancel</> : <><Icon name="plus-circle" />Add Student</>}
                        </button>
                    </div>

                    {error && <p style={styles.error}>{error}</p>}

                    {showAddForm && (
                        <div style={styles.addFormCard}>
                            <h3 style={styles.formTitle}><Icon name="plus-circle" style={{ color: '#1F3864' }} />Add New Student</h3>
                            <StudentFormFields
                                formData={formData} setFormData={setFormData}
                                classId={classId} setClassId={setClassId}
                                sections={sections} classes={classes}
                                onSubmit={handleSubmitAdd}
                                onCancel={() => { setShowAddForm(false); setFormData({ firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: '' }); }}
                                submitLabel="Save Student"
                                submitIcon="save-fill"
                                showClassField={true}
                            />
                        </div>
                    )}

                    {loading ? <Spinner message="Loading students..." /> : (
                        <>
                            {/* ── VIEW 1: Grade Tiles ── */}
                            {view === 'grades' && (
                                <div>
                                    <div style={styles.statsRow}>
                                        {sections.map(section => {
                                            const sectionStudents = students.filter(s => {
                                                const cls = findClassForStudent(s);
                                                return cls?.section === section.value;
                                            });
                                            const sectionClasses = classes.filter(c => c.section === section.value);
                                            return (
                                                <div key={section.value} style={{ ...styles.statCard, borderTop: `4px solid ${section.color}` }}
                                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>
                                                    <div style={{ ...styles.statIcon, backgroundColor: section.light, color: section.color }}>
                                                        {section.label.charAt(0)}
                                                    </div>
                                                    <div style={styles.statInfo}>
                                                        <div style={{ ...styles.statNum, color: section.color }}>{sectionStudents.length}</div>
                                                        <div style={styles.statLabel}>{section.label}</div>
                                                        <div style={styles.statMeta}>{sectionClasses.length} classes</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div style={styles.searchCard}>
                                        <div style={styles.searchInputWrap}>
                                            <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                                            <input style={styles.searchInput}
                                                placeholder="Search by name or admission number..."
                                                value={search} onChange={e => setSearch(e.target.value)} />
                                        </div>
                                        <select style={styles.filterSelect} value={filterGender}
                                            onChange={e => setFilterGender(e.target.value)}>
                                            <option value="">All Genders</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                        <button onClick={() => { setSearch(''); setFilterGender(''); setSelectedClassFilter(''); }}
                                            style={styles.clearBtn}>Clear</button>
                                    </div>

                                    {sections.map(section => {
                                        const sectionGrades = grouped[section.value] || [];
                                        if (sectionGrades.length === 0) return null;
                                        return (
                                            <div key={section.value} style={styles.sectionBlock}>
                                                <div style={{ ...styles.sectionTitle, backgroundColor: section.color }}>
                                                    <div>
                                                        <span style={styles.sectionLabel}>{section.label}</span>
                                                        <span style={styles.sectionMeta}>Target: {section.target}% | {sectionGrades.length} grade(s)</span>
                                                    </div>
                                                    <span style={styles.sectionCount}>
                                                        {students.filter(s => {
                                                            const cls = findClassForStudent(s);
                                                            return cls?.section === section.value;
                                                        }).length} students
                                                    </span>
                                                </div>
                                                <div style={styles.gradeTiles}>
                                                    {sectionGrades.map(grade => {
                                                        const gradeStudents = students.filter(s => {
                                                            const cls = findClassForStudent(s);
                                                            return (cls?.gradeLevel || extractGrade(cls?.className)) === grade.gradeLevel;
                                                        });
                                                        return (
                                                            <div key={grade.gradeLevel}
                                                                style={{ ...styles.gradeTile, borderTop: `4px solid ${section.color}` }}
                                                                onClick={() => handleGradeClick(grade)}
                                                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>
                                                                <div style={{ ...styles.gradeLabel, color: section.color }}>{grade.gradeLevel}</div>
                                                                <div style={styles.gradeStudentCount}>{gradeStudents.length} students</div>
                                                                <div style={styles.genderRow}>
                                                                    <span style={styles.maleCount}><Icon name="gender-male" style={{ marginRight: '3px' }} />{gradeStudents.filter(s => s.gender === 'Male').length}</span>
                                                                    <span style={styles.femaleCount}><Icon name="gender-female" style={{ marginRight: '3px' }} />{gradeStudents.filter(s => s.gender === 'Female').length}</span>
                                                                </div>
                                                                <div style={styles.gradeClasses}>{grade.count} class{grade.count !== 1 ? 'es' : ''}</div>
                                                                <div style={{ ...styles.viewArrow, color: section.color }}>View <i className="bi bi-arrow-right" /></div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {(search || filterGender || selectedClassFilter) && (
                                        <div style={styles.tableCard}>
                                            <div style={styles.tableTopBar}>
                                                <h3 style={styles.tableTitle}><Icon name="search" />Search Results ({filtered.length})</h3>
                                            </div>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={styles.table}>
                                                    <thead>
                                                        <tr style={styles.thead}>
                                                            <th style={styles.th}>#</th>
                                                            <th style={styles.th}>Adm No</th>
                                                            <th style={styles.th}>Name</th>
                                                            <th style={styles.th}>Gender</th>
                                                            <th style={styles.th}>Class</th>
                                                            <th style={styles.th}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filtered.map((s, i) => (
                                                            <tr key={s.studentId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                                <td style={styles.td}>{i + 1}</td>
                                                                <td style={styles.td}><span style={styles.admNo}>{s.admissionNumber}</span></td>
                                                                <td style={styles.td}><strong>{s.firstName} {s.lastName}</strong></td>
                                                                <td style={styles.td}>
                                                                    <span style={{ ...styles.genderBadge, backgroundColor: s.gender === 'Male' ? '#2E75B6' : '#e83e8c' }}>{s.gender}</span>
                                                                </td>
                                                                <td style={styles.td}>{classDisplayName({ className: s.schoolClass?.className || s.className, stream: s.schoolClass?.stream || s.stream })}</td>
                                                                <td style={styles.td}>
                                                                    <button onClick={() => navigate(`/student/${s.studentId}`)} style={styles.viewBtn}><i className="bi bi-person-circle" /></button>
                                                                    <button onClick={() => handleEdit(s)} style={styles.editBtn}><i className="bi bi-pencil-fill" /></button>
                                                                    <button onClick={() => handleDelete(s.studentId)} style={styles.deleteBtn}><i className="bi bi-trash-fill" /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── VIEW 2: Stream Tiles ── */}
                            {view === 'streams' && selectedGrade && (() => {
                                const sectionInfo = getSectionInfo(selectedGrade.section);
                                const gradeClasses = getClassesForGrade(selectedGrade.gradeLevel);
                                return (
                                    <div>
                                        <div style={{ ...styles.sectionTitle, backgroundColor: sectionInfo?.color || '#1F3864', borderRadius: '14px 14px 0 0' }}>
                                            <div>
                                                <span style={styles.sectionLabel}>{selectedGrade.gradeLevel} — {sectionInfo?.label}</span>
                                                <span style={styles.sectionMeta}>{gradeClasses.length} class(es)</span>
                                            </div>
                                            <span style={styles.sectionCount}>
                                                {gradeClasses.reduce((sum, c) => sum + getStudentsForClass(c.className, c.classId).length, 0)} students
                                            </span>
                                        </div>
                                        <div style={styles.streamTiles}>
                                            {gradeClasses.map(cls => {
                                                const clsStudents = getStudentsForClass(cls.className, cls.classId);
                                                const streamColor = getStreamColor(cls.stream);
                                                return (
                                                    <div key={cls.classId}
                                                        style={{ ...styles.streamTile, borderTop: `5px solid ${streamColor}` }}
                                                        onClick={() => handleClassClick(cls)}
                                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}>
                                                        <div style={{ ...styles.streamBadge, backgroundColor: streamColor }}>{cls.stream || 'SINGLE'}</div>
                                                        <div style={styles.streamName}>{classDisplayName(cls)}</div>
                                                        <div style={styles.streamStats}>
                                                            <div style={styles.streamStatItem}>
                                                                <span style={styles.streamStatNum}>{clsStudents.length}</span>
                                                                <span style={styles.streamStatLabel}>Total</span>
                                                            </div>
                                                            <div style={styles.streamStatItem}>
                                                                <span style={{ ...styles.streamStatNum, color: '#2E75B6' }}>{clsStudents.filter(s => s.gender === 'Male').length}</span>
                                                                <span style={styles.streamStatLabel}>Boys</span>
                                                            </div>
                                                            <div style={styles.streamStatItem}>
                                                                <span style={{ ...styles.streamStatNum, color: '#e83e8c' }}>{clsStudents.filter(s => s.gender === 'Female').length}</span>
                                                                <span style={styles.streamStatLabel}>Girls</span>
                                                            </div>
                                                        </div>
                                                        <div style={styles.streamTeacher}>
                                                            <Icon name="person-workspace" style={{ color: '#888' }} />
                                                            {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : 'No Teacher'}
                                                        </div>
                                                        <div style={{ ...styles.viewStudentsBtn, color: streamColor }}><Icon name="people-fill" />View Students <i className="bi bi-arrow-right" /></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ── VIEW 3: Students in Class ── */}
                            {view === 'students' && selectedClass && (() => {
                                const sectionInfo = getSectionInfo(selectedClass.section || extractSection(selectedClass.gradeLevel || extractGrade(selectedClass.className)));
                                const clsStudents = getStudentsForClass(selectedClass.className, selectedClass.classId).filter(s => {
                                    if (search && !`${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) && !s.admissionNumber?.toLowerCase().includes(search.toLowerCase())) return false;
                                    if (filterGender && s.gender !== filterGender) return false;
                                    return true;
                                });
                                return (
                                    <div>
                                        <div style={{ ...styles.classHeader, backgroundColor: sectionInfo?.color || '#1F3864' }}>
                                            <div>
                                                <h3 style={styles.classHeaderTitle}>{selectedClass.className} Students</h3>
                                                <p style={styles.classHeaderMeta}>
                                                    {sectionInfo?.label} | Target: {selectedClass.meanTarget}% | Teacher: {selectedClass.classTeacher ? `${selectedClass.classTeacher.firstName} ${selectedClass.classTeacher.lastName}` : 'Not Assigned'}
                                                </p>
                                            </div>
                                            <div style={styles.classHeaderStats}>
                                                {[['Total', clsStudents.length, 'white'], ['Boys', clsStudents.filter(s => s.gender === 'Male').length, '#BDD7EE'], ['Girls', clsStudents.filter(s => s.gender === 'Female').length, '#FFCCE5']].map(([label, num, color]) => (
                                                    <div key={label} style={styles.classStatBox}>
                                                        <span style={{ ...styles.classStatNum, color }}>{num}</span>
                                                        <span style={styles.classStatLabel}>{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={styles.classSearchBar}>
                                            <input style={styles.searchInput} placeholder="Search students..."
                                                value={search} onChange={e => setSearch(e.target.value)} />
                                            <select style={styles.filterSelect} value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                                                <option value="">All</option>
                                                <option value="Male">Boys</option>
                                                <option value="Female">Girls</option>
                                            </select>
                                            <button onClick={() => { setSearch(''); setFilterGender(''); }} style={styles.clearBtn}>Clear</button>
                                        </div>

                                        {clsStudents.length === 0 ? (
                                            <div style={styles.emptyState}>
                                                <div style={styles.emptyIcon}><i className="bi bi-people" /></div>
                                                <h3>No Students Yet</h3>
                                                <p>Click Add Student to add students to {selectedClass.className}</p>
                                            </div>
                                        ) : (
                                            <div style={styles.studentGrid}>
                                                {clsStudents.map((student, index) => (
                                                    <div key={student.studentId}>
                                                        <div style={{
                                                            ...styles.studentCard,
                                                            outline: editingStudent?.studentId === student.studentId ? '2px solid #2E75B6' : 'none'
                                                        }}
                                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}>
                                                            <div style={styles.studentCardTop}>
                                                                <div style={styles.studentRankBadge}>#{index + 1}</div>
                                                                <div style={{ ...styles.studentAvatar, backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c' }}>
                                                                    {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                                                                </div>
                                                            </div>
                                                            <div style={styles.studentCardBody}>
                                                                <strong style={styles.studentName}>{student.firstName} {student.lastName}</strong>
                                                                <span style={styles.studentAdm}>{student.admissionNumber}</span>
                                                                <span style={{ ...styles.genderBadge, backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c' }}>
                                                                    <i className={`bi bi-gender-${student.gender === 'Male' ? 'male' : 'female'}`} style={{ marginRight: '4px' }} />{student.gender}
                                                                </span>
                                                            </div>
                                                            <div style={styles.studentCardActions}>
                                                                <button onClick={() => navigate(`/student/${student.studentId}`)} style={styles.profileBtn}><i className="bi bi-person-circle" style={{ marginRight: '4px' }} />Profile</button>
                                                                <button
                                                                    onClick={() => handleEdit(student)}
                                                                    style={editingStudent?.studentId === student.studentId ? styles.cancelEditBtnSm : styles.editBtnSm}>
                                                                    <i className={`bi bi-${editingStudent?.studentId === student.studentId ? 'x-lg' : 'pencil-fill'}`} />
                                                                </button>
                                                                <button onClick={() => handleDelete(student.studentId)} style={styles.deleteBtnSm}><i className="bi bi-trash-fill" /></button>
                                                            </div>
                                                        </div>

                                                        {editingStudent?.studentId === student.studentId && (
                                                            <div style={styles.inlineEditCard}>
                                                                <div style={styles.inlineEditHeader}>
                                                                    <h4 style={styles.inlineEditTitle}>
                                                                        <i className="bi bi-pencil-fill" style={{ marginRight: '6px' }} />
                                                                        Editing: {student.firstName} {student.lastName}
                                                                    </h4>
                                                                    <button onClick={handleCancelEdit} style={styles.closeBtn}><i className="bi bi-x-lg" /></button>
                                                                </div>
                                                                <StudentFormFields
                                                                    formData={formData} setFormData={setFormData}
                                                                    classId={classId} setClassId={setClassId}
                                                                    sections={sections} classes={classes}
                                                                    onSubmit={handleSubmitEdit}
                                                                    onCancel={handleCancelEdit}
                                                                    submitLabel="Update Student"
                                                                    submitIcon="check-circle-fill"
                                                                    showClassField={false}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </>
                    )}

                </div>
            </div>
            <Footer />
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    navbar: { backgroundColor: '#1F3864', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
    navTitle: { color: 'white', margin: 0, fontSize: '18px' },
    navRight: { display: 'flex', gap: '10px' },
    navBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: '30px', flex: 1 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    title: { color: '#1F3864', margin: 0, fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center' },
    breadcrumb: { color: '#888', margin: '3px 0 0 0', fontSize: '13px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    addFormCard: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0', fontWeight: 700, display: 'flex', alignItems: 'center' },
    inlineEditCard: { backgroundColor: 'white', borderRadius: '0 0 12px 12px', padding: '16px', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center' },
    closeBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    inlineForm: {},

    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '11px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' },
    btnGroup: { display: 'flex', gap: '8px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '22px' },
    statCard: { backgroundColor: 'white', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    statIcon: { width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', flexShrink: 0 },
    statInfo: { flex: 1 },
    statNum: { fontSize: '26px', fontWeight: 800, display: 'block' },
    statLabel: { fontSize: '12px', color: '#333', fontWeight: 'bold' },
    statMeta: { fontSize: '11px', color: '#999' },
    searchCard: { backgroundColor: 'white', padding: '16px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: '10px', flexWrap: 'wrap' },
    searchInputWrap: { flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px' },
    searchInput: { flex: 1, padding: '10px 0', border: 'none', outline: 'none', fontSize: '14px' },
    filterSelect: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer' },
    sectionBlock: { marginBottom: '25px', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    sectionTitle: { padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    sectionLabel: { color: 'white', fontWeight: 'bold', fontSize: '15px', marginRight: '10px' },
    sectionMeta: { color: 'rgba(255,255,255,0.8)', fontSize: '12px' },
    sectionCount: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
    gradeTiles: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', padding: '16px', backgroundColor: 'white' },
    gradeTile: { backgroundColor: 'white', padding: '16px 10px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    gradeLabel: { fontSize: '22px', fontWeight: 800, marginBottom: '4px' },
    gradeStudentCount: { fontSize: '13px', color: '#333', fontWeight: 'bold', marginBottom: '4px' },
    genderRow: { display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '4px' },
    maleCount: { fontSize: '11px', color: '#2E75B6', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    femaleCount: { fontSize: '11px', color: '#e83e8c', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    gradeClasses: { fontSize: '11px', color: '#999', marginBottom: '6px' },
    viewArrow: { fontSize: '12px', fontWeight: 'bold' },

    streamTiles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', padding: '16px', backgroundColor: 'white', borderRadius: '0 0 14px 14px' },
    streamTile: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0', textAlign: 'center', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    streamBadge: { color: 'white', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' },
    streamName: { fontSize: '20px', fontWeight: 800, color: '#1F3864', marginBottom: '12px' },
    streamStats: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' },
    streamStatItem: { textAlign: 'center' },
    streamStatNum: { fontSize: '20px', fontWeight: 800, color: '#1F3864', display: 'block' },
    streamStatLabel: { fontSize: '11px', color: '#999' },
    streamTeacher: { fontSize: '12px', color: '#666', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    viewStudentsBtn: { fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
    classHeader: { padding: '20px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' },
    classHeaderTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '20px', fontWeight: 800 },
    classHeaderMeta: { color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '13px' },
    classHeaderStats: { display: 'flex', gap: '15px' },
    classStatBox: { textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.15)', padding: '8px 15px', borderRadius: '10px' },
    classStatNum: { color: 'white', fontSize: '24px', fontWeight: 800, display: 'block' },
    classStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: '11px' },
    classSearchBar: { display: 'flex', gap: '10px', padding: '13px 15px', backgroundColor: 'white', marginBottom: '2px', flexWrap: 'wrap' },
    studentGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px', backgroundColor: 'white', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    studentCard: { backgroundColor: '#f8f9fa', borderRadius: '12px', overflow: 'visible', border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    studentCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px 0 12px' },
    studentRankBadge: { fontSize: '11px', color: '#999', fontWeight: 'bold' },
    studentAvatar: { width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '15px' },
    studentCardBody: { padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' },
    studentName: { fontSize: '13px', color: '#1F3864' },
    studentAdm: { fontSize: '11px', color: '#999', fontFamily: 'monospace' },
    genderBadge: { color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', width: 'fit-content' },
    studentCardActions: { display: 'flex', gap: '4px', padding: '8px 12px', borderTop: '1px solid #eee', backgroundColor: 'white', borderRadius: '0 0 12px 12px' },
    profileBtn: { flex: 1, backgroundColor: '#6f42c1', color: 'white', border: 'none', padding: '5px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    editBtnSm: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    cancelEditBtnSm: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    deleteBtnSm: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    tableCard: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: '22px' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '13px 20px' },
    tableTitle: { color: 'white', margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
    thead: { backgroundColor: '#f8f9fa' },
    th: { padding: '11px 15px', textAlign: 'left', fontWeight: 'bold', color: '#1F3864', borderBottom: '2px solid #eee', fontSize: '12px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' },
    viewBtn: { backgroundColor: '#6f42c1', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '0 0 14px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px', color: '#ccc' },
};

export default Students;