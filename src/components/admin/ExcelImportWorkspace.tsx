import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Info,
  Check,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { Field, Unit } from '../../types/database';
import {
  parseProceduresExcel,
  exportCatalogToExcel,
  downloadSampleExcelTemplate,
  type ParsedProcedureRow,
} from '../../utils/excelProcedureHelper';

interface ExcelImportWorkspaceProps {
  fields: Field[];
  units: Unit[];
  onImportProcedures: (
    rows: ParsedProcedureRow[],
    mode: 'upsert' | 'replace'
  ) => Promise<void> | void;
}

export const ExcelImportWorkspace: React.FC<ExcelImportWorkspaceProps> = ({
  fields,
  units,
  onImportProcedures,
}) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProcedureRow[]>([]);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi đọc file Excel';
      setErrorMessage(msg);
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
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
      const mappedCount = data.rows.filter((r) => r.isMapped).length;
      const unmappedCount = data.rows.length - mappedCount;
      const firstMapped = data.rows.find((r) => r.isMapped);

      return {
        sectorName,
        items: data.rows,
        indices: data.indices,
        totalCount: data.rows.length,
        mappedCount,
        unmappedCount,
        resolvedUnitName: firstMapped?.matched_unit_name,
        resolvedUnitCode: firstMapped?.matched_unit_code,
      };
    });
  }, [parsedRows]);

  // Import stats & unmapped detection
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const existing = parsedRows.filter((r) => r.isExisting).length;
    const newItems = total - existing;
    const mappedCount = parsedRows.filter((r) => r.isMapped).length;
    const unmappedRows = parsedRows.filter((r) => !r.isMapped);
    const unmappedCount = unmappedRows.length;
    const hasUnmapped = unmappedCount > 0;

    return {
      total,
      existing,
      newItems,
      mappedCount,
      unmappedRows,
      unmappedCount,
      hasUnmapped,
    };
  }, [parsedRows]);

  const toggleSectorPreview = (sec: string) => {
    setCollapsedPreviewSectors((prev) => ({
      ...prev,
      [sec]: !prev[sec],
    }));
  };

  // Commit import (only allowed when all rows have mapped units)
  const handleCommit = async () => {
    if (parsedRows.length === 0) return;
    if (stats.hasUnmapped) {
      setErrorMessage(
        `Không thể Import: Còn ${stats.unmappedCount} thủ tục chưa xác định được Đơn vị từ Master Supabase. Vui lòng phân công Đơn vị trong Master trước.`
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onImportProcedures(parsedRows, importMode);
      // Reset after success
      setExcelFile(null);
      setParsedRows([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi nhập dữ liệu vào Supabase';
      setErrorMessage(msg);
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
              Dữ liệu Excel cung cấp thông tin TTHC (Mã, Tên, Lĩnh vực, Thuộc tính). Đơn vị thực hiện được Resolve tuyệt đối từ CSDL Master Supabase.
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
              title="Xuất toàn bộ danh mục TTHC hiện tại ra file Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất danh mục hiện tại</span>
            </button>
          </div>
        </div>

        {/* Master Resolution Principle Guide */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
          <div className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600" />
            Nguyên tắc xác định Đơn vị (Sole Source of Truth: Supabase Master):
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Hệ thống tra cứu Đơn vị giải quyết dựa trên danh mục Master trên Supabase theo thứ tự: (1) Mã TTHC đã tồn tại và đã gán đơn vị; (2) Lĩnh vực tương ứng đã được phân công Đơn vị trong Master. Nếu chưa có mapping trong Supabase, hệ thống sẽ yêu cầu thiết lập trước và <strong>khóa nút Import</strong> để bảo toàn tính toàn vẹn dữ liệu.
          </p>
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
              Tự động đối soát và map với danh mục Master Supabase
            </span>
          </div>
        </div>
      )}

      {/* ERROR MESSAGE IF ANY */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold">Thông báo:</strong>
            <p>{errorMessage}</p>
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
                  {excelFile ? excelFile.name : 'Dữ liệu thủ tục đã phân tích'}
                </h4>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-600 font-semibold">
                  Tổng số: <strong className="text-blue-600 font-mono font-bold">{stats.total}</strong> thủ tục
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700 font-medium">
                  Đã mapping: <strong className="font-mono text-emerald-700 font-bold">{stats.mappedCount}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className={stats.unmappedCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500 font-medium'}>
                  Chưa mapping: <strong className="font-mono">{stats.unmappedCount}</strong>
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
                  title="Ghi đè toàn bộ danh mục"
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
                  setErrorMessage(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>

              {/* Execute Import (Disabled if unmapped rows exist) */}
              <button
                type="button"
                disabled={isProcessing || stats.hasUnmapped || parsedRows.length === 0}
                onClick={handleCommit}
                className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                  stats.hasUnmapped
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                }`}
                title={
                  stats.hasUnmapped
                    ? `Không thể Import: Còn ${stats.unmappedCount} thủ tục chưa có Đơn vị từ Master Supabase`
                    : `Xác nhận Lưu ${stats.total} thủ tục vào CSDL Supabase`
                }
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

          {/* UNMAPPED WARNING ALERT */}
          {stats.hasUnmapped && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-950 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div>
                  <h4 className="font-bold text-sm text-rose-900">
                    Phát hiện {stats.unmappedCount} thủ tục chưa xác định được Đơn vị từ Master Supabase (Khóa chức năng Import)
                  </h4>
                  <p className="text-rose-800 text-[11px] mt-0.5">
                    Hệ thống không cho phép ghi nhận một phần dữ liệu hoặc tự động suy đoán đơn vị. Vui lòng cập nhật phân công Đơn vị cho các Lĩnh vực sau trong Master Supabase trước khi Import:
                  </p>
                </div>

                {/* List of distinct unmapped sectors / codes */}
                <div className="bg-white/80 border border-rose-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                  {Array.from(new Set(stats.unmappedRows.map((r) => r.linh_vuc || 'Chưa phân loại'))).map((sec) => {
                    const count = stats.unmappedRows.filter((r) => (r.linh_vuc || 'Chưa phân loại') === sec).length;
                    return (
                      <div key={sec} className="flex items-center justify-between text-[11px] py-0.5 border-b border-rose-100 last:border-b-0">
                        <span className="font-bold text-rose-900">• Lĩnh vực: {sec}</span>
                        <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-mono font-semibold">
                          {count} thủ tục chưa gán Đơn vị
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* GROUPED PREVIEW TABLE (READ-ONLY DISPLAY OF RESOLVED MASTER UNIT) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Bảng phân tích xem trước (Đơn vị được tra cứu từ Master Supabase):
              </span>
              <span className="text-slate-500 text-[11px]">
                {stats.mappedCount}/{stats.total} thủ tục đã sẵn sàng import
              </span>
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
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
                    <th className="p-2.5 w-56 bg-slate-100 border-l border-slate-200">
                      Đơn vị (Master Supabase)
                    </th>
                    <th className="p-2.5 w-28 text-center border-l border-slate-200">
                      Trạng thái
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

                          {/* SECTOR RESOLVED UNIT DISPLAY */}
                          <td className="p-2 bg-slate-100 border-l border-slate-200 text-slate-800 font-medium">
                            {group.resolvedUnitName ? (
                              <span className="font-semibold text-slate-900">
                                {group.resolvedUnitName}
                                {group.resolvedUnitCode && (
                                  <span className="text-slate-500 font-normal"> ({group.resolvedUnitCode})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold">Chưa xác định đơn vị</span>
                            )}
                          </td>

                          {/* SECTOR MAPPING STATUS */}
                          <td className="p-2 border-l border-slate-200 text-center">
                            {group.unmappedCount === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                <Check className="w-3 h-3" />
                                Đã mapping
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                                <XCircle className="w-3 h-3" />
                                Chưa mapping
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* ROWS UNDER THIS SECTOR */}
                        {!isCollapsed &&
                          group.items.map((row, rowIdx) => {
                            const originalIdx = group.indices[rowIdx];

                            return (
                              <tr key={`p_row_${originalIdx}`} className="hover:bg-slate-50/80 bg-white transition-colors">
                                <td className="p-2.5 text-center font-mono text-slate-400">
                                  {groupIdx + 1}.{rowIdx + 1}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-blue-700 text-[11px]">
                                  {row.code}
                                  {row.isExisting && (
                                    <span className="block text-[9px] text-amber-600 font-sans font-semibold">
                                      Đã có trên CSDL
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
                                <td className="p-2.5 bg-slate-50/50 border-l border-slate-200">
                                  {row.matched_unit_name ? (
                                    <div className="font-semibold text-slate-900">
                                      {row.matched_unit_name}
                                      {row.matched_unit_code && (
                                        <span className="text-[10px] text-slate-500 font-normal"> ({row.matched_unit_code})</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-rose-600 font-medium text-[11px]">Chưa xác định đơn vị</span>
                                  )}
                                </td>
                                <td className="p-2.5 border-l border-slate-200 text-center">
                                  {row.isMapped ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                      <Check className="w-3 h-3 text-emerald-700" />
                                      Đã mapping
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                                      <XCircle className="w-3 h-3 text-rose-700" />
                                      Chưa mapping
                                    </span>
                                  )}
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
