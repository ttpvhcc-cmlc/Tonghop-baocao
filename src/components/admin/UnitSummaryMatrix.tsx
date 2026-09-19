import React, { useState, useMemo } from 'react';
import {
  Building2,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import type { Field, Unit } from '../../types/database';

interface UnitSummaryMatrixProps {
  fields: Field[];
  units: Unit[];
  onTransferUnitFields: (fromUnitId: string | null, toUnitId: string) => Promise<void> | void;
  onTransferSectorToUnit: (sectorName: string, toUnitId: string) => Promise<void> | void;
}

export const UnitSummaryMatrix: React.FC<UnitSummaryMatrixProps> = ({
  fields,
  units,
  onTransferUnitFields,
  onTransferSectorToUnit,
}) => {
  const [selectedUnitForTransfer, setSelectedUnitForTransfer] = useState<{
    unitId: string | null;
    unitName: string;
    count: number;
  } | null>(null);
  const [transferTargetUnitId, setTransferTargetUnitId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [expandedUnitCards, setExpandedUnitCards] = useState<Record<string, boolean>>({});

  // Compute unit statistics
  const unitStats = useMemo(() => {
    const totalFieldsCount = fields.length;

    const stats = units.map((u) => {
      const uFields = fields.filter((f) => f.unit_id === u.id);
      const sectorsMap = new Map<string, number>();

      uFields.forEach((f) => {
        const sec = (f.linh_vuc || 'Chưa phân loại').trim();
        sectorsMap.set(sec, (sectorsMap.get(sec) || 0) + 1);
      });

      const fullDvcCount = uFields.filter((f) => f.muc_do_cung_cap === 'Toàn trình').length;
      const partDvcCount = uFields.filter((f) => f.muc_do_cung_cap === 'Một phần').length;
      const noDvcCount = uFields.filter((f) => f.muc_do_cung_cap === 'Chưa cung cấp DVC').length;

      return {
        unit: u,
        fieldsCount: uFields.length,
        percentage: totalFieldsCount > 0 ? ((uFields.length / totalFieldsCount) * 100).toFixed(1) : '0',
        sectors: Array.from(sectorsMap.entries()).map(([name, count]) => ({ name, count })),
        fullDvcCount,
        partDvcCount,
        noDvcCount,
      };
    });

    // Unassigned fields
    const unassignedFields = fields.filter((f) => !f.unit_id);
    const unassignedSectorsMap = new Map<string, number>();
    unassignedFields.forEach((f) => {
      const sec = (f.linh_vuc || 'Chưa phân loại').trim();
      unassignedSectorsMap.set(sec, (unassignedSectorsMap.get(sec) || 0) + 1);
    });

    const unassigned = {
      fieldsCount: unassignedFields.length,
      percentage: totalFieldsCount > 0 ? ((unassignedFields.length / totalFieldsCount) * 100).toFixed(1) : '0',
      sectors: Array.from(unassignedSectorsMap.entries()).map(([name, count]) => ({ name, count })),
    };

    return {
      unitsData: stats,
      unassigned,
      totalFieldsCount,
    };
  }, [fields, units]);

  const toggleExpand = (unitId: string) => {
    setExpandedUnitCards((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const handleExecuteTransfer = async () => {
    if (!selectedUnitForTransfer || !transferTargetUnitId) return;
    setIsTransferring(true);
    try {
      await onTransferUnitFields(selectedUnitForTransfer.unitId, transferTargetUnitId);
      setSelectedUnitForTransfer(null);
      setTransferTargetUnitId('');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* OVERVIEW HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Ma trận phân bổ Thủ tục hành chính theo Đơn vị giải quyết
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Tổng cộng: <strong className="text-slate-800">{unitStats.totalFieldsCount}</strong> thủ tục trên địa bàn xã/phường được phân bổ cho{' '}
            <strong className="text-slate-800">{units.length}</strong> đơn vị chủ trì.
          </p>
        </div>

        {unitStats.unassigned.fieldsCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-900">
                Có {unitStats.unassigned.fieldsCount} thủ tục chưa được phân công đơn vị!
              </span>
              <p className="text-amber-700 text-[11px] mt-0.5">
                Vui lòng phân bổ cho đơn vị phụ trách để đảm bảo theo dõi tiến độ báo cáo.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedUnitForTransfer({
                  unitId: null,
                  unitName: 'Chưa phân công',
                  count: unitStats.unassigned.fieldsCount,
                })
              }
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-colors"
            >
              Gán nhanh
            </button>
          </div>
        )}
      </div>

      {/* UNIT CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {unitStats.unitsData.map((stat) => {
          const isExpanded = expandedUnitCards[stat.unit.id] !== false; // expanded by default

          return (
            <div
              key={stat.unit.id}
              className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col transition-all hover:border-blue-300"
            >
              {/* Unit Card Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 mb-1.5">
                      Mã: {stat.unit.code}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {stat.unit.name}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUnitForTransfer({
                        unitId: stat.unit.id,
                        unitName: stat.unit.name,
                        count: stat.fieldsCount,
                      })
                    }
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                    title="Chuyển giao thủ tục sang đơn vị khác"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress Bar & Volume */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-extrabold text-lg text-slate-900">
                      {stat.fieldsCount} <span className="text-xs font-normal text-slate-500">thủ tục</span>
                    </span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                      {stat.percentage}% toàn xã
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                </div>

                {/* DVC Breakdown Pills */}
                <div className="flex items-center gap-1.5 mt-3 text-[10px] font-medium">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Toàn trình: <strong>{stat.fullDvcCount}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Một phần: <strong>{stat.partDvcCount}</strong>
                  </span>
                  {stat.noDvcCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Chưa DVC: <strong>{stat.noDvcCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Sectors Managed List */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Lĩnh vực phụ trách ({stat.sectors.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExpand(stat.unit.id)}
                      className="text-[11px] text-blue-600 hover:underline font-normal"
                    >
                      {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                    </button>
                  </div>

                  {stat.sectors.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg">
                      Chưa được phân công lĩnh vực nào
                    </div>
                  ) : isExpanded ? (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {stat.sectors.map((sec) => (
                        <div
                          key={sec.name}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-150 text-xs transition-colors group"
                        >
                          <span className="font-medium text-slate-800 truncate max-w-[190px]" title={sec.name}>
                            {sec.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[11px] text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {sec.count}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const targetUnit = units.find((u) => u.id !== stat.unit.id);
                                if (targetUnit) {
                                  const confirmMove = window.confirm(
                                    `Chuyển toàn bộ lĩnh vực "${sec.name}" (${sec.count} thủ tục) sang "${targetUnit.name}"?`
                                  );
                                  if (confirmMove) {
                                    onTransferSectorToUnit(sec.name, targetUnit.id);
                                  }
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                              title="Chuyển lĩnh vực này"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Phụ trách {stat.sectors.map((s) => s.name).slice(0, 2).join(', ')}
                      {stat.sectors.length > 2 && ` và ${stat.sectors.length - 2} lĩnh vực khác...`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TRANSFER MODAL */}
      {selectedUnitForTransfer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-blue-600 mb-4">
              <span className="p-2 bg-blue-100 rounded-xl">
                <ArrowRightLeft className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Chuyển giao thủ tục hành chính hàng loạt
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Áp dụng nhanh đơn vị mới cho tất cả các thủ tục được chọn
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Đơn vị hiện tại:</span>
                  <strong className="text-slate-900">{selectedUnitForTransfer.unitName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số lượng thủ tục sẽ chuyển:</span>
                  <strong className="text-blue-600 font-mono">{selectedUnitForTransfer.count} thủ tục</strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Chọn Đơn vị tiếp nhận mới <span className="text-rose-500">*</span>
                </label>
                <select
                  value={transferTargetUnitId}
                  onChange={(e) => setTransferTargetUnitId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn đơn vị tiếp nhận --</option>
                  {units
                    .filter((u) => u.id !== selectedUnitForTransfer.unitId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                Tất cả {selectedUnitForTransfer.count} thủ tục hành chính sẽ được cập nhật trường "Đơn vị thực hiện" sang đơn vị mới ngay lập tức.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={isTransferring}
                onClick={() => setSelectedUnitForTransfer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={!transferTargetUnitId || isTransferring}
                onClick={handleExecuteTransfer}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5"
              >
                {isTransferring ? (
                  <span>Đang chuyển...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Xác nhận Chuyển giao</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
