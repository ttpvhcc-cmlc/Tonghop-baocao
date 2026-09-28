export type UrgeChannel = 'direct' | 'phone'; // 'Trực tiếp' | 'Điện thoại'
export type UrgeUrgency = 'normal' | 'urgent' | 'express'; // 'Bình thường' | 'Khẩn' | 'Hỏa tốc'
export type UrgeStatus = 'pending' | 'in_progress' | 'responded' | 'completed' | 'cancelled';

export interface DossierUrgeRecord {
  id: string;
  ticket_code?: string;       // Mã phiếu đôn đốc
  // Các trường thông tin bóc tách (Tuyệt đối không lưu số định danh)
  dossier_code: string;       // Mã hồ sơ
  citizen_name: string;       // Tên Công dân, tổ chức
  phone?: string;             // Điện thoại liên hệ
  address?: string;           // Địa chỉ
  procedure_name: string;     // Thủ tục
  received_date: string;      // Ngày nhận (YYYY-MM-DD)
  appointment_date: string;   // Ngày hẹn trả (YYYY-MM-DD)
  assigned_unit: string;      // Đơn vị chủ trì
  processor_name?: string;    // Người thụ lý (không bắt buộc)
  notes?: string;             // Ghi chú đôn đốc
  reception_time?: string;    // Thời gian tiếp nhận (dd/mm/yy hh:mm)
  proposal?: string;          // Nội dung Đề nghị

  // Chi tiết lượt đôn đốc
  channel: UrgeChannel;       // Hình thức: 'direct' (Trực tiếp) | 'phone' (Điện thoại)
  urge_count: number;         // Lượt đôn đốc thứ mấy (1, 2, 3...)
  original_content?: string;  // Không lưu vào DB theo yêu cầu mới
  urgency?: UrgeUrgency;      // Mức độ
  status: UrgeStatus;         // Trạng thái xử lý
  created_at: string;         // Thời gian tiếp nhận đôn đốc
  created_by_name: string;    // Cán bộ tiếp nhận
  created_by_id?: string;

  // Xử lý và phản hồi
  response_deadline?: string; // Hạn yêu cầu đơn vị phản hồi
  unit_feedback?: string;     // Ý kiến phản hồi / giải trình từ đơn vị và người thụ lý
  feedback_at?: string;       // Thời gian phản hồi
  resolution_notes?: string;  // Kết quả giải quyết cuối cùng
  resolved_at?: string;       // Thời điểm hoàn tất
}

export interface ExtractedUrgeInfo {
  dossier_code: string;
  citizen_name: string;
  phone?: string;
  address?: string;
  procedure_name: string;
  received_date: string;
  appointment_date: string;
  assigned_unit: string;
  processor_name?: string;
  channel?: UrgeChannel;
  urgency?: UrgeUrgency;
  // Cờ báo kiểm soát bảo vệ dữ liệu cá nhân
  redacted_id_detected?: boolean;
}

export interface UrgeFilterCriteria {
  searchQuery: string;
  timeRange: 'all' | 'today' | '7days' | 'this_month' | 'this_quarter' | 'custom';
  startDate?: string;
  endDate?: string;
  channel: 'all' | UrgeChannel;
  assignedUnit: string;
  processorName: string;
  urgeFrequency: 'all' | 'first_time' | 'multiple'; // Tất cả, Đôn đốc lần 1, Đôn đốc nhiều lần (>=2)
  status: 'all' | UrgeStatus;
  urgency?: 'all' | UrgeUrgency;
}

export interface UnitUrgeSummary {
  unitName: string;
  totalUrges: number;
  dossierCount: number;
  multipleUrgeCount: number; // Số hồ sơ bị đôn đốc >= 2 lần
  respondedCount: number;
  pendingCount: number;
  responseRate: number; // Tỷ lệ phản hồi (%)
}

export interface ProcessorUrgeSummary {
  processorName: string;
  unitName: string;
  totalUrges: number;
  dossierCount: number;
  multipleUrgeCount: number;
  pendingCount: number;
  respondedCount: number;
}

export interface UrgeKPIStats {
  totalUrges: number;
  uniqueDossiers: number;
  multipleUrgeDossiers: number; // Số hồ sơ bị đôn đốc nhiều lần (>= 2 lần)
  directCount: number;
  phoneCount: number;
  directPercent: number;
  phonePercent: number;
  pendingCount: number;
  inProgressCount: number;
  respondedCount: number;
  completedCount: number;
}
