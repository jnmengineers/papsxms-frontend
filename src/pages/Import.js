import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Import() {
    const [activeTab, setActiveTab] = useState('marks');
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);

    // Marks import state
    const [marksFile, setMarksFile] = useState(null);
    const [marksPreview, setMarksPreview] = useState([]);
    const [marksHeaders, setMarksHeaders] = useState([]);
    const [marksMeta, setMarksMeta] = useState({ examName: '', className: '', year: '', term: '' });
    const [marksImporting, setMarksImporting] = useState(false);
    const [marksResult, setMarksResult] = useState(null);

    // Students import state
    const [studentsFile, setStudentsFile] = useState(null);
    const [studentsPreview, setStudentsPreview] = useState([]);
    const [studentsImporting, setStudentsImporting] = useState(false);
    const [studentsResult, setStudentsResult] = useState(null);

    // Teachers import state
    const [teachersFile, setTeachersFile] = useState(null);
    const [teachersPreview, setTeachersPreview] = useState([]);
    const [teachersImporting, setTeachersImporting] = useState(false);
    const [teachersResult, setTeachersResult] = useState(null);

    const [error, setError] = useState('');

    useEffect(() => {
        fetchExams();
        fetchClasses();
    }, []);

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    // ── Parse Excel file ──────────────────────────────────────────────────────
    const parseExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                    resolve(json);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    // ── Marks Import ──────────────────────────────────────────────────────────
    const handleMarksFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setMarksFile(file);
        setMarksResult(null);
        setError('');
        try {
            const rows = await parseExcel(file);
            // Row 0 = meta headers, Row 1 = meta values, Row 2 = col headers, Row 3+ = data
            if (rows.length < 4) { setError('Invalid template format'); return; }
            const meta = rows[1];
            setMarksMeta({
                examName: meta[0] || '',
                className: meta[1] || '',
                year: meta[2] || '',
                term: meta[3] || ''
            });
            const headers = rows[2].filter(h => h !== '');
            setMarksHeaders(headers);
            const dataRows = rows.slice(3).filter(r => r[1] && r[1] !== ''); // has admission no
            setMarksPreview(dataRows.slice(0, 10)); // preview first 10
        } catch (err) {
            setError('Failed to parse file. Make sure you are using the correct template.');
        }
    };

    const handleMarksImport = async () => {
        if (!marksFile) return;
        setMarksImporting(true);
        setMarksResult(null);
        setError('');

        try {
            const rows = await parseExcel(marksFile);
            const meta = rows[1];
            const examName = meta[0];
            const className = meta[1];
            const term = parseInt(meta[3]);

            // Find exam
            const exam = exams.find(e =>
                e.examName.toLowerCase().trim() === examName?.toLowerCase().trim()
            );
            if (!exam) {
                setError(`Exam "${examName}" not found. Make sure the exam exists in the system.`);
                setMarksImporting(false);
                return;
            }

            // Find class
            const schoolClass = classes.find(c =>
                c.className.toLowerCase().trim() === className?.toLowerCase().trim()
            );
            if (!schoolClass) {
                setError(`Class "${className}" not found. Make sure the class exists in the system.`);
                setMarksImporting(false);
                return;
            }

            const headers = rows[2]; // col headers
            const subjectHeaders = headers.slice(3).filter(h => h !== ''); // skip #, ADM, NAME
            const dataRows = rows.slice(3).filter(r => r[1] && r[1] !== '');

            // Get students in this class
            const studentsRes = await api.get('/api/students');
            const classStudents = studentsRes.data.filter(s =>
                s.className === schoolClass.className ||
                String(s.schoolClass?.classId) === String(schoolClass.classId)
            );

            // Get subjects from class-subjects
            const subjectsRes = await api.get(`/api/class-subjects/by-class/${schoolClass.classId}`);
            const classSubjects = subjectsRes.data.map(cs => cs.subject).filter(Boolean);

            let saved = 0, updated = 0, skipped = 0, failed = 0;

            for (const row of dataRows) {
                const admNo = String(row[1]).trim();
                const student = classStudents.find(s =>
                    s.admissionNumber?.toLowerCase() === admNo.toLowerCase()
                );
                if (!student) { skipped++; continue; }

                for (let i = 0; i < subjectHeaders.length; i++) {
                    const subjectName = subjectHeaders[i];
                    const markValue = row[i + 3]; // offset by 3 (skip #, adm, name)

                    if (markValue === '' || markValue === null || markValue === undefined) continue;

                    const mark = parseFloat(markValue);
                    if (isNaN(mark) || mark < 0 || mark > 100) continue;

                    const subject = classSubjects.find(s =>
                        s.subjectName.toLowerCase().trim() === subjectName.toLowerCase().trim()
                    );
                    if (!subject) continue;

                    try {
                        // Check if result exists
                        const existingRes = await api.get(`/api/results/by-exam/${exam.examId}`);
                        const existing = existingRes.data.find(r =>
                            String(r.student?.studentId) === String(student.studentId) &&
                            String(r.subject?.subjectId) === String(subject.subjectId)
                        );

                        if (existing) {
                            await api.put(`/api/results/${existing.resultId}`, {
                                marksObtained: mark,
                                maxMarks: 100
                            });
                            updated++;
                        } else {
                            await api.post('/api/results', {
                                marksObtained: mark,
                                maxMarks: 100,
                                student: { studentId: student.studentId },
                                subject: { subjectId: subject.subjectId },
                                exam: { examId: exam.examId }
                            });
                            saved++;
                        }
                    } catch (err) {
                        failed++;
                    }
                }
            }

            setMarksResult({ saved, updated, skipped, failed, total: dataRows.length });
        } catch (err) {
            setError('Import failed: ' + err.message);
        }
        setMarksImporting(false);
    };

    // ── Students Import ───────────────────────────────────────────────────────
    const handleStudentsFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setStudentsFile(file);
        setStudentsResult(null);
        setError('');
        try {
            const rows = await parseExcel(file);
            const dataRows = rows.slice(1).filter(r => r[0] && r[0] !== '');
            setStudentsPreview(dataRows.slice(0, 10));
        } catch (err) {
            setError('Failed to parse file.');
        }
    };

    const handleStudentsImport = async () => {
        if (!studentsFile) return;
        setStudentsImporting(true);
        setStudentsResult(null);
        setError('');
        try {
            const rows = await parseExcel(studentsFile);
            const dataRows = rows.slice(1).filter(r => r[0] && r[0] !== '');
            let saved = 0, skipped = 0, failed = 0;

            for (const row of dataRows) {
                const [admNo, firstName, lastName, dob, gender, className] = row;
                if (!admNo || !firstName || !lastName) { skipped++; continue; }

                const schoolClass = classes.find(c =>
                    c.className.toLowerCase().trim() === String(className).toLowerCase().trim()
                );
                if (!schoolClass) { skipped++; continue; }

                try {
                    await api.post(`/api/students?classId=${schoolClass.classId}`, {
                        admissionNumber: String(admNo).trim(),
                        firstName: String(firstName).trim(),
                        lastName: String(lastName).trim(),
                        dateOfBirth: dob || '2010-01-01',
                        gender: gender || 'Male'
                    });
                    saved++;
                } catch (err) {
                    failed++;
                }
            }
            setStudentsResult({ saved, skipped, failed, total: dataRows.length });
        } catch (err) {
            setError('Import failed: ' + err.message);
        }
        setStudentsImporting(false);
    };

    // ── Teachers Import ───────────────────────────────────────────────────────
    const handleTeachersFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setTeachersFile(file);
        setTeachersResult(null);
        setError('');
        try {
            const rows = await parseExcel(file);
            const dataRows = rows.slice(1).filter(r => r[0] && r[0] !== '');
            setTeachersPreview(dataRows.slice(0, 10));
        } catch (err) {
            setError('Failed to parse file.');
        }
    };

    const handleTeachersImport = async () => {
        if (!teachersFile) return;
        setTeachersImporting(true);
        setTeachersResult(null);
        setError('');
        try {
            const rows = await parseExcel(teachersFile);
            const dataRows = rows.slice(1).filter(r => r[0] && r[0] !== '');
            let saved = 0, updated = 0, skipped = 0, failed = 0;

            // Fetch existing teachers to check for duplicates by phone
            const existingRes = await api.get('/api/teachers');
            const existingTeachers = existingRes.data;

            for (const row of dataRows) {
                // New column order: PHONE (unique), FIRST NAME, LAST NAME, EMAIL (optional)
                const [phone, firstName, lastName, email] = row;
                if (!phone || !firstName || !lastName) { skipped++; continue; }

                const phoneStr = String(phone).trim();
                const existing = existingTeachers.find(t =>
                    String(t.phone || '').trim() === phoneStr
                );

                try {
                    if (existing) {
                        // Update existing teacher — only overwrite email if provided
                        await api.put(`/api/teachers/${existing.teacherId}`, {
                            firstName: String(firstName).trim(),
                            lastName: String(lastName).trim(),
                            email: email ? String(email).trim() : existing.email,
                            phone: phoneStr
                        });
                        updated++;
                    } else {
                        await api.post('/api/teachers', {
                            firstName: String(firstName).trim(),
                            lastName: String(lastName).trim(),
                            email: email ? String(email).trim() : null,
                            phone: phoneStr
                        });
                        saved++;
                    }
                } catch (err) {
                    failed++;
                }
            }
            setTeachersResult({ saved, updated, skipped, failed, total: dataRows.length });
        } catch (err) {
            setError('Import failed: ' + err.message);
        }
        setTeachersImporting(false);
    };

    const ResultBanner = ({ result, type }) => {
        if (!result) return null;
        return (
            <div style={styles.resultBanner}>
                <h4 style={styles.resultTitle}>✅ Import Complete — {type}</h4>
                <div style={styles.resultStats}>
                    <div style={{ ...styles.resultStat, backgroundColor: '#d4edda', color: '#155724' }}>
                        <strong>{result.saved}</strong> New
                    </div>
                    {result.updated !== undefined && (
                        <div style={{ ...styles.resultStat, backgroundColor: '#cce5ff', color: '#004085' }}>
                            <strong>{result.updated}</strong> Updated
                        </div>
                    )}
                    <div style={{ ...styles.resultStat, backgroundColor: '#fff3cd', color: '#856404' }}>
                        <strong>{result.skipped}</strong> Skipped
                    </div>
                    <div style={{ ...styles.resultStat, backgroundColor: result.failed > 0 ? '#f8d7da' : '#f8f9fa', color: result.failed > 0 ? '#721c24' : '#666' }}>
                        <strong>{result.failed}</strong> Failed
                    </div>
                    <div style={{ ...styles.resultStat, backgroundColor: '#e2e3e5', color: '#383d41' }}>
                        <strong>{result.total}</strong> Total Rows
                    </div>
                </div>
            </div>
        );
    };

    const tabs = [
        { key: 'marks', label: '📊 Student Marks', icon: '📊' },
        { key: 'students', label: '🎓 Students', icon: '🎓' },
        { key: 'teachers', label: '👨‍🏫 Teachers', icon: '👨‍🏫' },
    ];

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
                <h2 style={styles.title}>📥 Import Data</h2>
                <p style={styles.subtitle}>Bulk import marks, students and teachers from Excel templates</p>

                {error && <p style={styles.error}>{error}</p>}

                {/* Tabs */}
                <div style={styles.tabs}>
                    {tabs.map(tab => (
                        <button key={tab.key} onClick={() => { setActiveTab(tab.key); setError(''); }}
                            style={{ ...styles.tab, backgroundColor: activeTab === tab.key ? '#1F3864' : 'white', color: activeTab === tab.key ? 'white' : '#1F3864' }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── MARKS IMPORT ── */}
                {activeTab === 'marks' && (
                    <div>
                        {/* Download Template */}
                        <div style={styles.templateCard}>
                            <div style={styles.templateLeft}>
                                <h3 style={styles.templateTitle}>📥 Step 1 — Download Template</h3>
                                <p style={styles.templateDesc}>
                                    Download the marks template, fill in the exam name, class name, and marks for each student per subject, then upload below.
                                </p>
                                <div style={styles.templateSteps}>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>1</span> Download template</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>2</span> Fill Exam Name exactly as in system</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>3</span> Fill Class Name exactly as in system (e.g. G1R)</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>4</span> Fill marks per student per subject (0-100)</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>5</span> Leave empty cells blank — they will be skipped</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>6</span> Upload the filled template below</div>
                                </div>
                            </div>
                            <a href="/marks_import_template.xlsx" download style={styles.downloadBtn}>
                                ⬇️ Download Marks Template
                            </a>
                        </div>

                        {/* Upload */}
                        <div style={styles.uploadCard}>
                            <h3 style={styles.uploadTitle}>📤 Step 2 — Upload Filled Template</h3>
                            <div style={styles.uploadArea}>
                                <input type="file" accept=".xlsx,.xls"
                                    onChange={handleMarksFile}
                                    style={styles.fileInput}
                                    id="marksFile" />
                                <label htmlFor="marksFile" style={styles.fileLabel}>
                                    📁 {marksFile ? marksFile.name : 'Click to select Excel file (.xlsx)'}
                                </label>
                            </div>

                            {/* Meta Preview */}
                            {marksMeta.examName && (
                                <div style={styles.metaPreview}>
                                    <div style={styles.metaItem}>
                                        <span style={styles.metaLabel}>Exam</span>
                                        <span style={{ ...styles.metaValue, color: exams.find(e => e.examName.toLowerCase().trim() === marksMeta.examName.toLowerCase().trim()) ? '#28a745' : '#dc3545' }}>
                                            {marksMeta.examName}
                                            {exams.find(e => e.examName.toLowerCase().trim() === marksMeta.examName.toLowerCase().trim()) ? ' ✅' : ' ❌ Not found'}
                                        </span>
                                    </div>
                                    <div style={styles.metaItem}>
                                        <span style={styles.metaLabel}>Class</span>
                                        <span style={{ ...styles.metaValue, color: classes.find(c => c.className.toLowerCase().trim() === marksMeta.className.toLowerCase().trim()) ? '#28a745' : '#dc3545' }}>
                                            {marksMeta.className}
                                            {classes.find(c => c.className.toLowerCase().trim() === marksMeta.className.toLowerCase().trim()) ? ' ✅' : ' ❌ Not found'}
                                        </span>
                                    </div>
                                    <div style={styles.metaItem}>
                                        <span style={styles.metaLabel}>Year</span>
                                        <span style={styles.metaValue}>{marksMeta.year}</span>
                                    </div>
                                    <div style={styles.metaItem}>
                                        <span style={styles.metaLabel}>Term</span>
                                        <span style={styles.metaValue}>{marksMeta.term}</span>
                                    </div>
                                </div>
                            )}

                            {/* Preview Table */}
                            {marksPreview.length > 0 && (
                                <div>
                                    <h4 style={styles.previewTitle}>👁️ Preview (first 10 rows)</h4>
                                    <div style={styles.previewWrapper}>
                                        <table style={styles.previewTable}>
                                            <thead>
                                                <tr>
                                                    {marksHeaders.map((h, i) => (
                                                        <th key={i} style={styles.previewTh}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {marksPreview.map((row, i) => (
                                                    <tr key={i}>
                                                        {marksHeaders.map((_, j) => (
                                                            <td key={j} style={styles.previewTd}>{row[j]}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button onClick={handleMarksImport} style={styles.importBtn} disabled={marksImporting}>
                                        {marksImporting ? '⏳ Importing marks...' : '📥 Import Marks'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <ResultBanner result={marksResult} type="Marks" />
                    </div>
                )}

                {/* ── STUDENTS IMPORT ── */}
                {activeTab === 'students' && (
                    <div>
                        <div style={styles.templateCard}>
                            <div style={styles.templateLeft}>
                                <h3 style={styles.templateTitle}>📥 Step 1 — Download Template</h3>
                                <p style={styles.templateDesc}>
                                    Download the students template, fill in student details then upload.
                                    Make sure the CLASS NAME matches exactly (e.g. G1R, PP1Y, G7).
                                </p>
                                <div style={styles.templateSteps}>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>1</span> ADMISSION NO — unique student ID</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>2</span> FIRST NAME and LAST NAME</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>3</span> DATE OF BIRTH — format YYYY-MM-DD</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>4</span> GENDER — exactly "Male" or "Female"</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>5</span> CLASS NAME — exactly as in system (e.g. G1R)</div>
                                </div>
                            </div>
                            <a href="/students_import_template.xlsx" download style={styles.downloadBtn}>
                                ⬇️ Download Students Template
                            </a>
                        </div>

                        <div style={styles.uploadCard}>
                            <h3 style={styles.uploadTitle}>📤 Step 2 — Upload Filled Template</h3>
                            <div style={styles.uploadArea}>
                                <input type="file" accept=".xlsx,.xls"
                                    onChange={handleStudentsFile}
                                    style={styles.fileInput}
                                    id="studentsFile" />
                                <label htmlFor="studentsFile" style={styles.fileLabel}>
                                    📁 {studentsFile ? studentsFile.name : 'Click to select Excel file (.xlsx)'}
                                </label>
                            </div>

                            {studentsPreview.length > 0 && (
                                <div>
                                    <h4 style={styles.previewTitle}>👁️ Preview (first 10 rows)</h4>
                                    <div style={styles.previewWrapper}>
                                        <table style={styles.previewTable}>
                                            <thead>
                                                <tr>
                                                    {['ADM NO', 'FIRST NAME', 'LAST NAME', 'DOB', 'GENDER', 'CLASS'].map((h, i) => (
                                                        <th key={i} style={styles.previewTh}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {studentsPreview.map((row, i) => (
                                                    <tr key={i}>
                                                        {row.slice(0, 6).map((cell, j) => (
                                                            <td key={j} style={{
                                                                ...styles.previewTd,
                                                                color: j === 5 && !classes.find(c => c.className.toLowerCase() === String(cell).toLowerCase()) ? '#dc3545' : 'inherit'
                                                            }}>{cell}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button onClick={handleStudentsImport} style={styles.importBtn} disabled={studentsImporting}>
                                        {studentsImporting ? '⏳ Importing students...' : '📥 Import Students'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <ResultBanner result={studentsResult} type="Students" />
                    </div>
                )}

                {/* ── TEACHERS IMPORT ── */}
                {activeTab === 'teachers' && (
                    <div>
                        <div style={styles.templateCard}>
                            <div style={styles.templateLeft}>
                                <h3 style={styles.templateTitle}>📥 Step 1 — Download Template</h3>
                                <p style={styles.templateDesc}>
                                    Download the teachers template, fill in teacher details then upload.
                                    <strong> Phone number is the unique identifier</strong> — if a teacher with that phone already exists, their record is updated instead of duplicated.
                                </p>
                                <div style={styles.templateSteps}>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>1</span> PHONE NUMBER — unique identifier (e.g. 0712345678)</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>2</span> FIRST NAME</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>3</span> LAST NAME</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>4</span> EMAIL — optional, leave blank if unavailable, can be added later</div>
                                    <div style={styles.stepItem}><span style={styles.stepNum}>5</span> Existing phone number → record updated. New phone number → new teacher created</div>
                                </div>
                            </div>
                            <a href="/teachers_import_template.xlsx" download style={styles.downloadBtn}>
                                ⬇️ Download Teachers Template
                            </a>
                        </div>

                        <div style={styles.uploadCard}>
                            <h3 style={styles.uploadTitle}>📤 Step 2 — Upload Filled Template</h3>
                            <div style={styles.uploadArea}>
                                <input type="file" accept=".xlsx,.xls"
                                    onChange={handleTeachersFile}
                                    style={styles.fileInput}
                                    id="teachersFile" />
                                <label htmlFor="teachersFile" style={styles.fileLabel}>
                                    📁 {teachersFile ? teachersFile.name : 'Click to select Excel file (.xlsx)'}
                                </label>
                            </div>

                            {teachersPreview.length > 0 && (
                                <div>
                                    <h4 style={styles.previewTitle}>👁️ Preview (first 10 rows)</h4>
                                    <div style={styles.previewWrapper}>
                                        <table style={styles.previewTable}>
                                            <thead>
                                                <tr>
                                                    {['PHONE (Unique)', 'FIRST NAME', 'LAST NAME', 'EMAIL (Optional)'].map((h, i) => (
                                                        <th key={i} style={styles.previewTh}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teachersPreview.map((row, i) => (
                                                    <tr key={i}>
                                                        {row.slice(0, 4).map((cell, j) => (
                                                            <td key={j} style={styles.previewTd}>{cell}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button onClick={handleTeachersImport} style={styles.importBtn} disabled={teachersImporting}>
                                        {teachersImporting ? '⏳ Importing teachers...' : '📥 Import Teachers'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <ResultBanner result={teachersResult} type="Teachers" />
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
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', marginBottom: '25px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    templateCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' },
    templateLeft: { flex: 1 },
    templateTitle: { color: '#1F3864', margin: '0 0 8px 0', fontSize: '16px' },
    templateDesc: { color: '#666', fontSize: '14px', marginBottom: '15px' },
    templateSteps: { display: 'flex', flexDirection: 'column', gap: '6px' },
    stepItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#555' },
    stepNum: { backgroundColor: '#1F3864', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 },
    downloadBtn: { backgroundColor: '#28a745', color: 'white', padding: '12px 20px', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', alignSelf: 'center' },
    uploadCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    uploadTitle: { color: '#1F3864', margin: '0 0 15px 0', fontSize: '16px' },
    uploadArea: { marginBottom: '15px' },
    fileInput: { display: 'none' },
    fileLabel: { display: 'block', padding: '15px 20px', border: '2px dashed #2E75B6', borderRadius: '8px', cursor: 'pointer', color: '#2E75B6', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f0f8ff', fontSize: '14px' },
    metaPreview: { display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '12px 15px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '15px' },
    metaItem: { display: 'flex', flexDirection: 'column', gap: '3px' },
    metaLabel: { fontSize: '11px', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' },
    metaValue: { fontSize: '14px', fontWeight: 'bold', color: '#1F3864' },
    previewTitle: { color: '#1F3864', margin: '0 0 10px 0', fontSize: '14px' },
    previewWrapper: { overflowX: 'auto', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ddd' },
    previewTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
    previewTh: { backgroundColor: '#1F3864', color: 'white', padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' },
    previewTd: { padding: '6px 10px', borderBottom: '1px solid #eee' },
    importBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' },
    resultBanner: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' },
    resultTitle: { color: '#155724', margin: '0 0 12px 0', fontSize: '16px' },
    resultStats: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    resultStat: { padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' },
};

export default Import;