import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import { streamLabel } from '../utils/classUtils';

// Single printable report card
const SingleReportCard = ({ card, results }) => (
    <div style={printStyles.page}>
        <div style={printStyles.header}>
            <div style={printStyles.headerRow}>
                <img src={logo1} alt="Logo 1" style={printStyles.logo} />
                <div style={printStyles.schoolDetails}>
                    <h1 style={printStyles.schoolName}>PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL</h1>
                    <p style={printStyles.motto}>Abreast with the Best in Holistic Education</p>
                    <p style={printStyles.contact}>P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996</p>
                </div>
                <img src={logo2} alt="Logo 2" style={printStyles.logo} />
            </div>
            <h2 style={printStyles.reportTitle}>STUDENT REPORT CARD</h2>
        </div>
        <div style={printStyles.studentInfo}>
            <div style={printStyles.infoRow}>
                <span style={printStyles.infoLabel}>Student Name:</span>
                <span style={printStyles.infoValue}>{card.student?.firstName} {card.student?.lastName}</span>
                <span style={printStyles.infoLabel}>Admission No:</span>
                <span style={printStyles.infoValue}>{card.student?.admissionNumber || '-'}</span>
            </div>
            <div style={printStyles.infoRow}>
                <span style={printStyles.infoLabel}>Class:</span>
                <span style={printStyles.infoValue}>{card.student?.className}</span>
                <span style={printStyles.infoLabel}>Stream:</span>
                <span style={printStyles.infoValue}>{streamLabel(card.student?.stream) || '-'}</span>
            </div>
            <div style={printStyles.infoRow}>
                <span style={printStyles.infoLabel}>Exam:</span>
                <span style={printStyles.infoValue}>{card.exam?.examName}</span>
                <span style={printStyles.infoLabel}>Term:</span>
                <span style={printStyles.infoValue}>Term {card.exam?.term} — {card.exam?.academicYear}</span>
            </div>
        </div>
        <table style={printStyles.table}>
            <thead>
                <tr style={printStyles.tableHeader}>
                    <th style={printStyles.th}>#</th>
                    <th style={printStyles.th}>Subject</th>
                    <th style={printStyles.th}>Marks</th>
                    <th style={printStyles.th}>Max</th>
                    <th style={printStyles.th}>Grade</th>
                    <th style={printStyles.th}>Remarks</th>
                </tr>
            </thead>
            <tbody>
                {results.map((r, i) => (
                    <tr key={r.resultId} style={i % 2 === 0 ? printStyles.trEven : printStyles.trOdd}>
                        <td style={printStyles.td}>{i + 1}</td>
                        <td style={printStyles.td}>{r.subject?.subjectName}</td>
                        <td style={printStyles.td}>{r.marksObtained}</td>
                        <td style={printStyles.td}>{r.maxMarks}</td>
                        <td style={printStyles.td}><strong>{r.grade}</strong></td>
                        <td style={printStyles.td}>{r.remarks}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div style={printStyles.summary}>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Total Marks</span>
                <span style={printStyles.summaryValue}>{card.totalMarks}</span>
            </div>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Average</span>
                <span style={printStyles.summaryValue}>{card.averageMarks?.toFixed(2)}%</span>
            </div>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Class Rank</span>
                <span style={printStyles.summaryValue}>{card.classRank || '-'}</span>
            </div>
            <div style={printStyles.summaryItem}>
                <span style={printStyles.summaryLabel}>Grade Rank</span>
                <span style={printStyles.summaryValue}>{card.termRank || '-'}</span>
            </div>
        </div>
        <div style={printStyles.comments}>
            <div style={printStyles.commentBox}>
                <p style={printStyles.commentLabel}>Class Teacher's Comment:</p>
                <p style={printStyles.commentText}>{card.teacherComment || '................................................................'}</p>
                <p style={printStyles.signatureLine}>Signature: ................................ Date: ................</p>
            </div>
            <div style={printStyles.commentBox}>
                <p style={printStyles.commentLabel}>Principal's Comment:</p>
                <p style={printStyles.commentText}>{card.principalComment || '................................................................'}</p>
                <p style={printStyles.signatureLine}>Signature: ................................ Date: ................</p>
            </div>
        </div>
        <div style={printStyles.footer}>
            <img src={logo1} alt="Logo" style={printStyles.footerLogo} />
            <div style={printStyles.footerText}>
                <p>Date Issued: {new Date().toLocaleDateString()}</p>
                <p>Pipeline Adventist School — Official Document</p>
            </div>
            <img src={logo2} alt="Logo" style={printStyles.footerLogo} />
        </div>
    </div>
);

// All report cards printable wrapper
const AllReportCards = React.forwardRef(({ cardsWithResults }, ref) => (
    <div ref={ref}>
        {cardsWithResults.map((item, i) => (
            <div key={i} style={{ pageBreakAfter: 'always' }}>
                <SingleReportCard card={item.card} results={item.results} />
            </div>
        ))}
    </div>
));

function PrintAllReportCards({ examId, classId, className, examName, onClose }) {
    const [cards, setCards] = useState([]);
    const [cardsWithResults, setCardsWithResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [preparing, setPreparing] = useState(false);
    const [error, setError] = useState('');
    const printRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `ReportCards_${className}_${examName}`,
    });

    useEffect(() => {
        fetchCards();
    }, []);

    useEffect(() => {
        if (cardsWithResults.length > 0) {
            handlePrint();
        }
    }, [cardsWithResults]);

    const fetchCards = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/reportCards/by-exam/${examId}`);
            const classCards = response.data.filter(c =>
                c.student?.className === className
            );
            setCards(classCards);
            setLoading(false);
        } catch (err) {
            setError('Failed to load report cards');
            setLoading(false);
        }
    };

    const handlePrepareAndPrint = async () => {
        setPreparing(true);
        try {
            const withResults = await Promise.all(
                cards.map(async (card) => {
                    const res = await api.get(`/api/results/student/${card.student?.studentId}/exam/${examId}`);
                    return { card, results: res.data };
                })
            );
            setCardsWithResults(withResults);
        } catch (err) {
            setError('Failed to load results for printing');
        }
        setPreparing(false);
    };

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>
                <div style={modalStyles.header}>
                    <h3 style={modalStyles.title}>🖨️ Print All Report Cards</h3>
                    <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
                </div>
                <div style={modalStyles.body}>
                    {error && <p style={modalStyles.error}>{error}</p>}
                    <div style={modalStyles.info}>
                        <p><strong>Class:</strong> {className}</p>
                        <p><strong>Exam:</strong> {examName}</p>
                        {loading ? (
                            <p style={{ color: '#666' }}>⏳ Loading report cards...</p>
                        ) : (
                            <p><strong>Report Cards Found:</strong> {cards.length}</p>
                        )}
                    </div>
                    {!loading && cards.length === 0 && (
                        <p style={modalStyles.warning}>⚠️ No report cards found for this class and exam. Generate report cards first.</p>
                    )}
                </div>
                <div style={modalStyles.footer}>
                    <button onClick={onClose} style={modalStyles.cancelBtn}>Cancel</button>
                    {cards.length > 0 && (
                        <button onClick={handlePrepareAndPrint} style={modalStyles.printBtn} disabled={preparing || loading}>
                            {preparing ? '⏳ Preparing...' : `🖨️ Print ${cards.length} Report Cards`}
                        </button>
                    )}
                </div>
            </div>
            {/* Hidden print area */}
            <div style={{ display: 'none' }}>
                <AllReportCards ref={printRef} cardsWithResults={cardsWithResults} />
            </div>
        </div>
    );
}

const modalStyles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', width: '90%', maxWidth: '480px' },
    header: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '10px 10px 0 0' },
    title: { color: 'white', margin: 0, fontSize: '16px' },
    closeBtn: { background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' },
    body: { padding: '20px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    info: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', lineHeight: '1.8' },
    warning: { color: '#856404', backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginTop: '10px' },
    footer: { padding: '15px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }
};

const printStyles = {
    page: { padding: '25px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', color: '#000' },
    header: { borderBottom: '3px solid #1F3864', paddingBottom: '15px', marginBottom: '15px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
    logo: { width: '80px', height: '80px', objectFit: 'contain' },
    schoolDetails: { textAlign: 'center', flex: 1, padding: '0 15px' },
    schoolName: { color: '#1F3864', fontSize: '14px', margin: '0 0 4px 0' },
    motto: { color: '#2E75B6', fontStyle: 'italic', margin: '0 0 4px 0', fontSize: '12px' },
    contact: { fontSize: '11px', color: '#666', margin: 0 },
    reportTitle: { backgroundColor: '#1F3864', color: 'white', padding: '8px', margin: '10px 0 0 0', fontSize: '14px', textAlign: 'center' },
    studentInfo: { backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '5px', marginBottom: '15px' },
    infoRow: { display: 'flex', gap: '15px', marginBottom: '6px' },
    infoLabel: { fontWeight: 'bold', color: '#1F3864', minWidth: '110px', fontSize: '12px' },
    infoValue: { flex: 1, borderBottom: '1px solid #ddd', paddingBottom: '2px', fontSize: '12px' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '15px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '7px 10px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '7px 10px', borderBottom: '1px solid #ddd', fontSize: '12px' },
    trEven: { backgroundColor: '#f8f9fa' },
    trOdd: { backgroundColor: 'white' },
    summary: { display: 'flex', gap: '15px', backgroundColor: '#1F3864', padding: '12px', borderRadius: '5px', marginBottom: '15px' },
    summaryItem: { flex: 1, textAlign: 'center' },
    summaryLabel: { color: '#FFD700', fontSize: '11px', display: 'block' },
    summaryValue: { color: 'white', fontSize: '18px', fontWeight: 'bold', display: 'block' },
    comments: { display: 'flex', gap: '15px', marginBottom: '15px' },
    commentBox: { flex: 1, border: '1px solid #ddd', padding: '12px', borderRadius: '5px' },
    commentLabel: { fontWeight: 'bold', color: '#1F3864', margin: '0 0 6px 0', fontSize: '12px' },
    commentText: { margin: '0 0 10px 0', minHeight: '35px', fontSize: '12px' },
    signatureLine: { margin: 0, color: '#666', fontSize: '11px' },
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #1F3864', paddingTop: '8px' },
    footerLogo: { width: '40px', height: '40px', objectFit: 'contain' },
    footerText: { textAlign: 'center', fontSize: '10px', color: '#666' }
};

export default PrintAllReportCards;
