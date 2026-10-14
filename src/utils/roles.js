/**
 * The logged-in person's roles. Several can be ticked by the super admin (e.g. a teacher who is
 * also the treasurer). The server sends them all at login, including what they imply
 * (SUPER_ADMIN → also ADMIN; TREASURER → also ACCOUNTANT).
 */
export const ROLE_LABELS = {
    SUPER_ADMIN: 'Super admin', ADMIN: 'Admin', TREASURER: 'Treasurer', ACCOUNTANT: 'Bursar',
    CHAIRPERSON: 'Chairperson', HEAD_TEACHER: 'Head teacher', TEACHER: 'Teacher', CLERK: 'Clerk',
    DEPUTY_HEAD: 'Deputy head teacher', SENIOR_TEACHER: 'Senior teacher',
};

export const myRoles = () => {
    try {
        const r = JSON.parse(localStorage.getItem('roles') || 'null');
        if (Array.isArray(r) && r.length) return r;
    } catch (e) { /* older login */ }
    const one = localStorage.getItem('role');
    return one ? [one] : [];
};

export const hasRole = (...roles) => { const mine = myRoles(); return roles.some(r => mine.includes(r)); };
export const hasAnyRole = (list) => !list || hasRole(...list);

/**
 * The single role pages use for their own checks (role === 'ADMIN' …), chosen from everything
 * the person has: admin first, then teacher (keeps their class pages), then bursar/treasurer, …
 */
export const pageRoleFor = (roles) => {
    for (const r of ['ADMIN', 'TEACHER', 'ACCOUNTANT', 'CHAIRPERSON', 'CLERK']) if (roles.includes(r)) return r;
    return roles[0] || '';
};
