import { SAMPLE_PROCEDURES_DATA } from '../data/sampleProcedures';
import { Field } from '../types/database';

/**
 * Standard list of sectors (Lĩnh vực TTHC)
 */
export const STANDARD_LINH_VUC_LIST = [
  'Chứng thực',
  'Hộ tịch',
  'Bảo trợ xã hội',
  'An toàn thực phẩm',
  'Giáo dục mầm non',
  'Giáo dục trung học',
  'Hàng hải và đường thủy nội địa',
  'Quy hoạch đô thị và nông thôn',
  'Hoạt động xây dựng',
  'Lưu thông hàng hóa trong nước',
  'Đất đai',
  'Thủy sản',
  'Người có công',
  'Chính sách',
  'Phí, lệ phí',
  'Giảm nghèo',
  'Thủ tục hành chính liên thông',
] as const;

/**
 * Normalizes Vietnamese text by removing diacritics and special characters
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a procedure text, snapshot string, or field ID into its exact official Lĩnh vực (Field/Sector).
 */
export function resolveLinhVuc(
  rawText: string,
  fieldId?: string,
  availableFields?: Field[]
): string {
  if (!rawText && !fieldId) return 'Chưa phân loại';

  const cleanRaw = (rawText || '').trim();

  // 1. If availableFields provided, check by ID first
  if (fieldId && availableFields && availableFields.length > 0) {
    const matched = availableFields.find((f) => f.id === fieldId);
    if (matched) {
      if (matched.linh_vuc && matched.linh_vuc !== 'Chưa phân loại') {
        return matched.linh_vuc;
      }
      if (matched.name && isStandardLinhVuc(matched.name)) {
        return matched.name;
      }
    }
  }

  // 2. Check if cleanRaw is already an official exact Lĩnh vực
  for (const lv of STANDARD_LINH_VUC_LIST) {
    if (cleanRaw.toLowerCase() === lv.toLowerCase()) {
      return lv;
    }
  }

  // 3. Match against SAMPLE_PROCEDURES_DATA by exact or fuzzy name
  const normRaw = normalizeText(cleanRaw);
  for (const proc of SAMPLE_PROCEDURES_DATA) {
    const normProcName = normalizeText(proc.name);
    if (normRaw === normProcName || normRaw.includes(normProcName) || normProcName.includes(normRaw)) {
      if (proc.linh_vuc) {
        return proc.linh_vuc;
      }
    }
  }

  // 4. Keyword heuristics for known TTHC procedures
  if (normRaw.includes('chung thuc') || normRaw.includes('phan chia di san') || normRaw.includes('khai nhan di san') || normRaw.includes('tu choi nhan di san')) {
    return 'Chứng thực';
  }
  if (
    normRaw.includes('ho tich') ||
    normRaw.includes('khai sinh') ||
    normRaw.includes('khai tu') ||
    normRaw.includes('ket hon') ||
    normRaw.includes('giam ho') ||
    normRaw.includes('cha me con')
  ) {
    return 'Hộ tịch';
  }
  if (
    normRaw.includes('hoa tang') ||
    normRaw.includes('mai tang') ||
    normRaw.includes('bao tro') ||
    normRaw.includes('tro cap xa hoi') ||
    normRaw.includes('khuyet tat')
  ) {
    return 'Bảo trợ xã hội';
  }
  if (normRaw.includes('an toan thuc pham') || normRaw.includes('attp') || normRaw.includes('ve sinh thuc pham')) {
    return 'An toàn thực phẩm';
  }
  if (normRaw.includes('mam non') || normRaw.includes('nha tre') || normRaw.includes('mau giao')) {
    return 'Giáo dục mầm non';
  }
  if (normRaw.includes('trung hoc') || normRaw.includes('thcs') || normRaw.includes('tuyen sinh')) {
    return 'Giáo dục trung học';
  }
  if (normRaw.includes('ben thuy') || normRaw.includes('duong thuy') || normRaw.includes('hang hai') || normRaw.includes('ben khach')) {
    return 'Hàng hải và đường thủy nội địa';
  }
  if (normRaw.includes('quy hoach') || normRaw.includes('nhiem vu quy hoach')) {
    return 'Quy hoạch đô thị và nông thôn';
  }
  if (normRaw.includes('xay dung') || normRaw.includes('nghien cuu kha thi') || normRaw.includes('giay phep xay dung')) {
    return 'Hoạt động xây dựng';
  }
  if (normRaw.includes('dat dai') || normRaw.includes('quyen su dung dat') || normRaw.includes('so do') || normRaw.includes('giao dat')) {
    return 'Đất đai';
  }
  if (normRaw.includes('thuoc la') || normRaw.includes('ban le ruou') || normRaw.includes('luu thong hang hoa')) {
    return 'Lưu thông hàng hóa trong nước';
  }
  if (normRaw.includes('thuy san') || normRaw.includes('nuoi trong thuy san')) {
    return 'Thủy sản';
  }
  if (normRaw.includes('ho ngheo') || normRaw.includes('can ngheo') || normRaw.includes('giam ngheo')) {
    return 'Giảm nghèo';
  }
  if (normRaw.includes('nguoi co cong') || normRaw.includes('thuong binh') || normRaw.includes('liet si')) {
    return 'Người có công';
  }
  if (normRaw.includes('phi le phi') || normRaw.includes('phi') || normRaw.includes('le phi')) {
    return 'Phí, lệ phí';
  }
  if (normRaw.includes('lien thong')) {
    return 'Thủ tục hành chính liên thông';
  }

  // 5. If cleanRaw is short (<= 35 chars) and doesn't look like a full sentence procedure, keep it
  if (cleanRaw.length > 0 && cleanRaw.length <= 35) {
    return cleanRaw;
  }

  return 'Chưa phân loại';
}

export function isStandardLinhVuc(name: string): boolean {
  return STANDARD_LINH_VUC_LIST.some((lv) => lv.toLowerCase() === (name || '').trim().toLowerCase());
}
