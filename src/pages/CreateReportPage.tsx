import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../services/store';
import { Report, Field, Unit } from '../types/database';
import {
  readWorkbook,
  parseSheetToDrafts,
  ParseResult,
  ParsedStatisticDraft,
  generateSampleExcelBuffer
} from '../features/import/excelParser';
import { formatNumber } from '../utils/format';
import {
  FilePlus,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Layers,
  Sparkles,
  ChevronRight,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

const padZero = (n: number): string => String(n).padStart(2, '0');

const getLocalDateString = (d: Date = new Date()): string => {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
};

const getLocalDateTimeString = (d: Date = new Date()): string => {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}T${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
};

const formatViDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const generateDefaultReportName = (startDate: string, endDate: string): string => {
  const startVi = formatViDate(startDate);
  const endVi = formatViDate(endDate);
  if (startVi && endVi) {
    return `Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC từ ngày ${startVi} đến ngày ${endVi}`;
  }
  if (startVi) {
    return `Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC từ ngày ${startVi}`;
  }
  return 'Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC';
};

export const CreateReportPage: React.FC = () => {
  const navigate = useNavigate();
  const units = useMemo(() => store.getUnits(), []);
  const fields = useMemo(() => store.getFields(), []);

  // Compute standard initial dates
  const now = useMemo(() => new Date(), []);
  const currentYear = useMemo(() => now.getFullYear(), [now]);
  const defaultPeriodStart = useMemo(() => `${currentYear}-01-01`, [currentYear]);
  const defaultPeriodEnd = useMemo(() => getLocalDateString(now), [now]);
  const defaultDataAsOf = useMemo(() => getLocalDateTimeString(now), [now]);
  const defaultReportCode = useMemo(() => `BC-${currentYear}`, [currentYear]);
  const defaultReportName = useMemo(
    () => generateDefaultReportName(defaultPeriodStart, defaultPeriodEnd),
    [defaultPeriodStart, defaultPeriodEnd]
  );

  // Steps state: 1: Details form, 2: Upload Excel, 3: Success
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [createdReport, setCreatedReport] = useState<Report | null>(null);

  // Track if user has manually typed in the report name
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  // STEP 1 State: Form data
  const [formData, setFormData] = useState<{
    report_code: string;
    report_name: string;
    report_type: Report['report_type'];
    period_start: string;
    period_end: string;
    data_as_of: string;
    notes: string;
  }>({
    report_code: defaultReportCode,
    report_name: defaultReportName,
    report_type: 'annual',
    period_start: defaultPeriodStart,
    period_end: defaultPeriodEnd,
    data_as_of: defaultDataAsOf,
    notes: 'Kỳ báo cáo định kỳ theo dõi tiến độ tiếp nhận và xử lý hồ sơ thủ tục hành chính.',
  });

  // Handlers to auto-update report name when dates change
  const handleStartDateChange = (newStart: string) => {
    setFormData((prev) => {
      const updated = { ...prev, period_start: newStart };
      if (!isNameManuallyEdited) {
        updated.report_name = generateDefaultReportName(newStart, prev.period_end);
      }
      return updated;
    });
  };

  const handleEndDateChange = (newEnd: string) => {
    setFormData((prev) => {
      const updated = { ...prev, period_end: newEnd };
      if (!isNameManuallyEdited) {
        updated.report_name = generateDefaultReportName(prev.period_start, newEnd);
      }
      return updated;
    });
  };

  const handleReportTypeChange = (newType: Report['report_type']) => {
    setFormData((prev) => {
      const updated = { ...prev, report_type: newType };
      if (newType === 'annual') {
        updated.period_start = `${currentYear}-01-01`;
        updated.period_end = getLocalDateString(now);
        updated.report_code = `BC-${currentYear}`;
      } else if (newType === 'monthly') {
        const monthStr = padZero(now.getMonth() + 1);
        updated.period_start = `${currentYear}-${monthStr}-01`;
        updated.period_end = getLocalDateString(now);
        updated.report_code = `BC-${currentYear}-${monthStr}`;
      } else if (newType === 'quarterly') {
        const q = Math.floor(now.getMonth() / 3) + 1;
        const qStartMonth = padZero((q - 1) * 3 + 1);
        updated.period_start = `${currentYear}-${qStartMonth}-01`;
        updated.period_end = getLocalDateString(now);
        updated.report_code = `BC-${currentYear}-Q${q}`;
      }
      if (!isNameManuallyEdited) {
        updated.report_name = generateDefaultReportName(updated.period_start, updated.period_end);
      }
      return updated;
    });
  };

  const [isCreatingReport, setIsCreatingReport] = useState(false);

  // STEP 2 State: Excel import states
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState<boolean>(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string>('');

  // Handle Step 1 Submit (Create Report period record)
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.report_code || !formData.report_name) {
      alert('Vui lòng điền đầy đủ Mã báo cáo và Tên báo cáo');
      return;
    }

    setIsCreatingReport(true);
    try {
      // Create report in database
      const newRep = await store.createReport({
        ...formData,
        data_as_of: new Date(formData.data_as_of).toISOString(),
      });
      setCreatedReport(newRep);
      setActiveStep(2);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi khởi tạo kỳ báo cáo');
    } finally {
      setIsCreatingReport(false);
    }
  };

  // Handle File Upload in Step 2
  const handleFileUpload = (file: File) => {
    setIsProcessingExcel(true);
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
      } catch (err) {
        console.error('Excel parsing error:', err);
        alert('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file!');
      } finally {
        setIsProcessingExcel(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle Sheet Change in Step 2
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setSelectedSheet(sheetName);
    const sheetObj = workbook.Sheets[sheetName];
    const res = parseSheetToDrafts(sheetObj, fields, units, sheetName, fileName);
    setParseResult(res);
  };

  // Manual Field Mapping adjustment in Step 2 preview
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

  // Confirm Excel Import in Step 2
  const handleConfirmImport = async () => {
    if (!createdReport || !parseResult) return;

    try {
      // Ensure all rows are mapped to a field (or auto-create the field if missing)
      const preparedRows = parseResult.draftRows.map((row) => {
        let fieldId = row.matchedFieldId;
        let fieldName = row.matchedFieldName || row.rawFieldName;
        let unitId = row.unitId || '';
        let unitName = row.unitName || 'Chưa gán đơn vị';

        if (!fieldId) {
          throw new Error(`Lĩnh vực "${row.rawFieldName}" chưa được ánh xạ trong Danh mục Master. Vui lòng chọn đúng lĩnh vực trước khi nhập.`);
        }

        return {
          ...row,
          matchedFieldId: fieldId,
          matchedFieldName: fieldName,
          unitId,
          unitName,
        };
      });

      // Group rows by sourceName
      const sourcesMap = new Map<string, typeof preparedRows>();
      preparedRows.forEach((row) => {
        const group = sourcesMap.get(row.sourceName) || [];
        group.push(row);
        sourcesMap.set(row.sourceName, group);
      });

      let totalSaved = 0;

      for (const [sourceName, rows] of sourcesMap.entries()) {
        // Create or get source in store
        const reportSources = store.getSourcesByReport(createdReport.id);
        let src = reportSources.find((s) => s.source_name.toLowerCase() === sourceName.toLowerCase());
        if (!src) {
          src = await store.addReportSource(createdReport.id, sourceName, fileName);
        }

        const statRows = rows.map((r) => ({
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
        }));

        await store.saveReportStats(createdReport.id, src.id, statRows);
        totalSaved += statRows.length;
      }

      const hasErrors = preparedRows.some((r) => r.validationStatus === 'error');
      await store.updateReportStatus(createdReport.id, 'imported');
      if (!hasErrors) {
        await store.updateReportStatus(createdReport.id, 'validated');
      }

      setImportSuccessMessage(
        `Khởi tạo kỳ báo cáo thành công! Đã tạo "${createdReport.report_code}" và tự động bóc tách, nạp ${totalSaved} số liệu thống kê chi tiết.`
      );
      setActiveStep(3);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu trữ số liệu thống kê');
    }
  };

  // Skip import (create empty draft report)
  const handleSkipImport = () => {
    if (!createdReport) return;
    setImportSuccessMessage(
      `Khởi tạo kỳ báo cáo thành công! Kỳ báo cáo rỗng "${createdReport.report_code}" đã được tạo và sẵn sàng nhận số liệu.`
    );
    setActiveStep(3);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Wizard Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1 sm:gap-3 text-xs font-semibold text-slate-500 w-full justify-around sm:justify-start">
          <div className={`flex items-center gap-1.5 ${activeStep === 1 ? 'text-blue-600 font-bold' : activeStep > 1 ? 'text-emerald-600' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 1 ? 'bg-blue-600 text-white' : activeStep > 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>
              {activeStep > 1 ? <Check className="w-3 h-3" /> : '1'}
            </span>
            <span>Thông tin chung</span>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />

          <div className={`flex items-center gap-1.5 ${activeStep === 2 ? 'text-blue-600 font-bold' : activeStep > 2 ? 'text-emerald-600' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 2 ? 'bg-blue-600 text-white' : activeStep > 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>
              {activeStep > 2 ? <Check className="w-3 h-3" /> : '2'}
            </span>
            <span>Nhập liệu Excel (Tùy chọn)</span>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />

          <div className={`flex items-center gap-1.5 ${activeStep === 3 ? 'text-blue-600 font-bold' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
              3
            </span>
            <span>Hoàn thành</span>
          </div>
        </div>

        {activeStep === 1 && (
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" /> Hủy & Quay lại
          </button>
        )}
      </div>

      {/* STEP 1: CONFIGURE PERIOD DETAILS */}
      {activeStep === 1 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <FilePlus className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Khởi tạo kỳ Báo cáo Thống kê mới
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thiết lập mã báo cáo, khoảng thời gian dữ liệu và ghi chú thuyết minh
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateReport} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mã Báo Cáo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã báo cáo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.report_code}
                  onChange={(e) => setFormData({ ...formData, report_code: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  placeholder="VD: BC-2026-04"
                />
              </div>

              {/* Loại kỳ báo cáo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Loại kỳ báo cáo <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.report_type}
                  onChange={(e) => handleReportTypeChange(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="annual">Báo cáo Năm</option>
                  <option value="monthly">Báo cáo Tháng</option>
                  <option value="quarterly">Báo cáo Quý</option>
                  <option value="ad_hoc">Chuyên đề / Đột xuất</option>
                </select>
              </div>
            </div>

            {/* Tên Báo Cáo */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Tên kỳ báo cáo chi tiết <span className="text-rose-500">*</span>
                </label>
                {isNameManuallyEdited ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNameManuallyEdited(false);
                      setFormData((prev) => ({
                        ...prev,
                        report_name: generateDefaultReportName(prev.period_start, prev.period_end),
                      }));
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                    title="Khôi phục tên tự động theo Từ ngày - Đến ngày"
                  >
                    <span>↺ Tự động đặt lại tên theo mốc ngày</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-600 font-medium">
                    ✓ Tự động cập nhật theo mốc ngày chọn
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={formData.report_name}
                onChange={(e) => {
                  setIsNameManuallyEdited(true);
                  setFormData({ ...formData, report_name: e.target.value });
                }}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                placeholder="VD: Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC từ ngày ... đến ngày ..."
              />
            </div>

            {/* Khoảng thời gian */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Từ ngày <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.period_start}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đến ngày <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.period_end}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời điểm chốt số liệu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.data_as_of}
                  onChange={(e) => setFormData({ ...formData, data_as_of: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú / Thuyết minh kỳ báo cáo
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                placeholder="Nhập mục đích, phạm vi lấy dữ liệu hoặc lưu ý..."
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={isCreatingReport}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
              >
                <span>Tạo kỳ báo cáo & Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: UPLOAD & MAPPING PREVIEW */}
      {activeStep === 2 && createdReport && (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Bước 2/3: Nạp dữ liệu nguồn</span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                Nhập số liệu Excel cho kỳ "{createdReport.report_code}"
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kéo thả bảng tổng hợp Excel gốc để bóc tách số liệu tự động. Hoặc bạn có thể bỏ qua để sửa tay sau.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Excel Mẫu chuẩn</span>
              </button>

              <button
                type="button"
                onClick={handleSkipImport}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Bỏ qua (Tạo báo cáo rỗng)
              </button>
            </div>
          </div>

          {/* DRAG AND DROP AREA */}
          {!parseResult ? (
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
                onClick={() => document.getElementById('step-2-file-input')?.click()}
              >
                <input
                  id="step-2-file-input"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>

                <h3 className="text-sm font-bold text-slate-900">
                  Kéo thả file Excel (.xlsx, .xls) vào đây để nạp dữ liệu
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                  Bộ lọc thông minh sẽ tự tách nguồn "Trên Hệ thống các Bộ" và "Thành phố", tự phân tích công thức, loại bỏ dòng tổng cộng của file.
                </p>

                <button
                  type="button"
                  className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Chọn file từ máy tính
                </button>
              </div>

              {/* Informative Grid */}
              <div className="mt-6 text-left grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-5">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tự động ánh xạ lĩnh vực
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Sử dụng thuật toán so khớp Levenshtein so khớp gốc với 15 lĩnh vực của Văn phòng, Kinh tế, VHXH.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Thẩm định tức thì
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Phát hiện các lỗi công thức tiếp nhận, chênh lệch số tổng, mất cân bằng hồ sơ để thông báo trước khi lưu.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" /> Tự định danh cơ quan
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Không bắt buộc nhập đơn vị; hệ thống tự quy nạp Đơn vị giải quyết dựa theo lĩnh vực chuẩn đã lưu.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW AND EDIT MAPPINGS */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Preview Toolbar */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400">File đang nạp:</span>
                    <p className="text-xs font-bold text-slate-800">{fileName}</p>
                  </div>

                  {sheetNames.length > 1 && (
                    <div>
                      <span className="text-[10px] text-slate-400">Sheet dữ liệu:</span>
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

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                    {parseResult.validRowsCount} Hợp lệ
                  </span>
                  {parseResult.warningRowsCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-100">
                      {parseResult.warningRowsCount} Lệch nguồn
                    </span>
                  )}
                  {parseResult.unmappedFieldsCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-100">
                      {parseResult.unmappedFieldsCount} Chưa gán
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setParseResult(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Hủy & Chọn file khác
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-all bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <span>Lưu số liệu & Hoàn tất</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid Preview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Bảng thẩm định chi tiết trước khi nạp ({parseResult.draftRows.length} dòng số liệu)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Hệ thống tự động đồng bộ hóa số liệu dựa trên phân công Lĩnh vực
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="p-2 text-center w-10">Dòng</th>
                        <th className="p-2">Nguồn dữ liệu</th>
                        <th className="p-2 min-w-[140px]">Lĩnh vực gốc (File)</th>
                        <th className="p-2">Đơn vị</th>
                        <th className="p-2 text-right">Tổng TN</th>
                        <th className="p-2 text-right">Trực tuyến</th>
                        <th className="p-2 text-right">Trực tiếp</th>
                        <th className="p-2 text-right">Tổng GQ</th>
                        <th className="p-2 text-right">Trước hạn</th>
                        <th className="p-2 text-right">Đúng hạn</th>
                        <th className="p-2 text-right">Quá hạn</th>
                        <th className="p-2 text-right">Tổng Tồn</th>
                        <th className="p-2 text-center">Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {parseResult.draftRows.map((row) => {
                        const isError = row.validationStatus === 'error';
                        const isWarning = row.validationStatus === 'warning' || !row.matchedFieldId || !row.unitId;

                        return (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isError ? 'bg-rose-50/40' : isWarning ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <td className="p-2 text-center text-slate-400 font-sans">{row.rowNumber}</td>
                            <td className="p-2 font-sans font-semibold text-slate-700">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">
                                {row.sourceName}
                              </span>
                            </td>
                            <td className="p-2 font-sans font-medium text-slate-800">{row.rawFieldName}</td>
                            
                            <td className="p-2 font-sans font-semibold text-slate-600">{row.unitName || '—'}</td>
                            <td className={`p-2 text-right font-bold ${row.hasDifference ? 'text-amber-700' : 'text-slate-900'}`}>
                              {formatNumber(row.received_total)}
                            </td>
                            <td className="p-2 text-right text-blue-600">{formatNumber(row.received_online)}</td>
                            <td className="p-2 text-right text-slate-600">{formatNumber(row.received_offline)}</td>
                            <td className="p-2 text-right font-bold text-emerald-700">{formatNumber(row.completed_total)}</td>
                            <td className="p-2 text-right text-slate-500">{formatNumber(row.completed_early)}</td>
                            <td className="p-2 text-right text-slate-500">{formatNumber(row.completed_on_time)}</td>
                            <td className={`p-2 text-right ${row.completed_late > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                              {formatNumber(row.completed_late)}
                            </td>
                            <td className="p-2 text-right text-indigo-700 font-bold">{formatNumber(row.pending_total)}</td>
                            <td className="p-2 text-center font-sans">
                              {isError ? (
                                <span className="inline-block px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-bold" title={row.validationErrors ? row.validationErrors.map((e) => e.message).join('\n') : ''}>
                                  Lỗi
                                </span>
                              ) : isWarning ? (
                                <span className="inline-block px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold" title={row.validationErrors ? row.validationErrors.map((e) => e.message).join('\n') : ''}>
                                  {!row.matchedFieldId || !row.unitId ? 'Chưa gán' : 'Lệch'}
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                  Hợp lệ
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
        </div>
      )}

      {/* STEP 3: SUCCESS FEEDBACK */}
      {activeStep === 3 && createdReport && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-xs max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900">
              {importSuccessMessage}
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Hồ sơ thống kê kỳ mới đã được đồng bộ chuẩn mực trên CSDL đám mây Supabase và lưu vết vào nhật ký Audit Logs.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                // Reset state to start a new wizard
                setActiveStep(1);
                setCreatedReport(null);
                setParseResult(null);
                setWorkbook(null);
                setFormData({
                  report_code: `BC-2026-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                  report_name: `Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC Tháng ${String(new Date().getMonth() + 1).padStart(2, '0')}/2026`,
                  report_type: 'monthly',
                  period_start: '2026-04-01',
                  period_end: '2026-04-30',
                  data_as_of: '2026-04-30T17:00',
                  notes: 'Kỳ báo cáo định kỳ theo dõi tiến độ tiếp nhận và xử lý hồ sơ thủ tục hành chính.',
                });
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Tạo thêm kỳ báo cáo khác
            </button>

            <button
              type="button"
              onClick={() => navigate(`/reports/${createdReport.id}`)}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              Xem chi tiết báo cáo kỳ này
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
