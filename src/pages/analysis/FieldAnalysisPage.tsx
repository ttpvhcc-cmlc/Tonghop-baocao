import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../../services/store';
import { formatNumber, formatPercent } from '../../utils/format';
import { calcOnTimeRate, calcLateRate, calcPendingLateRate, calcOverdueRateQD776, calcOnlineRate, calcCompletionRate } from '../../features/analysis/formulas';
import { resolveLinhVuc } from '../../utils/fieldResolver';
import { FolderKanban, Search, ChevronRight } from 'lucide-react';

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
  compLateRate: number;
  pendTotal: number;
  pendOnTime: number;
  pendLate: number;
  pendLateRate: number;
  onTimeRate: number;
  onlineRate: number;
  compRate: number;
  qd776Rate: number;
}

export const FieldAnalysisPage: React.FC = () => {
  const [reports, setReports] = useState(store.getReports());
  const [units, setUnits] = useState(store.getUnits());
  const [allFields, setAllFields] = useState(store.getFields());
  const [config, setConfig] = useState(store.getSystemConfig());
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Sorting state
  const [sortKey, setSortKey] = useState<string>('rec_total');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else {
        setSortKey('');
        setSortDirection('desc');
      }
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  useEffect(() => {
    const refresh = () => {
      const nextReports = store.getReports();
      setReports(nextReports);
      setUnits(store.getUnits());
      setAllFields(store.getFields());
      setConfig(store.getSystemConfig());
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
        pendOnTime: number;
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
          pendOnTime: 0,
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
      sec.pendOnTime += s.pending_on_time;
      sec.pendLate += s.pending_late;
    });

    return Object.values(map).map((sec) => {
      const onTimeRate = calcOnTimeRate(sec.compEarly, sec.compOnTime, sec.compTotal);
      const compLateRate = calcLateRate(sec.compLate, sec.compTotal);
      const pendLateRate = calcPendingLateRate(sec.pendLate, sec.pendTotal);
      const qd776Rate = calcOverdueRateQD776(sec.compLate, sec.pendLate, sec.recTotal);
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
        compLateRate,
        pendTotal: sec.pendTotal,
        pendOnTime: sec.pendOnTime,
        pendLate: sec.pendLate,
        pendLateRate,
        onTimeRate,
        onlineRate,
        compRate,
        qd776Rate,
      };
    });
  }, [stats, allFields]);

  const filteredSectors = useMemo(() => {
    const list = sectorSummaries.filter((s) => {
      if (selectedUnitId !== 'ALL' && !s.unitIds.includes(selectedUnitId)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.sectorName.toLowerCase().includes(q) && !s.unitNames.some((u) => u.toLowerCase().includes(q))) {
          return false;
        }
      }
      return true;
    });

    if (!sortKey) return list;

    return [...list].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      switch (sortKey) {
        case 'field':
          valA = a.sectorName.toLowerCase();
          valB = b.sectorName.toLowerCase();
          break;
        case 'unit':
          valA = a.unitNames.join(', ').toLowerCase();
          valB = b.unitNames.join(', ').toLowerCase();
          break;
        case 'rec_total': valA = a.recTotal; valB = b.recTotal; break;
        case 'rec_online': valA = a.recOnline; valB = b.recOnline; break;
        case 'rec_offline': valA = a.recOffline; valB = b.recOffline; break;
        case 'carried': valA = a.carried; valB = b.carried; break;
        case 'comp_total': valA = a.compTotal; valB = b.compTotal; break;
        case 'comp_early': valA = a.compEarly; valB = b.compEarly; break;
        case 'comp_on_time': valA = a.compOnTime; valB = b.compOnTime; break;
        case 'comp_late': valA = a.compLate; valB = b.compLate; break;
        case 'comp_late_rate': valA = a.compLateRate; valB = b.compLateRate; break;
        case 'pend_total': valA = a.pendTotal; valB = b.pendTotal; break;
        case 'pend_on_time': valA = a.pendOnTime; valB = b.pendOnTime; break;
        case 'pend_late': valA = a.pendLate; valB = b.pendLate; break;
        case 'pend_late_rate': valA = a.pendLateRate; valB = b.pendLateRate; break;
        case 'on_time_rate':
        case 'qd776_rate': valA = a.qd776Rate; valB = b.qd776Rate; break;
        case 'online_rate': valA = a.onlineRate; valB = b.onlineRate; break;
        default: return 0;
      }
      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [sectorSummaries, selectedUnitId, search, sortKey, sortDirection]);

  // Totals for filtered sectors
  const totals = useMemo(() => {
    let recTotal = 0, recOnline = 0, recOffline = 0, carried = 0;
    let compTotal = 0, compEarly = 0, compOnTime = 0, compLate = 0;
    let pendTotal = 0, pendOnTime = 0, pendLate = 0;

    filteredSectors.forEach((s) => {
      recTotal += s.recTotal;
      recOnline += s.recOnline;
      recOffline += s.recOffline;
      carried += s.carried;
      compTotal += s.compTotal;
      compEarly += s.compEarly;
      compOnTime += s.compOnTime;
      compLate += s.compLate;
      pendTotal += s.pendTotal;
      pendOnTime += s.pendOnTime;
      pendLate += s.pendLate;
    });

    const onTimeRate = calcOnTimeRate(compEarly, compOnTime, compTotal);
    const compLateRate = calcLateRate(compLate, compTotal);
    const pendLateRate = calcPendingLateRate(pendLate, pendTotal);
    const qd776Rate = calcOverdueRateQD776(compLate, pendLate, recTotal);
    const onlineRate = calcOnlineRate(recOnline, recOffline);

    return {
      recTotal,
      recOnline,
      recOffline,
      carried,
      compTotal,
      compEarly,
      compOnTime,
      compLate,
      compLateRate,
      pendTotal,
      pendOnTime,
      pendLate,
      pendLateRate,
      onTimeRate,
      onlineRate,
      qd776Rate,
    };
  }, [filteredSectors]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {config.pageTitles?.analysisFieldsTitle || 'Phân tích chi tiết theo Lĩnh vực TTHC'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {config.pageTitles?.analysisFieldsSubtitle || `Tổng hợp dữ liệu báo cáo theo từng Lĩnh vực TTHC (${filteredSectors.length} lĩnh vực), theo dõi cơ cấu tiếp nhận, tiến độ giải quyết và tỷ lệ đúng hạn`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm tên lĩnh vực hoặc đơn vị phụ trách (VD: Chứng thực, Đất đai, Hộ tịch, Xây dựng...)"
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

      {/* Table with Multi-level Header */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[750px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-slate-800 font-semibold sticky top-0 z-20 border-b border-slate-300 text-[11px] select-none">
              {/* TẦNG 1: NHÓM CHÍNH */}
              <tr className="border-b border-slate-300">
                <th
                  rowSpan={3}
                  onClick={() => handleSort('index')}
                  className="p-2 text-center w-12 bg-slate-100/95 text-slate-800 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors align-middle"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="font-bold">TT</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {sortKey === 'index' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={3}
                  onClick={() => handleSort('field')}
                  className="p-2.5 min-w-[200px] bg-slate-100/95 text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors text-left align-middle"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold">Lĩnh vực</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {sortKey === 'field' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={3}
                  onClick={() => handleSort('unit')}
                  className="p-2.5 min-w-[150px] bg-slate-100/95 text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors text-left align-middle"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold">Đơn vị suy ra</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {sortKey === 'unit' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                {/* Nhóm 1: TIẾP NHẬN */}
                <th
                  colSpan={4}
                  className="py-1.5 px-3 text-center bg-[#D1E7DD] text-[#0F5132] font-bold uppercase tracking-wide border-r border-b border-[#BADBCC]"
                >
                  SỐ HỒ SƠ TIẾP NHẬN
                </th>
                {/* Nhóm 2: ĐÃ GIẢI QUYẾT */}
                <th
                  colSpan={5}
                  className="py-1.5 px-3 text-center bg-[#FFF3CD] text-[#664D03] font-bold uppercase tracking-wide border-r border-b border-[#FFECB5]"
                >
                  SỐ LƯỢNG HỒ SƠ ĐÃ GIẢI QUYẾT
                </th>
                {/* Nhóm 3: ĐANG GIẢI QUYẾT */}
                <th
                  colSpan={4}
                  className="py-1.5 px-3 text-center bg-[#CFE2FF] text-[#084298] font-bold uppercase tracking-wide border-r border-b border-[#B6D4FE]"
                >
                  SỐ LƯỢNG HỒ SƠ ĐANG GIẢI QUYẾT
                </th>
                {/* Cột % Quá hạn (theo QĐ 776) */}
                <th
                  rowSpan={3}
                  onClick={() => handleSort('qd776_rate')}
                  className="p-2.5 text-center min-w-[95px] bg-slate-100/95 text-slate-800 border-l border-r border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors align-middle"
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="font-bold text-[11px] leading-tight">% Quá hạn</span>
                    <span className="text-[10px] text-slate-500 font-semibold">(QĐ 776)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {sortKey === 'qd776_rate' || sortKey === 'on_time_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                {/* Cột Trực tuyến % */}
                <th
                  rowSpan={3}
                  onClick={() => handleSort('online_rate')}
                  className="p-2.5 text-center min-w-[90px] bg-slate-100/95 text-slate-800 border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors align-middle"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-bold">Trực tuyến %</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {sortKey === 'online_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              </tr>

              {/* TẦNG 2: PHÂN LOẠI CHI TIẾT */}
              <tr className="border-b border-slate-300">
                {/* Dưới TIẾP NHẬN */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('rec_total')}
                  className="p-2 text-right bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Tổng số</span>
                    <span className="text-[10px] text-[#0F5132]/60 font-normal">
                      {sortKey === 'rec_total' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  colSpan={2}
                  className="py-1 px-2 text-center bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-b border-[#BADBCC]"
                >
                  Trong kỳ
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('carried')}
                  className="p-2 text-right bg-[#E8F4EC] text-[#0F5132] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Từ kỳ trước</span>
                    <span className="text-[10px] text-[#0F5132]/60 font-normal">
                      {sortKey === 'carried' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                {/* Dưới ĐÃ GIẢI QUYẾT */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('comp_total')}
                  className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Tổng số</span>
                    <span className="text-[10px] text-[#664D03]/60 font-normal">
                      {sortKey === 'comp_total' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('comp_early')}
                  className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Trước hạn</span>
                    <span className="text-[10px] text-[#664D03]/60 font-normal">
                      {sortKey === 'comp_early' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('comp_on_time')}
                  className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Đúng hạn</span>
                    <span className="text-[10px] text-[#664D03]/60 font-normal">
                      {sortKey === 'comp_on_time' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('comp_late')}
                  className="p-2 text-right bg-[#FFF9E6] text-[#664D03] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Quá hạn</span>
                    <span className="text-[10px] text-[#664D03]/60 font-normal">
                      {sortKey === 'comp_late' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('comp_late_rate')}
                  className="p-2 text-center bg-[#FFF9E6] text-[#854D0E] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#FFF3CD] transition-colors align-middle min-w-[70px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>% Quá hạn</span>
                    <span className="text-[10px] text-[#854D0E]/60 font-normal">
                      {sortKey === 'comp_late_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                {/* Dưới ĐANG GIẢI QUYẾT */}
                <th
                  rowSpan={2}
                  onClick={() => handleSort('pend_total')}
                  className="p-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Tổng số</span>
                    <span className="text-[10px] text-[#084298]/60 font-normal">
                      {sortKey === 'pend_total' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('pend_on_time')}
                  className="p-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Trong hạn</span>
                    <span className="text-[10px] text-[#084298]/60 font-normal">
                      {sortKey === 'pend_on_time' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('pend_late')}
                  className="p-2 text-right bg-[#E7F1FF] text-[#084298] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Quá hạn</span>
                    <span className="text-[10px] text-[#084298]/60 font-normal">
                      {sortKey === 'pend_late' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  onClick={() => handleSort('pend_late_rate')}
                  className="p-2 text-center bg-[#E7F1FF] text-[#075985] font-bold border-r border-slate-300 cursor-pointer hover:bg-[#CFE2FF] transition-colors align-middle min-w-[70px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>% Quá hạn</span>
                    <span className="text-[10px] text-[#075985]/60 font-normal">
                      {sortKey === 'pend_late_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              </tr>

              {/* TẦNG 3: TRONG KỲ (TRỰC TUYẾN & TRỰC TIẾP / BƯU CHÍNH) */}
              <tr className="border-b border-slate-300">
                <th
                  onClick={() => handleSort('rec_online')}
                  className="p-1.5 text-right bg-[#F1F9F4] text-[#0F5132] font-semibold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Trực tuyến</span>
                    <span className="text-[10px] text-[#0F5132]/60 font-normal">
                      {sortKey === 'rec_online' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('rec_offline')}
                  className="p-1.5 text-right bg-[#F1F9F4] text-[#0F5132] font-semibold border-r border-slate-300 cursor-pointer hover:bg-[#D1E7DD] transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Trực tiếp / Bưu chính</span>
                    <span className="text-[10px] text-[#0F5132]/60 font-normal">
                      {sortKey === 'rec_offline' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredSectors.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-12 text-center text-slate-400 font-sans">
                    Không tìm thấy dữ liệu lĩnh vực phù hợp với tiêu chí lọc.
                  </td>
                </tr>
              ) : (
                filteredSectors.map((s, idx) => (
                  <tr key={s.sectorName} className="hover:bg-slate-50 transition-colors bg-white border-b border-slate-100">
                    {/* 1. STT */}
                    <td className="p-2.5 text-center text-slate-500 font-sans border-r border-slate-200">{idx + 1}</td>
                    
                    {/* 2. Lĩnh vực */}
                    <td className="p-2.5 font-sans font-bold text-slate-900 border-r border-slate-200">
                      {s.sectorName}
                    </td>

                    {/* 3. Đơn vị suy ra */}
                    <td className="p-2.5 font-sans font-medium text-slate-700 border-r border-slate-200">
                      {s.unitNames.length > 0 ? s.unitNames.join(', ') : 'Chưa phân công'}
                    </td>

                    {/* 4. TN: Tổng số */}
                    <td className="p-2.5 text-right font-bold text-emerald-950 bg-emerald-50/20 border-r border-slate-200">
                      {formatNumber(s.recTotal)}
                    </td>

                    {/* 5. TN: Trực tuyến */}
                    <td className="p-2.5 text-right text-blue-600 font-medium border-r border-slate-200">
                      {formatNumber(s.recOnline)}
                    </td>

                    {/* 6. TN: Trực tiếp / Bưu chính */}
                    <td className="p-2.5 text-right text-slate-600 border-r border-slate-200">
                      {formatNumber(s.recOffline)}
                    </td>

                    {/* 7. TN: Từ kỳ trước */}
                    <td className="p-2.5 text-right text-amber-600 border-r border-slate-200">
                      {formatNumber(s.carried)}
                    </td>

                    {/* 8. GQ: Tổng số */}
                    <td className="p-2.5 text-right font-bold text-amber-950 bg-amber-50/20 border-r border-slate-200">
                      {formatNumber(s.compTotal)}
                    </td>

                    {/* 9. GQ: Trước hạn */}
                    <td className="p-2.5 text-right text-slate-600 border-r border-slate-200">
                      {formatNumber(s.compEarly)}
                    </td>

                    {/* 10. GQ: Đúng hạn */}
                    <td className="p-2.5 text-right text-slate-600 border-r border-slate-200">
                      {formatNumber(s.compOnTime)}
                    </td>

                    {/* 11. GQ: Quá hạn */}
                    <td
                      className={`p-2.5 text-right border-r border-slate-200 ${
                        s.compLate > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {formatNumber(s.compLate)}
                    </td>

                    {/* 12. GQ: % Quá hạn */}
                    <td
                      className={`p-2.5 text-center font-bold font-sans border-r border-slate-200 ${
                        s.compLate > 0 ? 'text-rose-600' : 'text-slate-400 font-normal'
                      }`}
                    >
                      {formatPercent(s.compLateRate)}
                    </td>

                    {/* 13. ĐANG GQ: Tổng số */}
                    <td className="p-2.5 text-right font-bold text-blue-950 bg-blue-50/20 border-r border-slate-200">
                      {formatNumber(s.pendTotal)}
                    </td>

                    {/* 14. ĐANG GQ: Trong hạn */}
                    <td className="p-2.5 text-right text-slate-600 border-r border-slate-200">
                      {formatNumber(s.pendOnTime)}
                    </td>

                    {/* 15. ĐANG GQ: Quá hạn */}
                    <td
                      className={`p-2.5 text-right border-r border-slate-200 ${
                        s.pendLate > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {formatNumber(s.pendLate)}
                    </td>

                    {/* 16. ĐANG GQ: % Quá hạn */}
                    <td
                      className={`p-2.5 text-center font-bold font-sans border-r border-slate-200 ${
                        s.pendLate > 0 ? 'text-rose-600' : 'text-slate-400 font-normal'
                      }`}
                    >
                      {formatPercent(s.pendLateRate)}
                    </td>

                    {/* 17. % Quá hạn (theo QĐ 776) */}
                    <td className="p-2.5 text-center font-bold font-sans border-r border-slate-200">
                      <span className={s.qd776Rate > 2 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                        {formatPercent(s.qd776Rate)}
                      </span>
                    </td>

                    {/* 18. Trực tuyến % */}
                    <td className="p-2.5 text-center font-bold text-blue-700 font-sans">
                      {formatPercent(s.onlineRate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* DÒNG TỔNG CỘNG */}
            {filteredSectors.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-mono font-bold sticky bottom-0 z-20 border-t-2 border-slate-700">
                <tr>
                  <td className="p-3 text-center border-r border-slate-700">∑</td>
                  <td colSpan={2} className="p-3 font-sans font-black tracking-wide text-xs uppercase text-amber-300 border-r border-slate-700">
                    TỔNG CỘNG ({filteredSectors.length} LĨNH VỰC)
                  </td>
                  <td className="p-3 text-right text-emerald-300 bg-emerald-950/60 border-r border-slate-700">
                    {formatNumber(totals.recTotal)}
                  </td>
                  <td className="p-3 text-right text-emerald-200 border-r border-slate-700">
                    {formatNumber(totals.recOnline)}
                  </td>
                  <td className="p-3 text-right text-slate-300 border-r border-slate-700">
                    {formatNumber(totals.recOffline)}
                  </td>
                  <td className="p-3 text-right text-amber-300 border-r border-slate-700">
                    {formatNumber(totals.carried)}
                  </td>

                  <td className="p-3 text-right text-amber-300 bg-amber-950/60 border-r border-slate-700">
                    {formatNumber(totals.compTotal)}
                  </td>
                  <td className="p-3 text-right text-slate-300 border-r border-slate-700">
                    {formatNumber(totals.compEarly)}
                  </td>
                  <td className="p-3 text-right text-slate-300 border-r border-slate-700">
                    {formatNumber(totals.compOnTime)}
                  </td>
                  <td className="p-3 text-right text-rose-300 border-r border-slate-700">
                    {formatNumber(totals.compLate)}
                  </td>
                  <td className="p-3 text-center text-rose-300 border-r border-slate-700 font-sans">
                    {formatPercent(totals.compLateRate)}
                  </td>

                  <td className="p-3 text-right text-blue-300 bg-blue-950/60 border-r border-slate-700">
                    {formatNumber(totals.pendTotal)}
                  </td>
                  <td className="p-3 text-right text-slate-300 border-r border-slate-700">
                    {formatNumber(totals.pendOnTime)}
                  </td>
                  <td className="p-3 text-right text-rose-300 border-r border-slate-700">
                    {formatNumber(totals.pendLate)}
                  </td>
                  <td className="p-3 text-center text-rose-300 border-r border-slate-700 font-sans">
                    {formatPercent(totals.pendLateRate)}
                  </td>

                  <td className="p-3 text-center font-sans text-amber-300 font-black border-r border-slate-700">
                    {formatPercent(totals.qd776Rate)}
                  </td>
                  <td className="p-3 text-center font-sans text-blue-400 font-black">
                    {formatPercent(totals.onlineRate)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
