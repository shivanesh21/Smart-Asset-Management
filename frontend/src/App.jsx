import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import AppLayout       from './components/AppLayout.jsx';
import LoginPage       from './pages/LoginPage.jsx';
import DashboardPage   from './pages/DashboardPage.jsx';
import AssetsPage      from './pages/AssetsPage.jsx';
import AssetDetailsPage from './pages/AssetDetailsPage.jsx';
import AllocationsPage from './pages/AllocationsPage.jsx';
import MaintenancePage from './pages/MaintenancePage.jsx';
import MaintenanceDetailsPage from './pages/MaintenanceDetailsPage.jsx';
import StaffPage        from './pages/StaffPage.jsx';
import NotFoundPage    from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected shell */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index          element={<DashboardPage />} />
                  <Route path="assets"      element={<AssetsPage />} />
                  <Route path="assets/:id"  element={<AssetDetailsPage />} />
                  <Route path="allocations" element={<AllocationsPage />} />
                  <Route path="maintenance" element={<MaintenancePage />} />
                  <Route path="maintenance/:id" element={<MaintenanceDetailsPage />} />
                  <Route path="staff"       element={<StaffPage />} />
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
