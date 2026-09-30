import React, { useRef } from 'react';
import { X, Printer, Building2, User, Clock, ShieldCheck } from 'lucide-react';
import { DossierUrgeRecord } from '../../types/dossierUrge';

interface UrgePrintModalProps {
  record: DossierUrgeRecord | null;
  history?: DossierUrgeRecord[];
  onClose: () => void;
}

export const UrgePrintModal: React.FC<UrgePrintModalProps> = ({ record, history = [], onClose }) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedCreated = new Date(record.created_at).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const ticketCode = record.ticket_code || 'TB-' + (record.reception_time || new Date(record.created_at).toLocaleDateString('vi-VN'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Phiếu Đôn Đốc Giải Quyết Thủ Tục Hành Chính
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mã hồ sơ: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{record.dossier_code}</span> (Lượt đôn đốc: Lần {record.urge_count})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
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

        {/* Modal Printable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
          <div
            ref={printAreaRef}
            id="printable-urge-slip"
            className="w-full max-w-[210mm] bg-white text-slate-900 p-8 sm:p-10 shadow-lg rounded-xl font-serif text-[13px] leading-relaxed border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0"
          >
            {/* Thể thức Tiêu ngữ Quốc gia */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6 text-center">
              <div className="w-[45%]">
                <p className="text-[11px] font-bold uppercase tracking-wider">UBND XÃ CHÂN MÂY – LĂNG CÔ</p>
                <p className="text-[12px] font-bold uppercase text-blue-900 mt-0.5">BỘ PHẬN TIẾP NHẬN & TRẢ KẾT QUẢ</p>
                <div className="w-24 h-[1px] bg-slate-400 mx-auto mt-1 mb-1"></div>
                <p className="text-[11px] font-bold text-slate-700 font-mono">Số: {ticketCode}/PĐĐ-BPTN&TKQ</p>
              </div>

              <div className="w-[52%]">
                <p className="text-[12px] font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="text-[12px] font-bold">Độc lập – Tự do – Hạnh phúc</p>
                <div className="w-28 h-[1px] bg-slate-900 mx-auto mt-1 mb-1"></div>
                <p className="text-[11px] italic mt-1 text-slate-600">
                  Chân Mây – Lăng Cô, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                </p>
              </div>
            </div>

            {/* Tiêu đề phiếu */}
            <div className="text-center my-6">
              <h1 className="text-base sm:text-lg font-bold uppercase tracking-wide text-slate-950 font-sans">
                PHIẾU ĐÔN ĐỐC GIẢI QUYẾT HỒ SƠ THỦ TỤC HÀNH CHÍNH
              </h1>
              <div className="inline-block px-3 py-0.5 mt-1 rounded bg-slate-100 border border-slate-300 text-[11px] font-bold uppercase font-sans">
                {record.urge_count >= 2 ? `LƯỢT ĐÔN ĐỐC THỨ ${record.urge_count} (KHẨN CẤP)` : 'LƯỢT ĐÔN ĐỐC THỨ 1'}
              </div>
            </div>

            {/* Kính gửi */}
            <div className="mb-5 space-y-1">
              <p className="font-bold">
                Kính gửi:{' '}
                <span className="font-bold underline text-blue-900">{record.assigned_unit}</span>
              </p>
              <p className="italic text-slate-700">
                (Đồng kính gửi: Cán bộ/Chuyên viên thụ lý: <strong>{record.processor_name}</strong>)
              </p>
            </div>

            {/* Nội dung đôn đốc */}
            <div className="space-y-3 text-justify">
              <p>
                Bộ phận Tiếp nhận và Trả kết quả xã Chân Mây – Lăng Cô nhận được ý kiến đôn đốc của công dân, tổ chức liên quan đến tiến độ giải quyết hồ sơ thủ tục hành chính, cụ thể như sau:
              </p>

              {/* Bảng chi tiết 7 trường bóc tách */}
              <div className="border border-slate-300 rounded-lg overflow-hidden my-4 font-sans text-xs">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-2.5 font-bold w-[28%] text-slate-700">Mã hồ sơ:</td>
                      <td className="p-2.5 font-mono font-bold text-blue-900 text-sm">{record.dossier_code}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700">Người nộp (Công dân/Tổ chức):</td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {record.citizen_name}
                        {record.phone && <span className="ml-2 font-normal text-slate-600">(SĐT: {record.phone})</span>}
                        {record.address && <span className="ml-2 font-normal text-slate-600">- Đ/c: {record.address}</span>}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-700">Tên thủ tục hành chính:</td>
                      <td className="p-2.5 text-slate-900">{record.procedure_name}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700">Thời gian tiếp nhận:</td>
                      <td className="p-2.5 font-medium">{record.received_date}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-700">Ngày hẹn trả kết quả:</td>
                      <td className="p-2.5 font-bold text-red-700">{record.appointment_date}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold text-slate-700">Đơn vị chủ trì thẩm định:</td>
                      <td className="p-2.5 font-medium">{record.assigned_unit}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-700">Cán bộ / Chuyên viên thụ lý:</td>
                      <td className="p-2.5 font-semibold text-slate-900">{record.processor_name}</td>
                    </tr>
                    {record.reception_time && (
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-700">Thời gian tiếp nhận:</td>
                        <td className="p-2.5 font-mono font-semibold text-slate-900">{record.reception_time}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="p-2.5 font-bold text-slate-700">Phản ánh:</td>
                      <td className="p-2.5 font-semibold">
                        {record.channel === 'direct' ? 'Trực tiếp' : 'Qua điện thoại'}
                      </td>
                    </tr>
                    {record.notes && (
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-700">Ghi chú:</td>
                        <td className="p-2.5 text-slate-900 font-medium italic">{record.notes}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Chi tiết nội dung phản ánh (nếu có) */}
              {record.original_content && (
                <div className="bg-slate-50 border-l-4 border-blue-600 p-3 my-3 text-xs italic text-slate-800">
                  <strong>Nội dung công dân phản ánh / đôn đốc:</strong> "{record.original_content}"
                </div>
              )}

              {/* Nội dung Đề nghị */}
              {record.proposal && (
                <div className="bg-blue-50/70 border-l-4 border-blue-800 p-3 my-3 text-xs text-slate-900 font-medium">
                  <strong>Đề nghị:</strong> {record.proposal}
                </div>
              )}

              {/* Lịch sử nếu đôn đốc nhiều lần */}
              {history.length > 1 && (
                <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-sans">
                  <div className="font-bold text-amber-900 mb-1">
                    LỊCH SỬ ĐÔN ĐỐC CỦA HỒ SƠ NÀY ({history.length} LẦN):
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                    {history.map((h, i) => (
                      <li key={i}>
                        Lần {h.urge_count}: Ngày {new Date(h.created_at).toLocaleDateString('vi-VN')} ({h.channel === 'direct' ? 'Trực tiếp' : 'Điện thoại'}) - {h.status === 'responded' ? 'Đã phản hồi' : 'Đang xử lý'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4">
                Để bảo đảm quyền và lợi ích hợp pháp của tổ chức, công dân; thực hiện nghiêm túc quy định về kiểm soát TTHC và tránh tình trạng trễ hạn kéo dài gây bức xúc, Bộ phận Tiếp nhận và Trả kết quả đề nghị <strong>{record.assigned_unit}</strong> và cán bộ thụ lý:
              </p>

              <ol className="list-decimal list-inside space-y-1 pl-2 font-medium">
                <li>Khẩn trương kiểm tra quy trình, hồ sơ thực tế và đẩy nhanh tiến độ thẩm định.</li>
                <li>
                  Có văn bản phản hồi hoặc cập nhật kết quả xử lý về Bộ phận Tiếp nhận và Trả kết quả trước{' '}
                  <strong className="text-red-700">
                    {record.response_deadline
                      ? new Date(record.response_deadline).toLocaleDateString('vi-VN')
                      : '24 giờ kể từ khi nhận phiếu đôn đốc'}
                  </strong>
                  .
                </li>
                <li>Trường hợp có lý do khách quan chậm trễ, yêu cầu thực hiện nghiêm túc thủ tục Thư xin lỗi và hẹn lại ngày trả kết quả theo quy định tại Nghị định số 61/2018/NĐ-CP.</li>
              </ol>
            </div>

            {/* Chữ ký */}
            <div className="grid grid-cols-2 gap-4 mt-8 pt-4 text-center font-sans text-xs">
              <div>
                <p className="font-bold uppercase text-slate-600">NƠI NHẬN:</p>
                <p className="text-[11px] text-slate-500 text-left pl-6 mt-1">
                  - Như trên;<br />
                  - Lãnh đạo UBND xã (để báo cáo);<br />
                  - Lưu: VT, BPTN&TKQ.
                </p>
              </div>

              <div>
                <p className="font-bold uppercase text-slate-900">
                  KT. BỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ
                </p>
                <p className="italic text-[11px] text-slate-500 mb-16">CÁN BỘ ĐÔN ĐỐC</p>
                <p className="font-bold text-sm text-slate-900">{record.created_by_name}</p>
                <p className="text-[11px] text-slate-500">{formattedCreated}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
