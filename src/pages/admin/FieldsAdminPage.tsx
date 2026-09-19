import React, { useState, useMemo } from 'react';
import { store } from '../../services/store';
import { Field } from '../../types/database';
import { FolderKanban, Plus, Edit2, X, Search, Trash2 } from 'lucide-react';

export const FieldsAdminPage: React.FC = () => {
  const [fields, setFields] = useState(store.getFields());
  const units = useMemo(() => store.getUnits(), []);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit_id: units[0]?.id || '',
    display_order: 1,
    active: true,
  });

  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      if (selectedUnitFilter !== 'ALL' && f.unit_id !== selectedUnitFilter) return false;
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [fields, selectedUnitFilter, search]);

  const handleOpenCreate = () => {
    setEditingField(null);
    setFormData({
      code: '',
      name: '',
      unit_id: units[0]?.id || '',
      display_order: fields.length + 1,
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (f: Field) => {
    setEditingField(f);
    setFormData({
      code: f.code,
      name: f.name,
      unit_id: f.unit_id,
      display_order: f.display_order,
      active: f.active,
    });
    setIsModalOpen(true);
  };

  const handleDeleteField = (f: Field) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa lĩnh vực "${f.name}" (${f.code})?`)) {
      try {
        store.deleteField(f.id);
        setFields(store.getFields());
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      store.saveField({
        id: editingField?.id,
        ...formData,
      });
      setFields(store.getFields());
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu lĩnh vực');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Danh mục Lĩnh vực & Mapping Đơn vị
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quy tắc nghiệp vụ: Mỗi Lĩnh vực thuộc ĐÚNG MỘT Đơn vị giải quyết để tự động suy luận khi import dữ liệu
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Lĩnh vực mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm lĩnh vực..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={selectedUnitFilter}
            onChange={(e) => setSelectedUnitFilter(e.target.value)}
            className="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả đơn vị trực thuộc</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fields Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3 w-16 text-center">Thứ tự</th>
              <th className="p-3">Mã lĩnh vực</th>
              <th className="p-3">Tên Lĩnh vực TTHC</th>
              <th className="p-3">Đơn vị phụ trách (Mapping duy nhất)</th>
              <th className="p-3 text-center">Trạng thái</th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFields.map((f) => {
              const uObj = units.find((u) => u.id === f.unit_id);
              return (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-center font-mono font-bold text-slate-400">
                    {f.display_order}
                  </td>
                  <td className="p-3 font-mono font-bold text-blue-700">{f.code}</td>
                  <td className="p-3 font-semibold text-slate-900">{f.name}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 font-medium text-xs border border-blue-200">
                      {uObj?.name || 'Chưa gán'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {f.active ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        Đang áp dụng
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[10px]">
                        Tạm dừng
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(f)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                        title="Chỉnh sửa hoặc ánh xạ lại đơn vị"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteField(f)}
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="Xóa lĩnh vực"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingField ? 'Cập nhật Lĩnh vực TTHC' : 'Thêm Lĩnh vực TTHC mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã lĩnh vực (viết tắt)
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  placeholder="VD: CT, HT, DD, XD"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Lĩnh vực TTHC
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: Chứng thực, Đất đai, Hoạt động xây dựng"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn vị phụ trách giải quyết (Mapping duy nhất) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Khi import file Excel, đơn vị này sẽ tự động được gán vào số liệu thống kê của lĩnh vực này.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thứ tự hiển thị
                </label>
                <input
                  type="number"
                  required
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="field-active-check"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="field-active-check" className="text-xs font-medium text-slate-700">
                  Kích hoạt lĩnh vực
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  {editingField ? 'Lưu thay đổi' : 'Tạo lĩnh vực'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
