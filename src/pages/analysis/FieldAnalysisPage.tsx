import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../../services/store';
import { formatNumber, formatPercent } from '../../utils/format';
import { calcOnTimeRate, calcOnlineRate, calcCompletionRate } from '../../features/analysis/formulas';
import { resolveLinhVuc } from '../../utils/fieldResolver';
import { FolderKanban, Search } from 'lucide-react';

interface SectorSummary {
  sectorName: string;
  unitIds: string[];
  unitNames: string[];
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
  onTimeRate: number;
  onlineRate: number;
  compRate: number;
}

export const FieldAnalysisPage: React.FC = () => {
  const [reports, setReports] = useState(store.getReports());
  const [units, setUnits] = useState(store.getUnits());
  const [allFields, setAllFields] = useState(store.getFields());
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const refresh = () => {
      const nextReports = store.getReports();
      setReports(nextReports);
      setUnits(store.getUnits());
      setAllFields(store.getFields());
      setSelectedReportId((current) => current || nextReports[0]?.id || '');
    };
    void store.fetchReports().then(refresh).catch((error) => console.warn('Không thể tải báo cáo từ Supabase:', error));
    return store.subscribe(refresh);
  }, []);

  useEffect(() => {
    if (!selectedReportId) return;
    void store.fetchStatsByReport(selectedReportId).catch((error) => console.warn('Không thể tải số liệu từ Supabase:', error));
  }, [selectedReportId]);

  const stats = useMemo(() => (selectedReportId ? store.getStatsByReport(selectedReportId) : []), [selectedReportId]);

  // Aggregate stats strictly by Lĩnh vực TTHC (Sector Name)
  const sectorSummaries = useMemo<SectorSummary[]>(() => {
    const map: Record<
      string,
      {
        sectorName: string;
        unitIdsSet: Set<string>;
        unitNamesSet: Set<string>;
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
      }
    > = {};

    stats.forEach((s) => {
      const sectorName = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, allFields);
      const unitName = s.unit_name_snapshot || s.unit_name || 'Đơn vị';

      if (!map[sectorName]) {
        map[sectorName] = {
          sectorName,
          unitIdsSet: new Set(),
          unitNamesSet: new Set(),
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

      const sec = map[sectorName];
      if (s.unit_id) sec.unitIdsSet.add(s.unit_id);
      if (unitName) sec.unitNamesSet.add(unitName);

      sec.recTotal += s.received_total;
      sec.recOnline += s.received_online;
      sec.recOffline += s.received_offline;
      sec.carried += s.carried_forward;
      sec.compTotal += s.completed_total;
      sec.compEarly += s.completed_early;
      sec.compOnTime += s.completed_on_time;
      sec.compLate += s.completed_late;
      sec.pendTotal += s.pending_total;
      sec.pendLate += s.pending_late;
    });

    return Object.values(map).map((sec) => {
      const onTimeRate = calcOnTimeRate(sec.compEarly, sec.compOnTime, sec.compTotal);
      const onlineRate = calcOnlineRate(sec.recOnline, sec.recOffline);
      const compRate = calcCompletionRate(sec.compTotal, sec.recTotal);

      return {
        sectorName: sec.sectorName,
        unitIds: Array.from(sec.unitIdsSet),
        unitNames: Array.from(sec.unitNamesSet),
        recTotal: sec.recTotal,
        recOnline: sec.recOnline,
        recOffline: sec.recOffline,
        carried: sec.carried,
        compTotal: sec.compTotal,
        compEarly: sec.compEarly,
        compOnTime: sec.compOnTime,
        compLate: sec.compLate,
        pendTotal: sec.pendTotal,
        pendLate: sec.pendLate,
        onTimeRate,
        onlineRate,
        compRate,
      };
    });
  }, [stats, allFields]);

  const filteredSectors = useMemo(() => {
    return sectorSummaries
      .filter((s) => {
        if (selectedUnitId !== 'ALL' && !s.unitIds.includes(selectedUnitId)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!s.sectorName.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.recTotal - a.recTotal);
  }, [sectorSummaries, selectedUnitId, search]);

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
            Tổng hợp dữ liệu báo cáo theo từng Lĩnh vực TTHC ({filteredSectors.length} lĩnh vực), theo dõi tỷ lệ hồ sơ đúng hạn và trực tuyến
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
                {r.report_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm tên lĩnh vực (VD: Chứng thực, Đất đai, Hộ tịch, Xây dựng...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
              <th className="p-3 w-12 text-center">STT</th>
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
          <tbody className="divide-y divide-slate-100">
            {filteredSectors.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400 font-sans">
                  Không tìm thấy dữ liệu lĩnh vực phù hợp.
                </td>
              </tr>
            ) : (
              filteredSectors.map((s, idx) => (
                <tr key={s.sectorName} className="hover:bg-slate-50 transition-colors bg-white">
                  <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900">{s.sectorName}</td>
                  <td className="p-3 font-medium text-slate-600">
                    {s.unitNames.length > 0 ? s.unitNames.join(', ') : 'Chưa phân công'}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 font-mono">
                    {formatNumber(s.recTotal)}
                  </td>
                  <td className="p-3 text-right text-blue-600 font-mono">{formatNumber(s.recOnline)}</td>
                  <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                    {formatNumber(s.compTotal)}
                  </td>
                  <td className="p-3 text-right text-slate-600 font-mono">{formatNumber(s.compEarly)}</td>
                  <td
                    className={`p-3 text-right font-mono ${
                      s.compLate > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {formatNumber(s.compLate)}
                  </td>
                  <td className="p-3 text-right text-amber-600 font-mono">{formatNumber(s.pendTotal)}</td>
                  <td className="p-3 text-center font-bold text-emerald-700">
                    {formatPercent(s.onTimeRate)}
                  </td>
                  <td className="p-3 text-center font-bold text-blue-700">
                    {formatPercent(s.onlineRate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
