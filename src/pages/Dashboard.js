import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../index.css';

function Dashboard() {
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    const [stats, setStats] = useState({
        students: 0, teachers: 0, exams: 0,
        results: 0, reportCards: 0, classes: 0,
        subjects: 0, users: 0
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const [students, teachers, exams, results, reportCards, classes, subjects, users] =
                await Promise.all([
                    api.get('/api/students'),
                    api.get('/api/teachers'),
                    api.get('/api/exams'),
                    api.get('/api/results'),
                    api.get('/api/reportCards'),
                    api.get('/api/classes'),
                    api.get('/api/subjects'),
                    api.get('/api/users'),
                    api.get('/api/academic-years'),
                    api.get('/api/exam-schedules'),
                    api.get('/api/grading-scales')
                ]);
            setStats({
                students: students.data.length,
                teachers: teachers.data.length,
                exams: exams.data.length,
                results: results.data.length,
                reportCards: reportCards.data.length,
                classes: classes.data.length,
                subjects: subjects.data.length,
                users: users.data.length
            });
        } catch (err) {
            console.error('Failed to load stats');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const allMenuItems = [
        { icon: '🎓', label: 'Students', path: '/students', count: stats.students, color: '#2E75B6', roles: ['ADMIN', 'TEACHER'] },
        { icon: '👨‍🏫', label: 'Teachers', path: '/teachers', count: stats.teachers, color: '#1F3864', roles: ['ADMIN'] },
        { icon: '🏫', label: 'Classes', path: '/classes', count: stats.classes, color: '#28a745', roles: ['ADMIN'] },
        { icon: '📚', label: 'Subjects', path: '/subjects', count: stats.subjects, color: '#fd7e14', roles: ['ADMIN'] },
        { icon: '📝', label: 'Exams', path: '/exams', count: stats.exams, color: '#6f42c1', roles: ['ADMIN'] },
        { icon: '📊', label: 'Results', path: '/results', count: stats.results, color: '#e83e8c', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
        { icon: '📋', label: 'Report Cards', path: '/reportcards', count: stats.reportCards, color: '#20c997', roles: ['ADMIN', 'TEACHER'] },
        { icon: '📅', label: 'Academic Years', path: '/academic-years', count: null, color: '#17a2b8', roles: ['ADMIN'] },
        { icon: '🗓️', label: 'Exam Schedules', path: '/exam-schedules', count: null, color: '#ffc107', roles: ['ADMIN'] },
        { icon: '📊', label: 'Grading Scales', path: '/grading-scales', count: null, color: '#dc3545', roles: ['ADMIN'] },
        { icon: '👤', label: 'Users', path: '/users', count: stats.users, color: '#343a40', roles: ['ADMIN'] },
    ];

    const menuItems = allMenuItems.filter(item => item.roles.includes(role));

    return (
        <div>
            {/* Navbar */}
            <div className="navbar">
                <h2 className="navbar-title">Pipeline Adventist School</h2>
                <div className="navbar-right">
                    <span style={{ color: '#FFD700', fontSize: '14px' }}>
                        👤 {username} ({role})
                    </span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </div>

            {/* Content */}
            <div className="content">
                <h2 style={{ color: '#1F3864', fontSize: '28px', marginBottom: '5px' }}>
                    Welcome, {username}! 👋
                </h2>
                <p style={{ color: '#666', marginBottom: '30px' }}>
                    Exam Management System — Dashboard
                </p>

                {/* Stats Row — hide for CLERK */}
                {role !== 'CLERK' && (
                    <div className="stats-row">
                        <div className="stat-card">
                            <div className="stat-number">{stats.students}</div>
                            <div className="stat-label">Total Students</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">{stats.teachers}</div>
                            <div className="stat-label">Total Teachers</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">{stats.exams}</div>
                            <div className="stat-label">Total Exams</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">{stats.results}</div>
                            <div className="stat-label">Total Results</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">{stats.reportCards}</div>
                            <div className="stat-label">Report Cards</div>
                        </div>
                    </div>
                )}

                {/* Menu Cards */}
                <h3 style={{ color: '#1F3864', marginBottom: '20px' }}>Quick Access</h3>
                <div className="card-grid">
                    {menuItems.map((item, index) => (
                        <div key={index}
                            className="dashboard-card"
                            style={{ borderTop: `4px solid ${item.color}` }}
                            onClick={() => navigate(item.path)}>
                            <div className="card-icon">{item.icon}</div>
                            <h3 className="card-title">{item.label}</h3>
                            {item.count !== null && (
                                <div className="card-count"
                                    style={{ backgroundColor: item.color }}>
                                    {item.count} records
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;