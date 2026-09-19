import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../services/store';
import {
  readWorkbook,
  parseSheetToDrafts,
  ParseResult,
  ParsedStatisticDraft,
  generateSampleExcelBuffer
} from '../features/import/excelParser';
import { formatNumber, getStatusBadge } from '../utils/format';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const ImportPage: React.FC = () => {
  const reports = useMemo(() => store.getReports(), []);
  const units = useMemo(() => store.getUnits(), []);
  const fields = useMemo(() => store.getFields(), []);

  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Mapping & Preview, 3: Success
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string>('');

  const selectedReport = useMemo(() => reports.find((r) => r.id === selectedReportId), [reports, selectedReportId]);
  const isLocked = selectedReport?.status === 'locked';

  // Handle File Upload
  const handleFileUpload = (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const { workbook: wb, sheetNames: sheets } = readWorkbook(data);
        setWorkbook(wb);
        setSheetNames(sheets);

        // Auto pick sheet 'TONGHOP' or first sheet
        const defaultSheet = sheets.find((s) => s.toUpperCase().includes('TONGHOP')) || sheets[0];
        setSelectedSheet(defaultSheet);

        const sheetObj = wb.Sheets[defaultSheet];
        const res = parseSheetToDrafts(sheetObj, fields, units, defaultSheet, file.name);
        setParseResult(res);
        setActiveStep(2);
      } catch (err) {
        console.error('File parsing error:', err);
        alert('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file!');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle Sheet Change
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setSelectedSheet(sheetName);
    const sheetObj = workbook.Sheets[sheetName];
    const res = parseSheetToDrafts(sheetObj, fields, units, sheetName, fileName);
    setParseResult(res);
  };

  // Manual Field Mapping adjustment
  const handleFieldMapChange = (rowNumber: number, newFieldId: string) => {
    if (!parseResult) return;
    const targetField = fields.find((f) => f.id === newFieldId);
    const targetUnit = targetField ? units.find((u) => u.id === targetField.unit_id) : undefined;

    const updatedDrafts = parseResult.draftRows.map((row) => {
      if (row.rowNumber === rowNumber) {
        return {
          ...row,
          matchedFieldId: targetField?.id,
          matchedFieldName: targetField?.name,
          unitId: targetUnit?.id,
          unitName: targetUnit?.name,
          isConfirmed: true,
        };
      }
      return row;
    });

    setParseResult({
      ...parseResult,
      draftRows: updatedDrafts,
      unmappedFieldsCount: updatedDrafts.filter((r) => !r.matchedFieldId).length,
    });
  };

  // Confirm Import
  const handleConfirmImport = () => {
    if (!selectedReportId || !parseResult) return;
    if (isLocked) {
      alert('Báo cáo này đã bị khóa (Locked Snapshot). Không thể nhập đè dữ liệu!');
      return;
    }

    try {
      // Group rows by sourceName
      const sourcesMap = new Map<string, ParsedStatisticDraft[]>();
      parseResult.draftRows.forEach((row) => {
        if (!row.matchedFieldId || !row.unitId) return; // Skip unmapped
        const group = sourcesMap.get(row.sourceName) || [];
        group.push(row);
        sourcesMap.set(row.sourceName, group);
      });

      let totalSaved = 0;

      sourcesMap.forEach((rows, sourceName) => {
        // Create or get source in store
        const reportSources = store.getSourcesByReport(selectedReportId);
        let src = reportSources.find((s) => s.source_name.toLowerCase() === sourceName.toLowerCase());
        if (!src) {
          src = store.addReportSource(selectedReportId, sourceName, fileName);
        }

        const statRows = rows.map((r) => ({
          field_id: r.matchedFieldId!,
          field_name_snapshot: r.matchedFieldName!,
          unit_id: r.unitId!,
          unit_name_snapshot: r.unitName!,
          received_total: r.received_total,
          received_online: r.received_online,
          received_offline: r.received_offline,
          carried_forward: r.carried_forward,
          completed_total: r.completed_total,
          completed_early: r.completed_early,
          completed_on_time: r.completed_on_time,
          completed_late: r.completed_late,
          pending_total: r.pending_total,
          pending_on_time: r.pending_on_time,
          pending_late: r.pending_late,
          notes: r.hasDifference ? 'Tự động phát hiện chênh lệch nguồn khi import' : '',
          validation_status: r.validationStatus,
          validation_errors: r.validationErrors,
        }));

        store.saveReportStats(selectedReportId, src.id, statRows);
        totalSaved += statRows.length;
      });

      setImportSuccessMessage(
        `Nhập dữ liệu thành công! Đã lưu ${totalSaved} bản ghi thống kê vào kỳ "${selectedReport?.report_code}".`
      );
      setActiveStep(3);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi nhập dữ liệu');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Nhập dữ liệu thống kê từ Excel
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Quy trình bóc tách: Phân tách nguồn dữ liệu, nhận diện lĩnh vực, kiểm tra công thức và cảnh báo chênh lệch
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const buf = generateSampleExcelBuffer();
              const blob = new Blob([buf as any], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'Mau_Excel_TongHop_TTHC.xlsx';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Tải template Excel chuẩn</span>
          </button>
        </div>

        {/* Period Selector */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Chọn kỳ báo cáo đích:
          </label>
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            disabled={activeStep === 2}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.report_code} - {r.report_name} ({r.status.toUpperCase()})
              </option>
            ))}
          </select>

          {isLocked && (
            <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md font-medium">
              Báo cáo đã khóa — Không thể import
            </span>
          )}
        </div>
      </div>

      {/* STEP 1: UPLOAD AREA */}
      {activeStep === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-12 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center group"
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <input
              id="file-upload-input"
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
              <FileSpreadsheet className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Kéo thả file Excel (.xlsx, .xls, .csv) vào đây
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Hệ thống tự động bỏ qua dòng tiêu đề, số thứ tự cột (1)(2)(3)... và dòng TỔNG CỘNG. Đồng thời tự bóc tách các nguồn như "Trên Hệ thống các Bộ", "Trên Hệ thống thành phố".
            </p>

            <button
              type="button"
              className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Chọn file từ máy tính
            </button>
          </div>

          <div className="mt-6 text-left grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Chuẩn hóa tên lĩnh vực
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Tự động đối chiếu thông minh (Fuzzy match Levenshtein) với 15 lĩnh vực đã đăng ký trong hệ thống.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Báo động chênh lệch nguồn
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Tự động kiểm tra chênh lệch giữa số tổng ghi trên file và tổng các thành phần (ví dụ lệch 1 hồ sơ).
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" /> Tự suy ra đơn vị phụ trách
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Đơn vị giải quyết (Văn phòng, Kinh tế, VHXH) được suy ra tự động từ quan hệ lĩnh vực, không cần nhập trùng.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MAPPING & PREVIEW */}
      {activeStep === 2 && parseResult && (
        <div className="space-y-4">
          {/* Summary & Controls Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-slate-400">Tệp tin:</span>
                <p className="text-sm font-bold text-slate-800">{fileName}</p>
              </div>

              {sheetNames.length > 1 && (
                <div>
                  <span className="text-xs text-slate-400">Sheet:</span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="ml-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-800"
                  >
                    {sheetNames.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                {parseResult.validRowsCount} Hợp lệ
              </span>
              {parseResult.warningRowsCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                  {parseResult.warningRowsCount} Cảnh báo lệch
                </span>
              )}
              {parseResult.unmappedFieldsCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                  {parseResult.unmappedFieldsCount} Chưa gán lĩnh vực
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveStep(1);
                  setParseResult(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy & Tải lại
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isLocked || parseResult.unmappedFieldsCount > 0}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all ${
                  isLocked || parseResult.unmappedFieldsCount > 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <span>Xác nhận nhập số liệu</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Detailed Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Bảng thẩm định chi tiết trước khi lưu ({parseResult.draftRows.length} dòng số liệu)
              </h3>
              <span className="text-[11px] text-slate-500">
                Đã tự động loại bỏ dòng TỔNG CỘNG và dòng tiêu đề
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 font-semibold text-center w-10">Dòng</th>
                    <th className="p-2.5 font-semibold">Nguồn dữ liệu</th>
                    <th className="p-2.5 font-semibold min-w-[160px]">Lĩnh vực gốc (File)</th>
                    <th className="p-2.5 font-semibold min-w-[200px]">Mapping Lĩnh vực chuẩn</th>
                    <th className="p-2.5 font-semibold">Đơn vị suy ra</th>
                    <th className="p-2.5 font-semibold text-right">Tổng TN</th>
                    <th className="p-2.5 font-semibold text-right">Trực tuyến</th>
                    <th className="p-2.5 font-semibold text-right">Trực tiếp</th>
                    <th className="p-2.5 font-semibold text-right">Kỳ trước</th>
                    <th className="p-2.5 font-semibold text-right">Tổng GQ</th>
                    <th className="p-2.5 font-semibold text-right">Trước hạn</th>
                    <th className="p-2.5 font-semibold text-right">Đúng hạn</th>
                    <th className="p-2.5 font-semibold text-right">Quá hạn</th>
                    <th className="p-2.5 font-semibold text-right">Tổng Tồn</th>
                    <th className="p-2.5 font-semibold text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseResult.draftRows.map((row) => {
                    const isWarning = row.validationStatus === 'warning';
                    const isError = row.validationStatus === 'error' || !row.matchedFieldId;

                    return (
                      <tr
                        key={row.rowNumber}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isError ? 'bg-rose-50/50' : isWarning ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-400 font-mono text-[10px]">
                          {row.rowNumber}
                        </td>
                        <td className="p-2.5 font-medium text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-semibold">
                            {row.sourceName}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-800 font-medium">
                          {row.rawFieldName}
                        </td>

                        {/* Mapping selector */}
                        <td className="p-2.5">
                          <select
                            value={row.matchedFieldId || ''}
                            onChange={(e) => handleFieldMapChange(row.rowNumber, e.target.value)}
                            className={`w-full text-xs rounded border px-2 py-1 focus:outline-none ${
                              row.matchedFieldId
                                ? 'bg-white border-slate-300 text-slate-800'
                                : 'bg-rose-100 border-rose-300 text-rose-800 font-bold'
                            }`}
                          >
                            <option value="">-- Chưa ánh xạ --</option>
                            {fields.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} ({f.unit?.name || 'Chưa gán'})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Inferred Unit */}
                        <td className="p-2.5 font-semibold text-slate-700">
                          {row.unitName || '—'}
                        </td>

                        {/* Numbers */}
                        <td className={`p-2.5 text-right font-mono font-bold ${row.hasDifference ? 'text-amber-700' : 'text-slate-900'}`}>
                          {formatNumber(row.received_total)}
                          {row.recalculatedReceived !== row.received_total && (
                            <span className="block text-[10px] text-amber-600 font-normal">
                              Lệch: {row.recalculatedReceived - row.received_total > 0 ? '+' : ''}{row.recalculatedReceived - row.received_total}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono text-blue-600">{formatNumber(row.received_online)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatNumber(row.received_offline)}</td>
                        <td className="p-2.5 text-right font-mono text-amber-600">{formatNumber(row.carried_forward)}</td>

                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatNumber(row.completed_total)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatNumber(row.completed_early)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatNumber(row.completed_on_time)}</td>
                        <td className={`p-2.5 text-right font-mono ${row.completed_late > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                          {formatNumber(row.completed_late)}
                        </td>

                        <td className="p-2.5 text-right font-mono font-bold text-indigo-700">{formatNumber(row.pending_total)}</td>

                        {/* Validation Status Indicator */}
                        <td className="p-2.5 text-center">
                          {isError ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[10px] bg-rose-100 px-2 py-0.5 rounded" title={row.validationErrors.map((e) => e.message).join('\n')}>
                              <XCircle className="w-3.5 h-3.5" /> Lỗi
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded" title={row.validationErrors.map((e) => e.message).join('\n')}>
                              <AlertTriangle className="w-3.5 h-3.5" /> Lệch
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Chuẩn
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS */}
      {activeStep === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {importSuccessMessage}
          </h3>
          <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto">
            Số liệu đã được tính toán công thức lại, lưu vết lịch sử trong Nhật ký (Audit Logs) và sẵn sàng hiển thị trên Tổng quan Dashboard và Báo cáo.
          </p>

          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setActiveStep(1);
                setParseResult(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Nhập tiếp file khác
            </button>
            <a
              href={`/reports/${selectedReportId}`}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              Xem chi tiết báo cáo kỳ này
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
