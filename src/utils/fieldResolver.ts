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
 * Single Source of Truth: Supabase fields table (public.fields).
 * If no matching field is found in Supabase fields, returns "Chưa phân loại".
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

  const cleanRaw = (rawText || '').trim();
  const normRaw = normalizeText(cleanRaw);

  if (availableFields && availableFields.length > 0) {
    // 1. Match by fieldId if provided
    if (fieldId) {
      const matchedById = availableFields.find((f) => f.id === fieldId);
      if (matchedById) {
        const resolvedName = matchedById.linh_vuc || matchedById.name || 'Chưa phân loại';
        return {
          linhVuc: resolvedName,
          isMapped: resolvedName !== 'Chưa phân loại',
          field: matchedById,
        };
      }
    }

    // 2. Match by exact code or name in Supabase fields
    if (normRaw) {
      const matchedByNameOrCode = availableFields.find(
        (f) => normalizeText(f.code) === normRaw || normalizeText(f.name) === normRaw
      );
      if (matchedByNameOrCode) {
        const resolvedName = matchedByNameOrCode.linh_vuc || matchedByNameOrCode.name || 'Chưa phân loại';
        return {
          linhVuc: resolvedName,
          isMapped: resolvedName !== 'Chưa phân loại',
          field: matchedByNameOrCode,
        };
      }
    }
  }

  // Not found in Supabase fields: return "Chưa phân loại" with isMapped: false
  return {
    linhVuc: 'Chưa phân loại',
    isMapped: false,
  };
}
