import * as XLSX from 'xlsx';
import { Field, Unit, ValidationErrorItem } from '../../types/database';
import { validateStatisticRow } from '../analysis/formulas';
import { resolveLinhVuc } from '../../utils/fieldResolver';

export interface RawParsedSheet {
  sheetName: string;
  rows: any[][];
}

export interface DetectedSection {
  sourceName: string;
  startRow: number;
  endRow: number;
}

export interface ParsedStatisticDraft {
  rowNumber: number;
  sourceName: string;
  rawFieldName: string;
  matchedFieldId?: string;
  matchedFieldName?: string;
  unitId?: string;
  unitName?: string;
  matchScore: number; // 0 to 100
  isConfirmed: boolean;

  // Numbers
  received_total: number;
  received_online: number;
  received_offline: number;
  carried_forward: number;

  completed_total: number;
  completed_early: number;
  completed_on_time: number;
  completed_late: number;

  pending_total: number;
  pending_on_time: number;
  pending_late: number;

  recalculatedReceived: number;
  recalculatedCompleted: number;
  recalculatedPending: number;
  balance: number;

  hasDifference: boolean;
  validationStatus: 'valid' | 'warning' | 'error';
  validationErrors: ValidationErrorItem[];
}

export interface ParseResult {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  sections: DetectedSection[];
  draftRows: ParsedStatisticDraft[];
  totalRowsFound: number;
  validRowsCount: number;
  warningRowsCount: number;
  errorRowsCount: number;
  unmappedFieldsCount: number;
}

// Normalize Vietnamese string for fuzzy match comparison
export function normalizeVietnamese(str: string): string {
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

// Calculate Levenshtein similarity (0 to 100)
export function calculateSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeVietnamese(s1);
  const norm2 = normalizeVietnamese(s2);
  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 85;

  const len1 = norm1.length;
  const len2 = norm2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = Math.max(0, Math.round(((maxLen - distance) / maxLen) * 100));
  return similarity;
}

// Find best matching field from catalog
export function findBestFieldMatch(rawName: string, fields: Field[], units: Unit[]): {
  field?: Field;
  unit?: Unit;
  score: number;
} {
  // 1. Try matching against sector name (f.linh_vuc) first
  let bestSectorScore = 0;
  let bestSectorField: Field | undefined;

  for (const f of fields) {
    if (f.linh_vuc) {
      const score = calculateSimilarity(rawName, f.linh_vuc);
      if (score > bestSectorScore) {
        bestSectorScore = score;
        bestSectorField = f;
      }
    }
  }

  // If a sector has a high match score (>= 80), use it
  if (bestSectorScore >= 80 && bestSectorField) {
    const unit = units.find((u) => u.id === bestSectorField?.unit_id);
    return { field: bestSectorField, unit, score: bestSectorScore };
  }

  // 2. Try matching against procedure name (f.name)
  let bestNameScore = 0;
  let bestNameField: Field | undefined;

  for (const f of fields) {
    const score = calculateSimilarity(rawName, f.name);
    if (score > bestNameScore) {
      bestNameScore = score;
      bestNameField = f;
    }
  }

  if (bestNameScore >= 70 && bestNameField) {
    const unit = units.find((u) => u.id === bestNameField?.unit_id);
    return { field: bestNameField, unit, score: bestNameScore };
  }

  // 3. Smart fallback: Try to match the unit name directly from the raw name (e.g. "Văn phòng")
  const matchedUnit = units.find(u => calculateSimilarity(rawName, u.name) >= 70);
  const fallbackField = fields.find(f => matchedUnit ? f.unit_id === matchedUnit.id : true) || fields[0];

  return {
    field: fallbackField,
    unit: matchedUnit || (fallbackField ? units.find(u => u.id === fallbackField.unit_id) : undefined),
    score: 50
  };
}

