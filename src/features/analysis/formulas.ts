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

// 7b. Tỷ lệ quá hạn theo QĐ 776 (% Quá hạn tổng thể)
// Công thức: (Đã giải quyết quá hạn + Đang giải quyết quá hạn) / Tổng số hồ sơ đã tiếp nhận * 100
export function calcOverdueRateQD776(
  completedLate: number = 0,
  pendingLate: number = 0,
  receivedTotal: number = 0
): number {
  if (!receivedTotal || receivedTotal <= 0) return 0;
  const overdueSum = (Number(completedLate) || 0) + (Number(pendingLate) || 0);
  return Number(((overdueSum / Number(receivedTotal)) * 100).toFixed(2));
}

// 7c. Tỷ lệ giải quyết đúng hạn toàn hệ thống theo QĐ 766 (%)
// Công thức: [(Đã giải quyết sớm + Đã giải quyết đúng) + Đang giải quyết trong hạn] / Tổng số hồ sơ đã tiếp nhận * 100
export function calcOnTimeRateQD766(
  completedEarly: number = 0,
  completedOnTime: number = 0,
  pendingOnTime: number = 0,
  receivedTotal: number = 0
): number {
  if (!receivedTotal || receivedTotal <= 0) return 100;
  const onTimeSum = (Number(completedEarly) || 0) + (Number(completedOnTime) || 0) + (Number(pendingOnTime) || 0);
  return Number(((onTimeSum / Number(receivedTotal)) * 100).toFixed(2));
}

// Alias for convenience
export const calcOverallLateRate = calcOverdueRateQD776;

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

// 12. Tỷ lệ giải quyết trước hạn (%)
export function calcEarlyRate(
  completedEarly: number,
  completedTotal: number
): number {
  if (!completedTotal || completedTotal <= 0) return 0;
  return Number(((completedEarly / completedTotal) * 100).toFixed(2));
}

// 13. Tỷ lệ đang giải quyết quá hạn (%)
export function calcPendingLateRate(
  pendingLate: number,
  pendingTotal: number
): number {
  if (!pendingTotal || pendingTotal <= 0) return 0;
  return Number(((pendingLate / pendingTotal) * 100).toFixed(2));
}

// 14. Tỷ lệ hồ sơ tồn đọng từ kỳ trước (%)
export function calcCarriedForwardRate(
  carriedForward: number,
  receivedTotal: number
): number {
  if (!receivedTotal || receivedTotal <= 0) return 0;
  return Number(((carriedForward / receivedTotal) * 100).toFixed(2));
}

// 15. Tỷ lệ phát sinh mới trong kỳ (%)
export function calcNewReceivedRate(
  online: number,
  offline: number,
  receivedTotal: number
): number {
  if (!receivedTotal || receivedTotal <= 0) return 0;
  const newCount = (Number(online) || 0) + (Number(offline) || 0);
  return Number(((newCount / receivedTotal) * 100).toFixed(2));
}

// 16. Tỷ lệ số hóa kết quả giải quyết (%)
export function calcDigitizedRate(
  digitizedCount: number,
  completedTotal: number
): number {
  if (!completedTotal || completedTotal <= 0) return 0;
  return Number(((digitizedCount / completedTotal) * 100).toFixed(2));
}

// 17. Tỷ lệ hài lòng của người dân (%)
export function calcSatisfactionRate(
  satisfiedCount: number,
  totalReviews: number
): number {
  if (!totalReviews || totalReviews <= 0) return 100;
  return Number(((satisfiedCount / totalReviews) * 100).toFixed(2));
}

// --- TỪ ĐIỂN CÁC TRƯỜNG DỮ LIỆU ĐẦU VÀO ĐỂ THIẾT LẬP CÔNG THỨC ---
export interface DataFieldDefinition {
  key: string;
  name: string;
  group: 'received' | 'completed' | 'pending' | 'quality';
  groupName: string;
  desc: string;
  sampleValue: number;
}

