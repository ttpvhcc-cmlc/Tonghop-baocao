import * as XLSX from 'xlsx';
import type { Field, Unit } from '../types/database';

export interface ParsedProcedureRow {
  stt?: number | string;
  code: string;
  name: string;
  linh_vuc: string;
  co_quan_cong_bo: string;
  loai_tthc: string;
  co_quan_thuc_hien: string;
  cap_thuc_hien: string;
  muc_do_cung_cap: string;
  phi_le_phi: string;
  raw_unit_name: string;
  matched_unit_id?: string | null;
  matched_unit_name?: string;
  matched_unit_code?: string;
  isMapped: boolean;
  isExisting?: boolean;
  fileRowNum?: number;
}

export interface CodeConflict {
  code: string;
  instances: { rowNum: number; name: string; linh_vuc: string }[];
  reason: string;
}

export interface UnrecognizedUnitError {
  rawUnit: string;
  rowNum: number;
  code: string;
}

export interface ExcelProcedureParseResult {
  rows: ParsedProcedureRow[];
  headers: string[];
  totalRowsCount: number;
  newCount: number;
  updatedCount: number;
  assignedUnitCount: number;
  unassignedUnitCount: number;
  skippedTestCount: number;
  duplicateRowsCount: number;
  conflicts: CodeConflict[];
  unrecognizedUnits: UnrecognizedUnitError[];
}

/**
 * Normalizes string for exact matching (trim and lowercase)
 */
export function normalizeKey(str: string): string {
  return (str || '').trim().toLowerCase();
}

/**
 * Checks if a procedure code is a test code that should be excluded
 */
export function isTestProcedureCode(code: string): boolean {
  const clean = (code || '').trim().toUpperCase();
  return (
    clean === 'IMP_F_1789834010478' ||
    clean.startsWith('IMP_F_') ||
    clean.startsWith('TEST_') ||
    clean.startsWith('DEMO_')
  );
}

/**
 * Matches unit name or code from Excel directly with public.units table:
 * - If rawUnitName is empty -> returns { unit: null, isProvided: false, isMatched: true }
 * - If rawUnitName matches units.code or units.name -> returns { unit: matched, isProvided: true, isMatched: true }
 * - If rawUnitName is provided but not in public.units -> returns { unit: null, isProvided: true, isMatched: false }
 */
export function matchUnitFromExcel(
  rawUnitName: string,
  units: Unit[]
): { unit: Unit | null; isProvided: boolean; isMatched: boolean } {
  const clean = (rawUnitName || '').trim();
  if (!clean) {
    return { unit: null, isProvided: false, isMatched: true };
  }
  const cleanNorm = normalizeKey(clean);
  const matched = units.find(
    (u) =>
      normalizeKey(u.name) === cleanNorm ||
      normalizeKey(u.code) === cleanNorm
  );
  if (matched) {
    return { unit: matched, isProvided: true, isMatched: true };
  }
  return { unit: null, isProvided: true, isMatched: false };
}

/**
 * Parse Excel ArrayBuffer into structured procedure rows:
 * 1. Excel column "Đơn vị thực hiện":
 *    - Lấy giá trị đó đối chiếu chính xác với public.units theo units.code hoặc units.name.
 *    - Nếu khớp -> fields.unit_id = units.id, Preview hiển thị units.name.
 *    - Nếu có nhưng không khớp -> Báo lỗi và chặn Import.
 * 2. Excel không có / để trống:
 *    - fields.unit_id = null, Preview hiển thị "Chưa phân công".
 * 3. Loại trừ mã test và kiểm tra xung đột trùng mã trong file.
 */
