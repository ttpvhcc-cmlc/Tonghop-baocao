import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../../services/store';
import { formatNumber, formatPercent } from '../../utils/format';
import { calcOnTimeRate, calcCompletionRate, calcOnlineRate } from '../../features/analysis/formulas';
import { Building2, Award, AlertCircle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const UnitAnalysisPage: React.FC = () => {
  const reports = useMemo(() => store.getReports(), []);
  const units = useMemo(() => store.getUnits(), []);
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  useEffect(() => {
    const refresh = () => {
      const next = store.getReports();
      setSelectedReportId((current) => current || next[0]?.id || '');
    };
    void store.fetchReports().then(refresh).catch((error) => console.warn('Không thể tải báo cáo từ Supabase:', error));
    return store.subscribe(refresh);
  }, []);
  useEffect(() => {
    if (!selectedReportId) return;
    void store.fetchStatsByReport(selectedReportId).catch((error) => console.warn('Không thể tải số liệu từ Supabase:', error));
  }, [selectedReportId]);


  const stats = useMemo(() => selectedReportId ? store.getStatsByReport(selectedReportId) : [], [selectedReportId]);

  // Aggregate unit data
  const unitSummaries = useMemo(() => {
    return units.map((u) => {
      const uStats = stats.filter((s) => s.unit_id === u.id);
      let rec = 0;
      let recOnline = 0;
      let recOffline = 0;
      let comp = 0;
      let compEarly = 0;
      let compOnTime = 0;
      let compLate = 0;
      let pend = 0;
      let pendLate = 0;

      uStats.forEach((s) => {
        rec += s.received_total;
        recOnline += s.received_online;
        recOffline += s.received_offline;
        comp += s.completed_total;
        compEarly += s.completed_early;
        compOnTime += s.completed_on_time;
        compLate += s.completed_late;
        pend += s.pending_total;
        pendLate += s.pending_late;
      });

      const onTimeRate = calcOnTimeRate(compEarly, compOnTime, comp);
      const onlineRate = calcOnlineRate(recOnline, recOffline);
      const compRate = calcCompletionRate(comp, rec);

      return {
        id: u.id,
        code: u.code,
        name: u.name,
        fieldsCount: uStats.length,
        received: rec,
        receivedOnline: recOnline,
        completed: comp,
        completedLate: compLate,
        pending: pend,
        pendingLate: pendLate,
        onTimeRate,
        onlineRate,
        compRate,
      };
    });
  }, [units, stats]);

  // Sort best performing by onTimeRate
  const sortedUnits = useMemo(() => {
    return [...unitSummaries].sort((a, b) => b.onTimeRate - a.onTimeRate);
  }, [unitSummaries]);

  const topUnit = sortedUnits[0];
  const mostLateUnit = [...unitSummaries].sort((a, b) => b.completedLate - a.completedLate)[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Phân tích hiệu quả theo Đơn vị giải quyết
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Đánh giá khối lượng tiếp nhận, mức độ hoàn thành đúng hạn và tỷ lệ số hóa giữa Văn phòng và các Phòng ban
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Kỳ báo cáo:</label>
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-800"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.report_code} - {r.report_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Đơn vị dẫn đầu tỷ lệ đúng hạn
            </span>
            <h3 className="text-lg font-bold text-emerald-950 mt-0.5">{topUnit?.name}</h3>
            <p className="text-xs text-emerald-700">
              Đạt {formatPercent(topUnit?.onTimeRate)} đúng hạn ({formatNumber(topUnit?.completed)} hồ sơ đã giải quyết).
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Đơn vị cần tập trung giảm trễ hạn
            </span>
            <h3 className="text-lg font-bold text-amber-950 mt-0.5">{mostLateUnit?.name}</h3>
            <p className="text-xs text-amber-700">
              Còn {formatNumber(mostLateUnit?.completedLate)} hồ sơ quá hạn, {formatNumber(mostLateUnit?.pendingLate)} hồ sơ tồn chậm trễ.
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4">
          So sánh Tỷ lệ Đúng hạn & Tỷ lệ Trực tuyến giữa các đơn vị
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={unitSummaries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val) => `${val}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="onTimeRate" name="Tỷ lệ Đúng hạn (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onlineRate" name="Tỷ lệ Trực tuyến (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="compRate" name="Tỷ lệ Giải quyết (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Mã đơn vị</th>
              <th className="p-3">Tên đơn vị giải quyết</th>
              <th className="p-3 text-right">Tổng tiếp nhận</th>
              <th className="p-3 text-right">Nộp trực tuyến</th>
              <th className="p-3 text-right">Tổng đã giải quyết</th>
              <th className="p-3 text-right">Quá hạn</th>
              <th className="p-3 text-right">Đang giải quyết</th>
              <th className="p-3 text-center">Tỷ lệ đúng hạn</th>
              <th className="p-3 text-center">Tỷ lệ trực tuyến</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {unitSummaries.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 font-bold text-blue-600">{u.code}</td>
                <td className="p-3 font-sans font-semibold text-slate-900">{u.name}</td>
                <td className="p-3 text-right font-bold text-slate-800">{formatNumber(u.received)}</td>
                <td className="p-3 text-right text-blue-600">{formatNumber(u.receivedOnline)}</td>
                <td className="p-3 text-right font-bold text-emerald-700">{formatNumber(u.completed)}</td>
                <td className={`p-3 text-right ${u.completedLate > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                  {formatNumber(u.completedLate)}
                </td>
                <td className="p-3 text-right text-amber-600">{formatNumber(u.pending)}</td>
                <td className="p-3 text-center font-sans font-bold text-emerald-700">
                  {formatPercent(u.onTimeRate)}
                </td>
                <td className="p-3 text-center font-sans font-bold text-blue-700">
                  {formatPercent(u.onlineRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
