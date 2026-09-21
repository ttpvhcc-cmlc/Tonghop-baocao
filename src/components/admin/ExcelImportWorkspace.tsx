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
  AlertTriangle,
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
  const unrecognizedUnits = parseResult?.unrecognizedUnits || [];
  const hasConflicts = conflicts.length > 0;
  const hasUnrecognizedUnits = unrecognizedUnits.length > 0;
  const isImportBlocked = hasConflicts || hasUnrecognizedUnits;

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
      const assignedCount = data.rows.filter((r) => r.matched_unit_id).length;
      const unassignedCount = data.rows.length - assignedCount;

      return {
        sectorName,
        items: data.rows,
        indices: data.indices,
        totalCount: data.rows.length,
        assignedCount,
        unassignedCount,
      };
    });
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

    if (hasUnrecognizedUnits) {
      setErrorMessage(
        `Không thể Import: Có ${unrecognizedUnits.length} dòng chứa tên đơn vị không tồn tại trong Danh mục Đơn vị giải quyết của hệ thống. Vui lòng kiểm tra lại.`
      );
      return;
    }

    if (hasConflicts) {
      setErrorMessage(
        `Không thể Import: Phát hiện ${conflicts.length} mã TTHC có thông tin mâu thuẫn trong file Excel. Vui lòng chuẩn hóa file trước khi tiếp tục.`
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
              Đồng bộ & Nhập danh mục Thủ tục hành chính từ tệp Excel
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống đối chiếu cột &quot;Đơn vị thực hiện&quot; trong Excel với Danh mục Đơn vị giải quyết. Thủ tục chưa có đơn vị sẽ được gắn nhãn &quot;Chưa phân công&quot; để phân công sau.
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

        {/* Logic Guide */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
          <div className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600" />
            Nguyên tắc xác định Đơn vị giải quyết:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600 leading-relaxed">
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800">1. Excel có cột Đơn vị thực hiện:</span>
              <p>
                Đối chiếu chính xác theo <strong>Mã đơn vị</strong> hoặc <strong>Tên đơn vị</strong> trong Danh mục Đơn vị giải quyết. Nếu khớp sẽ gán đơn vị tương ứng; nếu có tên nhưng không khớp thì hệ thống sẽ báo lỗi và chặn Import.
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800">2. Excel không có / để trống:</span>
              <p>
                Thủ tục được lưu với <code>unit_id = NULL</code> và hiển thị <strong>&quot;Chưa phân công&quot;</strong>. Quản trị viên có thể phân công trực tiếp sau trên giao diện Quản lý Danh mục.
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
              Đối chiếu Đơn vị giải quyết, kiểm tra trùng lặp và loại trừ mã test
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
                  Đã có Đơn vị: <strong className="font-mono font-bold">{parseResult.assignedUnitCount}</strong>
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

              {/* Execute Import */}
              <button
                type="button"
                disabled={isProcessing || isImportBlocked || parsedRows.length === 0}
                onClick={handleCommit}
                className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                  isImportBlocked
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                }`}
                title={
                  isImportBlocked
                    ? 'Không thể Import do có lỗi dữ liệu trong file'
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

          {/* UNRECOGNIZED UNITS ERROR ALERT (BLOCKING) */}
          {hasUnrecognizedUnits && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-950 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div>
                  <h4 className="font-bold text-sm text-rose-900">
                    Phát hiện {unrecognizedUnits.length} dòng chứa tên Đơn vị không tồn tại trong hệ thống (Chặn Import)
                  </h4>
                  <p className="text-rose-800 text-[11px] mt-0.5">
                    Hệ thống không tự tạo hay suy đoán đơn vị. Vui lòng thêm đơn vị vào Danh mục Đơn vị giải quyết trước hoặc chỉnh sửa lại file Excel:
                  </p>
                </div>

                <div className="bg-white/90 border border-rose-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                  {unrecognizedUnits.map((u, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-rose-100 last:border-b-0">
                      <div>
                        <span className="font-bold text-rose-900">• Đơn vị: &quot;{u.rawUnit}&quot;</span>
                        <span className="text-slate-600 text-[10px] ml-2">(Mã TTHC: {u.code})</span>
                      </div>
                      <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-mono font-semibold text-[10px]">
                        Dòng Excel {u.rowNum}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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

          {/* UNASSIGNED NOTICE (NON-BLOCKING) */}
          {parseResult.unassignedUnitCount > 0 && !isImportBlocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] space-y-0.5">
                <span className="font-bold text-amber-950">
                  Thông tin: Có {parseResult.unassignedUnitCount} thủ tục chưa có Đơn vị giải quyết trong file.
                </span>
                <p className="text-amber-800">
                  Các thủ tục này sẽ được lưu với trạng thái <em>&quot;Chưa phân công&quot;</em>. Bạn có thể nhấn <strong>&quot;Xác nhận Lưu&quot;</strong> để nhập danh mục ngay, sau đó phân công Đơn vị trên màn hình Quản lý Danh mục.
                </p>
              </div>
            </div>
          )}

          {/* PREVIEW TABLE WITH ONLY ONE UNIT COLUMN: "Đơn vị giải quyết" */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Bảng xem trước danh mục:
              </span>
              <span className="text-slate-500 text-[11px]">
                {parseResult.assignedUnitCount}/{parseResult.totalRowsCount} thủ tục đã có Đơn vị giải quyết
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
                    <th className="p-2.5 w-60 bg-blue-50/50 border-l border-blue-100 font-bold text-blue-900">
                      Đơn vị giải quyết
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {previewGroupedData.map((group, groupIdx) => {
                    const isCollapsed = !!collapsedPreviewSectors[group.sectorName];

                    return (
                      <React.Fragment key={`prev_sec_${group.sectorName}`}>
                        {/* SECTOR GROUP HEADER - ONLY SECTOR NAME, NO "LĨNH VỰC:" PREFIX */}
                        <tr className="bg-slate-100 hover:bg-slate-200/80 transition-colors border-t-2 border-slate-300 font-semibold sticky z-10">
                          <td colSpan={10} className="p-2.5">
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
                                <span className="font-bold text-slate-900 text-sm">
                                  {group.sectorName}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-300">
                                  {group.totalCount} thủ tục
                                </span>
                              </div>
                            </div>
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
                                
                                {/* ONLY SINGLE UNIT COLUMN: Đơn vị giải quyết */}
                                <td className="p-2.5 bg-blue-50/30 border-l border-blue-100 font-medium">
                                  {row.matched_unit_name ? (
                                    <span className="text-slate-900 font-semibold text-xs">
                                      {row.matched_unit_name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-[11px] italic">
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
