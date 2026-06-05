import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function GradingScales() {
    const [scales, setScales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        gradeLetter: '',
        minMark: '',
        maxMark: '',
        points: '',
        remarks: '',
        startTime: '2024-01-01'
    });

    useEffect(() => {
        fetchScales();
    }, []);

    const fetchScales = async () => {
        try {
            const response = await api.get('/api/grading-scales');
            setScales(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load grading scales');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/grading-scales', {
                ...formData,
                minMark: parseFloat(formData.minMark),
                maxMark: parseFloat(formData.maxMark),
                points: parseFloat(formData.points)
            });
            setShowForm(false);
            setFormData({ gradeLetter: '', minMark: '', maxMark: '', points: '', remarks: '', startTime: '2024-01-01' });
            fetchScales();
        } catch (err) {
            setError('Failed to add grading scale');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/grading-scales/${id}`);
                fetchScales();
            } catch (err) {
                setError('Failed to delete grading scale');
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
                    <h2 style={styles.title}>📊 Grading Scales</h2>
                    <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Grade'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {/* Add Grading Scale Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3>Add New Grading Scale</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Grade Letter</label>
                                    <input
                                        style={styles.input}
                                        value={formData.gradeLetter}
                                        onChange={e => setFormData({...formData, gradeLetter: e.target.value})}
                                        placeholder="e.g. A"
                                        maxLength="5"
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Min Mark</label>
                                    <input
                                        type="number"
                                        style={styles.input}
                                        value={formData.minMark}
                                        onChange={e => setFormData({...formData, minMark: e.target.value})}
                                        placeholder="e.g. 80"
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Max Mark</label>
                                    <input
                                        type="number"
                                        style={styles.input}
                                        value={formData.maxMark}
                                        onChange={e => setFormData({...formData, maxMark: e.target.value})}
                                        placeholder="e.g. 100"
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Points</label>
                                    <input
                                        type="number"
                                        style={styles.input}
                                        value={formData.points}
                                        onChange={e => setFormData({...formData, points: e.target.value})}
                                        placeholder="e.g. 12"
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Remarks</label>
                                    <input
                                        style={styles.input}
                                        value={formData.remarks}
                                        onChange={e => setFormData({...formData, remarks: e.target.value})}
                                        placeholder="e.g. Excellent"
                                    />
                                </div>
                            </div>
                            <button type="submit" style={styles.submitBtn}>Save Grade</button>
                        </form>
                    </div>
                )}

                {/* Grading Scales Table */}
                {loading ? (
                    <p>Loading grading scales...</p>
                ) : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Grade</th>
                                <th style={styles.th}>Min Mark</th>
                                <th style={styles.th}>Max Mark</th>
                                <th style={styles.th}>Points</th>
                                <th style={styles.th}>Remarks</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scales.map((scale, index) => (
                                <tr key={scale.id} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>
                                        <span style={{
                                            ...styles.gradeBadge,
                                            backgroundColor:
                                                scale.gradeLetter === 'A' ? '#28a745' :
                                                scale.gradeLetter === 'B' ? '#2E75B6' :
                                                scale.gradeLetter === 'C' ? '#ffc107' : '#dc3545'
                                        }}>
                                            {scale.gradeLetter}
                                        </span>
                                    </td>
                                    <td style={styles.td}>{scale.minMark}</td>
                                    <td style={styles.td}>{scale.maxMark}</td>
                                    <td style={styles.td}>{scale.points}</td>
                                    <td style={styles.td}>{scale.remarks}</td>
                                    <td style={styles.td}>
                                        <button
                                            onClick={() => handleDelete(scale.id)}
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
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '14px', fontWeight: 'bold' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default GradingScales;