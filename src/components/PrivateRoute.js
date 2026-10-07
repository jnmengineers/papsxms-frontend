import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasAnyRole } from '../utils/roles';

function PrivateRoute({ children, allowedRoles }) {
    const location = useLocation();
    const token = localStorage.getItem('token');
    const mustChangePassword = localStorage.getItem('mustChangePassword') === 'true';

    // Not logged in
    if (!token) {
        return <Navigate to="/" replace />;
    }

    // Must set their own password first — every other page sends them back.
    // (The server also refuses every other request until this is done.)
    if (mustChangePassword && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />;
    }

    // Role not allowed
    if (allowedRoles && !hasAnyRole(allowedRoles)) {   // any of the person's roles will do
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
}

export default PrivateRoute;
