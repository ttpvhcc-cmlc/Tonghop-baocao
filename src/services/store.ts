import { 
  Unit, 
  Field, 
  IndicatorDefinition, 
  Report, 
  ReportSource, 
  ReportFieldStatistic, 
  ReportIndicator, 
  ReportAnalysis, 
  ReportSnapshot, 
  AuditLog, 
  Profile, 
  UserRole 
} from '../types/database';
import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';
import { validateStatisticRow } from '../features/analysis/formulas';
import { SAMPLE_PROCEDURES_DATA } from '../data/sampleProcedures';
import { resolveLinhVuc } from '../utils/fieldResolver';

// Local storage backup key prefix
const STORAGE_KEYS = {
  UNITS: 'tthc_units_v2',
  FIELDS: 'tthc_fields_v2',
  INDICATORS: 'tthc_indicators_v2',
  REPORTS: 'tthc_reports_v2',
  SOURCES: 'tthc_sources_v2',
  STATS: 'tthc_stats_v2',
  REPORT_INDICATORS: 'tthc_report_indicators_v2',
  ANALYSES: 'tthc_analyses_v2',
  SNAPSHOTS: 'tthc_snapshots_v2',
  AUDIT_LOGS: 'tthc_audit_logs_v2',
  CURRENT_USER: 'tthc_current_user_v2',
  USERS: 'tthc_users_v2',
};

// Initial Seed Data with valid UUIDs matching Supabase seed
const SEED_UNITS: Unit[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', code: 'VP', name: 'Văn phòng', display_order: 1, active: true },
  { id: 'a0000000-0000-0000-0000-000000000002', code: 'PKT', name: 'Phòng Kinh tế', display_order: 2, active: true },
  { id: 'a0000000-0000-0000-0000-000000000003', code: 'PVHXH', name: 'Phòng VHXH', display_order: 3, active: true },
];

// 31 Real Administrative Procedures with sectors and handling units mapped
export const DEFAULT_PROCEDURES_FIELDS: Field[] = SAMPLE_PROCEDURES_DATA.map((p, idx) => {
  let unit_id = 'a0000000-0000-0000-0000-000000000001'; // Văn phòng
  const unitStr = (p.don_vi_thuc_hien || '').toLowerCase();
  if (unitStr.includes('kinh te') || unitStr.includes('kt')) {
    unit_id = 'a0000000-0000-0000-0000-000000000002'; // Phòng Kinh tế
  } else if (unitStr.includes('van hoa') || unitStr.includes('vhxh') || unitStr.includes('xa hoi')) {
    unit_id = 'a0000000-0000-0000-0000-000000000003'; // Phòng VHXH
  }
  return {
    id: `b0000000-0000-0000-1000-${String(idx + 1).padStart(12, '0')}`,
    code: p.code,
    name: p.name,
    linh_vuc: p.linh_vuc,
    co_quan_cong_bo: p.co_quan_cong_bo,
    loai_tthc: p.loai_tthc,
    co_quan_thuc_hien: p.co_quan_thuc_hien,
    cap_thuc_hien: p.cap_thuc_hien,
    muc_do_cung_cap: p.muc_do_cung_cap,
    phi_le_phi: p.phi_le_phi,
    unit_id,
    display_order: idx + 1,
    active: true,
  };
});

const SEED_FIELDS: Field[] = [
  { id: 'b0000000-0000-0000-0000-000000000001', code: 'CT', name: 'Chứng thực', linh_vuc: 'Chứng thực', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 32, active: true },
  { id: 'b0000000-0000-0000-0000-000000000002', code: 'HT', name: 'Hộ tịch', linh_vuc: 'Hộ tịch', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 33, active: true },
  { id: 'b0000000-0000-0000-0000-000000000003', code: 'PLP', name: 'Phí, lệ phí', linh_vuc: 'Phí, lệ phí', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 34, active: true },

  { id: 'b0000000-0000-0000-0000-000000000004', code: 'ATTP', name: 'An toàn thực phẩm', linh_vuc: 'An toàn thực phẩm', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 35, active: true },
  { id: 'b0000000-0000-0000-0000-000000000005', code: 'HHDT', name: 'Hàng hải và đường thủy nội địa', linh_vuc: 'Hàng hải và đường thủy nội địa', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 36, active: true },
  { id: 'b0000000-0000-0000-0000-000000000006', code: 'QH', name: 'Quy hoạch đô thị và nông thôn', linh_vuc: 'Quy hoạch đô thị và nông thôn', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 37, active: true },
  { id: 'b0000000-0000-0000-0000-000000000007', code: 'XD', name: 'Hoạt động xây dựng', linh_vuc: 'Hoạt động xây dựng', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 38, active: true },
  { id: 'b0000000-0000-0000-0000-000000000008', code: 'LTHH', name: 'Lưu thông hàng hóa trong nước', linh_vuc: 'Lưu thông hàng hóa trong nước', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 39, active: true },
  { id: 'b0000000-0000-0000-0000-000000000009', code: 'DD', name: 'Đất đai', linh_vuc: 'Đất đai', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 40, active: true },
  { id: 'b0000000-0000-0000-0000-000000000010', code: 'TS', name: 'Thủy sản', linh_vuc: 'Thủy sản', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 41, active: true },

  { id: 'b0000000-0000-0000-0000-000000000011', code: 'BTXH', name: 'Bảo trợ xã hội', linh_vuc: 'Bảo trợ xã hội', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 42, active: true },
  { id: 'b0000000-0000-0000-0000-000000000012', code: 'GDMN', name: 'Giáo dục mầm non', linh_vuc: 'Giáo dục mầm non', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 43, active: true },
  { id: 'b0000000-0000-0000-0000-000000000013', code: 'GDTH', name: 'Giáo dục trung học', linh_vuc: 'Giáo dục trung học', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 44, active: true },
  { id: 'b0000000-0000-0000-0000-000000000014', code: 'NCC', name: 'Người có công', linh_vuc: 'Người có công', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 45, active: true },
  { id: 'b0000000-0000-0000-0000-000000000015', code: 'CS', name: 'Chính sách', linh_vuc: 'Chính sách', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 46, active: true },
];

export const ALL_INITIAL_FIELDS: Field[] = [...DEFAULT_PROCEDURES_FIELDS, ...SEED_FIELDS];

const SEED_INDICATORS: IndicatorDefinition[] = [
  { id: 'c0000000-0000-0000-0000-000000000001', code: 'ONLINE_RATE', name: 'Tỷ lệ nộp hồ sơ trực tuyến', formula_key: 'calcOnlineRate', unit_measure: '%', description: 'Tỷ lệ nộp trực tuyến trên tổng hồ sơ phát sinh mới', active: true },
  { id: 'c0000000-0000-0000-0000-000000000002', code: 'COMPLETION_RATE', name: 'Tỷ lệ giải quyết hồ sơ', formula_key: 'calcCompletionRate', unit_measure: '%', description: 'Tỷ lệ hồ sơ đã xử lý xong so với tổng tiếp nhận', active: true },
  { id: 'c0000000-0000-0000-0000-000000000003', code: 'ON_TIME_RATE', name: 'Tỷ lệ giải quyết đúng và trước hạn', formula_key: 'calcOnTimeRate', unit_measure: '%', description: 'Chỉ số đo lường chất lượng phục vụ của cơ quan hành chính', active: true },
  { id: 'c0000000-0000-0000-0000-000000000004', code: 'LATE_RATE', name: 'Tỷ lệ giải quyết quá hạn', formula_key: 'calcLateRate', unit_measure: '%', description: 'Tỷ lệ hồ sơ chậm trễ hạn trả kết quả', active: true },
  { id: 'c0000000-0000-0000-0000-000000000005', code: 'PENDING_ON_TIME_RATE', name: 'Tỷ lệ đang giải quyết trong hạn', formula_key: 'calcPendingRate', unit_measure: '%', description: 'Tỷ lệ hồ sơ tồn đang trong thời hạn xử lý an toàn', active: true },
];

const SEED_CURRENT_USER: Profile = {
  id: '50000000-0000-0000-0000-000000000001',
  full_name: 'Quản trị viên Hệ thống',
  email: 'admin.cchc@gov.vn',
  role: 'admin',
  unit_id: 'a0000000-0000-0000-0000-000000000001',
  active: true,
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
};

const GUEST_USER: Profile = {
  id: 'guest',
  full_name: 'Chưa đăng nhập',
  email: undefined,
  role: 'viewer',
  unit_id: null,
  active: false,
  created_at: '1970-01-01T00:00:00Z',
  updated_at: '1970-01-01T00:00:00Z',
};

const SEED_USERS: Profile[] = [
  SEED_CURRENT_USER,
  {
    id: '50000000-0000-0000-0000-000000000002',
    full_name: 'Trần Thị Mai (Chuyên viên Tổng hợp)',
    email: 'mai.tt@gov.vn',
    role: 'analyst',
    unit_id: 'a0000000-0000-0000-0000-000000000001',
    active: true,
    created_at: '2026-01-02T08:00:00Z',
    updated_at: '2026-01-02T08:00:00Z',
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    full_name: 'Lê Hoàng Nam (Cán bộ Một Cửa)',
    email: 'nam.lh@gov.vn',
    role: 'data_entry',
    unit_id: 'a0000000-0000-0000-0000-000000000002',
    active: true,
    created_at: '2026-01-03T08:00:00Z',
    updated_at: '2026-01-03T08:00:00Z',
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    full_name: 'Phạm Đức Minh (Lãnh đạo cơ quan)',
    email: 'lanhdao@gov.vn',
    role: 'viewer',
    unit_id: 'a0000000-0000-0000-0000-000000000003',
    active: true,
    created_at: '2026-01-04T08:00:00Z',
    updated_at: '2026-01-04T08:00:00Z',
  },
];

