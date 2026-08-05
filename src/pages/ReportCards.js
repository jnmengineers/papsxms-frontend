import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import { classDisplayName, classPrintLabel, classShortCode, streamLabel } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const gradeLabel = (m) => m >= 75 ? 'EE' : m >= 55 ? 'ME' : m >= 40 ? 'AE' : 'BE';
const gradeColor = (m) => m >= 75 ? '#28a745' : m >= 55 ? '#2E75B6' : m >= 40 ? '#ffc107' : '#dc3545';
const gradeRemarks = (m) => m >= 75 ? 'Exceeding Expectations' : m >= 55 ? 'Meeting Expectations' : m >= 40 ? 'Approaching Expectations' : 'Below Expectations';

const printReportCard = (card, singleResults, progressiveData, allCards) => {
    const student = card.student;
    const exam = card.exam;
    const term = exam?.term;
    const academicYear = exam?.academicYear;

    // progressiveData is pre-anchored server-side to this exam's position
    const termExams = progressiveData?.exams || [];
    const rawSubjects = progressiveData?.subjects || [];
    const isProgressive = termExams.length > 1 && rawSubjects.length > 0;

    const gc = (m) => m >= 75 ? '#28a745' : m >= 55 ? '#2E75B6' : m >= 40 ? '#ffc107' : '#dc3545';
    const gl = (m) => m == null ? '-' : m >= 75 ? 'EE' : m >= 55 ? 'ME' : m >= 40 ? 'AE' : 'BE';
    const badge = (m) => m == null
        ? '<span style="color:#ccc;">-</span>'
        : '<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-weight:bold;font-size:11px;color:white;background:' + gc(m) + ';">' + gl(m) + '</span>';

    const examTypeLabels = { OPENING: 'Opening', MID_TERM: 'Mid Term', END_TERM: 'End Term' };
    const examTypeColors = { OPENING: '#28a745', MID_TERM: '#e07a2f', END_TERM: '#2E75B6' };

    let subjectRows = '';
    let examHeaders = '';
    let examCols = [];
    let colSums = {};
    let colCounts = {};

    if (isProgressive) {
        examCols = termExams.map(e => e.examType).filter(Boolean);
        colSums = { OPENING: 0, MID_TERM: 0, END_TERM: 0 };
        colCounts = { OPENING: 0, MID_TERM: 0, END_TERM: 0 };

        examHeaders = examCols.map(type =>
            '<th style="color:white;padding:6px 8px;text-align:center;background:' + (examTypeColors[type] || '#1F3864') + ';font-size:11px;">' + (examTypeLabels[type] || type) + '</th>'
        ).join('');

        subjectRows = rawSubjects.map((sub, i) => {
            if (sub.opening != null) { colSums.OPENING += sub.opening; colCounts.OPENING++; }
            if (sub.midTerm != null) { colSums.MID_TERM += sub.midTerm; colCounts.MID_TERM++; }
            if (sub.endTerm != null) { colSums.END_TERM += sub.endTerm; colCounts.END_TERM++; }

            const cells = examCols.map(type => {
                const val = type === 'OPENING' ? sub.opening : type === 'MID_TERM' ? sub.midTerm : sub.endTerm;
                return '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">' + badge(val) + '</td>';
            }).join('');

            return '<tr style="background:' + (i % 2 === 0 ? '#f8f9fa' : 'white') + '">'
                + '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;font-size:12px;">' + (i + 1) + '. ' + sub.subjectName + '</td>'
                + cells
                + '</tr>';
        }).join('');
    } else {
        subjectRows = singleResults.map((r, i) => {
            return '<tr style="background:' + (i % 2 === 0 ? '#f8f9fa' : 'white') + '">'
                + '<td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;">' + (i + 1) + '. ' + (r.subject ? r.subject.subjectName : '') + '</td>'
                + '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">' + badge(r.marksObtained) + '</td>'
                + '</tr>';
        }).join('');
    }

    const avgRowHtml = isProgressive
        ? '<tr style="background:#1F3864;">'
            + '<td style="padding:6px 8px;font-weight:bold;color:white;font-size:12px;">Average</td>'
            + examCols.map(type => {
                const avg = colCounts[type] > 0 ? colSums[type] / colCounts[type] : null;
                return '<td style="padding:6px 8px;text-align:center;">' + badge(avg) + '</td>';
            }).join('')
            + '</tr>'
        : '';

    // Overall term average — across every mark visible on this card, regardless of column
    let termAvgSum = 0, termAvgCount = 0;
    if (isProgressive) {
        rawSubjects.forEach(sub => {
            [sub.opening, sub.midTerm, sub.endTerm].forEach(v => { if (v != null) { termAvgSum += v; termAvgCount++; } });
        });
    } else {
        singleResults.forEach(r => { termAvgSum += r.marksObtained; termAvgCount++; });
    }
    const termAvg = termAvgCount > 0 ? termAvgSum / termAvgCount : null;

    const subjectCount = isProgressive ? rawSubjects.length : singleResults.length;
    const overallGrade = isProgressive
        ? gl(termAvgCount > 0 ? termAvgSum / termAvgCount : null)
        : gl(singleResults.length > 0 ? singleResults.reduce((s, r) => s + r.marksObtained, 0) / singleResults.length : null);

    const theadCols = isProgressive
        ? '<th style="color:white;padding:7px 8px;text-align:left;font-size:12px;">SUBJECT</th>' + examHeaders
        : '<th style="color:white;padding:7px 8px;text-align:left;font-size:12px;">SUBJECT</th><th style="color:#FFD700;padding:7px 8px;text-align:center;font-size:12px;">GRADE</th>';

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>Report Card - ' + (student ? student.firstName + ' ' + student.lastName : '') + '</title>'
        + '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Times New Roman",Times,serif;font-size:12px;color:#000;padding:12px;max-width:800px;margin:0 auto;}'
        + '@media print{@page{size:A4;margin:8mm;}.no-print{display:none!important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>'
        + '</head><body>'
        + '<div class="no-print" style="background:#1F3864;color:white;padding:10px 15px;margin-bottom:12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">'
        + '<span style="font-weight:bold;">Report Card - ' + (student ? student.firstName + ' ' + student.lastName : '') + '</span>'
        + '<button onclick="window.print()" style="background:#28a745;color:white;border:none;padding:8px 20px;border-radius:5px;font-weight:bold;cursor:pointer;font-size:14px;">Print / Save PDF</button>'
        + '</div>'
        + '<div style="border-bottom:3px solid #1F3864;padding-bottom:8px;margin-bottom:10px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        + '<img src="/logo1.png" onerror="this.style.display=\'none\'" style="width:55px;height:55px;object-fit:contain;">'
        + '<div style="text-align:center;flex:1;padding:0 10px;">'
        + '<div style="color:#1F3864;font-size:13px;font-weight:bold;text-transform:uppercase;">PIPELINE ADVENTIST PRIMARY &amp; JUNIOR SECONDARY SCHOOL</div>'
        + '<div style="color:#2E75B6;font-style:italic;font-size:11px;margin:2px 0;">Abreast with the Best in Holistic Education</div>'
        + '</div>'
        + '<img src="/logo2.png" onerror="this.style.display=\'none\'" style="width:55px;height:55px;object-fit:contain;">'
        + '</div>'
        + '<div style="background:#1F3864;padding:5px 10px;text-align:center;border-radius:4px;">'
        + '<div style="color:white;font-weight:bold;font-size:13px;">' + (isProgressive ? 'PROGRESSIVE TERM REPORT CARD' : 'REPORT CARD') + '</div>'
        + '<div style="color:#BDD7EE;font-size:10px;">Term ' + term + ' - ' + academicYear + ' - ' + (exam ? exam.examName : '') + '</div>'
        + '</div></div>'
        + '<div style="background:#f8f9fa;padding:8px 12px;border-radius:6px;margin-bottom:10px;border-left:4px solid #1F3864;">'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Student Name:</strong> ' + (student ? student.firstName + ' ' + student.lastName : '-') + '</div>'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Admission No:</strong> ' + (student ? (student.admissionNumber || '-') : '-') + '</div>'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Class:</strong> ' + (student ? (student.className || '-') : '-') + '</div>'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Stream:</strong> ' + (student?.stream ? (student.stream === 'YELLOW' ? 'Yellow' : student.stream === 'BLUE' ? 'Blue' : student.stream === 'RED' ? 'Red' : student.stream) : '-') + '</div>'
        + '</div></div>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;"><thead>'
        + '<tr style="background:#1F3864;">' + theadCols + '</tr>'
        + '</thead><tbody>' + subjectRows + avgRowHtml + '</tbody></table>'
        + '<div style="display:flex;gap:12px;background:#1F3864;padding:10px 12px;border-radius:6px;margin-bottom:10px;">'
        + '<div style="flex:1;text-align:center;"><div style="color:#FFD700;font-size:10px;">Grade</div><div style="color:white;font-size:20px;font-weight:bold;">' + overallGrade + '</div></div>'
        + '<div style="flex:1;text-align:center;"><div style="color:#FFD700;font-size:10px;">Subjects</div><div style="color:white;font-size:20px;font-weight:bold;">' + subjectCount + '</div></div>'
        + '<div style="flex:1;text-align:center;"><div style="color:#FFD700;font-size:10px;">Term Average</div><div style="color:white;font-size:20px;font-weight:bold;">' + gl(termAvg) + '</div></div>'
        + '</div>'
        + '<div style="background:#f8f9fa;padding:6px 10px;border-radius:4px;margin-bottom:10px;font-size:10px;">'
        + '<strong>Grade Key: </strong>'
        + '<span style="color:#28a745;">EE = 75-100 (Exceeding)</span> &nbsp;|&nbsp;'
        + '<span style="color:#2E75B6;">ME = 55-74 (Meeting)</span> &nbsp;|&nbsp;'
        + '<span style="color:#ffc107;">AE = 40-54 (Approaching)</span> &nbsp;|&nbsp;'
        + '<span style="color:#dc3545;">BE = 0-39 (Below Expectations)</span>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'
        + '<div style="border:1px solid #ddd;padding:10px;border-radius:6px;">'
        + '<p style="font-weight:bold;color:#1F3864;margin:0 0 6px 0;font-size:11px;">Class Teacher\'s Comment:</p>'
        + '<p style="margin:0 0 16px 0;min-height:28px;font-size:11px;color:#333;">' + (card.teacherComment || '.................................................................') + '</p>'
        + '<p style="margin:0;color:#666;font-size:10px;">Signature: _________________ Date: _________</p>'
        + '</div>'
        + '<div style="border:1px solid #ddd;padding:10px;border-radius:6px;">'
        + '<p style="font-weight:bold;color:#1F3864;margin:0 0 6px 0;font-size:11px;">Principal\'s Comment:</p>'
        + '<p style="margin:0 0 16px 0;min-height:28px;font-size:11px;color:#333;">' + (card.principalComment || '.................................................................') + '</p>'
        + '<p style="margin:0;color:#666;font-size:10px;">Signature: _________________ Date: _________</p>'
        + '</div></div>'
        + '<p style="text-align:center;font-size:9px;color:#999;border-top:2px solid #1F3864;padding-top:6px;">'
        + 'Pipeline Adventist School - Official Report Card - Issued: ' + new Date().toLocaleDateString()
        + '</p></body></html>';

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    else alert('Please allow popups to print report cards.');
};

