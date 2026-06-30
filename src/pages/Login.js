import React, { useState } from 'react';
import axios from 'axios';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import LoadingScreen from './LoadingScreen';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [wakingUp, setWakingUp] = useState(false); // backend wakeup state

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Show wakeup screen after 3 seconds if still loading
        const wakeupTimer = setTimeout(() => setWakingUp(true), 3000);

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/auth/login`,
                { username, password },
                { timeout: 90000 } // 90 second timeout for wakeup
            );

            clearTimeout(wakeupTimer);
            setWakingUp(false);

            const data = response.data;
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            localStorage.setItem('role', data.role);
            localStorage.setItem('linkedClassId', data.linkedClassId || '');
            localStorage.setItem('linkedClassName', data.linkedClassName || '');
            localStorage.setItem('linkedStream', data.linkedStream || ''); // ✅ NEW

            if (data.mustChangePassword) {
                localStorage.setItem('mustChangePassword', 'true');
                window.location.href = '/change-password';
            } else {
                localStorage.removeItem('mustChangePassword');
                window.location.href = '/dashboard';
            }

        } catch (err) {
            clearTimeout(wakeupTimer);
            setWakingUp(false);
            setLoading(false);

            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                setError('Server took too long to respond. Please try again — it may still be waking up.');
            } else if (err.response?.status === 401 || err.response?.status === 400) {
                setError('Invalid username or password');
            } else {
                setError('Unable to connect to server. Please try again in a moment.');
            }
        }
    };

    // Show full-screen loading while backend is waking up
    if (wakingUp) {
        return <LoadingScreen message="Connecting to server" />;
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logoRow}>
                    <img src={logo1} alt="Logo 1" style={styles.logo} />
                    <img src={logo2} alt="Logo 2" style={styles.logo} />
                </div>
                <h2 style={styles.schoolName}>PIPELINE ADVENTIST SCHOOL</h2>
                <h3 style={styles.subtitle}>Exam Management System</h3>
                <p style={styles.motto}>Abreast with the Best in Holistic Education</p>

                {error && <p style={styles.error}>{error}</p>}

                <form onSubmit={handleLogin}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Username</label>
                        <input type="text" value={username}
                            onChange={e => setUsername(e.target.value)}
                            style={styles.input} placeholder="Enter username" required />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Password</label>
                        <input type="password" value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={styles.input} placeholder="Enter password" required />
                    </div>
                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? '⏳ Connecting...' : 'Login →'}
                    </button>
                </form>

                {loading && !wakingUp && (
                    <p style={styles.loadingHint}>
                        ⏳ Connecting to server, please wait...
                    </p>
                )}

                <p style={styles.footer}>
                    © {new Date().getFullYear()} Pipeline Adventist School
                </p>
            </div>
        </div>
    );
}

const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px' },
    card: { backgroundColor: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', width: '100%', maxWidth: '420px' },
    logoRow: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '15px' },
    logo: { width: '70px', height: '70px', objectFit: 'contain' },
    schoolName: { textAlign: 'center', color: '#1F3864', fontSize: '16px', margin: '0 0 5px 0' },
    subtitle: { textAlign: 'center', color: '#2E75B6', fontSize: '14px', fontWeight: 'normal', margin: '0 0 5px 0' },
    motto: { textAlign: 'center', color: '#666', fontSize: '12px', fontStyle: 'italic', margin: '0 0 25px 0' },
    error: { color: 'red', textAlign: 'center', marginBottom: '15px', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', fontSize: '14px' },
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    input: { width: '100%', padding: '12px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', boxSizing: 'border-box', outline: 'none' },
    button: { width: '100%', padding: '13px', backgroundColor: '#1F3864', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' },
    loadingHint: { textAlign: 'center', color: '#666', fontSize: '13px', marginTop: '15px', fontStyle: 'italic' },
    footer: { textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '20px', marginBottom: 0 }
};

export default Login;