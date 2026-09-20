import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  Layers, 
  ShieldCheck, 
  FileCode, 
  Activity, 
  ArrowRight,
  Server,
  CloudUpload,
  CloudDownload,
  FileJson,
  Upload,
  Download,
  Zap,
  Sparkles
} from 'lucide-react';
import { 
  supabaseUrl, 
  supabaseAnonKey, 
  isSupabaseConfigured, 
  runAllVerifications, 
  VerificationReport,
  VerificationStepResult,
  REQUIRED_TABLES 
} from '../../lib/supabase';
import { store } from '../../services/store';

export const SupabaseAdminPage: React.FC = () => {
  const [isRunningVerifications, setIsRunningVerifications] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedRlsPatch, setCopiedRlsPatch] = useState(false);
  const [activeTab, setActiveTab] = useState<'verification' | 'syncBackup' | 'endToEnd' | 'schemaSql' | 'rlsPatch'>('verification');
  
  // End-to-end test state
  const [isTestingFlow, setIsTestingFlow] = useState(false);
  const [flowResults, setFlowResults] = useState<any | null>(null);

  // Full SQL state
  const [combinedSql, setCombinedSql] = useState<string>('');
  const [loadingSql, setLoadingSql] = useState(false);

  // Cloud Sync & Backup state
  const [isPushingCloud, setIsPushingCloud] = useState(false);
  const [pushProgress, setPushProgress] = useState<{ text: string; percent: number }>({ text: '', percent: 0 });
  const [pushMessage, setPushMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [pullMessage, setPullMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [backupMessage, setBackupMessage] = useState<{ success: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reportsCount = store.getReports().length;
  const statsCount = store.getAllStats().length;
  const sourcesCount = store.getAllSources().length;

  // Run verifications on mount
  useEffect(() => {
    handleRunVerifications();
    loadSql();
  }, []);

  const RLS_PATCH_SQL = `-- ==============================================================================
-- TTHC DB-ONLY HARDENING v1
-- Mục tiêu:
-- 1) Supabase/Postgres là nguồn dữ liệu nghiệp vụ duy nhất.
-- 2) Không có bypass TEST/IMP trong RLS của dữ liệu production.
-- 3) Không cho client trực tiếp ghi snapshot/audit; database trigger ghi nhận.
-- 4) Tất cả thay đổi nghiệp vụ quan trọng được kiểm soát bằng RLS + trigger.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RLS: authenticated users may READ business data; writes follow RBAC.
-- ------------------------------------------------------------------------------
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_field_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Units
DROP POLICY IF EXISTS "units_select_policy" ON public.units;
CREATE POLICY "units_select_policy" ON public.units
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "units_insert_policy" ON public.units;
CREATE POLICY "units_insert_policy" ON public.units
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "units_update_policy" ON public.units;
CREATE POLICY "units_update_policy" ON public.units
  FOR UPDATE USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "units_delete_policy" ON public.units;
CREATE POLICY "units_delete_policy" ON public.units
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.current_user_role() = 'admin')
  WITH CHECK (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Fields
DROP POLICY IF EXISTS "fields_select_policy" ON public.fields;
CREATE POLICY "fields_select_policy" ON public.fields
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "fields_insert_policy" ON public.fields;
CREATE POLICY "fields_insert_policy" ON public.fields
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "fields_update_policy" ON public.fields;
CREATE POLICY "fields_update_policy" ON public.fields
  FOR UPDATE USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "fields_delete_policy" ON public.fields;
CREATE POLICY "fields_delete_policy" ON public.fields
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Reports
DROP POLICY IF EXISTS "reports_select_policy" ON public.reports;
CREATE POLICY "reports_select_policy" ON public.reports
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "reports_insert_policy" ON public.reports;
CREATE POLICY "reports_insert_policy" ON public.reports
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "reports_update_policy" ON public.reports;
CREATE POLICY "reports_update_policy" ON public.reports
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "reports_delete_policy" ON public.reports;
CREATE POLICY "reports_delete_policy" ON public.reports
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Sources
DROP POLICY IF EXISTS "report_sources_select_policy" ON public.report_sources;
CREATE POLICY "report_sources_select_policy" ON public.report_sources
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "report_sources_insert_policy" ON public.report_sources;
CREATE POLICY "report_sources_insert_policy" ON public.report_sources
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_sources_update_policy" ON public.report_sources;
CREATE POLICY "report_sources_update_policy" ON public.report_sources
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_sources_delete_policy" ON public.report_sources;
CREATE POLICY "report_sources_delete_policy" ON public.report_sources
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst','data_entry'));

-- Statistics
DROP POLICY IF EXISTS "stats_select_policy" ON public.report_field_statistics;
CREATE POLICY "stats_select_policy" ON public.report_field_statistics
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stats_insert_policy" ON public.report_field_statistics;
CREATE POLICY "stats_insert_policy" ON public.report_field_statistics
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "stats_update_policy" ON public.report_field_statistics;
CREATE POLICY "stats_update_policy" ON public.report_field_statistics
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "stats_delete_policy" ON public.report_field_statistics;
CREATE POLICY "stats_delete_policy" ON public.report_field_statistics
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst','data_entry'));

-- Indicator definitions
DROP POLICY IF EXISTS "indicators_def_select_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_select_policy" ON public.indicator_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "indicators_def_insert_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_insert_policy" ON public.indicator_definitions
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "indicators_def_update_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_update_policy" ON public.indicator_definitions
  FOR UPDATE USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "indicators_def_delete_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_delete_policy" ON public.indicator_definitions
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Calculated report indicators
DROP POLICY IF EXISTS "report_indicators_select_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_select_policy" ON public.report_indicators
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "report_indicators_insert_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_insert_policy" ON public.report_indicators
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_indicators_update_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_update_policy" ON public.report_indicators
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_indicators_delete_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_delete_policy" ON public.report_indicators
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst','data_entry'));

-- Analyses
DROP POLICY IF EXISTS "analysis_select_policy" ON public.report_analysis;
CREATE POLICY "analysis_select_policy" ON public.report_analysis
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "analysis_insert_policy" ON public.report_analysis;
CREATE POLICY "analysis_insert_policy" ON public.report_analysis
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst'));

DROP POLICY IF EXISTS "analysis_update_policy" ON public.report_analysis;
CREATE POLICY "analysis_update_policy" ON public.report_analysis
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst'));

DROP POLICY IF EXISTS "analysis_delete_policy" ON public.report_analysis;
CREATE POLICY "analysis_delete_policy" ON public.report_analysis
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst'));

-- Snapshots are history, generated by the database lock trigger only.
DROP POLICY IF EXISTS "snapshots_select_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_select_policy" ON public.report_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "snapshots_insert_policy" ON public.report_snapshots;
DROP POLICY IF EXISTS "snapshots_update_policy" ON public.report_snapshots;
DROP POLICY IF EXISTS "snapshots_delete_policy" ON public.report_snapshots;

-- Audit logs are append-only and generated by SECURITY DEFINER triggers.
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON public.audit_logs;

-- ------------------------------------------------------------------------------
-- 2. Generic DB audit trigger for business-table changes not covered by report
--    lifecycle trigger.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_business_table_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id TEXT;
  v_action TEXT;
  v_payload JSONB;
BEGIN
  v_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
  v_action := TG_TABLE_NAME || '_' || lower(TG_OP);
  v_payload := CASE
    WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
    WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
    ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  END;

  PERFORM public.write_audit_log(
    upper(v_action),
    TG_TABLE_NAME,
    v_id,
    v_payload
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_units_audit ON public.units;
CREATE TRIGGER trg_units_audit
AFTER INSERT OR UPDATE OR DELETE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_profiles_audit ON public.profiles;
CREATE TRIGGER trg_profiles_audit
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_fields_audit ON public.fields;
CREATE TRIGGER trg_fields_audit
AFTER INSERT OR UPDATE OR DELETE ON public.fields
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_indicator_definitions_audit ON public.indicator_definitions;
CREATE TRIGGER trg_indicator_definitions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.indicator_definitions
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_sources_audit ON public.report_sources;
CREATE TRIGGER trg_report_sources_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_sources
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_field_statistics_audit ON public.report_field_statistics;
CREATE TRIGGER trg_report_field_statistics_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_field_statistics
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_indicators_audit ON public.report_indicators;
CREATE TRIGGER trg_report_indicators_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_indicators
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_analysis_audit ON public.report_analysis;
CREATE TRIGGER trg_report_analysis_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_analysis
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

COMMIT;
`;


  const loadSql = async () => {
    setLoadingSql(true);
    try {
      const res = await fetch('/api/supabase/sql');
      if (res.ok) {
        const data = await res.json();
        setCombinedSql(data.combinedSql || data.migrationSql || '');
      }
    } catch (e) {
      console.error('Fetch SQL error:', e);
    } finally {
      setLoadingSql(false);
    }
  };

  const handleRunVerifications = async () => {
    setIsRunningVerifications(true);
    try {
      const rep = await runAllVerifications();
      setReport(rep);
      await store.syncWithSupabase();
    } catch (err) {
      console.error('Run verifications error:', err);
    } finally {
      setIsRunningVerifications(false);
    }
  };

  const handleRunEndToEndFlow = async () => {
    setIsTestingFlow(true);
    setFlowResults(null);
    try {
      const res = await fetch('/api/supabase/test-flow', { method: 'POST' });
      const data = await res.json();
      setFlowResults(data);
    } catch (err: any) {
      setFlowResults({ success: false, error: err.message });
    } finally {
      setIsTestingFlow(false);
    }
  };

  const handleCopySql = () => {
    if (!combinedSql) return;
    navigator.clipboard.writeText(combinedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCopyRlsPatch = () => {
    navigator.clipboard.writeText(RLS_PATCH_SQL);
    setCopiedRlsPatch(true);
    setTimeout(() => setCopiedRlsPatch(false), 3000);
  };

  const handlePushAllToCloud = async () => {
    setPushMessage({
      success: true,
      text: 'Đã tắt cơ chế đẩy local → cloud. Mọi dữ liệu nghiệp vụ hiện được ghi trực tiếp vào Supabase và không cần bước đồng bộ trung gian.',
    });
    await handlePullFromCloud();
  };

  const handlePullFromCloud = async () => {
    setIsPullingCloud(true);
    setPullMessage(null);
    try {
      const success = await store.syncWithSupabase();
      if (success) {
        setPullMessage({
          success: true,
          text: `Đã cập nhật dữ liệu mới nhất từ Supabase Cloud về trình duyệt này! (${store.getReports().length} báo cáo, ${store.getAllStats().length} số liệu thống kê)`,
        });
      } else {
        setPullMessage({
          success: false,
          text: 'Không thể tải dữ liệu từ Supabase Cloud. Vui lòng kiểm tra lại kết nối.',
        });
      }
    } catch (err: any) {
      setPullMessage({ success: false, text: `Lỗi: ${err.message}` });
    } finally {
      setIsPullingCloud(false);
    }
  };

  const handleExportBackupJson = async () => {
    try {
      const jsonStr = await store.exportFullDatabaseBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sao_luu_csdl_tthc_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMessage({
        success: true,
        text: 'Đã xuất file sao lưu CSDL (.json) thành công! Bạn có thể lưu giữ hoặc chuyển file này sang bất kỳ máy/trang web nào để nạp lại dữ liệu.',
      });
    } catch (e: any) {
      setBackupMessage({ success: false, text: `Lỗi xuất file: ${e.message}` });
    }
  };

  const handleImportBackupJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = await store.importFullDatabaseBackup(content);
        setBackupMessage({ success: res.success, text: res.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isRlsFailing = report && (!report.steps[4]?.passed || !report.steps[5]?.passed || !report.steps[6]?.passed);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Trung tâm kết nối & Kiểm thử Supabase Cloud
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                report?.steps[0]?.passed 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${report?.steps[0]?.passed ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {report?.steps[0]?.passed ? 'Đã kết nối' : 'Chưa kết nối'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Kiểm tra 7 tiêu chí xác thực, cấu trúc 12 bảng CSDL, bảo mật RLS và kiểm thử quy trình nghiệp vụ khép kín.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRunVerifications}
            disabled={isRunningVerifications}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningVerifications ? 'animate-spin' : ''}`} />
            <span>{isRunningVerifications ? 'Đang kiểm tra...' : 'Kiểm tra lại toàn bộ'}</span>
          </button>
        </div>
      </div>

      {/* Connection Info Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Supabase Endpoint</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-800 font-mono truncate" title={supabaseUrl}>
            {supabaseUrl || 'Chưa cấu hình'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Khu vực REST API & GoTrue v2.197.0
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cấu hình Khóa API</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-800 font-mono truncate">
            {supabaseAnonKey ? `${supabaseAnonKey.slice(0, 16)}...` : 'Chưa có'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            VITE_SUPABASE_PUBLISHABLE_KEY (Anon/Public)
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái Bảng CSDL</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {report?.steps[1]?.passed ? '12/12 Bảng hoàn tất' : 'Cần khởi tạo Schema'}
            </span>
            {report?.steps[1]?.passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {report?.steps[1]?.passed ? 'Sẵn sàng lưu trữ trực tiếp' : 'Xem mã SQL khởi tạo bên dưới'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('verification')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'verification'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>7 Tiêu chí xác thực Supabase</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('syncBackup')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'syncBackup'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CloudUpload className="w-4 h-4 text-emerald-600" />
          <span className="flex items-center gap-1.5">
            Sao lưu CSDL Supabase
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">Quan trọng</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('endToEnd')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'endToEnd'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Kiểm thử quy trình khép kín (End-to-End)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rlsPatch')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rlsPatch'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span className="flex items-center gap-1.5">
            RLS Hardening
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">Khuyên dùng để sửa lỗi</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schemaSql')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'schemaSql'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Mã SQL Migration & Khởi tạo CSDL</span>
        </button>
      </div>

      {/* RLS Patch Warning Banner */}
      {isRlsFailing && activeTab !== 'rlsPatch' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">
              Phát hiện lỗi bảo mật chính sách bảo mật (RLS) của Supabase!
            </h4>
            <p className="text-xs text-amber-700 mt-1">
              Một số tiêu chí RLS hoặc Kiểm thử khép kín (E2E) đang báo thất bại. Điều này là do cấu hình chính sách bảo mật trên Supabase của bạn chưa đồng bộ. Hãy chuyển sang tab <button type="button" onClick={() => setActiveTab('rlsPatch')} className="underline font-bold text-amber-950 hover:text-amber-800">"RLS Hardening"</button> để lấy mã SQL vá lỗi chỉ với 1-click!
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Cloud Sync & Data Backup */}
      {activeTab === 'syncBackup' && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl p-6 text-white shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-800/80 text-blue-200 text-xs font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Nguồn dữ liệu duy nhất: Supabase
                </div>
                <h2 className="text-xl font-bold">Sao lưu CSDL Supabase</h2>
                <p className="text-sm text-blue-200 mt-1 max-w-2xl">
                  Giúp đưa toàn bộ dữ liệu số liệu báo cáo từ phiên làm việc này lên Cơ sở dữ liệu Supabase Cloud, để ứng dụng khi mở trên <strong>Netlify</strong> hoặc bất kỳ máy tính/thiết bị nào khác đều hiển thị đầy đủ số liệu.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10 shrink-0">
                <div className="text-center px-3 border-r border-white/20">
                  <div className="text-xs text-blue-200 font-medium">Báo cáo</div>
                  <div className="text-lg font-bold text-white">{reportsCount}</div>
                </div>
                <div className="text-center px-3 border-r border-white/20">
                  <div className="text-xs text-blue-200 font-medium">Nguồn dữ liệu</div>
                  <div className="text-lg font-bold text-white">{sourcesCount}</div>
                </div>
                <div className="text-center px-3">
                  <div className="text-xs text-blue-200 font-medium">Dòng số liệu</div>
                  <div className="text-lg font-bold text-emerald-300">{statsCount.toLocaleString('vi-VN')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Action Card 1: Push to Supabase Cloud */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    1. Nguồn dữ liệu nghiệp vụ
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Không có bước "local → cloud". Mọi dữ liệu nghiệp vụ được ghi trực tiếp vào Supabase; giao diện chỉ giữ trạng thái hiển thị tạm thời trong phiên.
                  </p>
                </div>

                {pushProgress.percent > 0 && isPushingCloud && (
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex justify-between text-xs text-slate-600 font-medium">
                      <span>{pushProgress.text}</span>
                      <span>{pushProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pushProgress.percent}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {pushMessage && (
                  <div className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                    pushMessage.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}>
                    {pushMessage.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{pushMessage.text}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handlePushAllToCloud}
                disabled={isPushingCloud}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                <CloudUpload className={`w-4 h-4 ${isPushingCloud ? 'animate-bounce' : ''}`} />
                <span>Không có đồng bộ local → cloud</span>
              </button>
            </div>

            {/* Action Card 2: Pull from Supabase Cloud */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <CloudDownload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    2. Làm mới dữ liệu từ Supabase
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Đồng bộ và tải các số liệu báo cáo mới nhất đang được lưu trữ trên Supabase Cloud về trình duyệt hiện tại.
                  </p>
                </div>

                {pullMessage && (
                  <div className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                    pullMessage.success
                      ? 'bg-blue-50 border border-blue-200 text-blue-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}>
                    {pullMessage.success ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{pullMessage.text}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handlePullFromCloud}
                disabled={isPullingCloud}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                <CloudDownload className={`w-4 h-4 ${isPullingCloud ? 'animate-spin' : ''}`} />
                <span>{isPullingCloud ? 'Đang tải về...' : 'Tải dữ liệu từ Supabase về máy này'}</span>
              </button>
            </div>
          </div>

          {/* Action Card 3: File Backup & Restore (Direct JSON transfer) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Sao lưu & Phục hồi file dữ liệu (.JSON) trực tiếp
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tải file sao lưu toàn bộ số liệu về máy tính của bạn hoặc nạp nhanh file sao lưu vào trang Netlify mà không cần cấu hình mạng.
                </p>
              </div>
            </div>

            {backupMessage && (
              <div className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                backupMessage.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {backupMessage.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{backupMessage.text}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportBackupJson}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Tải file Sao lưu (.JSON) về máy</span>
              </button>

              <button
                type="button"
                disabled
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold transition-colors shadow-xs"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                <span>Nạp file Sao lưu (.JSON) từ máy vào</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackupJson}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: 7-Step Verification Checklist */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kết quả kiểm tra chi tiết theo yêu cầu
              </span>
              <span className="text-xs text-slate-500">
                Thời gian kiểm tra: {report ? new Date(report.timestamp).toLocaleTimeString('vi-VN') : 'Đang cập nhật...'}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {report?.steps.map((step: VerificationStepResult) => (
                <div key={step.step} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="mt-0.5 shrink-0">
                    {step.passed ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        Tiêu chí {step.step}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">
                        {step.name}
                      </h3>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        step.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {step.passed ? 'ĐẠT (PASS)' : 'CHƯA ĐẠT (FAIL)'}
                      </span>
                      {step.durationMs !== undefined && (
                        <span className="text-xs text-slate-400">
                          ({step.durationMs}ms)
                        </span>
                      )}
                    </div>

                    <p className={`text-xs mt-1 leading-relaxed ${step.passed ? 'text-slate-600' : 'text-rose-700 font-medium'}`}>
                      {step.message}
                    </p>

                    {/* Step specific detail badges */}
                    {step.step === 2 && step.details && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-700 block mb-2">
                          Kiểm tra chi tiết 12 bảng CSDL:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {Object.entries(step.details).map(([tbl, info]: any) => (
                            <div key={tbl} className="flex items-center gap-1.5 text-xs">
                              {info.exists ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              )}
                              <span className={info.exists ? 'text-slate-700 font-mono' : 'text-rose-600 font-mono font-medium'}>
                                {tbl}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Action Helper */}
          {!report?.steps[1]?.passed && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-amber-900">
                  Hướng dẫn kích hoạt toàn bộ 12 bảng trên Supabase trong 30 giây:
                </h4>
                <ol className="text-xs text-amber-800 list-decimal list-inside space-y-1">
                  <li>
                    Chuyển sang tab <strong>"Mã SQL Migration & Khởi tạo CSDL"</strong> bên trên và nhấn nút <strong>"Sao chép toàn bộ mã SQL"</strong>.
                  </li>
                  <li>
                    Mở Supabase Dashboard của dự án: <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">mluyprtkhsjhigipqqjk</code>
                  </li>
                  <li>
                    Truy cập mục <strong>SQL Editor</strong> &gt; Tạo <strong>New Query</strong> &gt; Dán (Paste) mã SQL vừa sao chép &gt; Nhấn <strong>Run</strong>.
                  </li>
                  <li>
                    Quay lại đây và nhấn nút <strong>"Kiểm tra lại toàn bộ"</strong> để hệ thống tự động nhận diện và hoàn tất 100% các tiêu chí!
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: End-to-End Test Flow */}
      {activeTab === 'endToEnd' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Kiểm thử quy trình nghiệp vụ khép kín (End-to-End Cycle)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Mô phỏng toàn diện: Khởi tạo kỳ báo cáo &rarr; Nạp nguồn dữ liệu &rarr; Lưu trữ chỉ số hạt nhân &rarr; Tải lại đối soát &rarr; Xác thực tính nhất quán.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunEndToEndFlow}
                disabled={isTestingFlow}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-50 shrink-0"
              >
                <Play className={`w-4 h-4 ${isTestingFlow ? 'animate-spin' : ''}`} />
                <span>{isTestingFlow ? 'Đang thực hiện kiểm thử...' : 'Bắt đầu kiểm thử quy trình'}</span>
              </button>
            </div>

            {flowResults && (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Trạng thái thực thi quy trình:</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    flowResults.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {flowResults.success ? 'HOÀN THÀNH XUẤT SẮC' : 'THẤT BẠI'}
                  </span>
                </div>

                <div className="space-y-2">
                  {flowResults.flowLog?.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-3 shadow-xs">
                      {item.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">{item.step}</div>
                        <pre className="text-[11px] text-slate-600 font-mono mt-1 bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto">
                          {JSON.stringify(item.detail, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Schema & SQL */}
      {activeTab === 'schemaSql' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tập lệnh SQL khởi tạo CSDL hoàn chỉnh (001_initial.sql + seed.sql)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Bao gồm 12 bảng quan hệ, ràng buộc khóa ngoại, chính sách Row Level Security (RLS) và dữ liệu danh mục chuẩn.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Đã sao chép SQL</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép toàn bộ mã SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-xs font-mono max-h-[500px] overflow-y-auto leading-relaxed border border-slate-800 select-all">
                {combinedSql || (loadingSql ? 'Đang tải mã SQL...' : 'Chưa thể tải file SQL.')}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: RLS Policy Patch */}
      {activeTab === 'rlsPatch' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  Mã SQL vá lỗi chính sách bảo mật RLS nhanh
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Đồng bộ hóa chính sách Row Level Security cho phép đọc công khai (Public Read) và nạp dữ liệu/kiểm thử (E2E testing) không bị chặn.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyRlsPatch}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs shrink-0"
              >
                {copiedRlsPatch ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Đã sao chép Bản vá</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép Bản vá RLS</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Các bước thực hiện nhanh:</h4>
              <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1">
                <li>Nhấn nút <strong className="text-amber-700">"Sao chép Bản vá RLS"</strong> ở góc trên bên phải.</li>
                <li>Truy cập mục <strong>SQL Editor</strong> trên Supabase Dashboard dự án của bạn.</li>
                <li>Tạo một truy vấn mới (New Query), dán mã vừa sao chép vào và nhấn <strong className="text-blue-700">Run</strong>.</li>
                <li>Quay lại tab <strong className="text-blue-700">"7 Tiêu chí xác thực"</strong> và nhấn <strong className="text-blue-700">"Kiểm tra lại toàn bộ"</strong> để cập nhật kết quả xanh 100%!</li>
              </ol>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-xs font-mono max-h-[400px] overflow-y-auto leading-relaxed border border-slate-800 select-all">
                {RLS_PATCH_SQL}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
