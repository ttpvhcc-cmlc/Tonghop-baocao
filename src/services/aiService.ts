import { Report, ReportFieldStatistic } from '../types/database';

export interface AIAnalysisRequest {
  reportName: string;
  period: string;
  promptScope: string;
  metricsSummary: {
    totals: {
      received: number;
      online: number;
      offline: number;
      carried: number;
      completed: number;
      onTime: number;
      late: number;
      pending: number;
      pendingOnTime: number;
      pendingLate: number;
      onTimeRate: number;
      onlineRate: number;
      completionRate: number;
    };
    unitBreakdown: Array<{
      unitName: string;
      received: number;
      completed: number;
      late: number;
      onTimeRate: number;
      pending: number;
    }>;
    notableWarnings: string[];
  };
}

export async function generateAIReportAnalysis(request: AIAnalysisRequest): Promise<{
  analysisText: string;
  generatedBy: 'gemini' | 'rule_engine';
}> {
  try {
    const res = await fetch('/api/gemini/generate-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.analysisText) {
        return {
          analysisText: data.analysisText,
          generatedBy: data.generatedBy || 'gemini',
        };
      }
    }
  } catch (err) {
    console.warn('Backend Gemini API call failed or not configured, using rule-based analysis fallback:', err);
  }

  // High-standard rule-based fallback analysis if server or key is unavailable
  const m = request.metricsSummary;
  const topUnit = [...m.unitBreakdown].sort((a, b) => b.received - a.received)[0];
  const highLateUnit = [...m.unitBreakdown].sort((a, b) => b.late - a.late)[0];

  const ruleBasedText = `I. ĐÁNH GIÁ KHÁI QUÁT KẾT QUẢ ĐẠT ĐƯỢC
- Trong kỳ báo cáo, toàn hệ thống đã tiếp nhận tổng số ${m.totals.received.toLocaleString('vi-VN')} hồ sơ TTHC (trong đó trực tuyến đạt ${m.totals.online.toLocaleString('vi-VN')} hồ sơ, chiếm tỷ lệ ${m.totals.onlineRate}%).
- Tổng số hồ sơ đã giải quyết xong là ${m.totals.completed.toLocaleString('vi-VN')} hồ sơ (đạt tỷ lệ giải quyết ${m.totals.completionRate}%).
- Tỷ lệ giải quyết đúng và trước hạn đạt mức cao: ${m.totals.onTimeRate}%, phản ánh nỗ lực chỉ đạo và tinh thần phục vụ người dân, doanh nghiệp của các đơn vị.

II. TỒN TẠI, HẠN CHẾ VÀ ĐIỂM NGHẼN
${highLateUnit && highLateUnit.late > 0
  ? `- Về hồ sơ quá hạn: Còn ${m.totals.late.toLocaleString('vi-VN')} hồ sơ bị trễ hạn, tập trung chủ yếu tại ${highLateUnit.unitName} (${highLateUnit.late} hồ sơ quá hạn).`
  : '- Toàn bộ hồ sơ trong kỳ cơ bản được giải quyết đúng tiến độ, không có tình trạng quá hạn nghiêm trọng kéo dài.'}
${m.notableWarnings.length > 0
  ? `- Cảnh báo chênh lệch dữ liệu nguồn: ${m.notableWarnings.join('; ')}.`
  : ''}
- Số hồ sơ đang giải quyết tồn đọng: ${m.totals.pending.toLocaleString('vi-VN')} hồ sơ (trong đó có ${m.totals.pendingLate.toLocaleString('vi-VN')} hồ sơ quá hạn đang xử lý).

III. ĐỀ XUẤT NHIỆM VỤ TRỌNG TÂM KỲ TỚI
1. Giao ${topUnit?.unitName || 'các đơn vị đầu mối'} tiếp tục duy trì đà giải quyết hồ sơ nhanh chóng, đồng thời tuyên truyền người dân sử dụng dịch vụ công trực tuyến.
2. Yêu cầu lãnh đạo các phòng chuyên môn có hồ sơ trễ hạn rà soát từng bước quy trình, làm rõ trách nhiệm công chức thụ lý và gửi văn bản xin lỗi người dân theo đúng quy định.
3. Tăng cường kiểm soát dữ liệu trên cả 2 hệ thống (Hệ thống các Bộ và Hệ thống thành phố) để đảm bảo tính đồng nhất tuyệt đối về số liệu thống kê.`;

  return {
    analysisText: ruleBasedText,
    generatedBy: 'rule_engine',
  };
}
