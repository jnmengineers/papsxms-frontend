import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { streamLabel, classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { SECTION_COLOR_PAIRS, SECTION_NAMES_LIVE, GRADE_ORDER_LIVE, SECTION_OF_GRADE_LIVE, SECTION_CODES, gradeFromClassName } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

// Sections, grades and colours come from School Settings
const SECTION_COLORS = SECTION_COLOR_PAIRS;
const SECTION_LABELS = SECTION_NAMES_LIVE;
const GRADE_ORDER = GRADE_ORDER_LIVE;

const extractGrade = (className) => gradeFromClassName(className);
const extractSection = (gradeOrName) => {
    const g = GRADE_ORDER_LIVE.includes(String(gradeOrName || '').toUpperCase()) ? String(gradeOrName).toUpperCase() : extractGrade(gradeOrName);
    return SECTION_OF_GRADE_LIVE[g] || '';
};
const gradeOfClass = (c) => c.gradeLevel || extractGrade(c.className);
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};

function ClassSubjects() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [classes, setClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [refLoaded, setRefLoaded] = useState(false);
    // The chosen grade lives in the URL (?grade=G4): Back/refresh/links keep it
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedGrade = searchParams.get('grade') || '';
    // coverage[subjectId] = { subject, classIds: Set } — which streams of the grade have each subject
    const [coverage, setCoverage] = useState({});
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [removingId, setRemovingId] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const latestGrade = useRef('');
    const successTimer = useRef(null);

    useEffect(() => {
        Promise.allSettled([api.get('/api/classes'), api.get('/api/subjects')]).then(([c, s]) => {
            if (c.status === 'fulfilled') setClasses(c.value.data || []); else setError('Failed to load classes. Refresh the page.');
            if (s.status === 'fulfilled') setAllSubjects(s.value.data || []); else setError('Failed to load subjects. Refresh the page.');
            setRefLoaded(true);
        });
        return () => clearTimeout(successTimer.current);
    }, []);

    // Whenever the grade in the URL changes (click, Back, refresh), load its subjects
    useEffect(() => {
        setSelectedIds([]);
        if (!selectedGrade) { latestGrade.current = ''; setCoverage({}); return; }
        if (refLoaded) loadCoverage(selectedGrade);
    }, [selectedGrade, refLoaded]);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 5000);
    };

    const getClassesForGrade = (g) => classes.filter(c => gradeOfClass(c) === g)
        .sort((a, b) => String(a.stream || '').localeCompare(String(b.stream || '')));
    const getSectionForGrade = (g) => classes.find(c => gradeOfClass(c) === g)?.section || extractSection(g);

    // Load subjects of EVERY stream (not just the first) so partly-assigned subjects show up
    const loadCoverage = async (grade) => {
        latestGrade.current = grade;
        const streams = getClassesForGrade(grade);
        if (!streams.length) { setCoverage({}); setLoading(false); return; }
        setLoading(true);
        const outs = await Promise.allSettled(streams.map(c => api.get(`/api/class-subjects/by-class/${c.classId}`)));
        if (latestGrade.current !== grade) return; // another grade was picked meanwhile
        const cov = {};
        let failed = 0;
        outs.forEach((o, i) => {
            if (o.status !== 'fulfilled') { failed++; return; }
            (o.value.data || []).forEach(cs => {
                const s = cs.subject;
                if (!s?.subjectId) return;
                if (!cov[s.subjectId]) cov[s.subjectId] = { subject: s, classIds: new Set() };
                cov[s.subjectId].classIds.add(String(streams[i].classId));
            });
        });
        setCoverage(cov);
        if (failed) setError(`Could not load subjects for ${failed} stream(s) — what you see may be incomplete.`);
        setLoading(false);
    };

    const selectGrade = (grade) => {
        if (grade === selectedGrade) return;
        setError('');
        setSearchParams({ grade });
    };

    const streams = selectedGrade ? getClassesForGrade(selectedGrade) : [];
    const streamCount = streams.length;
    const currentSection = selectedGrade ? getSectionForGrade(selectedGrade) : '';
    const color = SECTION_COLORS[currentSection] || { bg: '#1F3864', light: '#e3f2fd' };
    const covCount = (id) => coverage[id]?.classIds.size || 0;
    const isFull = (id) => streamCount > 0 && covCount(id) >= streamCount;

    // Tiles = this section's subjects, identified by ID (the same name can exist in several sections)
    const sectionSubjects = allSubjects
        .filter(s => extractSection(s.gradeLevel) === currentSection)
        .sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName)));
    const unsectioned = allSubjects.filter(s => !extractSection(s.gradeLevel)).length;
    const assignedList = Object.values(coverage).sort((a, b) => String(a.subject.subjectName).localeCompare(String(b.subject.subjectName)));

    const toggleTile = (id) => {
        if (isFull(id)) return;
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const selectAll = () => setSelectedIds(sectionSubjects.filter(s => !isFull(s.subjectId)).map(s => s.subjectId));

    const handleBulkAssign = async () => {
        if (!selectedGrade || !selectedIds.length || saving) return;
        setSaving(true); setError(''); setSuccessMsg('');
        const count = selectedIds.length;
        const jobs = [];
        selectedIds.forEach(id => {
            const subject = allSubjects.find(s => s.subjectId === id) || coverage[id]?.subject;
            if (!subject) return;
            streams.forEach(cls => {
                if (!coverage[id]?.classIds.has(String(cls.classId))) jobs.push({ subject, cls }); // only streams missing it
            });
        });
        const outs = await Promise.allSettled(jobs.map(j => api.post(`/api/class-subjects/assign/class/${j.cls.classId}/subject/${j.subject.subjectId}`)));
        const failures = [];
        outs.forEach((o, i) => { if (o.status === 'rejected') failures.push(`${jobs[i].subject.subjectName} → ${classDisplayName(jobs[i].cls)}: ${serverMessage(o.reason, 'failed')}`); });
        const ok = jobs.length - failures.length;
        setSaving(false);
        setSelectedIds([]);
        await loadCoverage(selectedGrade);
        if (failures.length) setError(`${ok} assignment(s) saved, ${failures.length} failed:\n• ${failures.join('\n• ')}`);
        else flashSuccess(`${count} subject(s) now on all ${streamCount} stream(s) of ${selectedGrade}.`);
    };

    const handleRemove = async (entry) => {
        const { subject, classIds } = entry;
        const targets = streams.filter(c => classIds.has(String(c.classId)));
        const where = targets.length === streamCount ? 'ALL streams' : targets.map(classDisplayName).join(', ');
        if (!window.confirm(`Remove "${subject.subjectName}" from ${where} of ${selectedGrade}?\n\nIf marks have already been entered for it, the server may refuse.`)) return;
        setRemovingId(subject.subjectId); setError('');
        const outs = await Promise.allSettled(targets.map(c => api.delete(`/api/class-subjects/remove/class/${c.classId}/subject/${subject.subjectId}`)));
        const failures = outs.map((o, i) => o.status === 'rejected' ? `${classDisplayName(targets[i])}: ${serverMessage(o.reason, 'failed')}` : null).filter(Boolean);
        setRemovingId(null);
        await loadCoverage(selectedGrade);
        if (failures.length) setError(`"${subject.subjectName}" could not be removed from ${failures.length} stream(s):\n• ${failures.join('\n• ')}`);
        else flashSuccess(`"${subject.subjectName}" removed from ${selectedGrade}.`);
    };

    // Grades grouped by section
    const gradesBySection = (() => {
        const map = {};
        classes.forEach(cls => {
            const g = gradeOfClass(cls), sec = cls.section || extractSection(g);
            if (!g || !SECTION_COLORS[sec]) return;
            if (!map[g]) map[g] = { gradeLevel: g, section: sec, streams: [] };
            map[g].streams.push(cls);
        });
        const grouped = Object.fromEntries(SECTION_CODES.map(code => [code, []]));
        Object.values(map).forEach(g => grouped[g.section].push(g));
        Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => GRADE_ORDER.indexOf(a.gradeLevel) - GRADE_ORDER.indexOf(b.gradeLevel)));
        return grouped;
    })();

    const streamsMissing = (entry) => streams.filter(c => !entry.classIds.has(String(c.classId)));
    const gradeUnknown = refLoaded && selectedGrade && streamCount === 0;

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <h2 style={styles.title}><Icon name="link-45deg" style={{ marginRight: '10px' }} />Class Subject Assignment</h2>
                <p style={styles.subtitle}>Assign subjects by grade level — every stream of the grade gets them</p>

                {error && (
                    <div style={styles.error} role="alert">
                        <Icon name="exclamation-triangle-fill" /><span style={{ whiteSpace: 'pre-line', flex: 1 }}>{error}</span>
                        <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                    </div>
                )}
                {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                <div style={styles.mainGrid}>
                    {/* LEFT — Grade Selection */}
                    <div style={styles.leftCol}>
                        <div style={styles.panelCard}>
                            <h3 style={styles.panelTitle}><Icon name="building" />Select Grade Level</h3>
                            <p style={styles.hint}>All streams of the grade share the same subjects</p>

                            {!refLoaded && <p style={styles.noData}><Icon name="hourglass-split" />Loading…</p>}
                            {Object.entries(gradesBySection).map(([sectionKey, grades]) => grades.length > 0 && (
                                <div key={sectionKey} style={styles.sectionGroup}>
                                    <div style={{ ...styles.sectionGroupTitle, backgroundColor: SECTION_COLORS[sectionKey].bg }}>{SECTION_LABELS[sectionKey]}</div>
                                    {grades.map(grade => {
                                        const active = selectedGrade === grade.gradeLevel;
                                        return (
                                            <button key={grade.gradeLevel} type="button" onClick={() => selectGrade(grade.gradeLevel)}
                                                aria-pressed={active}
                                                style={{
                                                    ...styles.gradeItem,
                                                    backgroundColor: active ? SECTION_COLORS[sectionKey].bg : SECTION_COLORS[sectionKey].light,
                                                    color: active ? 'white' : '#333',
                                                    borderLeft: `4px solid ${SECTION_COLORS[sectionKey].bg}`
                                                }}>
                                                <div style={styles.gradeItemLeft}>
                                                    <strong style={{ fontSize: '15px' }}>{grade.gradeLevel}</strong>
                                                    <span style={styles.streamCount}>{grade.streams.length} stream{grade.streams.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                <div style={styles.streamTags}>
                                                    {grade.streams.map(s => (
                                                        <span key={s.classId} style={{ ...styles.streamTag, backgroundColor: active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)' }}>
                                                            {streamLabel(s.stream) || classDisplayName(s)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                            {refLoaded && classes.length === 0 && <p style={styles.noData}>No classes found. Add classes first.</p>}
                        </div>
                    </div>

                    {/* RIGHT — Subject Assignment */}
                    <div style={styles.rightCol}>
                        {!selectedGrade || gradeUnknown ? (
                            <div style={styles.emptyState}>
                                <Icon name={gradeUnknown ? 'question-circle' : 'arrow-left-circle'} style={{ fontSize: '44px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '12px' }} />
                                <h3>{gradeUnknown ? `No classes in ${selectedGrade}` : 'Select a Grade Level'}</h3>
                                <p style={{ color: '#666' }}>{gradeUnknown ? 'Pick another grade from the list.' : 'Choose a grade. Subjects you assign go to all of its streams at once.'}</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ ...styles.streamsBanner, backgroundColor: color.bg }}>
                                    <div>
                                        <h3 style={styles.bannerTitle}>{selectedGrade} — {SECTION_LABELS[currentSection] || 'Unknown section'}</h3>
                                        <p style={styles.bannerSubtitle}>{streamCount} stream(s): {streams.map(classDisplayName).join(', ')}</p>
                                    </div>
                                    <div style={styles.bannerBadge}><Icon name="bullseye" />Target: {streams[0]?.meanTarget ?? '-'}%</div>
                                </div>

                                <div style={styles.panelCard}>
                                    <div style={styles.subjectHeader}>
                                        <div>
                                            <h3 style={styles.panelTitle}><Icon name="journals" />Available Subjects</h3>
                                            <p style={styles.hint}>Click to select • Green = on every stream • Amber = only on some streams</p>
                                        </div>
                                        <div style={styles.actionBtns}>
                                            <button onClick={selectAll} style={styles.selectAllBtn} disabled={loading}><Icon name="check2-all" />Select All</button>
                                            <button onClick={() => setSelectedIds([])} style={styles.clearSelBtn}><Icon name="x-lg" />Clear</button>
                                        </div>
                                    </div>

                                    {loading ? <p style={styles.noData}><Icon name="hourglass-split" />Loading…</p> : sectionSubjects.length === 0 ? (
                                        <p style={styles.noData}>No subjects exist for {SECTION_LABELS[currentSection] || 'this section'} yet. Add them on the Subjects page.</p>
                                    ) : (
                                        <div style={styles.tilesGrid}>
                                            {sectionSubjects.map(s => {
                                                const n = covCount(s.subjectId);
                                                const full = isFull(s.subjectId);
                                                const partial = n > 0 && !full;
                                                const selected = selectedIds.includes(s.subjectId);
                                                return (
                                                    <button key={s.subjectId} type="button" onClick={() => toggleTile(s.subjectId)}
                                                        disabled={full} aria-pressed={selected}
                                                        style={{
                                                            ...styles.subjectTile,
                                                            backgroundColor: full ? '#e8f5e9' : selected ? color.bg : partial ? '#fff8e1' : 'white',
                                                            color: full ? '#1e7e34' : selected ? 'white' : '#333',
                                                            border: `2px solid ${full ? '#28a745' : selected ? color.bg : partial ? '#ffc107' : '#eee'}`,
                                                            cursor: full ? 'default' : 'pointer'
                                                        }}>
                                                        <i className={`bi bi-${full ? 'check-circle-fill' : selected ? 'check-square-fill' : partial ? 'circle-half' : 'book'}`} aria-hidden="true" style={{ fontSize: '20px' }} />
                                                        <span style={styles.tileName}>{s.subjectName}</span>
                                                        <span style={{ fontSize: '10px', opacity: 0.8 }}>{s.subjectCode}</span>
                                                        {full && <span style={{ ...styles.tag, backgroundColor: '#28a745' }}>All streams</span>}
                                                        {partial && !selected && <span style={{ ...styles.tag, backgroundColor: '#ffc107', color: '#5c4400' }}>{n} of {streamCount} streams</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {unsectioned > 0 && (
                                        <p style={styles.hint}><Icon name="info-circle" />{unsectioned} subject(s) have no section set and aren't shown — edit them on the Subjects page.</p>
                                    )}

                                    {selectedIds.length > 0 && (
                                        <div style={styles.assignSection}>
                                            <div><strong>{selectedIds.length}</strong> subject(s) selected<span style={styles.assignNote}>added to every {selectedGrade} stream that doesn't have them</span></div>
                                            <button onClick={handleBulkAssign} style={{ ...styles.assignBtn, backgroundColor: color.bg, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                                                {saving ? <><Icon name="hourglass-split" />Assigning…</> : <><Icon name="plus-circle" />Assign to All {selectedGrade} Streams</>}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div style={styles.panelCard}>
                                    <h3 style={styles.panelTitle}>
                                        <Icon name="check-circle-fill" />Assigned Subjects
                                        <span style={{ ...styles.countBadge, backgroundColor: color.bg }}>{assignedList.length}</span>
                                    </h3>
                                    {loading ? <p style={styles.noData}><Icon name="hourglass-split" />Loading…</p> : assignedList.length === 0 ? (
                                        <p style={styles.noData}>No subjects assigned yet. Select subjects above and click Assign.</p>
                                    ) : (
                                        <div style={styles.assignedGrid}>
                                            {assignedList.map((entry, index) => {
                                                const missing = streamsMissing(entry);
                                                const otherSection = extractSection(entry.subject.gradeLevel) !== currentSection;
                                                const busy = removingId === entry.subject.subjectId;
                                                return (
                                                    <div key={entry.subject.subjectId} style={styles.assignedItem}>
                                                        <div style={styles.assignedLeft}>
                                                            <span style={{ ...styles.assignedNum, backgroundColor: color.bg }}>{index + 1}</span>
                                                            <div style={{ minWidth: 0 }}>
                                                                <strong style={styles.assignedName}>{entry.subject.subjectName}</strong>
                                                                <div style={styles.assignedMeta}>
                                                                    <Icon name="tag" style={{ marginRight: '3px' }} />{entry.subject.subjectCode}
                                                                    {' | '}
                                                                    {missing.length === 0
                                                                        ? `All ${streamCount} stream(s)`
                                                                        : <span style={{ color: '#b26a00', fontWeight: 600 }}>Missing on {missing.map(classDisplayName).join(', ')}</span>}
                                                                    {otherSection && <span style={{ color: '#b26a00' }}> | from another section</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                            {missing.length > 0 && (
                                                                <button onClick={() => setSelectedIds(ids => ids.includes(entry.subject.subjectId) ? ids : [...ids, entry.subject.subjectId])}
                                                                    style={{ ...styles.removeBtn, backgroundColor: '#ffc107', color: '#5c4400' }} title="Selects it above so you can add it to the missing streams">
                                                                    <Icon name="plus-lg" style={{ marginRight: '4px' }} />Add to missing
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleRemove(entry)} style={styles.removeBtn} disabled={busy}>
                                                                {busy ? <Icon name="hourglass-split" style={{ marginRight: 0 }} /> : <><Icon name="x-lg" style={{ marginRight: '4px' }} />Remove</>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
           </div>
            <Footer />
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', marginBottom: '25px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'flex-start' },
    dismissBtn: { marginLeft: '8px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    hint: { color: '#888', fontSize: '12px', margin: '0 0 10px 0', fontStyle: 'italic' },
    mainGrid: { display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' },
    leftCol: { flex: '1 1 260px' },
    rightCol: { flex: '999 1 420px', minWidth: 0 },
    panelCard: { backgroundColor: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
    panelTitle: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center' },
    sectionGroup: { marginBottom: '15px' },
    sectionGroupTitle: { color: 'white', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' },
    gradeItem: { display: 'block', width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: '10px', marginBottom: '7px', cursor: 'pointer', transition: 'all 0.2s', border: 'none', fontFamily: 'inherit' },
    gradeItemLeft: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' },
    streamCount: { fontSize: '11px', opacity: 0.85 },
    streamTags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
    streamTag: { fontSize: '10px', padding: '2px 7px', borderRadius: '6px' },
    noData: { color: '#888', textAlign: 'center', padding: '20px', fontStyle: 'italic' },
    emptyState: { backgroundColor: 'white', borderRadius: '14px', padding: '60px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    streamsBanner: { borderRadius: '14px', padding: '16px 22px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    bannerTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '18px', fontWeight: 700 },
    bannerSubtitle: { color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '13px' },
    bannerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' },
    subjectHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' },
    actionBtns: { display: 'flex', gap: '8px' },
    selectAllBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center' },
    clearSelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center' },
    tilesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '15px' },
    subjectTile: { padding: '14px 10px', borderRadius: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', transition: 'all 0.15s', userSelect: 'none', fontFamily: 'inherit' },
    tileName: { fontSize: '12px', fontWeight: 'bold', lineHeight: '1.3' },
    tag: { fontSize: '10px', color: 'white', padding: '2px 8px', borderRadius: '10px' },
    assignSection: { borderTop: '2px solid #f0f2f5', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    assignNote: { color: '#666', fontSize: '12px', marginLeft: '8px', fontStyle: 'italic' },
    assignBtn: { color: 'white', border: 'none', padding: '11px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' },
    countBadge: { color: 'white', padding: '2px 9px', borderRadius: '10px', fontSize: '12px', marginLeft: '8px' },
    assignedGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
    assignedItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 15px', backgroundColor: '#f8f9fa', borderRadius: '10px', border: '1px solid #f0f0f0', gap: '10px', flexWrap: 'wrap' },
    assignedLeft: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
    assignedNum: { color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 },
    assignedName: { fontSize: '14px', color: '#1F3864' },
    assignedMeta: { fontSize: '11px', color: '#888', marginTop: '2px' },
    removeBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }
};

export default ClassSubjects;
