import React, { useState, useEffect } from 'react';
import { store } from '../../services/store';
import { IndicatorDefinition } from '../../types/database';
import { SlidersHorizontal, Plus, Edit2, Trash2, ShieldCheck, CheckCircle2, X, Target } from 'lucide-react';

export const IndicatorsAdminPage: React.FC = () => {
  const [indicators, setIndicators] = useState(store.getIndicators());
  useEffect(() => {
    const refresh = () => setIndicators(store.getIndicators());
    void store.syncWithSupabase().then(refresh).catch((error) => console.warn('Không thể tải chỉ tiêu từ Supabase:', error));
    return store.subscribe(refresh);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<IndicatorDefinition | null>(null);

  const FORMULA_REGISTRY = [
    {
      key: 'calcCompletionRate',
      name: 'Tỷ lệ giải quyết hồ sơ (calcCompletionRate)',
      formula: '(Tổng đã giải quyết / Tổng tiếp nhận) × 100%',
      desc: 'Đánh giá năng lực giải quyết hồ sơ tổng thể so với khối lượng tiếp nhận toàn kỳ.',
    },
    {
      key: 'calcOnTimeRate',
      name: 'Tỷ lệ đúng hạn & trước hạn (calcOnTimeRate)',
      formula: '((Trước hạn + Đúng hạn) / Tổng đã giải quyết) × 100%',
      desc: 'Chỉ số đo lường mức độ hài lòng và chất lượng thực thi công vụ của cán bộ Một cửa.',
    },
    {
      key: 'calcLateRate',
      name: 'Tỷ lệ quá hạn đã giải quyết (calcLateRate)',
      formula: '(Quá hạn đã giải quyết / Tổng đã giải quyết) × 100%',
      desc: 'Tỷ lệ hồ sơ trả kết quả chậm trễ, yêu cầu phải có văn bản xin lỗi theo quy định.',
    },
    {
      key: 'calcOnlineRate',
      name: 'Tỷ lệ nộp trực tuyến (calcOnlineRate)',
      formula: '(Trực tuyến / (Trực tuyến + Trực tiếp)) × 100%',
      desc: 'Đo lường mức độ số hóa của hồ sơ phát sinh mới trong kỳ, không tính số tồn từ kỳ trước.',
    },
    {
      key: 'calcPendingRate',
      name: 'Tỷ lệ trong hạn đang giải quyết (calcPendingRate)',
      formula: '(Đang giải quyết trong hạn / Tổng đang giải quyết) × 100%',
      desc: 'Đo lường tính an toàn của lượng hồ sơ tồn đọng đang trong quy trình xử lý.',
    },
  ];

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    formula_key: 'calcCompletionRate',
    unit_measure: '%',
    description: '',
    active: true,
  });

  const handleOpenCreate = () => {
    setEditingIndicator(null);
    setFormData({
      code: '',
      name: '',
      formula_key: 'calcCompletionRate',
      unit_measure: '%',
      description: '',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ind: IndicatorDefinition) => {
    setEditingIndicator(ind);
    setFormData({
      code: ind.code,
      name: ind.name,
      formula_key: ind.formula_key || ind.calculation_key || 'online_rate',
      unit_measure: ind.unit_measure || ind.unit || '%',
      description: ind.description || '',
      active: ind.active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await store.saveIndicator({
        id: editingIndicator?.id,
        calculation_key: formData.formula_key,
        unit: formData.unit_measure,
        display_order: editingIndicator?.display_order || 1,
        ...formData,
      });
      setIndicators(store.getIndicators());
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu chỉ tiêu.');
    }
  };

  const handleDelete = async (ind: IndicatorDefinition) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa chỉ tiêu "${ind.name}" (${ind.code})?`)) {
      try {
        await store.deleteIndicator(ind.id);
        setIndicators(store.getIndicators());
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Bộ Chỉ tiêu Thống kê & Engine Công thức Chuẩn
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quy định an toàn tuyệt đối: Không dùng eval(). Tất cả chỉ tiêu liên kết với khóa công thức từ Formula Registry chuẩn
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Chỉ tiêu mới</span>
        </button>
      </div>

      {/* Indicators Cards */}
      {indicators.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <Target className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Chưa có chỉ tiêu nào trong CSDL Supabase</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Hệ thống không tự sinh chỉ tiêu mặc định. Quản trị viên có thể thêm mới chỉ tiêu phân tích bằng nút "Thêm Chỉ tiêu mới" ở trên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {indicators.map((ind) => {
            const matchedFormula = FORMULA_REGISTRY.find((f) => f.key === ind.formula_key) || {
              formula: 'f(x)',
              desc: ind.description,
            };

            return (
              <div
                key={ind.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {ind.code}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Đơn vị: <strong className="text-slate-800">{ind.unit_measure}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ind)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="Sửa chỉ tiêu"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ind)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                        title="Xóa chỉ tiêu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{ind.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{ind.description}</p>

                  <div className="mt-4 p-3 bg-slate-900 rounded-lg text-emerald-400 font-mono text-xs">
                    <div className="text-[10px] text-slate-400 font-sans uppercase tracking-wider mb-1">
                      Công thức toán học áp dụng:
                    </div>
                    {matchedFormula.formula}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold font-mono text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    formula_key: {ind.formula_key}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ind.active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                  }`}>
                    {ind.active ? 'Đang áp dụng' : 'Tạm dừng'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingIndicator ? 'Chỉnh sửa Chỉ tiêu Thống kê' : 'Tạo mới Chỉ tiêu Thống kê'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã chỉ tiêu (Code duy nhất) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: COMPLETION_RATE, ON_TIME_RATE..."
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 uppercase font-bold focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên chỉ tiêu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Tỷ lệ giải quyết hồ sơ đúng hạn..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Khóa công thức toán học (Bắt buộc chọn từ Registry) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.formula_key}
                  onChange={(e) => setFormData({ ...formData, formula_key: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-900"
                >
                  {FORMULA_REGISTRY.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {FORMULA_REGISTRY.find((f) => f.key === formData.formula_key)?.formula}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đơn vị tính
                  </label>
                  <input
                    type="text"
                    value={formData.unit_measure}
                    onChange={(e) => setFormData({ ...formData, unit_measure: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                    placeholder="%, hồ sơ, ngày..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trạng thái
                  </label>
                  <div className="flex items-center h-10">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      Kích hoạt chỉ tiêu
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả & Ý nghĩa nghiệp vụ
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                  placeholder="Ghi chú giải thích cho lãnh đạo và chuyên viên..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  {editingIndicator ? 'Cập nhật chỉ tiêu' : 'Lưu chỉ tiêu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
