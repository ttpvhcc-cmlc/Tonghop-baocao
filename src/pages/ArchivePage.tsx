import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { store } from '../services/store';
import { formatNumber, formatDate, getStatusBadge } from '../utils/format';
import { exportReportToExcel, exportReportToCSV } from '../services/exportService';
import {
  Archive,
  Search,
  Download,
  Lock,
  Calendar,
  Eye,
  GitCompare,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react';

export const ArchivePage: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(store.getReports());
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Compare mode state
  const [compareReport1, setCompareReport1] = useState<string>('');
  const [compareReport2, setCompareReport2] = useState<string>('');

  // Extract years and months present in reports
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    reports.forEach((r) => {
      if (r.period_start) {
        years.add(r.period_start.slice(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (yearFilter !== 'ALL' && !r.period_start.startsWith(yearFilter)) return false;
      if (monthFilter !== 'ALL') {
        const m = r.period_start.slice(5, 7);
        if (m !== monthFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          r.report_code.toLowerCase().includes(q) ||
          r.report_name.toLowerCase().includes(q) ||
          (r.created_by && r.created_by.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [reports, search, yearFilter, monthFilter, statusFilter]);

  const handleExport = (reportId: string, type: 'excel' | 'csv') => {
    const rep = reports.find((r) => r.id === reportId);
    if (!rep) return;
    const stats = store.getStatsByReport(reportId);
    if (type === 'excel') {
      exportReportToExcel(rep, stats);
    } else {
      exportReportToCSV(rep, stats);
    }
  };

  const handleExecuteCompare = () => {
    if (!compareReport1 || !compareReport2) {
      alert('Vui lòng chọn 2 kỳ báo cáo lịch sử để tiến hành so sánh đối chiếu.');
      return;
    }
    if (compareReport1 === compareReport2) {
      alert('Vui lòng chọn 2 kỳ báo cáo khác nhau.');
      return;
    }
    navigate(`/analysis/compare?rep1=${compareReport1}&rep2=${compareReport2}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Kho Lưu Trữ Báo Cáo Lịch Sử & Hồ Sơ Đóng Băng
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu, kiểm tra bản chụp Snapshot của các kỳ báo cáo đã phê duyệt/khóa, tải tệp xuất lưu trữ và so sánh chéo giữa hai kỳ
          </p>
        </div>

        {/* Quick Compare Trigger Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <GitCompare className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">So sánh nhanh 2 kỳ:</span>
          <select
            value={compareReport1}
            onChange={(e) => setCompareReport1(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 max-w-[150px]"
          >
            <option value="">-- Kỳ thứ nhất --</option>
            {reports.map((r) => (
              <option key={`c1_${r.id}`} value={r.id}>
                {r.report_code} ({r.period_start.slice(0, 7)})
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">vs</span>
          <select
            value={compareReport2}
            onChange={(e) => setCompareReport2(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 max-w-[150px]"
          >
            <option value="">-- Kỳ thứ hai --</option>
            {reports.map((r) => (
              <option key={`c2_${r.id}`} value={r.id}>
                {r.report_code} ({r.period_start.slice(0, 7)})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExecuteCompare}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            So sánh <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Tìm kiếm từ khóa
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Mã báo cáo, tên kỳ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Năm lưu trữ
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả các năm</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Tháng báo cáo
          </label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả các tháng</option>
            {Array.from({ length: 12 }, (_, i) => {
              const val = String(i + 1).padStart(2, '0');
              return <option key={val} value={val}>Tháng {i + 1}</option>;
            })}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Trạng thái lưu trữ
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="locked">Đã khóa (Snapshot bất biến)</option>
            <option value="approved">Đã phê duyệt</option>
            <option value="archived">Lưu trữ chính thức</option>
            <option value="submitted">Đã trình duyệt</option>
            <option value="draft">Bản nháp</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Tìm thấy {filteredReports.length} báo cáo trong kho lưu trữ
          </span>
          <span className="text-xs text-slate-400">
            Báo cáo đã khóa được bảo vệ toàn vẹn không thể ghi đè
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Mã báo cáo</th>
                <th className="p-3">Tên kỳ báo cáo</th>
                <th className="p-3">Khoảng thời gian</th>
                <th className="p-3 text-right">Tổng tiếp nhận</th>
                <th className="p-3 text-right">Đã giải quyết</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3">Bảo vệ & Snapshot</th>
                <th className="p-3 text-right">Thao tác lưu trữ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.map((r) => {
                const badge = getStatusBadge(r.status);
                const stats = store.getStatsByReport(r.id);
                const recTotal = stats.reduce((sum, s) => sum + s.received_total, 0);
                const compTotal = stats.reduce((sum, s) => sum + s.completed_total, 0);
                const isLocked = r.status === 'locked' || r.status === 'archived';

                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600">
                      <Link to={`/reports/${r.id}`} className="hover:underline">
                        {r.report_code}
                      </Link>
                    </td>
                    <td className="p-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {isLocked && <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        <span>{r.report_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Người tạo: {r.created_by}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {formatDate(r.period_start)} → {formatDate(r.period_end)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-800">
                      {formatNumber(recTotal)}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                      {formatNumber(compTotal)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {isLocked ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Snapshot bất biến</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Bản nháp mở</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/reports/${r.id}`}
                          title="Xem chi tiết báo cáo"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleExport(r.id, 'excel')}
                          title="Tải tệp Excel lịch sử"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExport(r.id, 'csv')}
                          title="Tải tệp CSV lịch sử"
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Không tìm thấy báo cáo nào phù hợp với bộ lọc lưu trữ đã chọn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
