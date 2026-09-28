import React, { useState } from 'react';

/**
 * Shows a new login's temporary password ONCE, so the admin can pass it on privately.
 * login = { username, temporaryPassword, teacherName? }
 */
function TempPasswordNotice({ login, onClose }) {
    const [copied, setCopied] = useState(false);
    if (!login) return null;
    const text = `Username: ${login.username}\nTemporary password: ${login.temporaryPassword}`;
    const copy = async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); } catch (e) { setCopied(false); }
    };
    return (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="temp-pw-title">
            <div style={styles.box}>
                <h3 id="temp-pw-title" style={styles.title}>
                    <i className="bi bi-key-fill" aria-hidden="true" style={{ marginRight: '8px' }} />New login created
                </h3>
                <p style={styles.text}>
                    {login.teacherName ? <><strong>{login.teacherName}</strong> can now log in. </> : null}
                    Give them these details <strong>privately</strong>. They will choose their own password the first time they log in.
                </p>
                <div style={styles.cred}>
                    <div><span style={styles.lbl}>Username</span><code style={styles.code}>{login.username}</code></div>
                    <div><span style={styles.lbl}>Temporary password</span><code style={{ ...styles.code, fontSize: '20px', letterSpacing: '1px' }}>{login.temporaryPassword}</code></div>
                </div>
                <p style={styles.warn}>
                    <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" style={{ marginRight: '6px' }} />
                    This password is shown <strong>only once</strong>. Write it down or copy it now. If it's lost, use <strong>Reset</strong> on the Users page.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={copy} style={styles.secondary}>
                        <i className={`bi bi-${copied ? 'check2' : 'clipboard'}`} aria-hidden="true" style={{ marginRight: '6px' }} />{copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={onClose} style={styles.primary}>I've noted it down</button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    box: { backgroundColor: 'white', borderRadius: '14px', padding: '22px 24px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
    title: { color: '#1F3864', margin: '0 0 8px', display: 'flex', alignItems: 'center' },
    text: { color: '#444', fontSize: '14px', margin: '0 0 14px' },
    cred: { backgroundColor: '#f7fbff', border: '1px solid #d6e6f5', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' },
    lbl: { display: 'block', fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' },
    code: { fontFamily: 'monospace', fontSize: '16px', color: '#1F3864', fontWeight: 'bold' },
    warn: { color: '#856404', backgroundColor: '#fff8e1', border: '1px solid #ffc107', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', margin: '0 0 14px' },
    primary: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    secondary: { backgroundColor: 'white', color: '#1F3864', border: '2px solid #1F3864', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
};

export default TempPasswordNotice;