export const DATA_FIELDS_DICTIONARY: DataFieldDefinition[] = [
  // Nhóm 1: Tiếp nhận
  {
    key: 'received_total',
    name: 'Tổng số hồ sơ tiếp nhận',
    group: 'received',
    groupName: 'Tiếp nhận hồ sơ',
    desc: 'Tổng toàn bộ hồ sơ tiếp nhận trong kỳ gồm tồn kỳ trước + trực tuyến + trực tiếp',
    sampleValue: 450,
  },
  {
    key: 'received_online',
    name: 'Tiếp nhận trực tuyến (DVC)',
    group: 'received',
    groupName: 'Tiếp nhận hồ sơ',
    desc: 'Số hồ sơ nộp qua Cổng dịch vụ công Quốc gia / Cổng DVC Tỉnh',
    sampleValue: 315,
  },
  {
    key: 'received_offline',
    name: 'Tiếp nhận trực tiếp / Bưu chính',
    group: 'received',
    groupName: 'Tiếp nhận hồ sơ',
    desc: 'Số hồ sơ công dân nộp trực tiếp tại Bộ phận Một cửa hoặc qua Bưu chính công ích',
    sampleValue: 105,
  },
  {
    key: 'carried_forward',
    name: 'Hồ sơ kỳ trước chuyển qua (Tồn đầu kỳ)',
    group: 'received',
    groupName: 'Tiếp nhận hồ sơ',
    desc: 'Lượng hồ sơ chưa giải quyết xong từ kỳ báo cáo trước chuyển sang kỳ này',
    sampleValue: 30,
  },

  // Nhóm 2: Đã giải quyết
  {
    key: 'completed_total',
    name: 'Tổng số hồ sơ đã giải quyết',
    group: 'completed',
    groupName: 'Kết quả giải quyết',
    desc: 'Tổng số hồ sơ đã hoàn thành trả kết quả cho công dân trong kỳ (Trước + Đúng + Quá hạn)',
    sampleValue: 390,
  },
  {
    key: 'completed_early',
    name: 'Đã giải quyết trước hạn',
    group: 'completed',
    groupName: 'Kết quả giải quyết',
    desc: 'Hồ sơ trả kết quả sớm hơn ngày hẹn trên phiếu tiếp nhận',
    sampleValue: 240,
  },
  {
    key: 'completed_on_time',
    name: 'Đã giải quyết đúng hạn',
    group: 'completed',
    groupName: 'Kết quả giải quyết',
    desc: 'Hồ sơ trả kết quả đúng ngày hẹn',
    sampleValue: 145,
  },
  {
    key: 'completed_late',
    name: 'Đã giải quyết quá hạn (Trễ hạn)',
    group: 'completed',
    groupName: 'Kết quả giải quyết',
    desc: 'Hồ sơ trả kết quả trễ hơn ngày hẹn (cần có văn bản xin lỗi)',
    sampleValue: 5,
  },

  // Nhóm 3: Đang giải quyết
  {
    key: 'pending_total',
    name: 'Tổng số hồ sơ đang giải quyết',
    group: 'pending',
    groupName: 'Hồ sơ đang xử lý',
    desc: 'Tổng số hồ sơ đang trong quy trình thụ lý tại cơ quan (Trong hạn + Quá hạn)',
    sampleValue: 60,
  },
  {
    key: 'pending_on_time',
    name: 'Đang giải quyết trong hạn',
    group: 'pending',
    groupName: 'Hồ sơ đang xử lý',
    desc: 'Hồ sơ đang xử lý và chưa tới ngày hẹn trả',
    sampleValue: 58,
  },
  {
    key: 'pending_late',
    name: 'Đang giải quyết quá hạn (Tồn quá hạn)',
    group: 'pending',
    groupName: 'Hồ sơ đang xử lý',
    desc: 'Hồ sơ đang xử lý nhưng đã quá ngày hẹn trả (cần đôn đốc khẩn cấp)',
    sampleValue: 2,
  },

  // Nhóm 4: Chất lượng & Dịch vụ công
  {
    key: 'digitized_count',
    name: 'Số hồ sơ số hóa kết quả',
    group: 'quality',
    groupName: 'Chất lượng & Số hóa',
    desc: 'Số hồ sơ được quét (scan) đính kèm kết quả giải quyết điện tử có ký số',
    sampleValue: 375,
  },
  {
    key: 'satisfied_count',
    name: 'Số lượt đánh giá Rất hài lòng / Hài lòng',
    group: 'quality',
    groupName: 'Chất lượng & Số hóa',
    desc: 'Số lượt người dân đánh giá mức độ phục vụ đạt yêu cầu trở lên',
    sampleValue: 280,
  },
  {
    key: 'total_reviews',
    name: 'Tổng số lượt đánh giá tiếp nhận',
    group: 'quality',
    groupName: 'Chất lượng & Số hóa',
    desc: 'Tổng số lượt người dân tham gia khảo sát đánh giá chất lượng',
    sampleValue: 285,
  },
];

