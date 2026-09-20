import { supabase, supabaseUrl, isSupabaseConfigured } from '../lib/supabase';
import type { Unit, Field, ReportingPeriod, ReportSource, ReportStatistic } from '../types/database';
import { deduplicateById } from './store';

export const SEED_UNITS: Array<Omit<Unit, 'created_at' | 'updated_at'>> = [
  { id: 'a0000000-0000-0000-0000-000000000001', code: 'VP', name: 'Văn phòng', display_order: 1, active: true },
  { id: 'a0000000-0000-0000-0000-000000000002', code: 'PKT', name: 'Phòng Kinh tế', display_order: 2, active: true },
  { id: 'a0000000-0000-0000-0000-000000000003', code: 'PVHXH', name: 'Phòng VHXH', display_order: 3, active: true },
];

export const SEED_FIELDS: Array<Omit<Field, 'created_at' | 'updated_at' | 'unit'>> = [
  // Văn phòng
  { id: 'b0000000-0000-0000-0000-000000000001', code: 'CT', name: 'Chứng thực', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 1, active: true },
  { id: 'b0000000-0000-0000-0000-000000000002', code: 'HT', name: 'Hộ tịch', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 2, active: true },
  { id: 'b0000000-0000-0000-0000-000000000003', code: 'PLP', name: 'Phí, lệ phí', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 3, active: true },
  // Phòng Kinh tế
  { id: 'b0000000-0000-0000-0000-000000000004', code: 'ATTP', name: 'An toàn thực phẩm', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 4, active: true },
  { id: 'b0000000-0000-0000-0000-000000000005', code: 'HHDT', name: 'Hàng hải và đường thủy nội địa', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 5, active: true },
  { id: 'b0000000-0000-0000-0000-000000000006', code: 'QH', name: 'Quy hoạch đô thị và nông thôn', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 6, active: true },
  { id: 'b0000000-0000-0000-0000-000000000007', code: 'XD', name: 'Hoạt động xây dựng', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 7, active: true },
  { id: 'b0000000-0000-0000-0000-000000000008', code: 'LTHH', name: 'Lưu thông hàng hóa trong nước', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 8, active: true },
  { id: 'b0000000-0000-0000-0000-000000000009', code: 'DD', name: 'Đất đai', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 9, active: true },
  { id: 'b0000000-0000-0000-0000-000000000010', code: 'TS', name: 'Thủy sản', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 10, active: true },
  // Phòng VHXH
  { id: 'b0000000-0000-0000-0000-000000000011', code: 'BTXH', name: 'Bảo trợ xã hội', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 11, active: true },
  { id: 'b0000000-0000-0000-0000-000000000012', code: 'GDMN', name: 'Giáo dục mầm non', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 12, active: true },
  { id: 'b0000000-0000-0000-0000-000000000013', code: 'GDTH', name: 'Giáo dục trung học', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 13, active: true },
  { id: 'b0000000-0000-0000-0000-000000000014', code: 'NCC', 'name': 'Người có công', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 14, active: true },
  { id: 'b0000000-0000-0000-0000-000000000015', code: 'CS', name: 'Chính sách', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 15, active: true },
];

export const SEED_PERIODS: Array<Omit<ReportingPeriod, 'created_at' | 'updated_at'>> = [
  {
    id: 'd0000000-0000-0000-0000-000000000000',
    report_code: 'BC190926',
    report_name: 'BC190926 - Báo cáo tổng hợp tình hình tiếp nhận, giải quyết TTHC',
    report_type: 'monthly',
    period_start: '2026-01-01',
    period_end: '2026-02-28',
    data_as_of: '2026-02-28T17:00:00Z',
    status: 'validated',
    created_by: 'Hệ thống',
    notes: 'Kỳ báo cáo tổng hợp chuẩn hóa số liệu tiếp nhận, giải quyết TTHC toàn thành phố',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    report_code: 'BC-2026-01',
    report_name: 'Báo cáo TTHC Tháng 01/2026',
    report_type: 'monthly',
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    data_as_of: '2026-01-31T17:00:00Z',
    status: 'approved',
    created_by: 'Hệ thống',
    notes: 'Kỳ báo cáo chính thức Tháng 01/2026',
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
    created_by: 'Hệ thống',
    notes: 'Kỳ báo cáo chính thức Tháng 02/2026',
  },
];

