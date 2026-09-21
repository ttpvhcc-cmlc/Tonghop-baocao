import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { store } from '../services/store';
import { formatNumber, formatPercent, getStatusBadge } from '../utils/format';
import { resolveLinhVuc } from '../utils/fieldResolver';
import {
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcOnlineRate,
  calcPendingRate
} from '../features/analysis/formulas';
import {
  fetchLiveDashboardData,
  validateRowFormulas
} from '../services/dashboardService';
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
  AlertTriangle,
  Database,
  RefreshCw,
  Check,
  Plus,
  FileSpreadsheet
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

  // Load live data from Supabase
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

      setLiveSources(res.sources);
      setLiveStats(res.statistics);

      if (!selectedReportId && res.currentReport) {
        setSelectedReportId(res.currentReport.id);
      }
    } catch (err: any) {
      setDbStatus((prev) => ({ ...prev, connected: false, schemaReady: false, errorMessage: err.message }));
      setLiveReports([]);
      setLiveUnits([]);
      setLiveFields([]);
      setLiveSources([]);
      setLiveStats([]);
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

  // Selected Report Details
  const selectedReport = useMemo(() => {
    return liveReports.find((r) => r.id === selectedReportId) || liveReports[0] || null;
  }, [liveReports, selectedReportId]);

  // Unique sectors for Lĩnh vực TTHC dropdown
  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    liveFields.forEach((f) => {
      const sec = (f.linh_vuc || '').trim();
      if (sec && sec !== 'Chưa phân loại') set.add(sec);
    });
    liveStats.forEach((s) => {
      const sec = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, liveFields);
      if (sec && sec !== 'Chưa phân loại') set.add(sec);
      const raw = (s.field_name_snapshot || s.field_name || '').trim();
      if (raw && raw.length <= 50 && !raw.includes('di sản') && !raw.includes('giám sát') && !raw.includes('hỏa táng')) {
        set.add(raw);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [liveFields, liveStats]);

  // Filtered stats based on active dropdowns
  const filteredStats = useMemo(() => {
    return liveStats.filter((s) => {
      if (selectedUnitId !== 'ALL' && s.unit_id !== selectedUnitId) return false;
      if (selectedSourceId !== 'ALL' && s.source_id !== selectedSourceId) return false;
      if (selectedFieldId !== 'ALL') {
        const sec = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, liveFields);
        const raw = (s.field_name_snapshot || s.field_name || '').trim();
        if (sec !== selectedFieldId && raw !== selectedFieldId && s.field_id !== selectedFieldId) return false;
      }
      return true;
    });
  }, [liveStats, selectedUnitId, selectedSourceId, selectedFieldId, liveFields]);

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
        const repStats = liveStats.filter((s) => s.report_id === rep.id);
        const rec = repStats.reduce((acc, curr) => acc + curr.received_total, 0);
        const comp = repStats.reduce((acc, curr) => acc + curr.completed_total, 0);
        const pend = repStats.reduce((acc, curr) => acc + curr.pending_total, 0);

        // Date chốt báo cáo: data_as_of -> period_end -> period_start
        const dateStr = rep.data_as_of || rep.period_end || rep.period_start || '';
        let closingDateFormatted = dateStr;
        if (dateStr && dateStr.includes('-')) {
          const cleanDate = dateStr.split('T')[0];
          const parts = cleanDate.split('-');
          if (parts.length === 3) {
            closingDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }

        return {
          code: rep.report_code,
          name: closingDateFormatted || rep.report_name,
          reportName: rep.report_name,
          received: rec,
          resolved: comp,
          pending: pend,
        };
      });
  }, [liveReports, liveStats]);

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

  // Chart 4: Unit performance ranking
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

  if (loading && liveReports.length === 0) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        <div className="text-sm font-bold text-slate-800">Đang tải dữ liệu từ CSDL Supabase...</div>
      </div>
    );
  }

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
            <button
              onClick={() => loadData(selectedReportId)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Làm mới
            </button>
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
        {liveReports.length > 0 ? (
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
                <option value="ALL">Tất cả lĩnh vực ({sectorOptions.length})</option>
                {sectorOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            Chưa có kỳ báo cáo nào trong cơ sở dữ liệu Supabase.
          </div>
        )}
      </div>

      {/* Empty State Banner if no reports */}
      {liveReports.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-4">
          <Database className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-800">Cơ sở dữ liệu chưa có Báo cáo</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Hệ thống hoạt động theo kiến trúc DB-only 100% và không tự động sinh dữ liệu ảo. Hãy tạo kỳ báo cáo đầu tiên hoặc nạp dữ liệu từ Excel để bắt đầu phân tích.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Tạo Kỳ báo cáo mới
            </Link>
            <Link
              to="/import"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Nhập số liệu Excel
            </Link>
          </div>
        </div>
      )}

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
        {/* Chart 1: Volume trend by closing date */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                1. Diễn biến khối lượng theo ngày chốt báo cáo
              </h3>
              <p className="text-[11px] text-slate-400">
                Xu hướng tiếp nhận, giải quyết và hồ sơ tồn đọng theo mốc thời gian chốt số liệu
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              Ngày chốt báo cáo
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val) => formatNumber(Number(val))}
                  labelFormatter={(label, items) => {
                    const repName = items && items[0]?.payload?.reportName;
                    return `Ngày chốt số liệu: ${label}${repName ? ` (${repName})` : ''}`;
                  }}
                />
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
                Hiệu suất xử lý và tỷ lệ đúng hạn của các đơn vị
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
                const sectorName = resolveLinhVuc(
                  row.field_name_snapshot || row.field_name || '',
                  row.field_id,
                  liveFields
                );
                const rawSnap = (row.field_name_snapshot || row.field_name || '').trim();
                const isLongProcedure =
                  rawSnap.length > 50 ||
                  rawSnap.includes('di sản') ||
                  rawSnap.includes('giám sát') ||
                  rawSnap.includes('hỏa táng') ||
                  rawSnap.includes('quyền sử dụng đất');
                const displayName =
                  !isLongProcedure && rawSnap
                    ? rawSnap
                    : sectorName !== 'Chưa phân loại'
                    ? sectorName
                    : rawSnap || 'Lĩnh vực TTHC';

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900 text-xs leading-snug">{displayName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{row.unit_name_snapshot || 'Đơn vị'}</div>
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
    </div>
  );
};