// --- BỘ CÔNG THỨC MẪU CHUẨN ĐƯỢC MỞ RỘNG (12+ CHỈ TIÊU) ---
export interface IndicatorPreset {
  key: string;
  code: string;
  name: string;
  formula: string;
  expression: string;
  unit: string;
  desc: string;
  dataFields: string[];
}

export const INDICATOR_PRESETS: IndicatorPreset[] = [
  {
    key: 'calcOverdueRateQD776',
    code: 'OVERDUE_RATE_QD776',
    name: 'Tỷ lệ quá hạn (theo QĐ 776)',
    formula: '(([completed_late] + [pending_late]) / [received_total]) * 100',
    expression: '(([completed_late] + [pending_late]) / [received_total]) * 100',
    unit: '%',
    desc: 'Tỷ lệ quá hạn tổng thể (Đã giải quyết quá hạn + Đang giải quyết quá hạn)/Tổng số hồ sơ tiếp nhận theo Quyết định 776.',
    dataFields: ['completed_late', 'pending_late', 'received_total'],
  },
  {
    key: 'calcLateRate',
    code: 'LATE_RATE',
    name: 'Tỷ lệ quá hạn đã giải quyết',
    formula: '([completed_late] / [completed_total]) * 100',
    expression: '([completed_late] / [completed_total]) * 100',
    unit: '%',
    desc: 'Tỷ lệ quá hạn đối với hồ sơ đã giải quyết: Quá hạn đã giải quyết/Tổng số hồ sơ đã giải quyết.',
    dataFields: ['completed_late', 'completed_total'],
  },
  {
    key: 'calcPendingLateRate',
    code: 'PENDING_OVERDUE_RATE',
    name: 'Tỷ lệ quá hạn đang giải quyết',
    formula: '([pending_late] / [pending_total]) * 100',
    expression: '([pending_late] / [pending_total]) * 100',
    unit: '%',
    desc: 'Tỷ lệ quá hạn đối với hồ sơ đang giải quyết: Quá hạn đang giải quyết/Tổng số hồ sơ đang giải quyết.',
    dataFields: ['pending_late', 'pending_total'],
  },
  {
    key: 'calcCompletionRate',
    code: 'COMPLETION_RATE',
    name: 'Tỷ lệ giải quyết hồ sơ',
    formula: '([completed_total] / [received_total]) * 100',
    expression: '([completed_total] / [received_total]) * 100',
    unit: '%',
    desc: 'Đánh giá năng lực giải quyết hồ sơ tổng thể so với khối lượng tiếp nhận toàn kỳ.',
    dataFields: ['completed_total', 'received_total'],
  },
  {
    key: 'calcOnTimeRate',
    code: 'ON_TIME_RATE',
    name: 'Tỷ lệ đúng hạn và trước hạn',
    formula: '(([completed_early] + [completed_on_time]) / [completed_total]) * 100',
    expression: '(([completed_early] + [completed_on_time]) / [completed_total]) * 100',
    unit: '%',
    desc: 'Chỉ số đo lường mức độ hài lòng và chất lượng thực thi công vụ của cán bộ Một cửa.',
    dataFields: ['completed_early', 'completed_on_time', 'completed_total'],
  },
  {
    key: 'calcEarlyRate',
    code: 'EARLY_RATE',
    name: 'Tỷ lệ giải quyết trước hạn',
    formula: '([completed_early] / [completed_total]) * 100',
    expression: '([completed_early] / [completed_total]) * 100',
    unit: '%',
    desc: 'Tỷ lệ hồ sơ được xử lý nhanh, trả kết quả sớm hơn thời hạn quy định.',
    dataFields: ['completed_early', 'completed_total'],
  },
  {
    key: 'calcOnlineRate',
    code: 'ONLINE_RATE',
    name: 'Tỷ lệ nộp hồ sơ trực tuyến',
    formula: '([received_online] / ([received_online] + [received_offline])) * 100',
    expression: '([received_online] / ([received_online] + [received_offline])) * 100',
    unit: '%',
    desc: 'Đo lường mức độ số hóa của hồ sơ phát sinh mới trong kỳ, không tính số tồn từ kỳ trước.',
    dataFields: ['received_online', 'received_offline'],
  },
  {
    key: 'calcPendingRate',
    code: 'PENDING_ONTIME_RATE',
    name: 'Tỷ lệ trong hạn đang giải quyết',
    formula: '([pending_on_time] / [pending_total]) * 100',
    expression: '([pending_on_time] / [pending_total]) * 100',
    unit: '%',
    desc: 'Đo lường tính an toàn của lượng hồ sơ tồn đọng đang trong quy trình xử lý.',
    dataFields: ['pending_on_time', 'pending_total'],
  },
  {
    key: 'calcPendingLateRate',
    code: 'PENDING_OVERDUE_RATE',
    name: 'Tỷ lệ quá hạn đang giải quyết',
    formula: '([pending_late] / [pending_total]) * 100',
    expression: '([pending_late] / [pending_total]) * 100',
    unit: '%',
    desc: 'Tỷ lệ hồ sơ đang dở dang nhưng đã quá thời hạn cam kết, cần cảnh báo đôn đốc khẩn.',
    dataFields: ['pending_late', 'pending_total'],
  },
  {
    key: 'calcCarriedForwardRate',
    code: 'CARRIED_FORWARD_RATE',
    name: 'Tỷ lệ hồ sơ tồn đầu kỳ',
    formula: '([carried_forward] / [received_total]) * 100',
    expression: '([carried_forward] / [received_total]) * 100',
    unit: '%',
    desc: 'Tỷ trọng hồ sơ dồn từ các kỳ trước chuyển sang trong tổng khối lượng cần giải quyết.',
    dataFields: ['carried_forward', 'received_total'],
  },
  {
    key: 'calcNewReceivedRate',
    code: 'NEW_RECEIVED_RATE',
    name: 'Tỷ lệ hồ sơ mới phát sinh',
    formula: '(([received_online] + [received_offline]) / [received_total]) * 100',
    expression: '(([received_online] + [received_offline]) / [received_total]) * 100',
    unit: '%',
    desc: 'Tỷ lệ hồ sơ công dân mới nộp trực tiếp hoặc trực tuyến trong kỳ báo cáo.',
    dataFields: ['received_online', 'received_offline', 'received_total'],
  },
  {
    key: 'calcDigitizedRate',
    code: 'DIGITIZED_RATE',
    name: 'Tỷ lệ số hóa kết quả giải quyết TTHC',
    formula: '([digitized_count] / [completed_total]) * 100',
    expression: '([digitized_count] / [completed_total]) * 100',
    unit: '%',
    desc: 'Tỷ lệ hồ sơ đã được số hóa đính kèm bản quét kết quả có chữ ký số điện tử.',
    dataFields: ['digitized_count', 'completed_total'],
  },
  {
    key: 'calcSatisfactionRate',
    code: 'SATISFACTION_RATE',
    name: 'Tỷ lệ hài lòng của công dân',
    formula: '([satisfied_count] / [total_reviews]) * 100',
    expression: '([satisfied_count] / [total_reviews]) * 100',
    unit: '%',
    desc: 'Tỷ lệ người dân đánh giá dịch vụ đạt mức Hài lòng hoặc Rất hài lòng.',
    dataFields: ['satisfied_count', 'total_reviews'],
  },
  {
    key: 'calcBalanceIndicator',
    code: 'BALANCE_COUNT',
    name: 'Độ cân bằng số liệu (Tiếp nhận - (Đã GQ + Đang GQ))',
    formula: '[received_total] - ([completed_total] + [pending_total])',
    expression: '[received_total] - ([completed_total] + [pending_total])',
    unit: 'hồ sơ',
    desc: 'Kiểm tra cân đối dòng chảy hồ sơ, chuẩn mực là 0 hồ sơ chênh lệch.',
    dataFields: ['received_total', 'completed_total', 'pending_total'],
  },
];

