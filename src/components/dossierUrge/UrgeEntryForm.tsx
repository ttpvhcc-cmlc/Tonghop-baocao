import React, { useState, useEffect } from 'react';
import {
  FileText,
  Zap,
  CheckCircle2,
  Building2,
  User,
  Calendar,
  Layers,
  Flame,
  Cpu,
  Phone,
  MapPin,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Send,
  Clock,
  Copy,
  Check,
  MessageSquare,
  Edit3,
  PlusCircle,
} from 'lucide-react';
import { UrgeChannel, ExtractedUrgeInfo } from '../../types/dossierUrge';
import { dossierUrgeStore } from '../../services/dossierUrgeStore';
import { extractDossierInfoRuleBased } from '../../utils/dossierExtractor';
import { detectSensitiveIds, removeSensitiveIds } from '../../utils/privacySanitizer';
import { store } from '../../services/store';
import { Unit, Field } from '../../types/database';

import { DossierUrgeRecord } from '../../types/dossierUrge';

interface UrgeEntryFormProps {
  onSuccess?: (dossierCode: string) => void;
  onCancelEdit?: () => void;
  initialRecord?: DossierUrgeRecord | null;
}

export const UrgeEntryForm: React.FC<UrgeEntryFormProps> = ({ onSuccess, onCancelEdit, initialRecord }) => {
  const currentUser = store.getCurrentUser();

  // Danh mục đơn vị giải quyết và lĩnh vực TTHC từ Store
  const [units, setUnits] = useState<Unit[]>([]);
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    const loadCatalogs = () => {
      setUnits(store.getUnits().filter((u) => u.active !== false));
      setFields(store.getFields().filter((f) => f.active !== false));
    };
    loadCatalogs();
    return store.subscribe(loadCatalogs);
  }, []);

  // Soạn thảo nội dung
  const [content, setContent] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [hasExtracted, setHasExtracted] = useState<boolean>(false);

  // 1. Hình thức đôn đốc (Trực tiếp / Điện thoại)
  const [channel, setChannel] = useState<UrgeChannel>('direct');

  // 2. Đơn vị chủ trì (Chọn từ Danh mục quản trị / Tự động gán theo gợi ý Kiểm soát TTHC)
  const [assignedUnit, setAssignedUnit] = useState<string>('');

  // 3. Người thụ lý (Không bắt buộc)
  const [processorName, setProcessorName] = useState<string>('');

  // 4. Mã hồ sơ (Bắt buộc)
  const [dossierCode, setDossierCode] = useState<string>('');

  // 5. Tên Công dân / Tổ chức (Bắt buộc)
  const [citizenName, setCitizenName] = useState<string>('');

  // 6. Số điện thoại (Không bắt buộc)
  const [phone, setPhone] = useState<string>('');

  // 7. Địa chỉ (Không bắt buộc)
  const [address, setAddress] = useState<string>('');

  // 8. Thủ tục (Bắt buộc)
  const [procedureName, setProcedureName] = useState<string>('');

  // 9. Ngày nhận (Bắt buộc)
  const [receivedDate, setReceivedDate] = useState<string>('');

  // 10. Ngày hẹn trả (Bắt buộc)
  const [appointmentDate, setAppointmentDate] = useState<string>('');

  // 11. Ghi chú (Không bắt buộc - Bổ sung theo yêu cầu)
  const [notes, setNotes] = useState<string>('');

  // 12. Thời gian tiếp nhận (định dạng dd/mm/yy hh:mm - Lấy khi bấm nút Bóc tách thông tin)
  const [receptionTime, setReceptionTime] = useState<string>('');

  // 13. Nội dung Đề nghị
  const [proposal, setProposal] = useState<string>('');

  // 14. SMS Đôn đốc được tạo sau khi bấm Ghi nhận & Phát hành đôn đốc (KHÔNG lưu DB)
  const [generatedSms, setGeneratedSms] = useState<string>('');
  const [copiedSms, setCopiedSms] = useState<boolean>(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  // Trạng thái khóa/mở nút theo yêu cầu mới
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialRecord) {
      setDossierCode(initialRecord.dossier_code || '');
      setCitizenName(initialRecord.citizen_name || '');
      setPhone(initialRecord.phone || '');
      setAddress(initialRecord.address || '');
      setProcedureName(initialRecord.procedure_name || '');
      setReceivedDate(initialRecord.received_date || '');
      setAppointmentDate(initialRecord.appointment_date || '');
      setAssignedUnit(initialRecord.assigned_unit || '');
      setProcessorName(initialRecord.processor_name || '');
      setNotes(initialRecord.notes || '');
      setReceptionTime(initialRecord.reception_time || '');
      setChannel(initialRecord.channel || 'direct');
      setEditingId(initialRecord.id);
      setIsSaved(false); // Enable editing right away!
      setIsEditing(true); // Enable editing right away!
      setGeneratedSms('');
    }
  }, [initialRecord]);

  const sysConfig = store.getSystemConfig();

  const formatReceptionTime = (d: Date = new Date()) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getDefaultProposal = (unitName: string) => {
    const name = unitName.trim() || '[Đơn vị chủ trì]';
    const template = sysConfig.urgeProposalTemplate || 'Đề nghị {unit} chỉ đạo xử lý, phản hồi và giải thích cho Công dân/ tổ chức đảm bảo theo quy định về giải quyết TTHC.';
    return template.replace(/\{unit\}/g, name).replace(/\{assigned_unit\}/g, name);
  };

  const formatToDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const generateSmsContent = () => {
    const statusTag = channel === 'direct' ? '[CÔNG DÂN ĐANG CHỜ]' : '[PHẢN ÁNH QUA ĐIỆN THOẠI]';
    const defaultTemplate = '[TB] {status_tag} Mã hồ sơ: {dossier_code} của {citizen_name}.\nThủ tục: {procedure_name}.\nNgày nhận: {received_date}, Hạn trả: {appointment_date}.\nĐề nghị {unit} chỉ đạo xử lý đảm bảo theo quy định về giải quyết TTHC, phản hồi và giải thích cho Công dân/tổ chức.';
    const template = sysConfig.urgeContentTemplate || defaultTemplate;
    
    const fmtReceived = formatToDDMMYYYY(receivedDate) || '[Ngày nhận]';
    const fmtAppointment = formatToDDMMYYYY(appointmentDate) || '[Hạn trả]';

    return template
      .replace(/\[TRẠNG THÁI\]/g, statusTag)
      .replace(/\{status_tag\}/g, statusTag)
      .replace(/\{status\}/g, statusTag)
      .replace(/\{dossier_code\}/g, dossierCode.trim() || '[Mã hồ sơ]')
      .replace(/\{citizen_name\}/g, citizenName.trim() || '[Tên công dân]')
      .replace(/\{phone\}/g, phone.trim() || '[Điện thoại]')
      .replace(/\{notes\}/g, notes.trim() || '[Ghi chú]')
      .replace(/\{procedure_name\}/g, procedureName.trim() || '[Thủ tục]')
      .replace(/\{received_date\}/g, fmtReceived)
      .replace(/\{appointment_date\}/g, fmtAppointment)
      .replace(/\{assigned_unit\}/g, assignedUnit.trim() || '[Đơn vị chủ trì]')
      .replace(/\{unit\}/g, assignedUnit.trim() || '[Đơn vị chủ trì]')
      .replace(/\{reception_time\}/g, receptionTime || formatReceptionTime());
  };

  // Kiểm tra số định danh nhạy cảm trong nội dung người dùng nhập
  const sensitiveIdsFound = React.useMemo(() => {
    return detectSensitiveIds(content);
  }, [content]);

  // Tự động kiểm tra số lần đôn đốc của hồ sơ này trong quá khứ (loại trừ bản ghi vừa ghi nhận thành công trong phiên này)
  const previousUrges = dossierCode.trim()
    ? dossierUrgeStore.getDossierUrgeHistory(dossierCode.trim()).filter(r => r.id !== justCreatedId)
    : [];
  const previousCount = previousUrges.length;
  const currentUrgeNumber = previousCount + 1;

  // Xóa số định danh tự động bằng 1 cú nhấp
  const handleAutoRemoveSensitiveIds = () => {
    const cleaned = removeSensitiveIds(content);
    setContent(cleaned);
  };

  // Sao chép tin nhắn đôn đốc (SMS) vào clipboard
  const handleCopySms = async () => {
    if (!generatedSms) return;
    try {
      await navigator.clipboard.writeText(generatedSms);
      setCopiedSms(true);
      setTimeout(() => setCopiedSms(false), 2500);
    } catch (err) {
      console.error('Failed to copy SMS:', err);
    }
  };

  // Kích hoạt bóc tách ngôn ngữ tự nhiên bằng quy tắc (100% Client-side, không dùng AI, 0 credit)
  const handleTriggerExtract = () => {
    const raw = content.trim();
    if (!raw) {
      alert('Vui lòng nhập nội dung công dân phản ánh trước khi bóc tách.');
      return;
    }

    // YÊU CẦU: Nếu có chứa số định danh/CCCD thì yêu cầu xóa trước khi thực hiện bóc tách
    if (sensitiveIdsFound.length > 0) {
      alert(
        `Nội dung đang chứa số định danh / CCCD (${sensitiveIdsFound.join(
          ', '
        )}). Vui lòng xóa số định danh trước khi thực hiện bóc tách theo quy định bảo vệ dữ liệu cá nhân.`
      );
      return;
    }

    setIsExtracting(true);

    try {
      const extracted: ExtractedUrgeInfo = extractDossierInfoRuleBased(raw);

      // Cập nhật các trường bóc tách được
      if (extracted.dossier_code) setDossierCode(extracted.dossier_code);
      if (extracted.citizen_name) setCitizenName(extracted.citizen_name);
      if (extracted.phone) setPhone(extracted.phone);
      if (extracted.address) setAddress(extracted.address);
      if (extracted.procedure_name) setProcedureName(extracted.procedure_name);
      if (extracted.received_date) setReceivedDate(extracted.received_date);
      if (extracted.appointment_date) setAppointmentDate(extracted.appointment_date);
      if (extracted.channel) setChannel(extracted.channel);
      if (extracted.processor_name) setProcessorName(extracted.processor_name);

      // YÊU CẦU: Đưa đơn vị Gợi ý vào luôn (không lấy giá trị giả định ngoài danh mục)
      let resolvedUnit = '';

      // 1. Kiểm tra nếu có đơn vị bóc tách được từ văn bản và trùng khớp với danh mục Đơn vị giải quyết
      if (extracted.assigned_unit) {
        const directMatch = units.find(
          (u) =>
            u.name.toLowerCase() === extracted.assigned_unit!.toLowerCase() ||
            extracted.assigned_unit!.toLowerCase().includes(u.name.toLowerCase()) ||
            u.name.toLowerCase().includes(extracted.assigned_unit!.toLowerCase())
        );
        if (directMatch) resolvedUnit = directMatch.name;
      }

      // 2. Gợi ý tự động dựa vào Thủ tục trong Kiểm soát TTHC (Fields)
      if (!resolvedUnit && extracted.procedure_name && fields.length > 0) {
        const pLower = extracted.procedure_name.toLowerCase();

        const matchedField =
          fields.find((f) => f.name.toLowerCase() === pLower) ||
          fields.find((f) => f.name.toLowerCase().includes(pLower) || pLower.includes(f.name.toLowerCase())) ||
          fields.find((f) => {
            const words = f.name.toLowerCase().split(/[\s,–\-()]+/).filter((w) => w.length > 3);
            const hits = words.filter((w) => pLower.includes(w)).length;
            return hits >= 2;
          }) ||
          fields.find((f) => f.linh_vuc && pLower.includes(f.linh_vuc.toLowerCase()));

        if (matchedField && matchedField.unit_id) {
          const u = units.find((item) => item.id === matchedField.unit_id);
          if (u) resolvedUnit = u.name;
        }
      }

      // 3. Phân loại theo Từ khóa chuyên môn (Strict Domain Keywords)
      if (!resolvedUnit && units.length > 0) {
        const combinedText = (raw + ' ' + (extracted.procedure_name || '')).toLowerCase();

        // 3.1. Đất đai / Tài nguyên & Môi trường / Địa chính / Nông nghiệp
        if (/đất\s*đai|địa\s*chính|cấp\s*giấy|sổ\s*đỏ|tài\s*sản\s*gắn\s*liền|quyền\s*sử\s*dụng\s*đất|ranh\s*giới|đo\s*đạc|thừa\s*kế\s*đất/i.test(combinedText)) {
          const uLand = units.find((u) => /địa\s*chính|đất\s*đai|tài\s*nguyên|môi\s*trường|kinh\s*tế|nông\s*nghiệp/i.test(u.name));
          if (uLand) resolvedUnit = uLand.name;
        }
        // 3.2. Xây dựng / Quy hoạch / Đô thị / Nhà ở
        else if (/xây\s*dựng|quy\s*hoạch|nhà\s*ở|cấp\s*phép\s*xây\s*dựng|kiến\s*trúc/i.test(combinedText)) {
          const uBuild = units.find((u) => /xây\s*dựng|đô\s*thị|quản\s*lý|hạ\s*tầng/i.test(u.name));
          if (uBuild) resolvedUnit = uBuild.name;
        }
        // 3.3. Tư pháp / Hộ tịch / Khai sinh / Kết hôn / Chứng thực
        else if (/tư\s*pháp|hộ\s*tịch|khai\s*sinh|kết\s*hôn|chứng\s*thực|khai\s*tử/i.test(combinedText)) {
          const uJustice = units.find((u) => /tư\s*pháp|hộ\s*tịch/i.test(u.name));
          if (uJustice) resolvedUnit = uJustice.name;
        }
        // 3.4. Lao động / Thương binh / Xã hội
        else if (/lao\s*động|thương\s*binh|xã\s*hội|bảo\s*hiểm|trợ\s*cấp/i.test(combinedText)) {
          const uSocial = units.find((u) => /lao\s*động|thương\s*binh|xã\s*hội/i.test(u.name));
          if (uSocial) resolvedUnit = uSocial.name;
        }
        // 3.5. Văn hóa / Thông tin / Truyền thông
        else if (/văn\s*hóa|thông\s*tin|truyền\s*thông|thể\s*thao|du\s*lịch/i.test(combinedText)) {
          const uCulture = units.find((u) => /văn\s*hóa|thông\s*tin/i.test(u.name));
          if (uCulture) resolvedUnit = uCulture.name;
        }
        // 3.6. Tài chính / Kế hoạch / Kinh doanh
        else if (/tài\s*chính|kế\s*hoạch|kinh\s*doanh|doanh\s*nghiệp|thuế|ngân\s*sách/i.test(combinedText)) {
          const uFinance = units.find((u) => /tài\s*chính|kế\s*hoạch|kinh\s*tế/i.test(u.name));
          if (uFinance) resolvedUnit = uFinance.name;
        }
      }

      // TRƯỜNG HỢP KHÔNG NHẬN DIỆN ĐƯỢC CHÍNH XÁC -> ĐỂ TRỐNG THEO YÊU CẦU (KHÔNG GÁN SAI ĐƠN VỊ)
      setAssignedUnit(resolvedUnit || '');

      // Bổ sung Thời gian tiếp nhận (định dạng dd/mm/yy hh:mm tại thời điểm bấm Bóc tách thông tin)
      setReceptionTime(formatReceptionTime(new Date()));

      // Bổ sung nội dung Đề nghị mặc định theo đơn vị chủ trì
      setProposal(getDefaultProposal(resolvedUnit || ''));

      setHasExtracted(true);
    } catch (err) {
      console.error('NLP Extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Làm lại: Để trống toàn bộ các trường
  const handleReset = () => {
    setContent('');
    setChannel('direct');
    setAssignedUnit('');
    setProcessorName('');
    setDossierCode('');
    setCitizenName('');
    setPhone('');
    setAddress('');
    setProcedureName('');
    setReceivedDate('');
    setAppointmentDate('');
    setNotes('');
    setReceptionTime('');
    setProposal('');
    setHasExtracted(false);
    setGeneratedSms('');
    setJustCreatedId(null);
    setEditingId(null);
    setIsSaved(false);
    setIsEditing(false);
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  // Thay đổi đơn vị chủ trì -> Cập nhật gợi ý Đề nghị
  const handleAssignedUnitChange = (unitName: string) => {
    setAssignedUnit(unitName);
    setProposal(getDefaultProposal(unitName));
  };

  // Lưu bản ghi đôn đốc (Save / Update)
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Kiểm tra số định danh trước khi ghi
    if (sensitiveIdsFound.length > 0) {
      alert('Nội dung phản ánh còn chứa số định danh/CCCD. Vui lòng xóa trước khi lưu bản ghi.');
      return;
    }

    // Kiểm tra các trường bắt buộc
    if (!dossierCode.trim()) {
      alert('Vui lòng nhập hoặc bóc tách Mã hồ sơ.');
      return;
    }
    if (!citizenName.trim()) {
      alert('Vui lòng nhập hoặc bóc tách Tên Công dân, tổ chức.');
      return;
    }
    if (!procedureName.trim()) {
      alert('Vui lòng nhập hoặc bóc tách Tên Thủ tục.');
      return;
    }
    if (!receivedDate) {
      alert('Vui lòng nhập hoặc chọn Ngày nhận hồ sơ.');
      return;
    }
    if (!appointmentDate) {
      alert('Vui lòng nhập hoặc chọn Ngày hẹn trả kết quả.');
      return;
    }
    if (!assignedUnit.trim()) {
      alert('Vui lòng chọn Đơn vị chủ trì.');
      return;
    }

    const payload = {
      dossier_code: dossierCode.trim(),
      citizen_name: citizenName.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      procedure_name: procedureName.trim(),
      received_date: receivedDate,
      appointment_date: appointmentDate,
      assigned_unit: assignedUnit.trim(),
      processor_name: processorName.trim() || 'Chưa phân công cán bộ',
      notes: notes.trim() || undefined,
      reception_time: receptionTime.trim() || formatReceptionTime(),
      channel,
      urgency: 'normal' as const,
      status: 'in_progress' as const,
      created_by_name: currentUser.full_name || 'Cán bộ Một cửa',
      created_by_id: currentUser.id,
    };

    if (editingId) {
      // Cập nhật bản ghi hiện tại
      dossierUrgeStore.updateUrge(editingId, payload);
      alert(`Đã cập nhật thành công phiếu đôn đốc hồ sơ ${payload.dossier_code}!`);
    } else {
      // Tạo bản ghi mới
      const newRecord = dossierUrgeStore.createUrge(payload);
      setEditingId(newRecord.id);
      setJustCreatedId(newRecord.id);
      alert(`Đã ghi nhận thành công đôn đốc hồ sơ ${payload.dossier_code}! Bạn có thể nhấn nút "Tạo SMS" để sinh tin nhắn đôn đốc.`);
    }

    setIsSaved(true);
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setIsSaved(false);
    setIsEditing(true);
    setGeneratedSms(''); // Khóa Tạo SMS khi bấm Sửa
  };

  const handleGenerateSms = () => {
    if (!isSaved) {
      alert('Vui lòng lưu thông tin trước khi Tạo SMS.');
      return;
    }
    const sms = generateSmsContent();
    setGeneratedSms(sms);
    setCopiedSms(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* CỘT 1: MỤC 1. Thông tin hồ sơ */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                1. Thông tin hồ sơ
              </h2>
            </div>

            {/* VÙNG CHUYỂN TỪ CỘT PHẢI SANG CỘT TRÁI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              {/* TRƯỜNG: Phản ánh */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phản ánh: <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-5 pt-1.5">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors">
                    <input
                      type="radio"
                      name="urgeChannel"
                      value="direct"
                      checked={channel === 'direct'}
                      onChange={() => setChannel('direct')}
                      disabled={isSaved && !isEditing}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                    <span>Trực tiếp</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors">
                    <input
                      type="radio"
                      name="urgeChannel"
                      value="phone"
                      checked={channel === 'phone'}
                      onChange={() => setChannel('phone')}
                      disabled={isSaved && !isEditing}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                    <span>Qua điện thoại</span>
                  </label>
                </div>
              </div>

              {/* TRƯỜNG: Thời gian tiếp nhận */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Thời gian tiếp nhận:</span>
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={receptionTime}
                    onChange={(e) => setReceptionTime(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Lấy tự động khi bóc tách..."
                    className="w-full text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Ô nhập nội dung */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nội dung công dân phản ánh / yêu cầu đôn đốc: <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={isSaved && !isEditing}
                  placeholder=""
                  className="w-full text-xs font-sans rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all leading-relaxed disabled:opacity-60"
                />
              </div>
            </div>

            {/* Cảnh báo yêu cầu xóa số định danh/CCCD nếu phát hiện */}
            {sensitiveIdsFound.length > 0 && !(isSaved && !isEditing) && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-700 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <span>Phát hiện số định danh cá nhân / CCCD trong nội dung:</span>
                      <span className="font-mono underline font-extrabold">{sensitiveIdsFound.join(', ')}</span>
                    </div>
                    <p className="mt-0.5 text-rose-800 dark:text-rose-200">
                      Theo quy định bảo vệ dữ liệu cá nhân, <strong className="underline">yêu cầu xóa số định danh trước khi thực hiện bóc tách</strong>.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutoRemoveSensitiveIds}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa số định danh tự động
                </button>
              </div>
            )}

            {/* Nút hành động Bóc tách thông tin */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Cán bộ tiếp nhận: <strong className="text-slate-700 dark:text-slate-200">{currentUser.full_name || 'Admin'}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerExtract}
                  disabled={isSaved && !isEditing || isExtracting || !content.trim() || sensitiveIdsFound.length > 0}
                  title={
                    sensitiveIdsFound.length > 0
                      ? 'Yêu cầu xóa số định danh trước khi bóc tách'
                      : 'Bóc tách 100% bằng quy tắc Client-side NLP'
                  }
                  className={`px-4 py-2 text-xs font-bold rounded-xl text-white transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                    (isSaved && !isEditing) || sensitiveIdsFound.length > 0
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : isExtracting
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                  }`}
                >
                  {isExtracting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Đang bóc tách...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      Bóc tách thông tin (Quy tắc NLP)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SMS ĐÔN ĐỐC (Tự động khởi tạo sau khi bấm Tạo SMS - KHÔNG lưu DB) */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span>SMS đôn đốc:</span>
                </label>
              </div>

              <div className="relative bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/60 p-4">
                {generatedSms ? (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <p className="font-sans font-bold text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words whitespace-pre-wrap select-all bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                      {generatedSms}
                    </p>
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-slate-700/60">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Độ dài: <strong className="font-mono font-bold text-slate-800 dark:text-slate-200">{generatedSms.length}</strong> ký tự
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySms}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          copiedSms
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {copiedSms ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Đã sao chép!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Sao chép SMS
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                    Nội dung SMS đôn đốc sẽ hiển thị ở đây.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CỘT 2: MỤC 2. Thông tin phiếu đôn đốc */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  2. Thông tin phiếu đôn đốc
                </h2>
              </div>

              {hasExtracted && (
                <div className="flex items-center gap-2 shrink-0">
                  {(!assignedUnit || !appointmentDate || !dossierCode || !citizenName || !procedureName || !receivedDate) ? (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-800 flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Cần bổ sung thông tin
                    </span>
                  ) : (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Đã bóc tách thành công
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Thông báo hướng dẫn nếu có trường chưa nhận diện được */}
            {hasExtracted && (!assignedUnit || !appointmentDate || !dossierCode || !citizenName || !procedureName || !receivedDate) && (
              <div className="bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-amber-950 dark:text-amber-100">Dấu hiệu nhận biết:</strong> Hệ thống chưa bóc tách đủ do nội dung thiếu hoặc chưa rõ cấu trúc:{' '}
                  <span className="font-semibold underline">
                    {[
                      !assignedUnit && 'Đơn vị chủ trì',
                      !appointmentDate && 'Ngày hẹn trả',
                      !dossierCode && 'Mã hồ sơ',
                      !citizenName && 'Tên công dân',
                      !procedureName && 'Thủ tục',
                      !receivedDate && 'Ngày nhận',
                    ].filter(Boolean).join(', ')}
                  </span>
                  . Vui lòng chọn hoặc nhập trực tiếp vào các trường được đánh dấu viền vàng phía dưới.
                </div>
              </div>
            )}

            {/* CẢNH BÁO NẾU HỒ SƠ ĐÃ BỊ ĐÔN ĐỐC NHIỀU LẦN TRƯỚC ĐÓ */}
            {dossierCode.trim() && previousCount > 0 && !editingId && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-xl p-3.5 flex items-start gap-3 animate-in fade-in duration-300">
                <Flame className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-bold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <span>CẢNH BÁO: HỒ SƠ ĐÔN ĐỐC NHIỀU LẦN</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase">
                      Lần {currentUrgeNumber}
                    </span>
                  </div>
                  <p className="mt-1">
                    Mã hồ sơ <strong className="font-mono font-bold text-slate-900 dark:text-white">{dossierCode}</strong> này đã có <strong className="font-bold text-red-600 dark:text-red-400">{previousCount} lượt đôn đốc</strong> trước đây. Lần ghi nhận này sẽ tự động đánh số là <strong>Lượt đôn đốc Lần {currentUrgeNumber}</strong>.
                  </p>
                  <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    Lần đôn đốc gần nhất: {new Date(previousUrges[previousUrges.length - 1].created_at).toLocaleDateString('vi-VN')} qua hình thức {previousUrges[previousUrges.length - 1].channel === 'direct' ? 'Trực tiếp' : 'Điện thoại'} - Cán bộ thụ lý: {previousUrges[previousUrges.length - 1].processor_name || 'Chưa phân công'}
                  </div>
                </div>
              </div>
            )}

            {/* CÁC TRƯỜNG THÔNG TIN MỤC 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* TRƯỜNG: Mã phiếu đôn đốc */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mã phiếu đôn đốc:
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={editingId && initialRecord ? (initialRecord.ticket_code || '') : 'Tự động khởi tạo sau khi lưu phiếu...'}
                    disabled
                    className="w-full text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 p-2.5 pl-8.5 text-slate-600 dark:text-slate-400"
                  />
                </div>
              </div>

              {/* TRƯỜNG 2: Đơn vị chủ trì (Mặc định: "-- Chọn đơn vị --") */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Đơn vị chủ trì: <span className="text-red-500">*</span></span>
                  {hasExtracted && !assignedUnit && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1 animate-pulse shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa nhận diện - Vui lòng chọn
                    </span>
                  )}
                  {hasExtracted && assignedUnit && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Đã nhận diện
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={assignedUnit}
                    onChange={(e) => handleAssignedUnitChange(e.target.value)}
                    disabled={isSaved && !isEditing}
                    className={`w-full text-xs rounded-xl border p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 font-medium cursor-pointer transition-all disabled:opacity-60 ${
                      hasExtracted && !assignedUnit
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400/40 font-bold text-amber-900 dark:text-amber-200'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-blue-500'
                    }`}
                    required
                  >
                    <option value="">-- Chọn đơn vị --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TRƯỜNG 3: Người thụ lý (KHÔNG BẮT BUỘC) */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Người thụ lý:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Không bắt buộc</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={processorName}
                    onChange={(e) => setProcessorName(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Cán bộ, chuyên viên thụ lý hồ sơ (nếu có)"
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-60"
                  />
                </div>
              </div>

              {/* TRƯỜNG 4: Mã hồ sơ (Bắt buộc) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Mã hồ sơ: <span className="text-red-500">*</span></span>
                  {hasExtracted && !dossierCode && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1 animate-pulse shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa nhận diện
                    </span>
                  )}
                  {hasExtracted && dossierCode && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Đã nhận diện
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={dossierCode}
                    onChange={(e) => setDossierCode(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Nhập hoặc bóc tách mã hồ sơ..."
                    className={`w-full text-xs font-mono rounded-xl border p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 font-bold transition-all disabled:opacity-60 ${
                      hasExtracted && !dossierCode
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400/40'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* TRƯỜNG 5: Tên Công dân, tổ chức (Bắt buộc) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Tên Công dân, tổ chức: <span className="text-red-500">*</span></span>
                  {hasExtracted && !citizenName && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1 animate-pulse shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa nhận diện
                    </span>
                  )}
                  {hasExtracted && citizenName && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Đã nhận diện
                    </span>
                  )}
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Tên cá nhân công dân hoặc tổ chức..."
                    className={`w-full text-xs rounded-xl border p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 font-medium transition-all disabled:opacity-60 ${
                      hasExtracted && !citizenName
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400/40'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* TRƯỜNG 6: Điện thoại (Không bắt buộc) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Điện thoại:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Không bắt buộc</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Số điện thoại liên hệ của công dân..."
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-60"
                  />
                </div>
              </div>

              {/* TRƯỜNG 7: Địa chỉ (Không bắt buộc, 2 cột) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Địa chỉ:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Không bắt buộc</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Địa chỉ cư trú hoặc nơi liên hệ..."
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-60"
                  />
                </div>
              </div>

              {/* TRƯỜNG 8: Thủ tục (Bắt buộc, 2 cột) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Thủ tục: <span className="text-red-500">*</span></span>
                  {hasExtracted && !procedureName && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1 animate-pulse shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa nhận diện
                    </span>
                  )}
                  {hasExtracted && procedureName && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Đã nhận diện
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    list="tthc-procedures-list"
                    value={procedureName}
                    onChange={(e) => setProcedureName(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Tên thủ tục hành chính đang đôn đốc..."
                    className={`w-full text-xs rounded-xl border p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 font-medium transition-all disabled:opacity-60 ${
                      hasExtracted && !procedureName
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400/40'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-blue-500'
                    }`}
                    required
                  />
                  <datalist id="tthc-procedures-list">
                    {fields.map((f) => (
                      <option key={f.id} value={f.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* TRƯỜNG 9: Ngày nhận (Bắt buộc) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Ngày nhận: <span className="text-red-500">*</span></span>
                  {hasExtracted && !receivedDate && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1 animate-pulse shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa nhận diện
                    </span>
                  )}
                  {hasExtracted && receivedDate && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Đã nhận diện
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    disabled={isSaved && !isEditing}
                    className={`w-full text-xs rounded-xl border p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 font-medium transition-all disabled:opacity-60 ${
                      hasExtracted && !receivedDate
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400/40'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* TRƯỜNG 10: Ngày hẹn trả (Bắt buộc) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Ngày hẹn trả: <span className="text-red-500">*</span></span>
                  {hasExtracted && !appointmentDate && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1 animate-pulse shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa nhận diện - Chọn ngày
                    </span>
                  )}
                  {hasExtracted && appointmentDate && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Đã nhận diện
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    disabled={isSaved && !isEditing}
                    className={`w-full text-xs rounded-xl border p-2.5 pl-8 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 font-medium transition-all disabled:opacity-60 ${
                      hasExtracted && !appointmentDate
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 font-bold'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* TRƯỜNG 12 (BỔ SUNG THEO YÊU CẦU): Ghi chú */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Ghi chú:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Không bắt buộc</span>
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSaved && !isEditing}
                    placeholder="Ghi chú thêm về hồ sơ, yêu cầu phối hợp, chỉ đạo xử lý (nếu có)..."
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Tách nút Ghi nhận & phát hành đôn đốc thành 4 nút: Lưu, Sửa, Tạo SMS, Thêm phiếu mới */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaved && !isEditing}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                  isSaved && !isEditing
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10 active:scale-98'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                Lưu
              </button>

              <button
                type="button"
                onClick={handleEditClick}
                disabled={!isSaved || isEditing}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                  !isSaved || isEditing
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/10 active:scale-98'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Sửa
              </button>

              <button
                type="button"
                onClick={handleGenerateSms}
                disabled={!isSaved || isEditing}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                  !isSaved || isEditing
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10 active:scale-98'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Tạo SMS
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs shadow-md shadow-slate-500/10 transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Thêm phiếu mới
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
