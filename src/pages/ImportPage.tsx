import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { store } from '../services/store';
import {
  readWorkbook,
  parseSheetToDrafts,
  ParseResult,
  ParsedStatisticDraft,
  generateSampleExcelBuffer
} from '../features/import/excelParser';
import { formatNumber, getStatusBadge } from '../utils/format';
import { Report, ReportType } from '../types/database';
import { resolveLinhVuc } from '../utils/fieldResolver';
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
  Sparkles,
  Plus,
  BarChart3,
  Eye,
  Building2,
  FolderKanban,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const ImportPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>(store.getReports());
  const [units, setUnits] = useState(store.getUnits());
  const [fields, setFields] = useState(store.getFields());

  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    const list = store.getReports();
    return list[0]?.id || '';
  });

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Mapping & Preview, 3: Success
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importStatusText, setImportStatusText] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [importSummary, setImportSummary] = useState<{
    totalSaved: number;
    reportCode: string;
    reportName: string;
    totalReceived: number;
    totalOnline: number;
    totalCompleted: number;
    totalPending: number;
  } | null>(null);

  // Quick create report modal
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [newReportCode, setNewReportCode] = useState('');
  const [newReportName, setNewReportName] = useState('');
  const [newReportType, setNewReportType] = useState<ReportType>('monthly');
  const [newPeriodStart, setNewPeriodStart] = useState('2026-03-01');
  const [newPeriodEnd, setNewPeriodEnd] = useState('2026-03-31');

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        await store.fetchReports();
        await store.fetchFields();
        await store.fetchUnits();
      } catch (err) {
        console.warn('Lỗi đồng bộ dữ liệu báo cáo:', err);
      }
      if (!isMounted) return;

      const currentReports = store.getReports();
      setReports(currentReports);
      setUnits(store.getUnits());
      setFields(store.getFields());

      if (currentReports.length > 0) {
        setSelectedReportId((prev) => {
          if (prev && currentReports.some((r) => r.id === prev)) {
            return prev;
          }
          return currentReports[0].id;
        });
      }
    };

    void loadData();

    const unsub = store.subscribe(() => {
      if (!isMounted) return;
      const currentReports = store.getReports();
      setReports(currentReports);
      setUnits(store.getUnits());
      setFields(store.getFields());

      if (currentReports.length > 0) {
        setSelectedReportId((prev) => {
          if (prev && currentReports.some((r) => r.id === prev)) {
            return prev;
          }
          return currentReports[0].id;
        });
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const selectedReport = useMemo(() => {
    return reports.find((r) => r.id === selectedReportId) || reports[0];
  }, [reports, selectedReportId]);

  const isLocked = selectedReport?.status === 'locked' || selectedReport?.status === 'archived';

  const handleCreateQuickReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportCode.trim() || !newReportName.trim()) return;

    try {
      setImportError(null);
      const created = await store.createReport({
        report_code: newReportCode.trim().toUpperCase(),
        report_name: newReportName.trim(),
        report_type: newReportType,
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
        data_as_of: new Date().toISOString(),
        notes: `Tạo từ màn hình Import (${new Date().toLocaleDateString('vi-VN')})`,
      });
      setSelectedReportId(created.id);
      setShowCreateReportModal(false);
      setNewReportCode('');
      setNewReportName('');
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi tạo kỳ báo cáo');
    }
  };

  // Handle File Upload
  const handleFileUpload = (file: File) => {
    setImportError(null);
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
      } catch (err: any) {
        console.error('File parsing error:', err);
        setImportError(err.message || 'Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file!');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle Sheet Change
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setImportError(null);
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
  const handleConfirmImport = async () => {
    setImportError(null);

    // 1. Validate report selection and Excel parse result explicitly
    const currentReports = store.getReports();
    let targetReport = currentReports.find((r) => r.id === selectedReportId);

    if (!selectedReportId || !targetReport) {
      if (currentReports.length > 0) {
        targetReport = currentReports[0];
        setSelectedReportId(targetReport.id);
      } else {
        setImportError('Vui lòng chọn hoặc tạo kỳ báo cáo trước khi xác nhận nhập số liệu.');
        return;
      }
    }

    if (!parseResult || !parseResult.draftRows || parseResult.draftRows.length === 0) {
      setImportError('Chưa có dữ liệu Excel hợp lệ để nhập số liệu. Vui lòng tải lại file Excel.');
      return;
    }

    if (targetReport.status === 'locked' || targetReport.status === 'archived') {
      setImportError(`Báo cáo "${targetReport.report_code}" đã bị khóa hoặc lưu trữ. Không thể nhập đè dữ liệu!`);
      return;
    }

    setIsProcessing(true);

    try {
      // BƯỚC 1: Preflight Validation
      setImportStatusText('Đang kiểm tra dữ liệu...');

      const allFields = store.getFields();
      const allUnits = store.getUnits();

      if (allFields.length === 0) {
        throw new Error('Danh mục Lĩnh vực/Thủ tục (public.fields) đang trống trên hệ thống.');
      }
      if (allUnits.length === 0) {
        throw new Error('Danh mục Đơn vị (public.units) đang trống trên hệ thống.');
      }

      // Preflight: Validate every draft row against CSDL constraints
      const preparedRows = parseResult.draftRows.map((row) => {
        const fieldId = row.matchedFieldId;
        if (!fieldId) {
          throw new Error(
            `Dòng ${row.rowNumber} (${row.sourceName} - "${row.rawFieldName}"): Chưa được ánh xạ Lĩnh vực/Thủ tục hợp lệ.`
          );
        }

        const targetField = allFields.find((f) => f.id === fieldId);
        if (!targetField) {
          throw new Error(
            `Dòng ${row.rowNumber} ("${row.rawFieldName}"): Lĩnh vực/Thủ tục ID "${fieldId}" không tồn tại trong CSDL (public.fields).`
          );
        }

        if (!targetField.unit_id) {
          throw new Error(
            `Dòng ${row.rowNumber} ("${targetField.name}"): Thủ tục/Lĩnh vực chưa được phân công Đơn vị giải quyết trong public.fields. Vui lòng phân công Đơn vị trước khi nhập báo cáo.`
          );
        }

        const assignedUnit = allUnits.find((u) => u.id === targetField.unit_id);
        if (!assignedUnit) {
          throw new Error(
            `Dòng ${row.rowNumber} ("${targetField.name}"): Đơn vị giải quyết (ID "${targetField.unit_id}") không tồn tại trong CSDL (public.units).`
          );
        }

        const fieldName = resolveLinhVuc(row.matchedFieldName || row.rawFieldName, fieldId, allFields);

        return {
          ...row,
          matchedFieldId: fieldId,
          matchedFieldName: fieldName,
          unitId: targetField.unit_id,
          unitName: assignedUnit.name,
        };
      });

      // BƯỚC 2: Save report source & statistics
      setImportStatusText('Đang lưu nguồn dữ liệu...');

      const sourcesMap = new Map<string, typeof preparedRows>();
      preparedRows.forEach((row) => {
        const group = sourcesMap.get(row.sourceName) || [];
        group.push(row);
        sourcesMap.set(row.sourceName, group);
      });

      let totalSaved = 0;
      let totalReceived = 0;
      let totalOnline = 0;
      let totalCompleted = 0;
      let totalPending = 0;

      setImportStatusText('Đang lưu số liệu thống kê...');

      for (const [sourceName, rows] of sourcesMap.entries()) {
        const reportSources = store.getSourcesByReport(targetReport.id);
        let src = reportSources.find((s) => s.source_name.toLowerCase() === sourceName.toLowerCase());
        if (!src) {
          src = await store.addReportSource(targetReport.id, sourceName, fileName);
        }

        const statRows = rows.map((r) => {
          totalReceived += r.received_total || 0;
          totalOnline += r.received_online || 0;
          totalCompleted += r.completed_total || 0;
          totalPending += r.pending_total || 0;

          return {
            field_id: r.matchedFieldId!,
            field_name_snapshot: r.matchedFieldName!,
            unit_id: r.unitId || '',
            unit_name_snapshot: r.unitName || 'Chưa gán đơn vị',
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
          };
        });

        await store.saveReportStats(targetReport.id, src.id, statRows);
        totalSaved += statRows.length;
      }

      // Verify row count from CSDL after saveReportStats
      const savedStatsInDb = await store.fetchStatsByReport(targetReport.id);
      if (savedStatsInDb.length < totalSaved) {
        throw new Error(
          `Xác nhận lưu CSDL thất bại: Số dòng ghi nhận trong CSDL (${savedStatsInDb.length}) ít hơn số dòng trong file import (${totalSaved}).`
        );
      }

      // BƯỚC 3: Recalculate indicators & update status
      setImportStatusText('Đang tính các chỉ tiêu...');
      const hasErrors = preparedRows.some((r) => r.validationStatus === 'error');
      await store.recalculateAndPersistReportIndicators(targetReport.id);

      setImportStatusText('Đang hoàn tất...');
      await store.updateReportStatus(targetReport.id, 'imported');
      if (!hasErrors) {
        await store.updateReportStatus(targetReport.id, 'validated');
      }

      setImportSummary({
        totalSaved,
        reportCode: targetReport.report_code || '',
        reportName: targetReport.report_name || '',
        totalReceived,
        totalOnline,
        totalCompleted,
        totalPending,
      });

      // ONLY advance to Step 3 if every step above succeeded without error
      setActiveStep(3);
    } catch (err: any) {
      console.error('Lỗi khi nhập dữ liệu Excel:', err);
      setImportError(err.message || 'Lỗi không xác định khi nhập dữ liệu.');
    } finally {
      setIsProcessing(false);
      setImportStatusText(null);
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
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Chọn kỳ báo cáo đích:
            </label>
            <select
              value={selectedReportId}
              onChange={(e) => {
                setSelectedReportId(e.target.value);
                setImportError(null);
              }}
              disabled={activeStep === 2 || isProcessing}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-md disabled:opacity-60"
            >
              {reports.map((r) => {
                const count = store.getStatsByReport(r.id).length;
                return (
                  <option key={r.id} value={r.id}>
                    {r.report_code} - {r.report_name} ({count > 0 ? `${count} dòng số liệu` : 'Chưa có số liệu'})
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={() => {
                setShowCreateReportModal(true);
                setImportError(null);
              }}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo kỳ mới</span>
            </button>

            {isLocked && (
              <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md font-medium">
                Báo cáo đã khóa — Không thể import
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Create Report Modal */}
      {showCreateReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Tạo kỳ báo cáo mới</h3>
              <button
                type="button"
                onClick={() => setShowCreateReportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateQuickReport} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã báo cáo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: BC-2026-03"
                  value={newReportCode}
                  onChange={(e) => setNewReportCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên kỳ báo cáo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Báo cáo TTHC Tháng 03/2026"
                  value={newReportName}
                  onChange={(e) => setNewReportName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    required
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    required
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateReportModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Tạo & Chọn kỳ này
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {importError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-3 text-rose-800 text-xs shadow-xs">
          <div className="flex items-start gap-2.5">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-900 block text-xs mb-0.5">
                Lỗi nhập dữ liệu:
              </span>
              <p className="whitespace-pre-line leading-relaxed text-xs">{importError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="text-rose-400 hover:text-rose-700 transition-colors shrink-0 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
          {/* Progress Processing Banner */}
          {isProcessing && importStatusText && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-blue-800 text-xs shadow-xs animate-pulse">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span className="font-semibold text-blue-900">{importStatusText}</span>
            </div>
          )}

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
                    disabled={isProcessing}
                    className="ml-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-800 disabled:opacity-60"
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
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                  {parseResult.unmappedFieldsCount} Chưa gán
                </span>
              )}

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setActiveStep(1);
                  setParseResult(null);
                  setImportError(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60"
              >
                Hủy & Tải lại
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isLocked || isProcessing}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all ${
                  isLocked || isProcessing
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang nhập dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <span>Xác nhận nhập số liệu</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
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
                    const isError = row.validationStatus === 'error';
                    const isWarning = row.validationStatus === 'warning' || !row.matchedFieldId || !row.unitId;

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
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[10px] bg-rose-100 px-2 py-0.5 rounded" title={row.validationErrors ? row.validationErrors.map((e) => e.message).join('\n') : ''}>
                              <XCircle className="w-3.5 h-3.5" /> Lỗi
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded" title={row.validationErrors ? row.validationErrors.map((e) => e.message).join('\n') : ''}>
                              <AlertTriangle className="w-3.5 h-3.5" /> {!row.matchedFieldId || !row.unitId ? 'Chưa gán' : 'Lệch'}
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
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Nhập dữ liệu thành công!
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Đã lưu <span className="font-bold text-slate-900">{importSummary?.totalSaved || 0}</span> dòng số liệu vào kỳ báo cáo <span className="font-bold text-blue-700">{importSummary?.reportCode} - {importSummary?.reportName}</span>.
            </p>
          </div>

          {/* Quick KPI Overview Cards */}
          {importSummary && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tổng tiếp nhận</span>
                <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                  {formatNumber(importSummary.totalReceived)}
                </span>
                <span className="text-[10px] text-blue-600 font-medium">
                  {importSummary.totalReceived > 0 ? `${Math.round((importSummary.totalOnline / importSummary.totalReceived) * 100)}% trực tuyến` : '0%'}
                </span>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-center">
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">Trực tuyến</span>
                <span className="text-2xl font-bold font-mono text-blue-700 mt-1 block">
                  {formatNumber(importSummary.totalOnline)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Hồ sơ online</span>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-center">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Đã giải quyết</span>
                <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
                  {formatNumber(importSummary.totalCompleted)}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Đã xử lý xong</span>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-center">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Đang giải quyết</span>
                <span className="text-2xl font-bold font-mono text-amber-700 mt-1 block">
                  {formatNumber(importSummary.totalPending)}
                </span>
                <span className="text-[10px] text-amber-600 font-medium">Đang trong hạn</span>
              </div>
            </div>
          )}

          {/* Action Navigation Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveStep(1);
                setParseResult(null);
                setImportSummary(null);
                setImportError(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Nhập tiếp file khác</span>
            </button>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Xem Bảng điều khiển (Dashboard)</span>
            </Link>

            <Link
              to={`/reports/${selectedReportId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Chi tiết Báo cáo & Thẩm định</span>
            </Link>

            <Link
              to="/analysis/fields"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
            >
              <FolderKanban className="w-4 h-4 text-slate-500" />
              <span>Phân tích Lĩnh vực</span>
            </Link>

            <Link
              to="/analysis/units"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
            >
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>Phân tích Đơn vị</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
