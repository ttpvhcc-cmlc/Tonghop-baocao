import { ExtractedUrgeInfo, UrgeChannel } from '../types/dossierUrge';
import { sanitizePrivacyContent } from './privacySanitizer';

/**
 * Chuẩn hóa chuỗi ngày tháng tiếng Việt sang YYYY-MM-DD
 * Hỗ trợ các định dạng:
 * - DD/MM/YYYY hoặc DD-MM-YYYY hoặc D/M/YYYY
 * - ngày DD tháng MM năm YYYY (hoặc ngày DD/MM/YYYY)
 * - YYYY-MM-DD
 * - Chuỗi có giờ đi kèm như "15:48 04/08/2026"
 */
export function normalizeDateToISO(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  // 1. Trường hợp đã là YYYY-MM-DD
  const isoMatch = trimmed.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // 2. Trường hợp "ngày DD tháng MM năm YYYY"
  const textDateMatch = trimmed.match(/(?:ngày\s+)?(\d{1,2})\s*(?:tháng|\/|-)\s*(\d{1,2})\s*(?:năm|\/|-)\s*(\d{4})/i);
  if (textDateMatch) {
    const day = textDateMatch[1].padStart(2, '0');
    const month = textDateMatch[2].padStart(2, '0');
    const year = textDateMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Trường hợp DD/MM/YYYY hoặc DD-MM-YYYY (kể cả có giờ đứng trước hoặc sau: "10:56 10/04/2026")
  const dmyMatch = trimmed.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  return '';
}

/**
 * Lấy ngày hôm nay định dạng YYYY-MM-DD
 */
export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * BỘ BÓC TÁCH NGÔN NGỮ TỰ NHIÊN BẰNG QUY TẮC ĐA TẦNG (MULTI-PASS RULE-BASED NLP)
 * Chạy 100% tại Client (Trình duyệt), 0% AI, 0% Credit, Tốc độ tức thì.
 */
export function extractDossierInfoRuleBased(rawContent: string): ExtractedUrgeInfo {
  // Làm sạch số định danh trước tiên
  const { cleanText, hadSensitiveId } = sanitizePrivacyContent(rawContent);

  const result: ExtractedUrgeInfo = {
    dossier_code: '',
    citizen_name: '',
    phone: '',
    address: '',
    procedure_name: '',
    received_date: '',
    appointment_date: '',
    assigned_unit: '',
    processor_name: '',
    channel: 'direct',
    redacted_id_detected: hadSensitiveId,
  };

  if (!cleanText.trim()) return result;

  // =========================================================================
  // BƯỚC 1: BÓC TÁCH THEO DÒNG (LINE-BY-LINE KEY-VALUE PARSING)
  // Xử lý các biểu mẫu hành chính, phiếu biên nhận, sao chép từ phần mềm một cửa
  // =========================================================================
  const lines = cleanText.split(/[\r\n]+/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Tìm dấu phân cách nhãn (:, =, –)
    const separatorMatch = trimmed.match(/^([^:=–\t]+)[:=–\t]\s*(.+)$/);
    if (separatorMatch) {
      const label = separatorMatch[1].trim().toLowerCase();
      let val = separatorMatch[2].trim();

      // 1. Mã hồ sơ (ví dụ: "Mã số hồ sơ: H57.132-260804-0583 - Số phiếu: 26.10229")
      if (!result.dossier_code && /(mã\s+số\s+hồ\s+sơ|mã\s+hồ\s+sơ|số\s+hồ\s+sơ|mã\s+hs|số\s+hs|hồ\s+sơ\s+số|mã\s+số|số\s+phiếu)/i.test(label)) {
        // Tách bỏ phần "- Số phiếu: ..." nếu có
        const codeClean = val.split(/\s*[-–]\s*số\s+phiếu/i)[0].trim();
        const codeMatch = codeClean.match(/\b([0-9A-Za-z.\-_/]{6,35})\b/);
        result.dossier_code = codeMatch ? codeMatch[1] : codeClean;
      }
      // 2. Tên Công dân / Tổ chức (ví dụ: "Công dân/ Tổ chức: NGUYỄN VĂN NGỮ", "Chủ hồ sơ:", "Người nộp:")
      else if (
        !result.citizen_name &&
        /(công\s*dân[\s/]*tổ\s*chức|công\s*dân|tổ\s*chức|doanh\s*nghiệp|người\s*nộp|chủ\s*hồ\s*sơ|họ\s*và\s*tên|họ\s*tên|khách\s*hàng|người\s*yêu\s*cầu)/i.test(label) &&
        !/(mã|số\s+hồ\s+sơ|địa\s+chỉ|điện\s+thoại|ngày)/i.test(label)
      ) {
        // Lấy tên, loại bỏ các chú thích phụ như (đại diện...), SĐT, CCCD nếu có
        const cleanName = val.split(/[;\n]/)[0].replace(/\s*\(.*?\)/g, '').trim();
        if (cleanName) {
          result.citizen_name = cleanName;
        }
      }
      // 3. Số điện thoại (ví dụ: "Điện thoại: 0905389330, Email:")
      else if (!result.phone && /(điện\s+thoại|số\s+điện\s+thoại|sđt|đt|hotline|liên\s+hệ|số\s+đt)/i.test(label)) {
        const phoneMatch = val.match(/([0-9+.\s]{9,13})/);
        if (phoneMatch) {
          result.phone = phoneMatch[1].replace(/[^0-9+]/g, '');
        }
      }
      // 4. Địa chỉ (ví dụ: "Địa chỉ: THÔN THỦY YÊN HẠ , Thành phố Huế")
      else if (!result.address && /(địa\s+chỉ|nơi\s+cư\s+trú|thường\s+trú|trú\s+tại|địa\s+chỉ\s+liên\s+hệ|quê\s+quán)/i.test(label)) {
        // Cắt bỏ phần email hoặc ghi chú phía sau nếu có
        const cleanAddr = val.split(/\s*,\s*email/i)[0].trim();
        result.address = cleanAddr;
      }
      // 5. Thủ tục (ví dụ: "Tên hồ sơ: Đăng ký đất đai, tài sản gắn liền với đất...", "Tên thủ tục:", "Thủ tục:")
      else if (
        !result.procedure_name &&
        /(tên\s+hồ\s+sơ|tên\s+thủ\s+tục|thủ\s+tục|tthc|nội\s+dung\s+hồ\s+sơ|nội\s+dung\s+thủ\s+tục|loại\s+hồ\s+sơ|loại\s+thủ\s+tục|về\s+việc|về\s+thủ\s+tục|nội\s+dung)/i.test(label) &&
        !/(mã|số\s+hồ\s+sơ|ngày)/i.test(label)
      ) {
        result.procedure_name = val.split(/[\n]/)[0].trim();
      }
      // 6. Ngày nhận và/hoặc Ngày hẹn trả (ví dụ: "Ngày nhận: 10:56 13/03/2026; ngày hẹn trả: 10:56 10/04/2026.")
      else if (/(ngày\s+nhận|ngày\s+tiếp\s+nhận|ngày\s+nộp|tiếp\s+nhận|thời\s+gian\s+nhận)/i.test(label)) {
        // Kiểm tra xem trong val có chứa cả ngày hẹn trả không (kể cả có mốc giờ đi kèm như "10:56 10/04/2026")
        const subAppointment = val.match(/(?:ngày\s+hẹn\s+trả|hẹn\s+trả|hạn\s+trả|ngày\s+trả|hẹn\s+ngày|hạn\s+giải\s+quyết)[^0-9\n\r]*?(?:\d{1,2}:\d{2}(?::\d{2})?\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i);
        if (subAppointment && !result.appointment_date) {
          result.appointment_date = normalizeDateToISO(subAppointment[1]);
        }
        if (!result.received_date) {
          // Lấy ngày nhận (phần trước dấu chấm phẩy hoặc ngày hẹn trả)
          const recvPart = val.split(/;|ngày\s+hẹn\s+trả|hẹn\s+trả/i)[0];
          result.received_date = normalizeDateToISO(recvPart);
        }
      }
      // 7. Ngày hẹn trả riêng biệt
      else if (!result.appointment_date && /(ngày\s+hẹn\s+trả|ngày\s+hẹn|hẹn\s+trả|hạn\s+trả|hạn\s+giải\s+quyết|ngày\s+trả\s+kết\s+quả|ngày\s+trả|hẹn\s+kết\s+quả)/i.test(label)) {
        result.appointment_date = normalizeDateToISO(val);
      }
      // 8. Đơn vị chủ trì (Chỉ lấy khi văn bản có ghi rõ ràng)
      else if (!result.assigned_unit && /(đơn\s+vị\s+chủ\s+trì|đơn\s+vị\s+giải\s+quyết|đơn\s+vị\s+thực\s+hiện|cơ\s+quan\s+giải\s+quyết|cơ\s+quan\s+thực\s+hiện)/i.test(label)) {
        result.assigned_unit = val.split(/[;\n]/)[0].trim();
      }
      // 9. Người thụ lý
      else if (!result.processor_name && /(người\s+thụ\s+lý|cán\s+bộ\s+thụ\s+lý|chuyên\s+viên\s+thụ\s+lý|cán\s+bộ\s+giải\s+quyết|cán\s+bộ|chuyên\s+viên|người\s+xử\s+lý)/i.test(label)) {
        result.processor_name = val.split(/[;\n]/)[0].trim();
      }
      // 10. Hình thức
      else if (/^(hình\s+thức|kênh|phương\s+thức)$/i.test(label)) {
        if (/điện\s+thoại|gọi/i.test(val)) result.channel = 'phone';
        else if (/trực\s+tiếp/i.test(val)) result.channel = 'direct';
      }
    }
  });

  const fullText = cleanText;

  // =========================================================================
  // BƯỚC 2: BÓC TÁCH MÃ HỒ SƠ NẾU CHƯA CÓ
  // =========================================================================
  if (!result.dossier_code) {
    // 2.1. Cấu trúc chuẩn Cổng DVC Một cửa (ví dụ H57.132-260804-0583 hoặc 000.00.19.H47-260105-0001)
    const codeRegex = /\b([A-Z0-9]{2,8}[.\-_][0-9]{2,8}[.\-_][0-9A-Za-z]{3,10}(?:-[0-9]{4})?)\b/;
    const mCode = fullText.match(codeRegex);
    if (mCode) {
      result.dossier_code = mCode[1].trim();
    } else {
      const explicitMatch = fullText.match(/(?:mã\s+số\s+hồ\s+sơ|mã\s+hồ\s+sơ|số\s+hồ\s+sơ|hồ\s+sơ\s+số|mã\s+hs|hồ\s+sơ\s+mã)\s*[:=\-]?\s*([0-9A-Za-z.\-_/]{6,35})/i);
      if (explicitMatch) {
        result.dossier_code = explicitMatch[1].trim();
      }
    }
  }

  // =========================================================================
  // BƯỚC 3: BÓC TÁCH TÊN CÔNG DÂN / TỔ CHỨC NẾU CHƯA CÓ
  // =========================================================================
  if (!result.citizen_name) {
    // 3.1. Nhãn rõ ràng trong câu: "Công dân/ Tổ chức: ...", "Người nộp: ...", "Chủ hồ sơ: ..."
    const explicitLabel = /(?:công\s*dân[\s/]*tổ\s*chức|công\s*dân|tổ\s*chức|người\s*nộp|chủ\s*hồ\s*sơ|họ\s*và\s*tên|họ\s*tên)\s*[:=\-]\s*([A-ZÀ-Ỹa-zà-ỹ\s]{3,50})(?=[,\n;\r]|\s+(?:địa\s+chỉ|điện\s+thoại|sđt|nộp|phản\s+ánh|yêu\s+cầu|đến|$))/i;
    const mExplicit = fullText.match(explicitLabel);
    if (mExplicit && mExplicit[1].trim()) {
      result.citizen_name = mExplicit[1].trim();
    } else {
      // 3.2. Nhận diện Tổ chức / Doanh nghiệp
      const orgPattern = /\b((?:Công\s+ty|Doanh\s+nghiệp|DNTN|Hợp\s+tác\s+xã|HTX|Ban\s+Quản\s+lý|Chi\s+nhánh|Trung\s+tâm|Tổng\s+công\s+ty)\s+[A-ZÀ-Ỹ0-9\s&.\-_]+?)(?=\s*(?:,|;|\.|\n|phản\s+ánh|đến|yêu\s+cầu|đôn\s+đốc|nộp|về\s+thủ\s+tục|hồ\s+sơ|mã\s+hồ\s+sơ|liên\s+hệ|gọi|$))/i;
      const mOrg = fullText.match(orgPattern);
      if (mOrg && mOrg[1].trim().length >= 5) {
        result.citizen_name = mOrg[1].trim();
      } else {
        // 3.3. Tên cá nhân có danh xưng (Công dân Nguyễn Văn A, Ông/Bà Trần Văn B)
        // Chấp nhận cả viết hoa toàn bộ (NGUYỄN VĂN NGỮ) và viết hoa đầu từ (Nguyễn Văn Ngữ)
        const personWithTitle = /\b(?:Công\s+dân|Ông\/Bà|Ông|Bà|Anh|Chị|Người\s+nộp|Chủ\s+hồ\s+sơ)\s*[:\-]?\s*([A-ZÀ-Ỹa-zà-ỹ]{2,}(?:\s+[A-ZÀ-Ỹa-zà-ỹ]{2,}){1,5})\b/i;
        const mPerson = fullText.match(personWithTitle);
        if (mPerson && mPerson[1]) {
          result.citizen_name = mPerson[1].trim();
        }
      }
    }
  }

  // =========================================================================
  // BƯỚC 4: BÓC TÁCH THỦ TỤC NẾU CHƯA CÓ
  // =========================================================================
  if (!result.procedure_name) {
    // 4.1. Nhãn tường minh: "Tên hồ sơ: ...", "Thủ tục: ...", "Tên thủ tục: ...", "Về việc: ..."
    const explicitProc = /(?:tên\s+hồ\s+sơ|tên\s+thủ\s+tục|thủ\s+tục\s+hành\s+chính|thủ\s+tục|tthc|về\s+thủ\s+tục|về\s+việc|làm\s+thủ\s+tục)\s*[:=\-]?\s*([A-ZÀ-Ỹa-zà-ỹ0-9\s,\-_()]{5,120}?)(?=\s*(?:;|\.|\n|ngày\s+nhận|ngày\s+tiếp\s+nhận|tiếp\s+nhận|nộp\s+ngày|ngày\s+hẹn|hẹn\s+trả|người\s+thụ\s+lý|đơn\s+vị|$))/i;
    const mProc = fullText.match(explicitProc);
    if (mProc && mProc[1]) {
      let pClean = mProc[1].trim().replace(/[,;.\-]+$/, '').trim();
      if (pClean.length >= 5) {
        result.procedure_name = pClean;
      }
    }
  }

  // =========================================================================
  // BƯỚC 5: BÓC TÁCH NGÀY NHẬN & NGÀY HẸN TRẢ NẾU CHƯA CÓ
  // =========================================================================
  if (!result.received_date) {
    const recvPattern = /(?:ngày\s+tiếp\s+nhận|tiếp\s+nhận\s+(?:hồ\s+sơ\s+)?ngày|ngày\s+nhận(?:\s+hồ\s+sơ)?|nhận\s+ngày|ngày\s+nộp(?:\s+hồ\s+sơ)?|nộp\s+ngày|thời\s+gian\s+nhận)[^0-9\n\r]*?(?:\d{1,2}:\d{2}(?::\d{2})?\s+)?([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}|ngày\s+[0-9]{1,2}\s+tháng\s+[0-9]{1,2}\s+năm\s+[0-9]{4})/i;
    const mRecv = fullText.match(recvPattern);
    if (mRecv && mRecv[1]) {
      result.received_date = normalizeDateToISO(mRecv[1]);
    }
  }

  if (!result.appointment_date) {
    const appPattern = /(?:ngày\s+hẹn\s+trả|hẹn\s+trả\s+ngày|hẹn\s+trả|ngày\s+hẹn|hẹn\s+ngày|hạn\s+trả\s+ngày|hạn\s+trả|hạn\s+giải\s+quyết|ngày\s+trả\s+kết\s+quả|hẹn\s+kết\s+quả\s+ngày|ngày\s+trả)[^0-9\n\r]*?(?:\d{1,2}:\d{2}(?::\d{2})?\s+)?([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}|ngày\s+[0-9]{1,2}\s+tháng\s+[0-9]{1,2}\s+năm\s+[0-9]{4})/i;
    const mApp = fullText.match(appPattern);
    if (mApp && mApp[1]) {
      result.appointment_date = normalizeDateToISO(mApp[1]);
    }
  }

  // Quét dự phòng toàn văn bản nếu 1 trong 2 ngày vẫn chưa bóc tách được
  if (!result.received_date || !result.appointment_date) {
    const allDates = Array.from(fullText.matchAll(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/g)).map((m) => m[1]);
    if (allDates.length >= 2) {
      if (!result.received_date) result.received_date = normalizeDateToISO(allDates[0]);
      if (!result.appointment_date) result.appointment_date = normalizeDateToISO(allDates[1]);
    } else if (allDates.length === 1) {
      if (!result.received_date) result.received_date = normalizeDateToISO(allDates[0]);
    }
  }

  // =========================================================================
  // BƯỚC 6: BÓC TÁCH SỐ ĐIỆN THOẠI NẾU CHƯA CÓ
  // =========================================================================
  if (!result.phone) {
    const phoneExplicit = /(?:điện\s+thoại|số\s+điện\s+thoại|sđt|đt|hotline|liên\s+hệ|số\s+đt)\s*[:=\-]?\s*([0-9+.\s]{9,13})/i;
    const mPhone = fullText.match(phoneExplicit);
    if (mPhone && mPhone[1]) {
      const cleanPhone = mPhone[1].replace(/[^0-9+]/g, '');
      if (cleanPhone.length >= 9) {
        result.phone = cleanPhone;
      }
    } else {
      const standardMobile = /\b(0[235789][0-9]{8})\b/;
      const mMobile = fullText.match(standardMobile);
      if (mMobile) {
        result.phone = mMobile[1];
      }
    }
  }

  // =========================================================================
  // BƯỚC 7: BÓC TÁCH ĐỊA CHỈ NẾU CHƯA CÓ
  // =========================================================================
  if (!result.address) {
    const addrExplicit = /(?:địa\s+chỉ|nơi\s+cư\s+trú|thường\s+trú|trú\s+tại|địa\s+chỉ\s+liên\s+hệ|quê\s+quán)\s*[:=\-]?\s*([^\r\n;]+)/i;
    const mAddr = fullText.match(addrExplicit);
    if (mAddr && mAddr[1]) {
      result.address = mAddr[1].split(/\s*,\s*email/i)[0].trim();
    }
  }

  // =========================================================================
  // BƯỚC 8: HÌNH THỨC (TRỰC TIẾP VS ĐIỆN THOẠI)
  // =========================================================================
  if (/(điện thoại|gọi điện|qua đt|hotline|cuộc gọi|qua số|liên hệ qua số|gọi tới|gọi đến|đường dây nóng)/i.test(fullText)) {
    result.channel = 'phone';
  } else {
    result.channel = 'direct';
  }

  return result;
}

export const extractDossierInfo = extractDossierInfoRuleBased;