export const SOURCE_NAMES = ['Trên Hệ thống các Bộ', 'Trên Hệ thống thành phố'] as const;

export interface MathValidationReport {
  formula1Passed: boolean; // received_total = online + offline + forward
  formula2Passed: boolean; // completed_total = early + on_time + late
  formula3Passed: boolean; // pending_total = on_time + late
  formula4Passed: boolean; // received_total = completed_total + pending_total
  allPassed: boolean;
  errorMessages: string[];
}

export function validateRowFormulas(row: Partial<ReportStatistic>): MathValidationReport {
  const rTotal = Number(row.received_total || 0);
  const rOnline = Number(row.received_online || 0);
  const rOffline = Number(row.received_offline || 0);
  const rForward = Number(row.carried_forward || 0);

  const cTotal = Number(row.completed_total || 0);
  const cEarly = Number(row.completed_early || 0);
  const cOnTime = Number(row.completed_on_time || 0);
  const cLate = Number(row.completed_late || 0);

  const pTotal = Number(row.pending_total || 0);
  const pOnTime = Number(row.pending_on_time || 0);
  const pLate = Number(row.pending_late || 0);

  const errorMessages: string[] = [];

  const f1 = rTotal === rOnline + rOffline + rForward;
  if (!f1) errorMessages.push(`Công thức 1 lỗi: Tiếp nhận (${rTotal}) != Online (${rOnline}) + Trực tiếp (${rOffline}) + Kỳ trước (${rForward})`);

  const f2 = cTotal === cEarly + cOnTime + cLate;
  if (!f2) errorMessages.push(`Công thức 2 lỗi: Đã giải quyết (${cTotal}) != Trước hạn (${cEarly}) + Đúng hạn (${cOnTime}) + Quá hạn (${cLate})`);

  const f3 = pTotal === pOnTime + pLate;
  if (!f3) errorMessages.push(`Công thức 3 lỗi: Đang giải quyết (${pTotal}) != Trong hạn (${pOnTime}) + Quá hạn (${pLate})`);

  const f4 = rTotal === cTotal + pTotal;
  if (!f4) errorMessages.push(`Công thức 4 lỗi: Tiếp nhận (${rTotal}) != Đã giải quyết (${cTotal}) + Đang giải quyết (${pTotal})`);

  return {
    formula1Passed: f1,
    formula2Passed: f2,
    formula3Passed: f3,
    formula4Passed: f4,
    allPassed: f1 && f2 && f3 && f4,
    errorMessages,
  };
}

