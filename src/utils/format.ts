export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('vi-VN');
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0%';
  return `${Number(val).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
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
