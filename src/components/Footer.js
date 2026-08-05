import React from 'react';

function Footer() {
    return (
        <div style={styles.footer}>
            <span>© {new Date().getFullYear()} Pipeline Adventist School — Exam Management System</span>
        </div>
    );
}

const styles = {
    footer: {
        textAlign: 'center', padding: '18px 20px', color: '#999',
        fontSize: '12px', borderTop: '1px solid #e5e7eb', marginTop: 'auto'
    }
};

export default Footer;