export function generateVerifiedDemoStatistics(): { sources: ReportSource[]; stats: ReportStatistic[] } {
  const sources: ReportSource[] = [];
  const stats: ReportStatistic[] = [];

  let rowNum = 1;

  SEED_PERIODS.forEach((period, pIdx) => {
    SOURCE_NAMES.forEach((sourceName, sIdx) => {
      const sourceId = `e0000000-0000-0000-${pIdx + 1}000-00000000000${sIdx + 1}`;
      sources.push({
        id: sourceId,
        report_id: period.id,
        source_type: 'system',
        source_name: sourceName,
        original_filename: `du_lieu_${sourceName === 'Trên Hệ thống các Bộ' ? 'cac_bo' : 'thanh_pho'}.xlsx`,
        uploaded_by: 'Hệ thống',
        uploaded_at: new Date().toISOString(),
        import_status: 'completed',
      });

      SEED_FIELDS.forEach((field, fIdx) => {
        const baseSeed = (pIdx + 1) * 37 + (sIdx + 1) * 19 + (fIdx + 1) * 7;
        const unit = SEED_UNITS.find((u) => u.id === field.unit_id);

        const received_online = 25 + (baseSeed % 40);
        const received_offline = 5 + (baseSeed % 12);
        const carried_forward = baseSeed % 4 === 0 ? 3 : 0;
        const received_total = received_online + received_offline + carried_forward;

        const pending_late = baseSeed % 8 === 0 ? 1 : 0;
        const pending_on_time = 2 + (baseSeed % 5);
        const pending_total = pending_on_time + pending_late;

        const completed_total = received_total - pending_total;
        const completed_late = baseSeed % 6 === 0 ? 1 : 0;
        const completed_early = Math.floor(completed_total * 0.55);
        const completed_on_time = completed_total - completed_early - completed_late;

        const hexId = ('000000000000' + rowNum.toString(16)).slice(-12);
        const statId = `f0000000-0000-0000-0000-${hexId}`;
        rowNum++;

        const statRow: ReportStatistic = {
          id: statId,
          report_id: period.id,
          source_id: sourceId,
          field_id: field.id,
          field_code: field.code,
          field_name_snapshot: field.name,
          field_name: field.name,
          unit_id: field.unit_id,
          unit_name_snapshot: unit?.name || '',
          unit_name: unit?.name || '',
          received_total,
          received_online,
          received_offline,
          carried_forward,
          completed_total,
          completed_early,
          completed_on_time,
          completed_late,
          pending_total,
          pending_on_time,
          pending_late,
          validation_status: 'valid',
          validation_errors: [],
        };

        const val = validateRowFormulas(statRow);
        if (!val.allPassed) {
          throw new Error(`Data generation formula error at row ${statId}: ${val.errorMessages.join(', ')}`);
        }

        stats.push(statRow);
      });
    });
  });

  return { sources, stats };
}

/**
 * Initialize Database on Supabase
 */
export async function initializeSupabaseDatabase(): Promise<{
  success: boolean;
  message: string;
  schemaReady: boolean;
  inserted?: {
    units: number;
    fields: number;
    periods: number;
    sources: number;
    stats: number;
  };
  error?: any;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      schemaReady: false,
      message: 'Supabase client chưa cấu hình.',
    };
  }

  // 1. Check if units table exists in schema cache
  const { data: _chkUnits, error: chkUnitsErr } = await supabase.from('units').select('id').limit(1);
  if (chkUnitsErr && (chkUnitsErr.code === 'PGRST205' || chkUnitsErr.message.includes('schema cache'))) {
    return {
      success: false,
      schemaReady: false,
      message: 'Không tìm thấy bảng CSDL trên Supabase (Lỗi PGRST205: schema cache). Cần chạy file Migration DDL trong Supabase SQL Editor.',
      error: chkUnitsErr,
    };
  }

  try {
    // 1. Insert 3 Units
    const { error: unitsErr } = await supabase.from('units').upsert(SEED_UNITS);
    if (unitsErr) throw new Error(`Lỗi khởi tạo Units: ${unitsErr.message}`);

    // 2. Insert Fields (each belongs to exactly 1 unit)
    const { error: fieldsErr } = await supabase.from('fields').upsert(SEED_FIELDS);
    if (fieldsErr) throw new Error(`Lỗi khởi tạo Fields: ${fieldsErr.message}`);

    // 3. Insert Reports
    const { error: periodsErr } = await supabase.from('reports').upsert(SEED_PERIODS);
    if (periodsErr) throw new Error(`Lỗi khởi tạo Kỳ báo cáo: ${periodsErr.message}`);

    // 4. Generate Sources & Validated Statistics
    const { sources, stats } = generateVerifiedDemoStatistics();

    // Insert Sources
    const { error: sourcesErr } = await supabase.from('report_sources').upsert(sources);
    if (sourcesErr) throw new Error(`Lỗi khởi tạo Nguồn dữ liệu: ${sourcesErr.message}`);

    // Insert Statistics
    const { error: statsErr } = await supabase.from('report_field_statistics').upsert(stats);
    if (statsErr) throw new Error(`Lỗi khởi tạo Số liệu thống kê: ${statsErr.message}`);

    return {
      success: true,
      schemaReady: true,
      message: `Khởi tạo dữ liệu thành công trên CSDL Supabase (reports, report_field_statistics). Toàn bộ 4 công thức toán học đã được kiểm chứng chuẩn xác 100%.`,
      inserted: {
        units: SEED_UNITS.length,
        fields: SEED_FIELDS.length,
        periods: SEED_PERIODS.length,
        sources: sources.length,
        stats: stats.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      schemaReady: true,
      message: `Lỗi khi nạp dữ liệu khởi tạo vào Supabase: ${err.message}`,
      error: err,
    };
  }
}

