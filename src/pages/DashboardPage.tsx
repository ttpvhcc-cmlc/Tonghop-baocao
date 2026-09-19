import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { store } from '../services/store';
import { formatNumber, formatPercent, getStatusBadge } from '../utils/format';
import {
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcOnlineRate,
  calcPendingRate
} from '../features/analysis/formulas';
import {
  fetchLiveDashboardData,
  initializeSupabaseDatabase,
  runCompleteReadWriteTest,
  isReadWriteTestPassed,
  validateRowFormulas,
  E2ETestResult
} from '../services/dbInit';
import { INITIAL_MIGRATION_SQL, SEED_DATA_SQL } from '../services/sqlScripts';
import { supabaseUrl } from '../lib/supabase';
import type { ReportingPeriod, ReportSource, ReportStatistic, Unit, Field } from '../types/database';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Play,
  Copy,
  Code,
  Check,
  ExternalLink,
  ShieldCheck,
  Server,
  Layers,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';

const RESOLUTION_COLORS = ['#10b981', '#0ea5e9', '#f43f5e'];
const CHANNEL_COLORS = ['#3b82f6', '#f59e0b'];

export const DashboardPage: React.FC = () => {
  // Live Supabase Database state
  const [loading, setLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<{
    configured: boolean;
    connected: boolean;
    schemaReady: boolean;
    errorMessage: string | null;
  }>({
    configured: true,
    connected: false,
    schemaReady: false,
    errorMessage: null,
  });

  const [liveReports, setLiveReports] = useState<ReportingPeriod[]>([]);
  const [liveSources, setLiveSources] = useState<ReportSource[]>([]);
  const [liveStats, setLiveStats] = useState<ReportStatistic[]>([]);
  const [liveUnits, setLiveUnits] = useState<Unit[]>([]);
  const [liveFields, setLiveFields] = useState<Field[]>([]);

  // Filter state
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('ALL');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('ALL');

  // E2E Test Modal State
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<E2ETestResult | null>(null);
  const [hasPassedTest, setHasPassedTest] = useState<boolean>(isReadWriteTestPassed());

  // SQL Script Modal State
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [sqlTab, setSqlTab] = useState<'migration' | 'seed'>('migration');
  const [copied, setCopied] = useState<boolean>(false);

  // Init Data Loading State
  const [isInitializingData, setIsInitializingData] = useState<boolean>(false);
  const [initFeedback, setInitFeedback] = useState<string | null>(null);

  // Load live data from Supabase (or fallback to store)
  const loadData = useCallback(async (reportId?: string) => {
    setLoading(true);
    try {
      const targetId = reportId || selectedReportId;
      const res = await fetchLiveDashboardData(targetId);
      setDbStatus({
        configured: res.configured,
        connected: res.connected,
        schemaReady: res.schemaReady,
        errorMessage: res.errorMessage,
      });

      setLiveReports(res.reports);
      setLiveUnits(res.units);
      setLiveFields(res.fields);

      const effectiveActiveId = targetId || res.currentReport?.id || res.reports[0]?.id || '';
      const finalSources = res.sources && res.sources.length > 0 ? res.sources : (effectiveActiveId ? store.getSourcesByReport(effectiveActiveId) : []);
      const finalStats = res.statistics && res.statistics.length > 0 ? res.statistics : (effectiveActiveId ? store.getStatsByReport(effectiveActiveId) : []);

      setLiveSources(finalSources);
      setLiveStats(finalStats);

      if (!selectedReportId && res.currentReport) {
        setSelectedReportId(res.currentReport.id);
      }
    } catch (err: any) {
      setDbStatus((prev) => ({ ...prev, errorMessage: err.message }));
      // Fallback directly to store cache
      const fallbackReports = store.getReports();
      setLiveReports(fallbackReports);
      setLiveUnits(store.getUnits());
      setLiveFields(store.getFields());
      const activeId = reportId || selectedReportId || fallbackReports[0]?.id;
      if (activeId) {
        if (!selectedReportId) setSelectedReportId(activeId);
        setLiveSources(store.getSourcesByReport(activeId));
        setLiveStats(store.getStatsByReport(activeId));
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReportId]);

  useEffect(() => {
    loadData();
    const unsub = store.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  // When selectedReportId changes, reload specific report data
  const handleReportChange = (newReportId: string) => {
    setSelectedReportId(newReportId);
    loadData(newReportId);
  };

  // Run the full E2E Read/Write test
  const handleRunE2ETest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    setShowTestModal(true);
    try {
      const result = await runCompleteReadWriteTest();
      setTestResult(result);
      if (result.passed) {
        setHasPassedTest(true);
      }
    } catch (err: any) {
      console.error('E2E Test Execution Error:', err);
    } finally {
      setIsRunningTest(false);
    }
  };

  // Initialize Sample Data on Supabase
  const handleInitSupabaseData = async () => {
    setIsInitializingData(true);
    setInitFeedback(null);
    try {
      const res = await initializeSupabaseDatabase();
      if (res.success) {
        setInitFeedback(`Thành công: Đã khởi tạo dữ liệu mẫu lên Supabase (${res.inserted?.stats} bản ghi thống kê chuẩn 4 công thức toán học).`);
        await loadData();
      } else {
        setInitFeedback(`Thông báo: ${res.message}`);
        if (!res.schemaReady) {
          setShowSqlModal(true);
        }
      }
    } catch (err: any) {
      setInitFeedback(`Lỗi: ${err.message}`);
    } finally {
      setIsInitializingData(false);
    }
  };

  // Copy SQL script to clipboard
  const handleCopySql = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Selected Report Details
  const selectedReport = useMemo(() => {
    return liveReports.find((r) => r.id === selectedReportId) || liveReports[0] || null;
  }, [liveReports, selectedReportId]);

  // Filtered stats based on active dropdowns
  const filteredStats = useMemo(() => {
    return liveStats.filter((s) => {
      if (selectedUnitId !== 'ALL' && s.unit_id !== selectedUnitId) return false;
      if (selectedSourceId !== 'ALL' && s.source_id !== selectedSourceId) return false;
      if (selectedFieldId !== 'ALL' && s.field_id !== selectedFieldId) return false;
      return true;
    });
  }, [liveStats, selectedUnitId, selectedSourceId, selectedFieldId]);

  // Aggregated 8 KPIs
  const totals = useMemo(() => {
    let recTotal = 0;
    let recOnline = 0;
    let recOffline = 0;
    let carried = 0;

    let compTotal = 0;
    let compEarly = 0;
    let compOnTime = 0;
    let compLate = 0;

    let pendTotal = 0;
    let pendOnTime = 0;
    let pendLate = 0;

    filteredStats.forEach((s) => {
      recTotal += s.received_total;
      recOnline += s.received_online;
      recOffline += s.received_offline;
      carried += s.carried_forward;

      compTotal += s.completed_total;
      compEarly += s.completed_early;
      compOnTime += s.completed_on_time;
      compLate += s.completed_late;

      pendTotal += s.pending_total;
      pendOnTime += s.pending_on_time;
      pendLate += s.pending_late;
    });

    // 8 Core KPIs
    const onlineRate = calcOnlineRate(recOnline, recOffline);
    const completionRate = calcCompletionRate(compTotal, recTotal);
    const onTimeRate = calcOnTimeRate(compEarly, compOnTime, compTotal);
    const overdueRate = calcLateRate(compLate, compTotal);
    const pendingOnTimeRate = calcPendingRate(pendOnTime, pendTotal);

    return {
      recTotal,
      recOnline,
      recOffline,
      carried,
      compTotal,
      compEarly,
      compOnTime,
      compLate,
      pendTotal,
      pendOnTime,
      pendLate,
      onlineRate,
      completionRate,
      onTimeRate,
      overdueRate,
      pendingOnTimeRate,
    };
  }, [filteredStats]);

  // Discrepancy Warnings
  const warnings = useMemo(() => {
    return filteredStats.filter((s) => {
      const v = validateRowFormulas(s);
      return !v.allPassed || s.validation_status === 'warning' || (s.validation_errors && s.validation_errors.length > 0);
    });
  }, [filteredStats]);

  // Chart 1: Monthly Volume Trend (multi-period)
  const monthlyTrendData = useMemo(() => {
    return [...liveReports]
      .reverse()
      .map((rep) => {
        const repStats = dbStatus.schemaReady
          ? liveStats.filter((s) => s.report_id === rep.id)
          : store.getStatsByReport(rep.id);
        const rec = repStats.reduce((acc, curr) => acc + curr.received_total, 0);
        const comp = repStats.reduce((acc, curr) => acc + curr.completed_total, 0);
        const pend = repStats.reduce((acc, curr) => acc + curr.pending_total, 0);
        return {
          code: rep.report_code,
          name: rep.period_start.slice(0, 7),
          received: rec,
          resolved: comp,
          pending: pend,
        };
      });
  }, [liveReports, liveStats, dbStatus.schemaReady]);

  // Chart 2: Resolution distribution (early / on time / late)
  const resolutionDistributionData = useMemo(() => {
    return [
      { name: 'Trước hạn', value: totals.compEarly, color: '#10b981' },
      { name: 'Đúng hạn', value: totals.compOnTime, color: '#0ea5e9' },
      { name: 'Quá hạn', value: totals.compLate, color: '#f43f5e' },
    ];
  }, [totals]);

  // Chart 3: Channel mix (online vs in person)
  const channelMixData = useMemo(() => {
    return [
      { name: 'Trực tuyến (Online)', value: totals.recOnline, color: '#3b82f6' },
      { name: 'Trực tiếp / Một cửa', value: totals.recOffline, color: '#f59e0b' },
    ];
  }, [totals]);

  // Chart 4: Unit performance ranking (Văn phòng, Phòng Kinh tế, Phòng VHXH)
  const unitRankingData = useMemo(() => {
    const map: Record<string, { unitName: string; rec: number; comp: number; pend: number; onTime: number; onTimeRate: number }> = {};
    liveUnits.forEach((u) => {
      map[u.id] = { unitName: u.name, rec: 0, comp: 0, pend: 0, onTime: 0, onTimeRate: 100 };
    });

    liveStats.forEach((s) => {
      if (!map[s.unit_id]) {
        map[s.unit_id] = { unitName: s.unit_name_snapshot || s.unit_name || 'Đơn vị', rec: 0, comp: 0, pend: 0, onTime: 0, onTimeRate: 100 };
      }
      map[s.unit_id].rec += s.received_total;
      map[s.unit_id].comp += s.completed_total;
      map[s.unit_id].pend += s.pending_total;
      map[s.unit_id].onTime += s.completed_early + s.completed_on_time;
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        onTimeRate: item.comp > 0 ? Number(((item.onTime / item.comp) * 100).toFixed(1)) : 100,
        compRate: item.rec > 0 ? Number(((item.comp / item.rec) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.onTimeRate - a.onTimeRate);
  }, [liveUnits, liveStats]);

  const reportBadge = selectedReport ? getStatusBadge(selectedReport.status) : null;

  return (
    <div className="space-y-5 w-full">
      {/* Top Controls & Global Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Bộ lọc phân tích
            </span>
            {reportBadge && (
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${reportBadge.bg} ${reportBadge.text} ${reportBadge.border}`}>
                {reportBadge.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedReportId && (
              <Link
                to={`/reports/${selectedReportId}`}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Xem chi tiết kỳ báo cáo này →
              </Link>
            )}
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
          {/* Filter 1: Kỳ Báo Cáo */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Kỳ báo cáo
            </label>
            <select
              value={selectedReportId}
              onChange={(e) => handleReportChange(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {liveReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_code} - {r.report_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Nguồn dữ liệu */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Nguồn dữ liệu
            </label>
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả nguồn dữ liệu</option>
              {liveSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.source_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Đơn vị giải quyết */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Đơn vị giải quyết
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả đơn vị</option>
              {liveUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Lĩnh vực */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Lĩnh vực TTHC
            </label>
            <select
              value={selectedFieldId}
              onChange={(e) => setSelectedFieldId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả lĩnh vực</option>
              {liveFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Discrepancy Notification (if any) */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">
              Phát hiện {warnings.length} bản ghi có cảnh báo chênh lệch dữ liệu (Audit Discrepancy)
            </h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Hệ thống tự động phát hiện số liệu giữa nguồn ghi nhận và tổng thành phần thực tế có sai số (cần rà soát đối soát).
            </p>
            <div className="mt-2 space-y-1">
              {warnings.slice(0, 3).map((w) => (
                <div key={w.id} className="text-xs text-amber-800 bg-white/70 px-2.5 py-1 rounded-md border border-amber-200">
                  <span className="font-semibold">{w.field_name_snapshot}</span> ({w.unit_name_snapshot}):{' '}
                  {w.validation_errors?.map((e) => e.message).join(' | ') || 'Kiểm tra công thức thành phần'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. 8 Core KPI Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            8 Chỉ số Hiệu năng Cốt lõi
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* KPI 1: Total received */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tổng tiếp nhận
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {formatNumber(totals.recTotal)}
            </div>
            <div className="text-[10px] text-blue-600 mt-1 font-medium">
              online + tt + trước
            </div>
          </div>

          {/* KPI 2: Total resolved */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Đã giải quyết
            </div>
            <div className="text-xl font-black text-emerald-600 mt-1">
              {formatNumber(totals.compTotal)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-1 font-medium">
              sớm + đúng + trễ
            </div>
          </div>

          {/* KPI 3: Total pending */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Đang giải quyết
            </div>
            <div className="text-xl font-black text-indigo-600 mt-1">
              {formatNumber(totals.pendTotal)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              trong hạn + trễ hạn
            </div>
          </div>

          {/* KPI 4: Online submission rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ nộp Online
            </div>
            <div className="text-xl font-black text-blue-600 mt-1">
              {formatPercent(totals.onlineRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              online / (online + tt)
            </div>
          </div>

          {/* KPI 5: Completion rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ giải quyết
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {formatPercent(totals.completionRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              resolved / received
            </div>
          </div>

          {/* KPI 6: On-time completion rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ đúng hạn
            </div>
            <div className="text-xl font-black text-emerald-600 mt-1">
              {formatPercent(totals.onTimeRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              (sớm + đúng) / tổng
            </div>
          </div>

          {/* KPI 7: Overdue rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ quá hạn
            </div>
            <div className={`text-xl font-black mt-1 ${totals.overdueRate > 2 ? 'text-rose-600' : 'text-slate-700'}`}>
              {formatPercent(totals.overdueRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              quá hạn / resolved
            </div>
          </div>

          {/* KPI 8: Pending on-time rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tồn trong hạn
            </div>
            <div className="text-xl font-black text-teal-600 mt-1">
              {formatPercent(totals.pendingOnTimeRate)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              trong hạn / pending
            </div>
          </div>
        </div>
      </div>

      {/* 4. Dedicated Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly volume trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                1. Diễn biến khối lượng theo tháng
              </h3>
              <p className="text-[11px] text-slate-400">
                Xu hướng tiếp nhận, giải quyết và hồ sơ tồn đọng qua các kỳ
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              Chuỗi thời gian
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => formatNumber(Number(val))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="received" name="Tổng tiếp nhận" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="resolved" name="Đã giải quyết" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="pending" name="Đang xử lý (Tồn)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Resolution distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                2. Phân bổ giải quyết
              </h3>
              <p className="text-[11px] text-slate-400">
                Cơ cấu tỷ trọng Trước hạn, Đúng hạn và Quá hạn đã giải quyết
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
              Chất lượng xử lý
            </span>
          </div>
          <div className="h-72 flex items-center justify-center">
            {totals.compTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={resolutionDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name}: ${(((percent || 0) as number) * 100).toFixed(1)}%`}
                  >
                    {resolutionDistributionData.map((entry, index) => (
                      <Cell key={`cell-res-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatNumber(Number(val))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">Chưa có dữ liệu giải quyết trong kỳ</p>
            )}
          </div>
        </div>

        {/* Chart 3: Channel mix */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                3. Cơ cấu kênh tiếp nhận (Channel Mix: Online vs Trực tiếp)
              </h3>
              <p className="text-[11px] text-slate-400">
                Đo lường mức độ số hóa tiếp nhận hồ sơ công dân và doanh nghiệp
              </p>
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              Chuyển đổi số
            </span>
          </div>
          <div className="h-72 flex items-center justify-center">
            {totals.recOnline + totals.recOffline > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name}: ${(((percent || 0) as number) * 100).toFixed(1)}%`}
                  >
                    {channelMixData.map((entry, index) => (
                      <Cell key={`cell-chan-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatNumber(Number(val))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">Chưa có dữ liệu kênh phát sinh mới</p>
            )}
          </div>
        </div>

        {/* Chart 4: Unit performance ranking */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                4. Xếp hạng hiệu năng Đơn vị (Unit Performance Ranking)
              </h3>
              <p className="text-[11px] text-slate-400">
                3 đơn vị cốt lõi: Văn phòng, Phòng Kinh tế, Phòng VHXH
              </p>
            </div>
            <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-md">
              Bảng xếp hạng
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitRankingData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="unitName" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[80, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val, name) => name === 'Tỷ lệ đúng hạn (%)' ? `${val}%` : formatNumber(Number(val))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="rec" name="Tiếp nhận (hồ sơ)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="comp" name="Đã giải quyết (hồ sơ)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="onTimeRate" name="Tỷ lệ đúng hạn (%)" stroke="#f43f5e" strokeWidth={2.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. DETAILED STATISTICAL GRAIN GRID (REPORT + SOURCE + FIELD) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Chi tiết số liệu thống kê hạt nhân (Grain: REPORT + SOURCE + FIELD)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mỗi dòng thể hiện đầy đủ 4 công thức toán học được kiểm chứng tự động. Đơn vị được map tự động từ danh mục Lĩnh vực.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-md">
            Tổng cộng: {filteredStats.length} dòng
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-3 py-2.5">Lĩnh vực & Đơn vị</th>
                <th className="px-3 py-2.5">Nguồn</th>
                <th className="px-3 py-2.5 text-right">Tiếp nhận (Tổng)</th>
                <th className="px-3 py-2.5 text-right">Online / Trực tiếp</th>
                <th className="px-3 py-2.5 text-right">Kỳ trước</th>
                <th className="px-3 py-2.5 text-right">Đã giải quyết</th>
                <th className="px-3 py-2.5 text-right">Trước / Đúng / Trễ</th>
                <th className="px-3 py-2.5 text-right">Đang giải quyết</th>
                <th className="px-3 py-2.5 text-right">Trong hạn / Trễ</th>
                <th className="px-3 py-2.5 text-center">Kiểm chứng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStats.map((row) => {
                const val = validateRowFormulas(row);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{row.field_name_snapshot}</div>
                      <div className="text-[10px] text-slate-400">{row.unit_name_snapshot}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {liveSources.find((s) => s.id === row.source_id)?.source_name || 'Hệ thống'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                      {formatNumber(row.received_total)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-blue-600">
                      {formatNumber(row.received_online)} / {formatNumber(row.received_offline)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {formatNumber(row.carried_forward)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                      {formatNumber(row.completed_total)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {formatNumber(row.completed_early)} / {formatNumber(row.completed_on_time)} / {row.completed_late > 0 ? (
                        <span className="text-rose-600 font-bold">{row.completed_late}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-indigo-600">
                      {formatNumber(row.pending_total)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {formatNumber(row.pending_on_time)} / {row.pending_late > 0 ? (
                        <span className="text-rose-600 font-bold">{row.pending_late}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {val.allPassed ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          <Check className="w-3 h-3 text-emerald-700" />
                          Hợp lệ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded" title={val.errorMessages.join('\n')}>
                          Lỗi
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. MODAL: E2E READ/WRITE TEST RUNNER */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Quy trình kiểm thử khép kín Read/Write (E2E Test)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Create report → insert statistics → query statistics → calculate totals → display dashboard
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isRunningTest ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-slate-800">
                    Đang thực hiện kiểm thử khép kín trên CSDL Supabase...
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Đang gửi các thao tác INSERT, SELECT và xác thực công thức toán học tới Supabase PostgreSQL.
                  </p>
                </div>
              ) : testResult ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    testResult.passed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}>
                    <div className="flex items-center gap-3">
                      {testResult.passed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-rose-600" />
                      )}
                      <div>
                        <div className="font-bold text-sm">
                          {testResult.passed
                            ? 'Kiểm thử khép kín HOÀN TẤT VÀ ĐẠT 100%'
                            : 'Kiểm thử chưa đạt yêu cầu'}
                        </div>
                        <div className="text-xs opacity-90 mt-0.5">
                          Thời gian thực thi: {testResult.totalDurationMs}ms | Số bước: {testResult.steps.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Steps Log */}
                  <div className="space-y-2.5">
                    {testResult.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {step.passed ? (
                              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                                ✓
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px]">
                                ✗
                              </span>
                            )}
                            <span className="font-bold text-slate-800">{step.name}</span>
                          </div>
                          <p className="text-slate-600 pl-6 leading-relaxed">{step.message}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {step.durationMs}ms
                        </span>
                      </div>
                    ))}
                  </div>

                  {testResult.calculatedKpis && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-950 space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        Kết quả chỉ tiêu tính toán tự động từ số liệu CSDL:
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1 font-medium">
                        <div className="bg-white p-2 rounded-lg border border-blue-200">
                          <div className="text-[10px] text-slate-500">Tiếp nhận</div>
                          <div className="text-sm font-bold text-slate-900">{testResult.calculatedKpis.receivedTotal}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-blue-200">
                          <div className="text-[10px] text-slate-500">Tỷ lệ Online</div>
                          <div className="text-sm font-bold text-blue-600">{testResult.calculatedKpis.onlineRate}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-blue-200">
                          <div className="text-[10px] text-slate-500">Tỷ lệ Giải quyết</div>
                          <div className="text-sm font-bold text-emerald-600">{testResult.calculatedKpis.completionRate}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-blue-200">
                          <div className="text-[10px] text-slate-500">Tỷ lệ Đúng hạn</div>
                          <div className="text-sm font-bold text-emerald-600">{testResult.calculatedKpis.onTimeRate}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <Play className="w-8 h-8 text-blue-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-800">
                    Sẵn sàng chạy kiểm thử khép kín
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Hệ thống sẽ thực hiện đầy đủ vòng đời: Tạo báo cáo → Lưu trữ nguồn → Ghi nhận số liệu hạt nhân → Truy vấn ngược → Tính toán các KPI và đối soát 4 công thức toán học.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {hasPassedTest ? '✓ Tính năng AI Analysis đã sẵn sàng' : 'Cần đạt kiểm thử để kích hoạt AI Analysis'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  onClick={handleRunE2ETest}
                  disabled={isRunningTest}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isRunningTest ? 'Đang kiểm thử...' : 'Chạy lại kiểm thử'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: SQL SCRIPTS & MIGRATION VIEWER */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Mã nguồn SQL khởi tạo CSDL Supabase
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sao chép và chạy trực tiếp trong Supabase SQL Editor để tạo 10 bảng cốt lõi và dữ liệu mẫu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
              <button
                onClick={() => setSqlTab('migration')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  sqlTab === 'migration'
                    ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                1. DDL Khởi tạo cấu trúc (001_initial.sql)
              </button>
              <button
                onClick={() => setSqlTab('seed')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  sqlTab === 'seed'
                    ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Dữ liệu mẫu kiểm chứng (002_seed.sql)
              </button>
            </div>

            <div className="p-4 bg-slate-900 text-slate-200 font-mono text-xs overflow-y-auto flex-1 select-all">
              <pre>{sqlTab === 'migration' ? INITIAL_MIGRATION_SQL : SEED_DATA_SQL}</pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Gợi ý: Mở Supabase Dashboard → SQL Editor → Tạo New Query → Dán mã và nhấn RUN.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopySql(sqlTab === 'migration' ? INITIAL_MIGRATION_SQL : SEED_DATA_SQL)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao chép toàn bộ SQL'}
                </button>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
