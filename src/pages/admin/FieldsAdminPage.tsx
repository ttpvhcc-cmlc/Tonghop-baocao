import React, { useState, useMemo, useEffect } from 'react';
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
  HelpCircle,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const FieldsAdminPage: React.FC = () => {
  const [fields, setFields] = useState(store.getFields());
  const units = useMemo(() => store.getUnits(), []);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  // Non-blocking in-app notifications and delete confirmation
  const [deleteConfirmField, setDeleteConfirmField] = useState<Field | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Import Excel catalog states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState({ total: 0, added: 0, updated: 0 });

  // Assign Units by Sector states & helper computations
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [sectorMappings, setSectorMappings] = useState<{ [key: string]: string }>({});

  const sectorsData = useMemo(() => {
    const map: { [sector: string]: { count: number; currentUnitId: string | null } } = {};
    
    fields.forEach(f => {
      const sec = f.linh_vuc || 'Chưa xác định';
      if (!map[sec]) {
        map[sec] = { count: 0, currentUnitId: null };
      }
      map[sec].count++;
      
      if (f.unit_id && !map[sec].currentUnitId) {
        map[sec].currentUnitId = f.unit_id;
      }
    });

    return Object.entries(map).map(([name, data]) => ({
      name,
      count: data.count,
      currentUnitId: data.currentUnitId || ''
    })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [fields]);

  const handleOpenSectorModal = () => {
    const initial: { [key: string]: string } = {};
    sectorsData.forEach(s => {
      initial[s.name] = s.currentUnitId;
    });
    setSectorMappings(initial);
    setIsSectorModalOpen(true);
  };

  const handleApplySectorMappings = () => {
    const updatedFieldsList: Field[] = [];
    
    fields.forEach(f => {
      const sec = f.linh_vuc || 'Chưa xác định';
      const targetUnitId = sectorMappings[sec];
      if (targetUnitId && targetUnitId !== f.unit_id) {
        updatedFieldsList.push({
          ...f,
          unit_id: targetUnitId
        });
      }
    });

    if (updatedFieldsList.length > 0) {
      try {
        store.saveFieldsBulk(updatedFieldsList);
        setFields(store.getFields());
        setNotification({
          message: `Đã cập nhật Đơn vị phụ trách cho ${updatedFieldsList.length} thủ tục theo Lĩnh vực thành công!`,
          type: 'success'
        });
      } catch (err: any) {
        setNotification({
          message: `Có lỗi khi cập nhật: ${err.message}`,
          type: 'error'
        });
      }
    } else {
      setNotification({
        message: 'Không có thay đổi nào cần áp dụng.',
        type: 'success'
      });
    }
    
    setIsSectorModalOpen(false);
  };

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit_id: units[0]?.id || '',
    display_order: 1,
    active: true,
    co_quan_cong_bo: '',
    loai_tthc: '',
    co_quan_thuc_hien: '',
    cap_thuc_hien: '',
    muc_do_cung_cap: '',
    phi_le_phi: '',
    linh_vuc: '',
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
      co_quan_cong_bo: '',
      loai_tthc: '',
      co_quan_thuc_hien: '',
      cap_thuc_hien: '',
      muc_do_cung_cap: '',
      phi_le_phi: '',
      linh_vuc: '',
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
      co_quan_cong_bo: f.co_quan_cong_bo || '',
      loai_tthc: f.loai_tthc || '',
      co_quan_thuc_hien: f.co_quan_thuc_hien || '',
      cap_thuc_hien: f.cap_thuc_hien || '',
      muc_do_cung_cap: f.muc_do_cung_cap || '',
      phi_le_phi: f.phi_le_phi || '',
      linh_vuc: f.linh_vuc || '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteField = (f: Field) => {
    setDeleteConfirmField(f);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmField) return;
    try {
      store.deleteField(deleteConfirmField.id);
      setFields(store.getFields());
      setNotification({ message: `Đã xóa thủ tục "${deleteConfirmField.name}" thành công!`, type: 'success' });
    } catch (err: any) {
      setNotification({ message: err.message || 'Lỗi khi xóa thủ tục hành chính', type: 'error' });
    } finally {
      setDeleteConfirmField(null);
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
      setNotification({ 
        message: editingField ? 'Cập nhật thủ tục thành công!' : 'Thêm thủ tục mới thành công!', 
        type: 'success' 
      });
    } catch (err: any) {
      setNotification({ message: err.message || 'Lỗi khi lưu lĩnh vực', type: 'error' });
    }
  };

  // Helper to guess unit ID based on text keywords from Linh Vuc and Ten TTHC mapping to Registered Units
  const guessUnitId = (coQuanThucHien: string, linhVuc: string, tenTTHC: string): string => {
    const normCoQuan = (coQuanThucHien || '').toLowerCase();
    const normLinhVuc = (linhVuc || '').trim().toLowerCase();
    const normTen = (tenTTHC || '').toLowerCase();

    // 0. CHECK PRE-EXISTING SECTOR ASSIGNMENT MAP FIRST
    const matchedSector = sectorsData.find(s => s.name.trim().toLowerCase() === normLinhVuc);
    if (matchedSector && matchedSector.currentUnitId) {
      return matchedSector.currentUnitId;
    }

    // 1. JUSTICE & VITAL RECORDS (Tư pháp - Hộ tịch / Tư pháp / Pháp luật)
    const isJustice = 
      normLinhVuc.includes('hộ tịch') || 
      normLinhVuc.includes('chứng thực') || 
      normLinhVuc.includes('nuôi con nuôi') || 
      normLinhVuc.includes('tư pháp') ||
      normLinhVuc.includes('pháp luật') ||
      normTen.includes('khai sinh') || 
      normTen.includes('khai tử') || 
      normTen.includes('kết hôn') || 
      normTen.includes('giám hộ') || 
      normTen.includes('chứng thực') || 
      normTen.includes('di chúc') ||
      normTen.includes('nuôi con nuôi') ||
      normTen.includes('thừa kế');

    if (isJustice) {
      const uMatch = units.find(u => {
        const n = u.name.toLowerCase();
        const c = u.code.toLowerCase();
        return n.includes('tư pháp') || n.includes('hộ tịch') || c.includes('tp') || c.includes('ht') || c.includes('tpht');
      });
      if (uMatch) return uMatch.id;
    }

    // 2. LAND, ENVIRONMENT, CONSTRUCTION & AGRICULTURE (Địa chính - Xây dựng / Địa chính - Đất đai)
    const isLandAndBuild = 
      normLinhVuc.includes('đất đai') || 
      normLinhVuc.includes('môi trường') || 
      normLinhVuc.includes('khoáng sản') || 
      normLinhVuc.includes('xây dựng') || 
      normLinhVuc.includes('quy hoạch') || 
      normLinhVuc.includes('nhà ở') || 
      normLinhVuc.includes('đô thị') ||
      normLinhVuc.includes('nông nghiệp') ||
      normLinhVuc.includes('thủy sản') ||
      normLinhVuc.includes('địa chính') ||
      normTen.includes('đất đai') ||
      normTen.includes('nhà ở') ||
      normTen.includes('cấp phép xây dựng') ||
      normTen.includes('quy hoạch') ||
      normTen.includes('giao đất') ||
      normTen.includes('thu hồi đất') ||
      normTen.includes('thủy sản') ||
      normTen.includes('nông nghiệp') ||
      normTen.includes('sổ đỏ');

    if (isLandAndBuild) {
      const uMatch = units.find(u => {
        const n = u.name.toLowerCase();
        const c = u.code.toLowerCase();
        return n.includes('địa chính') || n.includes('tài nguyên') || n.includes('môi trường') || n.includes('xây dựng') || n.includes('nông nghiệp') || n.includes('đô thị') || n.includes('kinh tế') || c.includes('dc') || c.includes('xd') || c.includes('tnmt') || c.includes('pkt') || c.includes('kt');
      });
      if (uMatch) return uMatch.id;
    }

    // 3. CULTURE, SOCIAL AFFAIRS, EDUCATION, HEALTHCARE & POLICIES (Văn hóa - Xã hội / Lao động - Thương binh)
    const isSocial = 
      normLinhVuc.includes('bảo trợ') || 
      normLinhVuc.includes('xã hội') || 
      normLinhVuc.includes('giáo dục') || 
      normLinhVuc.includes('y tế') || 
      normLinhVuc.includes('văn hóa') || 
      normLinhVuc.includes('thể thao') || 
      normLinhVuc.includes('du lịch') || 
      normLinhVuc.includes('người có công') || 
      normLinhVuc.includes('chính sách') ||
      normLinhVuc.includes('lao động') ||
      normLinhVuc.includes('trợ cấp') ||
      normLinhVuc.includes('giảm nghèo') ||
      normTen.includes('người có công') ||
      normTen.includes('trợ cấp') ||
      normTen.includes('chính sách') ||
      normTen.includes('thương binh') ||
      normTen.includes('nghèo') ||
      normTen.includes('giáo dục') ||
      normTen.includes('y tế') ||
      normTen.includes('văn hóa') ||
      normTen.includes('học đường') ||
      normTen.includes('bảo hiểm');

    if (isSocial) {
      const uMatch = units.find(u => {
        const n = u.name.toLowerCase();
        const c = u.code.toLowerCase();
        return n.includes('văn hóa') || n.includes('xã hội') || n.includes('vhxh') || n.includes('lao động') || n.includes('y tế') || c.includes('vh') || c.includes('xh') || c.includes('vhxh') || c.includes('pvhxh');
      });
      if (uMatch) return uMatch.id;
    }

    // 4. MILITARY & NATIONAL DEFENSE (Quân sự - Quốc phòng)
    const isMilitary = 
      normLinhVuc.includes('quân sự') || 
      normLinhVuc.includes('quốc phòng') || 
      normTen.includes('nghĩa vụ quân sự') ||
      normTen.includes('dân quân') ||
      normTen.includes('quân sự');

    if (isMilitary) {
      const uMatch = units.find(u => {
        const n = u.name.toLowerCase();
        const c = u.code.toLowerCase();
        return n.includes('quân sự') || n.includes('quốc phòng') || n.includes('chỉ huy') || c.includes('qs') || c.includes('qp');
      });
      if (uMatch) return uMatch.id;
    }

    // 5. PUBLIC SECURITY & POLICE (Công an)
    const isSecurity = 
      normLinhVuc.includes('công an') || 
      normLinhVuc.includes('an ninh') || 
      normTen.includes('hộ khẩu') ||
      normTen.includes('cư trú') ||
      normTen.includes('tạm trú') ||
      normTen.includes('thường trú') ||
      normTen.includes('định danh') ||
      normTen.includes('căn cước') ||
      normTen.includes('công an');

    if (isSecurity) {
      const uMatch = units.find(u => {
        const n = u.name.toLowerCase();
        const c = u.code.toLowerCase();
        return n.includes('công an') || n.includes('an ninh') || c.includes('ca') || c.includes('an');
      });
      if (uMatch) return uMatch.id;
    }

    // 6. FINANCE, PLANNING & BUDGET (Tài chính - Kế hoạch)
    const isFinance = 
      normLinhVuc.includes('tài chính') || 
      normLinhVuc.includes('ngân sách') || 
      normLinhVuc.includes('kế hoạch') || 
      normLinhVuc.includes('đầu tư') || 
      normLinhVuc.includes('thuế') || 
      normLinhVuc.includes('phí') || 
      normLinhVuc.includes('lệ phí') || 
      normLinhVuc.includes('kinh doanh') ||
      normTen.includes('hộ kinh doanh') ||
      normTen.includes('ngân sách') ||
      normTen.includes('tài chính') ||
      normTen.includes('thuế') ||
      normTen.includes('lệ phí');

    if (isFinance) {
      const uMatch = units.find(u => {
        const n = u.name.toLowerCase();
        const c = u.code.toLowerCase();
        return n.includes('tài chính') || n.includes('kế hoạch') || n.includes('ngân sách') || n.includes('kế toán') || n.includes('kinh tế') || c.includes('tc') || c.includes('kh') || c.includes('tckh') || c.includes('pkt') || c.includes('kt');
      });
      if (uMatch) return uMatch.id;
    }

    // 7. General Fallback with unit name match check
    for (const u of units) {
      const normUnitName = u.name.toLowerCase();
      if (normLinhVuc.includes(normUnitName) || normUnitName.includes(normLinhVuc)) {
        return u.id;
      }
    }

    // Default Fallback is the Office / General Unit (usually contains "Văn phòng" or has "VP" or display_order: 1)
    const vpUnit = units.find(u => u.name.toLowerCase().includes('văn phòng') || u.code.toLowerCase().includes('vp'));
    if (vpUnit) return vpUnit.id;

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
      let colIdxCongBo = 4;  // Default to Column E (idx 4)
      let colIdxLoai = 5;    // Default to Column F (idx 5)
      let colIdxCoQuan = 6;  // Default to Column G (idx 6)
      let colIdxCap = 7;     // Default to Column H (idx 7)
      let colIdxMucDo = 8;   // Default to Column I (idx 8)
      let colIdxPhiLePhi = 9;// Default to Column J (idx 9)

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
            if (cellText.includes('công bố')) colIdxCongBo = idx;
            if (cellText.includes('loại tthc') || cellText.includes('loại thủ tục')) colIdxLoai = idx;
            if (cellText.includes('thực hiện')) colIdxCoQuan = idx;
            if (cellText.includes('cấp thực hiện')) colIdxCap = idx;
            if (cellText.includes('mức độ') || cellText.includes('dịch vụ công')) colIdxMucDo = idx;
            if (cellText.includes('phí') || cellText.includes('lệ phí')) colIdxPhiLePhi = idx;
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
        const rawCongBo = String(row[colIdxCongBo] || '').trim();
        const rawLoai = String(row[colIdxLoai] || '').trim();
        const rawCoQuan = String(row[colIdxCoQuan] || '').trim();
        const rawCap = String(row[colIdxCap] || '').trim();
        const rawMucDo = String(row[colIdxMucDo] || '').trim();
        const rawPhiLePhi = String(row[colIdxPhiLePhi] || '').trim();

        // Skip rows without valid codes or names
        if (!rawCode || !rawName || rawCode === 'Mã TTHC' || rawName === 'Tên Thủ tục hành chính') {
          continue;
        }

        const guessedUnit = guessUnitId(rawCoQuan, rawLinhVuc, rawName);
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
          co_quan_cong_bo: rawCongBo,
          loai_tthc: rawLoai,
          co_quan_thuc_hien: rawCoQuan,
          cap_thuc_hien: rawCap,
          muc_do_cung_cap: rawMucDo,
          phi_le_phi: rawPhiLePhi,
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
          active: true,
          linh_vuc: row.linh_vuc,
          co_quan_cong_bo: row.co_quan_cong_bo,
          loai_tthc: row.loai_tthc,
          co_quan_thuc_hien: row.co_quan_thuc_hien,
          cap_thuc_hien: row.cap_thuc_hien,
          muc_do_cung_cap: row.muc_do_cung_cap,
          phi_le_phi: row.phi_le_phi
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
            onClick={handleOpenSectorModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors shadow-xs"
          >
            <Layers className="w-4 h-4 text-amber-600" />
            <span>Phân công theo Lĩnh vực</span>
          </button>

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
                    <td className="p-3 max-w-xl leading-relaxed">
                      <div className="font-semibold text-slate-900 mb-1.5">{f.name}</div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                        {f.linh_vuc && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Lĩnh vực: {f.linh_vuc}</span>}
                        {f.co_quan_cong_bo && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Cơ quan công bố: {f.co_quan_cong_bo}</span>}
                        {f.loai_tthc && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Loại: {f.loai_tthc}</span>}
                        {f.co_quan_thuc_hien && <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">Thực hiện: {f.co_quan_thuc_hien}</span>}
                        {f.cap_thuc_hien && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Cấp: {f.cap_thuc_hien}</span>}
                        {f.muc_do_cung_cap && (
                          <span className="bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded border border-blue-200">
                            Mức độ: {f.muc_do_cung_cap}
                          </span>
                        )}
                        {f.phi_le_phi && (
                          <span className="bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded border border-emerald-200">
                            Phí/Lệ phí: {f.phi_le_phi}
                          </span>
                        )}
                      </div>
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
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-200">
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

              {/* Extended Metadata Fields */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Thông tin mở rộng (Metadata)
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lĩnh vực</label>
                    <input
                      type="text"
                      value={formData.linh_vuc}
                      onChange={(e) => setFormData({ ...formData, linh_vuc: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Đất đai"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cơ quan công bố</label>
                    <input
                      type="text"
                      value={formData.co_quan_cong_bo}
                      onChange={(e) => setFormData({ ...formData, co_quan_cong_bo: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Bộ Tài nguyên..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Loại TTHC</label>
                    <input
                      type="text"
                      value={formData.loai_tthc}
                      onChange={(e) => setFormData({ ...formData, loai_tthc: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Thủ tục liên thông"
                    />
                  </div>
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
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mức độ cung cấp</label>
                    <input
                      type="text"
                      value={formData.muc_do_cung_cap}
                      onChange={(e) => setFormData({ ...formData, muc_do_cung_cap: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Toàn trình"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phí & Lệ phí</label>
                  <input
                    type="text"
                    value={formData.phi_le_phi}
                    onChange={(e) => setFormData({ ...formData, phi_le_phi: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: Miễn phí hoặc 10.000đ"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
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
                  <h4 className="font-bold text-slate-800 mb-1">Hướng dẫn cột trong file Excel (Nhập đầy đủ):</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Mã TTHC (Cột B):</strong> VD: <code className="bg-slate-200 px-1 rounded text-red-600 font-bold">2.002913</code></li>
                    <li><strong>Tên Thủ tục (Cột C):</strong> Tên đầy đủ của thủ tục hành chính</li>
                    <li><strong>Lĩnh vực (Cột D) & Cơ quan công bố (Cột E)</strong></li>
                    <li><strong>Loại TTHC (Cột F) & Cơ quan thực hiện (Cột G)</strong></li>
                    <li><strong>Cấp thực hiện (Cột H), Mức độ (Cột I) & Phí - Lệ phí (Cột J)</strong></li>
                  </ul>
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Quy tắc thông minh:</h4>
                    <p>Hệ thống tự động đồng bộ hóa: Nếu Mã TTHC đã tồn tại sẽ **Cập nhật toàn bộ metadata mới**, nếu chưa có sẽ **Thêm mới**. Đồng thời tự động phân bổ đơn vị phụ trách giải quyết dựa trên từ khóa ở cột cơ quan thực hiện!</p>
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

                  <div className="border border-slate-200 rounded-xl overflow-x-auto overflow-y-auto max-h-[350px]">
                    <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
                      <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="p-2.5 w-12 text-center">STT</th>
                          <th className="p-2.5 w-24">Mã TTHC</th>
                          <th className="p-2.5 w-64">Tên Thủ tục</th>
                          <th className="p-2.5 w-36">Lĩnh vực</th>
                          <th className="p-2.5 w-36">Cơ quan công bố</th>
                          <th className="p-2.5 w-32">Loại TTHC</th>
                          <th className="p-2.5 w-40">Cơ quan thực hiện</th>
                          <th className="p-2.5 w-28">Cấp thực hiện</th>
                          <th className="p-2.5 w-28">Mức độ cung cấp</th>
                          <th className="p-2.5 w-32">Phí - lệ phí</th>
                          <th className="p-2.5 w-56 sticky right-0 bg-slate-50 border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] z-20">Đơn vị phụ trách (Điều chỉnh)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
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
                            <td className="p-2 font-medium text-slate-900 leading-relaxed max-w-xs break-words" title={row.name}>
                              {row.name}
                            </td>
                            <td className="p-2 text-slate-600">{row.linh_vuc}</td>
                            <td className="p-2 text-slate-500 text-[11px]">{row.co_quan_cong_bo}</td>
                            <td className="p-2 text-slate-500 text-[11px]">{row.loai_tthc}</td>
                            <td className="p-2 text-slate-600 font-medium text-[11px]">{row.co_quan_thuc_hien}</td>
                            <td className="p-2 text-slate-500 text-[11px]">{row.cap_thuc_hien}</td>
                            <td className="p-2">
                              {row.muc_do_cung_cap && (
                                <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] border border-blue-200">
                                  {row.muc_do_cung_cap}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-slate-600 text-[11px]">{row.phi_le_phi}</td>
                            <td className="p-2 sticky right-0 bg-white hover:bg-slate-50 border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] z-10">
                              <select
                                value={row.guessed_unit_id}
                                onChange={(e) => handleUpdateParsedRowUnit(idx, e.target.value)}
                                className="w-full text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
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

      {/* CUSTOM FLOATING TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            <span className={`p-1 rounded-lg ${
              notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}>
              {notification.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </span>
            <div className="flex-1">
              <h5 className="text-xs font-bold">{notification.type === 'success' ? 'Thành công' : 'Không thể thực hiện'}</h5>
              <p className="text-[11px] text-slate-600 mt-0.5 font-medium leading-relaxed">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteConfirmField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <span className="p-2 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa Thủ tục</h3>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa thủ tục hành chính sau khỏi danh mục chuẩn hóa? Hành động này không thể hoàn tác.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div className="font-semibold text-slate-800">{deleteConfirmField.name}</div>
                <div className="text-slate-500 font-mono text-[10px] mt-1">Mã thủ tục: {deleteConfirmField.code}</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed">
                <strong>Lưu ý về Toàn vẹn dữ liệu:</strong> Nếu thủ tục này đã được sử dụng và có phát sinh số liệu trong bất kỳ báo cáo nào trước đây, hệ thống và cơ sở dữ liệu Supabase sẽ <strong>từ chối xóa</strong> để bảo vệ tính toàn vẹn dữ liệu lịch sử.
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

      {/* SECTOR-BASED RESPONSIBLE UNIT ASSIGNMENT MODAL */}
      {isSectorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-150 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3 text-amber-600">
                <span className="p-2 bg-amber-50 border border-amber-200 rounded-xl">
                  <Layers className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Phân công Đơn vị theo Lĩnh vực</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Áp dụng đơn vị phụ trách nhanh cho tất cả thủ tục cùng Lĩnh vực</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSectorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="bg-blue-50 border border-blue-150 rounded-xl p-3 text-[11px] text-blue-800 leading-relaxed">
                <strong>💡 Mẹo tiết kiệm thời gian:</strong> Chọn Đơn vị phụ trách cho từng Lĩnh vực bên dưới. Khi nhấn <strong>"Lưu & Áp dụng"</strong>, tất cả các thủ tục hành chính có tên Lĩnh vực tương ứng sẽ được tự động ánh xạ sang đơn vị đó. Điều này cũng giúp tự động phân loại chính xác khi bạn import file Excel mới sau này!
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-3">Lĩnh vực ({sectorsData.length})</th>
                      <th className="p-3 text-center w-28">Số thủ tục</th>
                      <th className="p-3 w-72">Đơn vị phụ trách giải quyết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {sectorsData.map((s) => (
                      <tr key={s.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{s.name}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {s.count}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={sectorMappings[s.name] || ''}
                            onChange={(e) => setSectorMappings({
                              ...sectorMappings,
                              [s.name]: e.target.value
                            })}
                            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                          >
                            <option value="">-- Chưa phân công --</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.code})
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

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsSectorModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleApplySectorMappings}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Lưu & Áp dụng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

