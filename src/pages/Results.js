import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

// ── Loading Overlay ───────────────────────────────────────────────────────────
const LoadingOverlay = ({ message = 'Loading...' }) => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,56,100,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '5px solid rgba(255,255,255,0.2)', borderTopColor: '#FFD700', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px' }}>{message}</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>Pipeline Adventist School</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// ── Printable Results Report ──────────────────────────────────────────────────
const PrintableResultsReport = React.forwardRef(({ students, subjects, pivotData, className, examName, academicYear, term }, ref) => {
    const getGradeLabel = (m) => m >= 75 ? 'EE' : m >= 55 ? 'ME' : m >= 40 ? 'AE' : 'BE';
    const getMarkColor = (m) => !m && m !== 0 ? '#999' : m >= 75 ? '#28a745' : m >= 55 ? '#2E75B6' : m >= 40 ? '#ffc107' : '#dc3545';
    const getGradeColor = (g) => g === 'EE' ? '#28a745' : g === 'ME' ? '#2E75B6' : g === 'AE' ? '#ffc107' : '#dc3545';
    const getCode = (name) => {
        const codes = { 'mathematics':'MTH','english':'ENG','kiswahili':'KSW','science':'SCI','social studies':'SST','agriculture & nutrition':'AGR','agriculture':'AGRI','creative arts':'CRE.A','cre':'CRE','integrated science':'ISCI','pre-technical studies':'P.TEC' };
        const lower = name.toLowerCase().trim();
        if (codes[lower]) return codes[lower];
        const words = name.split(/[\s&]+/).filter(Boolean);
        return words.length === 1 ? name.substring(0,4).toUpperCase() : words.map(w=>w.substring(0,3).toUpperCase()).join('.');
    };
    const ranked = [...students].sort((a,b) => {
        const tA = subjects.reduce((s,sub)=>s+(pivotData[a.studentId]?.[sub.id]?.marksObtained||0),0);
        const tB = subjects.reduce((s,sub)=>s+(pivotData[b.studentId]?.[sub.id]?.marksObtained||0),0);
        return tB-tA;
    });
    const getTotal = (sid) => subjects.reduce((s,sub)=>s+(pivotData[sid]?.[sub.id]?.marksObtained||0),0);
    const getAvg = (sid) => { const r=subjects.map(sub=>pivotData[sid]?.[sub.id]).filter(Boolean); return r.length?r.reduce((s,x)=>s+x.marksObtained,0)/r.length:0; };
    const getSubTotal = (subId) => students.reduce((s,st)=>s+(pivotData[st.studentId]?.[subId]?.marksObtained||0),0);
    const getSubMean = (subId) => { const r=students.map(s=>pivotData[s.studentId]?.[subId]).filter(Boolean); return r.length?(r.reduce((s,x)=>s+x.marksObtained,0)/r.length).toFixed(1):'-'; };
    const subMeans = subjects.map(sub=>({id:sub.id,mean:parseFloat(getSubMean(sub.id))||0}));
    const subRanks = {}; [...subMeans].sort((a,b)=>b.mean-a.mean).forEach((s,i)=>{subRanks[s.id]=i+1;});
    return (
        <div ref={ref} style={{ padding:'10px 14px', fontFamily:"'Times New Roman',Times,serif", color:'#000', fontSize:'12px' }}>
            <div style={{ borderBottom:'3px solid #1F3864', paddingBottom:'6px', marginBottom:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                    <img src={logo1} alt="Logo" style={{ width:'60px', height:'60px', objectFit:'contain' }} />
                    <div style={{ textAlign:'center', flex:1, padding:'0 6px' }}>
                        <div style={{ color:'#1F3864', fontSize:'12px', fontWeight:'bold', textTransform:'uppercase' }}>PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL</div>
                        <div style={{ color:'#2E75B6', fontStyle:'italic', fontSize:'11px', margin:'2px 0' }}>Abreast with the Best in Holistic Education</div>
                        <div style={{ fontSize:'10px', color:'#666' }}>P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996</div>
                    </div>
                    <img src={logo2} alt="Logo" style={{ width:'60px', height:'60px', objectFit:'contain' }} />
                </div>
                <div style={{ backgroundColor:'#1F3864', padding:'4px 10px', textAlign:'center' }}>
                    <div style={{ color:'white', fontWeight:'bold', fontSize:'12px' }}>CLASS RESULTS REPORT</div>
                    <div style={{ color:'#BDD7EE', fontSize:'11px' }}>{className} | {examName} | Term {term} {academicYear}</div>
                </div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                    <tr style={{ backgroundColor:'#1F3864' }}>
                        <th style={{ color:'white', padding:'3px 4px', textAlign:'center', width:'25px', fontSize:'11px' }}>RNK</th>
                        <th style={{ color:'white', padding:'3px 4px', textAlign:'left', width:'70px', fontSize:'11px' }}>ADM NO</th>
                        <th style={{ color:'white', padding:'3px 4px', textAlign:'left', width:'130px', fontSize:'11px' }}>STUDENT NAME</th>
                        {subjects.map(sub=>(
                            <th key={sub.id} style={{ color:'white', padding:'1px', textAlign:'center', width:'35px', verticalAlign:'bottom' }}>
                                <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', whiteSpace:'nowrap', fontSize:'10px', minHeight:'50px', display:'flex', alignItems:'center', justifyContent:'center' }}>{getCode(sub.name)}</div>
                            </th>
                        ))}
                        <th style={{ color:'#FFD700', padding:'3px 4px', textAlign:'center', width:'35px', fontSize:'11px', fontWeight:'bold' }}>TOT</th>
                        <th style={{ color:'#FFD700', padding:'3px 4px', textAlign:'center', width:'40px', fontSize:'11px', fontWeight:'bold' }}>AVG%</th>
                        <th style={{ color:'#FFD700', padding:'3px 4px', textAlign:'center', width:'30px', fontSize:'11px', fontWeight:'bold' }}>GRD</th>
                    </tr>
                </thead>
                <tbody>
                    {ranked.map((st,i)=>{
                        const total=getTotal(st.studentId); const avg=getAvg(st.studentId); const grade=getGradeLabel(avg);
                        return (
                            <tr key={st.studentId} style={{ backgroundColor:i%2===0?'#f8f9fa':'white' }}>
                                <td style={{ padding:'2px 4px', borderBottom:'1px solid #ddd', textAlign:'center', fontWeight:'bold', fontSize:'12px' }}>{i+1}</td>
                                <td style={{ padding:'2px 4px', borderBottom:'1px solid #ddd', fontSize:'12px' }}>{st.admissionNumber}</td>
                                <td style={{ padding:'2px 4px', borderBottom:'1px solid #ddd', fontSize:'12px', whiteSpace:'nowrap' }}><strong>{st.firstName} {st.lastName}</strong></td>
                                {subjects.map(sub=>{
                                    const r=pivotData[st.studentId]?.[sub.id];
                                    return <td key={sub.id} style={{ padding:'2px 2px', borderBottom:'1px solid #ddd', textAlign:'center', fontSize:'12px' }}>{r?r.marksObtained:'—'}</td>;
                                })}
                                <td style={{ padding:'2px 4px', borderBottom:'1px solid #ddd', textAlign:'center', backgroundColor:'#f0f4ff', fontWeight:'bold', fontSize:'12px' }}>{total.toFixed(0)}</td>
                                <td style={{ padding:'2px 4px', borderBottom:'1px solid #ddd', textAlign:'center', backgroundColor:'#f0f4ff', fontWeight:'bold', fontSize:'12px', color:getMarkColor(avg) }}>{avg.toFixed(1)}%</td>
                                <td style={{ padding:'2px 4px', borderBottom:'1px solid #ddd', textAlign:'center', backgroundColor:'#f0f4ff', fontWeight:'bold', fontSize:'12px' }}>{grade}</td>
                            </tr>
                        );
                    })}
                    <tr style={{ backgroundColor:'#e8f4f8', borderTop:'2px solid #2E75B6' }}>
                        <td colSpan="3" style={{ padding:'2px 4px', fontWeight:'bold', fontSize:'10px', borderBottom:'1px solid #ddd' }}>SUBJECT TOTAL</td>
                        {subjects.map(sub=><td key={sub.id} style={{ padding:'2px', textAlign:'center', fontWeight:'bold', borderBottom:'1px solid #ddd', fontSize:'11px' }}>{getSubTotal(sub.id)}</td>)}
                        <td colSpan="3" style={{ borderBottom:'1px solid #ddd' }} />
                    </tr>
                    <tr style={{ backgroundColor:'#e3f2fd' }}>
                        <td colSpan="3" style={{ padding:'2px 4px', fontWeight:'bold', fontSize:'10px', borderBottom:'1px solid #ddd' }}>SUBJECT MEAN</td>
                        {subjects.map(sub=><td key={sub.id} style={{ padding:'2px', textAlign:'center', fontWeight:'bold', borderBottom:'1px solid #ddd', fontSize:'11px' }}>{getSubMean(sub.id)}</td>)}
                        <td colSpan="3" style={{ borderBottom:'1px solid #ddd' }} />
                    </tr>
                    <tr style={{ backgroundColor:'#f3e5f5', borderBottom:'2px solid #6f42c1' }}>
                        <td colSpan="3" style={{ padding:'2px 4px', fontWeight:'bold', fontSize:'10px', color:'#6f42c1', borderBottom:'1px solid #ddd' }}>SUBJECT RANK</td>
                        {subjects.map(sub=><td key={sub.id} style={{ padding:'2px', textAlign:'center', fontWeight:'bold', color:'#6f42c1', borderBottom:'1px solid #ddd', fontSize:'11px' }}>#{subRanks[sub.id]}</td>)}
                        <td colSpan="3" style={{ borderBottom:'1px solid #ddd' }} />
                    </tr>
                </tbody>
            </table>
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', padding:'5px 0', borderTop:'1px solid #ddd', marginTop:'5px', fontSize:'11px' }}>
                <span><strong>Total Students:</strong> {students.length}</span>
                <span><strong>Class Average:</strong> {students.length>0?(students.reduce((s,st)=>s+getAvg(st.studentId),0)/students.length).toFixed(2):0}%</span>
                <span><strong>Top Student:</strong> {ranked[0]?`${ranked[0].firstName} ${ranked[0].lastName} (${getAvg(ranked[0].studentId).toFixed(1)}%)`:'-'}</span>
                <span><strong>Date Printed:</strong> {new Date().toLocaleDateString()}</span>
            </div>
            <div style={{ display:'flex', gap:'20px', marginTop:'10px', borderTop:'2px solid #1F3864', paddingTop:'6px' }}>
                <div style={{ flex:1 }}><p style={{ fontSize:'11px', margin:'0 0 5px 0' }}>Class Teacher: _________________________</p><p style={{ fontSize:'11px', margin:0 }}>Signature: _____________ Date: __________</p></div>
                <div style={{ flex:1 }}><p style={{ fontSize:'11px', margin:'0 0 5px 0' }}>Principal: _________________________</p><p style={{ fontSize:'11px', margin:0 }}>Signature: _____________ Date: __________</p></div>
            </div>
            <p style={{ textAlign:'center', fontSize:'10px', color:'#999', marginTop:'6px' }}>Pipeline Adventist School — Official Class Results Report — {new Date().toLocaleDateString()}</p>
        </div>
    );
});

// ── Main Component ────────────────────────────────────────────────────────────
function Results() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [searched, setSearched] = useState(false);
    const [filterExam, setFilterExam] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [search, setSearch] = useState('');
    const [step, setStep] = useState(1);
    const [populatedClasses, setPopulatedClasses] = useState([]);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [allExamResults, setAllExamResults] = useState([]);

    // Pivot data
    const [pivotStudents, setPivotStudents] = useState([]);
    const [pivotSubjects, setPivotSubjects] = useState([]);
    const [pivotData, setPivotData] = useState({});

    // Inline editing
    const [editingCell, setEditingCell] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [pendingChanges, setPendingChanges] = useState({});
    const [saving, setSaving] = useState(false);
    const editInputRef = useRef(null);

    useEffect(() => { fetchExams(); fetchClasses(); }, []);

    useEffect(() => {
        if (editingCell && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingCell]);

    const fetchExams = async () => {
        try { const r = await api.get('/api/exams'); setExams(r.data); } catch(e) {}
    };

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data); } catch(e) {}
    };

    const handleSelectExam = async (examId) => {
        setFilterExam(examId);
        setFilterClass('');
        setSearched(false);
        setResults([]);
        setPivotStudents([]); setPivotSubjects([]); setPivotData({});
        setPopulatedClasses([]);
        setPendingChanges({});
        if (!examId) { setStep(1); return; }
        setStep(2);
        setLoadingClasses(true);
        try {
            const response = await api.get('/api/results');
            const data = response.data.filter(r => String(r.exam?.examId) === String(examId));
            setAllExamResults(data);
            const classMap = {};
            data.forEach(r => {
                const cls = r.student?.className;
                const classId = r.student?.schoolClass?.classId;
                if (cls) {
                    const key = classId || cls;
                    if (!classMap[key]) classMap[key] = { className: cls, classId, studentIds: new Set(), subjectIds: new Set(), section: r.student?.schoolClass?.section || '' };
                    if (r.student?.studentId) classMap[key].studentIds.add(r.student.studentId);
                    if (r.subject?.subjectId) classMap[key].subjectIds.add(r.subject.subjectId);
                }
            });
            const populated = Object.values(classMap).map(c => ({ ...c, studentCount: c.studentIds.size, subjectCount: c.subjectIds.size })).sort((a,b) => a.className.localeCompare(b.className));
            setPopulatedClasses(populated);
        } catch (e) { setError('Failed to load classes'); }
        setLoadingClasses(false);
    };

    const handleSelectClass = (cls) => {
        setFilterClass(cls.className);
        setPendingChanges({});
        setStep(3);
        handleSearchWithClass(cls.className, filterExam);
    };

    const handleSearchWithClass = (className, examId) => {
        if (!examId || !className) return;
        setLoading(true); setError(''); setSearched(true);
        try {
            const data = allExamResults.filter(r => r.student?.className === className);
            setResults(data);
            buildPivotTable(data);
        } catch (err) { setError('Failed to load results'); }
        setLoading(false);
    };

    const buildPivotTable = (data) => {
        const subjectMap = {};
        data.forEach(r => { if (r.subject) subjectMap[r.subject.subjectId] = r.subject.subjectName; });
        const uniqueSubjects = Object.entries(subjectMap).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
        const studentMap = {};
        data.forEach(r => { if (r.student) studentMap[r.student.studentId] = r.student; });
        const uniqueStudents = Object.values(studentMap).sort((a,b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`));
        const pivot = {};
        data.forEach(r => {
            const sid = r.student?.studentId; const subId = r.subject?.subjectId;
            if (sid && subId) { if (!pivot[sid]) pivot[sid] = {}; pivot[sid][subId] = r; }
        });
        setPivotSubjects(uniqueSubjects); setPivotStudents(uniqueStudents); setPivotData(pivot);
    };

    // ── Inline editing ────────────────────────────────────────────────────────
    const startEdit = (studentId, subjectId, currentValue) => {
        setEditingCell({ studentId, subjectId });
        setEditingValue(currentValue !== undefined && currentValue !== null ? String(currentValue) : '');
    };

    const commitEdit = (studentId, subjectId) => {
        const key = `${studentId}_${subjectId}`;
        const result = pivotData[studentId]?.[subjectId];
        const newVal = editingValue.trim();
        if (newVal === '' || newVal === String(result?.marksObtained)) { setEditingCell(null); return; }
        const parsed = parseFloat(newVal);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
            setError('Marks must be between 0 and 100'); setTimeout(() => setError(''), 3000); setEditingCell(null); return;
        }
        setPendingChanges(prev => ({ ...prev, [key]: { marks: parsed, resultId: result?.resultId, studentId, subjectId, examId: filterExam } }));
        setPivotData(prev => ({ ...prev, [studentId]: { ...prev[studentId], [subjectId]: { ...(prev[studentId]?.[subjectId] || {}), marksObtained: parsed } } }));
        setEditingCell(null);
    };

    const cancelEdit = () => setEditingCell(null);

    const handleSaveChanges = async () => {
        const changes = Object.values(pendingChanges);
        if (!changes.length) return;
        setSaving(true); setError('');
        try {
            const r = await api.post('/api/results/bulk-save', {
                examId: parseInt(filterExam),
                results: changes.map(c => ({ studentId: c.studentId, subjectId: c.subjectId, marksObtained: c.marks, maxMarks: 100, resultId: c.resultId || null }))
            });
            setSuccessMsg(`✅ ${r.data.updated || 0} updated, ${r.data.saved || 0} new saved!`);
            setPendingChanges({});
            setTimeout(() => setSuccessMsg(''), 3000);
            handleSearchWithClass(filterClass, filterExam);
        } catch (e) { setError('Failed to save changes'); }
        setSaving(false);
    };

    const handleDiscardChanges = () => { setPendingChanges({}); handleSearchWithClass(filterClass, filterExam); };

    const clearFilters = () => {
        setFilterExam(''); setFilterClass(''); setSearch(''); setSearched(false);
        setResults([]); setPivotStudents([]); setPivotSubjects([]); setPivotData({});
        setAllExamResults([]); setPopulatedClasses([]); setPendingChanges([]);
        setStep(1); setError(''); setSuccessMsg('');
    };

    const getGradeLabel = (marks) => marks >= 75 ? 'EE' : marks >= 55 ? 'ME' : marks >= 40 ? 'AE' : 'BE';
    const getGradeColor = (grade) => grade === 'EE' ? '#28a745' : grade === 'ME' ? '#2E75B6' : grade === 'AE' ? '#ffc107' : '#dc3545';
    const getMarkColor = (marks) => !marks && marks !== 0 ? '#999' : marks >= 75 ? '#28a745' : marks >= 55 ? '#2E75B6' : marks >= 40 ? '#ffc107' : '#dc3545';

    const getSubjectStats = (subjectId) => {
        const r = pivotStudents.map(s => pivotData[s.studentId]?.[subjectId]).filter(x => x && x.marksObtained != null);
        if (!r.length) return { total: '-', mean: '-', count: 0 };
        const total = r.reduce((s,x) => s + x.marksObtained, 0);
        return { total: total.toFixed(0), mean: (total/r.length).toFixed(1), count: r.length };
    };

    const getSubjectRanks = () => {
        const means = pivotSubjects.map(sub => ({ id: sub.id, mean: parseFloat(getSubjectStats(sub.id).mean) || 0 }));
        const ranks = {};
        [...means].sort((a,b) => b.mean - a.mean).forEach((s,i) => { ranks[s.id] = i+1; });
        return ranks;
    };

    const getStudentStats = (studentId) => {
        const r = pivotSubjects.map(sub => pivotData[studentId]?.[sub.id]).filter(Boolean);
        if (!r.length) return { total: 0, average: 0, grade: '-' };
        const total = r.reduce((s,x) => s + x.marksObtained, 0);
        const average = total / r.length;
        let grade = 'BE';
        if (average >= 75) grade = 'EE'; else if (average >= 55) grade = 'ME'; else if (average >= 40) grade = 'AE';
        return { total: total.toFixed(1), average: average.toFixed(1), grade };
    };

    const selectedExamName = exams.find(e => String(e.examId) === String(filterExam))?.examName || '';


    const pendingCount = Object.keys(pendingChanges).length;

    const rankedStudents = [...pivotStudents].sort((a,b) => {
        const tA = parseFloat(getStudentStats(a.studentId).total) || 0;
        const tB = parseFloat(getStudentStats(b.studentId).total) || 0;
        if (tB !== tA) return tB - tA;
        return parseFloat(getStudentStats(b.studentId).average) - parseFloat(getStudentStats(a.studentId).average);
    });

    return (
        <div style={styles.container}>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
            {loadingClasses && <LoadingOverlay message="Loading class results..." />}
            {loading && <LoadingOverlay message="Loading results table..." />}

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
                <h2 style={styles.title}>📊 Results</h2>
                <p style={styles.subtitle}>Select exam and class to view results</p>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Pending changes banner */}
                {pendingCount > 0 && (
                    <div style={styles.pendingBanner}>
                        <span style={{ color:'#856404', fontWeight:'bold' }}>✏️ {pendingCount} unsaved change{pendingCount > 1 ? 's' : ''}</span>
                        <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={handleSaveChanges} disabled={saving} style={{ backgroundColor:'#28a745', color:'white', border:'none', padding:'7px 18px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' }}>
                                {saving ? '⏳ Saving...' : '💾 Save Changes'}
                            </button>
                            <button onClick={handleDiscardChanges} style={{ backgroundColor:'#dc3545', color:'white', border:'none', padding:'7px 12px', borderRadius:'5px', cursor:'pointer' }}>✕ Discard</button>
                        </div>
                    </div>
                )}

                {/* ── STEP 1: Exam Tiles ── */}
                {step === 1 && (
                    <div>
                        <h3 style={styles.stepTitle}>📝 Select an Exam</h3>
                        <div style={styles.examGrid}>
                            {exams.map(exam => (
                                <div key={exam.examId} onClick={() => handleSelectExam(exam.examId)}
                                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 6px 16px rgba(0,0,0,0.15)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; }}
                                    style={styles.examTile}>
                                    <div style={styles.examTileIcon}>📝</div>
                                    <div style={styles.examTileName}>{exam.examName}</div>
                                    <div style={styles.examTileMeta}>Term {exam.term} · {exam.academicYear}</div>
                                    <div style={styles.examTileAction}>Click to view classes →</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Class Tiles ── */}
                {step === 2 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <button onClick={() => { setStep(1); setPopulatedClasses([]); }} style={styles.backBtn}>← Back</button>
                            <div>
                                <h3 style={styles.stepTitle}>🏫 Select a Class</h3>
                                <p style={styles.stepSub}>{exams.find(e => String(e.examId) === String(filterExam))?.examName} — {populatedClasses.length} class{populatedClasses.length !== 1 ? 'es' : ''} with results</p>
                            </div>
                        </div>
                        {loadingClasses ? (
                            <div style={styles.classGrid}>
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} style={styles.skeletonTile}>
                                        <div style={styles.skeletonTitle} />
                                        <div style={styles.skeletonStats} />
                                        <div style={styles.skeletonAction} />
                                    </div>
                                ))}
                            </div>
                        ) : populatedClasses.length === 0 ? (
                            <div style={styles.emptyCard}><p>📭 No results found for this exam yet.</p><p style={{ color:'#666', fontSize:'13px' }}>Use Mark Entry to add marks first.</p></div>
                        ) : (
                            <div style={styles.classGrid}>
                                {populatedClasses.map((cls, i) => {
                                    const color = { 'PRE_SCHOOL':'#6f42c1','LOWER_PRIMARY':'#2E75B6','UPPER_PRIMARY':'#fd7e14','JUNIOR_SCHOOL':'#20c997' }[cls.section] || '#1F3864';
                                    return (
                                        <div key={i} onClick={() => handleSelectClass(cls)}
                                            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 6px 16px rgba(0,0,0,0.15)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 6px rgba(0,0,0,0.08)'; }}
                                            style={{ ...styles.classTile, borderTop:`4px solid ${color}` }}>
                                            <div style={{ ...styles.classTileHeader, color }}>{cls.className}</div>
                                            <div style={styles.classTileStats}>
                                                <div style={styles.classStat}><span style={styles.classStatNum}>{cls.studentCount}</span><span style={styles.classStatLbl}>Students</span></div>
                                                <div style={styles.classDivider} />
                                                <div style={styles.classStat}><span style={styles.classStatNum}>{cls.subjectCount}</span><span style={styles.classStatLbl}>Subjects</span></div>
                                            </div>
                                            <div style={{ ...styles.classTileAction, backgroundColor:color }}>View Results →</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 3: Results Table ── */}
                {step === 3 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <button onClick={() => { setStep(2); setSearched(false); setPendingChanges({}); }} style={styles.backBtn}>← Back to Classes</button>
                            <h3 style={styles.stepTitle}>📊 {filterClass} — {selectedExamName}</h3>
                            <input style={styles.searchInput} placeholder="🔍 Search student..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {searched && !loading && (
                            pivotStudents.length === 0 ? (
                                <div style={styles.emptyCard}>
                                    <p>📭 No results found for <strong>{selectedExamName}</strong> — <strong>{filterClass}</strong></p>
                                    <p style={{ color:'#666', fontSize:'13px' }}>Use Mark Entry to add marks for this class and exam.</p>
                                </div>
                            ) : (
                                <div style={styles.tableCard}>
                                    <div style={styles.tableTopBar}>
                                        <div>
                                            <h3 style={styles.tableTitle}>{filterClass} — {selectedExamName}</h3>
                                            <p style={styles.tableSubtitle}>{pivotStudents.length} students | {pivotSubjects.length} subjects · 💡 Click any mark to edit</p>
                                        </div>
                                        <button onClick={() => {
                            const examObj = exams.find(e => String(e.examId) === String(filterExam));
                            const getCode = (name) => {
                                const codes = {'mathematics':'MTH','english':'ENG','kiswahili':'KSW','science':'SCI','social studies':'SST','agriculture & nutrition':'AGR','creative arts':'CRE.A','cre':'CRE','integrated science':'ISCI'};
                                const lower = name.toLowerCase().trim();
                                if (codes[lower]) return codes[lower];
                                const words = name.split(/[\s&]+/).filter(Boolean);
                                return words.length===1?name.substring(0,4).toUpperCase():words.map(w=>w.substring(0,3).toUpperCase()).join('.');
                            };
                            const ranked = [...pivotStudents].sort((a,b)=>{
                                const tA=pivotSubjects.reduce((s,sub)=>s+(pivotData[a.studentId]?.[sub.id]?.marksObtained||0),0);
                                const tB=pivotSubjects.reduce((s,sub)=>s+(pivotData[b.studentId]?.[sub.id]?.marksObtained||0),0);
                                return tB-tA;
                            });
                            const subMeans=pivotSubjects.map(sub=>{const r=pivotStudents.map(s=>pivotData[s.studentId]?.[sub.id]).filter(Boolean);return{id:sub.id,mean:r.length?r.reduce((s,x)=>s+x.marksObtained,0)/r.length:0};});
                            const subRanks={};[...subMeans].sort((a,b)=>b.mean-a.mean).forEach((s,i)=>{subRanks[s.id]=i+1;});
                            const hdrs=pivotSubjects.map(sub=>`<th style="color:white;padding:2px;text-align:center;width:35px;vertical-align:bottom;"><div style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:10px;min-height:48px;display:flex;align-items:center;justify-content:center;">${getCode(sub.name)}</div></th>`).join('');
                            const rows=ranked.map((st,i)=>{
                                const total=pivotSubjects.reduce((s,sub)=>s+(pivotData[st.studentId]?.[sub.id]?.marksObtained||0),0);
                                const res=pivotSubjects.map(sub=>pivotData[st.studentId]?.[sub.id]).filter(Boolean);
                                const avg=res.length?total/res.length:0;
                                const grade=avg>=75?'EE':avg>=55?'ME':avg>=40?'AE':'BE';
                                const cells=pivotSubjects.map(sub=>{const r=pivotData[st.studentId]?.[sub.id];return`<td style="padding:2px 3px;border:1px solid #ddd;text-align:center;">${r?r.marksObtained:'—'}</td>`;}).join('');
                                return`<tr style="background:${i%2===0?'#f8f9fa':'white'}"><td style="padding:2px 4px;border:1px solid #ddd;text-align:center;font-weight:bold;">${i+1}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:11px;">${st.admissionNumber}</td><td style="padding:2px 4px;border:1px solid #ddd;font-size:11px;white-space:nowrap;"><strong>${st.firstName} ${st.lastName}</strong></td>${cells}<td style="padding:2px 4px;border:1px solid #ddd;text-align:center;font-weight:bold;background:#f0f4ff;">${total.toFixed(0)}</td><td style="padding:2px 4px;border:1px solid #ddd;text-align:center;font-weight:bold;background:#f0f4ff;">${avg.toFixed(1)}%</td><td style="padding:2px 4px;border:1px solid #ddd;text-align:center;font-weight:bold;background:#f0f4ff;">${grade}</td></tr>`;
                            }).join('');
                            const totRow=pivotSubjects.map(sub=>{const t=pivotStudents.reduce((s,st)=>s+(pivotData[st.studentId]?.[sub.id]?.marksObtained||0),0);return`<td style="padding:2px 3px;border:1px solid #ddd;text-align:center;font-weight:bold;">${t}</td>`;}).join('');
                            const meanRow=pivotSubjects.map(sub=>{const r=pivotStudents.map(s=>pivotData[s.studentId]?.[sub.id]).filter(Boolean);const m=r.length?(r.reduce((s,x)=>s+x.marksObtained,0)/r.length).toFixed(1):'-';return`<td style="padding:2px 3px;border:1px solid #ddd;text-align:center;font-weight:bold;">${m}</td>`;}).join('');
                            const rankRow=pivotSubjects.map(sub=>`<td style="padding:2px 3px;border:1px solid #ddd;text-align:center;font-weight:bold;color:#6f42c1;">#${subRanks[sub.id]}</td>`).join('');
                            const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filterClass} Results</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Times New Roman',Times,serif;font-size:12px;color:#000;padding:10px;}@media print{@page{size:A4 landscape;margin:8mm;}.no-print{display:none!important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="no-print" style="background:#1F3864;color:white;padding:10px;margin-bottom:10px;border-radius:5px;display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:bold;">${filterClass} — ${examObj?.examName||''}</span><button onclick="window.print()" style="background:#FFD700;color:#1F3864;border:none;padding:8px 20px;border-radius:5px;font-weight:bold;cursor:pointer;font-size:14px;">🖨️ Print / Save PDF</button></div><div style="text-align:center;border-bottom:3px solid #1F3864;padding-bottom:8px;margin-bottom:8px;"><div style="color:#1F3864;font-size:13px;font-weight:bold;text-transform:uppercase;">PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL</div><div style="color:#2E75B6;font-style:italic;font-size:11px;margin:2px 0;">Abreast with the Best in Holistic Education</div><div style="font-size:10px;color:#666;">P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996</div><div style="background:#1F3864;padding:4px 10px;text-align:center;margin-top:5px;"><div style="color:white;font-weight:bold;">CLASS RESULTS REPORT</div><div style="color:#BDD7EE;font-size:11px;">${filterClass} | ${examObj?.examName||''} | Term ${examObj?.term||''} ${examObj?.academicYear||''}</div></div></div><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#1F3864;"><th style="color:white;padding:3px 4px;text-align:center;width:25px;">RNK</th><th style="color:white;padding:3px 4px;text-align:left;width:70px;">ADM NO</th><th style="color:white;padding:3px 4px;text-align:left;width:130px;">STUDENT NAME</th>${hdrs}<th style="color:#FFD700;padding:3px 4px;text-align:center;width:35px;">TOT</th><th style="color:#FFD700;padding:3px 4px;text-align:center;width:40px;">AVG%</th><th style="color:#FFD700;padding:3px 4px;text-align:center;width:30px;">GRD</th></tr></thead><tbody>${rows}<tr style="background:#e8f4f8;border-top:2px solid #2E75B6;"><td colspan="3" style="padding:2px 4px;font-weight:bold;border:1px solid #ddd;">SUBJECT TOTAL</td>${totRow}<td colspan="3" style="border:1px solid #ddd;"></td></tr><tr style="background:#e3f2fd;"><td colspan="3" style="padding:2px 4px;font-weight:bold;border:1px solid #ddd;">SUBJECT MEAN</td>${meanRow}<td colspan="3" style="border:1px solid #ddd;"></td></tr><tr style="background:#f3e5f5;"><td colspan="3" style="padding:2px 4px;font-weight:bold;color:#6f42c1;border:1px solid #ddd;">SUBJECT RANK</td>${rankRow}<td colspan="3" style="border:1px solid #ddd;"></td></tr></tbody></table><div style="display:flex;gap:20px;padding:6px 0;border-top:1px solid #ddd;margin-top:6px;font-size:11px;"><span><strong>Total Students:</strong> ${ranked.length}</span><span><strong>Date:</strong> ${new Date().toLocaleDateString()}</span></div><div style="display:flex;gap:30px;margin-top:10px;border-top:2px solid #1F3864;padding-top:8px;"><div style="flex:1;"><p style="font-size:11px;margin-bottom:5px;">Class Teacher: _________________________</p><p style="font-size:11px;">Signature: _____________ Date: __________</p></div><div style="flex:1;"><p style="font-size:11px;margin-bottom:5px;">Principal: _________________________</p><p style="font-size:11px;">Signature: _____________ Date: __________</p></div></div></body></html>`;
                            const win=window.open('','_blank');
                            if(win){win.document.write(html);win.document.close();}
                            else alert('Please allow popups to print results.');
                        }} style={styles.printBtn}>🖨️ Print Results</button>
                                        <div style={styles.tableBadges}>
                                            <span style={styles.badge}>👥 {pivotStudents.length}</span>
                                            <span style={styles.badge}>📚 {pivotSubjects.length}</span>
                                            {pendingCount > 0 && <span style={{ ...styles.badge, backgroundColor:'#fd7e14' }}>✏️ {pendingCount} pending</span>}
                                        </div>
                                    </div>

                                    <div style={styles.tableWrapper}>
                                        <table style={styles.table}>
                                            <thead>
                                                <tr style={styles.tableHeader}>
                                                    <th style={{...styles.th, ...styles.stickyCol}}>#</th>
                                                    <th style={{...styles.th, ...styles.stickyCol2}}>Adm No</th>
                                                    <th style={{...styles.th, ...styles.stickyCol3}}>Student Name</th>
                                                    {pivotSubjects.map(sub => <th key={sub.id} style={{...styles.th, ...styles.subjectTh}}>{sub.name}</th>)}
                                                    <th style={{...styles.th, ...styles.totalTh}}>Total</th>
                                                    <th style={{...styles.th, ...styles.totalTh}}>Avg %</th>
                                                    <th style={{...styles.th, ...styles.totalTh}}>Grade</th>
                                                    <th style={{...styles.th, ...styles.totalTh}}>Rank</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rankedStudents.map((student, index) => {
                                                    const stats = getStudentStats(student.studentId);
                                                    return (
                                                        <tr key={student.studentId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                            <td style={{...styles.td, ...styles.stickyCol, textAlign:'center'}}>{index+1}</td>
                                                            <td style={{...styles.td, ...styles.stickyCol2}}><span style={styles.admNo}>{student.admissionNumber}</span></td>
                                                            <td style={{...styles.td, ...styles.stickyCol3}}><strong>{student.firstName} {student.lastName}</strong></td>
                                                            {pivotSubjects.map(sub => {
                                                                const result = pivotData[student.studentId]?.[sub.id];
                                                                const isEditing = editingCell?.studentId === student.studentId && editingCell?.subjectId === sub.id;
                                                                const isPending = pendingChanges[`${student.studentId}_${sub.id}`];
                                                                return (
                                                                    <td key={sub.id} style={{...styles.td, textAlign:'center', padding:'2px 4px'}}>
                                                                        {isEditing ? (
                                                                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
                                                                                <input ref={editInputRef} type="number" min="0" max="100"
                                                                                    value={editingValue} onChange={e => setEditingValue(e.target.value)}
                                                                                    onKeyDown={e => { if (e.key==='Enter'||e.key==='Tab'){e.preventDefault();commitEdit(student.studentId,sub.id);} if(e.key==='Escape')cancelEdit(); }}
                                                                                    onBlur={() => commitEdit(student.studentId, sub.id)}
                                                                                    style={{ width:'55px', padding:'4px', border:'2px solid #2E75B6', borderRadius:'4px', fontSize:'16px', textAlign:'center', outline:'none', backgroundColor:'#e3f2fd' }} />
                                                                                <div style={{ display:'flex', gap:'3px' }}>
                                                                                    <button onMouseDown={() => commitEdit(student.studentId, sub.id)} style={{ backgroundColor:'#28a745', color:'white', border:'none', borderRadius:'3px', padding:'2px 6px', cursor:'pointer', fontSize:'11px' }}>✓</button>
                                                                                    <button onMouseDown={cancelEdit} style={{ backgroundColor:'#dc3545', color:'white', border:'none', borderRadius:'3px', padding:'2px 6px', cursor:'pointer', fontSize:'11px' }}>✕</button>
                                                                                </div>
                                                                            </div>
                                                                        ) : result ? (
                                                                            <div onClick={() => startEdit(student.studentId, sub.id, result.marksObtained)} title="Click to edit"
                                                                                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', cursor:'pointer', padding:'4px', borderRadius:'4px', minHeight:'44px', justifyContent:'center', outline: isPending ? '2px solid #fd7e14' : 'none' }}>
                                                                                <span style={{ fontSize:'15px', fontWeight:'bold', color:getMarkColor(result.marksObtained) }}>{result.marksObtained}</span>
                                                                                <span style={{ color:'white', padding:'1px 5px', borderRadius:'2px', fontSize:'10px', fontWeight:'bold', backgroundColor:getGradeColor(getGradeLabel(result.marksObtained)) }}>{getGradeLabel(result.marksObtained)}</span>
                                                                                {isPending && <span style={{ fontSize:'8px', color:'#fd7e14' }}>●</span>}
                                                                            </div>
                                                                        ) : (
                                                                            <span onClick={() => startEdit(student.studentId, sub.id, null)} title="Click to add mark"
                                                                                style={{ color:'#ccc', fontSize:'20px', cursor:'pointer', display:'block', lineHeight:'44px' }}>+</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td style={{...styles.td, ...styles.totalCell}}><strong>{stats.total}</strong></td>
                                                            <td style={{...styles.td, ...styles.totalCell}}><span style={{ color:getMarkColor(parseFloat(stats.average)), fontWeight:'bold' }}>{stats.average}%</span></td>
                                                            <td style={{...styles.td, ...styles.totalCell, textAlign:'center'}}><span style={{...styles.gradeBadge, backgroundColor:getGradeColor(stats.grade)}}>{stats.grade}</span></td>
                                                            <td style={{...styles.td, ...styles.totalCell, textAlign:'center'}}><span style={styles.rankBadge}>{index+1}</span></td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Summary rows */}
                                                <tr style={{ backgroundColor:'#e8f4f8', borderTop:'2px solid #2E75B6' }}>
                                                    <td colSpan="3" style={{...styles.td, fontWeight:'bold', color:'#1F3864', fontSize:'12px'}}>📊 Total Marks</td>
                                                    {pivotSubjects.map(sub => { const s=getSubjectStats(sub.id); return <td key={sub.id} style={{...styles.td, textAlign:'center'}}><strong style={{color:'#1F3864',fontSize:'12px'}}>{s.total}</strong></td>; })}
                                                    <td colSpan="4" style={styles.td} />
                                                </tr>
                                                <tr style={{ backgroundColor:'#e3f2fd' }}>
                                                    <td colSpan="3" style={{...styles.td, fontWeight:'bold', color:'#2E75B6', fontSize:'12px'}}>📈 Mean (excl. blanks)</td>
                                                    {pivotSubjects.map(sub => { const s=getSubjectStats(sub.id); const mean=parseFloat(s.mean); return <td key={sub.id} style={{...styles.td, textAlign:'center'}}><span style={{fontWeight:'bold',fontSize:'12px',color:getMarkColor(mean)}}>{s.mean}</span><div style={{fontSize:'9px',color:'#999'}}>{s.count} pupils</div></td>; })}
                                                    <td colSpan="4" style={styles.td} />
                                                </tr>
                                                {(() => {
                                                    const ranks = getSubjectRanks();
                                                    return <tr style={{ backgroundColor:'#f3e5f5', borderBottom:'3px solid #6f42c1' }}>
                                                        <td colSpan="3" style={{...styles.td, fontWeight:'bold', color:'#6f42c1', fontSize:'12px'}}>🏆 Subject Rank</td>
                                                        {pivotSubjects.map(sub => <td key={sub.id} style={{...styles.td, textAlign:'center', fontWeight:'bold', color:'#6f42c1'}}>#{ranks[sub.id]}</td>)}
                                                        <td colSpan="4" style={styles.td} />
                                                    </tr>;
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={styles.legend}>
                                        <span style={styles.legendTitle}>💡 Click any mark to edit · Grade Legend:</span>
                                        <span style={{...styles.legendItem, color:'#28a745'}}>● EE (75-100)</span>
                                        <span style={{...styles.legendItem, color:'#2E75B6'}}>● ME (55-74)</span>
                                        <span style={{...styles.legendItem, color:'#ffc107'}}>● AE (40-54)</span>
                                        <span style={{...styles.legendItem, color:'#dc3545'}}>● BE (0-39)</span>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
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
    content: { padding:'clamp(12px,3vw,30px)' },
    title: { color:'#1F3864', margin:'0 0 5px 0', fontSize:'24px' },
    subtitle: { color:'#666', marginBottom:'20px' },
    error: { color:'red', padding:'10px', backgroundColor:'#fff3f3', borderRadius:'5px', marginBottom:'15px' },
    success: { color:'#155724', padding:'10px', backgroundColor:'#d4edda', borderRadius:'5px', marginBottom:'15px' },
    pendingBanner: { backgroundColor:'#fff3cd', border:'2px solid #ffc107', borderRadius:'8px', padding:'10px 16px', marginBottom:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px' },
    stepHeader: { display:'flex', alignItems:'center', gap:'15px', marginBottom:'20px', flexWrap:'wrap' },
    stepTitle: { color:'#1F3864', margin:'0 0 3px 0', fontSize:'20px' },
    stepSub: { color:'#666', margin:0, fontSize:'13px' },
    backBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'9px 16px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', whiteSpace:'nowrap' },
    searchInput: { padding:'9px 14px', borderRadius:'5px', border:'2px solid #ddd', fontSize:'14px', minWidth:'220px' },
    examGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'15px', marginBottom:'20px' },
    examTile: { backgroundColor:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', cursor:'pointer', transition:'transform 0.15s', userSelect:'none', WebkitUserSelect:'none' },
    examTileIcon: { fontSize:'36px', textAlign:'center', padding:'20px 20px 8px' },
    examTileName: { color:'#1F3864', fontWeight:'bold', fontSize:'16px', textAlign:'center', padding:'0 15px 5px' },
    examTileMeta: { color:'#888', fontSize:'12px', textAlign:'center', padding:'0 15px 12px' },
    examTileAction: { backgroundColor:'#1F3864', color:'white', textAlign:'center', padding:'8px', fontSize:'12px' },
    classGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'12px', marginBottom:'20px' },
    classTile: { backgroundColor:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 6px rgba(0,0,0,0.08)', cursor:'pointer', transition:'transform 0.15s,box-shadow 0.15s', userSelect:'none', WebkitUserSelect:'none' },
    classTileHeader: { fontSize:'18px', fontWeight:'bold', textAlign:'center', padding:'16px 10px 8px' },
    classTileStats: { display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', padding:'8px 10px' },
    classStat: { display:'flex', flexDirection:'column', alignItems:'center' },
    classStatNum: { fontSize:'20px', fontWeight:'bold', color:'#1F3864' },
    classStatLbl: { fontSize:'10px', color:'#888' },
    classDivider: { width:'1px', height:'30px', backgroundColor:'#eee' },
    classTileAction: { color:'white', textAlign:'center', padding:'7px', fontSize:'12px', marginTop:'8px' },
    skeletonTile: { backgroundColor:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 6px rgba(0,0,0,0.08)', padding:'16px 10px', borderTop:'4px solid #e0e0e0' },
    skeletonTitle: { height:'22px', backgroundColor:'#f0f0f0', borderRadius:'4px', margin:'0 auto 12px', width:'60%', animation:'pulse 1.5s ease-in-out infinite' },
    skeletonStats: { height:'40px', backgroundColor:'#f5f5f5', borderRadius:'4px', marginBottom:'12px' },
    skeletonAction: { height:'28px', backgroundColor:'#e8e8e8', borderRadius:'4px' },
    tableCard: { backgroundColor:'white', borderRadius:'10px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)', overflow:'hidden', marginBottom:'20px' },
    tableTopBar: { backgroundColor:'#1F3864', padding:'15px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px' },
    tableTitle: { color:'white', margin:'0 0 3px 0', fontSize:'16px' },
    tableSubtitle: { color:'#BDD7EE', margin:0, fontSize:'12px' },
    tableBadges: { display:'flex', gap:'8px', flexWrap:'wrap' },
    badge: { backgroundColor:'rgba(255,255,255,0.2)', color:'white', padding:'4px 12px', borderRadius:'20px', fontSize:'12px' },
    printBtn: { backgroundColor:'#28a745', color:'white', border:'none', padding:'8px 18px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'13px' },
    tableWrapper: { overflowX:'auto' },
    table: { width:'100%', borderCollapse:'collapse', minWidth:'800px' },
    tableHeader: { backgroundColor:'#1F3864' },
    th: { color:'white', padding:'10px 12px', textAlign:'left', whiteSpace:'nowrap', fontSize:'12px', fontWeight:'bold' },
    subjectTh: { textAlign:'center', backgroundColor:'#2E75B6', minWidth:'80px' },
    totalTh: { textAlign:'center', backgroundColor:'#1a2d4f', minWidth:'70px' },
    td: { padding:'8px 12px', borderBottom:'1px solid #eee', fontSize:'13px' },
    trEven: { backgroundColor:'#f9f9f9' },
    trOdd: { backgroundColor:'white' },
    stickyCol: { position:'sticky', left:0, backgroundColor:'#1F3864', zIndex:1, width:'40px', textAlign:'center' },
    stickyCol2: { position:'sticky', left:'40px', backgroundColor:'inherit', zIndex:1, minWidth:'90px' },
    stickyCol3: { position:'sticky', left:'130px', backgroundColor:'inherit', zIndex:1, minWidth:'150px', borderRight:'2px solid #ddd' },
    totalCell: { backgroundColor:'#f0f4ff', fontWeight:'bold' },
    gradeBadge: { color:'white', padding:'3px 8px', borderRadius:'3px', fontWeight:'bold', fontSize:'12px' },
    rankBadge: { backgroundColor:'#1F3864', color:'white', padding:'3px 8px', borderRadius:'3px', fontWeight:'bold', fontSize:'12px' },
    admNo: { backgroundColor:'#e3f2fd', color:'#1F3864', padding:'2px 6px', borderRadius:'3px', fontSize:'11px', fontFamily:'monospace' },
    legend: { padding:'12px 20px', borderTop:'1px solid #eee', display:'flex', gap:'15px', flexWrap:'wrap', alignItems:'center', backgroundColor:'#f8f9fa' },
    legendTitle: { fontWeight:'bold', color:'#1F3864', fontSize:'12px' },
    legendItem: { fontSize:'12px', fontWeight:'bold' },
    emptyCard: { backgroundColor:'white', padding:'40px', borderRadius:'10px', textAlign:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
};

export default Results;