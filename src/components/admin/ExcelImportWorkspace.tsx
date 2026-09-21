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
  AlertTriangle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { Field, Unit } from '../../types/database';
import {
  parseProceduresExcel,
  exportCatalogToExcel,
  downloadSampleExcelTemplate,
  type ParsedProcedureRow,
  type ExcelProcedureParseResult,
} from '../../utils/excelProcedureHelper';

export interface ImportSummaryResult {
  total: number;
  newCount: number;
  updatedCount: number;
  unassignedCount: number;
  skippedCount: number;
  errorCount: number;
}

interface ExcelImportWorkspaceProps {
  fields: Field[];
  units: Unit[];
  onImportProcedures: (
    rows: ParsedProcedureRow[],
    mode: 'upsert' | 'replace'
  ) => Promise<ImportSummaryResult>;
  onNavigateToGrouped?: () => void;
}

export const ExcelImportWorkspace: React.FC<ExcelImportWorkspaceProps> = ({
  fields,
  units,
  onImportProcedures,
  onNavigateToGrouped,
}) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ExcelProcedureParseResult | null>(null);
  const [importMode, setImportMode] = useState<'upsert' | 'replace'>('upsert');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [collapsedPreviewSectors, setCollapsedPreviewSectors] = useState<Record<string, boolean>>({});
  const [importSuccessResult, setImportSuccessResult] = useState<ImportSummaryResult | null>(null);

  // Parse uploaded file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setImportSuccessResult(null);
    setExcelFile(file);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseProceduresExcel(buffer, fields, units);
      setParseResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi đọc file Excel';
      setErrorMessage(msg);
      setParseResult(null);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const parsedRows = parseResult?.rows || [];
  const conflicts = parseResult?.conflicts || [];
  const hasConflicts = conflicts.length > 0;

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

  const toggleSectorPreview = (sec: string) => {
    setCollapsedPreviewSectors((prev) => ({
      ...prev,
      [sec]: !prev[sec],
    }));
  };

  // Commit import (Allowed in 2-stage workflow even if some rows are unassigned)
  const handleCommit = async () => {
    if (parsedRows.length === 0) return;
    if (hasConflicts) {
      setErrorMessage(
        `Không thể Import: Phát hiện ${conflicts.length} mã TTHC có thông tin mâu thuẫn trong file. Vui lòng chuẩn hóa file Excel trước khi tiếp tục.`
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await onImportProcedures(parsedRows, importMode);
      setImportSuccessResult(res);
      // Reset raw state after successful import
      setExcelFile(null);
      setParseResult(null);
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
              Đồng bộ & Nhập danh mục Thủ tục hành chính từ tệp Excel (Quy trình 2 giai đoạn)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Giai đoạn 1: Nhập toàn bộ danh mục TTHC từ Excel. Giai đoạn 2: Phân công Đơn vị giải quyết trực tiếp trên giao diện quản trị theo từng Lĩnh vực hoặc từng TTHC.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Download Template Button */}
            <button
              type="button"
              onClick={() => downloadSampleExcelTemplate()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Tải tệp Excel mẫu chuẩn với 11 cột để nhập dữ liệu"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải file mẫu Excel (.xlsx)</span>
            </button>

            {/* Export Current Catalog */}
            <button
              type="button"
              onClick={() => exportCatalogToExcel(fields, units)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              title="Xuất toàn bộ danh mục TTHC hiện tại ra file Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất danh mục hiện tại</span>
            </button>
          </div>
        </div>

        {/* 2-Stage Architecture Principle Guide */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
          <div className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600" />
            Quy trình quản lý danh mục TTHC 2 giai đoạn:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600 leading-relaxed">
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                Giai đoạn 1: Import Danh mục TTHC
              </span>
              <p>
                Nhập danh mục từ Excel để ghi nhận Mã TTHC, Tên, Lĩnh vực và các thuộc tính công bố. Thủ tục mới có thể ở trạng thái <em>&quot;Chưa phân công Đơn vị&quot;</em> (unit_id = NULL).
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">2</span>
                Giai đoạn 2: Phân công Đơn vị trên Web UI
              </span>
              <p>
                Quản trị viên phân công Đơn vị cho từng Lĩnh vực hoặc từng TTHC trên màn hình Quản lý Danh mục. Khi nhập báo cáo số liệu, hệ thống bắt buộc TTHC phải có Đơn vị.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SUCCESS RESULT SUMMARY MODAL / BANNER */}
      {importSuccessResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-bold text-emerald-950">
                Nhập danh mục TTHC thành công vào CSDL Supabase!
              </h4>
              <p className="text-xs text-emerald-800">
                Toàn bộ dữ liệu đã được lưu trữ trực tiếp trên Supabase và đồng bộ chính xác.
              </p>
            </div>
            {onNavigateToGrouped && importSuccessResult.unassignedCount > 0 && (
              <button
                type="button"
                onClick={onNavigateToGrouped}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <span>Đến bảng phân công Đơn vị</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-slate-500 font-medium block">Tổng số import</span>
              <span className="text-base font-bold font-mono text-slate-900">{importSuccessResult.total}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-emerald-600 font-medium block">Thủ tục mới</span>
              <span className="text-base font-bold font-mono text-emerald-700">+{importSuccessResult.newCount}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-blue-600 font-medium block">Cập nhật thông tin</span>
              <span className="text-base font-bold font-mono text-blue-700">{importSuccessResult.updatedCount}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-amber-700 font-medium block">Chưa phân công UNIT</span>
              <span className="text-base font-bold font-mono text-amber-700">{importSuccessResult.unassignedCount}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-slate-500 font-medium block">Bỏ qua (test/trùng)</span>
              <span className="text-base font-bold font-mono text-slate-600">{importSuccessResult.skippedCount}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-slate-500 font-medium block">Số lỗi</span>
              <span className="text-base font-bold font-mono text-slate-900">{importSuccessResult.errorCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* DRAG & DROP UPLOAD BOX */}
      {!parseResult && (
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
              Kiểm tra trùng lặp, loại trừ mã test và sẵn sàng phân công Đơn vị
            </span>
          </div>
        </div>
      )}

      {/* ERROR MESSAGE IF ANY */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold">Thông báo lỗi:</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* PARSED DATA PREVIEW & GROUPED TABLE */}
      {parseResult && parsedRows.length > 0 && (
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
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="text-slate-600 font-semibold">
                  Tổng số: <strong className="text-blue-600 font-mono font-bold">{parseResult.totalRowsCount}</strong> thủ tục
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700 font-medium">
                  Mới: <strong className="font-mono font-bold">{parseResult.newCount}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-blue-700 font-medium">
                  Cập nhật: <strong className="font-mono font-bold">{parseResult.updatedCount}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700 font-medium">
                  Đã có Đơn vị (Master): <strong className="font-mono font-bold">{parseResult.assignedUnitCount}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className={parseResult.unassignedUnitCount > 0 ? 'text-amber-700 font-medium' : 'text-slate-500 font-medium'}>
                  Chưa phân công: <strong className="font-mono font-bold">{parseResult.unassignedUnitCount}</strong>
                </span>
                {parseResult.skippedTestCount > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500 text-[11px]">
                      Bỏ qua {parseResult.skippedTestCount} mã test
                    </span>
                  </>
                )}
                {parseResult.duplicateRowsCount > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500 text-[11px]">
                      Gộp {parseResult.duplicateRowsCount} dòng trùng lặp
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Import Mode Options & Confirm Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setImportMode('upsert')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
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
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    importMode === 'replace'
                      ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                  title="Ghi đè danh mục"
                >
                  Ghi đè danh mục
                </button>
              </div>

              {/* Reset File */}
              <button
                type="button"
                onClick={() => {
                  setExcelFile(null);
                  setParseResult(null);
                  setErrorMessage(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>

              {/* Execute Import (Allowed in 2-stage workflow, only blocked on contradictory conflicts) */}
              <button
                type="button"
                disabled={isProcessing || hasConflicts || parsedRows.length === 0}
                onClick={handleCommit}
                className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                  hasConflicts
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                }`}
                title={
                  hasConflicts
                    ? 'Không thể Import do có mã TTHC mâu thuẫn nội dung trong file'
                    : `Xác nhận Lưu ${parseResult.totalRowsCount} thủ tục vào CSDL Supabase`
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
                    <span>Xác nhận Lưu {parseResult.totalRowsCount} thủ tục</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* DUPLICATE CONFLICT WARNING ALERT (BLOCKING) */}
          {hasConflicts && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-950 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div>
                  <h4 className="font-bold text-sm text-rose-900">
                    Phát hiện {conflicts.length} mã TTHC có thông tin mâu thuẫn trong file Excel (Chặn Import)
                  </h4>
                  <p className="text-rose-800 text-[11px] mt-0.5">
                    Cùng một mã TTHC không được có tên thủ tục hoặc lĩnh vực khác nhau trong cùng một tệp. Vui lòng sửa lại tệp Excel:
                  </p>
                </div>

                <div className="bg-white/90 border border-rose-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {conflicts.map((c) => (
                    <div key={c.code} className="text-[11px] border-b border-rose-100 last:border-b-0 pb-2">
                      <div className="font-bold text-rose-900">Mã TTHC: {c.code}</div>
                      <div className="pl-2 space-y-0.5 text-slate-700 mt-1">
                        {c.instances.map((inst, idx) => (
                          <div key={idx} className="text-[10px]">
                            • Dòng Excel {inst.rowNum}: &quot;{inst.name}&quot; (Lĩnh vực: {inst.linh_vuc})
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* UNASSIGNED NOTICE (NON-BLOCKING, EXPLAINS 2-STAGE FLOW) */}
          {parseResult.unassignedUnitCount > 0 && !hasConflicts && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] space-y-0.5">
                <span className="font-bold text-amber-950">
                  Thông tin quy trình: Có {parseResult.unassignedUnitCount} thủ tục mới chưa có Đơn vị trong Master Supabase.
                </span>
                <p className="text-amber-800">
                  Các thủ tục này sẽ được nhập vào CSDL với trạng thái <em>&quot;Chưa phân công&quot;</em>. Bạn có thể bấm <strong>&quot;Xác nhận Lưu&quot;</strong> để nhập ngay, sau đó phân công Đơn vị trên màn hình Quản lý danh mục.
                </p>
              </div>
            </div>
          )}

          {/* GROUPED PREVIEW TABLE (READ-ONLY DISPLAY OF RESOLVED MASTER UNIT) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Xem trước danh mục phân theo Lĩnh vực:
              </span>
              <span className="text-slate-500 text-[11px]">
                {parseResult.assignedUnitCount}/{parseResult.totalRowsCount} thủ tục đã có Đơn vị từ Master
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
                    <th className="p-2.5 w-32 text-center border-l border-slate-200">
                      Phân công Đơn vị
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
                                className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
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
                              <span className="text-amber-700 font-medium text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Chưa phân công
                              </span>
                            )}
                          </td>

                          {/* SECTOR MAPPING STATUS */}
                          <td className="p-2 border-l border-slate-200 text-center">
                            {group.unmappedCount === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                <Check className="w-3 h-3" />
                                Đã có Đơn vị
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                Sẽ phân công sau
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
                                    <span className="text-amber-700 font-medium text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      Chưa phân công
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 border-l border-slate-200 text-center">
                                  {row.isMapped ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                      <Check className="w-3 h-3 text-emerald-700" />
                                      Đã có Đơn vị
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                      Chưa phân công
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
