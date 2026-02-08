import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load pages for performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const StudentDetails = lazy(() => import('./pages/StudentDetails'));
const Coaches = lazy(() => import('./pages/Coaches'));
const CoachDetails = lazy(() => import('./pages/CoachDetails'));
const Finance = lazy(() => import('./pages/Finance'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Settings = lazy(() => import('./pages/Settings'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Login = lazy(() => import('./pages/Login'));

const Register = lazy(() => import('./pages/Register'));
const PublicRegistration = lazy(() => import('./pages/PublicRegistration'));
const AdminCameras = lazy(() => import('./pages/AdminCameras'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const PersonalDashboard = lazy(() => import('./pages/PersonalDashboard'));
const StudentAttendance = lazy(() => import('./pages/StudentAttendance'));
const StaffAttendance = lazy(() => import('./pages/StaffAttendance'));
const PTAttendance = lazy(() => import('./pages/PTAttendance'));

// Premium Loading Fallback
const PageLoader = () => (
  <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8">
    <div className="relative w-24 h-24 mb-8">
      <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
    </div>
    <div className="text-white/40 font-black tracking-[0.5em] text-xs uppercase animate-pulse">
      Healy Academy
    </div>
  </div>
);


import { initializeTheme } from './utils/theme';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';

import BackButtonHandler from './components/BackButtonHandler';

function App() {
  console.log('App: Rendering component');
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n) {
      document.dir = i18n.dir();
      document.documentElement.lang = i18n.language;
    }
  }, [i18n, i18n?.language]);



  return (
    <CurrencyProvider>
      <ThemeProvider>
        <BrowserRouter>
          <BackButtonHandler />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-surface)',
                color: 'inherit', // Uses body color which adapts to theme
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                border: '1px solid rgba(128,128,128,0.1)',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '15px',
                fontWeight: '500',
              },
              success: {
                iconTheme: {
                  primary: 'var(--color-primary)',
                  secondary: 'var(--color-surface)',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: 'var(--color-surface)',
                },
              },
            }}
          />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/registration" element={<PublicRegistration />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="students" element={<Students />} />
                  <Route path="students/:id" element={<StudentDetails />} />
                  <Route path="coaches" element={<Coaches />} />
                  <Route path="coaches/:id" element={<CoachDetails />} />
                  <Route path="finance" element={<Finance />} />
                  <Route path="calculator" element={<Calculator />} />

                  <Route path="schedule" element={<Schedule />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="my-work" element={<PersonalDashboard />} />
                  <Route path="admin/cameras" element={<AdminCameras />} />

                  {/* Attendance Pages */}
                  <Route path="attendance/students" element={<StudentAttendance />} />
                  <Route path="attendance/staff" element={<StaffAttendance />} />
                  <Route path="attendance/pt" element={<PTAttendance />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </CurrencyProvider>
  )
}

export default App;