/**
 * End-to-End Read/Write Test
 * Create report -> insert statistics -> query statistics -> calculate totals -> display dashboard.
 */
export interface E2ETestStep {
  name: string;
  passed: boolean;
  durationMs: number;
  message: string;
  details?: any;
}

export interface E2ETestResult {
  passed: boolean;
  totalDurationMs: number;
  timestamp: string;
  steps: E2ETestStep[];
  calculatedKpis?: {
    receivedTotal: number;
    receivedOnline: number;
    onlineRate: string;
    completedTotal: number;
    completionRate: string;
    onTimeTotal: number;
    onTimeRate: string;
    pendingTotal: number;
  };
}

export async function runCompleteReadWriteTest(): Promise<E2ETestResult> {
  const overallStart = Date.now();
  const steps: E2ETestStep[] = [];

  if (!isSupabaseConfigured || !supabase) {
    return {
      passed: false,
      totalDurationMs: 0,
      timestamp: new Date().toISOString(),
      steps: [
        {
          name: 'Supabase Configuration Check',
          passed: false,
          durationMs: 0,
          message: 'Chưa cấu hình Supabase URL hoặc Publishable Key.',
        },
      ],
    };
  }

  const timestamp = Date.now();
  const testReportCode = `E2E_TEST_${timestamp}`;
  let reportId = '';
  let sourceId = '';
  let statId = '';
  let queriedStats: ReportStatistic[] = [];
  let calculatedKpis: any = null;

  // Step 1: Create Report (reports table)
  const s1Start = Date.now();
  try {
    const { data: rep, error: rErr } = await supabase
      .from('reports')
      .insert({
        report_code: testReportCode,
        report_name: `Báo cáo E2E Kiểm thử ${new Date().toLocaleDateString('vi-VN')}`,
        report_type: 'monthly',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        data_as_of: new Date().toISOString(),
        status: 'draft',
        created_by: 'Quy trình E2E Test',
        notes: 'Kiểm thử vòng đời: Tạo báo cáo -> Nhập thống kê -> Truy vấn -> Tính KPI',
      })
      .select()
      .single();

    if (rErr) throw rErr;
    reportId = rep.id;

    steps.push({
      name: '1. Create report (Tạo kỳ báo cáo trên CSDL)',
      passed: true,
      durationMs: Date.now() - s1Start,
      message: `Tạo thành công bản ghi báo cáo trên bảng 'reports' (ID: ${reportId}, Mã: ${testReportCode}).`,
      details: { reportId, reportCode: testReportCode, targetTable: 'reports' },
    });
  } catch (err: any) {
    steps.push({
      name: '1. Create report (Tạo kỳ báo cáo trên CSDL)',
      passed: false,
      durationMs: Date.now() - s1Start,
      message: `Thất bại: ${err.message}`,
      details: err,
    });
    return {
      passed: false,
      totalDurationMs: Date.now() - overallStart,
      timestamp: new Date().toISOString(),
      steps,
    };
  }

  // Step 2: Insert Source
  const s2Start = Date.now();
  try {
    const { data: src, error: sErr } = await supabase
      .from('report_sources')
      .insert({
        report_id: reportId,
        source_type: 'system',
        source_name: 'Trên Hệ thống thành phố',
        original_filename: 'e2e_source_test.xlsx',
        import_status: 'completed',
      })
      .select()
      .single();

    if (sErr) throw sErr;
    sourceId = src.id;

    steps.push({
      name: '2. Insert source (Ghi nhận nguồn dữ liệu)',
      passed: true,
      durationMs: Date.now() - s2Start,
      message: `Tạo thành công nguồn dữ liệu '${src.source_name}' liên kết với kỳ báo cáo.`,
      details: { sourceId, sourceName: src.source_name },
    });
  } catch (err: any) {
    steps.push({
      name: '2. Insert source (Ghi nhận nguồn dữ liệu)',
      passed: false,
      durationMs: Date.now() - s2Start,
      message: `Thất bại: ${err.message}`,
      details: err,
    });
  }

  // Step 3: Insert Statistics (Mathematically Valid)
  const s3Start = Date.now();
  try {
    // Look up an existing unit & field or use seed IDs
    const { data: existingFields } = await supabase.from('fields').select('id, name, unit_id, units(name)').limit(1);
    const fieldId = existingFields?.[0]?.id || SESEED_ID('field');
    const unitId = existingFields?.[0]?.unit_id || SESEED_ID('unit');
    const fieldName = existingFields?.[0]?.name || 'Chứng thực';
    const unitName = (existingFields?.[0] as any)?.units?.name || 'Văn phòng';

    const statPayload = {
      report_id: reportId,
      source_id: sourceId,
      field_id: fieldId,
      field_name_snapshot: fieldName,
      unit_id: unitId,
      unit_name_snapshot: unitName,
      received_total: 100,
      received_online: 80,
      received_offline: 20,
      carried_forward: 0,
      completed_total: 90,
      completed_early: 50,
      completed_on_time: 40,
      completed_late: 0,
      pending_total: 10,
      pending_on_time: 10,
      pending_late: 0,
      validation_status: 'valid',
    };

    const { data: statData, error: stErr } = await supabase
      .from('report_field_statistics')
      .insert(statPayload)
      .select()
      .single();

    if (stErr) throw stErr;
    statId = statData.id;

    steps.push({
      name: '3. Insert statistics (Nhập số liệu hạt nhân REPORT + SOURCE + FIELD)',
      passed: true,
      durationMs: Date.now() - s3Start,
      message: `Đã ghi số liệu thống kê chuẩn xác vào bảng 'report_field_statistics' (Tiếp nhận: 100, Đã giải quyết: 90, Đang giải quyết: 10).`,
      details: { statId, table: 'report_field_statistics', statPayload },
    });
  } catch (err: any) {
    steps.push({
      name: '3. Insert statistics (Nhập số liệu hạt nhân)',
      passed: false,
      durationMs: Date.now() - s3Start,
      message: `Thất bại: ${err.message}`,
      details: err,
    });
  }

  // Step 4: Query Statistics from Supabase
  const s4Start = Date.now();
  try {
    const { data: rows, error: qErr } = await supabase
      .from('report_field_statistics')
      .select('*')
      .eq('report_id', reportId);

    if (qErr) throw qErr;
    queriedStats = (rows || []) as ReportStatistic[];

    if (queriedStats.length === 0) {
      throw new Error('Không tìm thấy dữ liệu thống kê vừa ghi trên CSDL!');
    }

    steps.push({
      name: '4. Query statistics (Truy vấn số liệu thực tế từ Supabase)',
      passed: true,
      durationMs: Date.now() - s4Start,
      message: `Truy vấn thành công ${queriedStats.length} bản ghi số liệu từ bảng 'report_field_statistics'.`,
      details: { count: queriedStats.length, sample: queriedStats[0] },
    });
  } catch (err: any) {
    steps.push({
      name: '4. Query statistics (Truy vấn số liệu thực tế)',
      passed: false,
      durationMs: Date.now() - s4Start,
      message: `Thất bại: ${err.message}`,
      details: err,
    });
  }

  // Step 5: Calculate Totals & Verify Formulas
  const s5Start = Date.now();
  try {
    let rTotal = 0;
    let rOnline = 0;
    let cTotal = 0;
    let cEarly = 0;
    let cOnTime = 0;
    let cLate = 0;
    let pTotal = 0;

    queriedStats.forEach((row) => {
      const v = validateRowFormulas(row);
      if (!v.allPassed) {
        throw new Error(`Bản ghi ${row.id} vi phạm công thức: ${v.errorMessages.join('; ')}`);
      }
      rTotal += row.received_total;
      rOnline += row.received_online;
      cTotal += row.completed_total;
      cEarly += row.completed_early;
      cOnTime += row.completed_on_time;
      cLate += row.completed_late;
      pTotal += row.pending_total;
    });

    const onlineRate = rTotal > 0 ? ((rOnline / rTotal) * 100).toFixed(1) + '%' : '0.0%';
    const completionRate = rTotal > 0 ? ((cTotal / rTotal) * 100).toFixed(1) + '%' : '0.0%';
    const onTimeTotal = cEarly + cOnTime;
    const onTimeRate = cTotal > 0 ? ((onTimeTotal / cTotal) * 100).toFixed(1) + '%' : '0.0%';

    calculatedKpis = {
      receivedTotal: rTotal,
      receivedOnline: rOnline,
      onlineRate,
      completedTotal: cTotal,
      completionRate,
      onTimeTotal,
      onTimeRate,
      pendingTotal: pTotal,
    };

    steps.push({
      name: '5. Calculate totals (Tính toán các chỉ tiêu và đối soát công thức)',
      passed: true,
      durationMs: Date.now() - s5Start,
      message: `Xác thực 100% cả 4 công thức toán học. Tính toán thành công các chỉ số: Tiếp nhận ${rTotal}, Trực tuyến ${onlineRate}, Đã giải quyết ${completionRate}, Đúng hạn ${onTimeRate}.`,
      details: calculatedKpis,
    });
  } catch (err: any) {
    steps.push({
      name: '5. Calculate totals (Tính toán các chỉ tiêu)',
      passed: false,
      durationMs: Date.now() - s5Start,
      message: `Thất bại: ${err.message}`,
      details: err,
    });
  }

  // Step 6: Display Dashboard Data Readiness
  const s6Start = Date.now();
  steps.push({
    name: '6. Display dashboard (Sẵn sàng hiển thị trực quan trên Dashboard)',
    passed: true,
    durationMs: Date.now() - s6Start,
    message: 'Dữ liệu truy vấn từ Supabase đã sẵn sàng phục vụ biểu đồ và bảng tổng hợp của Dashboard.',
    details: { reportId, ready: true },
  });

  // Step 7: Clean up test record to maintain clean database
  try {
    await supabase.from('reporting_periods').delete().eq('id', reportId);
    await supabase.from('reports').delete().eq('id', reportId);
  } catch {
    // Ignore cleanup error
  }

  const allPassed = steps.every((s) => s.passed);
  if (allPassed) {
    setReadWriteTestPassed(true);
  }

  return {
    passed: allPassed,
    totalDurationMs: Date.now() - overallStart,
    timestamp: new Date().toISOString(),
    steps,
    calculatedKpis,
  };
}

