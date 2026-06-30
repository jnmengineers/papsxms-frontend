import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Results from './pages/Results';
import ReportCards from './pages/ReportCards';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Exams from './pages/Exams';
import GradingScales from './pages/GradingScales';
import AcademicYears from './pages/AcademicYears';
import ExamSchedules from './pages/ExamSchedules';
import Users from './pages/Users';
import Unauthorized from './components/Unauthorized';
import MarkEntry from './pages/MarkEntry';
import ClassSubjects from './pages/ClassSubjects';
import SectionReport from './pages/SectionReport';
import StudentProfile from './pages/StudentProfile';
import ChangePassword from './pages/ChangePassword';
import Import from './pages/Import';
import ProgressiveReport from './pages/ProgressiveReport';
import InactivityTimeout from './components/InactivityTimeout';
import UpdateChecker from './components/UpdateChecker';

function App() {
    return (
        <Router>
            <InactivityTimeout />
            <UpdateChecker />
            <Routes>
                {/* Public */}
                <Route path="/" element={<Login />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* All logged in users */}
                <Route path="/dashboard" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK']}>
                        <Dashboard />
                    </PrivateRoute>
                } />

                {/* ADMIN and TEACHER */}
                <Route path="/students" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER']}>
                        <Students />
                    </PrivateRoute>
                } />
                <Route path="/reportcards" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER']}>
                        <ReportCards />
                    </PrivateRoute>
                } />
                <Route path="/mark-entry" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK']}>
                        <MarkEntry />
                    </PrivateRoute>
                } />
                <Route path="/progressive-report" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER']}>
                        <ProgressiveReport />
                    </PrivateRoute>
                } />
                <Route path="/student/:studentId" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER']}>
                        <StudentProfile />
                    </PrivateRoute>
                } />

                {/* ADMIN, TEACHER and CLERK */}
                <Route path="/results" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK']}>
                        <Results />
                    </PrivateRoute>
                } />

                {/* ADMIN only */}
                <Route path="/teachers" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Teachers />
                    </PrivateRoute>
                } />
                <Route path="/classes" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Classes />
                    </PrivateRoute>
                } />
                <Route path="/subjects" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Subjects />
                    </PrivateRoute>
                } />
                <Route path="/exams" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Exams />
                    </PrivateRoute>
                } />
                <Route path="/grading-scales" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <GradingScales />
                    </PrivateRoute>
                } />
                <Route path="/academic-years" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <AcademicYears />
                    </PrivateRoute>
                } />
                <Route path="/exam-schedules" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <ExamSchedules />
                    </PrivateRoute>
                } />
                <Route path="/class-subjects" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <ClassSubjects />
                    </PrivateRoute>
                } />
                <Route path="/section-report" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <SectionReport />
                    </PrivateRoute>
                } />
                <Route path="/users" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Users />
                    </PrivateRoute>
                } />
                <Route path="/import" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Import />
                    </PrivateRoute>
                } />

                {/* All roles */}
                <Route path="/change-password" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK']}>
                        <ChangePassword />
                    </PrivateRoute>
                } />
            </Routes>
        </Router>
    );
}

export default App;