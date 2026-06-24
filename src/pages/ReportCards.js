import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

const gradeLabel = (marks) => marks >= 75 ? 'EE' : marks >= 55 ? 'ME' : marks >= 40 ? 'AE' : 'BE';
const gradeColor = (marks) => marks >= 75 ? '#28a745' : marks >= 55 ? '#2E75B6' : marks >= 40 ? '#ffc107' : '#dc3545';
const gradeRemarks = (marks) => marks >= 75 ? 'Exceeding Expectations' : marks >= 55 ? 'Meeting Expectations' : marks >= 40 ? 'Approaching Expectations' : 'Below Expectations';
const trendIcon = (change) => { const v = parseFloat(change); if (isNaN(v)) return { icon:'—', color:'#999' }; if (v > 5) return { icon:'↑↑', color:'#28a745' }; if (v > 0) return { icon:'↑', color:'#28a745' }; if (v < -5) return { icon:'↓↓', color:'#dc3545' }; if (v < 0) return { icon:'↓', color:'#dc3545' }; return { icon:'↔', color:'#ffc107' }; };

// ── Print report card via window.open ────────────────────────────────────────
const printReportCard = (card, singleResults, progressiveData, exams) => {
    const student = card.student;
    const exam = card.exam;
    const term = exam?.term;
    const academicYear = exam?.academicYear;

    // Check if progressive data has multiple exams
    // Only include exams that actually have marks for this student
    const allTermExams = progressiveData?.exams || [];
    const subjects = progressiveData?.subjects || [];
    const termExams = allTermExams.filter(e => {
        const type = e.examType;
        return subjects.some(sub =>
            (type === 'OPENING' && sub.opening != null) ||
            (type === 'MID_TERM' && sub.midTerm != null) ||
            (type === 'END_TERM' && sub.endTerm != null)
        );
    });
    const isProgressive = termExams.length > 1 && subjects.length > 0;

    const gc = (m) => m >= 75 ? '#28a745' : m >= 55 ? '#2E75B6' : m >= 40 ? '#ffc107' : '#dc3545';
    const gl = (m) => m >= 75 ? 'EE' : m >= 55 ? 'ME' : m >= 40 ? 'AE' : 'BE';
    const gr = (m) => m >= 75 ? 'Exceeding Expectations' : m >= 55 ? 'Meeting Expectations' : m >= 40 ? 'Approaching Expectations' : 'Below Expectations';

    const examTypeLabels = { OPENING: 'Opening', MID_TERM: 'Mid Term', END_TERM: 'End Term' };
    const examTypeColors = { OPENING: '#28a745', MID_TERM: '#e07a2f', END_TERM: '#2E75B6' };

    // Build subject rows
    let subjectRows = '';
    let totalMarks = 0, subjectCount = 0;

    if (isProgressive) {
        // Progressive — columns for each exam type
        // subjects already defined above
        const examCols = termExams.map(e => e.examType).filter(Boolean);

        subjectRows = subjects.map((sub, i) => {
            const opening = sub.opening;
            const midTerm = sub.midTerm;
            const endTerm = sub.endTerm;
            const current = endTerm ?? midTerm ?? opening;
            const first = opening ?? midTerm;
            const latest = endTerm ?? midTerm ?? opening;
            const change = (first != null && latest != null && first !== latest) ? (latest - first).toFixed(1) : null;
            const trend = change ? (parseFloat(change) > 0 ? `<span style="color:#28a745">↑ +${change}</span>` : `<span style="color:#dc3545">↓ ${change}</span>`) : '<span style="color:#999">↔</span>';
            if (current != null) { totalMarks += current; subjectCount++; }

            const openCell = opening != null ? `<strong style="color:${gc(opening)}">${opening}</strong><br><small style="color:${gc(opening)}">${gl(opening)}</small>` : '<span style="color:#ccc">—</span>';
            const midCell = midTerm != null ? `<strong style="color:${gc(midTerm)}">${midTerm}</strong><br><small style="color:${gc(midTerm)}">${gl(midTerm)}</small>` : '<span style="color:#ccc">—</span>';
            const endCell = endTerm != null ? `<strong style="color:${gc(endTerm)}">${endTerm}</strong><br><small style="color:${gc(endTerm)}">${gl(endTerm)}</small>` : '<span style="color:#ccc">—</span>';

            return `<tr style="background:${i%2===0?'#f8f9fa':'white'}">
                <td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;font-size:12px;">${i+1}. ${sub.subjectName}</td>
                ${examCols.includes('OPENING') ? `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:12px;">${openCell}</td>` : ''}
                ${examCols.includes('MID_TERM') ? `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:12px;">${midCell}</td>` : ''}
                ${examCols.includes('END_TERM') ? `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:12px;">${endCell}</td>` : ''}
                <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px;">${trend}</td>
            </tr>`;
        }).join('');

        // Exam type header columns
        var examHeaders = examCols.map(type =>
            `<th style="color:white;padding:6px 8px;text-align:center;background:${examTypeColors[type]||'#1F3864'};font-size:11px;">${examTypeLabels[type]||type}</th>`
        ).join('');
    } else {
        // Single exam
        singleResults.forEach((r, i) => {
            totalMarks += r.marksObtained;
            subjectCount++;
            subjectRows += `<tr style="background:${i%2===0?'#f8f9fa':'white'}">
                <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;">${i+1}. ${r.subject?.subjectName}</td>
                <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:bold;font-size:14px;color:${gc(r.marksObtained)}">${r.marksObtained}</td>
                <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;"><span style="background:${gc(r.marksObtained)};color:white;padding:2px 8px;border-radius:3px;font-weight:bold;font-size:11px;">${gl(r.marksObtained)}</span></td>
                <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;color:#555">${gr(r.marksObtained)}</td>
            </tr>`;
        });
    }

    const avg = subjectCount > 0 ? totalMarks / subjectCount : 0;
    const avgGrade = gl(avg);
    const avgColor = gc(avg);

    // Overall change for progressive
    let overallChange = '';
    if (isProgressive && progressiveData.subjects?.length > 0) {
        const subjects = progressiveData.subjects;
        const total = subjects.reduce((s, sub) => s + (parseFloat(sub.change) || 0), 0);
        const avgChg = (total / subjects.length).toFixed(1);
        const improved = subjects.filter(s => parseFloat(s.change) > 0).length;
        overallChange = `
            <div style="display:flex;gap:15px;background:#f8f9fa;padding:10px 15px;border-radius:6px;margin-top:8px;flex-wrap:wrap;">
                <span style="font-size:12px;"><strong>Overall Change:</strong> <span style="color:${parseFloat(avgChg)>=0?'#28a745':'#dc3545'};font-weight:bold;">${parseFloat(avgChg)>=0?'+':''}${avgChg} pts</span></span>
                <span style="font-size:12px;"><strong>Subjects Improved:</strong> <span style="color:#28a745;font-weight:bold;">${improved}/${subjects.length}</span></span>
                <span style="font-size:12px;"><strong>Overall Trend:</strong> <span style="font-size:16px;">${parseFloat(avgChg)>2?'↑↑':parseFloat(avgChg)>0?'↑':parseFloat(avgChg)<-2?'↓↓':parseFloat(avgChg)<0?'↓':'↔'}</span></span>
            </div>`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report Card - ${student?.firstName} ${student?.lastName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Times New Roman',Times,serif;font-size:12px;color:#000;padding:15px;max-width:800px;margin:0 auto;}
@media print{@page{size:A4;margin:10mm;}.no-print{display:none!important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>

<div class="no-print" style="background:#1F3864;color:white;padding:10px 15px;margin-bottom:15px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:bold;">📋 ${student?.firstName} ${student?.lastName} — Report Card</span>
    <button onclick="window.print()" style="background:#FFD700;color:#1F3864;border:none;padding:8px 20px;border-radius:5px;font-weight:bold;cursor:pointer;font-size:14px;">🖨️ Print / Save PDF</button>
</div>

<!-- Header -->
<div style="border-bottom:3px solid #1F3864;padding-bottom:10px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <img src="/logo1.png" onerror="this.style.display='none'" style="width:70px;height:70px;object-fit:contain;">
        <div style="text-align:center;flex:1;padding:0 10px;">
            <div style="color:#1F3864;font-size:14px;font-weight:bold;text-transform:uppercase;">PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL</div>
            <div style="color:#2E75B6;font-style:italic;font-size:12px;margin:3px 0;">Abreast with the Best in Holistic Education</div>
            <div style="font-size:11px;color:#666;">P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996</div>
        </div>
        <img src="/logo2.png" onerror="this.style.display='none'" style="width:70px;height:70px;object-fit:contain;">
    </div>
    <div style="background:#1F3864;padding:6px 12px;text-align:center;border-radius:4px;">
        <div style="color:white;font-weight:bold;font-size:14px;">
            ${isProgressive ? 'PROGRESSIVE TERM REPORT CARD' : 'REPORT CARD'}
        </div>
        <div style="color:#BDD7EE;font-size:11px;">Term ${term} • ${academicYear} • ${exam?.examName}</div>
    </div>
</div>

<!-- Student Info -->
<div style="background:#f8f9fa;padding:12px 15px;border-radius:6px;margin-bottom:12px;border-left:4px solid #1F3864;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="font-size:12px;"><strong style="color:#1F3864;">Student Name:</strong> ${student?.firstName} ${student?.lastName}</div>
        <div style="font-size:12px;"><strong style="color:#1F3864;">Admission No:</strong> ${student?.admissionNumber || '—'}</div>
        <div style="font-size:12px;"><strong style="color:#1F3864;">Class:</strong> ${student?.className || '—'}</div>
        <div style="font-size:12px;"><strong style="color:#1F3864;">Stream:</strong> ${student?.stream || '—'}</div>
        <div style="font-size:12px;"><strong style="color:#1F3864;">Term:</strong> Term ${term}</div>
        <div style="font-size:12px;"><strong style="color:#1F3864;">Academic Year:</strong> ${academicYear}</div>
    </div>
</div>

<!-- Results Table -->
<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
    <thead>
        <tr style="background:#1F3864;">
            <th style="color:white;padding:7px 8px;text-align:left;font-size:12px;">SUBJECT</th>
            ${isProgressive ? examHeaders : `
                <th style="color:#FFD700;padding:7px 8px;text-align:center;font-size:12px;">MARKS</th>
                <th style="color:#FFD700;padding:7px 8px;text-align:center;font-size:12px;">GRADE</th>
                <th style="color:white;padding:7px 8px;text-align:left;font-size:12px;">REMARKS</th>
            `}
            ${isProgressive ? '<th style="color:white;padding:7px 8px;text-align:center;font-size:12px;">TREND</th>' : ''}
        </tr>
    </thead>
    <tbody>
        ${subjectRows}
    </tbody>
</table>

<!-- Summary Bar -->
<div style="display:flex;gap:15px;background:#1F3864;padding:12px 15px;border-radius:6px;margin-bottom:12px;flex-wrap:wrap;">
    <div style="flex:1;text-align:center;">
        <div style="color:#FFD700;font-size:11px;">Total Marks</div>
        <div style="color:white;font-size:22px;font-weight:bold;">${totalMarks.toFixed(0)}</div>
    </div>
    <div style="flex:1;text-align:center;">
        <div style="color:#FFD700;font-size:11px;">Average</div>
        <div style="color:white;font-size:22px;font-weight:bold;">${avg.toFixed(1)}%</div>
    </div>
    <div style="flex:1;text-align:center;">
        <div style="color:#FFD700;font-size:11px;">Grade</div>
        <div style="color:white;font-size:22px;font-weight:bold;">${avgGrade}</div>
    </div>
    <div style="flex:1;text-align:center;">
        <div style="color:#FFD700;font-size:11px;">Subjects</div>
        <div style="color:white;font-size:22px;font-weight:bold;">${subjectCount}</div>
    </div>
    ${card.termRank ? `<div style="flex:1;text-align:center;"><div style="color:#FFD700;font-size:11px;">Term Rank</div><div style="color:white;font-size:22px;font-weight:bold;">${card.termRank}</div></div>` : ''}
</div>

${overallChange}

<!-- Grade Key -->
<div style="background:#f8f9fa;padding:8px 12px;border-radius:4px;margin-bottom:12px;font-size:11px;">
    <strong>Grade Key: </strong>
    <span style="color:#28a745;">EE = 75-100 (Exceeding)</span> &nbsp;|&nbsp;
    <span style="color:#2E75B6;">ME = 55-74 (Meeting)</span> &nbsp;|&nbsp;
    <span style="color:#ffc107;">AE = 40-54 (Approaching)</span> &nbsp;|&nbsp;
    <span style="color:#dc3545;">BE = 0-39 (Below Expectations)</span>
</div>

<!-- Comments -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
    <div style="border:1px solid #ddd;padding:12px;border-radius:6px;">
        <p style="font-weight:bold;color:#1F3864;margin:0 0 8px 0;font-size:12px;">Class Teacher's Comment:</p>
        <p style="margin:0 0 20px 0;min-height:35px;font-size:12px;color:#333;">${card.teacherComment || '.................................................................'}</p>
        <p style="margin:0;color:#666;font-size:11px;">Signature: _________________ Date: _________</p>
    </div>
    <div style="border:1px solid #ddd;padding:12px;border-radius:6px;">
        <p style="font-weight:bold;color:#1F3864;margin:0 0 8px 0;font-size:12px;">Principal's Comment:</p>
        <p style="margin:0 0 20px 0;min-height:35px;font-size:12px;color:#333;">${card.principalComment || '.................................................................'}</p>
        <p style="margin:0;color:#666;font-size:11px;">Signature: _________________ Date: _________</p>
    </div>
</div>

<p style="text-align:center;font-size:10px;color:#999;border-top:2px solid #1F3864;padding-top:8px;">
    Pipeline Adventist School — Official Report Card — Issued: ${new Date().toLocaleDateString()}
</p>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    else alert('Please allow popups to print report cards.');
};

// ── Main Component ────────────────────────────────────────────────────────────
function ReportCards() {
    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [search, setSearch] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterExam, setFilterExam] = useState('');
    const [filtered, setFiltered] = useState([]);
    const [genMode, setGenMode] = useState('class');
    const [genExam, setGenExam] = useState('');
    const [genClassId, setGenClassId] = useState('');
    const [genStudent, setGenStudent] = useState('');
    const [bulkProgress, setBulkProgress] = useState(null);
    const [view, setView] = useState('tiles'); // 'tiles' | 'list'
    const [selectedClassFilter, setSelectedClassFilter] = useState('');
    const [editForm, setEditForm] = useState({ termRank:'', Remarks:'', teacherComment:'', principalComment:'' });
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const sections = [
        { value:'PRE_SCHOOL', label:'Pre-School', color:'#6f42c1' },
        { value:'LOWER_PRIMARY', label:'Lower Primary', color:'#2E75B6' },
        { value:'UPPER_PRIMARY', label:'Upper Primary', color:'#fd7e14' },
        { value:'JUNIOR_SCHOOL', label:'Junior School', color:'#20c997' }
    ];

    useEffect(() => { fetchReportCards(); fetchStudents(); fetchClasses(); fetchExams(); }, []);

    useEffect(() => {
        let data = reportCards;
        if (search) data = data.filter(c =>
            c.student?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            c.student?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            c.student?.admissionNumber?.toLowerCase().includes(search.toLowerCase())
        );
        if (filterClass) data = data.filter(c =>
            String(c.student?.className) === String(filterClass) ||
            String(c.student?.schoolClass?.classId) === String(filterClass)
        );
        if (filterExam) data = data.filter(c => String(c.exam?.examId) === String(filterExam));
        if (selectedClassFilter) data = data.filter(c =>
            String(c.student?.className) === String(selectedClassFilter) ||
            String(c.student?.schoolClass?.className) === String(selectedClassFilter)
        );
        setFiltered(data);
    }, [search, filterClass, filterExam, selectedClassFilter, reportCards]);

    const fetchReportCards = async () => {
        try { const r = await api.get('/api/reportCards'); setReportCards(r.data); setFiltered(r.data); setLoading(false); }
        catch (e) { setError('Failed to load report cards'); setLoading(false); }
    };
    const fetchStudents = async () => { try { const r = await api.get('/api/students'); setStudents(r.data); } catch(e){} };
    const fetchClasses = async () => { try { const r = await api.get('/api/classes'); setClasses(r.data); } catch(e){} };
    const fetchExams = async () => { try { const r = await api.get('/api/exams'); setExams(r.data); } catch(e){} };

    const handleGenerateStudent = async (e) => {
        e.preventDefault();
        if (!genStudent || !genExam) { setError('Select both student and exam'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        try {
            await api.post(`/api/reportCards/generate/student/${genStudent}/exam/${genExam}`);
            setSuccessMsg('✅ Report card generated!');
            setGenStudent(''); fetchReportCards();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (e) { setError('Failed. Make sure results exist for this student.'); }
        setGenerating(false);
    };

    const handleGenerateClass = async () => {
        if (!genClassId || !genExam) { setError('Select both class and exam'); return; }
        const classStudents = students.filter(s => String(s.schoolClass?.classId) === String(genClassId));
        if (!classStudents.length) { setError('No students found in this class'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        let success = 0, failed = 0;
        setBulkProgress({ done:0, total:classStudents.length, success:0, failed:0 });
        for (let i = 0; i < classStudents.length; i++) {
            try { await api.post(`/api/reportCards/generate/student/${classStudents[i].studentId}/exam/${genExam}`); success++; }
            catch (e) { failed++; }
            setBulkProgress({ done:i+1, total:classStudents.length, success, failed });
        }
        setGenerating(false);
        setSuccessMsg(`✅ Generated ${success} report card(s).${failed>0?` ${failed} failed.`:''}`);
        setBulkProgress(null); fetchReportCards();
        setTimeout(() => setSuccessMsg(''), 5000);
    };

    const handleEdit = (card) => {
        setEditingCard(card);
        setEditForm({ termRank:card.termRank||'', Remarks:card.Remarks||'', teacherComment:card.teacherComment||'', principalComment:card.principalComment||'' });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/reportCards/${editingCard.reportId}`, {
                totalMarks:editingCard.totalMarks, averageMarks:editingCard.averageMarks,
                termRank:editForm.termRank!==''?parseInt(editForm.termRank):null,
                Remarks:editForm.Remarks, teacherComment:editForm.teacherComment,
                principalComment:editForm.principalComment
            });
            setSuccessMsg('✅ Updated!'); setEditingCard(null); fetchReportCards();
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (e) { setError('Failed to update'); }
    };

    const handlePrintCard = async (card) => {
        setPrinting(card.reportId);
        try {
            // Fetch single exam results
            const resultsRes = await api.get(`/api/results/student/${card.student?.studentId}/exam/${card.exam?.examId}`);
            const singleResults = resultsRes.data;

            // Fetch progressive data for this term
            let progressiveData = null;
            try {
                const term = card.exam?.term;
                const year = card.exam?.academicYear;
                if (term && year) {
                    const progRes = await api.get(`/api/results/progressive/student/${card.student?.studentId}/term/${term}/year/${year}`);
                    progressiveData = progRes.data;
                }
            } catch(e) { /* progressive not available */ }

            printReportCard(card, singleResults, progressiveData, exams);
        } catch (e) { setError('Failed to load results for printing'); }
        setPrinting(null);
    };

    const handleDelete = async (id) => {
        try { await api.delete(`/api/reportCards/${id}`); fetchReportCards(); setDeleteConfirm(null); }
        catch (e) { setError('Failed to delete'); }
    };

    // Build class tiles from report cards
    const classTilesData = () => {
        const map = {};
        reportCards.forEach(card => {
            const cls = card.student?.className || card.student?.schoolClass?.className;
            const section = card.student?.schoolClass?.section || '';
            if (!cls) return;
            if (!map[cls]) map[cls] = { className:cls, section, count:0, exams:new Set(), avgSum:0, avgCount:0 };
            map[cls].count++;
            if (card.exam?.examId) map[cls].exams.add(card.exam.examId);
            if (card.averageMarks) { map[cls].avgSum += card.averageMarks; map[cls].avgCount++; }
        });
        return Object.values(map).sort((a,b) => a.className.localeCompare(b.className));
    };

    const selectedClass = classes.find(c => String(c.classId) === String(genClassId));
    const classStudentsCount = students.filter(s => String(s.schoolClass?.classId) === String(genClassId)).length;
    const classTiles = classTilesData();

    const sectionColor = (section) => {
        const colors = { PRE_SCHOOL:'#6f42c1', LOWER_PRIMARY:'#2E75B6', UPPER_PRIMARY:'#fd7e14', JUNIOR_SCHOOL:'#20c997' };
        return colors[section] || '#1F3864';
    };

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}><img src={logo1} alt="Logo" style={styles.navLogo} /><h2 style={styles.navTitle}>Pipeline Adventist School</h2></div>
                <div style={styles.navRight}>
                    <button onClick={() => window.location.href='/dashboard'} style={styles.navBtn}>← Dashboard</button>
                    <button onClick={() => { localStorage.clear(); window.location.href='/'; }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                <h2 style={styles.title}>📋 Report Cards</h2>
                <p style={styles.subtitle}>Generate, view and print student report cards — with progressive term tracking</p>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Generate Section */}
                <div style={styles.genCard}>
                    <h3 style={{ color:'#1F3864', margin:'0 0 12px 0', fontSize:'16px' }}>⚡ Generate Report Cards</h3>
                    <div style={styles.genTabs}>
                        <button onClick={() => setGenMode('class')} style={{ ...styles.genTab, backgroundColor:genMode==='class'?'#1F3864':'white', color:genMode==='class'?'white':'#1F3864' }}>🏫 Per Class (Bulk)</button>
                        <button onClick={() => setGenMode('student')} style={{ ...styles.genTab, backgroundColor:genMode==='student'?'#1F3864':'white', color:genMode==='student'?'white':'#1F3864' }}>👤 Per Student</button>
                    </div>

                    <div style={styles.formRow}>
                        <div style={{ flex:1 }}>
                            <label style={styles.label}>📝 Exam</label>
                            <select style={styles.input} value={genExam} onChange={e => setGenExam(e.target.value)}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(ex => <option key={ex.examId} value={ex.examId}>{ex.examName} — Term {ex.term} {ex.academicYear}</option>)}
                            </select>
                        </div>

                        {genMode === 'class' && (
                            <div style={{ flex:1 }}>
                                <label style={styles.label}>🏫 Class</label>
                                <select style={styles.input} value={genClassId} onChange={e => setGenClassId(e.target.value)}>
                                    <option value="">-- Select Class --</option>
                                    {sections.map(sec => (
                                        <optgroup key={sec.value} label={sec.label}>
                                            {classes.filter(c => c.section === sec.value).map(cls => (
                                                <option key={cls.classId} value={cls.classId}>{cls.className}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        )}

                        {genMode === 'student' && (
                            <div style={{ flex:1 }}>
                                <label style={styles.label}>👤 Student</label>
                                <select style={styles.input} value={genStudent} onChange={e => setGenStudent(e.target.value)}>
                                    <option value="">-- Select Student --</option>
                                    {students.sort((a,b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`)).map(s => (
                                        <option key={s.studentId} value={s.studentId}>{s.firstName} {s.lastName} — {s.className} ({s.admissionNumber})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ display:'flex', alignItems:'flex-end' }}>
                            {genMode === 'class' ? (
                                <button onClick={handleGenerateClass} style={styles.generateBtn} disabled={generating || !genClassId || !genExam}>
                                    {generating ? '⏳ Generating...' : `⚡ Generate${classStudentsCount > 0 ? ` (${classStudentsCount} students)` : ''}`}
                                </button>
                            ) : (
                                <button onClick={handleGenerateStudent} style={styles.generateBtn} disabled={generating || !genStudent || !genExam}>
                                    {generating ? '⏳ Generating...' : '⚡ Generate'}
                                </button>
                            )}
                        </div>
                    </div>

                    {bulkProgress && (
                        <div style={{ marginTop:'12px' }}>
                            <div style={{ height:'8px', backgroundColor:'#e9ecef', borderRadius:'4px', overflow:'hidden', marginBottom:'4px' }}>
                                <div style={{ height:'100%', backgroundColor:'#28a745', width:`${(bulkProgress.done/bulkProgress.total)*100}%`, transition:'width 0.3s' }} />
                            </div>
                            <p style={{ fontSize:'12px', color:'#666', margin:0 }}>{bulkProgress.done}/{bulkProgress.total} — ✅ {bulkProgress.success}{bulkProgress.failed > 0 && ` ❌ ${bulkProgress.failed}`}</p>
                        </div>
                    )}
                </div>

                {/* Edit Form */}
                {editingCard && (
                    <div style={styles.editCard}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px' }}>
                            <h3 style={{ color:'#2E75B6', margin:0 }}>✏️ Edit — {editingCard.student?.firstName} {editingCard.student?.lastName}</h3>
                            <button onClick={() => setEditingCard(null)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#999' }}>✕</button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div style={styles.formRow}>
                                <div style={{ flex:1 }}>
                                    <label style={styles.label}>Term Rank</label>
                                    <input type="number" style={styles.input} value={editForm.termRank}
                                        onChange={e => setEditForm({...editForm, termRank:e.target.value})} placeholder="e.g. 5" />
                                </div>
                                <div style={{ flex:2 }}>
                                    <label style={styles.label}>Remarks</label>
                                    <input style={styles.input} value={editForm.Remarks}
                                        onChange={e => setEditForm({...editForm, Remarks:e.target.value})} placeholder="General remarks" />
                                </div>
                            </div>
                            <div style={styles.formRow}>
                                <div style={{ flex:1 }}>
                                    <label style={styles.label}>Teacher Comment</label>
                                    <input style={styles.input} value={editForm.teacherComment}
                                        onChange={e => setEditForm({...editForm, teacherComment:e.target.value})} placeholder="Class teacher's comment" />
                                </div>
                                <div style={{ flex:1 }}>
                                    <label style={styles.label}>Principal Comment</label>
                                    <input style={styles.input} value={editForm.principalComment}
                                        onChange={e => setEditForm({...editForm, principalComment:e.target.value})} placeholder="Principal's comment" />
                                </div>
                            </div>
                            <div style={{ display:'flex', gap:'10px', marginTop:'5px' }}>
                                <button type="submit" style={styles.submitBtn}>✅ Update</button>
                                <button type="button" onClick={() => setEditingCard(null)} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Class Tiles */}
                {!loading && classTiles.length > 0 && (
                    <div style={{ marginBottom:'25px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                            <h3 style={{ color:'#1F3864', margin:0 }}>🏫 Classes with Report Cards</h3>
                            <div style={{ display:'flex', gap:'8px' }}>
                                <button onClick={() => { setSelectedClassFilter(''); setView('list'); }} style={{ ...styles.viewBtn, backgroundColor: view==='list' && !selectedClassFilter ? '#1F3864' : 'white', color: view==='list' && !selectedClassFilter ? 'white' : '#1F3864' }}>📋 All</button>
                            </div>
                        </div>
                        <div style={styles.classTilesGrid}>
                            {classTiles.map((cls, i) => {
                                const color = sectionColor(cls.section);
                                const avg = cls.avgCount > 0 ? (cls.avgSum / cls.avgCount).toFixed(1) : null;
                                const isSelected = selectedClassFilter === cls.className;
                                return (
                                    <div key={i} onClick={() => { setSelectedClassFilter(isSelected ? '' : cls.className); setView('list'); }}
                                        onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform='none'}
                                        style={{ ...styles.classTile, borderTop:`4px solid ${color}`, outline: isSelected ? `3px solid ${color}` : 'none' }}>
                                        <div style={{ ...styles.classTileName, color }}>{cls.className}</div>
                                        <div style={styles.classTileStats}>
                                            <div style={styles.classTileStat}>
                                                <span style={styles.classTileNum}>{cls.count}</span>
                                                <span style={styles.classTileLbl}>Cards</span>
                                            </div>
                                            <div style={styles.classDivider} />
                                            <div style={styles.classTileStat}>
                                                <span style={styles.classTileNum}>{cls.exams.size}</span>
                                                <span style={styles.classTileLbl}>Exams</span>
                                            </div>
                                            {avg && <>
                                                <div style={styles.classDivider} />
                                                <div style={styles.classTileStat}>
                                                    <span style={{ ...styles.classTileNum, color: avg >= 55 ? '#28a745' : '#dc3545', fontSize:'14px' }}>{avg}%</span>
                                                    <span style={styles.classTileLbl}>Avg</span>
                                                </div>
                                            </>}
                                        </div>
                                        <div style={{ ...styles.classTileAction, backgroundColor: color }}>
                                            {isSelected ? 'Viewing ✓' : 'View Cards →'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Filters + Table — only shown when a class tile is selected */}
                {selectedClassFilter ? (
                <>
                <div style={styles.filterRow}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
                        <span style={{ backgroundColor: sectionColor(classTiles.find(c=>c.className===selectedClassFilter)?.section), color:'white', padding:'5px 12px', borderRadius:'20px', fontWeight:'bold', fontSize:'13px' }}>
                            🏫 {selectedClassFilter}
                        </span>
                        <button onClick={() => setSelectedClassFilter('')} style={{ backgroundColor:'#6c757d', color:'white', border:'none', padding:'5px 10px', borderRadius:'5px', cursor:'pointer', fontSize:'12px' }}>✕ Close</button>
                    </div>
                    <input style={styles.searchInput} placeholder="🔍 Search student..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <select style={styles.filterSelect} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                        <option value="">All Exams</option>
                        {exams.map(ex => <option key={ex.examId} value={ex.examId}>{ex.examName}</option>)}
                    </select>
                    <button onClick={() => { setSearch(''); setFilterExam(''); }} style={styles.clearBtn}>✕ Clear</button>
                    <span style={{ color:'#666', fontSize:'13px', alignSelf:'center' }}>{filtered.length} card(s)</span>
                </div>

                {/* Table */}
                {loading ? <p style={{ textAlign:'center', padding:'40px', color:'#666' }}>⏳ Loading...</p> : filtered.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={{ fontSize:'48px', marginBottom:'15px' }}>📋</div>
                        <h3>No Report Cards Found</h3>
                        <p style={{ color:'#666' }}>Generate report cards using the form above</p>
                    </div>
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
                                    <th style={styles.th}>Grade</th>
                                    <th style={styles.th}>Term Rank</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((card, index) => {
                                    const avg = card.averageMarks || 0;
                                    const gl = gradeLabel(avg);
                                    const gc = gradeColor(avg);
                                    const isPrinting = printing === card.reportId;
                                    return (
                                        <tr key={card.reportId} style={index%2===0?styles.trEven:styles.trOdd}>
                                            <td style={styles.td}>{index+1}</td>
                                            <td style={styles.td}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                            <td style={styles.td}><span style={styles.admNo}>{card.student?.admissionNumber||'—'}</span></td>
                                            <td style={styles.td}>{card.student?.className}</td>
                                            <td style={styles.td}><span style={styles.examBadge}>{card.exam?.examName}</span></td>
                                            <td style={styles.td}><strong>{card.totalMarks}</strong></td>
                                            <td style={styles.td}><span style={{ color:gc, fontWeight:'bold' }}>{avg.toFixed(1)}%</span></td>
                                            <td style={styles.td}><span style={{ backgroundColor:gc, color:'white', padding:'3px 8px', borderRadius:'3px', fontWeight:'bold', fontSize:'12px' }}>{gl}</span></td>
                                            <td style={styles.td}>{card.termRank||'—'}</td>
                                            <td style={styles.td}>
                                                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                                                    <button onClick={() => handleEdit(card)} style={styles.editBtn}>✏️</button>
                                                    <button onClick={() => handlePrintCard(card)} style={styles.printBtn} disabled={isPrinting}>
                                                        {isPrinting ? '⏳' : '🖨️'}
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(card)} style={styles.deleteBtn}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                </>
                ) : !loading && classTiles.length > 0 ? (
                    <div style={{ backgroundColor:'white', padding:'30px', borderRadius:'10px', textAlign:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.08)', color:'#888' }}>
                        <div style={{ fontSize:'36px', marginBottom:'10px' }}>👆</div>
                        <p style={{ fontSize:'14px', margin:0 }}>Click a class tile above to view its report cards</p>
                    </div>
                ) : loading ? (
                    <p style={{ textAlign:'center', padding:'40px', color:'#666' }}>⏳ Loading...</p>
                ) : null}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
                    <div style={{ backgroundColor:'white', padding:'25px 30px', borderRadius:'10px', maxWidth:'380px', width:'90%', boxShadow:'0 10px 30px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ color:'#dc3545', margin:'0 0 12px 0' }}>🗑️ Delete Report Card?</h3>
                        <p style={{ color:'#555', marginBottom:'20px' }}>
                            Delete report card for <strong>{deleteConfirm.student?.firstName} {deleteConfirm.student?.lastName}</strong> — {deleteConfirm.exam?.examName}? This cannot be undone.
                        </p>
                        <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
                            <button onClick={() => setDeleteConfirm(null)} style={styles.cancelBtn}>Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm.reportId)} style={{ ...styles.cancelBtn, backgroundColor:'#dc3545' }}>🗑️ Delete</button>
                        </div>
                    </div>
                </div>
            )}
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
    title: { color:'#1F3864', margin:'0 0 5px 0', fontSize:'24px' },
    subtitle: { color:'#666', margin:'0 0 20px 0', fontSize:'14px' },
    error: { color:'red', padding:'10px', backgroundColor:'#fff3f3', borderRadius:'5px', marginBottom:'15px' },
    success: { color:'#155724', padding:'10px', backgroundColor:'#d4edda', borderRadius:'5px', marginBottom:'15px' },
    genCard: { backgroundColor:'white', padding:'20px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    genTabs: { display:'flex', gap:'10px', marginBottom:'15px', flexWrap:'wrap' },
    genTab: { padding:'9px 18px', borderRadius:'5px', border:'2px solid #1F3864', cursor:'pointer', fontWeight:'bold', fontSize:'13px' },
    formRow: { display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'10px' },
    label: { fontWeight:'bold', color:'#1F3864', fontSize:'12px', display:'block', marginBottom:'5px' },
    input: { padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px', width:'100%' },
    generateBtn: { backgroundColor:'#1F3864', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'14px', whiteSpace:'nowrap' },
    editCard: { backgroundColor:'white', padding:'20px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)', border:'2px solid #2E75B6' },
    submitBtn: { backgroundColor:'#2E75B6', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' },
    cancelBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'10px 16px', borderRadius:'5px', cursor:'pointer' },
    classTilesGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'12px' },
    classTile: { backgroundColor:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 6px rgba(0,0,0,0.08)', cursor:'pointer', transition:'transform 0.15s,box-shadow 0.15s', userSelect:'none' },
    classTileName: { fontSize:'20px', fontWeight:'bold', textAlign:'center', padding:'16px 10px 8px' },
    classTileStats: { display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'8px 10px' },
    classTileStat: { display:'flex', flexDirection:'column', alignItems:'center' },
    classTileNum: { fontSize:'18px', fontWeight:'bold', color:'#1F3864' },
    classTileLbl: { fontSize:'9px', color:'#888' },
    classDivider: { width:'1px', height:'28px', backgroundColor:'#eee' },
    classTileAction: { color:'white', textAlign:'center', padding:'7px', fontSize:'11px' },
    viewBtn: { padding:'7px 14px', borderRadius:'5px', border:'2px solid #1F3864', cursor:'pointer', fontWeight:'bold', fontSize:'12px' },
    filterRow: { display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' },
    searchInput: { flex:2, padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px', minWidth:'180px' },
    filterSelect: { flex:1, padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px', minWidth:'150px' },
    clearBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'10px 15px', borderRadius:'5px', cursor:'pointer' },
    tableWrapper: { overflowX:'auto', borderRadius:'10px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    table: { width:'100%', borderCollapse:'collapse', backgroundColor:'white', minWidth:'800px' },
    tableHeader: { backgroundColor:'#1F3864' },
    th: { color:'white', padding:'12px 15px', textAlign:'left', whiteSpace:'nowrap', fontSize:'13px' },
    td: { padding:'10px 15px', borderBottom:'1px solid #eee', fontSize:'13px' },
    trEven: { backgroundColor:'#f9f9f9' },
    trOdd: { backgroundColor:'white' },
    editBtn: { backgroundColor:'#2E75B6', color:'white', border:'none', padding:'5px 8px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    printBtn: { backgroundColor:'#28a745', color:'white', border:'none', padding:'5px 8px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    deleteBtn: { backgroundColor:'#dc3545', color:'white', border:'none', padding:'5px 8px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    admNo: { backgroundColor:'#e3f2fd', color:'#1F3864', padding:'2px 6px', borderRadius:'3px', fontSize:'11px', fontFamily:'monospace' },
    examBadge: { backgroundColor:'#fff3cd', color:'#856404', padding:'2px 8px', borderRadius:'3px', fontSize:'12px', fontWeight:'bold' },
    emptyState: { backgroundColor:'white', padding:'60px', borderRadius:'10px', textAlign:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
};

export default ReportCards;