export function parseProceduresExcel(
  fileBuffer: ArrayBuffer,
  existingFields: Field[],
  units: Unit[]
): ExcelProcedureParseResult {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
  if (rawRows.length === 0) {
    throw new Error('Tệp Excel không có dữ liệu.');
  }

  // Find header row (usually row 0 or row 1)
  let headerRowIndex = 0;
  let codeColIdx = -1;
  let nameColIdx = -1;
  let sectorColIdx = -1;
  let unitColIdx = -1;

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i] as unknown[];
    const strRow = row.map((c) => String(c || '').toLowerCase().trim());

    const cIdx = strRow.findIndex(
      (c) => c.includes('mã tthc') || c.includes('ma tthc') || c.includes('mã thủ tục') || c === 'mã'
    );
    const nIdx = strRow.findIndex(
      (c) => c.includes('tên thủ tục') || c.includes('ten thu tuc') || c.includes('tên tthc') || c === 'tên'
    );
    const sIdx = strRow.findIndex((c) => c.includes('lĩnh vực') || c.includes('linh vuc'));
    const uIdx = strRow.findIndex(
      (c) =>
        c.includes('đơn vị giải quyết') ||
        c.includes('đơn vị thực hiện') ||
        c.includes('đơn vị') ||
        c.includes('don vi') ||
        c.includes('phụ trách') ||
        c.includes('chủ trì')
    );

    if (cIdx !== -1 && (nIdx !== -1 || sIdx !== -1)) {
      headerRowIndex = i;
      codeColIdx = cIdx;
      nameColIdx = nIdx;
      sectorColIdx = sIdx;
      unitColIdx = uIdx;
      break;
    }
  }

  const rawHeaders = ((rawRows[headerRowIndex] as unknown[]) || []).map((h) => String(h || '').trim());

  const findCol = (keywords: string[], fallbackIdx: number): number => {
    const idx = rawHeaders.findIndex((h) => {
      const lower = h.toLowerCase();
      return keywords.some((k) => lower.includes(k));
    });
    return idx !== -1 ? idx : fallbackIdx;
  };

  const sttIdx = findCol(['stt', 'số tt', 'thứ tự'], 0);
  const codeIdx = codeColIdx !== -1 ? codeColIdx : findCol(['mã tthc', 'mã', 'code'], 1);
  const nameIdx = nameColIdx !== -1 ? nameColIdx : findCol(['tên thủ tục', 'tên tthc', 'tên'], 2);
  const sectorIdx = sectorColIdx !== -1 ? sectorColIdx : findCol(['lĩnh vực', 'linh vuc'], 3);
  const cqcbIdx = findCol(['công bố', 'cơ quan công bố'], 4);
  const loaiIdx = findCol(['loại tthc', 'loại'], 5);
  const cqthIdx = findCol(['cơ quan thực hiện', 'cơ quan'], 6);
  const capIdx = findCol(['cấp thực hiện', 'cấp'], 7);
  const mucDoIdx = findCol(['mức độ', 'mức độ cung cấp', 'dvc'], 8);
  const phiIdx = findCol(['phí', 'lệ phí'], 9);
  const unitIdx =
    unitColIdx !== -1
      ? unitColIdx
      : findCol(['đơn vị giải quyết', 'đơn vị thực hiện', 'đơn vị phụ trách', 'đơn vị'], 10);

  const existingCodesMap = new Map(existingFields.map((f) => [normalizeKey(f.code), f]));

  // Track codes seen inside this file to detect conflicts or duplicates
  const codeTracker = new Map<string, { rowNum: number; name: string; linh_vuc: string; item: ParsedProcedureRow }[]>();
  const unrecognizedUnits: UnrecognizedUnitError[] = [];

  let skippedTestCount = 0;
  let duplicateRowsCount = 0;

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.length === 0) continue;

    const code = String(row[codeIdx] ?? '').trim();
    const name = String(row[nameIdx] ?? '').trim();
    const linh_vuc = String(row[sectorIdx] ?? '').trim();

    // Skip completely empty lines
    if (!code && !name) continue;
    if (!name && code) continue;

    // Filter out test codes
    if (isTestProcedureCode(code)) {
      skippedTestCount++;
      continue;
    }

    const rawUnit = unitIdx !== -1 ? String(row[unitIdx] ?? '').trim() : '';
    const cleanCode = code || `TTHC-${i}`;
    const codeKey = normalizeKey(cleanCode);

    // Match unit from Excel strictly against public.units
    const matchResult = matchUnitFromExcel(rawUnit, units);
    if (matchResult.isProvided && !matchResult.isMatched) {
      unrecognizedUnits.push({
        rawUnit,
        rowNum: i + 1,
        code: cleanCode,
      });
    }

    const isExisting = existingCodesMap.has(codeKey);

    const parsedItem: ParsedProcedureRow = {
      stt: row[sttIdx] ? String(row[sttIdx]).trim() : i - headerRowIndex,
      code: cleanCode,
      name: name,
      linh_vuc: linh_vuc || 'Chưa phân loại',
      co_quan_cong_bo: String(row[cqcbIdx] ?? '').trim(),
      loai_tthc: String(row[loaiIdx] ?? '').trim(),
      co_quan_thuc_hien: String(row[cqthIdx] ?? '').trim(),
      cap_thuc_hien: String(row[capIdx] ?? '').trim(),
      muc_do_cung_cap: String(row[mucDoIdx] ?? '').trim(),
      phi_le_phi: String(row[phiIdx] ?? '').trim(),
      raw_unit_name: rawUnit,
      matched_unit_id: matchResult.unit ? matchResult.unit.id : null,
      matched_unit_name: matchResult.unit ? matchResult.unit.name : undefined,
      matched_unit_code: matchResult.unit ? matchResult.unit.code : undefined,
      isMapped: !!matchResult.unit,
      isExisting,
      fileRowNum: i + 1,
    };

    const prevInstances = codeTracker.get(codeKey) || [];
    prevInstances.push({
      rowNum: i + 1,
      name: name.trim(),
      linh_vuc: (linh_vuc || 'Chưa phân loại').trim(),
      item: parsedItem,
    });
    codeTracker.set(codeKey, prevInstances);
  }

  // Analyze conflicts and deduplicate identical rows
  const parsedRows: ParsedProcedureRow[] = [];
  const conflicts: CodeConflict[] = [];

  for (const [codeKey, instances] of codeTracker.entries()) {
    if (instances.length === 1) {
      parsedRows.push(instances[0].item);
      continue;
    }

    // Check if duplicate entries are contradictory or identical
    const first = instances[0];
    const hasConflict = instances.some(
      (inst) =>
        normalizeKey(inst.name) !== normalizeKey(first.name) ||
        normalizeKey(inst.linh_vuc) !== normalizeKey(first.linh_vuc)
    );

    if (hasConflict) {
      conflicts.push({
        code: instances[0].item.code,
        instances: instances.map((inst) => ({
          rowNum: inst.rowNum,
          name: inst.name,
          linh_vuc: inst.linh_vuc,
        })),
        reason: `Mã TTHC "${instances[0].item.code}" xuất hiện ${instances.length} lần trong file với tên thủ tục hoặc lĩnh vực mâu thuẫn nhau.`,
      });
    } else {
      // Identical rows: keep the first one and count duplicates
      duplicateRowsCount += instances.length - 1;
      parsedRows.push(instances[0].item);
    }
  }

  // Sort rows by stt / row number
  parsedRows.sort((a, b) => (Number(a.fileRowNum) || 0) - (Number(b.fileRowNum) || 0));

  let newCount = 0;
  let updatedCount = 0;
  let assignedUnitCount = 0;
  let unassignedUnitCount = 0;

  parsedRows.forEach((r) => {
    if (r.isExisting) {
      updatedCount++;
    } else {
      newCount++;
    }

    if (r.matched_unit_id) {
      assignedUnitCount++;
    } else {
      unassignedUnitCount++;
    }
  });

  return {
    rows: parsedRows,
    headers: rawHeaders,
    totalRowsCount: parsedRows.length,
    newCount,
    updatedCount,
    assignedUnitCount,
    unassignedUnitCount,
    skippedTestCount,
    duplicateRowsCount,
    conflicts,
    unrecognizedUnits,
  };
}

