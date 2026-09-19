import { ValidationErrorItem } from '../../types/database';

/**
 * An toàn không dùng eval().
 * Chứa toàn bộ công thức chuẩn mực theo quy định báo cáo thống kê tiếp nhận, giải quyết TTHC.
 */

// 1. Tổng số hồ sơ tiếp nhận tính lại theo thành phần
export function calcReceivedTotal(
  online: number = 0,
  offline: number = 0,
  carriedForward: number = 0
): number {
  return (Number(online) || 0) + (Number(offline) || 0) + (Number(carriedForward) || 0);
}

// 2. Tổng số hồ sơ đã giải quyết tính lại theo thành phần
export function calcCompletedTotal(
  early: number = 0,
  onTime: number = 0,
  late: number = 0
): number {
  return (Number(early) || 0) + (Number(onTime) || 0) + (Number(late) || 0);
}

// 3. Tổng số hồ sơ đang giải quyết tính lại theo thành phần
export function calcPendingTotal(
  inTime: number = 0,
  late: number = 0
): number {
  return (Number(inTime) || 0) + (Number(late) || 0);
}

// 4. Kiểm tra độ cân bằng (Balance): Tiếp nhận vs (Đã giải quyết + Đang giải quyết)
export function calcBalance(
  receivedTotal: number,
  completedTotal: number,
  pendingTotal: number
): number {
  return (Number(receivedTotal) || 0) - ((Number(completedTotal) || 0) + (Number(pendingTotal) || 0));
}

// 5. Tỷ lệ giải quyết hồ sơ (%)
export function calcCompletionRate(
  completedTotal: number,
  receivedTotal: number
): number {
  if (!receivedTotal || receivedTotal <= 0) return 0;
  return Number(((completedTotal / receivedTotal) * 100).toFixed(2));
}

// 6. Tỷ lệ giải quyết đúng và trước hạn (%)
export function calcOnTimeRate(
  completedEarly: number,
  completedOnTime: number,
  completedTotal: number
): number {
  if (!completedTotal || completedTotal <= 0) return 100;
  const onTimeSum = (Number(completedEarly) || 0) + (Number(completedOnTime) || 0);
  return Number(((onTimeSum / completedTotal) * 100).toFixed(2));
}

// 7. Tỷ lệ giải quyết quá hạn (%)
export function calcLateRate(
  completedLate: number,
  completedTotal: number
): number {
  if (!completedTotal || completedTotal <= 0) return 0;
  return Number(((completedLate / completedTotal) * 100).toFixed(2));
}

// 8. Tỷ lệ nộp hồ sơ trực tuyến (%)
export function calcOnlineRate(
  online: number,
  offline: number
): number {
  const newReceived = (Number(online) || 0) + (Number(offline) || 0);
  if (!newReceived || newReceived <= 0) return 0;
  return Number(((online / newReceived) * 100).toFixed(2));
}

// 9. Tỷ lệ hồ sơ đang giải quyết trong hạn (%)
export function calcPendingRate(
  pendingOnTime: number,
  pendingTotal: number
): number {
  if (!pendingTotal || pendingTotal <= 0) return 100;
  return Number(((pendingOnTime / pendingTotal) * 100).toFixed(2));
}

// 10. Thay đổi tuyệt đối giữa hai kỳ
export function calcChangeAbsolute(
  currentVal: number,
  previousVal: number
): number {
  return (Number(currentVal) || 0) - (Number(previousVal) || 0);
}

// 11. Thay đổi phần trăm (%) giữa hai kỳ
export function calcChangePercent(
  currentVal: number,
  previousVal: number
): number {
  const prev = Number(previousVal) || 0;
  const curr = Number(currentVal) || 0;
  if (prev === 0) {
    return curr === 0 ? 0 : 100;
  }
  return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(2));
}

export interface MetricValidationResult {
  isValid: boolean;
  hasWarning: boolean;
  errors: ValidationErrorItem[];
  recalculated: {
    received_total: number;
    completed_total: number;
    pending_total: number;
    balance: number;
    source_diff_received: number;
    source_diff_completed: number;
    source_diff_pending: number;
  };
}

