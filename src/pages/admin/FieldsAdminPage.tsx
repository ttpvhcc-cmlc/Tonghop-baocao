import React, { useState, useMemo } from 'react';
import { store } from '../../services/store';
import { Field } from '../../types/database';
import { 
  FolderKanban, 
  Plus, 
  Edit2, 
  X, 
  Search, 
  Trash2, 
  FileSpreadsheet, 
  Upload, 
  Check, 
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const FieldsAdminPage: React.FC = () => {
  const [fields, setFields] = useState(store.getFields());
  const units = useMemo(() => store.getUnits(), []);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  // Import Excel catalog states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState({ total: 0, added: 0, updated: 0 });

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
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.code.toLowerCase().includes(search.toLowerCase())) return false;
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
    if (window.confirm(`Bạn có chắc chắn muốn xóa lĩnh vực/thủ tục "${f.name}" (${f.code})?`)) {
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

  // Helper to guess unit ID based on text keywords (e.g. "xã" -> UBND Cấp Xã, "Phòng" -> Phòng chuyên môn)
  const guessUnitId = (coQuanThucHien: string, linhVuc: string): string => {
    const normCoQuan = (coQuanThucHien || '').toLowerCase();
    const normLinhVuc = (linhVuc || '').toLowerCase();

    // Loop through units to check for exact/partial names
    for (const u of units) {
      const normUnitName = u.name.toLowerCase();
      if (normCoQuan.includes(normUnitName) || normUnitName.includes(normCoQuan)) {
        return u.id;
      }
    }

    // Keyword heuristics
    if (normCoQuan.includes('xã') || normCoQuan.includes('phường') || normCoQuan.includes('thị trấn') || normCoQuan.includes('ấp')) {
      const xaUnit = units.find(u => u.name.toLowerCase().includes('xã') || u.code.toLowerCase().includes('xa'));
      if (xaUnit) return xaUnit.id;
    }

    if (normCoQuan.includes('huyện') || normCoQuan.includes('quận') || normCoQuan.includes('thị xã') || normCoQuan.includes('phòng')) {
      const huyenUnit = units.find(u => u.name.toLowerCase().includes('huyện') || u.code.toLowerCase().includes('huyen') || u.name.toLowerCase().includes('phòng'));
      if (huyenUnit) return huyenUnit.id;
    }

    if (normLinhVuc.includes('đất đai') || normLinhVuc.includes('môi trường') || normLinhVuc.includes('khoáng sản')) {
      const tnmtUnit = units.find(u => u.name.toLowerCase().includes('tài nguyên') || u.code.toLowerCase().includes('tnmt'));
      if (tnmtUnit) return tnmtUnit.id;
    }

    if (normLinhVuc.includes('xây dựng') || normLinhVuc.includes('quy hoạch') || normLinhVuc.includes('nhà ở')) {
      const qlydtUnit = units.find(u => u.name.toLowerCase().includes('đô thị') || u.name.toLowerCase().includes('xây dựng') || u.code.toLowerCase().includes('xd'));
      if (qlydtUnit) return qlydtUnit.id;
    }

    return units[0]?.id || '';
  };

  // Parse Excel catalog on file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      let startIndex = -1;
      let colIdxMa = 1;      // Default to Column B (idx 1)
      let colIdxTen = 2;     // Default to Column C (idx 2)
      let colIdxLinhVuc = 3; // Default to Column D (idx 3)
      let colIdxCoQuan = 6;  // Default to Column G (idx 6)

      // Find the header row
      for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const row = rawRows[i];
        const rowText = row.map(cell => String(cell).toLowerCase()).join(' ');
        if (rowText.includes('mã tthc') || rowText.includes('tên thủ tục') || rowText.includes('lĩnh vực')) {
          startIndex = i + 1; // Data starts at the next row
          
          // Map indexes dynamically if headers differ slightly
          row.forEach((cell, idx) => {
            const cellText = String(cell).toLowerCase().trim();
            if (cellText.includes('mã tthc') || cellText.includes('mã thủ tục')) colIdxMa = idx;
            if (cellText.includes('tên thủ tục') || cellText.includes('tên tthc')) colIdxTen = idx;
            if (cellText.includes('lĩnh vực')) colIdxLinhVuc = idx;
            if (cellText.includes('thực hiện')) colIdxCoQuan = idx;
          });
          break;
        }
      }

      // If no headers found, fallback to row 4 index (typical for standard administrative tables)
      if (startIndex === -1) {
        startIndex = 1; // Fallback to starting from second row
      }

      const tempRows: any[] = [];
      let total = 0;
      let added = 0;
      let updated = 0;

      for (let i = startIndex; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const rawCode = String(row[colIdxMa] || '').trim();
        const rawName = String(row[colIdxTen] || '').trim();
        const rawLinhVuc = String(row[colIdxLinhVuc] || '').trim();
        const rawCoQuan = String(row[colIdxCoQuan] || '').trim();

        // Skip rows without valid codes or names
        if (!rawCode || !rawName || rawCode === 'Mã TTHC' || rawName === 'Tên Thủ tục hành chính') {
          continue;
        }

        const guessedUnit = guessUnitId(rawCoQuan, rawLinhVuc);
        const existingField = fields.find(f => f.code === rawCode);

        total++;
        if (existingField) {
          updated++;
        } else {
          added++;
        }

        tempRows.push({
          code: rawCode,
          name: rawName,
          linh_vuc: rawLinhVuc,
          co_quan_thuc_hien: rawCoQuan,
          guessed_unit_id: existingField ? existingField.unit_id : guessedUnit,
          isExisting: !!existingField,
          existingId: existingField?.id
        });
      }

      setParsedRows(tempRows);
      setImportStats({ total, added, updated });
    };

    reader.readAsBinaryString(file);
  };

  const handleUpdateParsedRowUnit = (index: number, unitId: string) => {
    const updated = [...parsedRows];
    updated[index].guessed_unit_id = unitId;
    setParsedRows(updated);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);

    try {
      let count = 0;
      for (const row of parsedRows) {
        store.saveField({
          id: row.isExisting ? row.existingId : undefined,
          code: row.code,
          name: row.name,
          unit_id: row.guessed_unit_id,
          display_order: fields.length + count + 1,
          active: true
        });
        count++;
      }

      // Refresh cache and view
      const updatedFields = store.getFields();
      setFields(updatedFields);
      alert(`Nhập thành công ${parsedRows.length} thủ tục hành chính vào danh mục chuẩn!`);
      
      // Clean up states
      setExcelFile(null);
      setParsedRows([]);
      setIsImportModalOpen(false);
    } catch (err: any) {
      alert(`Có lỗi xảy ra khi nhập danh mục: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsImporting(false);
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
              Danh mục Thủ tục hành chính & Đơn vị phụ trách
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý tên thủ tục chuẩn hóa theo mã ngành. Import file Excel danh mục để tự động cập nhật và phân bổ Đơn vị phụ trách.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import từ Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm thủ tục lẻ</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm thủ tục hành chính, mã số, hoặc đơn vị..."
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
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Hiển thị {filteredFields.length} thủ tục trong danh mục chuẩn hóa
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Click nút sửa bút chì ✎ để thay đổi Đơn vị phụ trách</span>
          </div>
        </div>

        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3 w-16 text-center">Thứ tự</th>
              <th className="p-3">Mã TTHC (Chuẩn)</th>
              <th className="p-3">Tên Thủ tục hành chính</th>
              <th className="p-3">Đơn vị phụ trách (Ánh xạ giải quyết)</th>
              <th className="p-3 text-center">Trạng thái</th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFields.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Chưa có thủ tục nào được thiết lập. Hãy nhấn "Import từ Excel" để khởi tạo danh mục tự động.
                </td>
              </tr>
            ) : (
              filteredFields.map((f) => {
                const uObj = units.find((u) => u.id === f.unit_id);
                return (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-mono font-bold text-slate-400">
                      {f.display_order}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-700">{f.code}</td>
                    <td className="p-3 font-semibold text-slate-900 max-w-lg leading-relaxed">
                      {f.name}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 font-medium text-xs border border-blue-200 whitespace-nowrap">
                        {uObj?.name || 'Chưa gán'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {f.active ? (
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
                          onClick={() => handleOpenEdit(f)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Sửa tên hoặc đổi đơn vị phụ trách"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteField(f)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Xóa thủ tục"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MANUAL CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingField ? 'Cập nhật Thủ tục hành chính' : 'Thêm Thủ tục hành chính lẻ'}
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
                  Mã TTHC (Chuẩn hóa)
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
                  Tên thủ tục hành chính
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
                  Đơn vị phụ trách giải quyết <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1.5 block leading-relaxed">
                  Đơn vị này chịu trách nhiệm báo cáo, kiểm soát chỉ tiêu thời gian giải quyết đối với thủ tục này.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="field-active-check"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="field-active-check" className="text-xs font-semibold text-slate-700">
                    Đang hoạt động
                  </label>
                </div>
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
                  {editingField ? 'Lưu thay đổi' : 'Tạo thủ tục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Nhập danh mục thủ tục chuẩn từ tệp Excel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExcelFile(null);
                  setParsedRows([]);
                  setIsImportModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Instructions */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Hướng dẫn cột trong file Excel:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Mã TTHC (Cột B):</strong> VD: <code className="bg-slate-200 px-1 rounded text-red-600 font-bold">2.002913</code> (Dùng làm mã định danh duy nhất)</li>
                    <li><strong>Tên Thủ tục (Cột C):</strong> Tên đầy đủ của thủ tục hành chính</li>
                    <li><strong>Lĩnh vực (Cột D):</strong> Lĩnh vực quản lý (Ví dụ: Đất đai, Giảm nghèo...)</li>
                    <li><strong>Thực hiện (Cột G):</strong> Cơ quan giải quyết để hệ thống gợi ý Đơn vị phụ trách</li>
                  </ul>
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Quy tắc thông minh:</h4>
                    <p>Hệ thống tự động rà soát: Nếu Mã TTHC đã tồn tại sẽ **Cập nhật tên mới**, nếu chưa có sẽ **Thêm mới**. Đồng thời tự động phân luồng đơn vị phụ trách dựa trên từ khóa cơ quan thực hiện!</p>
                  </div>
                </div>
              </div>

              {/* Upload Input Area */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50/30 hover:bg-slate-50/50 transition-all relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <div className="mx-auto w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-blue-600">Click để chọn tệp</span> hoặc kéo thả file Excel vào đây
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Hỗ trợ định dạng .xlsx, .xls
                  </div>
                </div>
              </div>

              {/* File Info & Stats */}
              {excelFile && parsedRows.length > 0 && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      {excelFile.name}
                    </div>
                    <div className="text-[11px] text-blue-700 mt-1">
                      Kích thước: {(excelFile.size / 1024).toFixed(1)} KB — Đã phân tích thành công.
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="text-slate-700">
                      Tổng số: <span className="font-mono font-bold text-blue-600">{importStats.total}</span>
                    </div>
                    <div className="text-emerald-700">
                      Thêm mới: <span className="font-mono font-bold">{importStats.added}</span>
                    </div>
                    <div className="text-amber-700">
                      Cập nhật: <span className="font-mono font-bold">{importStats.updated}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rows Preview & Realtime Editor */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">
                    Xem trước danh sách và Điều chỉnh nhanh Đơn vị phụ trách trước khi lưu:
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="p-2.5 w-12 text-center">STT</th>
                          <th className="p-2.5 w-24">Mã TTHC</th>
                          <th className="p-2.5">Tên Thủ tục</th>
                          <th className="p-2.5">Lĩnh vực</th>
                          <th className="p-2.5">Thực hiện</th>
                          <th className="p-2.5 w-56">Đơn vị phụ trách (Điều chỉnh)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.map((row, idx) => (
                          <tr key={`p_${idx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2 text-center font-mono text-slate-400 font-semibold">{idx + 1}</td>
                            <td className="p-2 font-mono font-bold text-blue-600">
                              {row.code}
                              {row.isExisting && (
                                <span className="block text-[9px] text-amber-600 font-sans font-semibold mt-0.5">
                                  Đã có - Sẽ cập nhật
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-medium text-slate-900 leading-relaxed max-w-xs line-clamp-2" title={row.name}>
                              {row.name}
                            </td>
                            <td className="p-2 text-slate-500">{row.linh_vuc}</td>
                            <td className="p-2 text-slate-400 italic text-[11px]">{row.co_quan_thuc_hien}</td>
                            <td className="p-2">
                              <select
                                value={row.guessed_unit_id}
                                onChange={(e) => handleUpdateParsedRowUnit(idx, e.target.value)}
                                className="w-full text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium"
                              >
                                {units.map((u) => (
                                  <option key={`opt_${u.id}`} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setExcelFile(null);
                  setParsedRows([]);
                  setIsImportModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={parsedRows.length === 0 || isImporting}
                onClick={handleExecuteImport}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang cập nhật danh mục...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Xác nhận Lưu {parsedRows.length} thủ tục</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

