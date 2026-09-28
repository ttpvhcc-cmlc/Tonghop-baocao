import { store } from '../services/store';

export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('vi-VN');
}

export function roundNumber(
  val: number,
  decimals: number,
  mode: 'half_up' | 'floor' | 'ceil' = 'half_up'
): number {
  const factor = Math.pow(10, decimals);
  if (mode === 'floor') {
    return Math.floor(val * factor + 0.000000001) / factor;
  }
  if (mode === 'ceil') {
    return Math.ceil(val * factor - 0.000000001) / factor;
  }
  // half_up
  return Math.round(val * factor) / factor;
}

export function getSystemRoundingConfig() {
  try {
    const cfg = store.getSystemConfig();
    return {
      decimals: typeof cfg?.percentRoundingDecimals === 'number' ? cfg.percentRoundingDecimals : 2,
      mode: cfg?.percentRoundingMode || 'half_up',
      keepTrailingZeros: cfg?.percentRoundingTrailingZeros ?? true,
    };
  } catch {
    return { decimals: 2, mode: 'half_up' as const, keepTrailingZeros: true };
  }
}

export function formatPercent(val: number | null | undefined, overrideDecimals?: number): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  if (Math.abs(num - 100) < 0.00001) return '100%';
  if (Math.abs(num) < 0.00001) return '0%';

  const sysCfg = getSystemRoundingConfig();
  const decimals = typeof overrideDecimals === 'number' ? overrideDecimals : sysCfg.decimals;
  const rounded = roundNumber(num, decimals, sysCfg.mode);

  const minDigits = sysCfg.keepTrailingZeros ? decimals : 0;
  return `${rounded.toLocaleString('vi-VN', { minimumFractionDigits: minDigits, maximumFractionDigits: decimals })}%`;
}

export function formatRatePercent(val: number | null | undefined, overrideDecimals?: number): string {
  return formatPercent(val, overrideDecimals);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
  } catch {
    return dateStr;
  }
}

export function getStatusBadge(status: string): { label: string; bg: string; text: string; border: string } {
  switch (status) {
    case 'draft':
      return { label: 'Bản nháp', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
    case 'imported':
      return { label: 'Đã nhập số liệu', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'validated':
      return { label: 'Đã thẩm định', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'submitted':
      return { label: 'Đã trình duyệt', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'approved':
      return { label: 'Đã phê duyệt', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'locked':
      return { label: 'Đã khóa snapshot', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'archived':
      return { label: 'Lưu trữ', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' };
    default:
      return { label: status, bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  }
}
