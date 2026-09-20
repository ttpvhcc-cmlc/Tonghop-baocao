import React, { useState } from 'react';
import { store } from '../../services/store';
import { Unit } from '../../types/database';
import { Building2, Plus, Edit2, CheckCircle2, X, Trash2 } from 'lucide-react';

export const UnitsAdminPage: React.FC = () => {
  const [units, setUnits] = useState(store.getUnits());
  const fields = store.getFields();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    display_order: 1,
    active: true,
  });

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setFormData({
      code: '',
      name: '',
      display_order: units.length + 1,
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code,
      name: unit.name,
      display_order: unit.display_order,
      active: unit.active,
    });
    setIsModalOpen(true);
  };

  const handleDeleteUnit = (unit: Unit) => {
    const linkedFields = fields.filter((f) => f.unit_id === unit.id);
    if (linkedFields.length > 0) {
      alert(`Không thể xóa đơn vị "${unit.name}" vì đang có ${linkedFields.length} lĩnh vực thuộc đơn vị này (${linkedFields.map((f) => f.name).slice(0, 3).join(', ')}...). Vui lòng chuyển các lĩnh vực sang đơn vị khác trước khi xóa.`);
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn xóa đơn vị "${unit.name}" (${unit.code})?`)) {
      try {
        store.deleteUnit(unit.id);
        setUnits(store.getUnits());
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await store.saveUnit({
        id: editingUnit?.id,
        ...formData,
      });
      setUnits(store.getUnits());
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu đơn vị');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Danh mục Đơn vị giải quyết TTHC
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý các phòng ban chuyên môn chịu trách nhiệm thụ lý, giải quyết hồ sơ thủ tục hành chính
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Đơn vị mới</span>
        </button>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3 w-16 text-center">Thứ tự</th>
              <th className="p-3">Mã đơn vị</th>
              <th className="p-3">Tên Đơn vị giải quyết</th>
              <th className="p-3 text-center">Số lĩnh vực phụ trách</th>
              <th className="p-3 text-center">Trạng thái</th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((u) => {
              const linkedFieldsCount = fields.filter((f) => f.unit_id === u.id).length;
              return (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-center font-mono font-bold text-slate-400">
                    {u.display_order}
                  </td>
                  <td className="p-3 font-mono font-bold text-blue-700">{u.code}</td>
                  <td className="p-3 font-semibold text-slate-900">{u.name}</td>
                  <td className="p-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {linkedFieldsCount} lĩnh vực
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {u.active ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        Đang hoạt động
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
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                        title="Chỉnh sửa thông tin đơn vị"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(u)}
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="Xóa đơn vị"
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
                {editingUnit ? 'Cập nhật Đơn vị giải quyết' : 'Thêm Đơn vị giải quyết mới'}
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
                  Mã đơn vị (viết tắt)
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  placeholder="VD: VP, KT, VHXH"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đầy đủ của Đơn vị
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: Văn phòng HĐND & UBND"
                />
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
                  id="active-check"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active-check" className="text-xs font-medium text-slate-700">
                  Kích hoạt sử dụng trong hệ thống
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
                  {editingUnit ? 'Lưu thay đổi' : 'Tạo đơn vị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
