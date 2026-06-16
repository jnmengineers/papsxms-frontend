import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function AcademicYears() {
    const [years, setYears] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingYear, setEditingYear] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        yearLabel: '',
        term: '',
        startDate: '',
        endDate: '',
        isActive: false
    });

    useEffect(() => { fetchYears(); }, []);

    useEffect(() => {
        let data = years;
        if (search) {
            data = data.filter(y =>
                y.yearLabel?.toLowerCase().includes(search.toLowerCase())
            );
        }
        setFiltered(data);
    }, [search, years]);

    const fetchYears = async () => {
        try {
            const response = await api.get('/api/academic-years');
            setYears(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load academic years');
            setLoading(false);
        }
    };

    const handleEdit = (year) => {
        setEditingYear(year);
        setFormData({
            yearLabel: year.yearLabel,
            term: year.term,
            startDate: year.startDate,
            endDate: year.endDate,
            isActive: year.isActive
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, term: parseInt(formData.term) };
            if (editingYear) {
                await api.put(`/api/academic-years/${editingYear.yearId}`, payload);
                setSuccessMsg('Academic year updated!');
            } else {
                await api.post('/api/academic-years', payload);
                setSuccessMsg('Academic year added!');
            }
            setShowForm(false);
            setEditingYear(null);
            setFormData({ yearLabel: '', term: '', startDate: '', endDate: '', isActive: false });
            fetchYears();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError('Failed to save academic year');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/academic-years/${id}`);
                fetchYears();
            } catch (err) {
                setError('Failed to delete academic year');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingYear(null);
        setFormData({ yearLabel: '', term: '', startDate: '', endDate: '', isActive: false });
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
                    <h2 style={styles.title}>📅 Academic Years ({filtered.length})</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingYear(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Academic Year'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Add/Edit Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingYear ? '✏️ Edit Academic Year' : '➕ Add Academic Year'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Year Label</label>
                                    <input style={styles.input} value={formData.yearLabel}
                                        onChange={e => setFormData({...formData, yearLabel: e.target.value})}
                                        placeholder="e.g. 2025" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Term</label>
                                    <select style={styles.input} value={formData.term}
                                        onChange={e => setFormData({...formData, term: e.target.value})} required>
                                        <option value="">Select Term</option>
                                        <option value="1">Term 1</option>
                                        <option value="2">Term 2</option>
                                        <option value="3">Term 3</option>
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Start Date</label>
                                    <input type="date" style={styles.input} value={formData.startDate}
                                        onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>End Date</label>
                                    <input type="date" style={styles.input} value={formData.endDate}
                                        onChange={e => setFormData({...formData, endDate: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Status</label>
                                    <select style={styles.input} value={formData.isActive}
                                        onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}>
                                        <option value="false">Inactive</option>
                                        <option value="true">Active</option>
                                    </select>
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingYear ? '✅ Update' : '💾 Save'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Search */}
                <div style={styles.searchBar}>
                    <input style={styles.searchInput} placeholder="🔍 Search by year..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <button onClick={() => setSearch('')} style={styles.clearBtn}>Clear</button>
                </div>

                {/* Table */}
                {loading ? <p>Loading...</p> : (
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeader}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Year Label</th>
                                    <th style={styles.th}>Term</th>
                                    <th style={styles.th}>Start Date</th>
                                    <th style={styles.th}>End Date</th>
                                    <th style={styles.th}>Status</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((year, index) => (
                                    <tr key={year.yearId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                        <td style={styles.td}>{index + 1}</td>
                                        <td style={styles.td}><strong>{year.yearLabel}</strong></td>
                                        <td style={styles.td}>
                                            <span style={styles.termBadge}>Term {year.term}</span>
                                        </td>
                                        <td style={styles.td}>{year.startDate}</td>
                                        <td style={styles.td}>{year.endDate}</td>
                                        <td style={styles.td}>
                                            <span style={{...styles.statusBadge, backgroundColor: year.isActive ? '#28a745' : '#dc3545'}}>
                                                {year.isActive ? '✅ Active' : '❌ Inactive'}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            <button onClick={() => handleEdit(year)} style={styles.editBtn}>Edit</button>
                                            <button onClick={() => handleDelete(year.yearId)} style={styles.deleteBtn}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="7" style={{textAlign:'center',padding:'20px',color:'#666'}}>No academic years found</td></tr>
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
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '600px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    termBadge: { backgroundColor: '#1F3864', color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px' },
    statusBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' }
};

export default AcademicYears;
