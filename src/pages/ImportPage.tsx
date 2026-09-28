import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { getFriendlyErrorMessage } from '../utils/errorHandler';
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
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Wand2,
  Calculator,
  Check,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { validateStatisticRow } from '../features/analysis/formulas';

export const ImportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlReportId = searchParams.get('reportId');

  const [reports, setReports] = useState<Report[]>(store.getReports());
  const [units, setUnits] = useState(store.getUnits());
  const [fields, setFields] = useState(store.getFields());

  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    if (urlReportId) return urlReportId;
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
          if (urlReportId && currentReports.some((r) => r.id === urlReportId)) {
            return urlReportId;
          }
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
          if (urlReportId && currentReports.some((r) => r.id === urlReportId)) {
            return urlReportId;
          }
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
      setImportError(getFriendlyErrorMessage(err, 'Lỗi khi tạo kỳ báo cáo. Vui lòng thử lại.'));
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
        setImportError(getFriendlyErrorMessage(err, 'Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file!'));
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

  // Sorting state for preview table
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [inspectRow, setInspectRow] = useState<ParsedStatisticDraft | null>(null);
  const [autoFixSuccessMsg, setAutoFixSuccessMsg] = useState<string | null>(null);

  // Auto-fix single row to make all business formulas balance
  const handleAutoFixRow = (rowNumber: number) => {
    if (!parseResult) return;

    const updatedDrafts = parseResult.draftRows.map((r) => {
      if (r.rowNumber !== rowNumber) return r;

      const correctedRec = r.received_online + r.received_offline + r.carried_forward;
      const correctedComp = r.completed_early + r.completed_on_time + r.completed_late;
      const correctedPend = r.pending_on_time + r.pending_late;

      const valResult = validateStatisticRow({
        received_total: correctedRec,
        received_online: r.received_online,
        received_offline: r.received_offline,
        carried_forward: r.carried_forward,
        completed_total: correctedComp,
        completed_early: r.completed_early,
        completed_on_time: r.completed_on_time,
        completed_late: r.completed_late,
        pending_total: correctedPend,
        pending_on_time: r.pending_on_time,
        pending_late: r.pending_late,
        field_name: r.rawFieldName,
        source_name: r.sourceName,
      });

      const updatedRow: ParsedStatisticDraft = {
        ...r,
        received_total: correctedRec,
        completed_total: correctedComp,
        pending_total: correctedPend,
        recalculatedReceived: valResult.recalculated.received_total,
        recalculatedCompleted: valResult.recalculated.completed_total,
        recalculatedPending: valResult.recalculated.pending_total,
        balance: valResult.recalculated.balance,
        hasDifference: false,
        validationStatus: (valResult.isValid ? (valResult.hasWarning ? 'warning' : 'valid') : 'error') as 'error' | 'valid' | 'warning',
        validationErrors: valResult.errors,
      };

      if (inspectRow && inspectRow.rowNumber === rowNumber) {
        setInspectRow(updatedRow);
      }
      return updatedRow;
    });

    setParseResult({
      ...parseResult,
      draftRows: updatedDrafts,
      validRowsCount: updatedDrafts.filter((r) => r.validationStatus === 'valid' && r.matchedFieldId).length,
      warningRowsCount: updatedDrafts.filter((r) => r.validationStatus === 'warning').length,
      errorRowsCount: updatedDrafts.filter((r) => r.validationStatus === 'error' || !r.matchedFieldId).length,
    });

    setAutoFixSuccessMsg(`Đã tự động tính và cân bằng lại số liệu cho dòng số ${rowNumber}.`);
    setTimeout(() => setAutoFixSuccessMsg(null), 3500);
  };

  // Auto-fix ALL rows with formula differences
  const handleAutoFixAllRows = () => {
    if (!parseResult) return;

    let fixedCount = 0;
    const updatedDrafts: ParsedStatisticDraft[] = parseResult.draftRows.map((r) => {
      const correctedRec = r.received_online + r.received_offline + r.carried_forward;
      const correctedComp = r.completed_early + r.completed_on_time + r.completed_late;
      const correctedPend = r.pending_on_time + r.pending_late;

      const hadIssue = r.received_total !== correctedRec || r.completed_total !== correctedComp || r.pending_total !== correctedPend;
      if (hadIssue) fixedCount++;

      const valResult = validateStatisticRow({
        received_total: correctedRec,
        received_online: r.received_online,
        received_offline: r.received_offline,
        carried_forward: r.carried_forward,
        completed_total: correctedComp,
        completed_early: r.completed_early,
        completed_on_time: r.completed_on_time,
        completed_late: r.completed_late,
        pending_total: correctedPend,
        pending_on_time: r.pending_on_time,
        pending_late: r.pending_late,
        field_name: r.rawFieldName,
        source_name: r.sourceName,
      });

      return {
        ...r,
        received_total: correctedRec,
        completed_total: correctedComp,
        pending_total: correctedPend,
        recalculatedReceived: valResult.recalculated.received_total,
        recalculatedCompleted: valResult.recalculated.completed_total,
        recalculatedPending: valResult.recalculated.pending_total,
        balance: valResult.recalculated.balance,
        hasDifference: false,
        validationStatus: (valResult.isValid ? (valResult.hasWarning ? 'warning' : 'valid') : 'error') as 'error' | 'valid' | 'warning',
        validationErrors: valResult.errors,
      };
    });

    setParseResult({
      ...parseResult,
      draftRows: updatedDrafts,
      validRowsCount: updatedDrafts.filter((r) => r.validationStatus === 'valid' && r.matchedFieldId).length,
      warningRowsCount: updatedDrafts.filter((r) => r.validationStatus === 'warning').length,
      errorRowsCount: updatedDrafts.filter((r) => r.validationStatus === 'error' || !r.matchedFieldId).length,
    });

    if (inspectRow) {
      const current = updatedDrafts.find((r) => r.rowNumber === inspectRow.rowNumber);
      if (current) setInspectRow(current);
    }

    setAutoFixSuccessMsg(`Đã tự động chuẩn hóa và cân bằng toàn bộ ${fixedCount} dòng số liệu!`);
    setTimeout(() => setAutoFixSuccessMsg(null), 4000);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Manual Unit Mapping adjustment
  const handleUnitMapChange = (rowNumber: number, newUnitId: string) => {
    if (!parseResult) return;
    const targetUnit = units.find((u) => u.id === newUnitId);
    if (!targetUnit) return;

    const updatedDrafts = parseResult.draftRows.map((row) => {
      if (row.rowNumber === rowNumber) {
        return {
          ...row,
          unitId: targetUnit.id,
          unitName: targetUnit.name,
          validationStatus: (row.validationStatus === 'error' && !row.matchedFieldId) ? 'valid' : row.validationStatus,
          isConfirmed: true,
        };
      }
      return row;
    });

    setParseResult({
      ...parseResult,
      draftRows: updatedDrafts,
      unmappedFieldsCount: updatedDrafts.filter((r) => !r.unitId).length,
    });
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
          unitId: targetUnit?.id || row.unitId,
          unitName: targetUnit?.name || row.unitName,
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

  const sortedDraftRows = useMemo(() => {
    if (!parseResult?.draftRows) return [];
    const rows = [...parseResult.draftRows];
    if (!sortKey) return rows;

    return rows.sort((a, b) => {
      let aVal: any = (a as any)[sortKey];
      let bVal: any = (b as any)[sortKey];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal, 'vi') : bVal.localeCompare(aVal, 'vi');
      }
      aVal = aVal || 0;
      bVal = bVal || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [parseResult?.draftRows, sortKey, sortDirection]);

  // Grand totals across all draft rows for the header total row
  const previewGrandTotals = useMemo(() => {
    if (!parseResult?.draftRows || parseResult.draftRows.length === 0) return null;
    const rows = parseResult.draftRows;
    const count = rows.length;
    const received_total = rows.reduce((s, r) => s + (r.received_total || 0), 0);
    const received_online = rows.reduce((s, r) => s + (r.received_online || 0), 0);
    const received_offline = rows.reduce((s, r) => s + (r.received_offline || 0), 0);
    const carried_forward = rows.reduce((s, r) => s + (r.carried_forward || 0), 0);
    const completed_total = rows.reduce((s, r) => s + (r.completed_total || 0), 0);
    const completed_early = rows.reduce((s, r) => s + (r.completed_early || 0), 0);
    const completed_on_time = rows.reduce((s, r) => s + (r.completed_on_time || 0), 0);
    const completed_late = rows.reduce((s, r) => s + (r.completed_late || 0), 0);
    const pending_total = rows.reduce((s, r) => s + (r.pending_total || 0), 0);
    const pending_on_time = rows.reduce((s, r) => s + (r.pending_on_time || 0), 0);
    const pending_late = rows.reduce((s, r) => s + (r.pending_late || 0), 0);

    const hasErrors = rows.some((r) => r.validationStatus === 'error' || !r.matchedFieldId);
    const hasWarnings = rows.some((r) => r.validationStatus === 'warning' || !r.unitId);

    return {
      count,
      received_total,
      received_online,
      received_offline,
      carried_forward,
      completed_total,
      completed_early,
      completed_on_time,
      completed_late,
      pending_total,
      pending_on_time,
      pending_late,
      hasErrors,
      hasWarnings,
    };
  }, [parseResult?.draftRows]);

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
        setImportError('Vui lòng chọn hoặc bấm "+ Tạo kỳ mới" để thiết lập kỳ báo cáo trước khi nhập số liệu.');
        return;
      }
    }

    if (!parseResult || !parseResult.draftRows || parseResult.draftRows.length === 0) {
      setImportError('Chưa có dữ liệu Excel hợp lệ để nhập số liệu. Vui lòng tải lại file Excel.');
      return;
    }

    const statusLabels: Record<string, string> = {
      submitted: 'Đã gửi duyệt',
      approved: 'Đã phê duyệt',
      locked: 'Đã khóa sổ',
      archived: 'Đã lưu trữ',
    };

    if (['submitted', 'approved', 'locked', 'archived'].includes(targetReport.status)) {
      setImportError(
        `Kỳ báo cáo "${targetReport.report_name || targetReport.report_code}" hiện ở trạng thái "${statusLabels[targetReport.status] || targetReport.status}". Không thể nhập thêm hoặc ghi đè số liệu vào kỳ này. Vui lòng chọn kỳ báo cáo ở trạng thái Dự thảo/Thẩm định hoặc bấm "+ Tạo kỳ mới".`
      );
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

        let effectiveUnitId = targetField.unit_id || row.unitId;

        if (!effectiveUnitId && allUnits.length > 0) {
          const matchedUnit = allUnits.find(
            (u) =>
              (u.name && targetField.name && (targetField.name.toLowerCase().includes(u.name.toLowerCase()) || u.name.toLowerCase().includes(targetField.name.toLowerCase()))) ||
              (u.name && targetField.linh_vuc && (targetField.linh_vuc.toLowerCase().includes(u.name.toLowerCase()) || u.name.toLowerCase().includes(targetField.linh_vuc.toLowerCase()))) ||
              (u.name && row.rawFieldName && (row.rawFieldName.toLowerCase().includes(u.name.toLowerCase()) || u.name.toLowerCase().includes(row.rawFieldName.toLowerCase())))
          );
          const defaultUnit = matchedUnit || allUnits.find((u) => u.name.toLowerCase().includes('văn phòng')) || allUnits[0];
          effectiveUnitId = defaultUnit.id;
        }

        if (!effectiveUnitId) {
          throw new Error(
            `Dòng ${row.rowNumber} ("${targetField.name}"): Thủ tục/Lĩnh vực chưa được phân công Đơn vị giải quyết và không tìm thấy Đơn vị hợp lệ trong CSDL.`
          );
        }

        const assignedUnit = allUnits.find((u) => u.id === effectiveUnitId);
        if (!assignedUnit) {
          throw new Error(
            `Dòng ${row.rowNumber} ("${targetField.name}"): Đơn vị giải quyết (ID "${effectiveUnitId}") không tồn tại trong CSDL (public.units).`
          );
        }

        if (!targetField.unit_id && effectiveUnitId) {
          targetField.unit_id = effectiveUnitId;
          void store.saveField({ ...targetField, unit_id: effectiveUnitId }).catch((err) => {
            console.warn('Tự động cập nhật unit_id cho field thất bại:', err);
          });
        }

        const fieldName = resolveLinhVuc(row.matchedFieldName || row.rawFieldName, fieldId, allFields);

        return {
          ...row,
          matchedFieldId: fieldId,
          matchedFieldName: fieldName,
          unitId: effectiveUnitId,
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

      // Verify CSDL saved stats
      const savedStatsInDb = await store.fetchStatsByReport(targetReport.id);
      if (savedStatsInDb.length === 0) {
        throw new Error(
          'Xác nhận lưu CSDL thất bại: Không có dòng số liệu nào được lưu vào CSDL.'
        );
      }
      totalSaved = savedStatsInDb.length;

      // BƯỚC 3: Recalculate indicators & update status safely following lifecycle
      setImportStatusText('Đang tính các chỉ tiêu...');
      const hasErrors = preparedRows.some((r) => r.validationStatus === 'error');
      await store.recalculateAndPersistReportIndicators(targetReport.id);

      setImportStatusText('Đang hoàn tất...');

      // Cập nhật trạng thái tuần tự theo đúng quy trình nghiệp vụ (chỉ chuyển tiếp khi cần)
      const currentStatus = targetReport.status;
      try {
        if (currentStatus === 'draft') {
          await store.updateReportStatus(targetReport.id, 'imported');
          if (!hasErrors) {
            await store.updateReportStatus(targetReport.id, 'validated');
          }
        } else if (currentStatus === 'imported') {
          if (!hasErrors) {
            await store.updateReportStatus(targetReport.id, 'validated');
          }
        }
        // Nếu kỳ báo cáo đã ở trạng thái 'validated' thì giữ nguyên, không chuyển lùi
      } catch (statusErr) {
        console.warn('Cập nhật trạng thái kỳ báo cáo:', statusErr);
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
      setImportError(getFriendlyErrorMessage(err, 'Đã xảy ra lỗi trong quá trình lưu số liệu Excel vào hệ thống. Vui lòng kiểm tra lại.'));
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

        {urlReportId && selectedReport && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đã tự động liên kết kỳ báo cáo: <strong>{selectedReport.report_code}</strong> - <em>"{selectedReport.report_name}"</em>. Vui lòng tải file Excel lên để tiếp tục bóc tách và nạp số liệu.
            </span>
          </div>
        )}
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
                  Tạo và Chọn kỳ này
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {importError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-3 text-rose-800 text-xs shadow-xs">
          <div className="flex items-start gap-2.5 flex-1">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-900 block text-xs">
                Thông báo nhập dữ liệu:
              </span>
              <p className="whitespace-pre-line leading-relaxed text-xs text-rose-800">
                {importError}
              </p>
              {(importError.includes('kỳ báo cáo') || importError.includes('trạng thái') || importError.includes('Khóa sổ')) && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateReportModal(true);
                      setImportError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo kỳ báo cáo mới ngay</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="text-rose-400 hover:text-rose-700 transition-colors shrink-0 p-1 rounded-md hover:bg-rose-100"
            title="Đóng thông báo"
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

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {parseResult.validRowsCount} Hợp lệ
              </span>
              {parseResult.errorRowsCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {parseResult.errorRowsCount} Lỗi công thức
                </span>
              )}
              {parseResult.warningRowsCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {parseResult.warningRowsCount} Cảnh báo lệch
                </span>
              )}
              {parseResult.unmappedFieldsCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                  {parseResult.unmappedFieldsCount} Chưa gán đơn vị
                </span>
              )}

              {(parseResult.errorRowsCount > 0 || parseResult.warningRowsCount > 0) && (
                <button
                  type="button"
                  onClick={handleAutoFixAllRows}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Tự động tính lại các cột tổng theo các cột chi tiết để loại bỏ toàn bộ sai lệch"
                >
                  <Wand2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tự động cân bằng tất cả</span>
                </button>
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
                Hủy và Tải lại
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

          {/* Alert Success / Notice Banner */}
          {autoFixSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{autoFixSuccessMsg}</span>
            </div>
          )}

          {/* Help Notice on Errors */}
          {(parseResult.errorRowsCount > 0 || parseResult.warningRowsCount > 0) && !autoFixSuccessMsg && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Hệ thống phát hiện <strong>{parseResult.errorRowsCount + parseResult.warningRowsCount} dòng</strong> có sự chênh lệch giữa số tổng và các chỉ tiêu chi tiết. 
                  Nhấp vào nút <strong>"Lỗi"</strong> hoặc <strong>"Lệch"</strong> tại từng dòng để xem công thức chi tiết, hoặc bấm <strong>"Tự động cân bằng tất cả"</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleAutoFixAllRows}
                className="shrink-0 px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
              >
                Sửa nhanh tất cả
              </button>
            </div>
          )}

          {/* Detailed Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Bảng thẩm định chi tiết trước khi lưu ({sortedDraftRows.length} dòng số liệu)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Đã tự động loại bỏ dòng TỔNG CỘNG và dòng tiêu đề • Nguồn dữ liệu được gom nhóm phân tách
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                Nhấp vào tiêu đề cột để sắp xếp
              </span>
            </div>

            <div className="overflow-x-auto max-h-[620px]">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-20 shadow-xs border-b border-slate-300 select-none bg-white">
                  {/* Row 1: Nhóm cấp 1 */}
                  <tr>
                    <th
                      rowSpan={3}
                      onClick={() => handleSort('rowNumber')}
                      className="cursor-pointer select-none bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 p-2 font-bold text-center w-12 text-[11px] transition-colors"
                      title="Sắp xếp theo Số thứ tự"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>TT</span>
                        {sortKey === 'rowNumber' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>

                    <th
                      rowSpan={3}
                      onClick={() => handleSort('rawFieldName')}
                      className="cursor-pointer select-none bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 p-2 font-bold text-left min-w-[200px] text-[11px] transition-colors"
                      title="Sắp xếp theo Lĩnh vực"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Lĩnh vực</span>
                        {sortKey === 'rawFieldName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>

                    <th
                      rowSpan={3}
                      onClick={() => handleSort('unitName')}
                      className="cursor-pointer select-none bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 p-2 font-bold text-left min-w-[150px] text-[11px] transition-colors"
                      title="Sắp xếp theo Đơn vị suy ra"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Đơn vị suy ra</span>
                        {sortKey === 'unitName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>

                    {/* Nhóm 1: Số hồ sơ tiếp nhận (Xanh lá) */}
                    <th
                      colSpan={4}
                      className="bg-[#c8e6c9] text-[#1b5e20] border border-slate-300 font-bold text-center py-2 px-3 text-xs uppercase tracking-wide"
                    >
                      Số hồ sơ tiếp nhận
                    </th>

                    {/* Nhóm 2: Số lượng hồ sơ đã giải quyết (Vàng cam) */}
                    <th
                      colSpan={4}
                      className="bg-[#ffecb3] text-[#b78103] border border-slate-300 font-bold text-center py-2 px-3 text-xs uppercase tracking-wide"
                    >
                      Số lượng hồ sơ đã giải quyết
                    </th>

                    {/* Nhóm 3: Số lượng hồ sơ đang giải quyết (Xanh dương) */}
                    <th
                      colSpan={3}
                      className="bg-[#bbdefb] text-[#0d47a1] border border-slate-300 font-bold text-center py-2 px-3 text-xs uppercase tracking-wide"
                    >
                      Số lượng hồ sơ đang giải quyết
                    </th>

                    <th
                      rowSpan={3}
                      onClick={() => handleSort('validationStatus')}
                      className="cursor-pointer select-none bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 p-2 font-bold text-center min-w-[90px] text-[11px] transition-colors"
                      title="Sắp xếp theo Trạng thái"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Trạng thái</span>
                        {sortKey === 'validationStatus' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  </tr>

                  {/* Row 2: Nhóm con cấp 2 */}
                  <tr>
                    {/* Dưới Số hồ sơ tiếp nhận */}
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('received_total')}
                      className="cursor-pointer select-none bg-[#e8f5e9] hover:bg-[#dcedc8] text-[#2e7d32] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Tổng tiếp nhận"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Tổng số</span>
                        {sortKey === 'received_total' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      colSpan={2}
                      className="bg-[#e8f5e9] text-[#2e7d32] border border-slate-300 py-1 px-2 font-bold text-center text-[11px]"
                    >
                      Trong kỳ
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('carried_forward')}
                      className="cursor-pointer select-none bg-[#e8f5e9] hover:bg-[#dcedc8] text-[#2e7d32] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Từ kỳ trước"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Từ kỳ trước</span>
                        {sortKey === 'carried_forward' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Dưới Số lượng hồ sơ đã giải quyết */}
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('completed_total')}
                      className="cursor-pointer select-none bg-[#fff8e1] hover:bg-[#ffecb3] text-[#b78103] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Tổng đã giải quyết"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Tổng số</span>
                        {sortKey === 'completed_total' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('completed_early')}
                      className="cursor-pointer select-none bg-[#fff8e1] hover:bg-[#ffecb3] text-[#b78103] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Trước hạn"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Trước hạn</span>
                        {sortKey === 'completed_early' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('completed_on_time')}
                      className="cursor-pointer select-none bg-[#fff8e1] hover:bg-[#ffecb3] text-[#b78103] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Đúng hạn"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Đúng hạn</span>
                        {sortKey === 'completed_on_time' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('completed_late')}
                      className="cursor-pointer select-none bg-[#fff8e1] hover:bg-[#ffecb3] text-[#b78103] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Quá hạn"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Quá hạn</span>
                        {sortKey === 'completed_late' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Dưới Số lượng hồ sơ đang giải quyết */}
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('pending_total')}
                      className="cursor-pointer select-none bg-[#e3f2fd] hover:bg-[#bbdefb] text-[#1565c0] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Tổng đang giải quyết (Tồn)"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Tổng số</span>
                        {sortKey === 'pending_total' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('pending_on_time')}
                      className="cursor-pointer select-none bg-[#e3f2fd] hover:bg-[#bbdefb] text-[#1565c0] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Đang trong hạn"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Trong hạn</span>
                        {sortKey === 'pending_on_time' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('pending_late')}
                      className="cursor-pointer select-none bg-[#e3f2fd] hover:bg-[#bbdefb] text-[#1565c0] border border-slate-300 p-1.5 font-bold text-center text-[11px] transition-colors"
                      title="Đang quá hạn"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Quá hạn</span>
                        {sortKey === 'pending_late' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                  </tr>

                  {/* Row 3: Chi tiết Trong kỳ */}
                  <tr>
                    <th
                      onClick={() => handleSort('received_online')}
                      className="cursor-pointer select-none bg-[#f1f8e9] hover:bg-[#dcedc8] text-[#33691e] border border-slate-300 p-1 font-bold text-center text-[10.5px] transition-colors"
                      title="Tiếp nhận trực tuyến"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Trực tuyến</span>
                        {sortKey === 'received_online' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('received_offline')}
                      className="cursor-pointer select-none bg-[#f1f8e9] hover:bg-[#dcedc8] text-[#33691e] border border-slate-300 p-1 font-bold text-center text-[10.5px] transition-colors"
                      title="Trực tiếp / Dịch vụ bưu chính"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Trực tiếp / Bưu chính</span>
                        {sortKey === 'received_offline' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {/* DÒNG TỔNG CỘNG BÊN DƯỚI TIÊU ĐỀ BẢNG (GRAND TOTALS ROW) */}
                  {previewGrandTotals && (
                    <tr className="bg-amber-100/95 hover:bg-amber-100 font-bold text-slate-900 border-b-2 border-amber-300 text-xs shadow-2xs">
                      <td className="p-2 text-center bg-amber-200/80 border-r border-amber-300 font-black text-slate-800">
                        —
                      </td>
                      <td colSpan={2} className="p-2 bg-amber-200/80 border-r border-amber-300 font-black text-amber-950 uppercase tracking-wider font-sans">
                        <div className="flex items-center justify-between">
                          <span>TỔNG CỘNG</span>
                          <span className="text-[10px] font-semibold text-amber-900 normal-case bg-amber-300/80 px-2 py-0.5 rounded shadow-2xs">
                            {previewGrandTotals.count} dòng số liệu
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-slate-950 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.received_total)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-blue-900 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.received_online)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-slate-900 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.received_offline)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-amber-950 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.carried_forward)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-amber-950 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.completed_total)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-amber-950 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.completed_early)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-amber-950 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.completed_on_time)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 bg-amber-100 font-mono">
                        {previewGrandTotals.completed_late > 0 ? (
                          <span className="text-rose-700 font-black">{formatNumber(previewGrandTotals.completed_late)}</span>
                        ) : (
                          <span className="text-slate-500 font-normal">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-blue-950 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.pending_total)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 text-blue-950 bg-amber-100 font-mono">
                        {formatNumber(previewGrandTotals.pending_on_time)}
                      </td>
                      <td className="p-2 text-right font-black border-r border-amber-300 bg-amber-100 font-mono">
                        {previewGrandTotals.pending_late > 0 ? (
                          <span className="text-rose-700 font-black">{formatNumber(previewGrandTotals.pending_late)}</span>
                        ) : (
                          <span className="text-slate-500 font-normal">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center font-black border border-amber-300 bg-amber-200/80">
                        {previewGrandTotals.hasErrors ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                            <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" /> Có lỗi
                          </span>
                        ) : previewGrandTotals.hasWarnings ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Cảnh báo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> Chuẩn
                          </span>
                        )}
                      </td>
                    </tr>
                  )}

                  {sortedDraftRows.map((row, idx) => {
                    const isError = row.validationStatus === 'error';
                    const isWarning = row.validationStatus === 'warning' || !row.unitId;
                    const prevRow = idx > 0 ? sortedDraftRows[idx - 1] : null;
                    const showSourceSeparator = !sortKey && (!prevRow || prevRow.sourceName !== row.sourceName);

                    return (
                      <React.Fragment key={row.rowNumber}>
                        {/* Thanh phân tách Nguồn dữ liệu */}
                        {showSourceSeparator && (
                          <tr className="bg-slate-100 border-y-2 border-slate-300 font-bold text-slate-800">
                            <td colSpan={15} className="py-2 px-3 bg-slate-200/80">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-blue-700 shrink-0" />
                                <span className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold">
                                  Nguồn dữ liệu:
                                </span>
                                <span className="text-xs text-blue-900 bg-white border border-blue-200 px-2.5 py-0.5 rounded shadow-2xs font-bold">
                                  {row.sourceName}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}

                        <tr
                          className={`hover:brightness-95 transition-colors border-b border-slate-200 ${
                            isError ? 'bg-rose-50/60' : isWarning ? 'bg-amber-50/50' : 'bg-white'
                          }`}
                        >
                          {/* TT */}
                          <td className="p-2 text-center text-slate-500 font-mono text-[11px] border-r border-slate-200">
                            {row.rowNumber}
                          </td>

                          {/* Lĩnh vực gốc */}
                          <td className="p-2 text-slate-900 font-semibold border-r border-slate-200">
                            {row.rawFieldName}
                          </td>

                          {/* Đơn vị suy ra kèm quick selection */}
                          <td className="p-2 text-slate-700 font-medium border-r border-slate-200">
                            <select
                              value={row.unitId || ''}
                              onChange={(e) => handleUnitMapChange(row.rowNumber, e.target.value)}
                              className="w-full text-[11px] bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Nhóm: Số hồ sơ tiếp nhận (Màu nền xanh lá nhạt theo Tổng quan) */}
                          <td className={`p-2 text-right font-mono font-bold border-r border-slate-200 bg-[#EAF5EE]/80 ${row.hasDifference ? 'text-amber-700' : 'text-slate-900'}`}>
                            {formatNumber(row.received_total)}
                            {row.recalculatedReceived !== row.received_total && (
                              <span className="block text-[9.5px] text-amber-600 font-normal">
                                Lệch: {row.recalculatedReceived - row.received_total > 0 ? '+' : ''}{row.recalculatedReceived - row.received_total}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono text-blue-700 font-medium border-r border-slate-200 bg-[#F1F8F4]/80">
                            {formatNumber(row.received_online)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-200 bg-[#F1F8F4]/80">
                            {formatNumber(row.received_offline)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-200 bg-[#EAF5EE]/80">
                            {formatNumber(row.carried_forward)}
                          </td>

                          {/* Nhóm: Số lượng hồ sơ đã giải quyết (Màu nền vàng nhạt theo Tổng quan) */}
                          <td className="p-2 text-right font-mono font-bold text-amber-900 border-r border-slate-200 bg-[#FEF6DC]/80">
                            {formatNumber(row.completed_total)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-200 bg-[#FFFBF0]/80">
                            {formatNumber(row.completed_early)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-200 bg-[#FFFBF0]/80">
                            {formatNumber(row.completed_on_time)}
                          </td>
                          <td className="p-2 text-right font-mono border-r border-slate-200 bg-[#FFFBF0]/80">
                            {row.completed_late > 0 ? (
                              <span className="text-rose-600 font-bold">{formatNumber(row.completed_late)}</span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>

                          {/* Nhóm: Số lượng hồ sơ đang giải quyết (Màu nền xanh dương nhạt theo Tổng quan) */}
                          <td className="p-2 text-right font-mono font-bold text-blue-900 border-r border-slate-200 bg-[#E7F1FF]/80">
                            {formatNumber(row.pending_total)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-200 bg-[#F2F7FF]/80">
                            {formatNumber(row.pending_on_time)}
                          </td>
                          <td className="p-2 text-right font-mono border-r border-slate-200 bg-[#F2F7FF]/80">
                            {row.pending_late > 0 ? (
                              <span className="text-rose-600 font-bold">{formatNumber(row.pending_late)}</span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>

                          {/* Trạng thái thẩm định */}
                          <td className="p-2 text-center border-r border-slate-200 bg-slate-50/50">
                            {isError ? (
                              <button
                                type="button"
                                onClick={() => setInspectRow(row)}
                                className="inline-flex items-center gap-1.5 text-rose-700 font-bold text-[11px] bg-rose-100 hover:bg-rose-200 active:bg-rose-300 px-2.5 py-1 rounded-md border border-rose-300 transition-all shadow-2xs cursor-pointer group"
                                title="Nhấp để xem chi tiết sai lệch và sửa nhanh"
                              >
                                <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 group-hover:scale-110 transition-transform" />
                                <span>Lỗi ({row.validationErrors?.length || 1})</span>
                                <Info className="w-3 h-3 text-rose-500 opacity-70 group-hover:opacity-100" />
                              </button>
                            ) : isWarning ? (
                              <button
                                type="button"
                                onClick={() => setInspectRow(row)}
                                className="inline-flex items-center gap-1.5 text-amber-800 font-bold text-[11px] bg-amber-100 hover:bg-amber-200 active:bg-amber-300 px-2.5 py-1 rounded-md border border-amber-300 transition-all shadow-2xs cursor-pointer group"
                                title="Nhấp để xem chi tiết sai lệch"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 group-hover:scale-110 transition-transform" />
                                <span>{!row.unitId ? 'Chưa gán' : 'Lệch'}</span>
                                <Info className="w-3 h-3 text-amber-600 opacity-70 group-hover:opacity-100" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setInspectRow(row)}
                                className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md border border-emerald-300 transition-all shadow-2xs cursor-pointer"
                                title="Nhấp để xem chi tiết công thức đối chiếu"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                <span>Chuẩn</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CHI TIẾT THẨM ĐỊNH & ĐỐI CHIẾU CÔNG THỨC DIALOG MODAL */}
          {inspectRow && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-8">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                      inspectRow.validationStatus === 'error'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                        : inspectRow.validationStatus === 'warning' || !inspectRow.unitId
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    }`}>
                      {inspectRow.validationStatus === 'error' ? (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      ) : inspectRow.validationStatus === 'warning' || !inspectRow.unitId ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">
                        Thẩm định chi tiết dòng số {inspectRow.rowNumber}: <span className="text-blue-300">{inspectRow.rawFieldName}</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Nguồn: <strong className="text-slate-200">{inspectRow.sourceName}</strong> • Đơn vị: <strong className="text-slate-200">{inspectRow.unitName || 'Chưa gán'}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectRow(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    inspectRow.validationStatus === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : inspectRow.validationStatus === 'warning' || !inspectRow.unitId
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="mt-0.5 shrink-0">
                      {inspectRow.validationStatus === 'error' ? (
                        <XCircle className="w-5 h-5 text-rose-600" />
                      ) : inspectRow.validationStatus === 'warning' || !inspectRow.unitId ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-sm">
                        {inspectRow.validationStatus === 'error'
                          ? `Phát hiện ${inspectRow.validationErrors?.length || 1} sai lệch công thức toán học`
                          : !inspectRow.unitId
                          ? 'Cảnh báo: Dòng này chưa được gán Đơn vị suy ra'
                          : 'Tất cả 4 công thức toán học đều khớp hoàn hảo'}
                      </p>
                      <p className="text-[11.5px] opacity-90 leading-relaxed">
                        {inspectRow.validationStatus === 'error'
                          ? 'Dữ liệu tại các cột tổng số trên file Excel không khớp với tổng các cột thành phần chi tiết. Bạn có thể bấm nút "Tự động sửa theo số chi tiết" bên dưới để cân bằng lại ngay.'
                          : 'Các số liệu tiếp nhận, đã giải quyết, đang giải quyết và cân bằng toàn chu trình đạt chuẩn 100%.'}
                      </p>
                    </div>
                  </div>

                  {/* 4 Formula Checks Detailed Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-blue-600" />
                      <span>Đối chiếu 4 phương trình nghiệp vụ</span>
                    </h4>

                    <div className="space-y-3 text-xs">
                      {/* 1. Tiếp nhận */}
                      {(() => {
                        const sumRec = inspectRow.received_online + inspectRow.received_offline + inspectRow.carried_forward;
                        const isMatch = inspectRow.received_total === sumRec;
                        const diff = sumRec - inspectRow.received_total;
                        return (
                          <div className={`p-3.5 rounded-xl border ${isMatch ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/70 border-rose-200'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>1. Công thức Tiếp nhận</span>
                                {isMatch ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">Khớp</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">Lệch {diff > 0 ? `+${diff}` : diff}</span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                [Tổng TN] = [Trực tuyến] + [Trực tiếp] + [Từ kỳ trước]
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11.5px] pt-1 border-t border-slate-200/60 font-mono">
                              <div>
                                <span className="text-slate-500">Số tổng trên file: </span>
                                <strong className={isMatch ? 'text-slate-800' : 'text-rose-700 font-bold'}>{formatNumber(inspectRow.received_total)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Tính từ chi tiết: </span>
                                <strong className="text-blue-700">{formatNumber(inspectRow.received_online)} + {formatNumber(inspectRow.received_offline)} + {formatNumber(inspectRow.carried_forward)} = {formatNumber(sumRec)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. Đã giải quyết */}
                      {(() => {
                        const sumComp = inspectRow.completed_early + inspectRow.completed_on_time + inspectRow.completed_late;
                        const isMatch = inspectRow.completed_total === sumComp;
                        const diff = sumComp - inspectRow.completed_total;
                        return (
                          <div className={`p-3.5 rounded-xl border ${isMatch ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/70 border-rose-200'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>2. Công thức Đã giải quyết</span>
                                {isMatch ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">Khớp</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">Lệch {diff > 0 ? `+${diff}` : diff}</span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                [Tổng đã GQ] = [Trước hạn] + [Đúng hạn] + [Quá hạn]
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11.5px] pt-1 border-t border-slate-200/60 font-mono">
                              <div>
                                <span className="text-slate-500">Số tổng trên file: </span>
                                <strong className={isMatch ? 'text-slate-800' : 'text-rose-700 font-bold'}>{formatNumber(inspectRow.completed_total)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Tính từ chi tiết: </span>
                                <strong className="text-emerald-700">{formatNumber(inspectRow.completed_early)} + {formatNumber(inspectRow.completed_on_time)} + {formatNumber(inspectRow.completed_late)} = {formatNumber(sumComp)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 3. Đang giải quyết */}
                      {(() => {
                        const sumPend = inspectRow.pending_on_time + inspectRow.pending_late;
                        const isMatch = inspectRow.pending_total === sumPend;
                        const diff = sumPend - inspectRow.pending_total;
                        return (
                          <div className={`p-3.5 rounded-xl border ${isMatch ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/70 border-rose-200'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>3. Công thức Đang giải quyết</span>
                                {isMatch ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">Khớp</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">Lệch {diff > 0 ? `+${diff}` : diff}</span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                [Tổng đang GQ] = [Trong hạn] + [Quá hạn]
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11.5px] pt-1 border-t border-slate-200/60 font-mono">
                              <div>
                                <span className="text-slate-500">Số tổng trên file: </span>
                                <strong className={isMatch ? 'text-slate-800' : 'text-rose-700 font-bold'}>{formatNumber(inspectRow.pending_total)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Tính từ chi tiết: </span>
                                <strong className="text-blue-700">{formatNumber(inspectRow.pending_on_time)} + {formatNumber(inspectRow.pending_late)} = {formatNumber(sumPend)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 4. Cân bằng toàn chu trình */}
                      {(() => {
                        const sumCompPend = inspectRow.completed_total + inspectRow.pending_total;
                        const isMatch = inspectRow.received_total === sumCompPend;
                        const diff = inspectRow.received_total - sumCompPend;
                        return (
                          <div className={`p-3.5 rounded-xl border ${isMatch ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/70 border-amber-200'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>4. Cân bằng toàn chu trình</span>
                                {isMatch ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">Cân bằng</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">Chênh {diff > 0 ? `+${diff}` : diff}</span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                [Tổng tiếp nhận] = [Tổng đã giải quyết] + [Tổng đang giải quyết]
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11.5px] pt-1 border-t border-slate-200/60 font-mono">
                              <div>
                                <span className="text-slate-500">Tổng tiếp nhận: </span>
                                <strong className="text-slate-900">{formatNumber(inspectRow.received_total)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Đã GQ + Đang GQ: </span>
                                <strong className={isMatch ? 'text-emerald-700' : 'text-amber-800'}>{formatNumber(inspectRow.completed_total)} + {formatNumber(inspectRow.pending_total)} = {formatNumber(sumCompPend)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* List of validation errors with description */}
                  {inspectRow.validationErrors && inspectRow.validationErrors.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Thông báo chi tiết từ bộ kiểm tra ({inspectRow.validationErrors.length})
                      </h4>
                      <ul className="space-y-1.5 text-[11.5px] text-slate-700">
                        {inspectRow.validationErrors.map((err, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{err.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectRow(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Đóng cửa sổ
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAutoFixRow(inspectRow.rowNumber)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>Tự động sửa theo số chi tiết</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
              <span>Chi tiết Báo cáo và Thẩm định</span>
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
