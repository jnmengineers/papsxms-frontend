import React from 'react';
import { Navigate } from 'react-router-dom';

function PrivateRoute({ children, allowedRoles }) {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    // Not logged in
    if (!token) {
        return <Navigate to="/" />;
    }

    // Role not allowed
    if (allowedRoles && !allowedRoles.includes(role)) {
        return <Navigate to="/unauthorized" />;
    }

    return children;
}

export default PrivateRoute;