/**
 * Export current catalog to Excel with standard 11 columns
 */
export function exportCatalogToExcel(fields: Field[], units: Unit[], fileName = 'DanhMuc_LinhVuc_TTHC.xlsx') {
  const unitsMap = new Map(units.map((u) => [u.id, u.name]));

  const headers = [
    'STT',
    'Mã TTHC',
    'Tên Thủ tục hành chính',
    'Lĩnh vực',
    'Cơ quan công bố',
    'Loại TTHC',
    'Cơ quan thực hiện',
    'Cấp thực hiện',
    'Mức độ cung cấp',
    'Phí - lệ phí',
    'Đơn vị giải quyết',
  ];

  // Filter out any test codes and sort
  const sorted = [...fields]
    .filter((f) => !isTestProcedureCode(f.code))
    .sort((a, b) => {
      const secA = (a.linh_vuc || 'Chưa phân loại').toLowerCase();
      const secB = (b.linh_vuc || 'Chưa phân loại').toLowerCase();
      if (secA !== secB) return secA.localeCompare(secB, 'vi');
      return (a.display_order || 0) - (b.display_order || 0);
    });

  const dataRows = sorted.map((f, idx) => [
    idx + 1,
    f.code,
    f.name,
    f.linh_vuc || 'Chưa phân loại',
    f.co_quan_cong_bo || '',
    f.loai_tthc || '',
    f.co_quan_thuc_hien || '',
    f.cap_thuc_hien || '',
    f.muc_do_cung_cap || '',
    f.phi_le_phi || '',
    f.unit_id ? unitsMap.get(f.unit_id) || '' : '',
  ]);

  const worksheetData = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 45 },
    { wch: 28 },
    { wch: 25 },
    { wch: 18 },
    { wch: 30 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh mục TTHC');
  XLSX.writeFile(wb, fileName);
}

/**
 * Download blank template Excel file with official columns for importing procedures
 */
export function downloadSampleExcelTemplate(fileName = 'Mau_Import_LinhVuc_TTHC.xlsx') {
  const headers = [
    'STT',
    'Mã TTHC',
    'Tên Thủ tục hành chính',
    'Lĩnh vực',
    'Cơ quan công bố',
    'Loại TTHC',
    'Cơ quan thực hiện',
    'Cấp thực hiện',
    'Mức độ cung cấp',
    'Phí - lệ phí',
    'Đơn vị giải quyết',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers]);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 45 },
    { wch: 28 },
    { wch: 25 },
    { wch: 18 },
    { wch: 30 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh mục TTHC');
  XLSX.writeFile(wb, fileName);
}
