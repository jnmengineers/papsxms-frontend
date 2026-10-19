import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Results from './pages/Results';
import ReportCards from './pages/ReportCards';
import Overview from './pages/Overview';
import Enquiries from './pages/Enquiries';
import SitePosts from './pages/SitePosts';
import DeletedMarks from './pages/DeletedMarks';
import JobApplications from './pages/JobApplications';
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
import AttendanceRegister from './pages/AttendanceRegister';
import Finance from './pages/Finance';
import Payroll from './pages/Payroll';
import Staff from './pages/Staff';
import MyLeave from './pages/MyLeave';
import Parents from './pages/Parents';
import MealsTransport from './pages/MealsTransport';
import Timetable from './pages/Timetable';
import Announcements from './pages/Announcements';
import Transport from './pages/Transport';
import ClassSubjects from './pages/ClassSubjects';
import SectionReport from './pages/SectionReport';
import StudentProfile from './pages/StudentProfile';
import ChangePassword from './pages/ChangePassword';
import Import from './pages/Import';
import ProgressiveReport from './pages/ProgressiveReport';
import InactivityTimeout from './components/InactivityTimeout';
import UpdateChecker from './components/UpdateChecker';
import { SidebarProvider } from './context/SidebarContext';
import { SchoolSettingsProvider } from './context/SchoolSettingsContext';
import Settings from './pages/Settings';
import ScrollToTop from './components/ScrollToTop';
import FormSpotlight from './components/FormSpotlight';

function App() {
    return (
        <SchoolSettingsProvider>
        <SidebarProvider>
        <Router>
             <ScrollToTop />
            <FormSpotlight />
            <InactivityTimeout />
            <UpdateChecker />
            <Routes>
                {/* Public */}
                <Route path="/" element={<Login />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* All logged in users */}
                <Route path="/dashboard" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT', 'CHAIRPERSON']}>
                        <Dashboard />
                    </PrivateRoute>
                } />

                {/* ADMIN, TEACHER and CLERK (clerk = school secretary) */}
                <Route path="/students" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'CHAIRPERSON']}>
                        <Students />
                    </PrivateRoute>
                } />
                <Route path="/job-applications" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                        <JobApplications />
                    </PrivateRoute>
                } />
                <Route path="/deleted-marks" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <DeletedMarks />
                    </PrivateRoute>
                } />
                <Route path="/site-posts" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'CLERK']}>
                        <SitePosts />
                    </PrivateRoute>
                } />
                <Route path="/enquiries" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'CLERK']}>
                        <Enquiries />
                    </PrivateRoute>
                } />
                <Route path="/overview" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'HEAD_TEACHER', 'CHAIRPERSON', 'SENIOR_TEACHER']}>
                        <Overview />
                    </PrivateRoute>
                } />
                <Route path="/reportcards" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'CHAIRPERSON']}>
                        <ReportCards />
                    </PrivateRoute>
                } />
                <Route path="/reportcards/class/:classKey" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'CHAIRPERSON']}>
                        <ReportCards />
                    </PrivateRoute>
                } />
                <Route path="/mark-entry" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK']}>
                        <MarkEntry />
                    </PrivateRoute>
                } />
                <Route path="/attendance" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CHAIRPERSON']}>
                        <AttendanceRegister />
                    </PrivateRoute>
                } />
                <Route path="/progressive-report" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'CHAIRPERSON']}>
                        <ProgressiveReport />
                    </PrivateRoute>
                } />
                <Route path="/student/:studentId" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK']}>
                        <StudentProfile />
                    </PrivateRoute>
                } />

                {/* ADMIN, TEACHER and CLERK */}
                <Route path="/results" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'CHAIRPERSON']}>
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
                    <PrivateRoute allowedRoles={['ADMIN', 'CHAIRPERSON']}>
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
                    <PrivateRoute allowedRoles={['ADMIN', 'CHAIRPERSON']}>
                        <SectionReport />
                    </PrivateRoute>
                } />
                <Route path="/users" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Users />
                    </PrivateRoute>
                } />
                <Route path="/settings" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Settings />
                    </PrivateRoute>
                } />
                <Route path="/import" element={
                    <PrivateRoute allowedRoles={['ADMIN']}>
                        <Import />
                    </PrivateRoute>
                } />

                {/* Everyone: timetable and notices */}
                <Route path="/timetable" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT', 'CHAIRPERSON']}>
                        <Timetable />
                    </PrivateRoute>
                } />
                <Route path="/announcements" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT', 'CHAIRPERSON']}>
                        <Announcements />
                    </PrivateRoute>
                } />

                {/* Class teachers tick meals, trips and bus users (own class, current term) */}
                <Route path="/meals-transport" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'ACCOUNTANT', 'TEACHER', 'CHAIRPERSON']}>
                        <MealsTransport />
                    </PrivateRoute>
                } />

                {/* ADMIN and ACCOUNTANT (bursar) */}
                <Route path="/finance" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'ACCOUNTANT', 'CHAIRPERSON']}>
                        <Finance />
                    </PrivateRoute>
                } />
                <Route path="/payroll" element={
                    <PrivateRoute allowedRoles={['TREASURER']}>
                        <Payroll />
                    </PrivateRoute>
                } />
                <Route path="/staff" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'CHAIRPERSON', 'HEAD_TEACHER', 'SENIOR_TEACHER']}>
                        <Staff />
                    </PrivateRoute>
                } />
                <Route path="/my-leave" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT']}>
                        <MyLeave />
                    </PrivateRoute>
                } />
                <Route path="/parents" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'CLERK', 'ACCOUNTANT']}>
                        <Parents />
                    </PrivateRoute>
                } />
                <Route path="/transport" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'ACCOUNTANT', 'CHAIRPERSON']}>
                        <Transport />
                    </PrivateRoute>
                } />

                {/* All roles */}
                <Route path="/change-password" element={
                    <PrivateRoute allowedRoles={['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT', 'CHAIRPERSON']}>
                        <ChangePassword />
                    </PrivateRoute>
                } />
            </Routes>
        </Router>
        </SidebarProvider>
        </SchoolSettingsProvider>
    );
}

export default App;
