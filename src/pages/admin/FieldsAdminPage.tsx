import React, { useState, useEffect, useMemo } from 'react';
import { store } from '../../services/store';
import type { Field, Unit } from '../../types/database';
import {
  FolderKanban,
  Plus,
  X,
  FileSpreadsheet,
  Download,
  Building2,
  Layers,
  Check,
  Trash2,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { GroupedSectorTable } from '../../components/admin/GroupedSectorTable';
import { UnitSummaryMatrix } from '../../components/admin/UnitSummaryMatrix';
import { ExcelImportWorkspace } from '../../components/admin/ExcelImportWorkspace';
import {
  exportCatalogToExcel,
  downloadSampleExcelTemplate,
  matchUnitByNameOrCode,
  type ParsedProcedureRow,
} from '../../utils/excelProcedureHelper';

export const FieldsAdminPage: React.FC = () => {
  const [fields, setFields] = useState<Field[]>(store.getFields());
  const [units, setUnits] = useState<Unit[]>(store.getUnits());

  // Active navigation tab:
  // 'grouped': Primary hierarchical grouped view by Lĩnh vực
  // 'matrix': Distribution by handling unit
  // 'import': Excel Import & Sync workspace
  const [activeTab, setActiveTab] = useState<'grouped' | 'matrix' | 'import'>('grouped');

  // Manual create / edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [syncSector, setSyncSector] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit_id: '',
    display_order: 1,
    active: true,
    co_quan_cong_bo: '',
    quyet_dinh_cong_bo: '',
    loai_tthc: '',
    co_quan_thuc_hien: '',
    cap_thuc_hien: '',
    muc_do_cung_cap: '',
    phi_le_phi: '',
    linh_vuc: '',
  });

  // Non-blocking toast notification & delete confirm modal
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirmField, setDeleteConfirmField] = useState<Field | null>(null);

  // Subscribe to store updates
  useEffect(() => {
    // Initial fetch to make sure fields are up to date
    const current = store.getFields();
    if (current.length === 0) {
      void store.restoreDefaultProcedures().catch((error) => {
        setNotification({ type: 'error', message: error.message || 'Không thể tải danh mục từ Supabase.' });
      });
    }
    setFields(store.getFields());
    setUnits(store.getUnits());

    const unsub = store.subscribe(() => {
      setFields(store.getFields());
      setUnits(store.getUnits());
    });
    return unsub;
  }, []);

  const handleRestoreDefaults = async () => {
    try {
    const restored = await store.restoreDefaultProcedures();
    setFields(restored);
    setNotification({
      type: 'success',
      message: 'Đã tải lại danh mục Lĩnh vực từ Supabase.',
    });
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message || 'Không thể tải danh mục từ Supabase.' });
    }
  };

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalFields = fields.length;
    const sectorsSet = new Set<string>();
    let assignedCount = 0;

    fields.forEach((f) => {
      sectorsSet.add((f.linh_vuc || 'Chưa phân loại').trim());
      if (f.unit_id) assignedCount++;
    });

    return {
      totalFields,
      totalSectors: sectorsSet.size,
      assignedCount,
      unassignedCount: totalFields - assignedCount,
    };
  }, [fields]);

  // 1. Assign unit to an ENTIRE SECTOR
  const handleAssignSectorUnit = async (sectorName: string, unitId: string) => {
    const cleanSector = (sectorName || '').trim().toLowerCase();
    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit) return;

    const fieldsToUpdate = fields
      .filter((f) => (f.linh_vuc || '').trim().toLowerCase() === cleanSector)
      .map((f) => ({ ...f, unit_id: unitId }));

    if (fieldsToUpdate.length === 0) return;

    store.saveFieldsBulk(fieldsToUpdate);
    setNotification({
      type: 'success',
      message: `Đã phân công toàn bộ ${fieldsToUpdate.length} thủ tục thuộc lĩnh vực "${sectorName}" cho đơn vị "${targetUnit.name}"!`,
    });
  };

  // 2. Assign unit to a single field
  const handleUpdateFieldUnit = async (fieldId: string, unitId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const targetUnit = units.find((u) => u.id === unitId);
    const updated: Field = { ...field, unit_id: unitId || '' };
    store.saveField(updated);

    setNotification({
      type: 'success',
      message: targetUnit
        ? `Đã phân công thủ tục "${field.code}" cho "${targetUnit.name}".`
        : `Đã hủy phân công đơn vị cho thủ tục "${field.code}".`,
    });
  };

  // 3. Transfer all fields from one unit to another
  const handleTransferUnitFields = async (fromUnitId: string | null, toUnitId: string) => {
    const targetUnit = units.find((u) => u.id === toUnitId);
    if (!targetUnit) return;

    const fieldsToMove = fields
      .filter((f) => (fromUnitId === null ? !f.unit_id : f.unit_id === fromUnitId))
      .map((f) => ({ ...f, unit_id: toUnitId }));

    if (fieldsToMove.length === 0) return;

    store.saveFieldsBulk(fieldsToMove);
    setNotification({
      type: 'success',
      message: `Đã chuyển giao thành công ${fieldsToMove.length} thủ tục sang "${targetUnit.name}"!`,
    });
  };

  // 4. Transfer an entire sector to another unit
  const handleTransferSectorToUnit = async (sectorName: string, toUnitId: string) => {
    await handleAssignSectorUnit(sectorName, toUnitId);
  };

  // 5. Excel Import Handler
  const handleImportProcedures = async (
    rows: ParsedProcedureRow[],
    mode: 'upsert' | 'replace',
    newUnitsToCreate: string[]
  ) => {
    try {
      // Step A: Create any new units detected in column 11
      const currentUnits = [...store.getUnits()];
      for (const newUnitName of newUnitsToCreate) {
        const trimmed = newUnitName.trim();
        if (!trimmed) continue;
        const exists = matchUnitByNameOrCode(trimmed, currentUnits);
        if (!exists) {
          const words = trimmed.split(/\s+/);
          const generatedCode = words.map((w) => w[0]?.toUpperCase() || '').join('') || `DV${currentUnits.length + 1}`;
          const created = store.saveUnit({
            name: trimmed,
            code: generatedCode,
            display_order: currentUnits.length + 1,
            active: true,
          });
          currentUnits.push(created);
        }
      }

      // Step B: Build field objects
      const existingFieldsMap = new Map(fields.map((f) => [f.code.trim().toLowerCase(), f]));
      const fieldsToSave: Field[] = [];

      rows.forEach((row, idx) => {
        // Resolve unit_id
        let unitId = row.matched_unit_id;
        if (!unitId && row.raw_unit_name) {
          const matched = matchUnitByNameOrCode(row.raw_unit_name, currentUnits);
          if (matched) unitId = matched.id;
        }

        const existing = existingFieldsMap.get(row.code.trim().toLowerCase());

        const fieldItem: Field = {
          id: existing ? existing.id : '',
          code: row.code.trim(),
          name: row.name.trim(),
          linh_vuc: row.linh_vuc?.trim() || 'Chưa phân loại',
          unit_id: unitId || existing?.unit_id || '',
          display_order: existing ? existing.display_order : idx + 1,
          active: true,
          co_quan_cong_bo: row.co_quan_cong_bo?.trim() || undefined,
          quyet_dinh_cong_bo: existing?.quyet_dinh_cong_bo || undefined,
          loai_tthc: row.loai_tthc?.trim() || undefined,
          co_quan_thuc_hien: row.co_quan_thuc_hien?.trim() || undefined,
          cap_thuc_hien: row.cap_thuc_hien?.trim() || undefined,
          muc_do_cung_cap: row.muc_do_cung_cap?.trim() || undefined,
          phi_le_phi: row.phi_le_phi?.trim() || undefined,
        };

        fieldsToSave.push(fieldItem);
      });

      if (mode === 'replace') {
        // In replace mode, overwrite existing fields
        store.saveFieldsBulk(fieldsToSave);
      } else {
        // In upsert mode, save bulk
        store.saveFieldsBulk(fieldsToSave);
      }

      setNotification({
        type: 'success',
        message: `Đồng bộ thành công ${rows.length} thủ tục từ file Excel! Đã tự động phân nhóm theo Lĩnh vực & gán Đơn vị thực hiện.`,
      });

      // Switch to grouped tab to let user see result
      setActiveTab('grouped');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi nhập dữ liệu từ file Excel';
      setNotification({ type: 'error', message: msg });
    }
  };

  // Open modal to create manual field
  const handleOpenCreate = () => {
    setEditingField(null);
    setSyncSector(false);
    setFormData({
      code: '',
      name: '',
      unit_id: units[0]?.id || '',
      display_order: fields.length + 1,
      active: true,
      co_quan_cong_bo: '',
      quyet_dinh_cong_bo: '',
      loai_tthc: '',
      co_quan_thuc_hien: '',
      cap_thuc_hien: '',
      muc_do_cung_cap: '',
      phi_le_phi: '',
      linh_vuc: '',
    });
    setIsModalOpen(true);
  };

  // Open modal to edit existing field
  const handleOpenEdit = (f: Field) => {
    setEditingField(f);
    setSyncSector(false);
    setFormData({
      code: f.code,
      name: f.name,
      unit_id: f.unit_id || units[0]?.id || '',
      display_order: f.display_order,
      active: f.active,
      co_quan_cong_bo: f.co_quan_cong_bo || '',
      quyet_dinh_cong_bo: f.quyet_dinh_cong_bo || '',
      loai_tthc: f.loai_tthc || '',
      co_quan_thuc_hien: f.co_quan_thuc_hien || '',
      cap_thuc_hien: f.cap_thuc_hien || '',
      muc_do_cung_cap: f.muc_do_cung_cap || '',
      phi_le_phi: f.phi_le_phi || '',
      linh_vuc: f.linh_vuc || '',
    });
    setIsModalOpen(true);
  };

  // Submit manual create / edit
  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fieldData: Omit<Field, 'id'> & { id?: string } = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        unit_id: formData.unit_id || '',
        display_order: Number(formData.display_order) || 1,
        active: formData.active,
        co_quan_cong_bo: formData.co_quan_cong_bo.trim() || undefined,
        quyet_dinh_cong_bo: formData.quyet_dinh_cong_bo.trim() || undefined,
        loai_tthc: formData.loai_tthc.trim() || undefined,
        co_quan_thuc_hien: formData.co_quan_thuc_hien.trim() || undefined,
        cap_thuc_hien: formData.cap_thuc_hien.trim() || undefined,
        muc_do_cung_cap: formData.muc_do_cung_cap.trim() || undefined,
        phi_le_phi: formData.phi_le_phi.trim() || undefined,
        linh_vuc: formData.linh_vuc.trim() || 'Chưa phân loại',
      };

      if (editingField) {
        store.saveField({ ...editingField, ...fieldData });

        if (syncSector && formData.linh_vuc && formData.unit_id) {
          const cleanSec = formData.linh_vuc.trim().toLowerCase();
          const siblingFields = fields
            .filter((f) => (f.linh_vuc || '').trim().toLowerCase() === cleanSec && f.id !== editingField.id)
            .map((f) => ({ ...f, unit_id: formData.unit_id }));

          if (siblingFields.length > 0) {
            store.saveFieldsBulk(siblingFields);
          }
        }

        setNotification({
          type: 'success',
          message: syncSector
            ? `Cập nhật thủ tục và đồng bộ đơn vị cho lĩnh vực "${formData.linh_vuc}" thành công!`
            : 'Cập nhật thủ tục thành công!',
        });
      } else {
        store.saveField(fieldData);
        setNotification({ type: 'success', message: 'Thêm mới thủ tục thành công!' });
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setNotification({ type: 'error', message: msg });
    }
  };

  // Delete field confirmation
  const handleConfirmDelete = () => {
    if (!deleteConfirmField) return;
    try {
      store.deleteField(deleteConfirmField.id);
      setNotification({
        type: 'success',
        message: `Đã xóa thủ tục "${deleteConfirmField.name}" khỏi danh mục!`,
      });
      setDeleteConfirmField(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa thủ tục này';
      setNotification({ type: 'error', message: msg });
      setDeleteConfirmField(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* PAGE HEADER & TOP CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider mb-1">
              <FolderKanban className="w-4 h-4" />
              <span>Chuẩn hóa Danh mục Thủ tục hành chính & Phân công giải quyết</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Quản lý Lĩnh vực & Đơn vị phụ trách giải quyết
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Dữ liệu được trình bày trên bảng phân nhóm chuẩn theo từng Lĩnh vực. Bạn có thể phân cấp Đơn vị phụ trách cho 
              <strong> toàn bộ Lĩnh vực cùng lúc</strong> hoặc điều chỉnh linh hoạt cho từng thủ tục đơn lẻ.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
              title="Khôi phục danh mục 31 thủ tục hành chính chuẩn theo Lĩnh vực & Đơn vị phụ trách"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Khôi phục 31 TTHC chuẩn</span>
            </button>

            <button
              type="button"
              onClick={() => downloadSampleExcelTemplate()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              title="Tải tệp Excel mẫu chuẩn với 11 cột để nhập liệu"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải file mẫu Excel</span>
            </button>

            <button
              type="button"
              onClick={() => exportCatalogToExcel(fields, units)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
              title="Xuất danh mục TTHC hiện tại với đầy đủ 11 cột"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm thủ tục lẻ</span>
            </button>
          </div>
        </div>

        {/* TOP KPI OVERVIEW PILLS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
            <span className="text-[11px] text-slate-500 block">Tổng số Lĩnh vực</span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">{stats.totalSectors}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">nhóm thủ tục</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
            <span className="text-[11px] text-slate-500 block">Tổng số Thủ tục hành chính</span>
            <span className="text-lg font-extrabold text-blue-600 font-mono">{stats.totalFields}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">thủ tục trên địa bàn</span>
          </div>

          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-150">
            <span className="text-[11px] text-emerald-700 block">Đã phân công Đơn vị</span>
            <span className="text-lg font-extrabold text-emerald-800 font-mono">{stats.assignedCount}</span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">
              {stats.totalFields > 0 ? ((stats.assignedCount / stats.totalFields) * 100).toFixed(0) : 0}% danh mục
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-150">
            <span className="text-[11px] text-amber-800 block">Chưa phân công</span>
            <span className="text-lg font-extrabold text-amber-900 font-mono">{stats.unassignedCount}</span>
            <span className="text-[10px] text-amber-700 block mt-0.5">cần phân công phụ trách</span>
          </div>
        </div>

        {/* NAVIGATION TABS (Multi-Tab Interface as requested) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pt-2 -mb-2">
          {/* TAB 1: Grouped Table (Primary requested view) */}
          <button
            type="button"
            onClick={() => setActiveTab('grouped')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'grouped'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Bảng phân nhóm Lĩnh vực & Thủ tục</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              {stats.totalFields}
            </span>
          </button>

          {/* TAB 2: Unit Summary Matrix */}
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'matrix'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Tổng hợp theo Đơn vị giải quyết</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              {units.length}
            </span>
          </button>

          {/* TAB 3: Excel Import Workspace */}
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import & Đồng bộ tệp Excel</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Chuẩn 11 cột</span>
            </span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT VIEWS */}
      {activeTab === 'grouped' && (
        <GroupedSectorTable
          fields={fields}
          units={units}
          onEditField={handleOpenEdit}
          onDeleteField={(f) => setDeleteConfirmField(f)}
          onAssignSectorUnit={handleAssignSectorUnit}
          onUpdateFieldUnit={handleUpdateFieldUnit}
        />
      )}

      {activeTab === 'matrix' && (
        <UnitSummaryMatrix
          fields={fields}
          units={units}
          onTransferUnitFields={handleTransferUnitFields}
          onTransferSectorToUnit={handleTransferSectorToUnit}
        />
      )}

      {activeTab === 'import' && (
        <ExcelImportWorkspace
          fields={fields}
          units={units}
          onImportProcedures={handleImportProcedures}
        />
      )}

      {/* MANUAL CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingField ? 'Cập nhật Thủ tục hành chính' : 'Thêm mới Thủ tục hành chính'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitManual} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã TTHC (Chuẩn hóa) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.trim() })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  placeholder="VD: 2.002913, 1.116215"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên thủ tục hành chính <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  placeholder="Nhập tên thủ tục hành chính đầy đủ..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lĩnh vực <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.linh_vuc}
                  onChange={(e) => setFormData({ ...formData, linh_vuc: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                  placeholder="VD: Đất đai, Giảm nghèo, Giáo dục mầm non..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn vị phụ trách giải quyết <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                >
                  <option value="">-- Chưa phân công --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>

                {formData.linh_vuc && (
                  <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="syncSectorCheckbox"
                      checked={syncSector}
                      onChange={(e) => setSyncSector(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor="syncSectorCheckbox"
                      className="text-[11px] text-blue-900 font-medium select-none cursor-pointer leading-relaxed"
                    >
                      Đồng bộ Đơn vị phụ trách này cho tất cả các thủ tục khác thuộc cùng Lĩnh vực{' '}
                      <strong>"{formData.linh_vuc}"</strong> (
                      {
                        fields.filter(
                          (f) =>
                            (f.linh_vuc || '').trim().toLowerCase() === formData.linh_vuc.trim().toLowerCase() &&
                            f.id !== editingField?.id
                        ).length
                      }{' '}
                      thủ tục khác).
                    </label>
                  </div>
                )}
              </div>

              {/* Extended Metadata Fields */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Thông tin mở rộng (Metadata)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cơ quan công bố</label>
                    <input
                      type="text"
                      value={formData.co_quan_cong_bo}
                      onChange={(e) => setFormData({ ...formData, co_quan_cong_bo: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Bộ Tư pháp, UBND..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Loại TTHC</label>
                    <input
                      type="text"
                      value={formData.loai_tthc}
                      onChange={(e) => setFormData({ ...formData, loai_tthc: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: TTHC liên thông"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cơ quan thực hiện</label>
                    <input
                      type="text"
                      value={formData.co_quan_thuc_hien}
                      onChange={(e) => setFormData({ ...formData, co_quan_thuc_hien: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: UBND Cấp xã"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cấp thực hiện</label>
                    <input
                      type="text"
                      value={formData.cap_thuc_hien}
                      onChange={(e) => setFormData({ ...formData, cap_thuc_hien: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Cấp Xã"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mức độ cung cấp</label>
                    <select
                      value={formData.muc_do_cung_cap}
                      onChange={(e) => setFormData({ ...formData, muc_do_cung_cap: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn mức độ --</option>
                      <option value="Toàn trình">Toàn trình</option>
                      <option value="Một phần">Một phần</option>
                      <option value="Chưa cung cấp DVC">Chưa cung cấp DVC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phí & Lệ phí</label>
                    <input
                      type="text"
                      value={formData.phi_le_phi}
                      onChange={(e) => setFormData({ ...formData, phi_le_phi: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Có thu phí, Không quy định, Miễn phí"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  {editingField ? 'Lưu thay đổi' : 'Tạo thủ tục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <span className="p-2 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa Thủ tục</h3>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa thủ tục hành chính sau khỏi danh mục chuẩn? Hành động này không thể hoàn tác.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div className="font-semibold text-slate-800">{deleteConfirmField.name}</div>
                <div className="text-slate-500 font-mono text-[10px] mt-1">Mã: {deleteConfirmField.code}</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed">
                <strong>Bảo vệ dữ liệu lịch sử:</strong> Nếu thủ tục này đã có phát sinh số liệu trong báo cáo đã khóa hoặc phê duyệt, hệ thống sẽ tự động ngăn chặn xóa để đảm bảo tính toàn vẹn.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmField(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <span
              className={`p-1 rounded-lg shrink-0 ${
                notification.type === 'success'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              {notification.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </span>
            <div className="flex-1 text-xs">
              <h5 className="font-bold">{notification.type === 'success' ? 'Thành công' : 'Thông báo'}</h5>
              <p className="text-slate-600 mt-0.5 font-medium leading-relaxed">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
