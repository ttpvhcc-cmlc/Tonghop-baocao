import React, { useEffect } from 'react';
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
import { UsersAdminPage } from './pages/admin/UsersAdminPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SupabaseAdminPage } from './pages/admin/SupabaseAdminPage';
import { store } from './services/store';

export default function App() {
  useEffect(() => {
    void store.loadAuthenticatedUser().catch((error) => {
      console.warn('Supabase Auth initialization failed:', error);
    });
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="reports" element={<ReportsListPage />} />
          <Route path="archive" element={<ArchivePage />} />
          <Route path="reports/new" element={<CreateReportPage />} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="import" element={<ImportPage />} />

          {/* Phân tích */}
          <Route path="analysis/units" element={<UnitAnalysisPage />} />
          <Route path="analysis/fields" element={<FieldAnalysisPage />} />
          <Route path="analysis/compare" element={<CompareAnalysisPage />} />

          {/* Danh mục & Quản trị */}
          <Route path="admin/units" element={<UnitsAdminPage />} />
          <Route path="admin/fields" element={<FieldsAdminPage />} />
          <Route path="admin/indicators" element={<IndicatorsAdminPage />} />
          <Route path="admin/users" element={<UsersAdminPage />} />
          <Route path="admin/audit-logs" element={<AuditLogsPage />} />
          <Route path="admin/supabase" element={<SupabaseAdminPage />} />
          <Route path="supabase" element={<SupabaseAdminPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
