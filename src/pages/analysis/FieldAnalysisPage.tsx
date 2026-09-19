import React, { useState, useMemo } from 'react';
import { store } from '../../services/store';
import { formatNumber, formatPercent } from '../../utils/format';
import { calcOnTimeRate, calcOnlineRate, calcCompletionRate } from '../../features/analysis/formulas';
import { FolderKanban, Search, Filter } from 'lucide-react';

export const FieldAnalysisPage: React.FC = () => {
  const reports = useMemo(() => store.getReports(), []);
  const units = useMemo(() => store.getUnits(), []);
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => selectedReportId ? store.getStatsByReport(selectedReportId) : [], [selectedReportId]);

  // Aggregate stats by field
  const fieldSummaries = useMemo(() => {
    const map: Record<string, {
      fieldId: string;
      fieldName: string;
      unitId: string;
      unitName: string;
      recTotal: number;
      recOnline: number;
      recOffline: number;
      carried: number;
      compTotal: number;
      compEarly: number;
      compOnTime: number;
      compLate: number;
      pendTotal: number;
      pendLate: number;
    }> = {};

    stats.forEach((s) => {
      if (!map[s.field_id]) {
        map[s.field_id] = {
          fieldId: s.field_id,
          fieldName: s.field_name_snapshot || s.field_name || 'Lĩnh vực',
          unitId: s.unit_id,
          unitName: s.unit_name_snapshot || s.unit_name || 'Đơn vị',
          recTotal: 0,
          recOnline: 0,
          recOffline: 0,
          carried: 0,
          compTotal: 0,
          compEarly: 0,
          compOnTime: 0,
          compLate: 0,
          pendTotal: 0,
          pendLate: 0,
        };
      }
      map[s.field_id].recTotal += s.received_total;
      map[s.field_id].recOnline += s.received_online;
      map[s.field_id].recOffline += s.received_offline;
      map[s.field_id].carried += s.carried_forward;
      map[s.field_id].compTotal += s.completed_total;
      map[s.field_id].compEarly += s.completed_early;
      map[s.field_id].compOnTime += s.completed_on_time;
      map[s.field_id].compLate += s.completed_late;
      map[s.field_id].pendTotal += s.pending_total;
      map[s.field_id].pendLate += s.pending_late;
    });

    return Object.values(map).map((f) => {
      const onTimeRate = calcOnTimeRate(f.compEarly, f.compOnTime, f.compTotal);
      const onlineRate = calcOnlineRate(f.recOnline, f.recOffline);
      const compRate = calcCompletionRate(f.compTotal, f.recTotal);
      return {
        ...f,
        onTimeRate,
        onlineRate,
        compRate,
      };
    });
  }, [stats]);

  const filteredFields = useMemo(() => {
    return fieldSummaries.filter((f) => {
      if (selectedUnitId !== 'ALL' && f.unitId !== selectedUnitId) return false;
      if (search && !f.fieldName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.recTotal - a.recTotal);
  }, [fieldSummaries, selectedUnitId, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Phân tích chi tiết theo Lĩnh vực TTHC
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp dữ liệu đa nguồn cho 15 lĩnh vực chuyên môn, theo dõi tỷ lệ hồ sơ quá hạn và tỷ lệ trực tuyến
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Kỳ:</label>
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-800"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.report_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm tên lĩnh vực (VD: Chứng thực, Đất đai, Hộ tịch...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả đơn vị quản lý</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">STT</th>
              <th className="p-3">Tên Lĩnh vực TTHC</th>
              <th className="p-3">Đơn vị phụ trách</th>
              <th className="p-3 text-right">Tổng tiếp nhận</th>
              <th className="p-3 text-right">Trực tuyến</th>
              <th className="p-3 text-right">Tổng giải quyết</th>
              <th className="p-3 text-right">Trước hạn</th>
              <th className="p-3 text-right">Quá hạn</th>
              <th className="p-3 text-right">Đang giải quyết</th>
              <th className="p-3 text-center">Tỷ lệ đúng hạn</th>
              <th className="p-3 text-center">Tỷ lệ trực tuyến</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredFields.map((f, idx) => (
              <tr key={f.fieldId} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 text-slate-400 font-sans">{idx + 1}</td>
                <td className="p-3 font-sans font-bold text-slate-900">{f.fieldName}</td>
                <td className="p-3 font-sans font-medium text-slate-600">{f.unitName}</td>
                <td className="p-3 text-right font-bold text-slate-800">{formatNumber(f.recTotal)}</td>
                <td className="p-3 text-right text-blue-600">{formatNumber(f.recOnline)}</td>
                <td className="p-3 text-right font-bold text-emerald-700">{formatNumber(f.compTotal)}</td>
                <td className="p-3 text-right text-slate-600">{formatNumber(f.compEarly)}</td>
                <td className={`p-3 text-right ${f.compLate > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                  {formatNumber(f.compLate)}
                </td>
                <td className="p-3 text-right text-amber-600">{formatNumber(f.pendTotal)}</td>
                <td className="p-3 text-center font-sans font-bold text-emerald-700">
                  {formatPercent(f.onTimeRate)}
                </td>
                <td className="p-3 text-center font-sans font-bold text-blue-700">
                  {formatPercent(f.onlineRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