// --- TRÌNH ĐÁNH GIÁ CÔNG THỨC TÙY CHỈNH AN TOÀN (SAFE PARSER & EVALUATOR) ---
// Không dùng eval() - Hỗ trợ các trường [key], toán tử +, -, *, /, %, số, dấu ngoặc ()
export function evaluateCustomFormula(
  expression: string,
  data: Record<string, number>
): { result: number; isValid: boolean; error?: string } {
  try {
    if (!expression || !expression.trim()) {
      return { result: 0, isValid: false, error: 'Công thức không được để trống' };
    }

    // 1. Thay thế các biến [field_key] bằng giá trị số
    let expr = expression.trim();
    const tokenRegex = /\[([a-zA-Z0-9_]+)\]/g;
    let match;
    const missingKeys: string[] = [];

    expr = expr.replace(tokenRegex, (_, key) => {
      const val = data[key];
      if (val === undefined || isNaN(val)) {
        missingKeys.push(key);
        return '0';
      }
      return String(Number(val) || 0);
    });

    if (missingKeys.length > 0) {
      // Not fatal in preview if missing, just defaulted to 0
    }

    // 2. Tokenize and parse safely using a recursive descent math parser
    const result = safeMathEvaluate(expr);
    if (isNaN(result) || !isFinite(result)) {
      return { result: 0, isValid: true };
    }

    return { result: Number(result.toFixed(2)), isValid: true };
  } catch (err: any) {
    return { result: 0, isValid: false, error: err.message || 'Lỗi cú pháp công thức' };
  }
}