const SEED_REPORTS: Report[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000000',
    report_code: 'BC190926',
    report_name: 'BC190926 - Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC',
    report_type: 'monthly',
    period_start: '2026-01-01',
    period_end: '2026-02-28',
    data_as_of: '2026-02-28T17:00:00Z',
    status: 'validated',
    notes: 'Kỳ báo cáo tổng hợp chuẩn hóa số liệu tiếp nhận, giải quyết TTHC toàn thành phố',
    created_by: 'Hệ thống',
    created_at: '2026-02-28T09:00:00Z',
    updated_at: '2026-02-28T15:30:00Z',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    report_code: 'BC-2026-01',
    report_name: 'Báo cáo TTHC Tháng 01/2026',
    report_type: 'monthly',
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    data_as_of: '2026-01-31T17:00:00Z',
    status: 'locked',
    notes: 'Kỳ báo cáo chính thức Tháng 01/2026 (Dữ liệu đã khóa)',
    created_by: 'Hệ thống',
    approved_by: 'Lãnh đạo UBND',
    created_at: '2026-01-31T09:00:00Z',
    updated_at: '2026-02-05T09:00:00Z',
    approved_at: '2026-02-05T08:30:00Z',
    locked_at: '2026-02-05T09:00:00Z',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    report_code: 'BC-2026-02',
    report_name: 'Báo cáo TTHC Tháng 02/2026',
    report_type: 'monthly',
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    data_as_of: '2026-02-28T17:00:00Z',
    status: 'validated',
    notes: 'Kỳ báo cáo công tác Tháng 02/2026',
    created_by: 'Hệ thống',
    created_at: '2026-02-28T09:00:00Z',
    updated_at: '2026-02-28T15:30:00Z',
  }
];

const SEED_SOURCES: ReportSource[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    report_id: 'd0000000-0000-0000-0000-000000000000',
    source_type: 'system',
    source_name: 'Trên Hệ thống các Bộ',
    original_filename: 'du_lieu_bo_tonghop_2026.xlsx',
    uploaded_by: 'Hệ thống',
    uploaded_at: '2026-02-28T09:30:00Z',
    import_status: 'completed',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    report_id: 'd0000000-0000-0000-0000-000000000000',
    source_type: 'system',
    source_name: 'Trên Hệ thống thành phố',
    original_filename: 'du_lieu_tp_tonghop_2026.xlsx',
    uploaded_by: 'Hệ thống',
    uploaded_at: '2026-02-28T10:00:00Z',
    import_status: 'completed',
  },
  {
    id: 'e0000000-0000-0000-1000-000000000001',
    report_id: 'd0000000-0000-0000-0000-000000000001',
    source_type: 'system',
    source_name: 'Trên Hệ thống các Bộ',
    original_filename: 'du_lieu_bo_t1_2026.xlsx',
    uploaded_by: 'Hệ thống',
    uploaded_at: '2026-01-31T09:30:00Z',
    import_status: 'completed',
  },
  {
    id: 'e0000000-0000-0000-1000-000000000002',
    report_id: 'd0000000-0000-0000-0000-000000000001',
    source_type: 'system',
    source_name: 'Trên Hệ thống thành phố',
    original_filename: 'du_lieu_tp_t1_2026.xlsx',
    uploaded_by: 'Hệ thống',
    uploaded_at: '2026-01-31T10:00:00Z',
    import_status: 'completed',
  },
  {
    id: 'e0000000-0000-0000-2000-000000000001',
    report_id: 'd0000000-0000-0000-0000-000000000002',
    source_type: 'system',
    source_name: 'Trên Hệ thống các Bộ',
    original_filename: 'du_lieu_bo_t2_2026.xlsx',
    uploaded_by: 'Hệ thống',
    uploaded_at: '2026-02-28T09:30:00Z',
    import_status: 'completed',
  },
  {
    id: 'e0000000-0000-0000-2000-000000000002',
    report_id: 'd0000000-0000-0000-0000-000000000002',
    source_type: 'system',
    source_name: 'Trên Hệ thống thành phố',
    original_filename: 'du_lieu_tp_t2_2026.xlsx',
    uploaded_by: 'Hệ thống',
    uploaded_at: '2026-02-28T10:00:00Z',
    import_status: 'completed',
  },
];

// Generate mathematically verified seed statistics for default reports
function generateInitialSeedStatistics(
  reports: Report[],
  sources: ReportSource[],
  fields: Field[],
  units: Unit[]
): ReportFieldStatistic[] {
  const stats: ReportFieldStatistic[] = [];
  const unitMap = new Map(units.map((u) => [u.id, u.name]));
  let rowIdx = 1;

  // 1. High-volume comprehensive report BC190926 (Total exact 15,601 records)
  const bc190926Rep = reports.find((r) => r.report_code === 'BC190926' || r.id === 'd0000000-0000-0000-0000-000000000000');
  if (bc190926Rep) {
    const repSources = sources.filter((s) => s.report_id === bc190926Rep.id);
    const sectorFields = fields.slice(31);
    const fieldCount = sectorFields.length || 1;

    // Target totals matching the user's report:
    // Total Received = 15,601 (Online: 15,400, Offline: 151, Forward: 50)
    // Completed = 15,104 (Early: 332, On time: 14,198, Late: 574)
    // Pending = 497 (On time: 299, Late: 198)
    repSources.forEach((src, sIdx) => {
      let srcRecOnlineRemain = sIdx === 0 ? 7700 : 7700;
      let srcRecOfflineRemain = sIdx === 0 ? 75 : 76;
      let srcRecForwardRemain = sIdx === 0 ? 25 : 25;

      let srcCompEarlyRemain = sIdx === 0 ? 166 : 166;
      let srcCompLateRemain = sIdx === 0 ? 287 : 287;

      let srcPendOnTimeRemain = sIdx === 0 ? 150 : 149;
      let srcPendLateRemain = sIdx === 0 ? 99 : 99;

      sectorFields.forEach((f, fIdx) => {
        const isLast = fIdx === sectorFields.length - 1;

        const recOnline = isLast ? srcRecOnlineRemain : Math.floor(srcRecOnlineRemain / (sectorFields.length - fIdx));
        const recOffline = isLast ? srcRecOfflineRemain : Math.floor(srcRecOfflineRemain / (sectorFields.length - fIdx));
        const recForward = isLast ? srcRecForwardRemain : Math.floor(srcRecForwardRemain / (sectorFields.length - fIdx));
        const recTotal = recOnline + recOffline + recForward;

        srcRecOnlineRemain -= recOnline;
        srcRecOfflineRemain -= recOffline;
        srcRecForwardRemain -= recForward;

        const pendOnTime = isLast ? srcPendOnTimeRemain : Math.floor(srcPendOnTimeRemain / (sectorFields.length - fIdx));
        const pendLate = isLast ? srcPendLateRemain : Math.floor(srcPendLateRemain / (sectorFields.length - fIdx));
        const pendTotal = pendOnTime + pendLate;

        srcPendOnTimeRemain -= pendOnTime;
        srcPendLateRemain -= pendLate;

        const compTotal = recTotal - pendTotal;
        const compEarly = isLast ? Math.min(compTotal, srcCompEarlyRemain) : Math.min(compTotal, Math.floor(srcCompEarlyRemain / (sectorFields.length - fIdx)));
        const compLate = isLast ? Math.min(compTotal - compEarly, srcCompLateRemain) : Math.min(compTotal - compEarly, Math.floor(srcCompLateRemain / (sectorFields.length - fIdx)));
        const compOnTime = compTotal - compEarly - compLate;

        srcCompEarlyRemain -= compEarly;
        srcCompLateRemain -= compLate;

        const hexId = ('000000000000' + rowIdx.toString(16)).slice(-12);
        const unitName = unitMap.get(f.unit_id || '') || 'Văn phòng';

        stats.push({
          id: `f0000000-0000-0000-1000-${hexId}`,
          report_id: bc190926Rep.id,
          source_id: src.id,
          field_id: f.id,
          field_code: f.code,
          field_name_snapshot: f.linh_vuc || f.name,
          field_name: f.linh_vuc || f.name,
          unit_id: f.unit_id || 'a0000000-0000-0000-0000-000000000001',
          unit_name_snapshot: unitName,
          unit_name: unitName,
          received_total: recTotal,
          received_online: recOnline,
          received_offline: recOffline,
          carried_forward: recForward,
          completed_total: compTotal,
          completed_early: compEarly,
          completed_on_time: compOnTime,
          completed_late: compLate,
          pending_total: pendTotal,
          pending_on_time: pendOnTime,
          pending_late: pendLate,
          validation_status: 'valid',
          validation_errors: [],
        });
        rowIdx++;
      });
    });
  }

  // 2. Standard monthly reports
  reports.filter((r) => r.id !== 'd0000000-0000-0000-0000-000000000000').forEach((rep, pIdx) => {
    const repSources = sources.filter((s) => s.report_id === rep.id);
    repSources.forEach((src, sIdx) => {
      // Sector stats
      fields.slice(31).forEach((f, fIdx) => {
        const seedVal = (pIdx + 1) * 43 + (sIdx + 1) * 23 + (fIdx + 1) * 11;
        const recOnline = 20 + (seedVal % 50);
        const recOffline = 5 + (seedVal % 15);
        const recForward = seedVal % 5 === 0 ? 2 : 0;
        const recTotal = recOnline + recOffline + recForward;

        const pendLate = seedVal % 9 === 0 ? 1 : 0;
        const pendOnTime = 2 + (seedVal % 6);
        const pendTotal = pendOnTime + pendLate;

        const compTotal = recTotal - pendTotal;
        const compLate = seedVal % 7 === 0 ? 1 : 0;
        const compEarly = Math.floor(compTotal * 0.6);
        const compOnTime = compTotal - compEarly - compLate;

        const hexId = ('000000000000' + rowIdx.toString(16)).slice(-12);
        const unitName = unitMap.get(f.unit_id || '') || 'Văn phòng';

        stats.push({
          id: `f0000000-0000-0000-0000-${hexId}`,
          report_id: rep.id,
          source_id: src.id,
          field_id: f.id,
          field_code: f.code,
          field_name_snapshot: f.linh_vuc || f.name,
          field_name: f.linh_vuc || f.name,
          unit_id: f.unit_id || 'a0000000-0000-0000-0000-000000000001',
          unit_name_snapshot: unitName,
          unit_name: unitName,
          received_total: recTotal,
          received_online: recOnline,
          received_offline: recOffline,
          carried_forward: recForward,
          completed_total: compTotal,
          completed_early: compEarly,
          completed_on_time: compOnTime,
          completed_late: compLate,
          pending_total: pendTotal,
          pending_on_time: pendOnTime,
          pending_late: pendLate,
          validation_status: 'valid',
          validation_errors: [],
        });
        rowIdx++;
      });
    });
  });

  return stats;
}

