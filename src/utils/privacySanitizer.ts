/**
 * Module bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP
 * YÊU CẦU NGHIỆP VỤ: Tuyệt đối không bóc tách, không thu thập và không lưu trữ
 * bất kỳ thông tin nào liên quan đến số định danh cá nhân (Số CCCD, Số CMND, Mã định danh cá nhân, Hộ chiếu).
 */

export interface SanitizationResult {
  cleanText: string;
  hadSensitiveId: boolean;
  redactedCount: number;
}

/**
 * Kiểm tra xem một chuỗi có chứa số định danh cá nhân (CCCD, CMND, mã định danh, hộ chiếu) hay không
 */
export function containsPersonalIdNumber(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // 1. Nhãn tường minh: CCCD: 123456..., CMND: 123456..., Số định danh: ...
  const labelPattern = /\b(?:số\s+)?(?:cccd|cmnd|căn\s+cước|định\s+danh|mã\s+định\s+danh|hộ\s+chiếu|cmt)\s*[:=\-]?\s*([0-9A-Za-z]{8,15})/i;
  if (labelPattern.test(text)) return true;

  // 2. Chuỗi 12 chữ số liên tiếp (Mẫu số CCCD / Định danh cá nhân 12 số)
  // Không tính các mã hồ sơ có chứa dấu chấm/gạch ngang như 000.00.19.H47...
  const twelveDigits = /(?<![0-9A-Za-z.\-_])\d{12}(?![0-9A-Za-z.\-_])/;
  if (twelveDigits.test(text)) return true;

  // 3. Chuỗi 9 chữ số liên tiếp (Mẫu số CMND cũ 9 số)
  // Không phải số điện thoại di động 10 số (bắt đầu bằng 0)
  const nineDigits = /(?<![0-9A-Za-z.\-_])(?<!0)\d{9}(?![0-9A-Za-z.\-_])/;
  if (nineDigits.test(text)) return true;

  return false;
}

/**
 * Lấy danh sách các số định danh / cụm từ nhạy cảm phát hiện được để cảnh báo người dùng
 */
export function detectSensitiveIds(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const detected: string[] = [];

  // Nhãn kèm số
  const labelPattern = /\b(?:số\s+)?(?:cccd|cmnd|căn\s+cước|định\s+danh|mã\s+định\s+danh|hộ\s+chiếu|cmt)\s*[:=\-]?\s*([0-9A-Za-z]{8,15})/gi;
  let match: RegExpExecArray | null;
  while ((match = labelPattern.exec(text)) !== null) {
    detected.push(match[0]);
  }

  // 12 số
  const twelveDigits = /(?<![0-9A-Za-z.\-_])(\d{12})(?![0-9A-Za-z.\-_])/g;
  while ((match = twelveDigits.exec(text)) !== null) {
    if (!detected.some((d) => d.includes(match![1]))) {
      detected.push(`Số 12 số: ${match[1]}`);
    }
  }

  // 9 số
  const nineDigits = /(?<![0-9A-Za-z.\-_])(?<!0)(\d{9})(?![0-9A-Za-z.\-_])/g;
  while ((match = nineDigits.exec(text)) !== null) {
    if (!detected.some((d) => d.includes(match![1]))) {
      detected.push(`Số 9 số: ${match[1]}`);
    }
  }

  return detected;
}

/**
 * Tự động xóa bỏ hoàn toàn các số định danh/CCCD/CMND khỏi văn bản
 */
export function removeSensitiveIds(text: string): string {
  if (!text) return '';
  let result = text;

  // Xóa nhãn kèm số định danh
  result = result.replace(/\b(?:số\s+)?(?:cccd|cmnd|căn\s+cước|định\s+danh|mã\s+định\s+danh|hộ\s+chiếu|cmt)\s*[:=\-]?\s*([0-9A-Za-z]{8,15})/gi, '');

  // Xóa chuỗi 12 số
  result = result.replace(/(?<![0-9A-Za-z.\-_])\d{12}(?![0-9A-Za-z.\-_])/g, '');

  // Xóa chuỗi 9 số
  result = result.replace(/(?<![0-9A-Za-z.\-_])(?<!0)\d{9}(?![0-9A-Za-z.\-_])/g, '');

  // Thu gọn khoảng trắng thừa
  result = result.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Quét và che mờ toàn bộ số định danh (CCCD 12 số, CMND 9 số, Mã định danh) xuất hiện trong văn bản
 */
export function sanitizePrivacyContent(text: string): SanitizationResult {
  if (!text) return { cleanText: '', hadSensitiveId: false, redactedCount: 0 };

  let count = 0;
  let result = text;

  // 1. Quét các cụm từ chỉ đích danh: CCCD, CMND, Số định danh, Căn cước, Hộ chiếu kèm số
  const labelPattern = /\b(số\s+)?(cccd|cmnd|căn\s+cước|định\s+danh|mã\s+định\s+danh|hộ\s+chiếu|cmt|id)[:\s]*([0-9A-Za-z]{8,15})\b/gi;
  result = result.replace(labelPattern, (_match, _prefix, label, _idVal) => {
    count++;
    return `${label}: [ĐÃ XÓA THEO QUY ĐỊNH BẢO MẬT]`;
  });

  // 2. Quét chuỗi 12 chữ số liên tiếp (Mẫu số CCCD / Định danh cá nhân Việt Nam)
  const twelveDigitsPattern = /(?<![0-9A-Za-z.\-_])(\d{12})(?![0-9A-Za-z.\-_])/g;
  result = result.replace(twelveDigitsPattern, () => {
    count++;
    return '[ĐÃ XÓA SỐ ĐỊNH DANH 12 SỐ]';
  });

  // 3. Quét chuỗi 9 chữ số liên tiếp (Mẫu số CMND cũ Việt Nam)
  const nineDigitsPattern = /(?<![0-9A-Za-z.\-_])(?<!0)(\d{9})(?![0-9A-Za-z.\-_])/g;
  result = result.replace(nineDigitsPattern, () => {
    count++;
    return '[ĐÃ XÓA SỐ CMND 9 SỐ]';
  });

  return {
    cleanText: result,
    hadSensitiveId: count > 0,
    redactedCount: count,
  };
}
