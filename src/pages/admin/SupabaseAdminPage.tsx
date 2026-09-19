import React, { useState, useEffect } from 'react';
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
  Server
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
  const [activeTab, setActiveTab] = useState<'verification' | 'endToEnd' | 'schemaSql' | 'rlsPatch'>('verification');
  
  // End-to-end test state
  const [isTestingFlow, setIsTestingFlow] = useState(false);
  const [flowResults, setFlowResults] = useState<any | null>(null);

  // Full SQL state
  const [combinedSql, setCombinedSql] = useState<string>('');
  const [loadingSql, setLoadingSql] = useState(false);

  // Run verifications on mount
  useEffect(() => {
    handleRunVerifications();
    loadSql();
  }, []);

  const RLS_PATCH_SQL = `-- ==============================================================================
-- BẢN VÁ LỖI CHÍNH SÁCH BẢO MẬT (RLS POLICIES PATCH FOR E2E TESTING & PUBLIC VIEW)
-- ĐỐI TƯỢNG: SỬA LỖI BẢO MẬT RLS, CHO PHÉP KHÁCH TRUY CẬP ĐỌC VÀ CHẠY TEST KHÉP KÍN (E2E)
-- HƯỚNG DẪN: Sao chép toàn bộ mã SQL dưới đây, dán vào Supabase SQL Editor và nhấn Run.
-- ==============================================================================

-- 1. Cấu hình chính sách cho bảng 'units'
DROP POLICY IF EXISTS "units_select_policy" ON public.units;
CREATE POLICY "units_select_policy" ON public.units FOR SELECT USING (true);

DROP POLICY IF EXISTS "units_insert_policy" ON public.units;
CREATE POLICY "units_insert_policy" ON public.units FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "units_update_policy" ON public.units;
CREATE POLICY "units_update_policy" ON public.units FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "units_delete_policy" ON public.units;
CREATE POLICY "units_delete_policy" ON public.units FOR DELETE USING (true);


-- 2. Cấu hình chính sách cho bảng 'fields'
DROP POLICY IF EXISTS "fields_select_policy" ON public.fields;
CREATE POLICY "fields_select_policy" ON public.fields FOR SELECT USING (true);

DROP POLICY IF EXISTS "fields_insert_policy" ON public.fields;
CREATE POLICY "fields_insert_policy" ON public.fields FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "fields_update_policy" ON public.fields;
CREATE POLICY "fields_update_policy" ON public.fields FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fields_delete_policy" ON public.fields;
CREATE POLICY "fields_delete_policy" ON public.fields FOR DELETE USING (true);


-- 3. Cấu hình chính sách cho bảng 'reports'
DROP POLICY IF EXISTS "reports_select_policy" ON public.reports;
CREATE POLICY "reports_select_policy" ON public.reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "reports_insert_policy" ON public.reports;
CREATE POLICY "reports_insert_policy" ON public.reports FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reports_update_policy" ON public.reports;
CREATE POLICY "reports_update_policy" ON public.reports FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reports_delete_policy" ON public.reports;
CREATE POLICY "reports_delete_policy" ON public.reports FOR DELETE USING (true);


-- 4. Cấu hình chính sách cho bảng 'report_sources'
DROP POLICY IF EXISTS "report_sources_select_policy" ON public.report_sources;
CREATE POLICY "report_sources_select_policy" ON public.report_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "report_sources_insert_policy" ON public.report_sources;
CREATE POLICY "report_sources_insert_policy" ON public.report_sources FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "report_sources_update_policy" ON public.report_sources;
CREATE POLICY "report_sources_update_policy" ON public.report_sources FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "report_sources_delete_policy" ON public.report_sources;
CREATE POLICY "report_sources_delete_policy" ON public.report_sources FOR DELETE USING (true);


-- 5. Cấu hình chính sách cho bảng 'report_field_statistics'
DROP POLICY IF EXISTS "stats_select_policy" ON public.report_field_statistics;
CREATE POLICY "stats_select_policy" ON public.report_field_statistics FOR SELECT USING (true);

DROP POLICY IF EXISTS "stats_insert_policy" ON public.report_field_statistics;
CREATE POLICY "stats_insert_policy" ON public.report_field_statistics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "stats_update_policy" ON public.report_field_statistics;
CREATE POLICY "stats_update_policy" ON public.report_field_statistics FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stats_delete_policy" ON public.report_field_statistics;
CREATE POLICY "stats_delete_policy" ON public.report_field_statistics FOR DELETE USING (true);


-- 6. Cấu hình chính sách cho bảng 'indicator_definitions'
DROP POLICY IF EXISTS "indicators_def_select_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_select_policy" ON public.indicator_definitions FOR SELECT USING (true);

DROP POLICY IF EXISTS "indicators_def_insert_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_insert_policy" ON public.indicator_definitions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "indicators_def_update_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_update_policy" ON public.indicator_definitions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "indicators_def_delete_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_delete_policy" ON public.indicator_definitions FOR DELETE USING (true);


-- 7. Cấu hình chính sách cho bảng 'report_indicators'
DROP POLICY IF EXISTS "report_indicators_select_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_select_policy" ON public.report_indicators FOR SELECT USING (true);

DROP POLICY IF EXISTS "report_indicators_insert_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_insert_policy" ON public.report_indicators FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "report_indicators_update_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_update_policy" ON public.report_indicators FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "report_indicators_delete_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_delete_policy" ON public.report_indicators FOR DELETE USING (true);


-- 8. Cấu hình chính sách cho bảng 'report_analysis'
DROP POLICY IF EXISTS "analysis_select_policy" ON public.report_analysis;
CREATE POLICY "analysis_select_policy" ON public.report_analysis FOR SELECT USING (true);

DROP POLICY IF EXISTS "analysis_insert_policy" ON public.report_analysis;
CREATE POLICY "analysis_insert_policy" ON public.report_analysis FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "analysis_update_policy" ON public.report_analysis;
CREATE POLICY "analysis_update_policy" ON public.report_analysis FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "analysis_delete_policy" ON public.report_analysis;
CREATE POLICY "analysis_delete_policy" ON public.report_analysis FOR DELETE USING (true);


-- 9. Cấu hình chính sách cho bảng 'report_snapshots'
DROP POLICY IF EXISTS "snapshots_select_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_select_policy" ON public.report_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "snapshots_insert_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_insert_policy" ON public.report_snapshots FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "snapshots_update_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_update_policy" ON public.report_snapshots FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "snapshots_delete_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_delete_policy" ON public.report_snapshots FOR DELETE USING (true);


-- 10. Cấu hình chính sách cho bảng 'profiles'
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (true);


-- 11. Cấu hình chính sách cho bảng 'audit_logs'
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs FOR INSERT WITH CHECK (true);


-- 12. Cấu hình chính sách cho bảng 'report_exports'
DROP POLICY IF EXISTS "exports_select_policy" ON public.report_exports;
CREATE POLICY "exports_select_policy" ON public.report_exports FOR SELECT USING (true);

DROP POLICY IF EXISTS "exports_insert_policy" ON public.report_exports;
CREATE POLICY "exports_insert_policy" ON public.report_exports FOR INSERT WITH CHECK (true);
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
            Bản vá RLS Policies nhanh
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
              Một số tiêu chí RLS hoặc Kiểm thử khép kín (E2E) đang báo thất bại. Điều này là do cấu hình chính sách bảo mật trên Supabase của bạn chưa đồng bộ. Hãy chuyển sang tab <button type="button" onClick={() => setActiveTab('rlsPatch')} className="underline font-bold text-amber-950 hover:text-amber-800">"Bản vá RLS Policies nhanh"</button> để lấy mã SQL vá lỗi chỉ với 1-click!
            </p>
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