// Parse Excel Workbook Buffer into Raw Sheets
export function readWorkbook(buffer: ArrayBuffer): { workbook: XLSX.WorkBook; sheetNames: string[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  return { workbook, sheetNames: workbook.SheetNames };
}

// Process sheet rows into drafts
export function parseSheetToDrafts(
  sheet: XLSX.WorkSheet,
  fields: Field[],
  units: Unit[],
  sheetName: string = 'Sheet1',
  fileName: string = 'import.xlsx'
): ParseResult {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  const sections: DetectedSection[] = [];
  const draftRows: ParsedStatisticDraft[] = [];

  let currentSource = 'Nguồn tổng hợp';

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    // Check row text in first 3 columns
    const firstColText = String(row[0] || '').trim();
    const secondColText = String(row[1] || '').trim();
    const rowTextCombined = `${firstColText} ${secondColText}`.trim();
    const normRowText = normalizeVietnamese(rowTextCombined);

    // 1. Skip Title, Header and Column numbering rows (1)(2)(3)...
    if (
      normRowText.includes('tong hop tinh hinh') ||
      normRowText.includes('stt') ||
      normRowText.includes('linh vuc giai quyet') ||
      /^\(?\d+\)?$/.test(firstColText) && /^\(?\d+\)?$/.test(secondColText)
    ) {
      continue;
    }

    // 2. CRITICAL: Skip 'TỔNG CỘNG' row! Prompt rules: "Dòng TỔNG CỘNG là kết quả tổng hợp, KHÔNG import như dữ liệu gốc."
    if (normRowText.startsWith('tong cong') || normRowText === 'tong' || normRowText.includes('tong so')) {
      continue;
    }

    // 3. Detect Source Sections (e.g., "Trên Hệ thống các Bộ", "Trên Hệ thống thành phố", "Hệ thống chuyên ngành")
    const isSourceHeader =
      normRowText.includes('he thong cac bo') ||
      normRowText.includes('he thong thanh pho') ||
      normRowText.startsWith('tren he thong') ||
      normRowText.includes('he thong mot cua') ||
      (normRowText.startsWith('i.') || normRowText.startsWith('ii.') || normRowText.startsWith('iii.')) &&
      (normRowText.includes('he thong') || normRowText.includes('nguon'));

    if (isSourceHeader) {
      currentSource = rowTextCombined.replace(/^[I|V|X|\.|\-|\s]+/g, '').trim();
      sections.push({
        sourceName: currentSource,
        startRow: i + 1,
        endRow: i + 1,
      });
      continue;
    }

    // 4. Check if this is a Field Data Row
    // Usually Column 0 is STT (1, 2, 3...) or empty, Column 1 is Field Name (e.g. "Chứng thực", "Hộ tịch")
    const candidateFieldName = secondColText || firstColText;
    if (!candidateFieldName || candidateFieldName.length < 2) continue;

    // Check if there are numeric values across columns 2..12
    const numValues: number[] = [];
    for (let c = 2; c <= 13; c++) {
      const rawVal = row[c];
      const parsedVal = typeof rawVal === 'number' ? rawVal : Number(String(rawVal).replace(/[^0-9.-]/g, '')) || 0;
      numValues.push(parsedVal);
    }

    const hasAnyNumber = numValues.some((v) => v > 0);
    // If no numbers at all and doesn't match any known field, skip
    const { field, unit, score } = findBestFieldMatch(candidateFieldName, fields, units);
    if (!hasAnyNumber && score < 70) {
      continue;
    }

    // Extract columns according to specification:
    // Cột (3): Tổng tiếp nhận (idx 2)
    // Cột (4): Trực tuyến (idx 3)
    // Cột (5): Trực tiếp (idx 4)
    // Cột (6): Từ kỳ trước (idx 5)
    // Cột (7): Tổng đã giải quyết (idx 6)
    // Cột (8): Trước hạn (idx 7)
    // Cột (9): Đúng hạn (idx 8)
    // Cột (10): Quá hạn (idx 9)
    // Cột (11): Tổng đang giải quyết (idx 10)
    // Cột (12): Trong hạn (idx 11)
    // Cột (13): Quá hạn (idx 12)
    const recTotal = numValues[0] || 0;
    const recOnline = numValues[1] || 0;
    const recOffline = numValues[2] || 0;
    const carried = numValues[3] || 0;

    const compTotal = numValues[4] || 0;
    const compEarly = numValues[5] || 0;
    const compOnTime = numValues[6] || 0;
    const compLate = numValues[7] || 0;

    const pendTotal = numValues[8] || 0;
    const pendOnTime = numValues[9] || 0;
    const pendLate = numValues[10] || 0;

    const valResult = validateStatisticRow({
      received_total: recTotal,
      received_online: recOnline,
      received_offline: recOffline,
      carried_forward: carried,
      completed_total: compTotal,
      completed_early: compEarly,
      completed_on_time: compOnTime,
      completed_late: compLate,
      pending_total: pendTotal,
      pending_on_time: pendOnTime,
      pending_late: pendLate,
      field_name: candidateFieldName,
      source_name: currentSource,
    });

    const isMatched = score >= 75 && Boolean(field);
    const resolvedSector = isMatched
      ? (field?.linh_vuc || field?.name || resolveLinhVuc(candidateFieldName, field?.id, fields))
      : resolveLinhVuc(candidateFieldName, undefined, fields);

    draftRows.push({
      rowNumber: i + 1,
      sourceName: currentSource,
      rawFieldName: candidateFieldName,
      matchedFieldId: isMatched ? field?.id : undefined,
      matchedFieldName: resolvedSector,
      unitId: isMatched ? unit?.id : undefined,
      unitName: isMatched ? unit?.name : undefined,
      matchScore: score,
      isConfirmed: isMatched,

      received_total: recTotal,
      received_online: recOnline,
      received_offline: recOffline,
      carried_forward: carried,

      completed_total: compTotal,
      completed_early: compEarly,
      completed_on_time: compOnTime,
      completed_late: compLate,

      pending_total: pendTotal,
      pending_on_time: pendOnTime,
      pending_late: pendLate,

      recalculatedReceived: valResult.recalculated.received_total,
      recalculatedCompleted: valResult.recalculated.completed_total,
      recalculatedPending: valResult.recalculated.pending_total,
      balance: valResult.recalculated.balance,

      hasDifference: valResult.recalculated.source_diff_received !== 0 ||
                     valResult.recalculated.source_diff_completed !== 0 ||
                     valResult.recalculated.source_diff_pending !== 0,
      validationStatus: valResult.isValid ? (valResult.hasWarning ? 'warning' : 'valid') : 'error',
      validationErrors: valResult.errors,
    });
  }

  // Update sections end rows
  if (sections.length === 0) {
    sections.push({
      sourceName: currentSource,
      startRow: 1,
      endRow: rawRows.length,
    });
  }

  return {
    fileName,
    sheetNames: [sheetName],
    selectedSheet: sheetName,
    sections,
    draftRows,
    totalRowsFound: draftRows.length,
    validRowsCount: draftRows.filter((r) => r.validationStatus === 'valid' && r.matchedFieldId).length,
    warningRowsCount: draftRows.filter((r) => r.validationStatus === 'warning').length,
    errorRowsCount: draftRows.filter((r) => r.validationStatus === 'error' || !r.matchedFieldId).length,
    unmappedFieldsCount: draftRows.filter((r) => !r.matchedFieldId).length,
  };
}

