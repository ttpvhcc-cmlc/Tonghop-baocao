import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  Building2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Info,
} from 'lucide-react';
import type { Field, Unit } from '../../types/database';
import {
  parseProceduresExcel,
  exportCatalogToExcel,
  downloadSampleExcelTemplate,
  type ParsedProcedureRow,
  matchUnitByNameOrCode,
} from '../../utils/excelProcedureHelper';

interface ExcelImportWorkspaceProps {
  fields: Field[];
  units: Unit[];
  onImportProcedures: (
    rows: ParsedProcedureRow[],
    mode: 'upsert' | 'replace',
    newUnitsToCreate: string[]
  ) => Promise<void> | void;
}

export const ExcelImportWorkspace: React.FC<ExcelImportWorkspaceProps> = ({
  fields,
  units,
  onImportProcedures,
}) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProcedureRow[]>([]);
  const [detectedNewUnits, setDetectedNewUnits] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'upsert' | 'replace'>('upsert');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [collapsedPreviewSectors, setCollapsedPreviewSectors] = useState<Record<string, boolean>>({});

  // Parse an uploaded file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setExcelFile(file);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseProceduresExcel(buffer, fields, units);
      setParsedRows(result.rows);
      setDetectedNewUnits(result.detectedNewUnits);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi đọc file Excel';
      setErrorMessage(msg);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // Update unit for a specific parsed row
  const handleUpdateRowUnit = (index: number, unitId: string) => {
    setParsedRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], matched_unit_id: unitId };
      return next;
    });
  };

  // Update unit for an entire sector in the preview
  const handleUpdateSectorUnitInPreview = (sectorName: string, unitId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.linh_vuc.trim().toLowerCase() === sectorName.trim().toLowerCase()) {
          return { ...r, matched_unit_id: unitId };
        }
        return r;
      })
    );
  };

  // Group preview rows by sector
  const previewGroupedData = useMemo(() => {
    const map = new Map<string, { rows: ParsedProcedureRow[]; indices: number[] }>();

    parsedRows.forEach((r, idx) => {
      const sec = (r.linh_vuc || 'Chưa phân loại').trim();
      if (!map.has(sec)) {
        map.set(sec, { rows: [], indices: [] });
      }
      map.get(sec)!.rows.push(r);
      map.get(sec)!.indices.push(idx);
    });

    return Array.from(map.entries()).map(([sectorName, data]) => {
      const unitCounts: Record<string, number> = {};
      data.rows.forEach((r) => {
        if (r.matched_unit_id) {
          unitCounts[r.matched_unit_id] = (unitCounts[r.matched_unit_id] || 0) + 1;
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

      return {
        sectorName,
        items: data.rows,
        indices: data.indices,
        totalCount: data.rows.length,
        dominantUnitId: maxCount === data.rows.length ? dominantUnitId : '',
        assignedCount: data.rows.filter((r) => r.matched_unit_id).length,
      };
    });
  }, [parsedRows]);

  // Import stats
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const existing = parsedRows.filter((r) => r.isExisting).length;
    const newItems = total - existing;
    const withUnit = parsedRows.filter((r) => r.matched_unit_id).length;
    return { total, existing, newItems, withUnit };
  }, [parsedRows]);

  const toggleSectorPreview = (sec: string) => {
    setCollapsedPreviewSectors((prev) => ({
      ...prev,
      [sec]: !prev[sec],
    }));
  };

  // Commit import
  const handleCommit = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      await onImportProcedures(parsedRows, importMode, detectedNewUnits);
      // Reset after success
      setExcelFile(null);
      setParsedRows([]);
      setDetectedNewUnits([]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP INSTRUCTIONS & DOWNLOAD / EXPORT BUTTONS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Đồng bộ & Nhập danh mục Thủ tục hành chính từ tệp Excel
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Hỗ trợ đầy đủ 11 cột chuẩn: Mã TTHC, Tên Thủ tục, Lĩnh vực, Cơ quan công bố, Loại TTHC, Cơ quan thực hiện, Cấp thực hiện, Mức độ DVC, Phí - lệ phí và Đơn vị thực hiện.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Download Template Button */}
            <button
              type="button"
              onClick={() => downloadSampleExcelTemplate()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Tải tệp Excel mẫu chuẩn với 11 cột để nhập dữ liệu"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải file mẫu Excel (.xlsx)</span>
            </button>

            {/* Export Current Catalog */}
            <button
              type="button"
              onClick={() => exportCatalogToExcel(fields, units)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
              title="Xuất toàn bộ danh mục TTHC hiện tại ra file Excel đầy đủ 11 cột"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất danh mục hiện tại</span>
            </button>
          </div>
        </div>

        {/* Column Mapping Guide */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
          <div className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600" />
            Cấu trúc 11 cột được nhận diện tự động từ tệp Excel:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 font-mono block">Cột 1</span>
              <strong className="text-slate-700">STT</strong>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 font-mono block">Cột 2</span>
              <strong className="text-blue-700 font-mono">Mã TTHC</strong>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 font-mono block">Cột 3</span>
              <strong className="text-slate-700">Tên Thủ tục</strong>
            </div>
            <div className="bg-white p-2 rounded border border-blue-200 bg-blue-50/30">
              <span className="text-blue-500 font-mono block">Cột 4</span>
              <strong className="text-blue-900">Lĩnh vực (Dùng nhóm)</strong>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 font-mono block">Cột 5 & 6</span>
              <span className="text-slate-700">CQ công bố / Loại TTHC</span>
            </div>
            <div className="bg-white p-2 rounded border border-amber-200 bg-amber-50/40">
              <span className="text-amber-600 font-mono block">Cột 11 (Cột cuối)</span>
              <strong className="text-amber-900">Đơn vị thực hiện</strong>
            </div>
          </div>
        </div>
      </div>

      {/* DRAG & DROP UPLOAD BOX */}
      {parsedRows.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-10 text-center bg-white hover:bg-blue-50/30 transition-all relative group cursor-pointer shadow-xs">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="space-y-3 pointer-events-none">
            <div className="mx-auto w-14 h-14 bg-emerald-100/70 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7 text-emerald-600 group-hover:text-blue-600 transition-colors" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Nhấp để chọn tệp Excel hoặc kéo thả tệp vào đây
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Hỗ trợ định dạng .xlsx, .xls chuẩn từ Cổng Dịch vụ công hoặc Danh mục địa phương
              </p>
            </div>
            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-medium">
              Tự động phân nhóm theo Lĩnh vực & gán Đơn vị thực hiện
            </span>
          </div>
        </div>
      )}

      {/* ERROR MESSAGE IF ANY */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <strong>Lỗi khi xử lý file:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* PARSED DATA PREVIEW & GROUPED TABLE */}
      {parsedRows.length > 0 && (
        <div className="space-y-4 animate-in fade-in">
          {/* STATS & CONFIG BAR */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  {excelFile ? excelFile.name : 'Dữ liệu thủ tục chuẩn đã phân tích'}
                </h4>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-600 font-semibold">
                  Tổng số: <strong className="text-blue-600 font-mono font-bold">{stats.total}</strong> thủ tục
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700 font-medium">
                  Mới: <strong className="font-mono">{stats.newItems}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-amber-700 font-medium">
                  Cập nhật: <strong className="font-mono">{stats.existing}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-blue-700 font-medium">
                  Đã nhận diện đơn vị: <strong className="font-mono">{stats.withUnit}/{stats.total}</strong>
                </span>
              </div>
            </div>

            {/* Import Mode Options & Confirm Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setImportMode('upsert')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                    importMode === 'upsert'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                  title="Cập nhật thông tin các thủ tục theo Mã TTHC, thêm mới thủ tục chưa có"
                >
                  Cập nhật & Thêm mới
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                    importMode === 'replace'
                      ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                  title="Xóa danh mục cũ và ghi đè bằng toàn bộ danh sách trong file"
                >
                  Ghi đè toàn bộ
                </button>
              </div>

              {/* Reset File */}
              <button
                type="button"
                onClick={() => {
                  setExcelFile(null);
                  setParsedRows([]);
                  setDetectedNewUnits([]);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>

              {/* Execute Import */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCommit}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-all"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu danh mục...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận Lưu {stats.total} thủ tục</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* DETECTED NEW UNITS BANNER */}
          {detectedNewUnits.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
              <Building2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="font-bold">
                  Phát hiện {detectedNewUnits.length} Đơn vị mới trong cột "Đơn vị thực hiện":
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {detectedNewUnits.map((nu) => (
                    <span
                      key={nu}
                      className="inline-block px-2 py-0.5 bg-amber-100 font-semibold rounded border border-amber-300 text-[11px]"
                    >
                      {nu}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-amber-700 mt-1">
                  Hệ thống sẽ tự động đăng ký các đơn vị này vào danh sách Đơn vị giải quyết khi bạn xác nhận lưu!
                </p>
              </div>
            </div>
          )}

          {/* GROUPED PREVIEW TABLE */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Xem trước Bảng phân nhóm Lĩnh vực & Thủ tục (Điều chỉnh Đơn vị phụ trách trước khi lưu):
              </span>
              <span className="text-slate-500">
                Có thể chọn phân công cho cả Lĩnh vực hoặc chỉnh sửa từng dòng riêng lẻ
              </span>
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-20">
                  <tr>
                    <th className="p-2.5 w-12 text-center">STT</th>
                    <th className="p-2.5 w-28">Mã TTHC</th>
                    <th className="p-2.5 min-w-[280px]">Tên Thủ tục</th>
                    <th className="p-2.5 w-36">Cơ quan công bố</th>
                    <th className="p-2.5 w-28">Loại TTHC</th>
                    <th className="p-2.5 w-40">Cơ quan thực hiện</th>
                    <th className="p-2.5 w-28">Cấp thực hiện</th>
                    <th className="p-2.5 w-32">Mức độ cung cấp</th>
                    <th className="p-2.5 w-28">Phí - Lệ phí</th>
                    <th className="p-2.5 w-64 bg-blue-50/70 border-l border-blue-200">
                      Đơn vị thực hiện (Điều chỉnh)
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {previewGroupedData.map((group, groupIdx) => {
                    const isCollapsed = !!collapsedPreviewSectors[group.sectorName];

                    return (
                      <React.Fragment key={`prev_sec_${group.sectorName}`}>
                        {/* SECTOR GROUP HEADER */}
                        <tr className="bg-slate-100 hover:bg-slate-200/80 transition-colors border-t-2 border-slate-300 font-semibold sticky z-10">
                          <td colSpan={9} className="p-2.5">
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => toggleSectorPreview(group.sectorName)}
                                className="p-1 text-slate-500 hover:text-slate-800 rounded"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>

                              <span className="p-1.5 bg-blue-100 text-blue-700 rounded">
                                <FolderOpen className="w-3.5 h-3.5" />
                              </span>

                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  LĨNH VỰC: {group.sectorName}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-300">
                                  {group.totalCount} thủ tục
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* SECTOR WIDE UNIT SELECTOR IN PREVIEW */}
                          <td className="p-2 bg-blue-50/80 border-l border-blue-200">
                            <select
                              value={group.dominantUnitId || ''}
                              onChange={(e) =>
                                handleUpdateSectorUnitInPreview(group.sectorName, e.target.value)
                              }
                              className="w-full text-xs bg-white border border-blue-300 rounded px-2 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                              title="Áp dụng cho tất cả thủ tục trong lĩnh vực này"
                            >
                              <option value="">-- Phân công toàn bộ lĩnh vực --</option>
                              {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.code})
                                </option>
                              ))}
                              {detectedNewUnits.map((nu) => (
                                <option key={`nu_${nu}`} value={nu}>
                                  {nu} (Đơn vị mới)
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>

                        {/* ROWS UNDER THIS SECTOR */}
                        {!isCollapsed &&
                          group.items.map((row, rowIdx) => {
                            const originalIdx = group.indices[rowIdx];
                            const unit = units.find((u) => u.id === row.matched_unit_id);

                            return (
                              <tr key={`p_row_${originalIdx}`} className="hover:bg-blue-50/30 bg-white">
                                <td className="p-2.5 text-center font-mono text-slate-400">
                                  {groupIdx + 1}.{rowIdx + 1}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-blue-700 text-[11px]">
                                  {row.code}
                                  {row.isExisting && (
                                    <span className="block text-[9px] text-amber-600 font-sans font-semibold">
                                      Đã có - Cập nhật
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 font-medium text-slate-800 leading-relaxed">
                                  {row.name}
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px]">{row.co_quan_cong_bo}</td>
                                <td className="p-2.5 text-slate-500 text-[11px]">{row.loai_tthc}</td>
                                <td className="p-2.5 text-slate-600 text-[11px] font-medium">
                                  {row.co_quan_thuc_hien}
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px]">{row.cap_thuc_hien}</td>
                                <td className="p-2.5 text-[10px]">
                                  {row.muc_do_cung_cap && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                      {row.muc_do_cung_cap}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px]">{row.phi_le_phi}</td>
                                <td className="p-2 bg-blue-50/30 border-l border-blue-100">
                                  <select
                                    value={row.matched_unit_id || ''}
                                    onChange={(e) => handleUpdateRowUnit(originalIdx, e.target.value)}
                                    className={`w-full text-xs rounded px-2 py-1 border font-medium cursor-pointer ${
                                      unit || row.matched_unit_id
                                        ? 'bg-white text-slate-800 border-slate-300'
                                        : 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                                    }`}
                                  >
                                    <option value="">-- Chưa gán đơn vị --</option>
                                    {units.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}
                                      </option>
                                    ))}
                                    {detectedNewUnits.map((nu) => (
                                      <option key={`nu_${nu}`} value={nu}>
                                        {nu} (Đơn vị mới)
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
