import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { setGradingScale } from '../utils/grading';
import { setSchoolProfile } from '../utils/school';
import { applySchoolData } from '../utils/schoolData';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

/**
 * School settings from the DATABASE, loaded once after login and shared with every page:
 *   const { profile, sections, grades, streams, examTypes, sectionName, gradeName, … } = useSchoolSettings();
 * Also loads the Grading Scales table into utils/grading.js (gradeOf, pctColor, …).
 *
 * There are no built-in copies of these values: if they can't be loaded, a bar at the top
 * of the screen says so and offers to try again.
 */
const EMPTY = { profile: null, sections: [], grades: [], streams: [], examTypes: [], gradingScale: [] };

const SchoolSettingsContext = createContext(null);

export function SchoolSettingsProvider({ children }) {
    const [data, setData] = useState(EMPTY);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [version, setVersion] = useState(0);       // bumps when grading changes, so pages re-draw

    const reload = useCallback(async () => {
        if (!localStorage.getItem('token')) { setLoaded(true); return; }
        const [s, g] = await Promise.allSettled([api.get('/api/settings'), api.get('/api/grading-scales')]);
        if (s.status === 'fulfilled') {
            const d = s.value.data || {};
            setSchoolProfile(d.profile || null);
            applySchoolData({ sections: d.sections || [], grades: d.grades || [], streams: d.streams || [], examTypes: d.examTypes || [] });
            setData(prev => ({ ...prev, profile: d.profile || null, sections: d.sections || [], grades: d.grades || [], streams: d.streams || [], examTypes: d.examTypes || [] }));
        }
        if (g.status === 'fulfilled') {
            setGradingScale(g.value.data || []);
            setData(prev => ({ ...prev, gradingScale: g.value.data || [] }));
        }
        setLoadError(s.status === 'rejected' || g.status === 'rejected');
        setVersion(v => v + 1);
        setLoaded(true);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const find = (list, code) => list.find(x => String(x.code).toUpperCase() === String(code || '').toUpperCase());
    const value = {
        ...data, loaded, loadError, reload, version,
        logoLeft: data.profile?.logoLeft || logo1,
        logoRight: data.profile?.logoRight || logo2,
        schoolName: data.profile?.name || '',
        sectionName: (code) => find(data.sections, code)?.name || code || '',
        sectionColor: (code) => find(data.sections, code)?.color || '#6c757d',
        sectionTarget: (code) => find(data.sections, code)?.meanTarget ?? null,
        gradeName: (code) => find(data.grades, code)?.name || code || '',
        gradeSection: (code) => find(data.grades, code)?.sectionCode || '',
        nextGrade: (code) => find(data.grades, code)?.nextGradeCode || null,
        gradesOf: (sectionCode) => data.grades.filter(g => g.sectionCode === sectionCode).map(g => g.code),
        gradeRank: (code) => find(data.grades, code)?.sortOrder ?? 99,
        streamName: (code) => find(data.streams, code)?.name || code || '',
        streamColor: (code) => find(data.streams, code)?.color || '#1F3864',
        examTypeName: (code) => find(data.examTypes, code)?.name || code || '',
        examTypeColor: (code) => find(data.examTypes, code)?.color || '#1F3864',
        coreExamTypes: data.examTypes.filter(t => t.core && t.active !== false).map(t => t.code),
    };
    return (
        <SchoolSettingsContext.Provider value={value}>
            {loadError && localStorage.getItem('token') && (
                <div role="alert" style={barStyle}>
                    <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" style={{ marginRight: '8px' }} />
                    School settings or the grading scale could not be loaded, so some names, colours and grades may be missing.
                    <button onClick={reload} style={retryStyle}>Try again</button>
                </div>
            )}
            {children}
        </SchoolSettingsContext.Provider>
    );
}

export function useSchoolSettings() {
    const ctx = useContext(SchoolSettingsContext);
    if (!ctx) throw new Error('useSchoolSettings must be used inside <SchoolSettingsProvider>');
    return ctx;
}

const barStyle = { position: 'sticky', top: 0, zIndex: 3000, backgroundColor: '#fff3cd', color: '#856404', borderBottom: '1px solid #ffc107', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' };
const retryStyle = { marginLeft: 'auto', background: '#856404', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontWeight: 'bold' };
