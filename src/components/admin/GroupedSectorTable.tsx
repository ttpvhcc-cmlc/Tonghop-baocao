import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Search,
  Filter,
  Layers,
  Building2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import type { Field, Unit } from '../../types/database';

interface GroupedSectorTableProps {
  fields: Field[];
  units: Unit[];
  onEditField: (field: Field) => void;
  onDeleteField: (field: Field) => void;
  onAssignSectorUnit: (sectorName: string, unitId: string) => Promise<void> | void;
  onUpdateFieldUnit: (fieldId: string, unitId: string) => Promise<void> | void;
}

export const GroupedSectorTable: React.FC<GroupedSectorTableProps> = ({
  fields,
  units,
  onEditField,
  onDeleteField,
  onAssignSectorUnit,
  onUpdateFieldUnit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
  const [collapsedSectors, setCollapsedSectors] = useState<Record<string, boolean>>({});
  const [updatingSector, setUpdatingSector] = useState<string | null>(null);
  const [updatingFieldId, setUpdatingFieldId] = useState<string | null>(null);

  // Extract distinct sectors
  const allSectors = useMemo(() => {
    const set = new Set<string>();
    fields.forEach((f) => {
      set.add((f.linh_vuc || 'Chưa phân loại').trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [fields]);

  // Filtered fields
  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      const sec = (f.linh_vuc || 'Chưa phân loại').trim();
      const unit = units.find((u) => u.id === f.unit_id);
      const unitName = unit ? unit.name : '';

      // Sector filter
      if (selectedSectorFilter !== 'all' && sec !== selectedSectorFilter) {
        return false;
      }

      // Unit filter
      if (selectedUnitFilter === 'unassigned') {
        if (f.unit_id) return false;
      } else if (selectedUnitFilter !== 'all') {
        if (f.unit_id !== selectedUnitFilter) return false;
      }

      // Level filter
      if (selectedLevelFilter !== 'all') {
        if ((f.muc_do_cung_cap || '').trim() !== selectedLevelFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = (f.code || '').toLowerCase().includes(q);
        const matchName = (f.name || '').toLowerCase().includes(q);
        const matchSec = sec.toLowerCase().includes(q);
        const matchUnit = unitName.toLowerCase().includes(q);
        const matchCq = (f.co_quan_thuc_hien || '').toLowerCase().includes(q) || (f.co_quan_cong_bo || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchSec && !matchUnit && !matchCq) {
          return false;
        }
      }

      return true;
    });
  }, [fields, units, selectedSectorFilter, selectedUnitFilter, selectedLevelFilter, searchTerm]);

  // Group filtered fields by sector
  const groupedData = useMemo(() => {
    const map = new Map<string, Field[]>();

    filteredFields.forEach((f) => {
      const sec = (f.linh_vuc || 'Chưa phân loại').trim();
      if (!map.has(sec)) {
        map.set(sec, []);
      }
      map.get(sec)!.push(f);
    });

    // Return array of groups sorted by sector name
    return Array.from(map.entries()).map(([sectorName, items]) => {
      // Find the dominant unit assigned to this sector (if all or majority share it)
      const unitCounts: Record<string, number> = {};
      items.forEach((item) => {
        if (item.unit_id) {
          unitCounts[item.unit_id] = (unitCounts[item.unit_id] || 0) + 1;
        }
      });

      let dominantUnitId = '';
      let maxCount = 0;
      Object.entries(unitCounts).forEach(([uid, cnt]) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          dominantUnitId = uid;
        }
      });

      const assignedCount = items.filter((i) => i.unit_id).length;
      const isAllSameUnit = assignedCount === items.length && items.length > 0 && maxCount === items.length;

      return {
        sectorName,
        items: items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
        totalCount: items.length,
        assignedCount,
        dominantUnitId: isAllSameUnit ? dominantUnitId : (maxCount > 0 ? dominantUnitId : ''),
        isFullyAssigned: assignedCount === items.length && items.length > 0,
      };
    });
  }, [filteredFields]);

  // Toggle single sector collapse
  const toggleCollapse = (sectorName: string) => {
    setCollapsedSectors((prev) => ({
      ...prev,
      [sectorName]: !prev[sectorName],
    }));
  };

  // Expand / Collapse all
  const expandAll = () => setCollapsedSectors({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedData.forEach((g) => {
      allCollapsed[g.sectorName] = true;
    });
    setCollapsedSectors(allCollapsed);
  };

  // Handle sector-wide unit assignment
  const handleSectorUnitChange = async (sectorName: string, unitId: string) => {
    if (!unitId) return;
    setUpdatingSector(sectorName);
    try {
      await onAssignSectorUnit(sectorName, unitId);
    } finally {
      setUpdatingSector(null);
    }
  };

  // Handle single row unit assignment
  const handleSingleUnitChange = async (fieldId: string, unitId: string) => {
    setUpdatingFieldId(fieldId);
    try {
      await onUpdateFieldUnit(fieldId, unitId);
    } finally {
      setUpdatingFieldId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* FILTER & CONTROL TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo Mã TTHC, Tên thủ tục, Lĩnh vực, Đơn vị, Cơ quan..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Lĩnh vực filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedSectorFilter}
                onChange={(e) => setSelectedSectorFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer max-w-[160px] truncate"
              >
                <option value="all">Tất cả Lĩnh vực ({allSectors.length})</option>
                {allSectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Đơn vị thực hiện filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedUnitFilter}
                onChange={(e) => setSelectedUnitFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer max-w-[170px] truncate"
              >
                <option value="all">Tất cả Đơn vị ({units.length})</option>
                <option value="unassigned">⚠️ Chưa phân công</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mức độ DVC filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedLevelFilter}
                onChange={(e) => setSelectedLevelFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer"
              >
                <option value="all">Mức độ DVC: Tất cả</option>
                <option value="Toàn trình">Toàn trình</option>
                <option value="Một phần">Một phần</option>
                <option value="Chưa cung cấp DVC">Chưa cung cấp DVC</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || selectedSectorFilter !== 'all' || selectedUnitFilter !== 'all' || selectedLevelFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSectorFilter('all');
                  setSelectedUnitFilter('all');
                  setSelectedLevelFilter('all');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                title="Xóa bộ lọc"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Bar with Expand/Collapse buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Hiển thị <strong className="text-slate-800">{filteredFields.length}</strong> thủ tục thuộc{' '}
              <strong className="text-slate-800">{groupedData.length}</strong> lĩnh vực
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {filteredFields.filter((f) => f.unit_id).length} đã gán đơn vị
            </span>
            {filteredFields.some((f) => !f.unit_id) && (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                {filteredFields.filter((f) => !f.unit_id).length} chưa gán
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            >
              Mở rộng tất cả
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            >
              Thu gọn tất cả
            </button>
          </div>
        </div>
      </div>

      {/* UNIFIED MASTER TABLE WITH SECTOR GROUP HEADERS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
            {/* Table Column Headers (without repetitive Linh Vuc column) */}
            <thead className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-20 backdrop-blur-xs">
              <tr>
                <th className="p-3 w-12 text-center">STT</th>
                <th className="p-3 w-28">Mã TTHC</th>
                <th className="p-3 min-w-[280px]">Tên Thủ tục hành chính</th>
                <th className="p-3 w-36">Cơ quan công bố</th>
                <th className="p-3 w-28">Loại TTHC</th>
                <th className="p-3 w-40">Cơ quan thực hiện</th>
                <th className="p-3 w-28">Cấp thực hiện</th>
                <th className="p-3 w-32">Mức độ cung cấp</th>
                <th className="p-3 w-28">Phí - Lệ phí</th>
                <th className="p-3 w-64 bg-blue-50/50 border-l border-r border-blue-100 font-extrabold text-blue-900">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Đơn vị thực hiện</span>
                  </div>
                </th>
                <th className="p-3 w-24 text-right">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {groupedData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <FolderOpen className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">Không tìm thấy thủ tục nào</p>
                      <p className="text-xs text-slate-500">
                        Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại các bộ lọc bên trên.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                groupedData.map((group, groupIdx) => {
                  const isCollapsed = !!collapsedSectors[group.sectorName];
                  const isSectorUpdating = updatingSector === group.sectorName;

                  return (
                    <React.Fragment key={`sector_${group.sectorName}`}>
                      {/* GROUP HEADER ROW - LĨNH VỰC BẬC 1 */}
                      <tr className="bg-slate-100/95 hover:bg-slate-200/80 transition-colors border-t-2 border-slate-300/80 font-semibold sticky z-10">
                        <td colSpan={9} className="p-3">
                          <div className="flex items-center gap-3">
                            {/* Collapse/Expand Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleCollapse(group.sectorName)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                              title={isCollapsed ? 'Mở rộng nhóm' : 'Thu gọn nhóm'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-700" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-700" />
                              )}
                            </button>

                            {/* Sector Name & Count */}
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                <Layers className="w-4 h-4" />
                              </span>
                              <div>
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                  <span>LĨNH VỰC: {group.sectorName}</span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-slate-700 border border-slate-300 shadow-2xs">
                                    {group.totalCount} thủ tục
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Assignment Status Badge */}
                            <div className="ml-2">
                              {group.isFullyAssigned ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 text-[11px] font-semibold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  100% đã phân công
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-semibold">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  {group.assignedCount}/{group.totalCount} đã gán
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* SECTOR-WIDE UNIT ASSIGNMENT SELECTOR */}
                        <td className="p-2 bg-blue-50/70 border-l border-r border-blue-200">
                          <div className="flex items-center gap-2">
                            <select
                              disabled={isSectorUpdating}
                              value={group.dominantUnitId || ''}
                              onChange={(e) => handleSectorUnitChange(group.sectorName, e.target.value)}
                              className="w-full text-xs bg-white border border-blue-300 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                              title="Phân công Đơn vị này cho TOÀN BỘ các thủ tục thuộc Lĩnh vực"
                            >
                              <option value="">-- Phân công toàn bộ Lĩnh vực --</option>
                              {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  Phân cho: {u.name} ({u.code})
                                </option>
                              ))}
                            </select>
                            {isSectorUpdating && (
                              <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                            )}
                          </div>
                        </td>

                        {/* Quick Sector Actions */}
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => toggleCollapse(group.sectorName)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-200 transition-colors"
                          >
                            {isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                          </button>
                        </td>
                      </tr>

                      {/* PROCEDURE ROWS WITHIN THIS SECTOR */}
                      {!isCollapsed &&
                        group.items.map((field, rowIdx) => {
                          const unit = units.find((u) => u.id === field.unit_id);
                          const isUpdatingThisRow = updatingFieldId === field.id;

                          return (
                            <tr
                              key={field.id}
                              className="hover:bg-blue-50/40 transition-colors bg-white group"
                            >
                              {/* STT */}
                              <td className="p-3 text-center font-mono text-slate-400 font-medium">
                                {groupIdx + 1}.{rowIdx + 1}
                              </td>

                              {/* Mã TTHC */}
                              <td className="p-3">
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-150 text-[11px]">
                                  {field.code}
                                </span>
                              </td>

                              {/* Tên Thủ tục */}
                              <td className="p-3">
                                <div className="font-semibold text-slate-800 leading-snug">
                                  {field.name}
                                </div>
                                {field.quyet_dinh_cong_bo && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                    QĐ: {field.quyet_dinh_cong_bo}
                                  </div>
                                )}
                              </td>

                              {/* Cơ quan công bố */}
                              <td className="p-3 text-slate-600 text-[11px]">
                                {field.co_quan_cong_bo || <span className="text-slate-300">-</span>}
                              </td>

                              {/* Loại TTHC */}
                              <td className="p-3 text-slate-600 text-[11px]">
                                {field.loai_tthc ? (
                                  <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                                    {field.loai_tthc}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* Cơ quan thực hiện */}
                              <td className="p-3 text-slate-600 text-[11px]">
                                {field.co_quan_thuc_hien || <span className="text-slate-300">-</span>}
                              </td>

                              {/* Cấp thực hiện */}
                              <td className="p-3 text-slate-600 text-[11px]">
                                {field.cap_thuc_hien || <span className="text-slate-300">-</span>}
                              </td>

                              {/* Mức độ cung cấp */}
                              <td className="p-3">
                                {field.muc_do_cung_cap ? (
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                      field.muc_do_cung_cap === 'Toàn trình'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : field.muc_do_cung_cap === 'Một phần'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {field.muc_do_cung_cap}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">-</span>
                                )}
                              </td>

                              {/* Phí - Lệ phí */}
                              <td className="p-3 text-[11px]">
                                {field.phi_le_phi ? (
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                                      field.phi_le_phi.includes('Có thu')
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : field.phi_le_phi.includes('Miễn phí')
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {field.phi_le_phi}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* ĐƠN VỊ THỰC HIỆN - INLINE ADJUSTMENT FOR THIS PROCEDURE */}
                              <td className="p-2 bg-blue-50/20 border-l border-r border-blue-100">
                                <div className="flex items-center gap-1.5">
                                  <select
                                    disabled={isUpdatingThisRow}
                                    value={field.unit_id || ''}
                                    onChange={(e) => handleSingleUnitChange(field.id, e.target.value)}
                                    className={`w-full text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                                      unit
                                        ? 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100/70'
                                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    <option value="">-- Chưa gán đơn vị --</option>
                                    {units.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name} ({u.code})
                                      </option>
                                    ))}
                                  </select>
                                  {isUpdatingThisRow && (
                                    <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                  )}
                                </div>
                              </td>

                              {/* Thao tác */}
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onEditField(field)}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Chỉnh sửa chi tiết thủ tục"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteField(field)}
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Xóa thủ tục khỏi danh mục"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