export function validateStatisticRow(data: {
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
  field_name?: string;
  source_name?: string;
}): MetricValidationResult {
  const errors: ValidationErrorItem[] = [];

  // Check negative numbers
  const numericFields: Array<[string, number, string]> = [
    ['received_total', data.received_total, 'Tổng tiếp nhận'],
    ['received_online', data.received_online, 'Tiếp nhận trực tuyến'],
    ['received_offline', data.received_offline, 'Tiếp nhận trực tiếp/bưu chính'],
    ['carried_forward', data.carried_forward, 'Từ kỳ trước'],
    ['completed_total', data.completed_total, 'Tổng đã giải quyết'],
    ['completed_early', data.completed_early, 'Đã giải quyết trước hạn'],
    ['completed_on_time', data.completed_on_time, 'Đã giải quyết đúng hạn'],
    ['completed_late', data.completed_late, 'Đã giải quyết quá hạn'],
    ['pending_total', data.pending_total, 'Tổng đang giải quyết'],
    ['pending_on_time', data.pending_on_time, 'Đang giải quyết trong hạn'],
    ['pending_late', data.pending_late, 'Đang giải quyết quá hạn'],
  ];

  for (const [key, val, label] of numericFields) {
    if (val < 0) {
      errors.push({
        field: key,
        message: `${label} không được mang giá trị âm (${val})`,
        type: 'error',
      });
    }
  }

  // Recalculations and strict validation of the 4 business equations:
  // 1. received_total = online + in_person + previous_period
  // 2. resolved_total = early + on_time + late
  // 3. pending_total = within_deadline + overdue
  // 4. received_total = resolved_total + pending_total
  const calcRec = calcReceivedTotal(data.received_online, data.received_offline, data.carried_forward);
  const calcComp = calcCompletedTotal(data.completed_early, data.completed_on_time, data.completed_late);
  const calcPend = calcPendingTotal(data.pending_on_time, data.pending_late);

  const diffRec = calcRec - data.received_total;
  const diffComp = calcComp - data.completed_total;
  const diffPend = calcPend - data.pending_total;

  if (diffRec !== 0) {
    const sign = diffRec > 0 ? `+${diffRec}` : `${diffRec}`;
    errors.push({
      field: 'received_total',
      message: `Lỗi công thức Tiếp nhận: Tổng tiếp nhận (${data.received_total}) != Trực tuyến (${data.received_online}) + Trực tiếp (${data.received_offline}) + Kỳ trước (${data.carried_forward}). Chênh lệch: ${sign} hồ sơ.`,
      type: 'error',
      details: { source: data.received_total, calculated: calcRec, diff: diffRec },
    });
  }

  if (diffComp !== 0) {
    const sign = diffComp > 0 ? `+${diffComp}` : `${diffComp}`;
    errors.push({
      field: 'completed_total',
      message: `Lỗi công thức Đã giải quyết: Tổng đã giải quyết (${data.completed_total}) != Trước hạn (${data.completed_early}) + Đúng hạn (${data.completed_on_time}) + Quá hạn (${data.completed_late}). Chênh lệch: ${sign} hồ sơ.`,
      type: 'error',
      details: { source: data.completed_total, calculated: calcComp, diff: diffComp },
    });
  }

  if (diffPend !== 0) {
    const sign = diffPend > 0 ? `+${diffPend}` : `${diffPend}`;
    errors.push({
      field: 'pending_total',
      message: `Lỗi công thức Đang giải quyết: Tổng đang giải quyết (${data.pending_total}) != Trong hạn (${data.pending_on_time}) + Quá hạn (${data.pending_late}). Chênh lệch: ${sign} hồ sơ.`,
      type: 'error',
      details: { source: data.pending_total, calculated: calcPend, diff: diffPend },
    });
  }

  // Check overall equation: Received = Completed + Pending
  const balance = calcBalance(data.received_total, data.completed_total, data.pending_total);
  if (balance !== 0) {
    const sign = balance > 0 ? `+${balance}` : `${balance}`;
    errors.push({
      field: 'balance',
      message: `Lỗi phương trình tổng thể: Tổng tiếp nhận (${data.received_total}) != Đã giải quyết (${data.completed_total}) + Đang giải quyết (${data.pending_total}). Chênh lệch: ${sign} hồ sơ.`,
      type: 'error',
      details: { balance, received: data.received_total, completed: data.completed_total, pending: data.pending_total },
    });
  }

  const hasError = errors.some((e) => e.type === 'error');
  const hasWarning = errors.some((e) => e.type === 'warning');

  return {
    isValid: !hasError,
    hasWarning,
    errors,
    recalculated: {
      received_total: calcRec,
      completed_total: calcComp,
      pending_total: calcPend,
      balance,
      source_diff_received: diffRec,
      source_diff_completed: diffComp,
      source_diff_pending: diffPend,
    },
  };
}

// Registry map for indicator formulas
export const FORMULA_REGISTRY: Record<string, Function> = {
  calcReceivedTotal,
  calcCompletedTotal,
  calcPendingTotal,
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcOnlineRate,
  calcPendingRate,
  calcChangeAbsolute,
  calcChangePercent,
};