function ReportCards() {
    const userRole = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');
    const isTeacher = userRole === 'TEACHER';

    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(null);
    const [printingAll, setPrintingAll] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [search, setSearch] = useState('');
    const [filterExam, setFilterExam] = useState('');
    const [filtered, setFiltered] = useState([]);
    const [genMode, setGenMode] = useState('class');
    const [genExam, setGenExam] = useState('');
    const [genClassId, setGenClassId] = useState(isTeacher && linkedClassId ? linkedClassId : '');
    const [classesWithResults, setClassesWithResults] = useState([]);
    const [genStudent, setGenStudent] = useState('');
    const [bulkProgress, setBulkProgress] = useState(null);
    const [selectedClassFilter, setSelectedClassFilter] = useState('');
    const [editForm, setEditForm] = useState({ termRank: '', Remarks: '', teacherComment: '', principalComment: '' });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997' }
    ];

    const sectionColor = (section) => {
        const colors = { PRE_SCHOOL: '#6f42c1', LOWER_PRIMARY: '#2E75B6', UPPER_PRIMARY: '#fd7e14', JUNIOR_SCHOOL: '#20c997' };
        return colors[section] || '#1F3864';
    };

    useEffect(() => { fetchReportCards(); fetchStudents(); fetchClasses(); fetchExams(); }, []);
    useEffect(() => { fetchClassesWithResults(genExam); }, [genExam]);

    useEffect(() => {
        let data = reportCards.filter(cardBelongsToTeacher);
        if (search) data = data.filter(c =>
            c.student?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            c.student?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            c.student?.admissionNumber?.toLowerCase().includes(search.toLowerCase())
        );
        if (filterExam) data = data.filter(c => String(c.exam?.examId) === String(filterExam));
        if (selectedClassFilter) {
            const [filterCls, filterStr] = selectedClassFilter.split('|');
            data = data.filter(c =>
                (c.student?.className === filterCls || c.student?.schoolClass?.className === filterCls) &&
                (!filterStr || (c.student?.stream || c.student?.schoolClass?.stream) === filterStr)
            );
        }
        setFiltered(data);
    }, [search, filterExam, selectedClassFilter, reportCards, classes]);

    const fetchReportCards = async () => {
        try {
            const r = await api.get('/api/reportCards');
            setReportCards(r.data); setFiltered(r.data); setLoading(false);
        }
        catch (e) { setError('Failed to load report cards'); setLoading(false); }
    };

    // Returns true if a report card belongs to the logged-in teacher's class.
    // Uses the classes array (from API) so className/stream are always in the right format.
    const cardBelongsToTeacher = (card) => {
        if (!isTeacher || !linkedClassId) return true;
        if (String(card.student?.schoolClass?.classId) === String(linkedClassId)) return true;
        const teacherClassObj = classes.find(c => String(c.classId) === String(linkedClassId));
        if (!teacherClassObj) return false;
        if (card.student?.className !== teacherClassObj.className) return false;
        if (!teacherClassObj.stream) return true;
        return card.student?.stream === teacherClassObj.stream ||
               card.student?.schoolClass?.stream === teacherClassObj.stream;
    };
    const fetchStudents = async () => { try { const r = await api.get('/api/students'); setStudents(r.data); } catch (e) {} };
    const fetchClasses = async () => { try { const r = await api.get('/api/classes'); setClasses(r.data); } catch (e) {} };
    const fetchExams = async () => { try { const r = await api.get('/api/exams'); setExams(r.data); } catch (e) {} };

    const fetchClassesWithResults = async (examId) => {
        if (!examId) { setClassesWithResults([]); return; }
        try {
            const r = await api.get('/api/results');
            const data = r.data.filter(res => String(res.exam?.examId) === String(examId));
            // schoolClass.classId is null in API — match classes by className+stream instead
            const classKeys = [...new Set(data.map(res => {
                const cn = res.student?.className;
                const st = res.student?.stream || res.student?.schoolClass?.stream;
                return cn ? (st ? cn + '|' + st : cn) : null;
            }).filter(Boolean))];
            setClassesWithResults(classKeys);
        } catch(e) {}
    };

    const getServerError = (err) => {
        const data = err.response?.data;
        if (typeof data === 'string' && data.length < 300) return data;
        if (data?.message) return data.message;
        if (data?.error) return data.error;
        if (err.response?.status === 400) return 'Bad request — check that results exist for this student and exam.';
        if (err.response?.status === 409) return 'Report card already exists for this student and exam.';
        return 'Request failed. Make sure marks have been entered for this student first.';
    };

    const handleGenerateStudent = async (e) => {
        e.preventDefault();
        if (!genStudent || !genExam) { setError('Select both student and exam'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        try {
            await api.post('/api/reportCards/generate/student/' + genStudent + '/exam/' + genExam);
            setSuccessMsg('Report card generated!');
            setGenStudent(''); fetchReportCards();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError(getServerError(err)); }
        setGenerating(false);
    };

    const handleGenerateClass = async () => {
        if (!genClassId || !genExam) { setError('Select both class and exam'); return; }
        const classStudents = students.filter(s => String(s.schoolClass?.classId) === String(genClassId));
        if (!classStudents.length) { setError('No students found in this class'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        let success = 0;
        const failedStudents = [];
        setBulkProgress({ done: 0, total: classStudents.length, success: 0, failed: 0 });
        for (let i = 0; i < classStudents.length; i++) {
            try {
                await api.post('/api/reportCards/generate/student/' + classStudents[i].studentId + '/exam/' + genExam);
                success++;
            } catch (err) {
                failedStudents.push({
                    name: `${classStudents[i].firstName} ${classStudents[i].lastName}`,
                    reason: getServerError(err),
                });
            }
            setBulkProgress({ done: i + 1, total: classStudents.length, success, failed: failedStudents.length });
        }
        setGenerating(false);
        setBulkProgress(null);
        fetchReportCards();
        if (failedStudents.length === 0) {
            setSuccessMsg(`✅ All ${success} report cards generated successfully!`);
            setTimeout(() => setSuccessMsg(''), 5000);
        } else {
            const failList = failedStudents.map(f => `• ${f.name}: ${f.reason}`).join('\n');
            setError(`⚠️ ${success} generated, ${failedStudents.length} failed:\n${failList}`);
            if (success > 0) {
                setSuccessMsg(`✅ ${success} report card(s) generated.`);
                setTimeout(() => setSuccessMsg(''), 5000);
            }
        }
    };

    const handleEdit = (card) => {
        setEditingCard(card);
        setEditForm({ termRank: card.termRank || '', Remarks: card.Remarks || '', teacherComment: card.teacherComment || '', principalComment: card.principalComment || '' });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put('/api/reportCards/' + editingCard.reportId, {
                totalMarks: editingCard.totalMarks, averageMarks: editingCard.averageMarks,
                termRank: editForm.termRank !== '' ? parseInt(editForm.termRank) : null,
                Remarks: editForm.Remarks, teacherComment: editForm.teacherComment,
                principalComment: editForm.principalComment
            });
            setSuccessMsg('Updated!'); setEditingCard(null); fetchReportCards();
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (e) { setError('Failed to update'); }
    };

    const handlePrintCard = async (card) => {
        setPrinting(card.reportId);
        try {
            const resultsRes = await api.get('/api/results/student/' + card.student?.studentId + '/exam/' + card.exam?.examId);
            const singleResults = resultsRes.data;
            let progressiveData = null;
            try {
                const term = card.exam?.term;
                const year = card.exam?.academicYear;
                if (term && year) {
                    const progRes = await api.get('/api/results/progressive/student/' + card.student?.studentId + '/upto-exam/' + card.exam?.examId);
                    progressiveData = progRes.data;
                }
            } catch (e) {}
            printReportCard(card, singleResults, progressiveData, reportCards);
        } catch (e) { setError('Failed to load results for printing'); }
        setPrinting(null);
    };



    const handlePrintAll = async () => {
        if (!filtered.length) return;
        setPrintingAll(true); setError('');
        const allPages = [];
        for (const card of filtered) {
            try {
                const resultsRes = await api.get('/api/results/student/' + card.student?.studentId + '/exam/' + card.exam?.examId);
                const singleResults = resultsRes.data;
                let progressiveData = null;
                try {
                    const pr = await api.get('/api/results/progressive/student/' + card.student?.studentId + '/upto-exam/' + card.exam?.examId);
                    progressiveData = pr.data;
                } catch(e) {}
                const student = card.student; const exam = card.exam;
                const term = exam?.term; const academicYear = exam?.academicYear;
                const termExams = progressiveData?.exams || [];
                const rawSubjects = progressiveData?.subjects || [];
                const isProgressive = termExams.length > 1 && rawSubjects.length > 0;
                const gc=(m)=>m>=75?'#28a745':m>=55?'#2E75B6':m>=40?'#ffc107':'#dc3545';
                const gl=(m)=>m==null?'-':m>=75?'EE':m>=55?'ME':m>=40?'AE':'BE';
                const badge=(m)=>m==null?'<span style="color:#ccc;">-</span>':'<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-weight:bold;font-size:11px;color:white;background:'+gc(m)+';">'+gl(m)+'</span>';
                let subjectRows=''; let examCols=[]; let colSums={}; let colCounts={};
                if (isProgressive) {
                    const etl={OPENING:'Opening',MID_TERM:'Mid Term',END_TERM:'End Term'};
                    const etc={OPENING:'#28a745',MID_TERM:'#e07a2f',END_TERM:'#2E75B6'};
                    examCols=termExams.map(e=>e.examType).filter(Boolean);
                    colSums={OPENING:0,MID_TERM:0,END_TERM:0}; colCounts={OPENING:0,MID_TERM:0,END_TERM:0};
                    subjectRows=rawSubjects.map((sub,i)=>{
                        if(sub.opening!=null){colSums.OPENING+=sub.opening;colCounts.OPENING++;}
                        if(sub.midTerm!=null){colSums.MID_TERM+=sub.midTerm;colCounts.MID_TERM++;}
                        if(sub.endTerm!=null){colSums.END_TERM+=sub.endTerm;colCounts.END_TERM++;}
                        const cells=examCols.map(type=>{
                            const val=type==='OPENING'?sub.opening:type==='MID_TERM'?sub.midTerm:sub.endTerm;
                            return '<td style="padding:6px;border:1px solid #ddd;text-align:center;">'+badge(val)+'</td>';
                        }).join('');
                        return '<tr style="background:'+(i%2===0?'#f8f9fa':'white')+'"><td style="padding:6px;border:1px solid #ddd;font-size:12px;">'+(i+1)+'. '+sub.subjectName+'</td>'+cells+'</tr>';
                    }).join('');
                } else {
                    subjectRows = singleResults.map((r,i) =>
                        '<tr style="background:'+(i%2===0?'#f8f9fa':'white')+'"><td style="padding:6px;border:1px solid #ddd;font-size:12px;">'+(i+1)+'. '+(r.subject?r.subject.subjectName:'')+'</td><td style="padding:6px;border:1px solid #ddd;text-align:center;">'+badge(r.marksObtained)+'</td></tr>'
                    ).join('');
                }
                const avgRowHtml = isProgressive
                    ? '<tr style="background:#1F3864;"><td style="padding:6px;font-weight:bold;color:white;font-size:12px;">Average</td>'
                        + examCols.map(type=>{const avg=colCounts[type]>0?colSums[type]/colCounts[type]:null;return '<td style="padding:6px;text-align:center;">'+badge(avg)+'</td>';}).join('')
                        + '</tr>'
                    : '';
                let termAvgSum=0, termAvgCount=0;
                if (isProgressive) {
                    rawSubjects.forEach(sub=>{[sub.opening,sub.midTerm,sub.endTerm].forEach(v=>{if(v!=null){termAvgSum+=v;termAvgCount++;}});});
                } else {
                    singleResults.forEach(r=>{termAvgSum+=r.marksObtained;termAvgCount++;});
                }
                const termAvg = termAvgCount>0 ? termAvgSum/termAvgCount : null;
                const subjectCount = isProgressive ? rawSubjects.length : singleResults.length;
                const overallGrade = gl(termAvg);
                const stStream=student?.stream?(student.stream==='YELLOW'?'Yellow':student.stream==='BLUE'?'Blue':student.stream==='RED'?'Red':student.stream):'-';
                const theadCols = isProgressive
                    ? '<th style="color:white;padding:6px;font-size:11px;text-align:left;">SUBJECT</th>'+examCols.map(type=>{const etl={OPENING:'Opening',MID_TERM:'Mid Term',END_TERM:'End Term'};const etc={OPENING:'#28a745',MID_TERM:'#e07a2f',END_TERM:'#2E75B6'};return '<th style="color:white;padding:6px;font-size:11px;text-align:center;background:'+(etc[type]||'#1F3864')+';">'+(etl[type]||type)+'</th>';}).join('')
                    : '<th style="color:white;padding:6px;font-size:11px;text-align:left;">SUBJECT</th><th style="color:#FFD700;padding:6px;font-size:11px;text-align:center;">GRADE</th>';
                allPages.push(
                    '<div style="page-break-after:always;padding:12px;max-width:780px;margin:0 auto;">'
                    +'<div style="border-bottom:3px solid #1F3864;padding-bottom:8px;margin-bottom:10px;text-align:center;">'
                    +'<div style="color:#1F3864;font-size:13px;font-weight:bold;text-transform:uppercase;">PIPELINE ADVENTIST PRIMARY &amp; JUNIOR SECONDARY SCHOOL</div>'
                    +'<div style="color:#2E75B6;font-style:italic;font-size:11px;margin:2px 0;">Abreast with the Best in Holistic Education</div>'
                    +'<div style="background:#1F3864;padding:5px 12px;text-align:center;border-radius:4px;margin-top:6px;">'
                    +'<div style="color:white;font-weight:bold;font-size:13px;">'+(isProgressive?'PROGRESSIVE TERM REPORT CARD':'REPORT CARD')+'</div>'
                    +'<div style="color:#BDD7EE;font-size:11px;">Term '+term+' - '+academicYear+' - '+(exam?exam.examName:'')+'</div>'
                    +'</div></div>'
                    +'<div style="background:#f8f9fa;padding:8px;border-radius:6px;margin-bottom:10px;border-left:4px solid #1F3864;">'
                    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">'
                    +'<div style="font-size:11px;"><strong style="color:#1F3864;">Student Name:</strong> '+(student?student.firstName+' '+student.lastName:'-')+'</div>'
                    +'<div style="font-size:11px;"><strong style="color:#1F3864;">Admission No:</strong> '+(student?(student.admissionNumber||'-'):'-')+'</div>'
                    +'<div style="font-size:11px;"><strong style="color:#1F3864;">Class:</strong> '+(student?(student.className||'-'):'-')+'</div>'
                    +'<div style="font-size:11px;"><strong style="color:#1F3864;">Stream:</strong> '+stStream+'</div>'
                    +'</div></div>'
                    +'<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">'
                    +'<thead><tr style="background:#1F3864;">'+theadCols+'</tr></thead><tbody>'+subjectRows+avgRowHtml+'</tbody></table>'
                    +'<div style="display:flex;gap:10px;background:#1F3864;padding:8px;border-radius:6px;margin-bottom:10px;">'
                    +'<div style="flex:1;text-align:center;"><div style="color:#FFD700;font-size:10px;">Grade</div><div style="color:white;font-size:18px;font-weight:bold;">'+overallGrade+'</div></div>'
                    +'<div style="flex:1;text-align:center;"><div style="color:#FFD700;font-size:10px;">Subjects</div><div style="color:white;font-size:18px;font-weight:bold;">'+subjectCount+'</div></div>'
                    +'<div style="flex:1;text-align:center;"><div style="color:#FFD700;font-size:10px;">Term Average</div><div style="color:white;font-size:18px;font-weight:bold;">'+gl(termAvg)+'</div></div>'
                    +'</div>'
                    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">'
                    +'<div style="border:1px solid #ddd;padding:10px;border-radius:6px;"><p style="font-weight:bold;color:#1F3864;margin:0 0 6px 0;font-size:11px;">Class Teacher Comment:</p><p style="margin:0 0 16px 0;min-height:26px;font-size:11px;color:#333;">'+(card.teacherComment||'.................................................')+'</p><p style="margin:0;color:#666;font-size:10px;">Signature: _____________ Date: _________</p></div>'
                    +'<div style="border:1px solid #ddd;padding:10px;border-radius:6px;"><p style="font-weight:bold;color:#1F3864;margin:0 0 6px 0;font-size:11px;">Principal Comment:</p><p style="margin:0 0 16px 0;min-height:26px;font-size:11px;color:#333;">'+(card.principalComment||'.................................................')+'</p><p style="margin:0;color:#666;font-size:10px;">Signature: _____________ Date: _________</p></div>'
                    +'</div>'
                    +'<p style="text-align:center;font-size:9px;color:#999;border-top:2px solid #1F3864;padding-top:6px;">Pipeline Adventist School - Official Report Card - Issued: '+new Date().toLocaleDateString()+'</p>'
                    +'</div>'
                );
            } catch(e) { console.error('Failed card:', card.reportId, e); }
        }
        if (!allPages.length) { alert('No report cards could be loaded.'); setPrintingAll(false); return; }
        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bulk Report Cards</title>'
            +'<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Times New Roman",Times,serif;font-size:12px;color:#000;}'
            +'.no-print{background:#1F3864;color:white;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:999;}'
            +'@media print{@page{size:A4;margin:8mm;}.no-print{display:none!important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
            +'div[style*="page-break-after"]:last-child{page-break-after:avoid!important;}}'
            +'</style></head>'
            +'<body>'
            +'<div class="no-print"><span style="font-weight:bold;">Bulk Print - '+allPages.length+' Report Card(s)</span>'
            +'<button onclick="window.print()" style="background:#FFD700;color:#1F3864;border:none;padding:8px 20px;border-radius:5px;font-weight:bold;cursor:pointer;font-size:14px;">Print All / Save PDF</button></div>'
            +allPages.join('')+'</body></html>';
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); win.focus(); }
        else alert('Please allow popups to print.');
        setPrintingAll(false);
    };
    const handleDelete = async (id) => {
        try { await api.delete('/api/reportCards/' + id); fetchReportCards(); setDeleteConfirm(null); }
        catch (e) { setError('Failed to delete'); }
    };

    const handleDeleteAll = async () => {
    try {
        await Promise.all(filtered.map(card => api.delete('/api/reportCards/' + card.reportId)));
        setSuccessMsg(`✅ ${filtered.length} report cards deleted`);
        setDeleteAllConfirm(false);
        fetchReportCards();
        setTimeout(() => setSuccessMsg(''), 3000);
    } catch(e) { setError('Failed to delete all report cards'); }
    };

    const classTilesData = () => {
        const map = {};
        reportCards.filter(cardBelongsToTeacher).forEach(card => {
            const cls = card.student?.className || card.student?.schoolClass?.className;
            const stream = card.student?.stream || card.student?.schoolClass?.stream || null;
            const section = card.student?.schoolClass?.section || '';
            if (!cls) return;
            const key = stream ? cls + '|' + stream : cls;
            if (!map[key]) map[key] = { className: cls, stream, section, count: 0, exams: new Set(), avgSum: 0, avgCount: 0 };
            map[key].count++;
            if (card.exam?.examId) map[key].exams.add(card.exam.examId);
            if (card.averageMarks) { map[key].avgSum += card.averageMarks; map[key].avgCount++; }
        });
        return Object.values(map).sort((a, b) => a.className.localeCompare(b.className) || (a.stream||'').localeCompare(b.stream||''));
    };

    const classStudentsCount = students.filter(s => String(s.schoolClass?.classId) === String(genClassId)).length;
    const classTiles = classTilesData();

    return (
        <div style={s.container}>
            <Navbar rightContent={
                <button onClick={() => window.location.href = '/dashboard'} style={{ backgroundColor: 'transparent', color: 'white', border: '1.5px solid rgba(255,255,255,0.4)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' }}>← Dashboard</button>
            } />
            <div style={s.layoutRow}>
                <Sidebar />
                <div style={s.content}>
                <h2 style={s.title}>Report Cards</h2>
                <p style={s.subtitle}>Generate, view and print student report cards with progressive term tracking</p>

                {error && <p style={s.error}>{error}</p>}
                {successMsg && <p style={s.success}>{successMsg}</p>}

                <div style={s.genCard}>
                    <h3 style={{ color: '#1F3864', margin: '0 0 12px 0', fontSize: '16px' }}>Generate Report Cards</h3>
                    <div style={s.genTabs}>
                        <button onClick={() => setGenMode('class')} style={{ ...s.genTab, backgroundColor: genMode === 'class' ? '#1F3864' : 'white', color: genMode === 'class' ? 'white' : '#1F3864' }}>Per Class (Bulk)</button>
                        <button onClick={() => setGenMode('student')} style={{ ...s.genTab, backgroundColor: genMode === 'student' ? '#1F3864' : 'white', color: genMode === 'student' ? 'white' : '#1F3864' }}>Per Student</button>
                    </div>
                    <div style={s.formRow}>
                        <div style={{ flex: 1 }}>
                            <label style={s.label}>Exam</label>
                            <select style={s.input} value={genExam} onChange={e => setGenExam(e.target.value)}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(ex => (
                                    <option key={ex.examId} value={ex.examId}>{ex.examName} - Term {ex.term} {ex.academicYear}</option>
                                ))}
                            </select>
                        </div>
                        {genMode === 'class' && (
                            <div style={{ flex: 1 }}>
                                <label style={s.label}>Class</label>
                                {isTeacher ? (
                                    <input style={{ ...s.input, backgroundColor: '#f8f9fa', color: '#555', cursor: 'not-allowed' }}
                                        value={linkedClassName || 'Your class'} disabled />
                                ) : (
                                    <select style={s.input} value={genClassId} onChange={e => setGenClassId(e.target.value)}>
                                        <option value="">-- Select Class --</option>
                                        {sections.map(sec => (
                                            <optgroup key={sec.value} label={sec.label}>
                                                {classes.filter(cls => {
                                                    if (cls.section !== sec.value) return false;
                                                    if (!genExam || !classesWithResults.length) return true;
                                                    const key = cls.stream ? cls.className + '|' + cls.stream : cls.className;
                                                    return classesWithResults.includes(key);
                                                }).map(cls => (
                                                    <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                        {genMode === 'student' && (
                            <div style={{ flex: 1 }}>
                                <label style={s.label}>Student</label>
                                <select style={s.input} value={genStudent} onChange={e => setGenStudent(e.target.value)}>
                                    <option value="">-- Select Student --</option>
                                    {students
                                        .filter(st => !isTeacher || String(st.schoolClass?.classId) === String(linkedClassId))
                                        .slice().sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName))
                                        .map(st => (
                                            <option key={st.studentId} value={st.studentId}>{st.firstName} {st.lastName} - {st.className} ({st.admissionNumber})</option>
                                        ))}
                                </select>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            {genMode === 'class' ? (
                                <button onClick={handleGenerateClass} style={s.generateBtn} disabled={generating || !genClassId || !genExam}>
                                    {generating ? 'Generating...' : 'Generate' + (classStudentsCount > 0 ? ' (' + classStudentsCount + ' students)' : '')}
                                </button>
                            ) : (
                                <button onClick={handleGenerateStudent} style={s.generateBtn} disabled={generating || !genStudent || !genExam}>
                                    {generating ? 'Generating...' : 'Generate'}
                                </button>
                            )}
                        </div>
                    </div>
                    {bulkProgress && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
                                <div style={{ height: '100%', backgroundColor: '#28a745', width: ((bulkProgress.done / bulkProgress.total) * 100) + '%', transition: 'width 0.3s' }} />
                            </div>
                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{bulkProgress.done}/{bulkProgress.total} done</p>
                        </div>
                    )}
                </div>

                {editingCard && (
                    <div style={s.editCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ color: '#2E75B6', margin: 0 }}>Edit: {editingCard.student?.firstName} {editingCard.student?.lastName}</h3>
                            <button onClick={() => setEditingCard(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>X</button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div style={s.formRow}>
                                <div style={{ flex: 1 }}>
                                    <label style={s.label}>Term Rank</label>
                                    <input type="number" style={s.input} value={editForm.termRank} onChange={e => setEditForm({ ...editForm, termRank: e.target.value })} placeholder="e.g. 5" />
                                </div>
                                <div style={{ flex: 2 }}>
                                    <label style={s.label}>Remarks</label>
                                    <input style={s.input} value={editForm.Remarks} onChange={e => setEditForm({ ...editForm, Remarks: e.target.value })} placeholder="General remarks" />
                                </div>
                            </div>
                            <div style={s.formRow}>
                                <div style={{ flex: 1 }}>
                                    <label style={s.label}>Teacher Comment</label>
                                    <input style={s.input} value={editForm.teacherComment} onChange={e => setEditForm({ ...editForm, teacherComment: e.target.value })} placeholder="Class teacher comment" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={s.label}>Principal Comment</label>
                                    <input style={s.input} value={editForm.principalComment} onChange={e => setEditForm({ ...editForm, principalComment: e.target.value })} placeholder="Principal comment" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                <button type="submit" style={s.submitBtn}>Update</button>
                                <button type="button" onClick={() => setEditingCard(null)} style={s.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {!loading && classTiles.length > 0 && (
                    <div style={{ marginBottom: '25px' }}>
                        <h3 style={{ color: '#1F3864', margin: '0 0 12px 0' }}>Classes with Report Cards</h3>
                        <div style={s.classTilesGrid}>
                            {classTiles.map((cls, i) => {
                                const color = sectionColor(cls.section);
                                const avg = cls.avgCount > 0 ? (cls.avgSum / cls.avgCount).toFixed(1) : null;
                                const isSelected = selectedClassFilter === (cls.stream ? cls.className + '|' + cls.stream : cls.className);
                                return (
                                    <div key={i}
                                        onClick={() => setSelectedClassFilter(isSelected ? '' : (cls.stream ? cls.className + '|' + cls.stream : cls.className))}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                                        style={{ ...s.classTile, borderTop: '4px solid ' + color, outline: isSelected ? '3px solid ' + color : 'none' }}>
                                        <div style={{ ...s.classTileName, color }}>{classDisplayName(cls)}</div>
                                        <div style={s.classTileStats}>
                                            <div style={s.classTileStat}>
                                                <span style={s.classTileNum}>{cls.count}</span>
                                                <span style={s.classTileLbl}>Cards</span>
                                            </div>
                                            <div style={s.classDivider} />
                                            <div style={s.classTileStat}>
                                                <span style={s.classTileNum}>{cls.exams.size}</span>
                                                <span style={s.classTileLbl}>Exams</span>
                                            </div>
                                            {avg && (
                                                <React.Fragment>
                                                    <div style={s.classDivider} />
                                                    <div style={s.classTileStat}>
                                                        <span style={{ ...s.classTileNum, color: parseFloat(avg) >= 55 ? '#28a745' : '#dc3545', fontSize: '14px' }}>{avg}%</span>
                                                        <span style={s.classTileLbl}>Avg</span>
                                                    </div>
                                                </React.Fragment>
                                            )}
                                        </div>
                                        <div style={{ ...s.classTileAction, backgroundColor: color }}>
                                            {isSelected ? 'Viewing' : 'View Cards'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {selectedClassFilter ? (
                    <React.Fragment>
                        <div style={s.filterRow}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span style={{ backgroundColor: sectionColor(classTiles.find(c => (c.stream ? c.className + '|' + c.stream : c.className) === selectedClassFilter)?.section), color: 'white', padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' }}>
                                    {selectedClassFilter.replace('|', ' (') + (selectedClassFilter.includes('|') ? ')' : '')}
                                </span>
                                <button onClick={() => setSelectedClassFilter('')} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                            </div>
                            <input style={s.searchInput} placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} />
                            <select style={s.filterSelect} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                                <option value="">All Exams</option>
                                {exams.map(ex => <option key={ex.examId} value={ex.examId}>{ex.examName}</option>)}
                            </select>
                            <button onClick={() => { setSearch(''); setFilterExam(''); }} style={s.clearBtn}>Clear</button>
                            <span style={{ color: '#666', fontSize: '13px', alignSelf: 'center' }}>{filtered.length} card(s)</span>
                            <button onClick={handlePrintAll} disabled={printingAll || !filtered.length} style={{ backgroundColor: printingAll ? '#6c757d' : '#fd7e14', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}>{printingAll ? 'Loading...' : 'Print All (' + filtered.length + ')'}</button>
                            <button onClick={() => setDeleteAllConfirm(true)} 
                                disabled={!filtered.length}
                                style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                🗑️ Delete All ({filtered.length})
                            </button>
                        </div>
                        {loading ? (
                            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</p>
                        ) : filtered.length === 0 ? (
                            <div style={s.emptyState}>
                                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📋</div>
                                <h3>No Report Cards Found</h3>
                                <p style={{ color: '#666' }}>Generate report cards using the form above</p>
                            </div>
                        ) : (
                            <div style={s.tableWrapper}>
                                <table style={s.table}>
                                    <thead>
                                        <tr style={s.tableHeader}>
                                            <th style={s.th}>#</th>
                                            <th style={s.th}>Student</th>
                                            <th style={s.th}>Adm No</th>
                                            <th style={s.th}>Class</th>
                                            <th style={s.th}>Exam</th>
                                            <th style={s.th}>Total</th>
                                            <th style={s.th}>Average</th>
                                            <th style={s.th}>Grade</th>
                                            <th style={s.th}>Term Rank</th>
                                            <th style={s.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((card, index) => {
                                            const avg = card.averageMarks || 0;
                                            const gl = gradeLabel(avg);
                                            const gc = gradeColor(avg);
                                            const isPrinting = printing === card.reportId;
                                            return (
                                                <tr key={card.reportId} style={index % 2 === 0 ? s.trEven : s.trOdd}>
                                                    <td style={s.td}>{index + 1}</td>
                                                    <td style={s.td}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                                    <td style={s.td}><span style={s.admNo}>{card.student?.admissionNumber || '-'}</span></td>
                                                    <td style={s.td}>{card.student?.className}</td>
                                                    <td style={s.td}><span style={s.examBadge}>{card.exam?.examName}</span></td>
                                                    <td style={s.td}><strong>{card.totalMarks}</strong></td>
                                                    <td style={s.td}><span style={{ color: gc, fontWeight: 'bold' }}>{avg.toFixed(1)}%</span></td>
                                                    <td style={s.td}><span style={{ backgroundColor: gc, color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px' }}>{gl}</span></td>
                                                    <td style={s.td}>{card.termRank || '-'}</td>
                                                    <td style={s.td}>
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                            <button onClick={() => handleEdit(card)} style={s.editBtn}>Edit</button>
                                                            <button onClick={() => handlePrintCard(card)} style={s.printBtn} disabled={isPrinting}>
                                                                {isPrinting ? '...' : 'Print'}
                                                            </button>
                                                            <button onClick={() => setDeleteConfirm(card)} style={s.deleteBtn}>Del</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </React.Fragment>
                ) : !loading && classTiles.length > 0 ? (
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', color: '#888' }}>
                        <div style={{ fontSize: '36px', marginBottom: '10px' }}>👆</div>
                        <p style={{ fontSize: '14px', margin: 0 }}>Click a class tile above to view its report cards</p>
                    </div>
                ) : loading ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</p>
                ) : null}

                {deleteConfirm && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '10px', maxWidth: '380px', width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                            <h3 style={{ color: '#dc3545', margin: '0 0 12px 0' }}>Delete Report Card?</h3>
                            <p style={{ color: '#555', marginBottom: '20px' }}>
                                {'Delete report card for '}
                                <strong>{deleteConfirm.student?.firstName} {deleteConfirm.student?.lastName}</strong>
                                {deleteConfirm.exam ? deleteConfirm.exam.examName : ''} - This cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setDeleteConfirm(null)} style={s.cancelBtn}>Cancel</button>
                                <button onClick={() => handleDelete(deleteConfirm.reportId)} style={{ ...s.cancelBtn, backgroundColor: '#dc3545' }}>Delete</button>
                            </div>
                        </div>
                    </div>
                )}

                {deleteAllConfirm && (
                    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 }}>
                        <div style={{ backgroundColor:'white', padding:'25px 30px', borderRadius:'10px', maxWidth:'400px', width:'90%', boxShadow:'0 10px 30px rgba(0,0,0,0.3)' }}>
                            <h3 style={{ color:'#dc3545', margin:'0 0 12px 0' }}>🗑️ Delete All Report Cards?</h3>
                            <p style={{ color:'#555', marginBottom:'20px' }}>
                                This will permanently delete <strong>{filtered.length} report cards</strong> for the selected class and exam. This cannot be undone.
                            </p>
                            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
                                <button onClick={() => setDeleteAllConfirm(false)} style={{ backgroundColor:'#6c757d', color:'white', border:'none', padding:'9px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' }}>Cancel</button>
                                <button onClick={handleDeleteAll} style={{ backgroundColor:'#dc3545', color:'white', border:'none', padding:'9px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' }}>🗑️ Delete All</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
    );
}

const s = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow:{display: 'flex'},
    navbar: { backgroundColor: '#1F3864', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
    navTitle: { color: 'white', margin: 0, fontSize: '18px' },
    navRight: { display: 'flex', gap: '10px' },
    navBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: 'clamp(15px,3vw,30px)' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: '0 0 20px 0', fontSize: '14px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px', whiteSpace: 'pre-line' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },
    genCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    genTabs: { display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' },
    genTab: { padding: '9px 18px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '12px', display: 'block', marginBottom: '5px' },
    input: { padding: '10px', borderRadius: '5px', border: '1.5px solid #ddd', fontSize: '14px', width: '100%' },
    generateBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' },
    editCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid #2E75B6' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '5px', cursor: 'pointer' },
    classTilesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px' },
    classTile: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'transform 0.15s', userSelect: 'none' },
    classTileName: { fontSize: '20px', fontWeight: 'bold', textAlign: 'center', padding: '16px 10px 8px' },
    classTileStats: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 10px' },
    classTileStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    classTileNum: { fontSize: '18px', fontWeight: 'bold', color: '#1F3864' },
    classTileLbl: { fontSize: '9px', color: '#888' },
    classDivider: { width: '1px', height: '28px', backgroundColor: '#eee' },
    classTileAction: { color: 'white', textAlign: 'center', padding: '7px', fontSize: '11px' },
    filterRow: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' },
    searchInput: { flex: 2, padding: '10px', borderRadius: '5px', border: '1.5px solid #ddd', fontSize: '14px', minWidth: '180px' },
    filterSelect: { flex: 1, padding: '10px', borderRadius: '5px', border: '1.5px solid #ddd', fontSize: '14px', minWidth: '150px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '800px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '13px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace' },
    examBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
};

export default ReportCards;
