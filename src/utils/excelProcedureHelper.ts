import * as XLSX from 'xlsx';
import type { Field, Unit } from '../types/database';
import { SAMPLE_PROCEDURES_DATA, type ProcedureExcelRow } from '../data/sampleProcedures';

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
  matched_unit_id?: string;
  isExisting?: boolean;
}

// Normalize Vietnamese strings for matching
export function normalizeVi(str: string): string {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

// Find existing unit by name or code
export function matchUnitByNameOrCode(rawName: string, units: Unit[]): Unit | undefined {
  if (!rawName) return undefined;
  const clean = normalizeVi(rawName);

  // Exact code match
  const byCode = units.find(u => normalizeVi(u.code) === clean);
  if (byCode) return byCode;

  // Exact name match
  const byName = units.find(u => normalizeVi(u.name) === clean);
  if (byName) return byName;

  // Synonym / abbreviation mappings for common district/commune units
  if (clean.includes('van phong') || clean === 'vp') {
    const vp = units.find(u => normalizeVi(u.code) === 'vp' || normalizeVi(u.name).includes('van phong'));
    if (vp) return vp;
  }
  if (clean.includes('kinh te') || clean === 'pkt') {
    const pkt = units.find(u => normalizeVi(u.code) === 'pkt' || normalizeVi(u.name).includes('kinh te'));
    if (pkt) return pkt;
  }
  if (clean.includes('van hoa') || clean.includes('vhxh') || clean.includes('pvhxh')) {
    const pvhxh = units.find(u => normalizeVi(u.code) === 'pvhxh' || normalizeVi(u.name).includes('vhxh') || normalizeVi(u.name).includes('van hoa'));
    if (pvhxh) return pvhxh;
  }

  // Partial match
  return units.find(u => {
    const uNorm = normalizeVi(u.name);
    return uNorm.includes(clean) || clean.includes(uNorm);
  });
}

// Parse Excel ArrayBuffer or file into structured rows
export function parseProceduresExcel(
  fileBuffer: ArrayBuffer,
  existingFields: Field[],
  units: Unit[]
): {
  rows: ParsedProcedureRow[];
  headers: string[];
  detectedNewUnits: string[];
} {
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
    const strRow = row.map(c => String(c || '').toLowerCase().trim());

    const cIdx = strRow.findIndex(c => c.includes('mã tthc') || c.includes('ma tthc') || c.includes('mã thủ tục') || c === 'mã');
    const nIdx = strRow.findIndex(c => c.includes('tên thủ tục') || c.includes('ten thu tuc') || c.includes('tên tthc') || c === 'tên');
    const sIdx = strRow.findIndex(c => c.includes('lĩnh vực') || c.includes('linh vuc'));
    const uIdx = strRow.findIndex(c => c.includes('đơn vị thực hiện') || c.includes('đơn vị') || c.includes('don vi') || c.includes('phụ trách') || c.includes('chủ trì'));

    if (cIdx !== -1 && (nIdx !== -1 || sIdx !== -1)) {
      headerRowIndex = i;
      codeColIdx = cIdx;
      nameColIdx = nIdx;
      sectorColIdx = sIdx;
      unitColIdx = uIdx;
      break;
    }
  }

  const rawHeaders = (rawRows[headerRowIndex] as unknown[] || []).map(h => String(h || '').trim());

  // Determine column positions with fallbacks
  const findCol = (keywords: string[], fallbackIdx: number): number => {
    const idx = rawHeaders.findIndex(h => {
      const lower = h.toLowerCase();
      return keywords.some(k => lower.includes(k));
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
  const unitIdx = unitColIdx !== -1 ? unitColIdx : findCol(['đơn vị thực hiện', 'đơn vị phụ trách', 'đơn vị chủ trì', 'đơn vị'], 10);

  const existingCodesMap = new Map(existingFields.map(f => [f.code.trim().toLowerCase(), f]));
  const detectedNewUnitsSet = new Set<string>();
  const parsedRows: ParsedProcedureRow[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.length === 0) continue;

    const code = String(row[codeIdx] ?? '').trim();
    const name = String(row[nameIdx] ?? '').trim();
    const linh_vuc = String(row[sectorIdx] ?? '').trim();

    // Skip empty lines or sub-headers with no code and name
    if (!code && !name) continue;
    if (!name && code) continue; // dangling code without name

    const rawUnit = String(row[unitIdx] ?? '').trim();
    const matchedUnit = matchUnitByNameOrCode(rawUnit, units);

    if (rawUnit && !matchedUnit) {
      detectedNewUnitsSet.add(rawUnit);
    }

    const isExisting = existingCodesMap.has(code.toLowerCase());

    parsedRows.push({
      stt: row[sttIdx] ? String(row[sttIdx]).trim() : parsedRows.length + 1,
      code: code || `TTHC-${parsedRows.length + 1}`,
      name: name,
      linh_vuc: linh_vuc || 'Chưa phân loại',
      co_quan_cong_bo: String(row[cqcbIdx] ?? '').trim(),
      loai_tthc: String(row[loaiIdx] ?? '').trim(),
      co_quan_thuc_hien: String(row[cqthIdx] ?? '').trim(),
      cap_thuc_hien: String(row[capIdx] ?? '').trim(),
      muc_do_cung_cap: String(row[mucDoIdx] ?? '').trim(),
      phi_le_phi: String(row[phiIdx] ?? '').trim(),
      raw_unit_name: rawUnit,
      matched_unit_id: matchedUnit?.id,
      isExisting,
    });
  }

  return {
    rows: parsedRows,
    headers: rawHeaders,
    detectedNewUnits: Array.from(detectedNewUnitsSet),
  };
}

// Export current catalog to Excel with all 11 columns
export function exportCatalogToExcel(fields: Field[], units: Unit[], fileName = 'DanhMuc_LinhVuc_TTHC.xlsx') {
  const unitsMap = new Map(units.map(u => [u.id, u.name]));

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
    'Đơn vị thực hiện',
  ];

  // Sort by Lĩnh vực, then display_order
  const sorted = [...fields].sort((a, b) => {
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

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 14 }, // Mã TTHC
    { wch: 45 }, // Tên Thủ tục
    { wch: 28 }, // Lĩnh vực
    { wch: 25 }, // Cơ quan công bố
    { wch: 18 }, // Loại TTHC
    { wch: 30 }, // Cơ quan thực hiện
    { wch: 14 }, // Cấp thực hiện
    { wch: 18 }, // Mức độ cung cấp
    { wch: 16 }, // Phí - lệ phí
    { wch: 24 }, // Đơn vị thực hiện
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh mục TTHC');
  XLSX.writeFile(wb, fileName);
}

// Download formatted sample template Excel file based on user's real data
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
    'Đơn vị thực hiện',
  ];

  const dataRows = SAMPLE_PROCEDURES_DATA.map((row, idx) => [
    idx + 1,
    row.code,
    row.name,
    row.linh_vuc,
    row.co_quan_cong_bo || '',
    row.loai_tthc || '',
    row.co_quan_thuc_hien || '',
    row.cap_thuc_hien || '',
    row.muc_do_cung_cap || '',
    row.phi_le_phi || '',
    row.don_vi_thuc_hien || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

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
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh mục TTHC Chuẩn');
  XLSX.writeFile(wb, fileName);
}
