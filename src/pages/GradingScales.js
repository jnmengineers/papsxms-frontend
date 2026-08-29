import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

function GradingScales() {
    const [scales, setScales] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingScale, setEditingScale] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        gradeLetter: '',
        minMark: '',
        maxMark: '',
        points: '',
        remarks: ''
    });

    useEffect(() => {
        fetchScales();
    }, []);

    useEffect(() => {
        let data = scales;
        if (search) {
            data = data.filter(s =>
                s.gradeLetter?.toLowerCase().includes(search.toLowerCase()) ||
                s.remarks?.toLowerCase().includes(search.toLowerCase())
            );
        }
        setFiltered(data);
    }, [search, scales]);

    const fetchScales = async () => {
        try {
            const response = await api.get('/api/grading-scales');
            setScales(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load grading scales');
            setLoading(false);
        }
    };

    const handleEdit = (scale) => {
        setEditingScale(scale);
        setFormData({
            gradeLetter: scale.gradeLetter,
            minMark: scale.minMark,
            maxMark: scale.maxMark,
            points: scale.points,
            remarks: scale.remarks || ''
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                gradeLetter: formData.gradeLetter,
                minMark: parseFloat(formData.minMark),
                maxMark: parseFloat(formData.maxMark),
                points: parseFloat(formData.points),
                remarks: formData.remarks
            };
            if (editingScale) {
                await api.put(`/api/grading-scales/${editingScale.scaleId}`, payload);
            } else {
                await api.post('/api/grading-scales', payload);
            }
            setShowForm(false);
            setEditingScale(null);
            setFormData({ gradeLetter: '', minMark: '', maxMark: '', points: '', remarks: '' });
            fetchScales();
        } catch (err) {
            setError('Failed to save grading scale');
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

    const handleCancel = () => {
        setShowForm(false);
        setEditingScale(null);
        setFormData({ gradeLetter: '', minMark: '', maxMark: '', points: '', remarks: '' });
    };

    return (
        <div style={styles.container}>
           <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.header}>
                    <h2 style={styles.title}>📊 Grading Scales ({filtered.length})</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingScale(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Grade'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {showForm && (
                    <div style={styles.form}>
                        <h3 style={styles.formTitle}>{editingScale ? 'Edit Grading Scale' : 'Add New Grading Scale'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Grade Letter</label>
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
                                    <label style={styles.label}>Min Mark</label>
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
                                    <label style={styles.label}>Max Mark</label>
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
                                    <label style={styles.label}>Points</label>
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
                                    <label style={styles.label}>Remarks</label>
                                    <input
                                        style={styles.input}
                                        value={formData.remarks}
                                        onChange={e => setFormData({...formData, remarks: e.target.value})}
                                        placeholder="e.g. Excellent"
                                    />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingScale ? 'Update Grade' : 'Save Grade'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div style={styles.searchBar}>
                    <input
                        style={styles.searchInput}
                        placeholder="🔍 Search by grade or remarks..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button onClick={() => setSearch('')} style={styles.clearBtn}>Clear</button>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading grading scales...</p>
                ) : (
                    <div style={styles.tableWrapper}>
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
                                {filtered.map((scale, index) => (
                                    <tr key={scale.scaleId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
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
                                            <button onClick={() => handleEdit(scale)} style={styles.editBtn}>Edit</button>
                                            <button onClick={() => handleDelete(scale.scaleId)} style={styles.deleteBtn}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                            No grading scales found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
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
    content: { padding: '30px', flex: 1 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' },
    title: { color: '#1F3864', margin: 0, fontSize: '22px', fontWeight: 800 },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    form: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    formTitle: { color: '#1F3864', fontWeight: 700, margin: '0 0 15px 0' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '22px' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '600px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '13px 15px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '12px 15px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
    gradeBadge: { color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }
};

export default GradingScales;