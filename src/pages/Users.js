import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { SECTIONS_LIVE } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const EMPTY_FORM = { username: '', password: '', role: 'TEACHER' };
const MIN_PASSWORD = 8;
const norm = (v) => String(v ?? '').trim().toLowerCase();
const serverMessage = (err, fallback) => {
    const d = err.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};

function Users() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const currentUsername = localStorage.getItem('username') || '';
    const [users, setUsers] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyUserId, setBusyUserId] = useState(null);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [formData, setFormData] = useState(EMPTY_FORM);
    const successTimer = useRef(null);

    useEffect(() => {
        fetchAll();
        return () => clearTimeout(successTimer.current);
    }, []);

    const flashSuccess = (msg) => {
        setError('');
        setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3000);
    };

    // One failed request no longer blanks the whole page
    const fetchAll = async () => {
        const [uRes, tRes, cRes, sRes] = await Promise.allSettled([
            api.get('/api/users'), api.get('/api/teachers'), api.get('/api/classes'), api.get('/api/students')
        ]);
        if (uRes.status === 'fulfilled') setUsers(uRes.value.data || []);
        else setError('Failed to load users. Check your connection and refresh.');
        if (tRes.status === 'fulfilled') setTeachers(tRes.value.data || []);
        if (cRes.status === 'fulfilled') setClasses(cRes.value.data || []);
        if (sRes.status === 'fulfilled') setStudents(sRes.value.data || []);
        const missing = [tRes.status === 'rejected' && 'teacher names', cRes.status === 'rejected' && 'classes', sRes.status === 'rejected' && 'student counts'].filter(Boolean);
        setWarning(missing.length ? `Some details couldn't be loaded (${missing.join(', ')}).` : '');
        setLoading(false);
    };

    // The login's teacher record: the proper link first, the old LinkedId as fallback
    const linkedTeacherId = (user) => user.teacher?.teacherId ?? user.linkedId ?? user.LinkedId ?? null;
    const getTeacherName = (user) => {
        if (user.teacher) return `${user.teacher.firstName} ${user.teacher.lastName}`;
        const id = linkedTeacherId(user);
        if (id == null) return null;
        const teacher = teachers.find(t => String(t.teacherId) === String(id));
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
    };

    const linkedClassOf = (user) => user.linkedClass
        ? classes.find(c => String(c.classId) === String(user.linkedClass.classId)) || user.linkedClass
        : null;

    const getStudentsForClass = (classId) =>
        students.filter(s => String(s.schoolClass?.classId) === String(classId));

    const isSelf = (user) => norm(user.username) === norm(currentUsername);
    const adminCount = users.filter(u => u.role === 'ADMIN').length;

    const handleAssignClass = async (user, classId) => {
        if (!classId || String(classId) === String(user.linkedClass?.classId ?? '')) return;
        const cls = classes.find(c => String(c.classId) === String(classId));
        const other = users.find(u => u.userId !== user.userId && u.role === 'TEACHER' && String(u.linkedClass?.classId) === String(classId));
        if (other && !window.confirm(
            `${classDisplayName(cls)} is already linked to "${other.username}"${getTeacherName(other) ? ` (${getTeacherName(other)})` : ''}.\n\n` +
            `Link it to "${user.username}" as well? Both logins will be able to enter marks for this class.`)) return;
        setBusyUserId(user.userId); setError('');
        try {
            await api.patch(`/api/users/${user.userId}/assign-class/${classId}`);
            flashSuccess(`"${user.username}" now manages ${classDisplayName(cls)}`);
            await fetchAll();
        } catch (err) { setError(serverMessage(err, 'Failed to assign class')); }
        setBusyUserId(null);
    };

    const isLocked = (user) => !!user.lockedUntil && new Date(user.lockedUntil) > new Date();

    const handleLinkTeacher = async (user, teacherId) => {
        setBusyUserId(user.userId); setError('');
        try {
            if (!teacherId) {
                if (!window.confirm(`Unlink "${user.username}" from ${getTeacherName(user) || 'its teacher record'}?`)) { setBusyUserId(null); return; }
                await api.delete(`/api/users/${user.userId}/link-teacher`);
                flashSuccess(`"${user.username}" is no longer linked to a teacher`);
            } else {
                const r = await api.patch(`/api/users/${user.userId}/link-teacher/${teacherId}`);
                flashSuccess(r.data?.message || `"${user.username}" linked`);
            }
            await fetchAll();
        } catch (err) { setError(serverMessage(err, 'Failed to link the teacher record')); }
        setBusyUserId(null);
    };

    // Random 10-character password without look-alike characters (0/O, 1/l/I)
    const randomPassword = () => {
        const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', A = U + L + D;
        const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
        const chars = [pick(U), pick(L), pick(D), ...Array.from({ length: 7 }, () => pick(A))];
        for (let i = chars.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
        return chars.join('');
    };

    const handleResetPassword = async (user) => {
        const pw = window.prompt(
            `Temporary password for "${user.username}" (at least ${MIN_PASSWORD} characters).\n\n` +
            `A random one is suggested below — keep it or type your own. Give it to them privately.\n` +
            `They must choose their own password when they next log in, and any device they're logged in on is logged out.`,
            randomPassword());
        if (pw === null) return;
        if (pw.length < MIN_PASSWORD) { setError(`The temporary password must be at least ${MIN_PASSWORD} characters.`); return; }
        if (norm(pw) === norm(user.username)) { setError('The password must not be the same as the username.'); return; }
        setBusyUserId(user.userId); setError('');
        try {
            const r = await api.patch(`/api/users/${user.userId}/reset-password`, { newPassword: pw });
            flashSuccess(r.data?.message || `Password reset for "${user.username}"`);
            await fetchAll();
        } catch (err) { setError(serverMessage(err, 'Failed to reset the password')); }
        setBusyUserId(null);
    };

    const handleUnlock = async (user) => {
        setBusyUserId(user.userId); setError('');
        try {
            await api.patch(`/api/users/${user.userId}/unlock`);
            flashSuccess(`"${user.username}" can log in again`);
            await fetchAll();
        } catch (err) { setError(serverMessage(err, 'Failed to unlock the account')); }
        setBusyUserId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const username = formData.username.trim();
        if (!/^[A-Za-z0-9._-]{3,}$/.test(username)) {
            setError('Username must be at least 3 characters, using only letters, numbers, dot, dash or underscore (no spaces).'); return;
        }
        if (users.some(u => norm(u.username) === norm(username))) { setError(`The username "${username}" is already taken.`); return; }
        if (formData.password.length < MIN_PASSWORD) { setError(`Password must be at least ${MIN_PASSWORD} characters.`); return; }
        if (norm(formData.password) === norm(username)) { setError('Password must not be the same as the username.'); return; }
        if (formData.role === 'ADMIN' && !window.confirm(`Create "${username}" as an ADMIN?\n\nAdmins can change and delete everything, including other users.`)) return;
        setSaving(true); setError('');
        try {
            await api.post('/api/auth/register', { ...formData, username });
            flashSuccess(`User "${username}" created as ${formData.role.toLowerCase()}`);
            setShowForm(false);
            setFormData(EMPTY_FORM);
            setShowPassword(false);
            fetchAll();
        } catch (err) { setError(serverMessage(err, 'Failed to add user')); }
        setSaving(false);
    };

    const handleDelete = async (user) => {
        if (isSelf(user)) { setError("You can't delete the account you're logged in with."); return; }
        if (user.role === 'ADMIN' && adminCount <= 1) { setError("You can't delete the last admin — nobody would be able to manage the system."); return; }
        const cls = linkedClassOf(user);
        const note = cls ? `\n\nThis login manages ${classDisplayName(cls)}; that class will have no teacher login afterwards.` : '';
        if (!window.confirm(`Delete user "${user.username}"?${note}\n\nThis cannot be undone.`)) return;
        setBusyUserId(user.userId); setError('');
        try {
            await api.delete(`/api/users/${user.userId}`);
            flashSuccess(`User "${user.username}" deleted`);
            await fetchAll();
        } catch (err) { setError(serverMessage(err, 'Failed to delete user')); }
        setBusyUserId(null);
    };

    const sections = SECTIONS_LIVE;   // from School Settings
    const sortedClasses = (list) => [...list].sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true }));
    const otherClasses = classes.filter(c => !sections.some(s => s.value === c.section));

    const getRoleColor = (role) => ({ ADMIN: '#1F3864', TEACHER: '#2E75B6', CLERK: '#28a745', ACCOUNTANT: '#0f766e' }[role] || '#666');
    const getRoleIcon = (role) => ({ ADMIN: 'shield-lock-fill', TEACHER: 'person-workspace', CLERK: 'person-badge-fill', ACCOUNTANT: 'cash-stack' }[role] || 'person-fill');

    const q = norm(search);
    const filtered = users
        .filter(u => !filterRole || u.role === filterRole)
        .filter(u => !q || norm(u.username).includes(q) || norm(getTeacherName(u)).includes(q) ||
            norm(linkedClassOf(u) ? classDisplayName(linkedClassOf(u)) : '').includes(q))
        .sort((a, b) => (a.role || '').localeCompare(b.role || '') || norm(a.username).localeCompare(norm(b.username)));

    const teacherUsers = users.filter(u => u.role === 'TEACHER');
    const assigned = teacherUsers.filter(u => u.linkedClass);
    const unassigned = teacherUsers.filter(u => !u.linkedClass);
    const classesWithoutLogin = classes.filter(c => !teacherUsers.some(t => String(t.linkedClass?.classId) === String(c.classId)));

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.pageHeader}>
                    <div>
                        <h2 style={styles.title}><Icon name="people-fill" style={{ marginRight: '10px' }} />User Management</h2>
                        <p style={styles.subtitle}>System logins and which class each teacher login manages</p>
                    </div>
                    <button onClick={() => { setShowForm(!showForm); setFormData(EMPTY_FORM); setShowPassword(false); }} style={styles.addBtn}>
                        {showForm ? <><Icon name="x-lg" />Close</> : <><Icon name="person-plus-fill" />Add User</>}
                    </button>
                </div>

                {error && (
                    <div style={styles.error} role="alert">
                        <Icon name="exclamation-triangle-fill" />{error}
                        <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                    </div>
                )}
                {warning && <div style={styles.warning}><Icon name="exclamation-circle-fill" />{warning} <button onClick={fetchAll} style={styles.linkBtn}>Retry</button></div>}
                {successMsg && <div style={styles.success}><Icon name="check-circle-fill" />{successMsg}</div>}

                <div style={styles.summaryBar}>
                    {[
                        { n: users.length, l: 'Total Users', c: '#1F3864' },
                        { n: assigned.length, l: 'Teacher Logins with a Class', c: '#28a745' },
                        { n: unassigned.length, l: 'Teacher Logins without a Class', c: '#fd7e14' },
                        { n: classesWithoutLogin.length, l: 'Classes without a Teacher Login', c: '#dc3545' },
                    ].map((s, i) => (
                        <React.Fragment key={s.l}>
                            {i > 0 && <div style={styles.summaryDivider} />}
                            <div style={styles.summaryItem}>
                                <span style={{ ...styles.summaryNum, color: s.c }}>{s.n}</span>
                                <span style={styles.summaryLabel}>{s.l}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {showForm && (
                    <div style={styles.formCard}>
                        <h3 style={styles.formTitle}><Icon name="person-plus-fill" />Add New User</h3>
                        {/* autoComplete off: stops the browser filling in YOUR saved login here */}
                        <form onSubmit={handleSubmit} style={styles.formRow} autoComplete="off">
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Username</label>
                                <input style={styles.input} value={formData.username} name="new-user-username"
                                    autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="e.g. jsmith" required />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Password</label>
                                <div style={styles.passwordWrap}>
                                    <input type={showPassword ? 'text' : 'password'} style={styles.passwordInput} value={formData.password}
                                        name="new-user-password" autoComplete="new-password" minLength={MIN_PASSWORD}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={`Min ${MIN_PASSWORD} characters`} required />
                                    <button type="button" onClick={() => setShowPassword(v => !v)} style={styles.eyeBtn}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                                        <i className={`bi bi-${showPassword ? 'eye-slash-fill' : 'eye-fill'}`} />
                                    </button>
                                </div>
                                {formData.password && formData.password.length < MIN_PASSWORD && (
                                    <span style={styles.fieldHint}>{MIN_PASSWORD - formData.password.length} more character(s) needed</span>
                                )}
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Role</label>
                                <select style={styles.input} value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })} required>
                                    <option value="TEACHER">Teacher</option>
                                    <option value="CLERK">Clerk (secretary)</option>
                                    <option value="ACCOUNTANT">Bursar (finance)</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>&nbsp;</label>
                                <button type="submit" style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                                    <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                        <p style={styles.formNote}><Icon name="info-circle" />Share the password with the user privately, and ask them to change it after first login.</p>
                    </div>
                )}

                <div style={styles.filterBar}>
                    <div style={styles.searchBox}>
                        <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                        <input style={styles.searchInput} placeholder="Search name, username or class..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={styles.roleTabs}>
                        {[
                            { label: 'All', value: '' },
                            { label: 'Teachers', value: 'TEACHER' },
                            { label: 'Admins', value: 'ADMIN' },
                            { label: 'Clerks', value: 'CLERK' },
                            { label: 'Bursars', value: 'ACCOUNTANT' }
                        ].map(tab => (
                            <button key={tab.value} onClick={() => setFilterRole(tab.value)}
                                style={{ ...styles.roleTab, backgroundColor: filterRole === tab.value ? '#1F3864' : 'white', color: filterRole === tab.value ? 'white' : '#1F3864' }}>
                                {tab.label}
                                <span style={styles.tabCount}>{tab.value === '' ? users.length : users.filter(u => u.role === tab.value).length}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={styles.loadingCard}><Icon name="hourglass-split" />Loading...</div>
                ) : (
                    <div style={styles.tableCard}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.thead}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Name</th>
                                    <th style={styles.th}>Username</th>
                                    <th style={styles.th}>Role</th>
                                    <th style={styles.th}>Manages Class</th>
                                    <th style={styles.th}>Students</th>
                                    <th style={styles.th}>Assign / Reassign</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((user, i) => {
                                    const teacherName = getTeacherName(user);
                                    const linkedClass = linkedClassOf(user);
                                    const classStudents = linkedClass ? getStudentsForClass(linkedClass.classId) : [];
                                    const section = linkedClass ? sections.find(s => s.value === linkedClass.section) : null;
                                    const isTeacher = user.role === 'TEACHER';
                                    const self = isSelf(user);
                                    const lastAdmin = user.role === 'ADMIN' && adminCount <= 1;
                                    const busy = busyUserId === user.userId;

                                    return (
                                        <tr key={user.userId} style={{ backgroundColor: self ? '#eef5ff' : i % 2 === 0 ? '#fafafa' : 'white' }}>
                                            <td style={styles.td}>{i + 1}</td>
                                            <td style={styles.td}>
                                                <div style={styles.nameCell}>
                                                    <div style={{ ...styles.avatar, backgroundColor: getRoleColor(user.role) }}>
                                                        {(teacherName || user.username || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <span style={styles.nameText}>{teacherName || <span style={styles.noName}>—</span>}</span>
                                                        {isTeacher && (
                                                            <select style={{ ...styles.linkSelect, borderColor: user.teacher ? '#ddd' : '#ffc107' }}
                                                                value={user.teacher ? String(user.teacher.teacherId) : ''} disabled={busy}
                                                                onChange={e => handleLinkTeacher(user, e.target.value)}
                                                                aria-label={`Teacher record for ${user.username}`}>
                                                                <option value="">{user.teacher ? '— Unlink —' : 'Link teacher record…'}</option>
                                                                {[...teachers].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)).map(t => {
                                                                    const takenBy = users.find(u => u.userId !== user.userId && u.teacher?.teacherId === t.teacherId);
                                                                    return (
                                                                        <option key={t.teacherId} value={String(t.teacherId)} disabled={!!takenBy}>
                                                                            {t.firstName} {t.lastName}{takenBy ? ` (login: ${takenBy.username})` : ''}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <span style={styles.usernameText}>{user.username}</span>
                                                {self && <span style={styles.youBadge}>You</span>}
                                                {user.mustChangePassword && <span style={styles.tempBadge} title="Has not yet chosen their own password">Temp password</span>}
                                                {isLocked(user) && <span style={styles.lockedBadge}><Icon name="lock-fill" style={{ marginRight: '3px' }} />Locked</span>}
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ ...styles.roleBadge, backgroundColor: getRoleColor(user.role) }}>
                                                    <Icon name={getRoleIcon(user.role)} style={{ marginRight: '4px' }} />{user.role}
                                                </span>
                                            </td>
                                            <td style={styles.td}>
                                                {linkedClass ? (
                                                    <span style={{ ...styles.classBadge, borderLeft: `3px solid ${section?.color || '#1F3864'}` }}>{classDisplayName(linkedClass)}</span>
                                                ) : isTeacher ? (
                                                    <span style={styles.unassignedBadge}><Icon name="exclamation-triangle-fill" style={{ marginRight: '4px' }} />Not assigned</span>
                                                ) : <span style={styles.naText}>—</span>}
                                            </td>
                                            <td style={styles.td}>
                                                {linkedClass ? <span style={styles.studentCount}><Icon name="people-fill" style={{ marginRight: '4px' }} />{classStudents.length}</span> : <span style={styles.naText}>—</span>}
                                            </td>
                                            <td style={styles.td}>
                                                {isTeacher ? (
                                                    <select style={styles.assignSelect} value="" disabled={busy}
                                                        onChange={e => handleAssignClass(user, e.target.value)}
                                                        aria-label={`Assign a class to ${user.username}`}>
                                                        <option value="">{busy ? 'Saving…' : linkedClass ? 'Reassign…' : 'Assign class…'}</option>
                                                        {sections.map(sec => {
                                                            const opts = sortedClasses(classes.filter(c => c.section === sec.value));
                                                            return opts.length ? (
                                                                <optgroup key={sec.value} label={sec.label}>
                                                                    {opts.map(cls => (
                                                                        <option key={cls.classId} value={cls.classId} disabled={String(cls.classId) === String(linkedClass?.classId)}>
                                                                            {classDisplayName(cls)}{String(cls.classId) === String(linkedClass?.classId) ? ' (current)' : ''}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            ) : null;
                                                        })}
                                                        {otherClasses.length > 0 && (
                                                            <optgroup label="Other">
                                                                {sortedClasses(otherClasses).map(cls => <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>)}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                ) : <span style={styles.naText}>—</span>}
                                            </td>
                                            <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                                {isLocked(user) && (
                                                    <button onClick={() => handleUnlock(user)} disabled={busy} style={styles.unlockBtn} title="Let them log in again now">
                                                        <Icon name="unlock-fill" style={{ marginRight: '4px' }} />Unlock
                                                    </button>
                                                )}
                                                <button onClick={() => handleResetPassword(user)} disabled={busy || self} style={{ ...styles.resetBtn, opacity: self ? 0.4 : 1 }}
                                                    title={self ? 'Use Change Password for your own account' : `Set a temporary password for ${user.username}`}>
                                                    <Icon name="key-fill" style={{ marginRight: '4px' }} />Reset
                                                </button>
                                                <button onClick={() => handleDelete(user)} disabled={busy || self || lastAdmin}
                                                    title={self ? "You can't delete your own account" : lastAdmin ? "You can't delete the last admin" : `Delete ${user.username}`}
                                                    style={{ ...styles.deleteBtn, opacity: self || lastAdmin ? 0.4 : 1, cursor: self || lastAdmin ? 'not-allowed' : 'pointer' }}>
                                                    <Icon name="trash-fill" style={{ marginRight: '4px' }} />Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="8" style={styles.emptyRow}><Icon name="inbox" />{search ? `No users match "${search}"` : 'No users found'}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {classesWithoutLogin.length > 0 && (
                    <div style={styles.warningCard}>
                        <strong style={styles.warningTitle}>
                            <Icon name="exclamation-triangle-fill" />{classesWithoutLogin.length} class(es) have no teacher login — nobody can enter their marks except admins:
                        </strong>
                        <div style={styles.chipRow}>
                            {sortedClasses(classesWithoutLogin).map(cls => <span key={cls.classId} style={styles.chip}>{classDisplayName(cls)}</span>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
        <Footer />
    </div>
    );
}

const styles = {
    linkSelect: { display: 'block', marginTop: '4px', padding: '3px 6px', borderRadius: '6px', border: '1.5px solid #ddd', fontSize: '12px', maxWidth: '190px', backgroundColor: 'white' },
    tempBadge: { marginLeft: '6px', backgroundColor: '#fff3cd', color: '#856404', padding: '1px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' },
    lockedBadge: { marginLeft: '6px', backgroundColor: '#f8d7da', color: '#721c24', padding: '1px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    unlockBtn: { backgroundColor: '#fd7e14', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginRight: '5px', display: 'inline-flex', alignItems: 'center' },
    resetBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginRight: '5px', display: 'inline-flex', alignItems: 'center' },
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 4px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' },

    error: { color: '#dc3545', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    warning: { color: '#856404', padding: '10px 15px', backgroundColor: '#fff8e1', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffc107' },
    linkBtn: { background: 'none', border: 'none', color: '#1F3864', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold', padding: 0, marginLeft: '6px' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },

    summaryBar: { backgroundColor: 'white', borderRadius: '14px', padding: '15px 25px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flexWrap: 'wrap' },
    summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px', flex: 1 },
    summaryNum: { fontSize: '28px', fontWeight: 'bold', lineHeight: 1 },
    summaryLabel: { fontSize: '11px', color: '#888', marginTop: '3px', textAlign: 'center' },
    summaryDivider: { width: '1px', height: '40px', backgroundColor: '#eee' },

    formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0' },
    formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', alignItems: 'start' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    formNote: { color: '#666', fontSize: '12px', margin: '12px 0 0 0' },
    fieldHint: { fontSize: '11px', color: '#dc3545' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    passwordWrap: { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: 'white' },
    passwordInput: { flex: 1, minWidth: 0, padding: '9px', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent', borderRadius: '8px' },
    eyeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '0 10px', fontSize: '16px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' },

    filterBar: { display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'center' },
    searchBox: { flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '9px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    roleTabs: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    roleTab: { padding: '7px 12px', borderRadius: '8px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' },
    tabCount: { backgroundColor: 'rgba(0,0,0,0.12)', padding: '1px 5px', borderRadius: '8px', fontSize: '11px' },

    tableCard: { backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px', overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '860px' },
    thead: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', backgroundColor: '#1F3864' },
    td: { padding: '11px 14px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },

    nameCell: { display: 'flex', alignItems: 'center', gap: '8px' },
    avatar: { width: '32px', height: '32px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 },
    nameText: { fontWeight: 'bold', color: '#1F3864' },
    noName: { color: '#aaa', fontStyle: 'italic', fontWeight: 'normal' },
    usernameText: { fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', color: '#555' },
    youBadge: { marginLeft: '6px', backgroundColor: '#2E75B6', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' },

    roleBadge: { color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    classBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', paddingLeft: '8px' },
    unassignedBadge: { color: '#e65100', backgroundColor: '#fff3e0', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', display: 'inline-flex', alignItems: 'center' },
    naText: { color: '#ccc' },
    studentCount: { color: '#2E75B6', fontWeight: 'bold', fontSize: '13px' },

    assignSelect: { padding: '6px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', width: '160px', backgroundColor: 'white' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap' },
    emptyRow: { textAlign: 'center', padding: '30px', color: '#999' },
    loadingCard: { backgroundColor: 'white', padding: '40px', borderRadius: '14px', textAlign: 'center', color: '#666' },

    warningCard: { backgroundColor: '#fff8e1', border: '2px solid #ffc107', borderRadius: '14px', padding: '15px 20px' },
    warningTitle: { color: '#856404', display: 'block', marginBottom: '10px', fontSize: '14px' },
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    chip: { backgroundColor: '#fff3cd', color: '#856404', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: '1px solid #ffc107' },
};

export default Users;
