import { Report, ReportFieldStatistic } from '../types/database';

export interface AIAnalysisRequest {
  reportName: string;
  period: string;
  promptScope: string;
  exemplarTemplate?: string;
  metricsSummary: {
    totals: {
      received: number;
      online: number;
      offline: number;
      carried: number;
      inPeriod?: number;
      completed: number;
      aheadOfTime?: number;
      onTime: number;
      late: number;
      pending: number;
      pendingOnTime: number;
      pendingLate: number;
      onTimeRate: number;
      lateRate?: number;
      pendingLateRate?: number;
      qd776OverdueRate?: number;
      onlineRate: number;
      completionRate: number;
      aheadRate?: number;
    };
    previousPeriodSummary?: {
      reportId?: string;
      reportName?: string;
      period?: string;
      received?: number;
      completed?: number;
      online?: number;
      late?: number;
      pending?: number;
      onTimeRate?: number;
      onlineRate?: number;
      completionRate?: number;
      deltaReceived?: number;
      deltaReceivedPercent?: number;
      deltaOnTimeRate?: number;
      deltaOnlineRate?: number;
      deltaLate?: number;
      deltaPending?: number;
      comparisonAssessment?: string;
    };
    urgeSummary?: {
      totalUrges: number;
      uniqueUrgedDossiers: number;
      multipleUrges: number; // >= 2 lần
      resolvedUrges: number;
      inProgressUrges: number;
      pendingUrges: number;
      urgeResolutionRate?: number;
      topUrgedUnits?: Array<{ unitName: string; count: number }>;
      topUrgedProcessors?: Array<{ processorName: string; count: number }>;
      notableUrgeHighlights?: string;
    };
    unitBreakdown: Array<{
      unitName: string;
      received: number;
      online?: number;
      offline?: number;
      completed: number;
      aheadOfTime?: number;
      onTime?: number;
      late: number;
      onTimeRate: number;
      onlineRate?: number;
      pending: number;
      pendingLate?: number;
    }>;
    fieldBreakdown?: Array<{
      fieldName: string;
      received: number;
      online?: number;
      completed: number;
      late: number;
      onTimeRate: number;
      onlineRate?: number;
    }>;
    notableWarnings: string[];
    customObservations?: string[];
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

  // High-standard rule-based fallback analysis following the 4-part exemplar template with comparison and urge metrics
  const m = request.metricsSummary;
  const t = m.totals;
  const prev = m.previousPeriodSummary;
  const urge = m.urgeSummary;
  const topUnit = [...(m.unitBreakdown || [])].sort((a, b) => b.received - a.received)[0];
  const highLateUnit = [...(m.unitBreakdown || [])].sort((a, b) => b.late - a.late)[0];
  const topField = [...(m.fieldBreakdown || [])].sort((a, b) => b.received - a.received)[0];

  // Build comparison paragraph
  let comparisonText = '';
  if (prev && prev.received !== undefined) {
    const recDeltaStr = (prev.deltaReceived || 0) >= 0 ? `tăng ${Math.abs(prev.deltaReceived || 0).toLocaleString('vi-VN')} hồ sơ` : `giảm ${Math.abs(prev.deltaReceived || 0).toLocaleString('vi-VN')} hồ sơ`;
    const recDeltaPctStr = prev.deltaReceivedPercent !== undefined ? ` (${prev.deltaReceivedPercent >= 0 ? '+' : ''}${prev.deltaReceivedPercent.toFixed(1)}%)` : '';
    const onlineDeltaStr = (prev.deltaOnlineRate || 0) >= 0 ? `tăng ${(prev.deltaOnlineRate || 0).toFixed(1)} điểm %` : `giảm ${Math.abs(prev.deltaOnlineRate || 0).toFixed(1)} điểm %`;
    const onTimeDeltaStr = (prev.deltaOnTimeRate || 0) >= 0 ? `tăng ${(prev.deltaOnTimeRate || 0).toFixed(1)} điểm %` : `giảm ${Math.abs(prev.deltaOnTimeRate || 0).toFixed(1)} điểm %`;
    const lateDeltaStr = (prev.deltaLate || 0) <= 0 ? `giảm ${Math.abs(prev.deltaLate || 0).toLocaleString('vi-VN')} hồ sơ (chuyển biến tích cực)` : `tăng ${(prev.deltaLate || 0).toLocaleString('vi-VN')} hồ sơ (cần chấn chỉnh)`;

    comparisonText = `\n- Đánh giá so với kỳ trước (${prev.period || prev.reportName || 'kỳ liền kề'}): Khối lượng tiếp nhận ${recDeltaStr}${recDeltaPctStr}; Tỷ lệ hồ sơ trực tuyến ${onlineDeltaStr}; Tỷ lệ giải quyết đúng hạn ${onTimeDeltaStr}; Số hồ sơ quá hạn ${lateDeltaStr}. Nhìn chung ${prev.comparisonAssessment || 'chất lượng phục vụ tiếp tục duy trì ổn định'}.`;
  }

  // Build urge analytics paragraph
  let urgeText = '';
  if (urge && urge.totalUrges !== undefined) {
    const topUrgedUnitStr = urge.topUrgedUnits && urge.topUrgedUnits.length > 0
      ? ` Đơn vị phát sinh nhiều lượt đôn đốc nhất là ${urge.topUrgedUnits[0].unitName} (${urge.topUrgedUnits[0].count} lượt).`
      : '';
    urgeText = `\n- Công tác đôn đốc và giám sát tiến độ giải quyết: Trong kỳ báo cáo, Bộ phận Tiếp nhận và Trả kết quả đã ghi nhận và phát hành ${urge.totalUrges.toLocaleString('vi-VN')} lượt đôn đốc đối với ${urge.uniqueUrgedDossiers.toLocaleString('vi-VN')} hồ sơ.${urge.multipleUrges > 0 ? ` Có ${urge.multipleUrges} hồ sơ bị đôn đốc nhiều lần (≥ 2 lần) cần chỉ đạo xử lý khẩn cấp.` : ' Không có hồ sơ nào bị đôn đốc từ 2 lần trở lên.'} Đã giải quyết hoàn tất ${urge.resolvedUrges} lượt đôn đốc (đạt ${(urge.urgeResolutionRate || 100).toFixed(1)}%), hiện còn ${urge.inProgressUrges + urge.pendingUrges} lượt đang được theo dõi xử lý.${topUrgedUnitStr}`;
  }

  const ruleBasedText = `I. ĐÁNH GIÁ TỔNG QUÁT TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT TTHC
- Khái quát tình hình tiếp nhận: Trong kỳ báo cáo (${request.period || 'kỳ này'}), toàn hệ thống đã tiếp nhận tổng số ${t.received.toLocaleString('vi-VN')} hồ sơ TTHC (bao gồm: trực tuyến ${t.online.toLocaleString('vi-VN')} hồ sơ, đạt tỷ lệ ${t.onlineRate}%; trực tiếp và bưu chính ${t.offline.toLocaleString('vi-VN')} hồ sơ; tồn đọng từ kỳ trước chuyển qua ${t.carried.toLocaleString('vi-VN')} hồ sơ).
- Kết quả giải quyết: Đã hoàn thành giải quyết ${t.completed.toLocaleString('vi-VN')} hồ sơ (đạt tỷ lệ giải quyết ${t.completionRate}%), trong đó giải quyết Trước hạn ${(t.aheadOfTime || 0).toLocaleString('vi-VN')} hồ sơ, Đúng hạn ${t.onTime.toLocaleString('vi-VN')} hồ sơ, Quá hạn ${t.late.toLocaleString('vi-VN')} hồ sơ.
- Đánh giá chất lượng phục vụ: Tỷ lệ giải quyết đúng và trước hạn toàn hệ thống đạt ${t.onTimeRate}%, phản ánh sự nỗ lực, trách nhiệm và tính chủ động của các cơ quan, đơn vị trong công tác phục vụ người dân, doanh nghiệp.
- Tình hình hồ sơ đang xử lý: Hiện có ${t.pending.toLocaleString('vi-VN')} hồ sơ đang trong quy trình giải quyết (trong đó trong hạn: ${t.pendingOnTime.toLocaleString('vi-VN')} hồ sơ; quá hạn đang xử lý: ${t.pendingLate.toLocaleString('vi-VN')} hồ sơ).${comparisonText}${urgeText}

II. KẾT QUẢ NỔI BẬT THEO CÁC ĐƠN VỊ VÀ LĨNH VỰC
- Về đơn vị giải quyết: ${topUnit ? `Đơn vị ${topUnit.unitName} có khối lượng tiếp nhận lớn nhất với ${topUnit.received.toLocaleString('vi-VN')} hồ sơ, tỷ lệ đúng hạn đạt ${topUnit.onTimeRate}%.` : 'Các đơn vị giải quyết hồ sơ nghiêm túc, đảm bảo tiến độ.'}
- Về lĩnh vực TTHC: ${topField ? `Lĩnh vực "${topField.fieldName}" chiếm tỷ trọng phát sinh hồ sơ cao nhất (${topField.received.toLocaleString('vi-VN')} hồ sơ, đạt tỷ lệ đúng hạn ${topField.onTimeRate}%).` : 'Các lĩnh vực TTHC được phân bổ và xử lý đồng đều.'}

III. TỒN TẠI, HẠN CHẾ, ĐIỂM NGHẼN VÀ NGUY CƠ CHẬM TRỄ
- Vấn đề hồ sơ trễ hạn và quá hạn: ${highLateUnit && highLateUnit.late > 0 ? `Toàn hệ thống còn ${t.late.toLocaleString('vi-VN')} hồ sơ quá hạn, chủ yếu phát sinh tại ${highLateUnit.unitName} (${highLateUnit.late} hồ sơ). Cần khẩn trương kiểm tra nguyên nhân và giải quyết dứt điểm.` : 'Toàn hệ thống không có hồ sơ giải quyết quá hạn, các quy trình được thực hiện đúng thời hạn quy định.'}
- Tỷ lệ dịch vụ công trực tuyến: Tỷ lệ nộp trực tuyến đạt ${t.onlineRate}%, cần tiếp tục đẩy mạnh tuyên truyền và hỗ trợ người dân thao tác trực tuyến toàn trình.
${urge && urge.multipleUrges > 0 ? `- Vấn đề đôn đốc hồ sơ chậm muộn: Phát hiện ${urge.multipleUrges} hồ sơ bị người dân/cán bộ đôn đốc từ 2 lần trở lên chưa hoàn tất, gây ảnh hưởng đến mức độ hài lòng.` : ''}
${m.notableWarnings && m.notableWarnings.length > 0 ? `- Cảnh báo chênh lệch và đối soát: ${m.notableWarnings.join('; ')}.` : ''}

IV. PHƯƠNG HƯỚNG, NHIỆM VỤ VÀ GIẢI PHÁP CHỈ ĐẠO TRỌNG TÂM KỲ TỚI
1. Tiếp tục duy trì và nâng cao tỷ lệ giải quyết hồ sơ đúng và trước hạn, phấn đấu đạt trên 98% trên tất cả các lĩnh vực.
2. Yêu cầu thủ trưởng các phòng ban, đơn vị có hồ sơ quá hạn và các hồ sơ có phát sinh đôn đốc nhiều lần khẩn trương rà soát từng bước quy trình, xác định rõ trách nhiệm cá nhân, chấn chỉnh ngay công tác thẩm định và thực hiện nghiêm túc việc gửi văn bản/thư xin lỗi người dân theo đúng quy định.
3. Đẩy mạnh công tác tuyên truyền, hỗ trợ người dân và doanh nghiệp nộp hồ sơ dịch vụ công trực tuyến toàn trình, tăng cường số hóa hồ sơ và tái sử dụng dữ liệu điện tử.
4. Tăng cường theo dõi sát sao bảng điều khiển Đôn đốc hồ sơ, bảo đảm 100% phiếu đôn đốc được các phòng ban chuyên môn tiếp nhận và xử lý dứt điểm trong vòng 24 giờ.
5. Thường xuyên kiểm tra, đối soát và chuẩn hóa danh mục Lĩnh vực TTHC giữa 2 hệ thống nguồn nhằm bảo đảm số liệu thống kê luôn chính xác, khách quan và minh bạch.`;

  return {
    analysisText: ruleBasedText,
    generatedBy: 'rule_engine',
  };
}
