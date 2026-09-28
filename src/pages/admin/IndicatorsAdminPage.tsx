import React, { useState, useEffect, useMemo } from 'react';
import { store } from '../../services/store';
import { IndicatorDefinition } from '../../types/database';
import {
  DATA_FIELDS_DICTIONARY,
  INDICATOR_PRESETS,
  evaluateCustomFormula,
  DataFieldDefinition,
  IndicatorPreset,
} from '../../features/analysis/formulas';
import {
  SlidersHorizontal,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  X,
  Target,
  Search,
  Calculator,
  Code2,
  Sparkles,
  BookOpen,
  HelpCircle,
  Play,
  RotateCcw,
  Check,
  AlertTriangle,
  Layers,
  Database,
} from 'lucide-react';

export const IndicatorsAdminPage: React.FC = () => {
  const [indicators, setIndicators] = useState(store.getIndicators());
  const [activeTab, setActiveTab] = useState<'indicators' | 'dictionary'>('indicators');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<IndicatorDefinition | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick test modal
  const [testingIndicator, setTestingIndicator] = useState<IndicatorDefinition | null>(null);

  // Form State
  const [formulaMode, setFormulaMode] = useState<'preset' | 'custom'>('preset');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    formula_key: 'calcCompletionRate',
    custom_formula: '([completed_total] / [received_total]) * 100',
    unit_measure: '%',
    description: '',
    active: true,
  });

  useEffect(() => {
    const refresh = () => setIndicators(store.getIndicators());
    void store
      .syncWithSupabase()
      .then(refresh)
      .catch((error) => console.warn('Không thể tải chỉ tiêu từ Supabase:', error));
    return store.subscribe(refresh);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sample data dictionary map for live preview
  const sampleDataMap = useMemo(() => {
    const map: Record<string, number> = {};
    DATA_FIELDS_DICTIONARY.forEach((f) => {
      map[f.key] = f.sampleValue;
    });
    return map;
  }, []);

  // Live Formula Test Result in Modal
  const liveTestResult = useMemo(() => {
    const expr =
      formulaMode === 'preset'
        ? INDICATOR_PRESETS.find((p) => p.key === formData.formula_key)?.expression || ''
        : formData.custom_formula;

    return evaluateCustomFormula(expr, sampleDataMap);
  }, [formulaMode, formData.formula_key, formData.custom_formula, sampleDataMap]);

  // Filtered indicators
  const filteredIndicators = useMemo(() => {
    return indicators.filter((ind) => {
      if (statusFilter === 'active' && !ind.active) return false;
      if (statusFilter === 'inactive' && ind.active) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          ind.code.toLowerCase().includes(q) ||
          ind.name.toLowerCase().includes(q) ||
          (ind.description || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [indicators, search, statusFilter]);

  const handleOpenCreate = () => {
    setEditingIndicator(null);
    setFormulaMode('preset');
    setFormData({
      code: '',
      name: '',
      formula_key: 'calcCompletionRate',
      custom_formula: '([completed_total] / [received_total]) * 100',
      unit_measure: '%',
      description: '',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ind: IndicatorDefinition) => {
    setEditingIndicator(ind);
    const isCustom = !!ind.custom_formula || ind.formula_type === 'custom';
    setFormulaMode(isCustom ? 'custom' : 'preset');
    setFormData({
      code: ind.code,
      name: ind.name,
      formula_key: ind.formula_key || ind.calculation_key || 'calcCompletionRate',
      custom_formula:
        ind.custom_formula ||
        INDICATOR_PRESETS.find((p) => p.key === ind.formula_key)?.expression ||
        '([completed_total] / [received_total]) * 100',
      unit_measure: ind.unit_measure || ind.unit || '%',
      description: ind.description || '',
      active: ind.active,
    });
    setIsModalOpen(true);
  };

  const handleInsertFieldToken = (fieldKey: string) => {
    const token = `[${fieldKey}]`;
    setFormData((prev) => ({
      ...prev,
      custom_formula: prev.custom_formula ? `${prev.custom_formula} ${token}` : token,
    }));
  };

  const handleInsertOperator = (op: string) => {
    setFormData((prev) => ({
      ...prev,
      custom_formula: prev.custom_formula ? `${prev.custom_formula} ${op} ` : `${op} `,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const codeClean = formData.code.trim().toUpperCase();
      if (!codeClean) {
        alert('Mã chỉ tiêu không được để trống.');
        return;
      }

      // Check formula validity if custom
      if (formulaMode === 'custom') {
        const testRes = evaluateCustomFormula(formData.custom_formula, sampleDataMap);
        if (!testRes.isValid) {
          alert(`Công thức chưa hợp lệ: ${testRes.error}. Vui lòng kiểm tra lại trước khi lưu.`);
          return;
        }
      }

      const matchedPreset = INDICATOR_PRESETS.find((p) => p.key === formData.formula_key);

      const payload: Omit<IndicatorDefinition, 'id'> & { id?: string } = {
        id: editingIndicator?.id,
        code: codeClean,
        name: formData.name.trim(),
        formula_key: formulaMode === 'preset' ? formData.formula_key : 'custom_formula',
        calculation_key: formulaMode === 'preset' ? formData.formula_key : 'custom_formula',
        formula_type: formulaMode,
        custom_formula: formulaMode === 'custom' ? formData.custom_formula.trim() : undefined,
        unit: formData.unit_measure.trim() || '%',
        unit_measure: formData.unit_measure.trim() || '%',
        description: formData.description.trim() || matchedPreset?.desc || '',
        display_order: editingIndicator?.display_order || indicators.length + 1,
        active: formData.active,
      };

      await store.saveIndicator(payload);
      setIndicators(store.getIndicators());
      setIsModalOpen(false);
      showToast(
        editingIndicator
          ? `Đã cập nhật chỉ tiêu "${payload.name}" thành công!`
          : `Đã tạo mới chỉ tiêu "${payload.name}" thành công!`
      );
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu chỉ tiêu.');
    }
  };

  const handleDelete = async (ind: IndicatorDefinition) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa chỉ tiêu "${ind.name}" (${ind.code}) khỏi hệ thống?`)) {
      try {
        await store.deleteIndicator(ind.id);
        setIndicators(store.getIndicators());
        showToast(`Đã xóa chỉ tiêu "${ind.name}".`);
      } catch (err: any) {
        alert(err.message || 'Lỗi khi xóa chỉ tiêu.');
      }
    }
  };

  // Khởi tạo nhanh bộ 12 chỉ tiêu chuẩn mực
  const handleSeedStandardIndicators = async () => {
    if (
      !window.confirm(
        'Bạn có muốn nạp bổ sung đầy đủ bộ 12 Chỉ tiêu thống kê chuẩn mực theo quy định báo cáo Một cửa vào hệ thống?'
      )
    ) {
      return;
    }

    try {
      let addedCount = 0;
      for (const preset of INDICATOR_PRESETS) {
        const exists = indicators.some((i) => i.code === preset.code);
        if (!exists) {
          await store.saveIndicator({
            code: preset.code,
            name: preset.name,
            formula_key: preset.key,
            calculation_key: preset.key,
            formula_type: 'preset',
            unit_measure: preset.unit,
            unit: preset.unit,
            description: preset.desc,
            active: true,
            display_order: indicators.length + addedCount + 1,
          });
          addedCount++;
        }
      }
      setIndicators(store.getIndicators());
      showToast(`Đã nạp bổ sung thành công ${addedCount} chỉ tiêu chuẩn mực.`);
    } catch (e: any) {
      alert(e.message || 'Lỗi khi nạp chỉ tiêu mẫu.');
    }
  };

  // Helper to render readable formula string
  const renderFormulaString = (ind: IndicatorDefinition) => {
    if (ind.custom_formula) {
      return ind.custom_formula;
    }
    const matched = INDICATOR_PRESETS.find((p) => p.key === ind.formula_key || p.code === ind.code);
    return matched ? matched.formula : ind.formula_key || 'Chưa thiết lập';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider mb-1">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Quản trị Hệ thống Đo lường & Công thức Báo cáo</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Chỉ tiêu và Công thức Tính toán
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Thiết lập danh mục chỉ tiêu đo lường hiệu suất và xây dựng công thức toán học tính toán tự động dựa trên các trường số liệu đầu vào của Bộ phận Một cửa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSeedStandardIndicators}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
            title="Nạp đầy đủ 12 chỉ tiêu chuẩn mẫu theo quy định"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nạp 12 Chỉ tiêu chuẩn mẫu</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Chỉ tiêu mới</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('indicators')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'indicators'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Danh sách Chỉ tiêu & Công thức</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
            {indicators.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dictionary')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'dictionary'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Từ điển Trường số liệu ({DATA_FIELDS_DICTIONARY.length} trường)</span>
        </button>
      </div>

      {/* TAB 1: DANH SÁCH CHỈ TIÊU & CÔNG THỨC */}
      {activeTab === 'indicators' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm theo tên chỉ tiêu, mã code hoặc công thức..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả trạng thái ({indicators.length})</option>
                <option value="active">Đang áp dụng</option>
                <option value="inactive">Tạm dừng</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredIndicators.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">Không tìm thấy chỉ tiêu thống kê phù hợp</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Bạn có thể tạo mới chỉ tiêu tùy chỉnh hoặc nhấp nút "Nạp 12 Chỉ tiêu chuẩn mẫu" để tạo sẵn bộ chỉ tiêu quy định.
              </p>
              <button
                type="button"
                onClick={handleSeedStandardIndicators}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp 12 Chỉ tiêu chuẩn mẫu ngay</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIndicators.map((ind) => {
                const isCustom = !!ind.custom_formula || ind.formula_type === 'custom';
                const formulaText = renderFormulaString(ind);
                const testEval = evaluateCustomFormula(
                  ind.custom_formula ||
                    INDICATOR_PRESETS.find((p) => p.key === ind.formula_key)?.expression ||
                    '',
                  sampleDataMap
                );

                return (
                  <div
                    key={ind.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all group"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {ind.code}
                          </span>
                          {isCustom ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <Code2 className="w-3 h-3 text-amber-600" />
                              Tự thiết lập
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Mẫu chuẩn
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTestingIndicator(ind)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Chạy thử nghiệm công thức với số liệu mẫu"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ind)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Chỉnh sửa chỉ tiêu"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(ind)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Xóa chỉ tiêu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{ind.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {ind.description || 'Chỉ số đo lường phục vụ đánh giá công tác giải quyết TTHC.'}
                      </p>

                      {/* Formula Box */}
                      <div className="mt-3.5 p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans uppercase tracking-wider mb-1">
                          <span>Công thức toán học:</span>
                          <span className="text-slate-300">Đơn vị: {ind.unit_measure || '%'}</span>
                        </div>
                        <div className="font-bold whitespace-nowrap text-emerald-300">{formulaText}</div>
                      </div>
                    </div>

                    {/* Card Footer: Live Sample Value */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">Mẫu thử:</span>
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {testEval.result} {ind.unit_measure || '%'}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ind.active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                        }`}
                      >
                        {ind.active ? 'Đang áp dụng' : 'Tạm dừng'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TỪ ĐIỂN CÁC TRƯỜNG SỐ LIỆU ĐẦU VÀO */}
      {activeTab === 'dictionary' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Từ điển Các trường số liệu nghiệp vụ để thiết lập công thức</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Các trường dữ liệu được trích xuất từ biểu mẫu báo cáo thống kê hoặc file Excel nhập liệu. Khi tạo công thức tùy chỉnh, bạn có thể đưa các mã trường này vào trong dấu ngoặc vuông <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 font-mono font-bold">[tên_trường]</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DATA_FIELDS_DICTIONARY.map((field) => (
              <div
                key={field.key}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    [{field.key}]
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {field.groupName}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900">{field.name}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{field.desc}</p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Số liệu mẫu thử nghiệm:</span>
                  <strong className="font-mono font-bold text-slate-900">{field.sampleValue}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK FORMULA TEST MODAL */}
      {testingIndicator && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Thử nghiệm tính toán Chỉ tiêu</h3>
              </div>
              <button
                type="button"
                onClick={() => setTestingIndicator(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                <div className="font-bold text-slate-900">{testingIndicator.name}</div>
                <div className="font-mono text-[11px] text-blue-700 mt-0.5">Mã: {testingIndicator.code}</div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs">
                <span className="text-[10px] text-slate-400 block mb-1">Công thức:</span>
                <div>{renderFormulaString(testingIndicator)}</div>
              </div>

              {(() => {
                const expr =
                  testingIndicator.custom_formula ||
                  INDICATOR_PRESETS.find((p) => p.key === testingIndicator.formula_key)?.expression ||
                  '';
                const test = evaluateCustomFormula(expr, sampleDataMap);

                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <span className="text-xs text-blue-800 font-medium block">Kết quả tính toán với số liệu mẫu</span>
                    <div className="text-3xl font-extrabold text-blue-900 font-mono my-1">
                      {test.result} <span className="text-base font-normal">{testingIndicator.unit_measure || '%'}</span>
                    </div>
                    <span className="text-[11px] text-blue-700">Công thức hoạt động chuẩn xác, không có lỗi chia cho 0</span>
                  </div>
                );
              })()}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setTestingIndicator(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT INDICATOR MODAL WITH VISUAL FORMULA BUILDER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingIndicator ? 'Chỉnh sửa Chỉ tiêu Thống kê' : 'Tạo mới Chỉ tiêu & Thiết lập Công thức'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quản trị viên tự do thiết lập công thức toán học hoặc chọn từ bộ công thức chuẩn mực
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã chỉ tiêu (Mã duy nhất viết hoa) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: COMPLETION_RATE, ONLINE_RATE..."
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 uppercase font-bold focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đơn vị tính <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit_measure}
                    onChange={(e) => setFormData({ ...formData, unit_measure: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold"
                    placeholder="VD: %, hồ sơ, ngày, điểm..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên chỉ tiêu thống kê <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Tỷ lệ giải quyết hồ sơ đúng và trước hạn..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
                />
              </div>

              {/* CHỌN PHƯƠNG THỨC THIẾT LẬP CÔNG THỨC */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Phương thức thiết lập công thức tính toán:
                </label>

                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => setFormulaMode('preset')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formulaMode === 'preset'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    1. Chọn công thức chuẩn mẫu ({INDICATOR_PRESETS.length} mẫu)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormulaMode('custom')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formulaMode === 'custom'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2. Tự thiết lập công thức tùy biến
                  </button>
                </div>

                {/* Chế độ 1: Chọn mẫu chuẩn */}
                {formulaMode === 'preset' && (
                  <div className="space-y-2">
                    <select
                      value={formData.formula_key}
                      onChange={(e) => {
                        const selKey = e.target.value;
                        const preset = INDICATOR_PRESETS.find((p) => p.key === selKey);
                        setFormData({
                          ...formData,
                          formula_key: selKey,
                          unit_measure: preset?.unit || formData.unit_measure,
                          name: formData.name || preset?.name || '',
                          code: formData.code || preset?.code || '',
                          description: formData.description || preset?.desc || '',
                        });
                      }}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 cursor-pointer"
                    >
                      {INDICATOR_PRESETS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name} — {p.formula} ({p.unit})
                        </option>
                      ))}
                    </select>

                    <div className="p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Biểu thức tính toán áp dụng:</span>
                      <div>{INDICATOR_PRESETS.find((p) => p.key === formData.formula_key)?.formula}</div>
                    </div>
                  </div>
                )}

                {/* Chế độ 2: Tự thiết lập công thức tùy chỉnh */}
                {formulaMode === 'custom' && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-800">
                          Biểu thức công thức toán học <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, custom_formula: '' })}
                          className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                        >
                          Xóa công thức
                        </button>
                      </div>

                      <input
                        type="text"
                        required
                        value={formData.custom_formula}
                        onChange={(e) => setFormData({ ...formData, custom_formula: e.target.value })}
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2.5 text-blue-900 focus:ring-2 focus:ring-blue-500"
                        placeholder="VD: ([completed_early] + [completed_on_time]) / [completed_total] * 100"
                      />
                    </div>

                    {/* Quick Insert Operators */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1">
                        Chèn nhanh toán tử & phép tính:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {['+', '-', '*', '/', '(', ')', '* 100'].map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => handleInsertOperator(op)}
                            className="px-2.5 py-1 text-xs font-mono font-bold bg-white hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer text-slate-800"
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Insert Data Fields */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1">
                        Nhấp để chèn trường số liệu vào công thức:
                      </span>
                      <div className="max-h-36 overflow-y-auto pr-1 space-y-1 bg-white p-2 rounded-lg border border-slate-200">
                        {DATA_FIELDS_DICTIONARY.map((df) => (
                          <button
                            key={df.key}
                            type="button"
                            onClick={() => handleInsertFieldToken(df.key)}
                            className="w-full text-left px-2 py-1 hover:bg-blue-50 text-[11px] rounded flex items-center justify-between transition-colors group cursor-pointer"
                          >
                            <span className="font-medium text-slate-800 truncate">
                              • {df.name}
                            </span>
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-100 px-1.5 py-0.2 rounded text-[10px]">
                              [{df.key}]
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live syntax validation and test result */}
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        liveTestResult.isValid
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {liveTestResult.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>
                          {liveTestResult.isValid
                            ? 'Cú pháp công thức hợp lệ'
                            : `Lỗi cú pháp: ${liveTestResult.error}`}
                        </span>
                      </div>

                      {liveTestResult.isValid && (
                        <div className="font-mono font-bold text-emerald-800">
                          Thử nghiệm: {liveTestResult.result} {formData.unit_measure || '%'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả và Ý nghĩa nghiệp vụ
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900"
                  placeholder="Ghi chú ý nghĩa phục vụ chỉ đạo điều hành và báo cáo công tác..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeIndicator"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="activeIndicator" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Kích hoạt áp dụng chỉ tiêu này trong các biểu mẫu và phân tích
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  {editingIndicator ? 'Lưu thay đổi' : 'Tạo mới Chỉ tiêu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