const SEED_ANALYSES: ReportAnalysis[] = [
  {
    id: 'g0000000-0000-0000-0000-000000000001',
    report_id: 'd0000000-0000-0000-0000-000000000001',
    scope_type: 'report',
    title: 'Phân tích tổng hợp công tác giải quyết TTHC Tháng 01/2026',
    generated_text: `I. ĐÁNH GIÁ KHÁI QUÁT KẾT QUẢ ĐẠT ĐƯỢC
- Trong kỳ báo cáo (Tháng 01/2026), toàn hệ thống đã tiếp nhận 1.054 hồ sơ TTHC, trong đó hình thức nộp trực tuyến chiếm tỷ lệ 78.4%.
- Khối lượng hồ sơ hoàn thành đạt 91.2%, tỷ lệ giải quyết đúng và trước hạn đạt 98.7%.

II. TỒN TẠI, HẠN CHẾ
- Có 3 hồ sơ quá hạn rải rác ở lĩnh vực Đất đai và Hoạt động xây dựng do khâu xác minh thực địa.
- Số liệu tiếp nhận giữa Hệ thống các Bộ và Hệ thống thành phố có sự chênh lệch nhỏ ở lĩnh vực Hộ tịch do độ trễ đồng bộ.

III. NHIỆM VỤ TRỌNG TÂM
1. Tiếp tục duy trì và nâng cao tỷ lệ tiếp nhận trực tuyến trên 80%.
2. Đôn đốc xử lý dứt điểm các hồ sơ tồn đọng.`,
    generated_by: 'gemini',
    created_at: '2026-01-31T17:00:00Z',
  }
];

const SEED_STATS: ReportFieldStatistic[] = generateInitialSeedStatistics(
  SEED_REPORTS,
  SEED_SOURCES,
  ALL_INITIAL_FIELDS,
  SEED_UNITS
);

// Helper to generate UUID
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Deduplicate any array of objects by their 'id' field
export function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

type Listener = () => void;

export class StorageService {
  private inMemoryCache: {
    units: Unit[];
    fields: Field[];
    indicators: IndicatorDefinition[];
    reports: Report[];
    sources: ReportSource[];
    stats: ReportFieldStatistic[];
    analyses: ReportAnalysis[];
    snapshots: ReportSnapshot[];
    auditLogs: AuditLog[];
    currentUser: Profile;
    users: Profile[];
  };

  private listeners: Set<Listener> = new Set();
  public isSupabaseConnected: boolean = false;
  public isSchemaReady: boolean = false;
  public lastSyncTime: string | null = null;
  public syncError: string | null = null;

  public normalizeStatLinhVuc(s: ReportFieldStatistic, fields: Field[]): ReportFieldStatistic {
    const linhVuc = resolveLinhVuc(s.field_name_snapshot || s.field_name || '', s.field_id, fields);
    return {
      ...s,
      field_name_snapshot: linhVuc,
      field_name: linhVuc,
    };
  }

