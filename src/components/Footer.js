import React from 'react';
import { schoolShortName } from '../utils/school';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

function Footer() {
    useSchoolSettings();   // re-draws when the school details have loaded
    return (
        <footer className="app-footer" style={styles.footer}>
            <span>© {new Date().getFullYear()} {schoolShortName() ? `${schoolShortName()} — ` : ''}Exam Management System</span>
            {/* Keep the footer off paper when a page is printed with Ctrl+P */}
            <style>{`@media print { .app-footer { display: none !important; } }`}</style>
        </footer>
    );
}

const styles = {
    footer: {
        textAlign: 'center', padding: '18px 20px',
        color: '#5f6672',            // was #999 — too faint to read on the light grey page
        fontSize: '12px', borderTop: '1px solid #e5e7eb',
        marginTop: 'auto'            // pushes the footer to the bottom when the page container is a flex column
    }
};

export default Footer;
