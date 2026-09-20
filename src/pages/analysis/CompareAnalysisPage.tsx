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
import { GitCompare, ArrowUpRight, ArrowDownRight, Minus, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const CompareAnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState(store.getReports());
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
    void store.fetchReports().catch((error) => console.warn('Không thể tải báo cáo từ Supabase:', error));
    return unsubscribe;
  }, []);
  useEffect(() => {
    const ids = [repAId, repBId].filter(Boolean);
    void Promise.all(ids.map((rid) => store.fetchStatsByReport(rid)))
      .catch((error) => console.warn('Không thể tải số liệu so sánh từ Supabase:', error));
  }, [repAId, repBId]);


  const repA = useMemo(() => reports.find((r) => r.id === repAId), [reports, repAId]);
  const repB = useMemo(() => reports.find((r) => r.id === repBId), [reports, repBId]);

  const statsA = useMemo(() => repAId ? store.getStatsByReport(repAId) : [], [repAId]);
  const statsB = useMemo(() => repBId ? store.getStatsByReport(repBId) : [], [repBId]);

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

  const diffLate = calcChangeAbsolute(totalsA.late, totalsB.late);
  const diffLatePct = calcChangePercent(totalsA.late, totalsB.late);

  const diffOnTimeRate = totalsA.onTimeRate - totalsB.onTimeRate;

  // Chart data
  const chartData = [
    { name: 'Tiếp nhận', [repA?.report_code || 'Kỳ A']: totalsA.rec, [repB?.report_code || 'Kỳ B']: totalsB.rec },
    { name: 'Đã giải quyết', [repA?.report_code || 'Kỳ A']: totalsA.comp, [repB?.report_code || 'Kỳ B']: totalsB.comp },
    { name: 'Trực tuyến', [repA?.report_code || 'Kỳ A']: totalsA.online, [repB?.report_code || 'Kỳ B']: totalsB.online },
    { name: 'Đang xử lý', [repA?.report_code || 'Kỳ A']: totalsA.pend, [repB?.report_code || 'Kỳ B']: totalsB.pend },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              So sánh biến động giữa các Kỳ Báo cáo
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Đo lường tăng/giảm tuyệt đối và tỷ lệ phần trăm giữa hai kỳ thống kê độc lập
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-blue-700">Kỳ A (Hiện tại):</span>
            <select
              value={repAId}
              onChange={(e) => setRepAId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_code}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400 font-bold">VS</span>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Kỳ B (Gốc):</span>
            <select
              value={repBId}
              onChange={(e) => setRepBId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
            >
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.report_code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tiếp nhận */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Hồ sơ Tiếp nhận</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-slate-900">{formatNumber(totalsA.rec)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatNumber(totalsB.rec)}</span>
          </div>
          <div className={`mt-2 flex items-center gap-1 text-xs font-bold ${diffRec >= 0 ? 'text-blue-600' : 'text-slate-600'}`}>
            {diffRec >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{diffRec >= 0 ? '+' : ''}{formatNumber(diffRec)} ({diffRecPct > 0 ? '+' : ''}{diffRecPct}%)</span>
          </div>
        </div>

        {/* Đã giải quyết */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Đã Giải quyết</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-emerald-600">{formatNumber(totalsA.comp)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatNumber(totalsB.comp)}</span>
          </div>
          <div className={`mt-2 flex items-center gap-1 text-xs font-bold ${diffComp >= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
            {diffComp >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{diffComp >= 0 ? '+' : ''}{formatNumber(diffComp)} ({diffCompPct > 0 ? '+' : ''}{diffCompPct}%)</span>
          </div>
        </div>

        {/* Trực tuyến */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Nộp Trực tuyến</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-blue-600">{formatNumber(totalsA.online)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatNumber(totalsB.online)}</span>
          </div>
          <div className={`mt-2 flex items-center gap-1 text-xs font-bold ${diffOnline >= 0 ? 'text-blue-600' : 'text-slate-600'}`}>
            {diffOnline >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{diffOnline >= 0 ? '+' : ''}{formatNumber(diffOnline)} ({diffOnlinePct > 0 ? '+' : ''}{diffOnlinePct}%)</span>
          </div>
        </div>

        {/* Tỷ lệ đúng hạn */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Tỷ lệ Đúng hạn</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-black text-teal-600">{formatPercent(totalsA.onTimeRate)}</span>
            <span className="text-xs text-slate-400">Gốc: {formatPercent(totalsB.onTimeRate)}</span>
          </div>
          <div className={`mt-2 flex items-center gap-1 text-xs font-bold ${diffOnTimeRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {diffOnTimeRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{diffOnTimeRate >= 0 ? '+' : ''}{diffOnTimeRate.toFixed(1)}% điểm</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4">
          Biểu đồ so sánh trực quan theo các nhóm chỉ tiêu
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
