import React, { useState } from 'react';
import {
  Search,
  Filter,
  PhoneCall,
  UserCheck,
  Printer,
  Eye,
  Trash2,
  Calendar,
  Building2,
  User,
  AlertTriangle,
  Clock,
  Layers,
  Flame,
  FileSpreadsheet,
  Pencil,
} from 'lucide-react';
import { DossierUrgeRecord, UrgeFilterCriteria, UrgeChannel, UrgeStatus } from '../../types/dossierUrge';
import * as XLSX from 'xlsx';
import { store } from '../../services/store';

interface UrgeTableProps {
  urges: DossierUrgeRecord[];
  onViewDetail: (record: DossierUrgeRecord) => void;
  onPrint: (record: DossierUrgeRecord) => void;
  onDelete: (id: string) => void;
  onEdit?: (record: DossierUrgeRecord) => void;
  criteria: Partial<UrgeFilterCriteria>;
  onCriteriaChange: (next: Partial<UrgeFilterCriteria>) => void;
}

export const UrgeTable: React.FC<UrgeTableProps> = ({
  urges,
  onViewDetail,
  onPrint,
  onDelete,
  onEdit,
  criteria,
  onCriteriaChange,
}) => {
  const currentUser = store.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.id === 'admin' || store.hasPermission('admin' as any, currentUser);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [criteria]);

  const totalPages = Math.ceil(urges.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedUrges = urges.slice(startIndex, startIndex + pageSize);

  // Lấy danh sách unique units và processors để filter
  const unitOptions = Array.from(new Set(urges.map((u) => u.assigned_unit).filter(Boolean)));
  const processorOptions = Array.from(new Set(urges.map((u) => u.processor_name).filter(Boolean)));

  const formatUrgeDate = (receptionTime?: string, createdAt?: string) => {
    if (receptionTime) {
      const parts = receptionTime.match(/(\d+)\/(\d+)\/(\d+)/);
      if (parts) {
        const day = parts[1].padStart(2, '0');
        const month = parts[2].padStart(2, '0');
        let year = parts[3];
        if (year.includes(' ')) {
          year = year.split(' ')[0];
        }
        const fullYear = year.length === 2 ? '20' + year : year;
        return `${day}/${month}/${fullYear}`;
      }
    }
    const dateObj = createdAt ? new Date(createdAt) : new Date();
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatToDDMMYYYY = (dateStr?: string) => {
    if (!dateStr) return '';
    const clean = dateStr.trim();
    if (clean.includes('/')) return clean;
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  const handleExportExcel = () => {
    if (urges.length === 0) {
      alert('Không có dữ liệu để xuất Excel.');
      return;
    }

    const exportRows = urges.map((r, i) => ({
      STT: i + 1,
      'Ngày đôn đốc': formatUrgeDate(r.reception_time, r.created_at),
      'Mã phiếu': r.ticket_code || ('TB-' + (r.reception_time || new Date(r.created_at).toLocaleDateString('vi-VN'))),
      'Mã hồ sơ': r.dossier_code,
      'Tên Công dân, tổ chức': r.citizen_name,
      'Điện thoại liên hệ': r.phone || '',
      'Địa chỉ': r.address || '',
      'Thủ tục': r.procedure_name,
      'Ngày nhận': r.received_date,
      'Ngày hẹn trả': r.appointment_date,
      'Đơn vị chủ trì': r.assigned_unit,
      'Người thụ lý': r.processor_name || 'Chưa phân công',
      'Phản ánh': r.channel === 'direct' ? 'Trực tiếp' : 'Qua điện thoại',
      'Thời gian tiếp nhận': r.reception_time || '',
      'Lượt đôn đốc': `Lần ${r.urge_count}`,
      'Trạng thái': r.status === 'completed' ? 'Đã hoàn thành' : r.status === 'responded' ? 'Đã phản hồi' : r.status === 'in_progress' ? 'Đang đôn đốc' : 'Chờ xử lý',
      'Thời gian đôn đốc': new Date(r.created_at).toLocaleString('vi-VN'),
      'Cán bộ tiếp nhận': r.created_by_name,
      'Ghi chú': r.notes || '',
      'Đề nghị': r.proposal || '',
      'Ý kiến phản hồi từ đơn vị': r.unit_feedback || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'So_Theo_Doi_Don_Doc');
    XLSX.writeFile(wb, `So_Theo_Doi_Don_Doc_TTHC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getUrgencyBadge = (u: string) => {
    switch (u) {
      case 'express':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white uppercase shadow-xs">
            Hỏa tốc
          </span>
        );
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white uppercase">
            Khẩn
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Thường
          </span>
        );
    }
  };

  const getStatusBadge = (st: UrgeStatus) => {
    switch (st) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            Đã hoàn thành
          </span>
        );
      case 'responded':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            Đã phản hồi
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            Đang đôn đốc
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            Chờ xử lý
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
      {/* Bộ lọc đa tiêu chí */}
      <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Ô tìm kiếm tự do */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={criteria.searchQuery || ''}
              onChange={(e) => onCriteriaChange({ searchQuery: e.target.value })}
              placeholder="Tìm theo Mã hồ sơ, Tên công dân, Đơn vị, Người thụ lý..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8.5 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Xuất Excel
            </button>
          </div>
        </div>

        {/* Các dải lọc con */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Lọc Khoảng thời gian */}
          <select
            value={criteria.timeRange || 'all'}
            onChange={(e) => onCriteriaChange({ timeRange: e.target.value as any })}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">Thời gian: Tất cả</option>
            <option value="today">Hôm nay</option>
            <option value="7days">7 ngày qua</option>
            <option value="this_month">Tháng này</option>
            <option value="this_quarter">Quý này</option>
          </select>

          {/* Lọc Tiêu chí: Đôn đốc nhiều lần */}
          <select
            value={criteria.urgeFrequency || 'all'}
            onChange={(e) => onCriteriaChange({ urgeFrequency: e.target.value as any })}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">Tất cả lượt đôn đốc</option>
            <option value="first_time">Đôn đốc lần đầu (1 lần)</option>
            <option value="multiple">⚠️ Đôn đốc nhiều lần (≥ 2 lần)</option>
          </select>

          {/* Lọc Hình thức */}
          <select
            value={criteria.channel || 'all'}
            onChange={(e) => onCriteriaChange({ channel: e.target.value as any })}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">Hình thức: Tất cả</option>
            <option value="direct">Trực tiếp tại Trung tâm</option>
            <option value="phone">Qua Điện thoại</option>
          </select>

          {/* Lọc Đơn vị */}
          {unitOptions.length > 0 && (
            <select
              value={criteria.assignedUnit || 'all'}
              onChange={(e) => onCriteriaChange({ assignedUnit: e.target.value })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium max-w-[200px] truncate"
            >
              <option value="all">Đơn vị: Tất cả</option>
              {unitOptions.map((u, i) => (
                <option key={i} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}

          {/* Lọc Trạng thái */}
          <select
            value={criteria.status || 'all'}
            onChange={(e) => onCriteriaChange({ status: e.target.value as any })}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="pending">Chờ xử lý</option>
            <option value="in_progress">Đang đôn đốc</option>
            <option value="responded">Đã phản hồi</option>
            <option value="completed">Đã hoàn thành</option>
          </select>

          {(criteria.searchQuery ||
            (criteria.timeRange && criteria.timeRange !== 'all') ||
            (criteria.urgeFrequency && criteria.urgeFrequency !== 'all') ||
            (criteria.channel && criteria.channel !== 'all') ||
            (criteria.assignedUnit && criteria.assignedUnit !== 'all') ||
            (criteria.status && criteria.status !== 'all')) && (
            <button
              type="button"
              onClick={() =>
                onCriteriaChange({
                  searchQuery: '',
                  timeRange: 'all',
                  urgeFrequency: 'all',
                  channel: 'all',
                  assignedUnit: 'all',
                  status: 'all',
                })
              }
              className="text-xs text-blue-600 hover:underline px-2 py-1 font-semibold cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Danh sách bản ghi */}
      {urges.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-medium">Không tìm thấy bản ghi đôn đốc nào phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-3 text-center w-10">STT</th>
                <th className="py-3 px-3">Mã phiếu</th>
                <th className="py-3 px-3 text-center w-28">Ngày đôn đốc</th>
                <th className="py-3 px-3">Mã hồ sơ</th>
                <th className="py-3 px-3">Công dân, tổ chức</th>
                <th className="py-3 px-3">Thủ tục</th>
                <th className="py-3 px-3">Đơn vị chủ trì</th>
                <th className="py-3 px-3 text-center">Lượt đôn đốc</th>
                <th className="py-3 px-3 text-center">Hình thức</th>
                <th className="py-3 px-3 text-center">Hẹn trả</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedUrges.map((record, index) => {
                const isMultiple = record.urge_count >= 2;
                const ticketCode = record.ticket_code || 'TB-' + (record.reception_time || new Date(record.created_at).toLocaleDateString('vi-VN'));
                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      isMultiple ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center font-medium text-slate-400">
                      {startIndex + index + 1}
                    </td>

                    {/* Mã phiếu */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {ticketCode}
                      </span>
                    </td>

                    {/* Ngày đôn đốc */}
                    <td className="py-3 px-3 text-center font-mono font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatUrgeDate(record.reception_time, record.created_at)}
                    </td>

                    {/* Mã hồ sơ */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isMultiple && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span>{record.dossier_code}</span>
                      </div>
                    </td>

                    {/* Tên công dân, tổ chức (Không có số định danh) */}
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      <div className="max-w-[160px] truncate" title={record.citizen_name}>
                        {record.citizen_name}
                      </div>
                      {record.phone && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {record.phone}
                        </div>
                      )}
                    </td>

                    {/* Thủ tục */}
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      <div className="max-w-[200px] truncate" title={record.procedure_name}>
                        {record.procedure_name}
                      </div>
                    </td>

                    {/* Đơn vị chủ trì & Người thụ lý */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-white truncate max-w-[170px]" title={record.assigned_unit}>
                        {record.assigned_unit}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" />
                        {record.processor_name}
                      </div>
                    </td>

                    {/* Lượt đôn đốc */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                          record.urge_count >= 2
                            ? 'bg-red-500 text-white shadow-xs'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {record.urge_count >= 2 && <Flame className="w-3 h-3" />}
                        Lần {record.urge_count}
                      </span>
                    </td>

                    {/* Kênh tiếp nhận */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {record.channel === 'direct' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
                          <UserCheck className="w-3 h-3" /> Trực tiếp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                          <PhoneCall className="w-3 h-3" /> Điện thoại
                        </span>
                      )}
                    </td>

                    {/* Ngày hẹn trả */}
                    <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatToDDMMYYYY(record.appointment_date)}
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(record.status)}
                    </td>

                    {/* Thao tác */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onViewDetail(record)}
                          title="Xem chi tiết & Cập nhật phản hồi"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrint(record)}
                          title="In phiếu đôn đốc"
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Cho phép tài khoản quản trị xóa, sửa được Phiếu đôn đốc */}
                        {isAdmin && onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(record)}
                            title="Sửa phiếu đôn đốc"
                            className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        {isAdmin && (
                          <div className="relative inline-block">
                            {deletingId === record.id ? (
                              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/80 p-1 rounded-lg border border-red-200 dark:border-red-900/60 animate-in fade-in duration-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDelete(record.id);
                                    setDeletingId(null);
                                  }}
                                  className="px-2 py-1 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer transition-all"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md cursor-pointer transition-all"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingId(record.id)}
                                title="Xóa bản ghi"
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Phân trang 20 dòng / 1 trang */}
          {totalPages > 1 ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <div>
                Hiển thị từ <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> đến{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {Math.min(startIndex + pageSize, urges.length)}
                </span>{' '}
                trong tổng số <span className="font-semibold text-slate-900 dark:text-white">{urges.length}</span> bản ghi (20 dòng/trang)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium disabled:opacity-55 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Trang trước
                </button>
                <span className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300">
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium disabled:opacity-55 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Trang sau
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <div>
                Hiển thị tổng số <span className="font-semibold text-slate-900 dark:text-white">{urges.length}</span> bản ghi (20 dòng/trang)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
