import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Unit, Field, ReportingPeriod, ReportSource, ReportStatistic } from '../types/database';
import { deduplicateById } from './store';

export interface MathValidationReport {
  formula1Passed: boolean; // received_total = online + offline + forward
  formula2Passed: boolean; // completed_total = early + on_time + late
  formula3Passed: boolean; // pending_total = on_time + late
  formula4Passed: boolean; // received_total = completed_total + pending_total
  allPassed: boolean;
  errorMessages: string[];
}

/**
 * Validates mathematical consistency across 4 core public administration rules:
 * 1. received_total = received_online + received_offline + carried_forward
 * 2. completed_total = completed_early + completed_on_time + completed_late
 * 3. pending_total = pending_on_time + pending_late
 * 4. received_total = completed_total + pending_total
 */
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
  if (!f1) {
    errorMessages.push(`Công thức 1 lỗi: Tiếp nhận (${rTotal}) != Online (${rOnline}) + Trực tiếp (${rOffline}) + Kỳ trước (${rForward})`);
  }

  const f2 = cTotal === cEarly + cOnTime + cLate;
  if (!f2) {
    errorMessages.push(`Công thức 2 lỗi: Đã giải quyết (${cTotal}) != Trước hạn (${cEarly}) + Đúng hạn (${cOnTime}) + Quá hạn (${cLate})`);
  }

  const f3 = pTotal === pOnTime + pLate;
  if (!f3) {
    errorMessages.push(`Công thức 3 lỗi: Đang giải quyết (${pTotal}) != Trong hạn (${pOnTime}) + Quá hạn (${pLate})`);
  }

  const f4 = rTotal === cTotal + pTotal;
  if (!f4) {
    errorMessages.push(`Công thức 4 lỗi: Tiếp nhận (${rTotal}) != Đã giải quyết (${cTotal}) + Đang giải quyết (${pTotal})`);
  }

  return {
    formula1Passed: f1,
    formula2Passed: f2,
    formula3Passed: f3,
    formula4Passed: f4,
    allPassed: f1 && f2 && f3 && f4,
    errorMessages,
  };
}

/**
 * Fetch Live Supabase Dashboard Data directly from PostgreSQL tables.
 * Returns empty arrays when tables are empty — NEVER generates mock/seed data.
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
      errorMessage: 'Supabase chưa được cấu hình biến môi trường VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.',
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
    // 1. Fetch Reports from Supabase
    const reportsRes = await supabase
      .from('reports')
      .select('*')
      .order('period_start', { ascending: false });

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

    // 2. Fetch Units & Fields directly from Supabase
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
      const [srcRes, statsRes] = await Promise.all([
        supabase.from('report_sources').select('*').eq('report_id', activeReport.id),
        supabase.from('report_field_statistics').select('*').eq('report_id', activeReport.id),
      ]);
      if (srcRes.error) throw srcRes.error;
      if (statsRes.error) throw statsRes.error;

      sources = deduplicateById(srcRes.data || []);
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
