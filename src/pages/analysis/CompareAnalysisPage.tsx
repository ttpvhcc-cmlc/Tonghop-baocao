import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { store } from '../../services/store';
import { formatNumber, formatPercent } from '../../utils/format';
import {
  calcChangeAbsolute,
  calcChangePercent,
  calcCompletionRate,
  calcOnTimeRate,
  calcOnlineRate
} from '../../features/analysis/formulas';
import { GitCompare, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Filter } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export const CompareAnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState(store.getReports());

  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const initialRep1 = searchParams.get('rep1') || reports[0]?.id || '';
  const initialRep2 = searchParams.get('rep2') || reports[1]?.id || reports[0]?.id || '';

  const [repAId, setRepAId] = useState<string>(initialRep1);
  const [repBId, setRepBId] = useState<string>(initialRep2);
  const [, forceRefresh] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setReports(store.getReports());
      forceRefresh((v) => v + 1);
    };
    const unsubscribe = store.subscribe(refresh);
    void store.syncWithSupabase().catch((err: unknown) => console.warn('Không thể tải toàn bộ dữ liệu:', err));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const ids = [repAId, repBId].filter(Boolean);
    void Promise.all(ids.map((rid) => store.fetchStatsByReport(rid)))
      .catch((error) => console.warn('Không thể tải số liệu so sánh:', error));
  }, [repAId, repBId]);

  // Distinct Years and Months from all reports
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      const d = r.data_as_of || r.period_end || r.period_start || '';
      if (d && d.length >= 4) {
        set.add(d.slice(0, 4));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      const d = r.data_as_of || r.period_end || r.period_start || '';
      if (d && d.length >= 7) {
        const m = d.slice(5, 7);
        if (m) set.add(m);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  // Filtered reports matching active Year and Month
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const d = r.data_as_of || r.period_end || r.period_start || '';
      if (selectedYear !== 'ALL' && !d.startsWith(selectedYear)) return false;
      if (selectedMonth !== 'ALL') {
        const m = d.slice(5, 7);
        if (m !== selectedMonth) return false;
      }
      return true;
    });
  }, [reports, selectedYear, selectedMonth]);

  // Synchronize repAId and repBId if they fall outside filteredReports
  useEffect(() => {
    if (filteredReports.length > 0) {
      if (!filteredReports.some((r) => r.id === repAId)) {
        setRepAId(filteredReports[0].id);
      }
      if (!filteredReports.some((r) => r.id === repBId)) {
        setRepBId(filteredReports[1]?.id || filteredReports[0].id);
      }
    }
  }, [filteredReports]);

  const repA = useMemo(() => reports.find((r) => r.id === repAId), [reports, repAId]);
  const repB = useMemo(() => reports.find((r) => r.id === repBId), [reports, repBId]);

  const statsA = useMemo(() => (repAId ? store.getStatsByReport(repAId) : []), [repAId]);
  const statsB = useMemo(() => (repBId ? store.getStatsByReport(repBId) : []), [repBId]);

  // Aggregate totals
  const aggregateStats = (items: typeof statsA) => {
    let rec = 0;
    let online = 0;
    let offline = 0;
    let comp = 0;
    let early = 0;
    let onTime = 0;
    let late = 0;
    let pend = 0;

    items.forEach((s) => {
      rec += s.received_total;
      online += s.received_online;
      offline += s.received_offline;
      comp += s.completed_total;
      early += s.completed_early;
      onTime += s.completed_on_time;
      late += s.completed_late;
      pend += s.pending_total;
    });

    const onTimeRate = calcOnTimeRate(early, onTime, comp);
    const onlineRate = calcOnlineRate(online, offline);
    const compRate = calcCompletionRate(comp, rec);

    return { rec, online, comp, late, pend, onTimeRate, onlineRate, compRate };
  };

  const totalsA = useMemo(() => aggregateStats(statsA), [statsA]);
  const totalsB = useMemo(() => aggregateStats(statsB), [statsB]);

  // Comparison metrics (A compared to B)
  const diffRec = calcChangeAbsolute(totalsA.rec, totalsB.rec);
  const diffRecPct = calcChangePercent(totalsA.rec, totalsB.rec);

  const diffComp = calcChangeAbsolute(totalsA.comp, totalsB.comp);
  const diffCompPct = calcChangePercent(totalsA.comp, totalsB.comp);

  const diffOnline = calcChangeAbsolute(totalsA.online, totalsB.online);
  const diffOnlinePct = calcChangePercent(totalsA.online, totalsB.online);

  const diffOnTimeRate = totalsA.onTimeRate - totalsB.onTimeRate;

  // Bar Chart comparison data
  const chartData = [
    { name: 'Tiếp nhận', [repA?.report_code || 'Kỳ A']: totalsA.rec, [repB?.report_code || 'Kỳ B']: totalsB.rec },
    { name: 'Đã giải quyết', [repA?.report_code || 'Kỳ A']: totalsA.comp, [repB?.report_code || 'Kỳ B']: totalsB.comp },
    { name: 'Trực tuyến', [repA?.report_code || 'Kỳ A']: totalsA.online, [repB?.report_code || 'Kỳ B']: totalsB.online },
    { name: 'Đang xử lý', [repA?.report_code || 'Kỳ A']: totalsA.pend, [repB?.report_code || 'Kỳ B']: totalsB.pend }
  ];

  // Volume Trend chart data sorted chronologically by closing date
  const trendData = useMemo(() => {
    const sorted = [...reports].sort((a, b) => {
      const dateA = a.data_as_of || a.period_end || a.period_start || '';
      const dateB = b.data_as_of || b.period_end || b.period_start || '';
      return dateA.localeCompare(dateB);
    });

    return sorted
      .filter((rep) => {
        const dateStr = rep.data_as_of || rep.period_end || rep.period_start || '';
        if (selectedYear !== 'ALL' && !dateStr.startsWith(selectedYear)) return false;
        if (selectedMonth !== 'ALL' && dateStr.slice(5, 7) !== selectedMonth) return false;
        return true;
      })
      .map((rep) => {
        const repStats = store.getStatsByReport(rep.id);
        const rec = repStats.reduce((acc, curr) => acc + curr.received_total, 0);
        const comp = repStats.reduce((acc, curr) => acc + curr.completed_total, 0);
        const pend = repStats.reduce((acc, curr) => acc + curr.pending_total, 0);

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
          id: rep.id,
          code: rep.report_code,
          name: closingDateFormatted || rep.report_name,
          reportName: rep.report_name,
          received: rec,
          resolved: comp,
          pending: pend
        };
      });
  }, [reports, selectedYear, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Top Header & Year/Month Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              So sánh biến động giữa các Kỳ Báo cáo
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi diễn biến theo mốc thời gian và so sánh trực quan tăng/giảm tuyệt đối giữa các kỳ
          </p>
        </div>

        {/* Global Year & Month Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Lọc kỳ theo:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả năm ({availableYears.length})</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Năm {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-600">Tháng:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả tháng</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>

          {(selectedYear !== 'ALL' || selectedMonth !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedYear('ALL');
                setSelectedMonth('ALL');
              }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline px-1"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* CHART 1: Volume trend by closing date */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Diễn biến khối lượng theo ngày chốt báo cáo
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Trục hoành hiển thị ngày chốt số liệu báo cáo thực tế qua từng mốc thời gian (Tháng / Năm)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
              {trendData.length} Mốc báo cáo
            </span>
          </div>
        </div>

        <div className="h-72">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
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
                <Line
                  type="monotone"
                  dataKey="received"
                  name="Tổng tiếp nhận"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Đã giải quyết"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="pending"
                  name="Đang xử lý (Tồn)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
              Không có dữ liệu báo cáo nào phù hợp với bộ lọc Năm / Tháng đã chọn.
            </div>
          )}
        </div>
      </div>

      {/* Selectors for Comparing Period A vs Period B */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
            Đối sánh chi tiết giữa 2 Kỳ Báo cáo
          </span>
          <p className="text-xs text-slate-300 mt-0.5">
            Chọn Kỳ A (kỳ phân tích) và Kỳ B (kỳ đối chứng) trong các báo cáo thuộc bộ lọc
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-blue-300">Kỳ A (Hiện tại):</span>
            <select
              value={repAId}
              onChange={(e) => setRepAId(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_code} ({r.data_as_of ? `Chốt: ${r.data_as_of.slice(0, 10)}` : r.report_name})
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-amber-400 font-black">VS</span>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300">Kỳ B (Gốc):</span>
            <select
              value={repBId}
              onChange={(e) => setRepBId(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_code} ({r.data_as_of ? `Chốt: ${r.data_as_of.slice(0, 10)}` : r.report_name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tiếp nhận */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Hồ sơ Tiếp nhận</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-slate-900">{formatNumber(totalsA.rec)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatNumber(totalsB.rec)}</span>
          </div>
          <div
            className={`mt-2 flex items-center gap-1 text-xs font-bold ${
              diffRec >= 0 ? 'text-blue-600' : 'text-slate-600'
            }`}
          >
            {diffRec >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>
              {diffRec >= 0 ? '+' : ''}
              {formatNumber(diffRec)} ({diffRecPct > 0 ? '+' : ''}
              {diffRecPct}%)
            </span>
          </div>
        </div>

        {/* Đã giải quyết */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Đã Giải quyết</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-emerald-600">{formatNumber(totalsA.comp)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatNumber(totalsB.comp)}</span>
          </div>
          <div
            className={`mt-2 flex items-center gap-1 text-xs font-bold ${
              diffComp >= 0 ? 'text-emerald-600' : 'text-slate-600'
            }`}
          >
            {diffComp >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>
              {diffComp >= 0 ? '+' : ''}
              {formatNumber(diffComp)} ({diffCompPct > 0 ? '+' : ''}
              {diffCompPct}%)
            </span>
          </div>
        </div>

        {/* Trực tuyến */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Nộp Trực tuyến</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-blue-600">{formatNumber(totalsA.online)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatNumber(totalsB.online)}</span>
          </div>
          <div
            className={`mt-2 flex items-center gap-1 text-xs font-bold ${
              diffOnline >= 0 ? 'text-blue-600' : 'text-slate-600'
            }`}
          >
            {diffOnline >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>
              {diffOnline >= 0 ? '+' : ''}
              {formatNumber(diffOnline)} ({diffOnlinePct > 0 ? '+' : ''}
              {diffOnlinePct}%)
            </span>
          </div>
        </div>

        {/* Tỷ lệ đúng hạn */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Tỷ lệ Đúng hạn</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-teal-600">{formatPercent(totalsA.onTimeRate)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatPercent(totalsB.onTimeRate)}</span>
          </div>
          <div
            className={`mt-2 flex items-center gap-1 text-xs font-bold ${
              diffOnTimeRate >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {diffOnTimeRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>
              {diffOnTimeRate >= 0 ? '+' : ''}
              {diffOnTimeRate.toFixed(1)}% điểm
            </span>
          </div>
        </div>
      </div>

      {/* CHART 2: Visual Comparison Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4">
          Biểu đồ đối sánh chi tiết chỉ tiêu: {repA?.report_code || 'Kỳ A'} so với {repB?.report_code || 'Kỳ B'}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val) => formatNumber(Number(val))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={repA?.report_code || 'Kỳ A'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey={repB?.report_code || 'Kỳ B'} fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
