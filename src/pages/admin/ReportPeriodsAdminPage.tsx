import React, { useState, useEffect, useMemo } from 'react';
import { store } from '../../services/store';
import type { ReportPeriodType } from '../../types/database';
import {
  CalendarRange,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  Save,
  X,
  Sparkles,
  Calendar,
  Check,
} from 'lucide-react';

export const ReportPeriodsAdminPage: React.FC = () => {
  const [periodTypes, setPeriodTypes] = useState<ReportPeriodType[]>(store.getPeriodTypes());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFrequency, setFilterFrequency] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReportPeriodType | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    frequency: 'Hàng tháng',
    description: '',
    display_order: 1,
    active: true,
    deadline_days: 5,
  });

  // Delete Confirm Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ReportPeriodType | null>(null);

  // Toast Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setPeriodTypes(store.getPeriodTypes());
    };
    refresh();
    return store.subscribe(refresh);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return periodTypes.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchFrequency = filterFrequency === 'ALL' || item.frequency === filterFrequency;
      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && item.active) ||
        (filterStatus === 'INACTIVE' && !item.active);

      return matchSearch && matchFrequency && matchStatus;
    });
  }, [periodTypes, searchQuery, filterFrequency, filterStatus]);

  // Frequency Options
  const frequencies = [
    'Hàng tuần',
    'Hàng tháng',
    'Hàng quý',
    '6 tháng',
    '9 tháng',
    'Hàng năm',
    'Đột xuất',
    'Chuyên đề',
  ];

  const handleOpenCreate = () => {
    setEditingItem(null);
    const nextOrder = periodTypes.length > 0 ? Math.max(...periodTypes.map((p) => p.display_order || 0)) + 1 : 1;
    setFormData({
      code: '',
      name: '',
      frequency: 'Hàng tháng',
      description: '',
      display_order: nextOrder,
      active: true,
      deadline_days: 5,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ReportPeriodType) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      frequency: item.frequency || 'Hàng tháng',
      description: item.description || '',
      display_order: item.display_order || 1,
      active: item.active !== false,
      deadline_days: item.deadline_days || 5,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      showToast('Vui lòng nhập Mã loại kỳ báo cáo', 'error');
      return;
    }
    if (!formData.name.trim()) {
      showToast('Vui lòng nhập Tên loại kỳ báo cáo', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await store.savePeriodType({
        ...(editingItem ? { id: editingItem.id } : {}),
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        frequency: formData.frequency,
        description: formData.description.trim(),
        display_order: Number(formData.display_order) || 1,
        active: formData.active,
        deadline_days: Number(formData.deadline_days) || 5,
      });

      showToast(editingItem ? 'Đã cập nhật loại kỳ báo cáo thành công' : 'Đã thêm mới loại kỳ báo cáo thành công');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu loại kỳ báo cáo', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: ReportPeriodType) => {
    try {
      await store.savePeriodType({
        ...item,
        active: !item.active,
      });
      showToast(`Đã ${!item.active ? 'kích hoạt' : 'tạm dừng'} loại kỳ: ${item.name}`);
    } catch (err: any) {
      showToast(err.message || 'Không thể thay đổi trạng thái', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await store.deletePeriodType(deleteConfirmItem.id);
      showToast(`Đã xóa loại kỳ báo cáo: ${deleteConfirmItem.name}`);
      setDeleteConfirmItem(null);
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa loại kỳ', 'error');
    }
  };

  const getFrequencyBadge = (freq: string) => {
    switch (freq) {
      case 'Hàng tuần':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Hàng tháng':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Hàng quý':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case '6 tháng':
      case '9 tháng':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Hàng năm':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Đột xuất':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Chuyên đề':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. PAGE HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-600 uppercase tracking-wider">
                  Danh mục quản trị
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">Chuẩn hóa kỳ thống kê</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Quản lý Loại kỳ báo cáo
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Thiết lập và quản lý các loại kỳ báo cáo (Tuần, Tháng, Quý, 6 tháng, 9 tháng, Năm, Đột xuất, Chuyên đề...) phục vụ tạo kỳ và tổng hợp số liệu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm loại kỳ mới</span>
            </button>
          </div>
        </div>

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <CalendarRange className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800">{periodTypes.length}</div>
              <div className="text-[11px] text-slate-500">Tổng số loại kỳ</div>
            </div>
          </div>

          <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-black text-emerald-700">
                {periodTypes.filter((p) => p.active).length}
              </div>
              <div className="text-[11px] text-emerald-600">Đang áp dụng</div>
            </div>
          </div>

          <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-black text-amber-700">
                {Array.from(new Set(periodTypes.map((p) => p.frequency))).length}
              </div>
              <div className="text-[11px] text-amber-600">Tần suất quy định</div>
            </div>
          </div>

          <div className="bg-cyan-50/50 rounded-xl p-3 border border-cyan-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-black text-cyan-700">
                {periodTypes.filter((p) => p.frequency === 'Định kỳ' || p.frequency === 'Hàng tháng' || p.frequency === 'Hàng quý').length}
              </div>
              <div className="text-[11px] text-cyan-600">Kỳ định kỳ chính</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã loại kỳ, tên kỳ báo cáo hoặc mô tả..."
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-500">Tần suất:</span>
            <select
              value={filterFrequency}
              onChange={(e) => setFilterFrequency(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-medium"
            >
              <option value="ALL">Tất cả tần suất ({periodTypes.length})</option>
              {frequencies.map((freq) => (
                <option key={freq} value={freq}>
                  {freq} ({periodTypes.filter((p) => p.frequency === freq).length})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Trạng thái:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-medium"
            >
              <option value="ALL">Tất cả</option>
              <option value="ACTIVE">Đang áp dụng</option>
              <option value="INACTIVE">Tạm dừng</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. TABLE OF PERIOD TYPES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 w-12 text-center">STT</th>
                <th className="py-3.5 px-4 w-28">Mã loại kỳ</th>
                <th className="py-3.5 px-4">Tên loại kỳ báo cáo</th>
                <th className="py-3.5 px-4 w-32">Tần suất</th>
                <th className="py-3.5 px-4 w-28 text-center">Hạn nộp (ngày)</th>
                <th className="py-3.5 px-4">Mô tả và Căn cứ quy định</th>
                <th className="py-3.5 px-4 w-28 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="font-semibold text-slate-600">Không tìm thấy loại kỳ báo cáo nào phù hợp</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Thử thay đổi từ khóa tìm kiếm hoặc bấm "Thêm loại kỳ mới"
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-cyan-50/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-center text-slate-500 font-medium">
                      {item.display_order || index + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getFrequencyBadge(
                          item.frequency
                        )}`}
                      >
                        {item.frequency}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        +{item.deadline_days || 5} ngày
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-md truncate">
                      {item.description ? (
                        <span title={item.description}>{item.description}</span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa có mô tả</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                          item.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Bấm để bật / tắt trạng thái"
                      >
                        {item.active ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Áp dụng</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Tạm dừng</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                          title="Chỉnh sửa loại kỳ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmItem(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa loại kỳ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL TẠO / SỬA LOẠI KỲ BÁO CÁO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingItem ? 'Chỉnh sửa Loại kỳ báo cáo' : 'Thêm mới Loại kỳ báo cáo'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cấu hình thông số kỳ báo cáo dùng cho toàn hệ thống
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Mã loại kỳ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: MONTHLY, QUARTERLY..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tần suất thực hiện
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-medium"
                  >
                    {frequencies.map((freq) => (
                      <option key={freq} value={freq}>
                        {freq}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tên loại kỳ báo cáo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Báo cáo Tháng, Báo cáo Quý..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Hạn nộp (+ngày sau kết thúc kỳ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.deadline_days}
                    onChange={(e) => setFormData({ ...formData, deadline_days: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mô tả và Căn cứ quy định
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ghi chú quy định, căn cứ thông tư hướng dẫn hoặc quy chế báo cáo..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-medium"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-700">Kích hoạt áp dụng loại kỳ này</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu thông tin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL XÁC NHẬN XÓA */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa loại kỳ</h3>
                <p className="text-xs text-slate-500">Thao tác này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn xóa loại kỳ báo cáo <strong>"{deleteConfirmItem.name}"</strong> (Mã: <code>{deleteConfirmItem.code}</code>) không?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
              notification.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : 'bg-rose-900 text-rose-100 border-rose-700'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
