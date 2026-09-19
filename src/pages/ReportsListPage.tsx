import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { store } from '../services/store';
import { formatNumber, formatDate, getStatusBadge } from '../utils/format';
import { exportReportToExcel, exportReportToCSV } from '../services/exportService';
import {
  FileText,
  Plus,
  Search,
  Download,
  Lock,
  CheckCircle2,
  Calendar,
  Eye,
  Trash2,
  ShieldAlert,
  Edit3
} from 'lucide-react';

export const ReportsListPage: React.FC = () => {
  const [reports, setReports] = useState(store.getReports());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const currentUser = store.getCurrentUser();
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({
    report_code: '',
    report_name: '',
    report_type: 'monthly',
    period_start: '',
    period_end: '',
    data_as_of: '',
    notes: '',
  });

  const toDatetimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
  };

  const handleStartEdit = (rep: any) => {
    setEditingReport(rep);
    setEditFormData({
      report_code: rep.report_code,
      report_name: rep.report_name,
      report_type: rep.report_type,
      period_start: rep.period_start || '',
      period_end: rep.period_end || '',
      data_as_of: toDatetimeLocal(rep.data_as_of),
      notes: rep.notes || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    try {
      store.updateReport(editingReport.id, {
        ...editFormData,
        data_as_of: new Date(editFormData.data_as_of).toISOString(),
      });
      setEditingReport(null);
      setReports(store.getReports());
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật báo cáo');
    }
  };

  const handleDeleteReport = (reportId: string, reportCode: string) => {
    if (
      window.confirm(
        `XÁC NHẬN XÓA HOÀN TOÀN kỳ báo cáo "${reportCode}"?\n\nHành động này sẽ xóa vĩnh viễn kỳ báo cáo này cùng toàn bộ nguồn dữ liệu và số liệu thống kê đi kèm trên cả hệ thống và CSDL Supabase.\nHành động này không thể hoàn tác!`
      )
    ) {
      try {
        store.deleteReport(reportId);
        setReports(store.getReports());
      } catch (err: any) {
        alert(err.message || 'Lỗi khi xóa báo cáo');
      }
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && r.report_type !== typeFilter) return false;
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
  }, [reports, search, statusFilter, typeFilter]);

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

  const handleLockReport = (reportId: string) => {
    const rep = reports.find((r) => r.id === reportId);
    if (!rep) return;
    if (
      window.confirm(
        `Bạn có chắc chắn muốn KHÓA (LOCKED) kỳ báo cáo "${rep.report_code}"?\n\nSau khi khóa, hệ thống sẽ lưu SNAPSHOT bất biến. Không ai có thể chỉnh sửa hoặc nhập đè số liệu!`
      )
    ) {
      const updated = store.updateReportStatus(reportId, 'locked', 'Khóa snapshot chính thức.');
      setReports(store.getReports());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Kho lưu trữ & Quản lý các kỳ Báo cáo
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mỗi kỳ báo cáo là một bản ghi độc lập, lưu trữ lịch sử, hỗ trợ khóa Snapshot và kiểm soát số liệu bất biến
          </p>
        </div>

        <Link
          to="/reports/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo kỳ báo cáo mới</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã báo cáo, tên kỳ, người tạo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="imported">Đã nhập số liệu</option>
            <option value="validated">Đã thẩm định</option>
            <option value="submitted">Đã trình duyệt</option>
            <option value="approved">Đã phê duyệt</option>
            <option value="locked">Đã khóa snapshot</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả loại kỳ</option>
            <option value="monthly">Báo cáo tháng</option>
            <option value="quarterly">Báo cáo quý</option>
            <option value="yearly">Báo cáo năm</option>
            <option value="ad_hoc">Chuyên đề / Đột xuất</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
                <th className="p-3">Người lập</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Không tìm thấy báo cáo nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredReports.map((rep) => {
                  const repStats = store.getStatsByReport(rep.id);
                  const totalRec = repStats.reduce((acc, c) => acc + c.received_total, 0);
                  const totalComp = repStats.reduce((acc, c) => acc + c.completed_total, 0);
                  const badge = getStatusBadge(rep.status);
                  const isLocked = rep.status === 'locked';

                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-700">
                        <Link to={`/reports/${rep.id}`} className="hover:underline">
                          {rep.report_code}
                        </Link>
                      </td>
                      <td className="p-3 font-medium text-slate-900 max-w-xs">
                        <Link to={`/reports/${rep.id}`} className="hover:text-blue-600 line-clamp-1">
                          {rep.report_name}
                        </Link>
                        {rep.notes && (
                          <span className="text-[10px] text-slate-400 block line-clamp-1">
                            {rep.notes}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {formatDate(rep.period_start)} – {formatDate(rep.period_end)}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {formatNumber(totalRec)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        {formatNumber(totalComp)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {rep.created_by}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/reports/${rep.id}`}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="Xem chi tiết số liệu & phân tích"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(rep)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                              title="Chỉnh sửa thông tin kỳ báo cáo"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReport(rep.id, rep.report_code)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Xóa kỳ báo cáo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleExport(rep.id, 'excel')}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="Xuất file Excel báo cáo"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {!isLocked && currentUser.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleLockReport(rep.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Khóa báo cáo (Tạo snapshot bất biến)"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-blue-600" />
                Chỉnh sửa Kỳ Báo cáo: {editingReport.report_code}
              </h3>
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mã báo cáo</label>
                  <input
                    type="text"
                    required
                    value={editFormData.report_code}
                    onChange={(e) => setEditFormData({ ...editFormData, report_code: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Loại kỳ báo cáo</label>
                  <select
                    value={editFormData.report_type}
                    onChange={(e) => setEditFormData({ ...editFormData, report_type: e.target.value as any })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="monthly">Báo cáo Tháng</option>
                    <option value="quarterly">Báo cáo Quý</option>
                    <option value="yearly">Báo cáo Năm</option>
                    <option value="ad_hoc">Chuyên đề / Đột xuất</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tên kỳ báo cáo</label>
                <input
                  type="text"
                  required
                  value={editFormData.report_name}
                  onChange={(e) => setEditFormData({ ...editFormData, report_name: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    required
                    value={editFormData.period_start}
                    onChange={(e) => setEditFormData({ ...editFormData, period_start: e.target.value })}
                    className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    required
                    value={editFormData.period_end}
                    onChange={(e) => setEditFormData({ ...editFormData, period_end: e.target.value })}
                    className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Chốt số liệu</label>
                  <input
                    type="datetime-local"
                    required
                    value={editFormData.data_as_of}
                    onChange={(e) => setEditFormData({ ...editFormData, data_as_of: e.target.value })}
                    className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Ghi chú / Thuyết minh</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  placeholder="Ghi chú thuyết minh cho kỳ báo cáo..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
