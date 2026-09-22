import { Field } from '../types/database';

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

export interface LinhVucResolutionResult {
  linhVuc: string;
  isMapped: boolean;
  field?: Field;
}

/**
 * Resolves a procedure text, snapshot string, or field ID into its exact official Lĩnh vực (Field/Sector).
 * Strictly maps using CSDL (public.fields) data. Does NOT perform keyword guessing or string inference.
 */
export function resolveLinhVuc(
  rawText: string,
  fieldId?: string,
  availableFields?: Field[]
): string {
  const res = resolveLinhVucDetails(rawText, fieldId, availableFields);
  return res.linhVuc;
}

/**
 * Resolves with full mapping metadata.
 */
export function resolveLinhVucDetails(
  rawText: string,
  fieldId?: string,
  availableFields?: Field[]
): LinhVucResolutionResult {
  if (!rawText && !fieldId) {
    return { linhVuc: 'Chưa phân loại', isMapped: false };
  }

  let matchedField: Field | undefined;

  if (availableFields && availableFields.length > 0) {
    if (fieldId) {
      matchedField = availableFields.find((f) => f.id === fieldId);
    }

    if (!matchedField && rawText) {
      const normRaw = normalizeText(rawText);
      matchedField = availableFields.find(
        (f) =>
          normalizeText(f.code) === normRaw ||
          normalizeText(f.name) === normRaw ||
          normalizeText(f.linh_vuc || '') === normRaw
      );
    }
  }

  if (matchedField) {
    const cleanLinhVuc = (matchedField.linh_vuc || '').trim();
    if (cleanLinhVuc && cleanLinhVuc !== 'Chưa phân loại') {
      return {
        linhVuc: cleanLinhVuc,
        isMapped: true,
        field: matchedField,
      };
    }
    // If field exists in database catalog, return its recorded linh_vuc or 'Chưa phân loại'
    return {
      linhVuc: cleanLinhVuc || 'Chưa phân loại',
      isMapped: false,
      field: matchedField,
    };
  }

  // Fallback if no matching field in database catalog
  const cleanRaw = (rawText || '').trim();
  return {
    linhVuc: cleanRaw || 'Chưa phân loại',
    isMapped: false,
  };
}
