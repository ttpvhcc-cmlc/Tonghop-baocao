import React, { useState } from 'react';
import {
  X,
  Clock,
  User,
  Building2,
  Calendar,
  Layers,
  PhoneCall,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Send,
  Printer,
  History,
  Flame,
} from 'lucide-react';
import { DossierUrgeRecord, UrgeStatus } from '../../types/dossierUrge';
import { dossierUrgeStore } from '../../services/dossierUrgeStore';

interface UrgeDetailModalProps {
  record: DossierUrgeRecord | null;
  onClose: () => void;
  onPrint: (record: DossierUrgeRecord) => void;
  onRecordUpdated: () => void;
}

export const UrgeDetailModal: React.FC<UrgeDetailModalProps> = ({
  record,
  onClose,
  onPrint,
  onRecordUpdated,
}) => {
  if (!record) return null;

  const history = dossierUrgeStore.getDossierUrgeHistory(record.dossier_code);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'feedback'>('info');

  // Feedback form state
  const [status, setStatus] = useState<UrgeStatus>(record.status);
  const [feedback, setFeedback] = useState<string>(record.unit_feedback || '');
  const [resolution, setResolution] = useState<string>(record.resolution_notes || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      dossierUrgeStore.updateUrge(record.id, {
        status,
        unit_feedback: feedback,
        feedback_at: feedback ? new Date().toISOString() : record.feedback_at,
        resolution_notes: resolution,
        resolved_at: status === 'completed' ? new Date().toISOString() : record.resolved_at,
      });

      onRecordUpdated();
      alert('Đã cập nhật phản hồi và trạng thái xử lý đôn đốc thành công!');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (st: UrgeStatus) => {
    switch (st) {
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            Đã hoàn thành / Đã trả kết quả
          </span>
        );
      case 'responded':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            Đã có phản hồi từ đơn vị
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            Đang đôn đốc / Đang xử lý
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            Mới tiếp nhận / Chờ xử lý
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                {record.dossier_code}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  record.urge_count >= 2
                    ? 'bg-red-500 text-white shadow-xs'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                Lượt đôn đốc: Lần {record.urge_count}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
              {record.procedure_name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(record)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              In phiếu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-800/20 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Thông tin đôn đốc
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch sử các lần đôn đốc ({history.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'feedback'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Cập nhật phản hồi đơn vị
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'info' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Trạng thái hiện tại:</span>
                {getStatusBadge(record.status)}
              </div>

              {/* Các trường thông tin */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <span className="text-slate-400 block text-[11px]">Hình thức đôn đốc:</span>
                  <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                    {record.channel === 'direct' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Trực tiếp tại Trung tâm
                      </>
                    ) : (
                      <>
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-500" /> Qua Điện thoại / Hotline
                      </>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Đơn vị chủ trì:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{record.assigned_unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Người thụ lý:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{record.processor_name || 'Chưa phân công'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Người nộp (Công dân/Tổ chức):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{record.citizen_name}</span>
                </div>
                {record.phone && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Điện thoại liên hệ:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{record.phone}</span>
                  </div>
                )}
                {record.address && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Địa chỉ:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{record.address}</span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">Thủ tục hành chính:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{record.procedure_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Ngày tiếp nhận:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{record.received_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Ngày hẹn trả kết quả:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{record.appointment_date}</span>
                </div>
                {record.reception_time && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Thời gian tiếp nhận:</span>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{record.reception_time}</span>
                  </div>
                )}
              </div>

              {/* Nội dung phản ánh của công dân (nếu có) */}
              {record.original_content && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Nội dung phản ánh của công dân:
                  </span>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 leading-relaxed italic">
                    "{record.original_content}"
                  </div>
                </div>
              )}

              {/* Ghi chú đôn đốc nếu có */}
              {record.notes && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Ghi chú:
                  </span>
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 text-slate-800 dark:text-slate-200 leading-relaxed text-xs">
                    {record.notes}
                  </div>
                </div>
              )}

              {/* Nội dung Đề nghị nếu có */}
              {record.proposal && (
                <div className="space-y-1">
                  <span className="font-bold text-blue-700 dark:text-blue-300">
                    Đề nghị:
                  </span>
                  <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 leading-relaxed text-xs font-medium">
                    {record.proposal}
                  </div>
                </div>
              )}

              {/* Phản hồi từ đơn vị nếu có */}
              {record.unit_feedback && (
                <div className="space-y-1">
                  <span className="font-bold text-blue-700 dark:text-blue-400">
                    Ý kiến phản hồi từ Đơn vị chủ trì & Người thụ lý:
                  </span>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 leading-relaxed">
                    {record.unit_feedback}
                  </div>
                </div>
              )}

              {/* Thông tin tạo */}
              <div className="text-[11px] text-slate-400 pt-2 flex items-center justify-between">
                <span>Cán bộ tiếp nhận: {record.created_by_name}</span>
                <span>Tiếp nhận lúc: {new Date(record.created_at).toLocaleString('vi-VN')}</span>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toàn bộ tiến trình đôn đốc của hồ sơ <strong className="font-mono text-slate-800 dark:text-slate-200">{record.dossier_code}</strong> qua các lần:
              </p>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                {history.map((item, index) => (
                  <div key={item.id} className="relative group">
                    {/* Bullet */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-xs ${
                        item.urge_count >= 2 ? 'bg-red-500' : 'bg-blue-600'
                      }`}
                    >
                      {item.urge_count}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          Lượt đôn đốc Lần {item.urge_count}
                          {item.urge_count >= 2 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-bold">
                              Nhiều lần
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(item.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 italic">
                        "{item.original_content}"
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500">
                        <span>Kênh: <strong>{item.channel === 'direct' ? 'Trực tiếp' : 'Điện thoại'}</strong></span>
                        <span>Cán bộ thụ lý: <strong>{item.processor_name}</strong></span>
                        <span>Trạng thái: <strong>{item.status}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'feedback' && (
            <form onSubmit={handleSaveFeedback} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Cập nhật trạng thái xử lý đôn đốc:
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UrgeStatus)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white text-xs font-medium"
                >
                  <option value="pending">Chờ xử lý / Đã phát hành phiếu đôn đốc</option>
                  <option value="in_progress">Đang đôn đốc / Đơn vị đang xử lý hồ sơ</option>
                  <option value="responded">Đơn vị đã có văn bản phản hồi / giải trình</option>
                  <option value="completed">Đã hoàn thành giải quyết / Đã trả kết quả cho công dân</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Ý kiến phản hồi / Giải trình của Đơn vị chủ trì & Người thụ lý:
                </label>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ghi nhận thông tin phản hồi từ phòng ban chuyên môn (ví dụ: Đang trình ký, đang bổ sung đo đạc, cam kết trả ngày...)"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Ghi chú kết quả xử lý cuối cùng:
                </label>
                <textarea
                  rows={2}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Ghi chú kết quả trả cho công dân hoặc ý kiến đánh giá sự hài lòng..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Lưu cập nhật phản hồi
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
