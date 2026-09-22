import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { CreateReportPage } from './pages/CreateReportPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ArchivePage } from './pages/ArchivePage';
import { ImportPage } from './pages/ImportPage';
import { UnitAnalysisPage } from './pages/analysis/UnitAnalysisPage';
import { FieldAnalysisPage } from './pages/analysis/FieldAnalysisPage';
import { CompareAnalysisPage } from './pages/analysis/CompareAnalysisPage';
import { UnitsAdminPage } from './pages/admin/UnitsAdminPage';
import { FieldsAdminPage } from './pages/admin/FieldsAdminPage';
import { IndicatorsAdminPage } from './pages/admin/IndicatorsAdminPage';
import { SystemSettingsPage } from './pages/admin/SystemSettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SupabaseAdminPage } from './pages/admin/SupabaseAdminPage';
import { LoginPage } from './pages/LoginPage';
import { store, RolePermissionRule } from './services/store';

const ProtectedRoute: React.FC<{
  permission?: keyof RolePermissionRule['permissions'];
  anyOfPermissions?: Array<keyof RolePermissionRule['permissions']>;
  requireAuth?: boolean;
  redirectTo?: string;
  children: React.ReactElement;
}> = ({ permission, anyOfPermissions, requireAuth = true, redirectTo = '/login', children }) => {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());

  useEffect(() => {
    setCurrentUser(store.getCurrentUser());
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const isAuthenticated = currentUser && currentUser.id !== 'guest' && currentUser.active === true;

  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  let allowed = true;
  if (permission) {
    allowed = store.hasPermission(permission, currentUser);
  } else if (anyOfPermissions) {
    allowed = anyOfPermissions.some((p) => store.hasPermission(p, currentUser));
  }

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default function App() {
  useEffect(() => {
    void store.loadAuthenticatedUser().catch((error) => {
      console.warn('Supabase Auth initialization failed:', error);
    });
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="reports"
            element={
              <ProtectedRoute>
                <ReportsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="archive"
            element={
              <ProtectedRoute>
                <ArchivePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/new"
            element={
              <ProtectedRoute permission="create_reports" redirectTo="/reports">
                <CreateReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/:id"
            element={
              <ProtectedRoute>
                <ReportDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="import"
            element={
              <ProtectedRoute permission="import_excel" redirectTo="/reports">
                <ImportPage />
              </ProtectedRoute>
            }
          />

          {/* Phân tích - Yêu cầu đăng nhập */}
          <Route
            path="analysis/units"
            element={
              <ProtectedRoute>
                <UnitAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="analysis/fields"
            element={
              <ProtectedRoute>
                <FieldAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="analysis/compare"
            element={
              <ProtectedRoute>
                <CompareAnalysisPage />
              </ProtectedRoute>
            }
          />

          {/* Danh mục & Quản trị */}
          <Route
            path="admin/settings"
            element={
              <ProtectedRoute anyOfPermissions={['manage_system_config', 'manage_users']}>
                <SystemSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/units"
            element={
              <ProtectedRoute permission="manage_catalogs">
                <UnitsAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/fields"
            element={
              <ProtectedRoute permission="manage_catalogs">
                <FieldsAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/indicators"
            element={
              <ProtectedRoute permission="manage_catalogs">
                <IndicatorsAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute permission="manage_users">
                <SystemSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/audit-logs"
            element={
              <ProtectedRoute permission="view_audit_logs">
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/supabase"
            element={
              <ProtectedRoute permission="manage_system_config">
                <SupabaseAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="supabase"
            element={
              <ProtectedRoute permission="manage_system_config">
                <SupabaseAdminPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