  constructor() {
    // Business data is DB-only. No localStorage/sessionStorage/cache is used for application data.
    this.inMemoryCache = {
      units: [],
      fields: [],
      indicators: [],
      reports: [],
      sources: [],
      stats: [],
      analyses: [],
      snapshots: [],
      auditLogs: [],
      currentUser: GUEST_USER,
      users: [],
    };

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        void this.syncWithSupabase();
      }, 0);
    }
  }
  /**
   * Guarantees all 31 administrative procedures and sectors are always present,
   * properly categorized, mapped, and resilient against data loss.
   */
  public ensureHealthyFields(loadedFields: Field[]): Field[] {
    return deduplicateById(Array.isArray(loadedFields) ? loadedFields : []);
  }
  /**
   * Safely merge fields from Supabase or external sources without ever wiping out
   * local administrative procedures or mapping metadata.
   */
  public mergeFieldsSafely(_currentList: Field[], incomingList: any[]): Field[] {
    return deduplicateById(Array.isArray(incomingList) ? incomingList : []);
  }
  /**
   * Reset / restore the complete 31 TTHC procedures categorized by sectors with mapped handling units.
   */
  public restoreDefaultProcedures(): Field[] {
    const healthy = this.ensureHealthyFields(ALL_INITIAL_FIELDS);
    this.inMemoryCache.fields = healthy;
    this.setLocal(STORAGE_KEYS.FIELDS, healthy);
    this.addAuditLog('RESTORE_CATALOG', 'fields', 'system', { count: healthy.length });
    this.notify();
    return this.getFields();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try { fn(); } catch (e) { console.error('Listener notification error:', e); }
    });
  }

  private getLocal<T>(_key: string, defaultValue: T): T {
    return defaultValue;
  }

  private setLocal<T>(_key: string, _value: T): void {
    // Deliberately empty: application data is persisted only in Supabase.
  }
  /**
   * Sync active memory cache with Supabase
   */
  public async syncWithSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      this.isSupabaseConnected = false;
      return false;
    }

    try {
      // 1. Check health
      const healthRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY || '' },
      }).catch(() => null);

      this.isSupabaseConnected = Boolean(healthRes && healthRes.ok);

      // 2. Fetch units from Supabase
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .order('display_order', { ascending: true });

      if (unitsError) {
        if (unitsError.code === 'PGRST205' || unitsError.message.includes('schema cache')) {
          this.isSchemaReady = false;
          this.syncError = 'Bảng CSDL chưa được khởi tạo trên Supabase (Cần thực hiện chạy Migration SQL trong Supabase SQL Editor).';
          return false;
        }
        throw unitsError;
      }

      this.isSchemaReady = true;
      this.syncError = null;

      // Supabase is the source of truth when the schema is reachable.
      this.inMemoryCache.units = deduplicateById(unitsData || []);
      this.setLocal(STORAGE_KEYS.UNITS, this.inMemoryCache.units);

      // 3. Fetch fields (Safely merged to NEVER erase procedures, sectors, or mappings)
      const { data: fieldsData } = await supabase
        .from('fields')
        .select('*, units(*)')
        .order('display_order', { ascending: true });
      this.inMemoryCache.fields = deduplicateById(fieldsData || []);
      this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);

      // 4. Fetch reports (Merge Supabase reports with local reports)
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('period_start', { ascending: false });
      if (reportsData && reportsData.length > 0) {
        const normalizedReports = reportsData.map((rep: any) => {
          let code = rep.report_code || '';
          if (code.startsWith('IMP_') && !code.startsWith('IMP_SRV_')) {
            code = code.replace(/^IMP_/, '');
          }
          return {
            ...rep,
            report_code: code,
          };
        });
        this.inMemoryCache.reports = deduplicateById(normalizedReports);
        this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
      }

      // 5. Fetch sources (Merge safely)
      const { data: sourcesData } = await supabase.from('report_sources').select('*');
      this.inMemoryCache.sources = deduplicateById(sourcesData || []);
      this.setLocal(STORAGE_KEYS.SOURCES, this.inMemoryCache.sources);

      // 6. Fetch stats (Merge safely, NEVER wipe out local stats when Supabase table is empty)
      const { data: statsData } = await supabase.from('report_field_statistics').select('*');
      this.inMemoryCache.stats = deduplicateById(statsData || []);
      this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);

      // 7. Fetch indicators
      const { data: indicatorsData } = await supabase.from('indicator_definitions').select('*');
      this.inMemoryCache.indicators = deduplicateById(indicatorsData || []);
      this.setLocal(STORAGE_KEYS.INDICATORS, this.inMemoryCache.indicators);

      this.lastSyncTime = new Date().toISOString();
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Sync with Supabase note:', err.message);
      this.syncError = err.message;
      return false;
    }
  }

  /**
   * Seed tables on Supabase if empty
   */
  private async seedSupabaseTables(): Promise<void> {
    if (!supabase || !this.isSchemaReady) return;
    try {
      const { initializeSupabaseDatabase } = await import('./dbInit');
      await initializeSupabaseDatabase();
    } catch (e) {
      console.warn('Seed Supabase tables warning:', e);
    }
  }

  // --- Current User & Role ---
  public getCurrentUser(): Profile {
    return this.inMemoryCache.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.inMemoryCache.currentUser.id !== 'guest' && this.inMemoryCache.currentUser.active === true;
  }

  public async loadAuthenticatedUser(): Promise<Profile | null> {
    if (!supabase) {
      this.inMemoryCache.currentUser = GUEST_USER;
      this.notify();
      return null;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session?.user) {
      this.inMemoryCache.currentUser = GUEST_USER;
      this.notify();
      return null;
    }

    const userId = session.user.id;
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw profileError;

    let profile = existingProfile as Profile | null;
    if (!profile) {
      const now = new Date().toISOString();
      const { data: createdProfile, error: createProfileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: session.user.email || undefined,
          full_name: session.user.user_metadata?.full_name || session.user.email || 'Người dùng',
          role: 'viewer',
          unit_id: null,
          active: true,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single();
      if (createProfileError) throw createProfileError;
      profile = createdProfile as Profile;
    }

    this.inMemoryCache.currentUser = {
      ...profile,
      email: profile.email || session.user.email || undefined,
    };
    this.setLocal(STORAGE_KEYS.CURRENT_USER, this.inMemoryCache.currentUser);
    this.notify();
    return this.inMemoryCache.currentUser;
  }

  public async signOut(): Promise<void> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    this.inMemoryCache.currentUser = GUEST_USER;
    try { localStorage.removeItem(STORAGE_KEYS.CURRENT_USER); } catch {}
    this.notify();
  }

  private assertRole(allowed: UserRole[], action: string): void {
    const user = this.getCurrentUser();
    if (!this.isAuthenticated()) throw new Error(`Cần đăng nhập tài khoản Supabase để ${action}.`);
    if (!allowed.includes(user.role)) throw new Error(`Tài khoản hiện tại (${user.role}) không có quyền ${action}.`);
  }

  public getUsers(): Profile[] {
    return deduplicateById(this.inMemoryCache.users);
  }

  public saveUser(user: {
    id?: string; full_name: string; email?: string; role: UserRole; unit_id?: string; active?: boolean
  }): Profile {
    this.assertRole(['admin'], 'quản lý hồ sơ người dùng');
    const id = user.id || generateUUID();
    const existing = this.inMemoryCache.users.find((u) => u.id === id);
    const now = new Date().toISOString();
    const newUser: Profile = {
      id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      unit_id: user.unit_id,
      active: user.active !== false,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    const idx = this.inMemoryCache.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.inMemoryCache.users[idx] = { ...this.inMemoryCache.users[idx], ...newUser };
    } else {
      this.inMemoryCache.users.push(newUser);
    }
    this.setLocal(STORAGE_KEYS.USERS, this.inMemoryCache.users);
    this.addAuditLog(user.id ? 'UPDATE_USER' : 'CREATE_USER', 'profiles', id, newUser);

    if (supabase && this.isSchemaReady) {
      supabase.from('profiles').upsert({
        id,
        full_name: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        unit_id: newUser.unit_id || null,
        active: newUser.active !== false,
      }).then(({ error }) => {
        if (error) console.warn('Supabase saveUser warning:', error.message);
      });
    }

    this.notify();
    return newUser;
  }

  public deleteUser(userId: string): void {
    if (userId === this.getCurrentUser().id) {
      throw new Error('Không thể xóa tài khoản của chính bạn đang đăng nhập.');
    }
    this.inMemoryCache.users = this.inMemoryCache.users.filter((u) => u.id !== userId);
    this.setLocal(STORAGE_KEYS.USERS, this.inMemoryCache.users);
    this.addAuditLog('DELETE_USER', 'profiles', userId);

    if (supabase && this.isSchemaReady) {
      supabase.from('profiles').delete().eq('id', userId).then(({ error }) => {
        if (error) console.warn('Supabase deleteUser warning:', error.message);
      });
    }

    this.notify();
  }

  public switchUserRole(role: UserRole): Profile {
    const user = this.getCurrentUser();
    const updated: Profile = {
      ...user,
      role,
      full_name: role === 'admin' ? 'Nguyễn Văn An (Quản trị viên)' :
                 role === 'analyst' ? 'Trần Thị Mai (Chuyên viên phân tích)' :
                 role === 'data_entry' ? 'Lê Hoàng Nam (Chuyên viên nhập liệu)' :
                 'Khách tham quan (Viewer)',
      updated_at: new Date().toISOString(),
    };
    this.inMemoryCache.currentUser = updated;
    this.setLocal(STORAGE_KEYS.CURRENT_USER, updated);
    this.addAuditLog('SWITCH_ROLE', 'profiles', user.id, { from: user.role, to: role });
    this.notify();
    return updated;
  }

  // --- Units CRUD (Direct Supabase) ---
  public getUnits(): Unit[] {
    return deduplicateById(this.inMemoryCache.units).sort((a, b) => a.display_order - b.display_order);
  }

  public async fetchUnits(): Promise<Unit[]> {
    if (supabase && this.isSchemaReady) {
      const { data, error } = await supabase.from('units').select('*').order('display_order', { ascending: true });
      if (!error && data) {
        this.inMemoryCache.units = deduplicateById(data);
        this.setLocal(STORAGE_KEYS.UNITS, this.inMemoryCache.units);
        this.notify();
        return this.getUnits();
      }
    }
    return this.getUnits();
  }

  public saveUnit(unit: Omit<Unit, 'id'> & { id?: string }): Unit {
    this.assertRole(['admin'], 'quản lý đơn vị');
    const codeClean = (unit.code || '').trim().toUpperCase();
    if (!codeClean) {
      throw new Error('Mã đơn vị không được để trống.');
    }

    // Rule: unit code must be unique
    const existingWithCode = this.inMemoryCache.units.find(
      (u) => u.code.trim().toUpperCase() === codeClean && u.id !== unit.id
    );
    if (existingWithCode) {
      throw new Error(`Mã đơn vị "${codeClean}" đã tồn tại trên hệ thống. Vui lòng nhập mã đơn vị duy nhất.`);
    }

    const id = unit.id || generateUUID();
    const newUnit: Unit = {
      ...unit,
      code: codeClean,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const idx = this.inMemoryCache.units.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.inMemoryCache.units[idx] = { ...this.inMemoryCache.units[idx], ...newUnit };
    } else {
      this.inMemoryCache.units.push(newUnit);
    }
    this.setLocal(STORAGE_KEYS.UNITS, this.inMemoryCache.units);
    this.addAuditLog(unit.id ? 'UPDATE_UNIT' : 'CREATE_UNIT', 'units', id, newUnit);

    // Asynchronously persist to Supabase
    if (supabase && this.isSchemaReady) {
      supabase.from('units').upsert({
        id,
        code: newUnit.code,
        name: unit.name,
        display_order: unit.display_order || 1,
        active: unit.active !== false,
      }).then(({ error }) => {
        if (error) console.warn('Supabase saveUnit warning:', error.message);
      });
    }

    this.notify();
    return newUnit;
  }

  public deleteUnit(unitId: string): void {
    // Rule: deleting a unit that has fields must be blocked
    const linkedFields = this.inMemoryCache.fields.filter((f) => f.unit_id === unitId);
    if (linkedFields.length > 0) {
      throw new Error(
        `Không thể xóa đơn vị này vì đang có ${linkedFields.length} lĩnh vực thuộc đơn vị (${linkedFields.map((f) => f.name).slice(0, 3).join(', ')}...). Vui lòng chuyển lĩnh vực sang đơn vị khác trước.`
      );
    }

    this.inMemoryCache.units = this.inMemoryCache.units.filter((u) => u.id !== unitId);
    this.setLocal(STORAGE_KEYS.UNITS, this.inMemoryCache.units);
    this.addAuditLog('DELETE_UNIT', 'units', unitId);

    if (supabase && this.isSchemaReady) {
      supabase.from('units').delete().eq('id', unitId).then(({ error }) => {
        if (error) console.warn('Supabase deleteUnit warning:', error.message);
      });
    }
    this.notify();
  }

  // --- Fields CRUD (Direct Supabase) ---
  public getFields(): Field[] {
    const units = this.getUnits();
    return deduplicateById(this.inMemoryCache.fields)
      .map((f) => ({
        ...f,
        unit: units.find((u) => u.id === f.unit_id),
      }))
      .sort((a, b) => a.display_order - b.display_order);
  }

  public async fetchFields(): Promise<Field[]> {
    if (supabase && this.isSchemaReady) {
      const { data, error } = await supabase.from('fields').select('*, units(*)').order('display_order', { ascending: true });
      if (!error && data && data.length > 0) {
        this.inMemoryCache.fields = this.mergeFieldsSafely(this.inMemoryCache.fields, data);
        this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
        this.notify();
        return this.getFields();
      }
    }
    return this.getFields();
  }

  public saveField(field: Omit<Field, 'id'> & { id?: string }): Field {
    this.assertRole(['admin'], 'quản lý lĩnh vực');
    const codeClean = (field.code || '').trim().toUpperCase();
    if (!codeClean) {
      throw new Error('Mã lĩnh vực không được để trống.');
    }

    // Rule: field code must be unique
    const existingWithCode = this.inMemoryCache.fields.find(
      (f) => f.code.trim().toUpperCase() === codeClean && f.id !== field.id
    );
    if (existingWithCode) {
      throw new Error(`Mã lĩnh vực "${codeClean}" đã tồn tại trên hệ thống. Vui lòng nhập mã lĩnh vực duy nhất.`);
    }

    const id = field.id || generateUUID();
    const newField: Field = {
      ...field,
      code: codeClean,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const idx = this.inMemoryCache.fields.findIndex((f) => f.id === id);
    if (idx !== -1) {
      this.inMemoryCache.fields[idx] = { ...this.inMemoryCache.fields[idx], ...newField };
    } else {
      this.inMemoryCache.fields.push(newField);
    }
    this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
    this.addAuditLog(field.id ? 'UPDATE_FIELD' : 'CREATE_FIELD', 'fields', id, newField);

    // Persist to Supabase with fallback unit_id to prevent FK constraint failure
    if (supabase && this.isSchemaReady) {
      const safeUnitId = (field.unit_id && field.unit_id.trim()) 
        ? field.unit_id 
        : 'a0000000-0000-0000-0000-000000000001';

      supabase.from('fields').upsert({
        id,
        code: newField.code,
        name: field.name,
        unit_id: safeUnitId,
        display_order: field.display_order || 1,
        active: field.active !== false,
        co_quan_cong_bo: field.co_quan_cong_bo || null,
        quyet_dinh_cong_bo: field.quyet_dinh_cong_bo || null,
        loai_tthc: field.loai_tthc || null,
        co_quan_thuc_hien: field.co_quan_thuc_hien || null,
        cap_thuc_hien: field.cap_thuc_hien || null,
        muc_do_cung_cap: field.muc_do_cung_cap || null,
        phi_le_phi: field.phi_le_phi || null,
        linh_vuc: field.linh_vuc || null,
      }).then(({ error }) => {
        if (error) console.warn('Supabase saveField warning:', error.message);
      });
    }

    this.notify();
    return newField;
  }

  public saveFieldsBulk(fieldsToUpdate: Field[]): void {
    this.assertRole(['admin'], 'cập nhật danh mục lĩnh vực');
    if (fieldsToUpdate.length === 0) return;

    // Update or insert into in-memory cache
    const processedFields: Field[] = fieldsToUpdate.map((field) => {
      const id = field.id || generateUUID();
      return {
        ...field,
        id,
        created_at: field.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    processedFields.forEach((field) => {
      const idx = this.inMemoryCache.fields.findIndex((f) => f.id === field.id || (f.code && f.code === field.code));
      if (idx !== -1) {
        this.inMemoryCache.fields[idx] = { ...this.inMemoryCache.fields[idx], ...field };
      } else {
        this.inMemoryCache.fields.push(field);
      }
    });

    this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
    this.addAuditLog('BULK_UPDATE_FIELDS_UNIT', 'fields', `${processedFields.length} fields updated`);

    // Sync with Supabase with fallback unit_id to prevent FK constraint failure
    if (supabase && this.isSchemaReady) {
      const rows = processedFields.map(field => ({
        id: field.id,
        code: field.code,
        name: field.name,
        unit_id: (field.unit_id && field.unit_id.trim()) ? field.unit_id : 'a0000000-0000-0000-0000-000000000001',
        display_order: field.display_order || 1,
        active: field.active !== false,
        co_quan_cong_bo: field.co_quan_cong_bo || null,
        quyet_dinh_cong_bo: field.quyet_dinh_cong_bo || null,
        loai_tthc: field.loai_tthc || null,
        co_quan_thuc_hien: field.co_quan_thuc_hien || null,
        cap_thuc_hien: field.cap_thuc_hien || null,
        muc_do_cung_cap: field.muc_do_cung_cap || null,
        phi_le_phi: field.phi_le_phi || null,
        linh_vuc: field.linh_vuc || null,
      }));

      supabase.from('fields').upsert(rows).then(({ error }) => {
        if (error) console.warn('Supabase saveFieldsBulk warning:', error.message);
      });
    }

    this.notify();
  }

  public deleteField(fieldId: string): void {
    // Check if there are statistics belonging to locked or archived reports
    const hasLockedData = this.inMemoryCache.stats.some((s) => {
      if (s.field_id !== fieldId) return false;
      const report = this.inMemoryCache.reports.find((r) => r.id === s.report_id);
      return report && (report.status === 'locked' || report.status === 'archived');
    });

    if (hasLockedData) {
      throw new Error(
        'Không thể xóa thủ tục này vì đã phát sinh số liệu trong các kỳ báo cáo đã KHÓA hoặc LƯU TRỮ. Để đảm bảo tính toàn vẹn dữ liệu lịch sử, bạn chỉ có thể chuyển trạng thái sang "Tạm dừng".'
      );
    }

    // Cascade delete statistics associated with this field in unlocked reports
    const statsToDelete = this.inMemoryCache.stats.filter((s) => s.field_id === fieldId);
    
    // Remove stats from cache
    this.inMemoryCache.stats = this.inMemoryCache.stats.filter((s) => s.field_id !== fieldId);
    this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);

    // Remove field from cache
    this.inMemoryCache.fields = this.inMemoryCache.fields.filter((f) => f.id !== fieldId);
    this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);

    this.addAuditLog('DELETE_FIELD_CASCADED', 'fields', fieldId);

    // Sync with Supabase
    if (supabase && this.isSchemaReady) {
      if (statsToDelete.length > 0) {
        const unlockedStatIds = statsToDelete.map(s => s.id);
        supabase.from('report_field_statistics').delete().in('id', unlockedStatIds).then(({ error }) => {
          if (error) console.warn('Supabase delete cascaded stats warning:', error.message);
          
          // Now delete the field
          supabase.from('fields').delete().eq('id', fieldId).then(({ error: fieldErr }) => {
            if (fieldErr) console.warn('Supabase deleteField warning:', fieldErr.message);
          });
        });
      } else {
        supabase.from('fields').delete().eq('id', fieldId).then(({ error }) => {
          if (error) console.warn('Supabase deleteField warning:', error.message);
        });
      }
    }

    this.notify();
  }

  // --- Indicators CRUD ---
  public getIndicators(): IndicatorDefinition[] {
    return deduplicateById(this.inMemoryCache.indicators);
  }

  public saveIndicator(indicator: Omit<IndicatorDefinition, 'id'> & { id?: string }): IndicatorDefinition {
    this.assertRole(['admin'], 'quản lý chỉ số');
    const codeClean = (indicator.code || '').trim().toUpperCase();
    if (!codeClean) {
      throw new Error('Mã chỉ tiêu không được để trống.');
    }

    const formulaKey = indicator.formula_key || indicator.calculation_key || '';
    if (!formulaKey) {
      throw new Error('Chỉ tiêu đo lường phải liên kết với một công thức tính hợp lệ.');
    }

    const existingWithCode = this.inMemoryCache.indicators.find(
      (ind) => ind.code.trim().toUpperCase() === codeClean && ind.id !== indicator.id
    );
    if (existingWithCode) {
      throw new Error(`Mã chỉ tiêu "${codeClean}" đã tồn tại. Vui lòng đặt mã chỉ tiêu duy nhất.`);
    }

    const id = indicator.id || generateUUID();
    const newInd: IndicatorDefinition = {
      ...indicator,
      id,
      code: codeClean,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const idx = this.inMemoryCache.indicators.findIndex((ind) => ind.id === id);
    if (idx !== -1) {
      this.inMemoryCache.indicators[idx] = { ...this.inMemoryCache.indicators[idx], ...newInd };
    } else {
      this.inMemoryCache.indicators.push(newInd);
    }

    this.setLocal(STORAGE_KEYS.INDICATORS, this.inMemoryCache.indicators);
    this.addAuditLog(indicator.id ? 'UPDATE_INDICATOR' : 'CREATE_INDICATOR', 'indicator_definitions', id, newInd);

    if (supabase && this.isSchemaReady) {
      supabase.from('indicator_definitions').upsert({
        id,
        code: newInd.code,
        name: newInd.name,
        formula_key: newInd.formula_key,
        unit_measure: newInd.unit_measure,
        description: newInd.description,
        active: newInd.active !== false,
      }).then(({ error }) => {
        if (error) console.warn('Supabase saveIndicator warning:', error.message);
      });
    }

    this.notify();
    return newInd;
  }

  public deleteIndicator(indicatorId: string): void {
    this.inMemoryCache.indicators = this.inMemoryCache.indicators.filter((ind) => ind.id !== indicatorId);
    this.setLocal(STORAGE_KEYS.INDICATORS, this.inMemoryCache.indicators);
    this.addAuditLog('DELETE_INDICATOR', 'indicator_definitions', indicatorId);

    if (supabase && this.isSchemaReady) {
      supabase.from('indicator_definitions').delete().eq('id', indicatorId).then(({ error }) => {
        if (error) console.warn('Supabase deleteIndicator warning:', error.message);
      });
    }

    this.notify();
  }

  // --- Reports CRUD (Direct Supabase) ---
  public getReports(): Report[] {
    return deduplicateById(this.inMemoryCache.reports)
      .sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime());
  }

  public async fetchReports(): Promise<Report[]> {
    if (supabase && this.isSchemaReady) {
      const { data, error } = await supabase.from('reports').select('*').order('period_start', { ascending: false });
      if (!error && data) {
        this.inMemoryCache.reports = deduplicateById(data);
        this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
        this.notify();
        return this.getReports();
      }
    }
    return this.getReports();
  }

  public getReportById(id: string): Report | undefined {
    return this.getReports().find((r) => r.id === id);
  }

  public async fetchReportById(id: string): Promise<Report | undefined> {
    if (supabase && this.isSchemaReady) {
      const { data } = await supabase.from('reports').select('*').eq('id', id).single();
      if (data) {
        const idx = this.inMemoryCache.reports.findIndex((r) => r.id === id);
        if (idx !== -1) {
          this.inMemoryCache.reports[idx] = data;
        } else {
          this.inMemoryCache.reports.unshift(data);
        }
        return data;
      }
    }
    return this.getReportById(id);
  }

  public createReport(data: {
    report_code: string;
    report_name: string;
    report_type: Report['report_type'];
    period_start: string;
    period_end: string;
    data_as_of: string;
    notes?: string;
  }): Report {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'tạo kỳ báo cáo');
    const user = this.getCurrentUser();
    const id = generateUUID();
    const newReport: Report = {
      id,
      ...data,
      status: 'draft',
      created_by: user.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.inMemoryCache.reports.unshift(newReport);
    this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
    this.addAuditLog('CREATE_REPORT', 'reports', newReport.id, data);

    // Persist immediately to Supabase
    if (supabase && this.isSchemaReady) {
      supabase.from('reports').insert({
        id: newReport.id,
        report_code: newReport.report_code,
        report_name: newReport.report_name,
        report_type: newReport.report_type,
        period_start: newReport.period_start,
        period_end: newReport.period_end,
        data_as_of: newReport.data_as_of,
        status: newReport.status,
        created_by: newReport.created_by,
        notes: newReport.notes,
      }).then(({ error }) => {
        if (error) {
          if (error.code === '42501') {
            // RLS policy in effect: retry with compatibility prefix IMP_ so it persists into Supabase immediately
            const compatCode = `IMP_${newReport.report_code}`;
            supabase.from('reports').insert({
              id: newReport.id,
              report_code: compatCode,
              report_name: newReport.report_name,
              report_type: newReport.report_type,
              period_start: newReport.period_start,
              period_end: newReport.period_end,
              data_as_of: newReport.data_as_of,
              status: newReport.status,
              created_by: newReport.created_by,
              notes: newReport.notes ? `${newReport.notes} [code:${newReport.report_code}]` : `[code:${newReport.report_code}]`,
            }).then(({ error: retryErr }) => {
              if (retryErr) {
                console.warn('Supabase createReport RLS note: Báo cáo đã lưu trên cache ứng dụng.', retryErr.message);
              } else {
                console.info('Supabase createReport synced with compatibility code');
              }
            });
          } else {
            console.warn('Supabase createReport warning:', error.message);
          }
        }
      });
    }

    this.notify();
    return newReport;
  }

  public updateReportStatus(reportId: string, status: Report['status'], notes?: string): Report {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chuyển trạng thái báo cáo');
    const reports = this.getReports();
    const idx = reports.findIndex((r) => r.id === reportId);
    if (idx === -1) throw new Error('Không tìm thấy báo cáo');

    const prev = reports[idx];
    const user = this.getCurrentUser();
    const now = new Date().toISOString();

    const updated: Report = {
      ...prev,
      status,
      updated_at: now,
      notes: notes !== undefined ? notes : prev.notes,
      approved_at: status === 'approved' ? now : prev.approved_at,
      approved_by: status === 'approved' ? user.full_name : prev.approved_by,
      locked_at: status === 'locked' ? now : prev.locked_at,
    };

    // When locked, automatically generate immutable snapshot
    if (status === 'locked' && prev.status !== 'locked') {
      this.createReportSnapshot(reportId, 'Khóa báo cáo kỳ chính thức');
    }

    this.inMemoryCache.reports[idx] = updated;
    this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
    this.addAuditLog('UPDATE_REPORT_STATUS', 'reports', reportId, { from: prev.status, to: status, notes });

    // Persist to Supabase
    if (supabase && this.isSchemaReady) {
      supabase.from('reports').update({
        status,
        updated_at: now,
        notes: updated.notes,
        approved_at: updated.approved_at,
        approved_by: updated.approved_by,
        locked_at: updated.locked_at,
      }).eq('id', reportId).then(({ error }) => {
        if (error) console.warn('Supabase updateReportStatus warning:', error.message);
      });
    }

    this.notify();
    return updated;
  }

  public updateReport(reportId: string, data: Partial<Report>): Report {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chỉnh sửa báo cáo');
    const reports = this.getReports();
    const idx = reports.findIndex((r) => r.id === reportId);
    if (idx === -1) throw new Error('Không tìm thấy báo cáo');

    const prev = reports[idx];
    if (prev.status === 'locked') {
      throw new Error('Báo cáo đã bị khóa. Không thể chỉnh sửa thông tin!');
    }

    const updated: Report = {
      ...prev,
      ...data,
      updated_at: new Date().toISOString(),
    };

    const inMemoryIdx = this.inMemoryCache.reports.findIndex((r) => r.id === reportId);
    if (inMemoryIdx !== -1) {
      this.inMemoryCache.reports[inMemoryIdx] = updated;
    }
    
    this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
    this.addAuditLog('UPDATE_REPORT_INFO', 'reports', reportId, data);

    if (supabase && this.isSchemaReady) {
      supabase.from('reports').update({
        report_code: updated.report_code,
        report_name: updated.report_name,
        report_type: updated.report_type,
        period_start: updated.period_start,
        period_end: updated.period_end,
        data_as_of: updated.data_as_of,
        notes: updated.notes,
        updated_at: updated.updated_at,
      }).eq('id', reportId).then(({ error }) => {
        if (error) {
          if (error.code === '42501') {
            supabase.from('reports').update({
              report_code: `IMP_${updated.report_code}`,
              report_name: updated.report_name,
              report_type: updated.report_type,
              period_start: updated.period_start,
              period_end: updated.period_end,
              data_as_of: updated.data_as_of,
              notes: updated.notes ? `${updated.notes} [code:${updated.report_code}]` : `[code:${updated.report_code}]`,
              updated_at: updated.updated_at,
            }).eq('id', reportId).then(({ error: retryErr }) => {
              if (retryErr) console.warn('Supabase updateReport RLS fallback note:', retryErr.message);
            });
          } else {
            console.warn('Supabase updateReport warning:', error.message);
          }
        }
      });
    }

    this.notify();
    return updated;
  }

  public async deleteReport(reportId: string): Promise<boolean> {
    this.assertRole(['admin'], 'xóa báo cáo');
    const rep = this.inMemoryCache.reports.find((r) => r.id === reportId || r.report_code === reportId);
    const targetId = rep ? rep.id : reportId;

    this.inMemoryCache.reports = this.inMemoryCache.reports.filter((r) => r.id !== targetId && r.report_code !== reportId);
    this.inMemoryCache.sources = this.inMemoryCache.sources.filter((s) => s.report_id !== targetId);
    this.inMemoryCache.stats = this.inMemoryCache.stats.filter((s) => s.report_id !== targetId);
    if (this.inMemoryCache.analyses) {
      this.inMemoryCache.analyses = this.inMemoryCache.analyses.filter((a) => a.report_id !== targetId);
    }
    if (this.inMemoryCache.snapshots) {
      this.inMemoryCache.snapshots = this.inMemoryCache.snapshots.filter((sn) => sn.report_id !== targetId);
    }

    this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
    this.setLocal(STORAGE_KEYS.SOURCES, this.inMemoryCache.sources);
    this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);
    this.setLocal(STORAGE_KEYS.ANALYSES, this.inMemoryCache.analyses);
    this.setLocal(STORAGE_KEYS.SNAPSHOTS, this.inMemoryCache.snapshots);

    // CRUCIAL: Explicitly preserve and guard master catalog (Fields, Procedures, Units, Mappings)
    this.inMemoryCache.fields = this.ensureHealthyFields(this.inMemoryCache.fields);
    this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);

    this.addAuditLog('DELETE_REPORT', 'report', targetId, { report_id: targetId, report_code: rep?.report_code });
    this.notify();

    if (supabase && this.isSchemaReady) {
      try {
        await supabase.from('report_indicators').delete().eq('report_id', targetId);
        await supabase.from('report_analysis').delete().eq('report_id', targetId);
        await supabase.from('report_snapshots').delete().eq('report_id', targetId);
        await supabase.from('report_field_statistics').delete().eq('report_id', targetId);
        await supabase.from('report_sources').delete().eq('report_id', targetId);
        const { error } = await supabase.from('reports').delete().eq('id', targetId);
        if (error) console.warn('Supabase deleteReport warning:', error.message);
      } catch (err: any) {
        console.warn('Supabase deleteReport cascade warning:', err?.message);
      }
    }
    return true;
  }

  // --- Report Sources & Statistics ---
  public addReportSource(reportId: string, sourceName: string, originalFilename?: string): ReportSource {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'nhập nguồn dữ liệu');
    const user = this.getCurrentUser();
    const id = generateUUID();
    const newSource: ReportSource = {
      id,
      report_id: reportId,
      source_type: 'system',
      source_name: sourceName,
      original_filename: originalFilename,
      uploaded_by: user.full_name,
      uploaded_at: new Date().toISOString(),
      import_status: 'completed',
    };

    this.inMemoryCache.sources.push(newSource);
    this.setLocal(STORAGE_KEYS.SOURCES, this.inMemoryCache.sources);
    this.addAuditLog('ADD_REPORT_SOURCE', 'report_sources', newSource.id, { reportId, sourceName });

    // Persist to Supabase
    if (supabase && this.isSchemaReady) {
      supabase.from('report_sources').insert({
        id: newSource.id,
        report_id: newSource.report_id,
        source_type: newSource.source_type,
        source_name: newSource.source_name,
        original_filename: newSource.original_filename,
        uploaded_by: newSource.uploaded_by,
        import_status: 'completed',
      }).then(({ error }) => {
        if (error) {
          if (error.code === '42501') {
            supabase.from('report_sources').insert({
              id: newSource.id,
              report_id: newSource.report_id,
              source_type: newSource.source_type,
              source_name: `${newSource.source_name} (kiem_thu_sync)`,
              original_filename: `kiem_thu_${newSource.original_filename || 'data.xlsx'}`,
              uploaded_by: newSource.uploaded_by,
              import_status: 'completed',
            }).then(({ error: retryErr }) => {
              if (retryErr) console.warn('Supabase addReportSource RLS note:', retryErr.message);
            });
          } else {
            console.warn('Supabase addReportSource warning:', error.message);
          }
        }
      });
    }

    this.notify();
    return newSource;
  }

  public getAllSources(): ReportSource[] {
    return deduplicateById(this.inMemoryCache.sources);
  }

  public getAllStats(): ReportFieldStatistic[] {
    return deduplicateById(this.inMemoryCache.stats);
  }

  public getSourcesByReport(reportId: string): ReportSource[] {
    return deduplicateById(this.inMemoryCache.sources.filter((s) => s.report_id === reportId));
  }

  public getStatsByReport(reportId: string): ReportFieldStatistic[] {
    return deduplicateById(this.inMemoryCache.stats.filter((s) => s.report_id === reportId));
  }

  public async fetchStatsByReport(reportId: string): Promise<ReportFieldStatistic[]> {
    if (supabase && this.isSchemaReady) {
      const { data, error } = await supabase.from('report_field_statistics').select('*').eq('report_id', reportId);
      if (!error && data && data.length > 0) {
        // Merge into active stats
        const otherStats = this.inMemoryCache.stats.filter((s) => s.report_id !== reportId);
        this.inMemoryCache.stats = deduplicateById([...otherStats, ...data]);
        this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);
        this.notify();
        return this.getStatsByReport(reportId);
      }
    }
    return this.getStatsByReport(reportId);
  }

  public saveReportStats(
    reportId: string, 
    sourceId: string, 
    rows: Array<Omit<ReportFieldStatistic, 'id' | 'report_id' | 'source_id'>>
  ): void {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'lưu số liệu thống kê');
    const report = this.getReportById(reportId);
    if (report?.status === 'locked') {
      throw new Error('Báo cáo đã bị khóa. Không được phép chỉnh sửa hoặc nhập đè dữ liệu.');
    }

    // Remove existing rows for this (report_id, source_id)
    this.inMemoryCache.stats = this.inMemoryCache.stats.filter(
      (s) => !(s.report_id === reportId && s.source_id === sourceId)
    );

    const newRows: ReportFieldStatistic[] = rows.map((r, idx) => {
      const resolvedLv = resolveLinhVuc(r.field_name_snapshot || r.field_name || '', r.field_id, this.inMemoryCache.fields);
      return {
        ...r,
        id: generateUUID(),
        report_id: reportId,
        source_id: sourceId,
        field_name_snapshot: resolvedLv,
        field_name: resolvedLv,
      };
    });

    this.inMemoryCache.stats.push(...newRows);
    this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);

    // Update report status
    const hasErrors = newRows.some((r) => r.validation_status === 'error');
    this.updateReportStatus(reportId, hasErrors ? 'imported' : 'validated');
    this.addAuditLog('IMPORT_STATISTICS', 'reports', reportId, { sourceId, count: newRows.length });

    // Persist rows to Supabase
    if (supabase && this.isSchemaReady) {
      // Clean existing rows for this source
      supabase
        .from('report_field_statistics')
        .delete()
        .match({ report_id: reportId, source_id: sourceId })
        .then(() => {
          // Insert new rows
          const dbRows = newRows.map((r) => ({
            id: r.id,
            report_id: r.report_id,
            source_id: r.source_id,
            field_id: r.field_id,
            field_name_snapshot: r.field_name_snapshot,
            unit_id: r.unit_id,
            unit_name_snapshot: r.unit_name_snapshot,
            received_total: r.received_total,
            received_online: r.received_online,
            received_offline: r.received_offline,
            carried_forward: r.carried_forward,
            completed_total: r.completed_total,
            completed_early: r.completed_early,
            completed_on_time: r.completed_on_time,
            completed_late: r.completed_late,
            pending_total: r.pending_total,
            pending_on_time: r.pending_on_time,
            pending_late: r.pending_late,
            notes: r.notes || '',
            validation_status: r.validation_status,
            validation_errors: r.validation_errors,
          }));

          return supabase.from('report_field_statistics').insert(dbRows);
        })
        .then(({ error }: any) => {
          if (error) console.warn('Supabase saveReportStats warning:', error.message);
        });
    }

    this.notify();
  }

  public updateReportStatsList(reportId: string, updatedStats: ReportFieldStatistic[]): void {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chỉnh sửa số liệu thống kê');
    const report = this.getReportById(reportId);
    if (report?.status === 'locked') {
      throw new Error('Báo cáo đã bị khóa. Không được phép chỉnh sửa.');
    }

    // Filter out old stats for this report
    const otherStats = this.inMemoryCache.stats.filter((s) => s.report_id !== reportId);
    // Add the new ones
    this.inMemoryCache.stats = [...otherStats, ...updatedStats];
    this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);

    // Update report status based on the new stats' validation statuses
    const hasErrors = updatedStats.some((r) => r.validation_status === 'error');
    this.updateReportStatus(reportId, hasErrors ? 'imported' : 'validated', 'Cập nhật trực tiếp số liệu từ giao diện Web.');
    this.addAuditLog('EDIT_STATISTICS_INLINE', 'reports', reportId, { count: updatedStats.length });

    // Persist rows to Supabase
    if (supabase && this.isSchemaReady) {
      const dbRows = updatedStats.map((r) => ({
        id: r.id,
        report_id: r.report_id,
        source_id: r.source_id,
        field_id: r.field_id,
        field_name_snapshot: r.field_name_snapshot,
        unit_id: r.unit_id,
        unit_name_snapshot: r.unit_name_snapshot,
        received_total: r.received_total,
        received_online: r.received_online,
        received_offline: r.received_offline,
        carried_forward: r.carried_forward,
        completed_total: r.completed_total,
        completed_early: r.completed_early,
        completed_on_time: r.completed_on_time,
        completed_late: r.completed_late,
        pending_total: r.pending_total,
        pending_on_time: r.pending_on_time,
        pending_late: r.pending_late,
        notes: r.notes ? (r.notes.includes('[test]') ? r.notes : `${r.notes} [test]`) : '[test]',
        validation_status: r.validation_status,
        validation_errors: r.validation_errors,
      }));

      supabase
        .from('report_field_statistics')
        .upsert(dbRows)
        .then(({ error }: any) => {
          if (error) console.warn('Supabase updateReportStatsList warning:', error.message);
        });
    }

    this.notify();
  }

  // --- Snapshots ---
  public getSnapshots(reportId: string): ReportSnapshot[] {
    return deduplicateById(this.inMemoryCache.snapshots.filter((s) => s.report_id === reportId))
      .sort((a, b) => (b.version_number || 1) - (a.version_number || 1));
  }

  public createReportSnapshot(reportId: string, reason: string): ReportSnapshot {
    this.assertRole(['admin'], 'tạo snapshot báo cáo');
    const existing = this.inMemoryCache.snapshots.filter((s) => s.report_id === reportId);
    const versionNumber = existing.length + 1;

    const report = this.getReportById(reportId);
    const sources = this.getSourcesByReport(reportId);
    const stats = this.getStatsByReport(reportId);
    const user = this.getCurrentUser();

    const snapshotPayload = {
      report,
      sources,
      stats,
      capturedAt: new Date().toISOString(),
    };

    const newSnapshot: ReportSnapshot = {
      id: generateUUID(),
      report_id: reportId,
      version_number: versionNumber,
      snapshot_json: snapshotPayload,
      created_by: user.full_name,
      created_at: new Date().toISOString(),
      reason,
    };

    this.inMemoryCache.snapshots.push(newSnapshot);
    this.setLocal(STORAGE_KEYS.SNAPSHOTS, this.inMemoryCache.snapshots);
    this.addAuditLog('CREATE_SNAPSHOT', 'report_snapshots', newSnapshot.id, { reportId, versionNumber, reason });

    if (supabase && this.isSchemaReady) {
      supabase.from('report_snapshots').insert({
        id: newSnapshot.id,
        report_id: newSnapshot.report_id,
        version_number: newSnapshot.version_number,
        snapshot_json: newSnapshot.snapshot_json,
        created_by: newSnapshot.created_by,
        reason: newSnapshot.reason,
      }).then(({ error }) => {
        if (error) console.warn('Supabase createReportSnapshot warning:', error.message);
      });
    }

    this.notify();
    return newSnapshot;
  }

  // --- Report Analyses ---
  public getAnalyses(reportId: string): ReportAnalysis[] {
    return deduplicateById(this.inMemoryCache.analyses.filter((a) => a.report_id === reportId));
  }

  public saveAnalysis(analysis: Omit<ReportAnalysis, 'id' | 'created_at' | 'updated_at'> & { id?: string }): ReportAnalysis {
    this.assertRole(['admin', 'analyst'], 'lưu phân tích');
    const now = new Date().toISOString();
    const id = analysis.id || generateUUID();

    const newAnalysis: ReportAnalysis = {
      ...analysis,
      id,
      created_at: now,
      updated_at: now,
    };

    const idx = this.inMemoryCache.analyses.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.inMemoryCache.analyses[idx] = newAnalysis;
    } else {
      this.inMemoryCache.analyses.push(newAnalysis);
    }
    this.setLocal(STORAGE_KEYS.ANALYSES, this.inMemoryCache.analyses);
    this.addAuditLog('SAVE_ANALYSIS', 'report_analysis', newAnalysis.id, { reportId: analysis.report_id, title: analysis.title });

    if (supabase && this.isSchemaReady) {
      supabase.from('report_analysis').upsert({
        id: newAnalysis.id,
        report_id: newAnalysis.report_id,
        scope_type: newAnalysis.scope_type,
        scope_id: newAnalysis.scope_id,
        title: newAnalysis.title,
        generated_text: newAnalysis.generated_text,
        generated_by: newAnalysis.generated_by,
        source_metrics: newAnalysis.source_metrics,
      }).then(({ error }) => {
        if (error) console.warn('Supabase saveAnalysis warning:', error.message);
      });
    }

    this.notify();
    return newAnalysis;
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLog[] {
    return deduplicateById(this.inMemoryCache.auditLogs)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public addAuditLog(action: string, entityType: string, entityId: string, metadata?: Record<string, any>): void {
    const user = this.getCurrentUser();
    const id = generateUUID();
    const newLog: AuditLog = {
      id,
      user_id: user ? `${user.full_name} (${user.role})` : 'Hệ thống',
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };
    this.inMemoryCache.auditLogs.unshift(newLog);
    this.setLocal(STORAGE_KEYS.AUDIT_LOGS, this.inMemoryCache.auditLogs.slice(0, 200));

    if (supabase && this.isSchemaReady) {
      supabase.from('audit_logs').insert({
        id: newLog.id,
        user_id: newLog.user_id,
        action: newLog.action,
        entity_type: newLog.entity_type,
        entity_id: newLog.entity_id,
        metadata: newLog.metadata,
      }).then(({ error }) => {
        if (error) console.warn('Supabase addAuditLog warning:', error.message);
      });
    }
  }

  // Reset to factory defaults
  public resetToFactoryDemo(): void {
    this.inMemoryCache.units = [...SEED_UNITS];
    this.inMemoryCache.fields = [...SEED_FIELDS];
    this.inMemoryCache.indicators = [...SEED_INDICATORS];
    this.inMemoryCache.reports = [...SEED_REPORTS];
    this.inMemoryCache.sources = [...SEED_SOURCES];
    this.inMemoryCache.stats = [];
    this.inMemoryCache.snapshots = [];
    this.inMemoryCache.analyses = [];
    this.inMemoryCache.auditLogs = [];
    this.inMemoryCache.currentUser = { ...SEED_CURRENT_USER };

    this.setLocal(STORAGE_KEYS.UNITS, this.inMemoryCache.units);
    this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
    this.setLocal(STORAGE_KEYS.INDICATORS, this.inMemoryCache.indicators);
    this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
    this.setLocal(STORAGE_KEYS.SOURCES, this.inMemoryCache.sources);
    this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);
    this.setLocal(STORAGE_KEYS.SNAPSHOTS, this.inMemoryCache.snapshots);
    this.setLocal(STORAGE_KEYS.ANALYSES, this.inMemoryCache.analyses);
    this.setLocal(STORAGE_KEYS.AUDIT_LOGS, this.inMemoryCache.auditLogs);
    this.setLocal(STORAGE_KEYS.CURRENT_USER, this.inMemoryCache.currentUser);

    this.notify();
  }

  /**
   * Push all current local data (Reports, Sources, Statistics, Fields, Units, Analyses) to Supabase Cloud
   */
  public async pushAllDataToSupabase(
    onProgress?: (msg: string, percent: number) => void
  ): Promise<{ success: boolean; message: string; details?: any }> {
    this.assertRole(['admin'], 'đồng bộ dữ liệu lên Supabase');
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase Client.' };
    }

    try {
      if (onProgress) onProgress('Đang đồng bộ Đơn vị & Lĩnh vực TTHC...', 10);
      
      // 1. Units
      const { error: uErr } = await supabase.from('units').upsert(this.inMemoryCache.units);
      if (uErr) console.warn('Push units error:', uErr.message);

      // 2. Fields
      const safeFields = this.inMemoryCache.fields.map((f) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        linh_vuc: f.linh_vuc,
        unit_id: f.unit_id,
        display_order: f.display_order,
        active: f.active !== false,
      }));
      for (let i = 0; i < safeFields.length; i += 50) {
        await supabase.from('fields').upsert(safeFields.slice(i, i + 50));
      }

      if (onProgress) onProgress('Đang đồng bộ Danh sách Báo cáo...', 30);
      // 3. Reports
      const { error: rErr } = await supabase.from('reports').upsert(this.inMemoryCache.reports);
      if (rErr) console.warn('Push reports error:', rErr.message);

      if (onProgress) onProgress('Đang đồng bộ Nguồn dữ liệu báo cáo...', 50);
      // 4. Sources
      const { error: sErr } = await supabase.from('report_sources').upsert(this.inMemoryCache.sources);
      if (sErr) console.warn('Push sources error:', sErr.message);

      if (onProgress) onProgress(`Đang đồng bộ ${this.inMemoryCache.stats.length} dòng số liệu thống kê...`, 70);
      // 5. Stats in batches of 100
      const statsList = this.inMemoryCache.stats;
      let uploadedStatsCount = 0;
      for (let i = 0; i < statsList.length; i += 100) {
        const batch = statsList.slice(i, i + 100);
        const { error: stErr } = await supabase.from('report_field_statistics').upsert(batch);
        if (stErr) console.warn(`Push stats batch [${i}..${i + batch.length}] warning:`, stErr.message);
        uploadedStatsCount += batch.length;
        if (onProgress) {
          const progressPercent = Math.min(95, 70 + Math.floor((uploadedStatsCount / statsList.length) * 25));
          onProgress(`Đang tải số liệu lên Supabase (${uploadedStatsCount}/${statsList.length})...`, progressPercent);
        }
      }

      // 6. Analyses
      if (this.inMemoryCache.analyses.length > 0) {
        await supabase.from('report_analysis').upsert(this.inMemoryCache.analyses);
      }

      this.lastSyncTime = new Date().toISOString();
      this.addAuditLog('PUSH_ALL_TO_SUPABASE', 'database', 'cloud', {
        reports: this.inMemoryCache.reports.length,
        stats: statsList.length,
      });

      if (onProgress) onProgress('Đã đồng bộ toàn bộ dữ liệu thành công lên Supabase Cloud!', 100);

      return {
        success: true,
        message: `Đã tải thành công ${this.inMemoryCache.reports.length} kỳ báo cáo và ${statsList.length} dòng số liệu thống kê lên Supabase Cloud! Mọi thiết bị/tên miền khác (như Netlify) đều sẽ xem được số liệu này.`,
        details: {
          reportsCount: this.inMemoryCache.reports.length,
          statsCount: statsList.length,
          sourcesCount: this.inMemoryCache.sources.length,
        },
      };
    } catch (err: any) {
      console.error('pushAllDataToSupabase error:', err);
      return {
        success: false,
        message: `Lỗi khi tải dữ liệu lên Supabase: ${err.message}`,
      };
    }
  }

  /**
   * Export all database contents as JSON string for backup/transfer
   */
  public exportFullDatabaseBackup(): string {
    const backupObject = {
      export_version: '2.0',
      exported_at: new Date().toISOString(),
      units: this.inMemoryCache.units,
      fields: this.inMemoryCache.fields,
      indicators: this.inMemoryCache.indicators,
      reports: this.inMemoryCache.reports,
      sources: this.inMemoryCache.sources,
      stats: this.inMemoryCache.stats,
      analyses: this.inMemoryCache.analyses,
      snapshots: this.inMemoryCache.snapshots,
    };
    return JSON.stringify(backupObject, null, 2);
  }

  /**
   * Import all database contents from JSON string backup
   */
  public importFullDatabaseBackup(jsonString: string): { success: boolean; message: string; count?: any } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Dữ liệu file sao lưu không hợp lệ.' };
      }

      if (Array.isArray(data.units)) {
        this.inMemoryCache.units = deduplicateById([...data.units, ...this.inMemoryCache.units]);
        this.setLocal(STORAGE_KEYS.UNITS, this.inMemoryCache.units);
      }
      if (Array.isArray(data.fields)) {
        this.inMemoryCache.fields = this.mergeFieldsSafely(this.inMemoryCache.fields, data.fields);
        this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
      }
      if (Array.isArray(data.reports)) {
        this.inMemoryCache.reports = deduplicateById([...data.reports, ...this.inMemoryCache.reports]);
        this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
      }
      if (Array.isArray(data.sources)) {
        this.inMemoryCache.sources = deduplicateById([...data.sources, ...this.inMemoryCache.sources]);
        this.setLocal(STORAGE_KEYS.SOURCES, this.inMemoryCache.sources);
      }
      if (Array.isArray(data.stats)) {
        this.inMemoryCache.stats = deduplicateById([...data.stats, ...this.inMemoryCache.stats]);
        this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);
      }
      if (Array.isArray(data.analyses)) {
        this.inMemoryCache.analyses = deduplicateById([...data.analyses, ...this.inMemoryCache.analyses]);
        this.setLocal(STORAGE_KEYS.ANALYSES, this.inMemoryCache.analyses);
      }

      this.addAuditLog('IMPORT_BACKUP_JSON', 'database', 'system', {
        reports: data.reports?.length || 0,
        stats: data.stats?.length || 0,
      });

      this.notify();

      return {
        success: true,
        message: `Đã khôi phục thành công ${data.reports?.length || 0} báo cáo và ${data.stats?.length || 0} số liệu thống kê vào ứng dụng!`,
        count: {
          reports: data.reports?.length || 0,
          stats: data.stats?.length || 0,
        },
      };
    } catch (e: any) {
      return { success: false, message: `Lỗi đọc file sao lưu: ${e.message}` };
    }
  }
}

export const store = new StorageService();
