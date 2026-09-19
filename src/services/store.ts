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

const SEED_FIELDS: Field[] = [
  { id: 'b0000000-0000-0000-0000-000000000001', code: 'CT', name: 'Chứng thực', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 1, active: true },
  { id: 'b0000000-0000-0000-0000-000000000002', code: 'HT', name: 'Hộ tịch', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 2, active: true },
  { id: 'b0000000-0000-0000-0000-000000000003', code: 'PLP', name: 'Phí, lệ phí', unit_id: 'a0000000-0000-0000-0000-000000000001', display_order: 3, active: true },

  { id: 'b0000000-0000-0000-0000-000000000004', code: 'ATTP', name: 'An toàn thực phẩm', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 4, active: true },
  { id: 'b0000000-0000-0000-0000-000000000005', code: 'HHDT', name: 'Hàng hải và đường thủy nội địa', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 5, active: true },
  { id: 'b0000000-0000-0000-0000-000000000006', code: 'QH', name: 'Quy hoạch đô thị và nông thôn', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 6, active: true },
  { id: 'b0000000-0000-0000-0000-000000000007', code: 'XD', name: 'Hoạt động xây dựng', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 7, active: true },
  { id: 'b0000000-0000-0000-0000-000000000008', code: 'LTHH', name: 'Lưu thông hàng hóa trong nước', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 8, active: true },
  { id: 'b0000000-0000-0000-0000-000000000009', code: 'DD', name: 'Đất đai', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 9, active: true },
  { id: 'b0000000-0000-0000-0000-000000000010', code: 'TS', name: 'Thủy sản', unit_id: 'a0000000-0000-0000-0000-000000000002', display_order: 10, active: true },

  { id: 'b0000000-0000-0000-0000-000000000011', code: 'BTXH', name: 'Bảo trợ xã hội', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 11, active: true },
  { id: 'b0000000-0000-0000-0000-000000000012', code: 'GDMN', name: 'Giáo dục mầm non', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 12, active: true },
  { id: 'b0000000-0000-0000-0000-000000000013', code: 'GDTH', name: 'Giáo dục trung học', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 13, active: true },
  { id: 'b0000000-0000-0000-0000-000000000014', code: 'NCC', name: 'Người có công', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 14, active: true },
  { id: 'b0000000-0000-0000-0000-000000000015', code: 'CS', name: 'Chính sách', unit_id: 'a0000000-0000-0000-0000-000000000003', display_order: 15, active: true },
];

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
];

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

  constructor() {
    this.inMemoryCache = {
      units: deduplicateById(this.getLocal(STORAGE_KEYS.UNITS, SEED_UNITS)),
      fields: deduplicateById(this.getLocal(STORAGE_KEYS.FIELDS, SEED_FIELDS)),
      indicators: deduplicateById(this.getLocal(STORAGE_KEYS.INDICATORS, SEED_INDICATORS)),
      reports: deduplicateById(this.getLocal(STORAGE_KEYS.REPORTS, SEED_REPORTS)),
      sources: deduplicateById(this.getLocal(STORAGE_KEYS.SOURCES, SEED_SOURCES)),
      stats: deduplicateById(this.getLocal(STORAGE_KEYS.STATS, [])),
      analyses: deduplicateById(this.getLocal(STORAGE_KEYS.ANALYSES, [])),
      snapshots: deduplicateById(this.getLocal(STORAGE_KEYS.SNAPSHOTS, [])),
      auditLogs: deduplicateById(this.getLocal(STORAGE_KEYS.AUDIT_LOGS, [])),
      currentUser: this.getLocal(STORAGE_KEYS.CURRENT_USER, SEED_CURRENT_USER),
      users: deduplicateById(this.getLocal(STORAGE_KEYS.USERS, SEED_USERS)),
    };

    // Auto-sync with Supabase
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.syncWithSupabase();
      }, 100);
    }
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

  private getLocal<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed)) {
        return deduplicateById(parsed) as unknown as T;
      }
      return parsed;
    } catch {
      return defaultValue;
    }
  }

  private setLocal<T>(key: string, value: T): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (Array.isArray(value)) {
        localStorage.setItem(key, JSON.stringify(deduplicateById(value)));
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn('Storage setLocal error:', e);
    }
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

      // If units exist in Supabase, load them
      if (unitsData && unitsData.length > 0) {
        this.inMemoryCache.units = deduplicateById(unitsData);
        this.setLocal(STORAGE_KEYS.UNITS, this.inMemoryCache.units);
      } else {
        // Seed initial units to Supabase
        await this.seedSupabaseTables();
      }

      // 3. Fetch fields
      const { data: fieldsData } = await supabase
        .from('fields')
        .select('*, units(*)')
        .order('display_order', { ascending: true });
      if (fieldsData) {
        this.inMemoryCache.fields = deduplicateById(fieldsData);
        this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
      }

      // 4. Fetch reports
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('period_start', { ascending: false });
      if (reportsData) {
        this.inMemoryCache.reports = deduplicateById(reportsData);
        this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
      }

      // 5. Fetch sources
      const { data: sourcesData } = await supabase.from('report_sources').select('*');
      if (sourcesData) {
        this.inMemoryCache.sources = deduplicateById(sourcesData);
        this.setLocal(STORAGE_KEYS.SOURCES, this.inMemoryCache.sources);
      }

      // 6. Fetch stats
      const { data: statsData } = await supabase.from('report_field_statistics').select('*');
      if (statsData) {
        this.inMemoryCache.stats = deduplicateById(statsData);
        this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);
      }

      // 7. Fetch indicators
      const { data: indicatorsData } = await supabase.from('indicator_definitions').select('*');
      if (indicatorsData && indicatorsData.length > 0) {
        this.inMemoryCache.indicators = deduplicateById(indicatorsData);
        this.setLocal(STORAGE_KEYS.INDICATORS, this.inMemoryCache.indicators);
      }

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

  public getUsers(): Profile[] {
    return deduplicateById(this.inMemoryCache.users);
  }

  public saveUser(user: { id?: string; full_name: string; email?: string; role: UserRole; unit_id?: string; active?: boolean }): Profile {
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
        if (error) console.error('Supabase saveUser error:', error);
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
        if (error) console.error('Supabase deleteUser error:', error);
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
        if (error) console.error('Supabase saveUnit error:', error);
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
        if (error) console.error('Supabase deleteUnit error:', error);
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
      if (!error && data) {
        this.inMemoryCache.fields = deduplicateById(data);
        this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
        this.notify();
        return this.getFields();
      }
    }
    return this.getFields();
  }

  public saveField(field: Omit<Field, 'id'> & { id?: string }): Field {
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

    // Persist to Supabase
    if (supabase && this.isSchemaReady) {
      supabase.from('fields').upsert({
        id,
        code: newField.code,
        name: field.name,
        unit_id: field.unit_id,
        display_order: field.display_order || 1,
        active: field.active !== false,
        co_quan_cong_bo: field.co_quan_cong_bo || null,
        loai_tthc: field.loai_tthc || null,
        co_quan_thuc_hien: field.co_quan_thuc_hien || null,
        cap_thuc_hien: field.cap_thuc_hien || null,
        muc_do_cung_cap: field.muc_do_cung_cap || null,
        phi_le_phi: field.phi_le_phi || null,
        linh_vuc: field.linh_vuc || null,
      }).then(({ error }) => {
        if (error) console.error('Supabase saveField error:', error);
      });
    }

    this.notify();
    return newField;
  }

  public saveFieldsBulk(fieldsToUpdate: Field[]): void {
    if (fieldsToUpdate.length === 0) return;

    // Update in-memory cache
    fieldsToUpdate.forEach((updatedField) => {
      const idx = this.inMemoryCache.fields.findIndex((f) => f.id === updatedField.id);
      if (idx !== -1) {
        this.inMemoryCache.fields[idx] = { ...this.inMemoryCache.fields[idx], ...updatedField };
      }
    });

    this.setLocal(STORAGE_KEYS.FIELDS, this.inMemoryCache.fields);
    this.addAuditLog('BULK_UPDATE_FIELDS_UNIT', 'fields', `${fieldsToUpdate.length} fields updated`);

    // Sync with Supabase
    if (supabase && this.isSchemaReady) {
      const rows = fieldsToUpdate.map(field => ({
        id: field.id,
        code: field.code,
        name: field.name,
        unit_id: field.unit_id,
        display_order: field.display_order || 1,
        active: field.active !== false,
        co_quan_cong_bo: field.co_quan_cong_bo || null,
        loai_tthc: field.loai_tthc || null,
        co_quan_thuc_hien: field.co_quan_thuc_hien || null,
        cap_thuc_hien: field.cap_thuc_hien || null,
        muc_do_cung_cap: field.muc_do_cung_cap || null,
        phi_le_phi: field.phi_le_phi || null,
        linh_vuc: field.linh_vuc || null,
      }));

      supabase.from('fields').upsert(rows).then(({ error }) => {
        if (error) console.error('Supabase saveFieldsBulk error:', error);
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
          if (error) console.error('Supabase delete cascaded stats error:', error);
          
          // Now delete the field
          supabase.from('fields').delete().eq('id', fieldId).then(({ error: fieldErr }) => {
            if (fieldErr) console.error('Supabase deleteField error:', fieldErr);
          });
        });
      } else {
        supabase.from('fields').delete().eq('id', fieldId).then(({ error }) => {
          if (error) console.error('Supabase deleteField error:', error);
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
        if (error) console.error('Supabase saveIndicator error:', error);
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
        if (error) console.error('Supabase deleteIndicator error:', error);
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
        if (error) console.error('Supabase createReport error:', error);
      });
    }

    this.notify();
    return newReport;
  }

  public updateReportStatus(reportId: string, status: Report['status'], notes?: string): Report {
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
        if (error) console.error('Supabase updateReportStatus error:', error);
      });
    }

    this.notify();
    return updated;
  }

  public updateReport(reportId: string, data: Partial<Report>): Report {
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
        if (error) console.error('Supabase updateReport error:', error);
      });
    }

    this.notify();
    return updated;
  }

  public deleteReport(reportId: string): void {
    this.inMemoryCache.reports = this.inMemoryCache.reports.filter((r) => r.id !== reportId);
    this.inMemoryCache.sources = this.inMemoryCache.sources.filter((s) => s.report_id !== reportId);
    this.inMemoryCache.stats = this.inMemoryCache.stats.filter((s) => s.report_id !== reportId);
    this.setLocal(STORAGE_KEYS.REPORTS, this.inMemoryCache.reports);
    this.setLocal(STORAGE_KEYS.SOURCES, this.inMemoryCache.sources);
    this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);

    if (supabase && this.isSchemaReady) {
      supabase.from('reports').delete().eq('id', reportId).then(({ error }) => {
        if (error) console.error('Supabase deleteReport error:', error);
      });
    }
    this.notify();
  }

  // --- Report Sources & Statistics ---
  public getSourcesByReport(reportId: string): ReportSource[] {
    return deduplicateById(this.inMemoryCache.sources.filter((s) => s.report_id === reportId));
  }

  public addReportSource(reportId: string, sourceName: string, originalFilename?: string): ReportSource {
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
        if (error) console.error('Supabase addReportSource error:', error);
      });
    }

    this.notify();
    return newSource;
  }

  public getStatsByReport(reportId: string): ReportFieldStatistic[] {
    return deduplicateById(this.inMemoryCache.stats.filter((s) => s.report_id === reportId));
  }

  public async fetchStatsByReport(reportId: string): Promise<ReportFieldStatistic[]> {
    if (supabase && this.isSchemaReady) {
      const { data, error } = await supabase.from('report_field_statistics').select('*').eq('report_id', reportId);
      if (!error && data) {
        // Merge into active stats
        this.inMemoryCache.stats = [
          ...this.inMemoryCache.stats.filter((s) => s.report_id !== reportId),
          ...data,
        ];
        this.setLocal(STORAGE_KEYS.STATS, this.inMemoryCache.stats);
        this.notify();
        return data;
      }
    }
    return this.getStatsByReport(reportId);
  }

  public saveReportStats(
    reportId: string, 
    sourceId: string, 
    rows: Array<Omit<ReportFieldStatistic, 'id' | 'report_id' | 'source_id'>>
  ): void {
    const report = this.getReportById(reportId);
    if (report?.status === 'locked') {
      throw new Error('Báo cáo đã bị khóa. Không được phép chỉnh sửa hoặc nhập đè dữ liệu.');
    }

    // Remove existing rows for this (report_id, source_id)
    this.inMemoryCache.stats = this.inMemoryCache.stats.filter(
      (s) => !(s.report_id === reportId && s.source_id === sourceId)
    );

    const newRows: ReportFieldStatistic[] = rows.map((r, idx) => ({
      ...r,
      id: generateUUID(),
      report_id: reportId,
      source_id: sourceId,
    }));

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
            notes: r.notes,
            validation_status: r.validation_status,
            validation_errors: r.validation_errors,
          }));

          return supabase.from('report_field_statistics').insert(dbRows);
        })
        .then(({ error }: any) => {
          if (error) console.error('Supabase saveReportStats error:', error);
        });
    }

    this.notify();
  }

  public updateReportStatsList(reportId: string, updatedStats: ReportFieldStatistic[]): void {
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
        notes: r.notes,
        validation_status: r.validation_status,
        validation_errors: r.validation_errors,
      }));

      supabase
        .from('report_field_statistics')
        .upsert(dbRows)
        .then(({ error }: any) => {
          if (error) console.error('Supabase updateReportStatsList error:', error);
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
        if (error) console.error('Supabase createReportSnapshot error:', error);
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
        if (error) console.error('Supabase saveAnalysis error:', error);
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
        if (error) console.error('Supabase addAuditLog error:', error);
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
}

export const store = new StorageService();