// Export Sample Excel Template Generator
export function generateSampleExcelBuffer(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Create TONGHOP sheet mimicking the real administrative template
  const data = [
    ['TỔNG HỢP TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH'],
    ['Kỳ báo cáo mẫu: Tháng 01/2026'],
    [],
    [
      'STT',
      'Lĩnh vực giải quyết',
      'Tổng số hồ sơ tiếp nhận (3)',
      'Trực tuyến (4)',
      'Trực tiếp, dịch vụ bưu chính (5)',
      'Từ kỳ trước (6)',
      'Tổng số hồ sơ đã giải quyết (7)',
      'Trước hạn (8)',
      'Đúng hạn (9)',
      'Quá hạn (10)',
      'Tổng số hồ sơ đang giải quyết (11)',
      'Trong hạn (12)',
      'Quá hạn (13)',
    ],
    ['I', 'Trên Hệ thống các Bộ'],
    ['1', 'Chứng thực', 2400, 2280, 105, 15, 2375, 1750, 625, 0, 25, 25, 0],
    ['2', 'Hộ tịch', 1100, 1030, 60, 10, 1087, 700, 385, 2, 13, 13, 0],
    ['3', 'An toàn thực phẩm', 150, 130, 17, 3, 147, 95, 52, 0, 3, 3, 0],
    ['4', 'Hàng hải và đường thủy nội địa', 65, 55, 8, 2, 64, 42, 22, 0, 1, 1, 0],
    ['5', 'Bảo trợ xã hội', 320, 290, 25, 5, 315, 210, 105, 0, 5, 5, 0],
    ['6', 'Người có công', 240, 220, 18, 2, 238, 160, 77, 1, 2, 2, 0],
    [],
    ['II', 'Trên Hệ thống thành phố'],
    // Chênh lệch mô phỏng: Nguồn ghi 10.361, nhưng trực tuyến là 10.362, trực tiếp 0, từ kỳ trước 0
    ['1', 'Chứng thực (Mẫu chênh lệch)', 10361, 10362, 0, 0, 10361, 7200, 3140, 21, 0, 0, 0],
    ['2', 'Hộ tịch', 1850, 1720, 110, 20, 1832, 1250, 580, 2, 18, 18, 0],
    ['3', 'Phí, lệ phí', 720, 680, 35, 5, 712, 480, 232, 0, 8, 8, 0],
    ['4', 'Đất đai', 1650, 1480, 140, 30, 1625, 980, 630, 15, 25, 25, 0],
    ['5', 'Quy hoạch đô thị và nông thôn', 140, 125, 12, 3, 136, 85, 50, 1, 4, 4, 0],
    ['6', 'Hoạt động xây dựng', 280, 250, 24, 6, 276, 170, 103, 3, 4, 4, 0],
    ['7', 'Bảo trợ xã hội', 380, 350, 25, 5, 375, 245, 130, 0, 5, 5, 0],
    ['8', 'Chính sách', 290, 260, 26, 4, 287, 190, 96, 1, 3, 3, 0],
    [],
    ['', 'TỔNG CỘNG', 19896, 18882, 940, 75, 19788, 13507, 6232, 49, 108, 108, 0],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'TONGHOP');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