/**
 * Safe math expression evaluator without eval()
 * Supports: +, -, *, /, %, (), decimals, unary minus
 */
function safeMathEvaluate(expr: string): number {
  // Clean spaces
  let tokens = expr.replace(/\s+/g, '');
  if (!tokens) return 0;

  // Validate only allowed characters: 0-9, ., +, -, *, /, %, (, )
  if (!/^[0-9.+\-*/%()]+$/.test(tokens)) {
    throw new Error('Công thức chứa ký tự không hợp lệ');
  }

  // Check balanced parentheses
  let parenCount = 0;
  for (const c of tokens) {
    if (c === '(') parenCount++;
    if (c === ')') parenCount--;
    if (parenCount < 0) throw new Error('Dấu ngoặc đóng ")" không hợp lệ');
  }
  if (parenCount !== 0) throw new Error('Số dấu ngoặc mở "(" và đóng ")" không cân bằng');

  let pos = 0;

  function peek(): string {
    return tokens[pos] || '';
  }

  function get(): string {
    return tokens[pos++] || '';
  }

  function parseExpression(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = get();
      const nextTerm = parseTerm();
      if (op === '+') result += nextTerm;
      else result -= nextTerm;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = get();
      const nextFactor = parseFactor();
      if (op === '*') {
        result *= nextFactor;
      } else if (op === '/') {
        if (nextFactor === 0) return 0; // Tránh lỗi chia cho 0
        result /= nextFactor;
      } else if (op === '%') {
        if (nextFactor === 0) return 0;
        result %= nextFactor;
      }
    }
    return result;
  }

  function parseFactor(): number {
    // Unary plus/minus
    if (peek() === '+') {
      get();
      return parseFactor();
    }
    if (peek() === '-') {
      get();
      return -parseFactor();
    }

    if (peek() === '(') {
      get(); // consume '('
      const val = parseExpression();
      if (get() !== ')') throw new Error('Thiếu dấu ngoặc đóng ")"');
      return val;
    }

    // Number
    let numStr = '';
    while (/[0-9.]/.test(peek())) {
      numStr += get();
    }

    if (!numStr) {
      throw new Error(`Ký tự bất ngờ tại vị trí ${pos}: "${peek()}"`);
    }

    const val = Number(numStr);
    if (isNaN(val)) throw new Error(`Số không hợp lệ: "${numStr}"`);
    return val;
  }

  const finalVal = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Dư ký tự cuối công thức tại vị trí ${pos}: "${tokens.slice(pos)}"`);
  }
  return finalVal;
}

// Registry map for indicator formulas
export const FORMULA_REGISTRY: Record<string, Function> = {
  calcReceivedTotal,
  calcCompletedTotal,
  calcPendingTotal,
  calcCompletionRate,
  calcOnTimeRate,
  calcLateRate,
  calcPendingLateRate,
  calcOverdueRateQD776,
  calcOverallLateRate,
  calcEarlyRate,
  calcOnlineRate,
  calcPendingRate,
  calcCarriedForwardRate,
  calcNewReceivedRate,
  calcDigitizedRate,
  calcSatisfactionRate,
  calcChangeAbsolute,
  calcChangePercent,
};

