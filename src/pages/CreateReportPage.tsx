import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { store } from '../services/store';
import { Report, ReportPeriodType } from '../types/database';
import {
  FilePlus,
  ArrowRight,
  ArrowLeft,
  Info,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

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

const calculatePeriodDefaults = (pt?: ReportPeriodType, baseDate: Date = new Date()) => {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1;
  const monthStr = padZero(currentMonth);

  if (!pt) {
    return {
      start: `${currentYear}-01-01`,
      end: getLocalDateString(baseDate),
      code: `BC-${currentYear}`,
    };
  }

  const codeUpper = (pt.code || '').toUpperCase();
  const freqUpper = (pt.frequency || '').toUpperCase();

  if (
    codeUpper.includes('MONTH') ||
    (freqUpper.includes('THÁNG') && !freqUpper.includes('6') && !freqUpper.includes('9'))
  ) {
    return {
      start: `${currentYear}-${monthStr}-01`,
      end: getLocalDateString(baseDate),
      code: `BC-${currentYear}-${monthStr}`,
    };
  }
  if (codeUpper.includes('QUART') || freqUpper.includes('QUÝ')) {
    const q = Math.floor(baseDate.getMonth() / 3) + 1;
    const qStartMonth = padZero((q - 1) * 3 + 1);
    return {
      start: `${currentYear}-${qStartMonth}-01`,
      end: getLocalDateString(baseDate),
      code: `BC-${currentYear}-Q${q}`,
    };
  }
  if (codeUpper.includes('YEAR') || freqUpper.includes('NĂM')) {
    return {
      start: `${currentYear}-01-01`,
      end: getLocalDateString(baseDate),
      code: `BC-${currentYear}`,
    };
  }
  if (codeUpper.includes('WEEK') || freqUpper.includes('TUẦN')) {
    const d = new Date(baseDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: getLocalDateString(monday),
      end: getLocalDateString(sunday),
      code: `BC-${currentYear}-W${Math.ceil(baseDate.getDate() / 7)}`,
    };
  }
  if (codeUpper.includes('HALF') || freqUpper.includes('6 THÁNG')) {
    return {
      start: `${currentYear}-01-01`,
      end: `${currentYear}-06-30`,
      code: `BC-${currentYear}-6T`,
    };
  }
  if (codeUpper.includes('NINE') || freqUpper.includes('9 THÁNG')) {
    return {
      start: `${currentYear}-01-01`,
      end: `${currentYear}-09-30`,
      code: `BC-${currentYear}-9T`,
    };
  }
  return {
    start: `${currentYear}-01-01`,
    end: getLocalDateString(baseDate),
    code: `BC-${pt.code}-${currentYear}`,
  };
};

export const CreateReportPage: React.FC = () => {
  const navigate = useNavigate();

  // Load ONLY active period types from Danh mục Loại kỳ báo cáo
  const [periodTypes, setPeriodTypes] = useState<ReportPeriodType[]>(() => {
    const list = store.getPeriodTypes();
    const activeList = list.filter((pt) => pt.active !== false);
    return activeList.length > 0 ? activeList : list;
  });

  useEffect(() => {
    const refresh = () => {
      const list = store.getPeriodTypes();
      const activeList = list.filter((pt) => pt.active !== false);
      setPeriodTypes(activeList.length > 0 ? activeList : list);
    };
    return store.subscribe(refresh);
  }, []);

  const now = useMemo(() => new Date(), []);
  const currentYear = useMemo(() => now.getFullYear(), [now]);

  // Initial selected period type from catalog
  const initialPeriodType = useMemo(() => {
    return (
      periodTypes.find((t) => t.code.toUpperCase().includes('MONTH')) ||
      periodTypes.find((t) => t.code.toUpperCase().includes('YEAR')) ||
      periodTypes[0]
    );
  }, [periodTypes]);

  const initialDefaults = useMemo(
    () => calculatePeriodDefaults(initialPeriodType, now),
    [initialPeriodType, now]
  );

  const [selectedPeriodTypeCode, setSelectedPeriodTypeCode] = useState<string>(
    initialPeriodType?.code || 'MONTHLY'
  );

  const selectedPeriodType = useMemo(() => {
    return (
      periodTypes.find(
        (pt) => pt.code === selectedPeriodTypeCode || pt.id === selectedPeriodTypeCode
      ) ||
      initialPeriodType ||
      periodTypes[0]
    );
  }, [periodTypes, selectedPeriodTypeCode, initialPeriodType]);

  // Track if user has manually typed in the report name
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<{
    report_code: string;
    report_name: string;
    report_type: Report['report_type'];
    period_start: string;
    period_end: string;
    data_as_of: string;
    notes: string;
  }>({
    report_code: initialDefaults.code,
    report_name: generateDefaultReportName(initialDefaults.start, initialDefaults.end),
    report_type: (initialPeriodType?.code || 'monthly') as any,
    period_start: initialDefaults.start,
    period_end: initialDefaults.end,
    data_as_of: getLocalDateTimeString(now),
    notes: '',
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

  // Change Period Type (Strictly restricted to Danh mục Loại kỳ báo cáo)
  const handleReportTypeChange = (newCode: string) => {
    setSelectedPeriodTypeCode(newCode);
    const targetPt = periodTypes.find((pt) => pt.code === newCode || pt.id === newCode);
    if (targetPt) {
      const defaults = calculatePeriodDefaults(targetPt, now);
      setFormData((prev) => {
        const updated = {
          ...prev,
          report_type: targetPt.code as any,
          period_start: defaults.start,
          period_end: defaults.end,
          report_code: defaults.code,
        };
        if (!isNameManuallyEdited) {
          updated.report_name = generateDefaultReportName(defaults.start, defaults.end);
        }
        return updated;
      });
    }
  };

  // Submit and immediately navigate to Giao diện Nhập liệu
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = formData.report_code.trim().toUpperCase();
    const cleanName = formData.report_name.trim();

    if (!cleanCode) {
      setErrorMessage('Vui lòng nhập Mã kỳ báo cáo (ví dụ: BC-2026-09).');
      return;
    }
    if (!cleanName) {
      setErrorMessage('Vui lòng nhập Tên kỳ báo cáo chi tiết.');
      return;
    }
    if (formData.period_start && formData.period_end && formData.period_start > formData.period_end) {
      setErrorMessage('Ngày kết thúc kỳ báo cáo phải lớn hơn hoặc bằng Ngày bắt đầu.');
      return;
    }

    // Check duplicate code
    const existingReports = store.getReports();
    if (existingReports.some((r) => r.report_code.toUpperCase() === cleanCode)) {
      setErrorMessage(`Mã kỳ báo cáo "${cleanCode}" đã tồn tại trên hệ thống. Vui lòng đặt mã khác (ví dụ: ${cleanCode}-V2 hoặc ${cleanCode}-01).`);
      return;
    }

    setIsCreatingReport(true);
    try {
      // Create report in store (with automatic local & remote persistence)
      const newRep = await store.createReport({
        ...formData,
        report_code: cleanCode,
        report_name: cleanName,
        report_type: (selectedPeriodType?.code || formData.report_type) as any,
        period_start: formData.period_start,
        period_end: formData.period_end,
        data_as_of: formData.data_as_of,
        notes: formData.notes,
      });

      // Navigate to Giao diện Nhập liệu immediately
      navigate(`/import?reportId=${encodeURIComponent(newRep.id)}`);
    } catch (err: any) {
      console.error('Lỗi khi tạo báo cáo:', err);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi tạo kỳ báo cáo. Vui lòng thử lại.');
    } finally {
      setIsCreatingReport(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Top Header & Breadcrumbs Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 shadow-xs">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
              <span>Cập nhật báo cáo</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link to="/reports" className="hover:text-blue-600 transition-colors">
                Kỳ báo cáo
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-blue-600 font-semibold">Tạo mới</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Khởi tạo kỳ Báo cáo mới
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Hủy và Quay lại</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const form = document.getElementById('create-report-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            disabled={isCreatingReport}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isCreatingReport ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span>Tạo kỳ báo cáo và Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message if any */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Formatted as 1 Unified Column */}
      <form
        id="create-report-form"
        onSubmit={handleCreateReport}
        className="space-y-5"
      >
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Loại kỳ báo cáo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Loại kỳ báo cáo <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedPeriodTypeCode}
                onChange={(e) => handleReportTypeChange(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 shadow-2xs cursor-pointer"
              >
                {periodTypes.map((pt) => (
                  <option key={pt.id || pt.code} value={pt.code}>
                    {pt.name} ({pt.frequency || pt.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Mã Báo Cáo */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Mã kỳ báo cáo <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = calculatePeriodDefaults(selectedPeriodType, now);
                    setFormData((prev) => ({ ...prev, report_code: defaults.code }));
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  title="Tạo lại mã theo chu kỳ"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Mã chuẩn</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={formData.report_code}
                onChange={(e) =>
                  setFormData({ ...formData, report_code: e.target.value.toUpperCase() })
                }
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 shadow-2xs"
                placeholder="VD: BC-2026-09"
              />
            </div>

            {/* Thời điểm chốt số liệu */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Thời điểm chốt số liệu <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.data_as_of}
                onChange={(e) => setFormData({ ...formData, data_as_of: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Từ ngày */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Từ ngày <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.period_start}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 shadow-2xs"
              />
            </div>

            {/* Đến ngày */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Đến ngày <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.period_end}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 shadow-2xs"
              />
            </div>
          </div>

          {/* TÊN KỲ BÁO CÁO CHI TIẾT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Tên kỳ báo cáo chi tiết <span className="text-rose-500">*</span>
              </label>
              {isNameManuallyEdited && (
                <button
                  type="button"
                  onClick={() => {
                    setIsNameManuallyEdited(false);
                    setFormData((prev) => ({
                      ...prev,
                      report_name: generateDefaultReportName(prev.period_start, prev.period_end),
                    }));
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  title="Khôi phục tên tự động theo Từ ngày - Đến ngày"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Đặt lại tên tự động</span>
                </button>
              )}
            </div>
            <textarea
              rows={2}
              required
              value={formData.report_name}
              onChange={(e) => {
                setIsNameManuallyEdited(true);
                setFormData({ ...formData, report_name: e.target.value });
              }}
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 shadow-2xs leading-relaxed"
              placeholder="VD: Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC từ ngày ... đến ngày ..."
            />
          </div>

          {/* PHẦN 4: GHI CHÚ / THUYẾT MINH */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold text-slate-700">
              Ghi chú / Thuyết minh kỳ báo cáo
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 shadow-2xs leading-relaxed"
              placeholder="Nhập ghi chú, căn cứ văn bản chỉ đạo hoặc lưu ý số liệu kỳ này..."
            />
          </div>
        </div>

        {/* Form Footer Action Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="submit"
            disabled={isCreatingReport}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer min-w-[220px]"
          >
            {isCreatingReport ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang khởi tạo kỳ báo cáo...</span>
              </>
            ) : (
              <>
                <span>Tạo kỳ báo cáo và Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