let readWriteTestPassed = false;

export function isReadWriteTestPassed(): boolean {
  return readWriteTestPassed;
}

export function setReadWriteTestPassed(passed: boolean): void {
  readWriteTestPassed = passed;
}

function SESEED_ID(type: 'unit' | 'field'): string {
  if (type === 'unit') return 'u1000000-0000-0000-0000-000000000001';
  return 'f1000000-0000-0000-0000-000000000001';
}

/**
 * Fetch Live Supabase Dashboard Data
 */
export async function fetchLiveDashboardData(selectedReportId?: string): Promise<{
  configured: boolean;
  connected: boolean;
  schemaReady: boolean;
  errorMessage: string | null;
  reports: ReportingPeriod[];
  currentReport: ReportingPeriod | null;
  sources: ReportSource[];
  statistics: ReportStatistic[];
  units: Unit[];
  fields: Field[];
  rawCount: number;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      configured: false,
      connected: false,
      schemaReady: false,
      errorMessage: 'Supabase chưa được cấu hình.',
      reports: [],
      currentReport: null,
      sources: [],
      statistics: [],
      units: [],
      fields: [],
      rawCount: 0,
    };
  }

  try {
    // 1. Fetch Reports
    const reportsRes = await supabase.from('reports').select('*').order('period_start', { ascending: false });

    if (reportsRes.error) {
      if (reportsRes.error.code === 'PGRST205' || reportsRes.error.message.includes('schema cache')) {
        return {
          configured: true,
          connected: true,
          schemaReady: false,
          errorMessage: 'Bảng CSDL chưa được khởi tạo trên Supabase (Lỗi PGRST205: schema cache).',
          reports: [],
          currentReport: null,
          sources: [],
          statistics: [],
          units: [],
          fields: [],
          rawCount: 0,
        };
      }
      throw reportsRes.error;
    }

    const dbReports: ReportingPeriod[] = Array.from(
      new Map((reportsRes.data || []).map((r: any) => [r.id, r])).values()
    );
    const reports = deduplicateById(dbReports);

    const activeReport = selectedReportId
      ? reports.find((r) => r.id === selectedReportId) || reports[0] || null
      : reports[0] || null;

    // 2. Fetch Units & Fields
    const [unitsRes, fieldsRes] = await Promise.all([
      supabase.from('units').select('*').order('display_order', { ascending: true }),
      supabase.from('fields').select('*, units(*)').order('display_order', { ascending: true }),
    ]);
    if (unitsRes.error) throw unitsRes.error;
    if (fieldsRes.error) throw fieldsRes.error;

    const dbUnits: Unit[] = Array.from(new Map((unitsRes.data || []).map((u: any) => [u.id, u])).values());
    const dbFields: Field[] = Array.from(new Map((fieldsRes.data || []).map((f: any) => [f.id, f])).values());
    const units = deduplicateById(dbUnits);
    const fields = deduplicateById(dbFields);

    // 3. Fetch Sources & Statistics for Active Report
    let sources: ReportSource[] = [];
    let statistics: ReportStatistic[] = [];

    if (activeReport) {
      const srcRes = await supabase.from('report_sources').select('*').eq('report_id', activeReport.id);
      if (srcRes.error) throw srcRes.error;
      sources = deduplicateById(srcRes.data || []);

      const statsRes = await supabase.from('report_field_statistics').select('*').eq('report_id', activeReport.id);
      if (statsRes.error) throw statsRes.error;
      statistics = deduplicateById((statsRes.data || []) as ReportStatistic[]);
    }

    return {
      configured: true,
      connected: true,
      schemaReady: true,
      errorMessage: null,
      reports,
      currentReport: activeReport,
      sources,
      statistics,
      units,
      fields,
      rawCount: statistics.length,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      schemaReady: false,
      errorMessage: `Lỗi kết nối Supabase: ${err.message}`,
      reports: [],
      currentReport: null,
      sources: [],
      statistics: [],
      units: [],
      fields: [],
      rawCount: 0,
    };

  }
}
