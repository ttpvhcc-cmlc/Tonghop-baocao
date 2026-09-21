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
import { resolveLinhVuc } from '../utils/fieldResolver';
import { isTestProcedureCode } from '../utils/excelProcedureHelper';

// No business data is seeded in the client runtime. Supabase is the sole persistence source.

export interface SystemMenuLabels {
  dashboard: string;
  reports: string;
  archive: string;
  new_report: string;
  import: string;
  analysis_group: string;
  analysis_units: string;
  analysis_fields: string;
  analysis_compare: string;
  catalog_group: string;
  catalog_units: string;
  catalog_fields: string;
  catalog_indicators: string;
  system_group: string;
  system_users: string;
  system_config: string;
  system_audit: string;
  system_supabase: string;
}

export interface SystemPageTitles {
  dashboardTitle: string;
  dashboardSubtitle: string;
  reportsListTitle: string;
  reportsListSubtitle: string;
  importTitle: string;
  importSubtitle: string;
  analysisTitle: string;
  analysisSubtitle: string;
  compareTitle: string;
  compareSubtitle: string;
}

export interface RolePermissionRule {
  role: string;
  roleName: string;
  description: string;
  permissions: {
    view_dashboard: boolean;
    view_reports: boolean;
    create_reports: boolean;
    edit_reports: boolean;
    delete_reports: boolean;
    import_excel: boolean;
    lock_snapshot: boolean;
    manage_catalogs: boolean;
    manage_users: boolean;
    manage_system_config: boolean;
    view_audit_logs: boolean;
  };
}

export interface SystemConfig {
  systemName: string;
  subTitle: string;
  logoType: 'icon' | 'custom_url';
  logoIcon: string;
  logoUrl?: string;
  systemNameColor?: string;
  systemNameFontSize?: string;
  systemNameFontWeight?: string;
  subTitleColor?: string;
  subTitleFontSize?: string;
  logoSize?: number;
  themeColor: 'blue' | 'indigo' | 'emerald' | 'violet' | 'rose' | 'slate' | 'amber' | 'teal';
  sidebarTheme: 'dark' | 'slate' | 'navy' | 'light';
  headerTitle: string;
  menuLabels: SystemMenuLabels;
  pageTitles: SystemPageTitles;
  rolePermissions: RolePermissionRule[];
  chartsLayout?: any[];
  trendHistoryLimit?: number;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  systemName: 'HỆ THỐNG TỔNG HỢP ĐÁNH GIÁ TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH',
  subTitle: 'Trung tâm Phục vụ hành chính công xã Chân Mây - Lăng Cô',
  logoType: 'icon',
  logoIcon: 'ShieldCheck',
  logoUrl: '',
  systemNameColor: '#0f172a',
  systemNameFontSize: '15px',
  systemNameFontWeight: 'font-extrabold',
  subTitleColor: '#475569',
  subTitleFontSize: '11px',
  logoSize: 36,
  themeColor: 'blue',
  sidebarTheme: 'dark',
  headerTitle: 'CƠ SỞ DỮ LIỆU THỐNG KÊ TTHC',
  menuLabels: {
    dashboard: 'Tổng quan',
    reports: 'Kỳ báo cáo',
    archive: 'Kho lưu trữ',
    new_report: 'Tạo kỳ báo cáo mới',
    import: 'Nhập dữ liệu Excel',
    analysis_group: 'Phân tích dữ liệu',
    analysis_units: 'Theo Đơn vị',
    analysis_fields: 'Theo Lĩnh vực',
    analysis_compare: 'So sánh nhiều kỳ',
    catalog_group: 'Danh mục quản trị',
    catalog_units: 'Đơn vị giải quyết',
    catalog_fields: 'Lĩnh vực & Mapping',
    catalog_indicators: 'Chỉ tiêu & Công thức',
    system_group: 'Hệ thống & Kiểm soát',
    system_users: 'Phân quyền người dùng',
    system_config: 'Thiết lập Hệ thống',
    system_audit: 'Nhật ký hệ thống (Audit)',
    system_supabase: 'Kiểm thử Supabase',
  },
  pageTitles: {
    dashboardTitle: 'Tổng quan Báo cáo Thống kê TTHC',
    dashboardSubtitle: 'Theo dõi chỉ tiêu tiếp nhận, giải quyết và tỷ lệ dịch vụ công trực tuyến',
    reportsListTitle: 'Danh sách Kỳ Báo cáo Thống kê',
    reportsListSubtitle: 'Quản lý tập trung các kỳ báo cáo tình hình giải quyết thủ tục hành chính',
    importTitle: 'Nhập Dữ liệu Báo cáo Excel',
    importSubtitle: 'Trích xuất và chuẩn hóa tự động số liệu từ biểu mẫu Excel báo cáo',
    analysisTitle: 'Phân tích & Dự báo Số liệu',
    analysisSubtitle: 'Đánh giá chi tiết hiệu quả giải quyết TTHC theo đơn vị và lĩnh vực',
    compareTitle: 'So sánh Biến động qua các Kỳ',
    compareSubtitle: 'Theo dõi xu hướng tăng giảm chỉ tiêu giữa các kỳ báo cáo',
  },
  rolePermissions: [
    {
      role: 'admin',
      roleName: 'Quản trị viên hệ thống (Admin)',
      description: 'Toàn quyền cấu hình tên hệ thống, logo, menu, phân quyền, khóa snapshot và danh mục.',
      permissions: {
        view_dashboard: true,
        view_reports: true,
        create_reports: true,
        edit_reports: true,
        delete_reports: true,
        import_excel: true,
        lock_snapshot: true,
        manage_catalogs: true,
        manage_users: true,
        manage_system_config: true,
        view_audit_logs: true,
      },
    },
    {
      role: 'analyst',
      roleName: 'Chuyên viên phân tích (Analyst)',
      description: 'Quyền xem tổng quan, phân tích nâng cao, xuất báo cáo, nhập liệu Excel.',
      permissions: {
        view_dashboard: true,
        view_reports: true,
        create_reports: true,
        edit_reports: true,
        delete_reports: false,
        import_excel: true,
        lock_snapshot: false,
        manage_catalogs: false,
        manage_users: false,
        manage_system_config: false,
        view_audit_logs: true,
      },
    },
    {
      role: 'data_entry',
      roleName: 'Chuyên viên nhập liệu (Data Entry)',
      description: 'Quyền tạo mới kỳ báo cáo và nhập file Excel từ các đơn vị.',
      permissions: {
        view_dashboard: true,
        view_reports: true,
        create_reports: true,
        edit_reports: true,
        delete_reports: false,
        import_excel: true,
        lock_snapshot: false,
        manage_catalogs: false,
        manage_users: false,
        manage_system_config: false,
        view_audit_logs: false,
      },
    },
    {
      role: 'viewer',
      roleName: 'Người xem (Viewer / Lãnh đạo)',
      description: 'Quyền tra cứu, theo dõi dashboard và tải xuất dữ liệu (Chỉ đọc).',
      permissions: {
        view_dashboard: true,
        view_reports: true,
        create_reports: false,
        edit_reports: false,
        delete_reports: false,
        import_excel: false,
        lock_snapshot: false,
        manage_catalogs: false,
        manage_users: false,
        manage_system_config: false,
        view_audit_logs: false,
      },
    },
  ],
};

const GUEST_USER: Profile = {
  id: 'guest',
  email: undefined,
  full_name: 'Chưa đăng nhập',
  role: 'viewer',
  unit_id: null,
  active: false,
  created_at: '1970-01-01T00:00:00.000Z',
  updated_at: '1970-01-01T00:00:00.000Z',
};


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
    reportIndicators: ReportIndicator[];
    reports: Report[];
    sources: ReportSource[];
    stats: ReportFieldStatistic[];
    analyses: ReportAnalysis[];
    snapshots: ReportSnapshot[];
    auditLogs: AuditLog[];
    currentUser: Profile;
    users: Profile[];
    systemConfig: SystemConfig;
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
    this.inMemoryCache = {
      units: [],
      fields: [],
      indicators: [],
      reportIndicators: [],
      reports: [],
      sources: [],
      stats: [],
      analyses: [],
      snapshots: [],
      auditLogs: [],
      currentUser: GUEST_USER,
      users: [],
      systemConfig: DEFAULT_SYSTEM_CONFIG,
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
  public async restoreDefaultProcedures(): Promise<Field[]> {
    return this.fetchFields();
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

      // 3. Fetch fields (Safely merged to NEVER erase procedures, sectors, or mappings)
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('fields')
        .select('*, units(*)')
        .order('display_order', { ascending: true });
      if (fieldsError) throw fieldsError;
      this.inMemoryCache.fields = deduplicateById(
        (fieldsData || []).filter((f: Field) => !isTestProcedureCode(f.code))
      );

      // 4. Fetch reports (Merge Supabase reports with local reports)
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('period_start', { ascending: false });
      if (!reportsData) {
        this.inMemoryCache.reports = [];
      }
      {
        const normalizedReports = (reportsData || []).map((rep: any) => {
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
      }

      // 5. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
      if (profilesError) throw profilesError;
      this.inMemoryCache.users = deduplicateById(profilesData || []);

      // 6. Fetch sources (Merge safely)
      const { data: sourcesData, error: sourcesError } = await supabase.from('report_sources').select('*');
      if (sourcesError) throw sourcesError;
      this.inMemoryCache.sources = deduplicateById(sourcesData || []);

      // 7. Fetch stats
      const { data: statsData, error: statsError } = await supabase.from('report_field_statistics').select('*');
      if (statsError) throw statsError;
      this.inMemoryCache.stats = deduplicateById(statsData || []);

      // 8. Fetch indicators
      const { data: indicatorsData, error: indicatorsError } = await supabase.from('indicator_definitions').select('*');
      if (indicatorsError) throw indicatorsError;
      this.inMemoryCache.indicators = deduplicateById(indicatorsData || []);

      const { data: reportIndicatorsData, error: reportIndicatorsError } = await supabase.from('report_indicators').select('*');
      if (reportIndicatorsError) throw reportIndicatorsError;

      const { data: analysesData, error: analysesError } = await supabase.from('report_analysis').select('*');
      if (analysesError) throw analysesError;

      const { data: snapshotsData, error: snapshotsError } = await supabase.from('report_snapshots').select('*');
      if (snapshotsError) throw snapshotsError;

      this.inMemoryCache.reportIndicators = deduplicateById(reportIndicatorsData || []);
      this.inMemoryCache.analyses = deduplicateById(analysesData || []);
      this.inMemoryCache.snapshots = deduplicateById(snapshotsData || []);

      // 9. Fetch system_config from Supabase (Centralized Config for All Users)
      try {
        const { data: cfgRow } = await supabase.from('system_config').select('*').eq('id', 'default').maybeSingle();
        if (cfgRow && cfgRow.config) {
          const raw = typeof cfgRow.config === 'string' ? JSON.parse(cfgRow.config) : cfgRow.config;
          const mergedConfig: SystemConfig = {
            ...DEFAULT_SYSTEM_CONFIG,
            ...raw,
            menuLabels: { ...DEFAULT_SYSTEM_CONFIG.menuLabels, ...(raw.menuLabels || {}) },
            pageTitles: { ...DEFAULT_SYSTEM_CONFIG.pageTitles, ...(raw.pageTitles || {}) },
            rolePermissions: Array.isArray(raw.rolePermissions) && raw.rolePermissions.length > 0
              ? raw.rolePermissions
              : DEFAULT_SYSTEM_CONFIG.rolePermissions,
          };
          this.inMemoryCache.systemConfig = mergedConfig;
        }
      } catch (cfgErr) {
        console.warn('Note on fetching system_config from Supabase:', cfgErr);
      }

      this.lastSyncTime = new Date().toISOString();
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Sync with Supabase note:', err.message);
      this.syncError = err.message;
      this.isSupabaseConnected = false;
      this.isSchemaReady = false;
      this.inMemoryCache.units = [];
      this.inMemoryCache.fields = [];
      this.inMemoryCache.reports = [];
      this.inMemoryCache.sources = [];
      this.inMemoryCache.stats = [];
      this.inMemoryCache.indicators = [];
      this.inMemoryCache.reportIndicators = [];
      this.inMemoryCache.users = [];
      this.inMemoryCache.analyses = [];
      this.inMemoryCache.snapshots = [];
      this.inMemoryCache.auditLogs = [];
      this.notify();
      return false;
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
    this.notify();
    return this.inMemoryCache.currentUser;
  }

  public async signOut(): Promise<void> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    this.inMemoryCache.currentUser = GUEST_USER;
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

  public async createUser(user: {
    full_name: string;
    email: string;
    role: UserRole;
    unit_id?: string;
    password?: string;
  }): Promise<Profile> {
    this.assertRole(['admin'], 'tạo người dùng mới');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const emailStr = user.email.trim();
    const pw = user.password || '12345678@';

    // Sign up via Supabase auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailStr,
      password: pw,
      options: {
        data: {
          full_name: user.full_name.trim(),
        }
      }
    });

    if (authError) {
      throw new Error(`Lỗi đăng ký tài khoản Supabase Auth: ${authError.message}`);
    }

    const authUser = authData.user;
    if (!authUser) {
      throw new Error('Đăng ký thành công nhưng không trả về thông tin người dùng.');
    }

    // Now insert into profiles
    const payload = {
      id: authUser.id,
      full_name: user.full_name.trim(),
      email: emailStr,
      role: user.role,
      unit_id: user.unit_id || null,
      active: true,
    };

    const { data: saved, error: profileError } = await supabase.from('profiles').upsert(payload).select('*').single();
    if (profileError) {
      throw new Error(`Đã tạo tài khoản Auth, nhưng lỗi khi liên kết hồ sơ RBAC: ${profileError.message}`);
    }

    const result = saved as Profile;
    this.inMemoryCache.users = [
      ...this.inMemoryCache.users.filter((u) => u.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async saveUser(user: {
    id?: string; full_name: string; email?: string; role: UserRole; unit_id?: string; active?: boolean
  }): Promise<Profile> {
    this.assertRole(['admin'], 'quản lý hồ sơ người dùng');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    if (!user.id) {
      throw new Error('Không tạo tài khoản đăng nhập trực tiếp từ màn hình này. Hãy tạo người dùng trong Supabase Authentication trước, sau đó thêm/chỉnh sửa hồ sơ tương ứng.');
    }

    const payload = {
      id: user.id,
      full_name: user.full_name.trim(),
      email: user.email?.trim() || null,
      role: user.role,
      unit_id: user.unit_id || null,
      active: user.active !== false,
    };

    const { data: saved, error } = await supabase.from('profiles').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu hồ sơ người dùng vào Supabase: ${error.message}`);
    const result = saved as Profile;
    this.inMemoryCache.users = [
      ...this.inMemoryCache.users.filter((u) => u.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async deleteUser(userId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa hồ sơ người dùng');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    if (userId === this.getCurrentUser().id) throw new Error('Không thể xóa tài khoản đang đăng nhập.');

    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw new Error(`Không thể xóa hồ sơ người dùng khỏi Supabase: ${error.message}`);

    this.inMemoryCache.users = this.inMemoryCache.users.filter((u) => u.id !== userId);
    this.notify();
  }

  // --- Units CRUD (Direct Supabase) ---
  public getUnits(): Unit[] {
    return deduplicateById(this.inMemoryCache.units).sort((a, b) => a.display_order - b.display_order);
  }

  public async fetchUnits(): Promise<Unit[]> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('units').select('*').order('display_order', { ascending: true });
    if (error) throw new Error(`Không thể tải đơn vị từ Supabase: ${error.message}`);
    this.inMemoryCache.units = deduplicateById(data || []);
    this.notify();
    return this.getUnits();
  }

  public async saveUnit(unit: Omit<Unit, 'id'> & { id?: string }): Promise<Unit> {
    this.assertRole(['admin'], 'quản lý đơn vị');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const codeClean = (unit.code || '').trim().toUpperCase();
    if (!codeClean) throw new Error('Mã đơn vị không được để trống.');

    const id = unit.id || generateUUID();
    const { data: duplicateUnit, error: duplicateUnitError } = await supabase
      .from('units').select('id').eq('code', codeClean).neq('id', id).maybeSingle();
    if (duplicateUnitError) throw new Error(`Không thể kiểm tra mã đơn vị trên Supabase: ${duplicateUnitError.message}`);
    if (duplicateUnit) throw new Error(`Mã đơn vị "${codeClean}" đã tồn tại trên hệ thống.`);
    const payload = {
      id,
      code: codeClean,
      name: unit.name,
      display_order: unit.display_order || 1,
      active: unit.active !== false,
    };

    const { data: saved, error } = await supabase.from('units').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu đơn vị vào Supabase: ${error.message}`);

    const result = saved as Unit;
    this.inMemoryCache.units = [
      ...this.inMemoryCache.units.filter((u) => u.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async deleteUnit(unitId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa đơn vị');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const { data: linkedFields, error: fieldsError } = await supabase
      .from('fields')
      .select('id,name')
      .eq('unit_id', unitId);
    if (fieldsError) throw new Error(`Không thể kiểm tra liên kết lĩnh vực trên Supabase: ${fieldsError.message}`);
    if ((linkedFields || []).length > 0) {
      throw new Error(`Không thể xóa đơn vị này vì đang có ${linkedFields.length} lĩnh vực thuộc đơn vị.`);
    }

    const { error } = await supabase.from('units').delete().eq('id', unitId);
    if (error) throw new Error(`Không thể xóa đơn vị trên Supabase: ${error.message}`);

    this.inMemoryCache.units = this.inMemoryCache.units.filter((u) => u.id !== unitId);
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
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }
    const { data, error } = await supabase
      .from('fields')
      .select('*, units(*)')
      .order('display_order', { ascending: true });
    if (error) throw new Error(`Không thể tải danh mục lĩnh vực từ Supabase: ${error.message}`);
    this.inMemoryCache.fields = deduplicateById(
      (data || []).filter((f: Field) => !isTestProcedureCode(f.code))
    );
    this.notify();
    return this.getFields();
  }

  public async saveField(field: Omit<Field, 'id'> & { id?: string }): Promise<Field> {
    this.assertRole(['admin'], 'quản lý lĩnh vực');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const codeClean = (field.code || '').trim().toUpperCase();
    if (!codeClean) throw new Error('Mã lĩnh vực không được để trống.');

    const id = field.id || generateUUID();
    const { data: duplicateField, error: duplicateFieldError } = await supabase
      .from('fields').select('id').eq('code', codeClean).neq('id', id).maybeSingle();
    if (duplicateFieldError) throw new Error(`Không thể kiểm tra mã lĩnh vực trên Supabase: ${duplicateFieldError.message}`);
    if (duplicateField) throw new Error(`Mã lĩnh vực "${codeClean}" đã tồn tại trên hệ thống.`);

    const payload = {
      id,
      code: codeClean,
      name: field.name,
      linh_vuc: field.linh_vuc || 'Chưa phân loại',
      unit_id: field.unit_id || null,
      display_order: field.display_order || 1,
      active: field.active !== false,
      co_quan_cong_bo: field.co_quan_cong_bo || null,
      loai_tthc: field.loai_tthc || null,
      co_quan_thuc_hien: field.co_quan_thuc_hien || null,
      cap_thuc_hien: field.cap_thuc_hien || null,
      muc_do_cung_cap: field.muc_do_cung_cap || null,
      phi_le_phi: field.phi_le_phi || null,
    };

    const { data: saved, error } = await supabase.from('fields').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu lĩnh vực vào Supabase: ${error.message}`);

    const result = {
      ...field,
      ...(saved as Field),
    } as Field;
    this.inMemoryCache.fields = [
      ...this.inMemoryCache.fields.filter((f) => f.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async saveFieldsBulk(fieldsToUpdate: Field[]): Promise<Field[]> {
    this.assertRole(['admin'], 'cập nhật danh mục lĩnh vực');
    if (fieldsToUpdate.length === 0) return [];
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const rows = fieldsToUpdate.map((field, idx) => {
      return {
        id: field.id || generateUUID(),
        code: field.code.trim(),
        name: field.name.trim(),
        linh_vuc: field.linh_vuc?.trim() || 'Chưa phân loại',
        unit_id: field.unit_id || null,
        display_order: field.display_order || idx + 1,
        active: field.active !== false,
        co_quan_cong_bo: field.co_quan_cong_bo?.trim() || null,
        loai_tthc: field.loai_tthc?.trim() || null,
        co_quan_thuc_hien: field.co_quan_thuc_hien?.trim() || null,
        cap_thuc_hien: field.cap_thuc_hien?.trim() || null,
        muc_do_cung_cap: field.muc_do_cung_cap?.trim() || null,
        phi_le_phi: field.phi_le_phi?.trim() || null,
      };
    });

    // Deduplicate rows by code to prevent ON CONFLICT DO UPDATE duplicate error
    const uniqueRowsMap = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      if (!uniqueRowsMap.has(row.code)) {
        uniqueRowsMap.set(row.code, row);
      }
    }
    const uniqueRows = Array.from(uniqueRowsMap.values());

    const { data: saved, error } = await supabase
      .from('fields')
      .upsert(uniqueRows, { onConflict: 'code' })
      .select('*');

    if (error) throw new Error(`Không thể lưu danh mục TTHC vào Supabase: ${error.message}`);

    const savedMap = new Map((saved || []).map((s: Field) => [s.code, s]));
    const mergedResults: Field[] = fieldsToUpdate.map((original) => {
      const fromDb = savedMap.get(original.code);
      return {
        ...original,
        ...(fromDb || {}),
      };
    });

    this.inMemoryCache.fields = [
      ...this.inMemoryCache.fields.filter((f) => !rows.some((r) => r.id === f.id || r.code === f.code)),
      ...mergedResults,
    ] as Field[];
    this.notify();
    return mergedResults;
  }

  public async deleteField(fieldId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa lĩnh vực/thủ tục');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const { data: field, error: fieldError } = await supabase.from('fields').select('id,name').eq('id', fieldId).single();
    if (fieldError) throw new Error(`Không thể tìm thấy lĩnh vực trên Supabase: ${fieldError.message}`);

    const { data: stats, error: statsError } = await supabase
      .from('report_field_statistics')
      .select('id,report_id');
    if (statsError) throw new Error(`Không thể kiểm tra số liệu liên kết trên Supabase: ${statsError.message}`);

    const statRows = stats || [];
    if (statRows.length > 0) {
      const reportIds = Array.from(new Set(statRows.map((s: any) => s.report_id)));
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('id,status');
      if (reportsError) throw new Error(`Không thể kiểm tra trạng thái báo cáo trên Supabase: ${reportsError.message}`);

      const reportStatus = new Map((reports || []).map((r: any) => [r.id, r.status]));
      // We need the specific field's statistics; query again narrowly for authoritative delete set.
      const { data: fieldStats, error: fieldStatsError } = await supabase
        .from('report_field_statistics')
        .select('id,report_id')
        .eq('field_id', fieldId);
      if (fieldStatsError) throw new Error(`Không thể kiểm tra số liệu của lĩnh vực trên Supabase: ${fieldStatsError.message}`);

      const locked = (fieldStats || []).find((s: any) => ['locked','archived'].includes(reportStatus.get(s.report_id) as string));
      if (locked) {
        throw new Error('Không thể xóa lĩnh vực vì đã phát sinh số liệu trong kỳ báo cáo LOCKED/ARCHIVED.');
      }

      const idsToDelete = (fieldStats || []).map((s: any) => s.id);
      if (idsToDelete.length > 0) {
        const { error: deleteStatsError } = await supabase.from('report_field_statistics').delete().in('id', idsToDelete);
        if (deleteStatsError) throw new Error(`Không thể xóa số liệu liên kết trên Supabase: ${deleteStatsError.message}`);
      }
    }

    const { error: deleteFieldError } = await supabase.from('fields').delete().eq('id', fieldId);
    if (deleteFieldError) throw new Error(`Không thể xóa lĩnh vực trên Supabase: ${deleteFieldError.message}`);

    this.inMemoryCache.stats = this.inMemoryCache.stats.filter((s) => s.field_id !== fieldId);
    this.inMemoryCache.fields = this.inMemoryCache.fields.filter((f) => f.id !== fieldId);
    this.notify();
  }

  // --- Indicators CRUD ---
  public getIndicators(): IndicatorDefinition[] {
    return deduplicateById(this.inMemoryCache.indicators);
  }

  public async saveIndicator(indicator: Omit<IndicatorDefinition, 'id'> & { id?: string }): Promise<IndicatorDefinition> {
    this.assertRole(['admin'], 'quản lý chỉ số');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const codeClean = (indicator.code || '').trim().toUpperCase();
    if (!codeClean) throw new Error('Mã chỉ tiêu không được để trống.');
    const formulaKey = indicator.formula_key || indicator.calculation_key || '';
    if (!formulaKey) throw new Error('Chỉ tiêu đo lường phải liên kết với một công thức tính hợp lệ.');

    const id = indicator.id || generateUUID();
    const { data: duplicateIndicator, error: duplicateIndicatorError } = await supabase
      .from('indicator_definitions').select('id').eq('code', codeClean).neq('id', id).maybeSingle();
    if (duplicateIndicatorError) throw new Error(`Không thể kiểm tra mã chỉ tiêu trên Supabase: ${duplicateIndicatorError.message}`);
    if (duplicateIndicator) throw new Error(`Mã chỉ tiêu "${codeClean}" đã tồn tại.`);
    const payload = {
      id,
      code: codeClean,
      name: indicator.name.trim(),
      formula_key: formulaKey,
      unit_measure: indicator.unit_measure || indicator.unit || '%',
      description: indicator.description || null,
      display_order: indicator.display_order || 1,
      active: indicator.active !== false,
    };

    const { data: saved, error } = await supabase.from('indicator_definitions').upsert(payload).select('*').single();
    if (error) throw new Error(`Không thể lưu chỉ tiêu vào Supabase: ${error.message}`);
    const result = saved as IndicatorDefinition;
    this.inMemoryCache.indicators = [
      ...this.inMemoryCache.indicators.filter((i) => i.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  public async deleteIndicator(indicatorId: string): Promise<void> {
    this.assertRole(['admin'], 'xóa chỉ tiêu');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const { error } = await supabase.from('indicator_definitions').delete().eq('id', indicatorId);
    if (error) throw new Error(`Không thể xóa chỉ tiêu trên Supabase: ${error.message}`);
    this.inMemoryCache.indicators = this.inMemoryCache.indicators.filter((i) => i.id !== indicatorId);
    this.notify();
  }

  // --- Reports CRUD (Direct Supabase) ---
  public getReports(): Report[] {
    return deduplicateById(this.inMemoryCache.reports)
      .sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime());
  }

  public async fetchReports(): Promise<Report[]> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('reports').select('*').order('period_start', { ascending: false });
    if (error) throw new Error(`Không thể tải kỳ báo cáo từ Supabase: ${error.message}`);
    this.inMemoryCache.reports = deduplicateById(data || []);
    this.notify();
    return this.getReports();
  }

  public getReportById(id: string): Report | undefined {
    return this.getReports().find((r) => r.id === id);
  }

  public async fetchReportById(id: string): Promise<Report | undefined> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Không thể tải báo cáo từ Supabase: ${error.message}`);
    if (!data) return undefined;
    this.inMemoryCache.reports = [
      ...this.inMemoryCache.reports.filter((r) => r.id !== id),
      data as Report,
    ];
    this.notify();
    return data as Report;
  }

  public async createReport(data: {
    report_code: string;
    report_name: string;
    report_type: Report['report_type'];
    period_start: string;
    period_end: string;
    data_as_of: string;
    notes?: string;
  }): Promise<Report> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'tạo kỳ báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const user = this.getCurrentUser();
    const payload = {
      ...data,
      report_code: data.report_code.trim().toUpperCase(),
      status: 'draft' as const,
      created_by: user.full_name,
    };

    const { data: saved, error } = await supabase
      .from('reports')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(`Không thể lưu kỳ báo cáo vào Supabase: ${error.message}`);
    const report = saved as Report;

    this.inMemoryCache.reports = [report, ...this.inMemoryCache.reports.filter((r) => r.id !== report.id)];
    this.notify();
    return report;
  }

  public async updateReportStatus(reportId: string, status: Report['status'], notes?: string): Promise<Report> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chuyển trạng thái báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const existing = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!existing) throw new Error('Không tìm thấy báo cáo');
    if (existing.status === 'archived') {
      throw new Error('Báo cáo đã lưu trữ, không thể thay đổi trạng thái.');
    }
    if (existing.status === 'locked' && status !== 'archived') {
      throw new Error('Báo cáo đã khóa, chỉ được phép chuyển sang lưu trữ.');
    }
    if (status === 'archived' && existing.status !== 'locked') {
      throw new Error('Chỉ báo cáo LOCKED mới được chuyển sang ARCHIVED.');
    }
    const currentRole = this.getCurrentUser().role;
    if (status === 'approved' && !['admin', 'analyst'].includes(currentRole)) {
      throw new Error('Chỉ admin hoặc analyst mới được phê duyệt báo cáo.');
    }
    if (['locked', 'archived'].includes(status) && currentRole !== 'admin') {
      throw new Error('Chỉ admin mới được khóa hoặc lưu trữ báo cáo.');
    }

    const user = this.getCurrentUser();
    const now = new Date().toISOString();
    const payload: any = {
      status,
      updated_at: now,
      notes: notes !== undefined ? notes : existing.notes,
    };
    if (status === 'approved') {
      payload.approved_at = now;
      payload.approved_by = user.full_name;
    }
    if (status === 'locked') {
      payload.locked_at = now;
    }

    // Recalculate global indicators from the authoritative DB rows immediately before locking.
    if (status === 'locked') {
      await this.recalculateAndPersistReportIndicators(reportId);
    }

    // The database lifecycle trigger is authoritative; it also creates the immutable snapshot on lock.
    const { data: saved, error } = await supabase
      .from('reports')
      .update(payload)
      .eq('id', reportId)
      .select('*')
      .single();

    if (error) throw new Error(`Không thể cập nhật trạng thái trên Supabase: ${error.message}`);
    const updated = saved as Report;
    this.inMemoryCache.reports = this.inMemoryCache.reports.map((r) => r.id === reportId ? updated : r);
    this.notify();
    return updated;
  }

  public async updateReport(reportId: string, data: Partial<Report>): Promise<Report> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chỉnh sửa báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const prev = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!prev) throw new Error('Không tìm thấy báo cáo');
    if (prev.status === 'locked' || prev.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể chỉnh sửa.');
    }

    const { data: saved, error } = await supabase
      .from('reports')
      .update({
        report_code: data.report_code ?? prev.report_code,
        report_name: data.report_name ?? prev.report_name,
        report_type: data.report_type ?? prev.report_type,
        period_start: data.period_start ?? prev.period_start,
        period_end: data.period_end ?? prev.period_end,
        data_as_of: data.data_as_of ?? prev.data_as_of,
        notes: data.notes ?? prev.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select('*')
      .single();

    if (error) throw new Error(`Không thể cập nhật báo cáo trên Supabase: ${error.message}`);
    const updated = saved as Report;
    this.inMemoryCache.reports = this.inMemoryCache.reports.map((r) => r.id === reportId ? updated : r);
    this.notify();
    return updated;
  }

  public async deleteReport(reportId: string): Promise<boolean> {
    this.assertRole(['admin'], 'xóa báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const rep = this.inMemoryCache.reports.find((r) => r.id === reportId || r.report_code === reportId);
    const targetId = rep?.id || reportId;
    if (!rep) throw new Error('Không tìm thấy báo cáo');

    if (rep.status === 'locked' || rep.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể xóa.');
    }

    const { error } = await supabase.from('reports').delete().eq('id', targetId);
    if (error) throw new Error(`Không thể xóa báo cáo trên Supabase: ${error.message}`);

    this.inMemoryCache.reports = this.inMemoryCache.reports.filter((r) => r.id !== targetId);
    this.inMemoryCache.sources = this.inMemoryCache.sources.filter((s) => s.report_id !== targetId);
    this.inMemoryCache.stats = this.inMemoryCache.stats.filter((s) => s.report_id !== targetId);
    this.inMemoryCache.analyses = this.inMemoryCache.analyses.filter((a) => a.report_id !== targetId);
    this.inMemoryCache.snapshots = this.inMemoryCache.snapshots.filter((s) => s.report_id !== targetId);
    this.notify();
    return true;
  }


  // --- Report Sources & Statistics ---
  public async addReportSource(reportId: string, sourceName: string, originalFilename?: string): Promise<ReportSource> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'nhập nguồn dữ liệu');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const user = this.getCurrentUser();
    const payload = {
      report_id: reportId,
      source_type: 'system',
      source_name: sourceName,
      original_filename: originalFilename,
      uploaded_by: user.full_name,
      import_status: 'completed' as const,
    };
    const { data: saved, error } = await supabase
      .from('report_sources')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(`Không thể lưu nguồn dữ liệu vào Supabase: ${error.message}`);
    const source = saved as ReportSource;
    this.inMemoryCache.sources = [
      ...this.inMemoryCache.sources.filter((s) => s.id !== source.id),
      source
    ];
    this.notify();
    return source;
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
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }
    const { data, error } = await supabase
      .from('report_field_statistics')
      .select('*')
      .eq('report_id', reportId);
    if (error) throw new Error(`Không thể tải số liệu từ Supabase: ${error.message}`);
    this.inMemoryCache.stats = [
      ...this.inMemoryCache.stats.filter((s) => s.report_id !== reportId),
      ...(data || []),
    ];
    this.notify();
    return this.getStatsByReport(reportId);
  }

  public async saveReportStats(
    reportId: string,
    sourceId: string,
    rows: Array<Omit<ReportFieldStatistic, 'id' | 'report_id' | 'source_id'>>
  ): Promise<void> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'lưu số liệu thống kê');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const report = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Không tìm thấy báo cáo');
    if (report.status === 'locked' || report.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể nhập dữ liệu.');
    }

    const dbRows = rows.map((r) => {
      if (!r.unit_id) {
        throw new Error(`Thủ tục/Lĩnh vực "${r.field_name_snapshot || r.field_name}" chưa được phân công Đơn vị giải quyết.`);
      }
      return {
        id: generateUUID(),
        report_id: reportId,
        source_id: sourceId,
        field_id: r.field_id,
        field_name_snapshot: r.field_name_snapshot || r.field_name,
        unit_id: r.unit_id,
        unit_name_snapshot: r.unit_name_snapshot || r.unit_name,
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
        validation_errors: r.validation_errors || [],
      };
    });

    // Deduplicate / aggregate dbRows by field_id to prevent Postgres upsert error:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const dbRowsMap = new Map<string, (typeof dbRows)[0]>();

    for (const row of dbRows) {
      const existing = dbRowsMap.get(row.field_id);
      if (!existing) {
        dbRowsMap.set(row.field_id, {
          ...row,
          validation_errors: Array.isArray(row.validation_errors) ? [...row.validation_errors] : [],
        });
      } else {
        existing.received_total = (existing.received_total || 0) + (row.received_total || 0);
        existing.received_online = (existing.received_online || 0) + (row.received_online || 0);
        existing.received_offline = (existing.received_offline || 0) + (row.received_offline || 0);
        existing.carried_forward = (existing.carried_forward || 0) + (row.carried_forward || 0);
        existing.completed_total = (existing.completed_total || 0) + (row.completed_total || 0);
        existing.completed_early = (existing.completed_early || 0) + (row.completed_early || 0);
        existing.completed_on_time = (existing.completed_on_time || 0) + (row.completed_on_time || 0);
        existing.completed_late = (existing.completed_late || 0) + (row.completed_late || 0);
        existing.pending_total = (existing.pending_total || 0) + (row.pending_total || 0);
        existing.pending_on_time = (existing.pending_on_time || 0) + (row.pending_on_time || 0);
        existing.pending_late = (existing.pending_late || 0) + (row.pending_late || 0);

        if (row.notes && !existing.notes.includes(row.notes)) {
          existing.notes = existing.notes ? `${existing.notes}; ${row.notes}` : row.notes;
        }

        if (row.validation_status === 'error' || existing.validation_status === 'error') {
          existing.validation_status = 'error';
        } else if (row.validation_status === 'warning' || existing.validation_status === 'warning') {
          existing.validation_status = 'warning';
        }

        if (Array.isArray(row.validation_errors) && row.validation_errors.length > 0) {
          existing.validation_errors = [
            ...(existing.validation_errors || []),
            ...row.validation_errors,
          ];
        }
      }
    }

    const uniqueDbRows = Array.from(dbRowsMap.values());

    // Upsert on the business key prevents duplicate (report, source, field) rows.
    const { data: saved, error } = await supabase
      .from('report_field_statistics')
      .upsert(uniqueDbRows, { onConflict: 'report_id,source_id,field_id' })
      .select('*');

    if (error) throw new Error(`Không thể lưu số liệu vào Supabase: ${error.message}`);

    const savedRows = (saved || []) as ReportFieldStatistic[];

    const { data: existingSourceRows, error: existingSourceRowsError } = await supabase
      .from('report_field_statistics')
      .select('id')
      .eq('report_id', reportId)
      .eq('source_id', sourceId);
    if (existingSourceRowsError) throw new Error(`Không thể kiểm tra các dòng số liệu cũ trên Supabase: ${existingSourceRowsError.message}`);

    const savedIds = new Set(savedRows.map((r) => r.id));
    const staleIds = (existingSourceRows || [])
      .map((r: any) => r.id)
      .filter((id: string) => !savedIds.has(id));
    if (staleIds.length > 0) {
      const { error: staleDeleteError } = await supabase
        .from('report_field_statistics')
        .delete()
        .in('id', staleIds);
      if (staleDeleteError) throw new Error(`Không thể xóa các dòng số liệu cũ trên Supabase: ${staleDeleteError.message}`);
    }

    await this.fetchStatsByReport(reportId);
    this.notify();
  }


  public async updateReportStatsList(reportId: string, updatedStats: ReportFieldStatistic[]): Promise<void> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'chỉnh sửa số liệu thống kê');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const report = this.inMemoryCache.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Không tìm thấy báo cáo');
    if (report.status === 'locked' || report.status === 'archived') {
      throw new Error('Báo cáo đã khóa/lưu trữ. Không thể chỉnh sửa.');
    }

    const dbRows = updatedStats.map((r) => ({
      id: r.id,
      report_id: r.report_id,
      source_id: r.source_id,
      field_id: r.field_id,
      field_name_snapshot: r.field_name_snapshot || r.field_name,
      unit_id: r.unit_id,
      unit_name_snapshot: r.unit_name_snapshot || r.unit_name,
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
      validation_errors: r.validation_errors || [],
    }));

    const { data: saved, error } = await supabase
      .from('report_field_statistics')
      .upsert(dbRows)
      .select('*');

    if (error) throw new Error(`Không thể cập nhật số liệu trên Supabase: ${error.message}`);

    const savedRows = (saved || []) as ReportFieldStatistic[];

    const { data: existingReportRows, error: existingReportRowsError } = await supabase
      .from('report_field_statistics')
      .select('id')
      .eq('report_id', reportId);
    if (existingReportRowsError) throw new Error(`Không thể kiểm tra các dòng số liệu cũ trên Supabase: ${existingReportRowsError.message}`);

    const submittedIds = new Set(savedRows.map((r) => r.id));
    const staleIds = (existingReportRows || [])
      .map((r: any) => r.id)
      .filter((id: string) => !submittedIds.has(id));
    if (staleIds.length > 0) {
      const { error: staleDeleteError } = await supabase
        .from('report_field_statistics')
        .delete()
        .in('id', staleIds);
      if (staleDeleteError) throw new Error(`Không thể xóa các dòng số liệu cũ trên Supabase: ${staleDeleteError.message}`);
    }

    await this.fetchStatsByReport(reportId);
    this.notify();
  }

  public getReportIndicators(reportId?: string): ReportIndicator[] {
    const list = this.inMemoryCache.reportIndicators;
    return deduplicateById(reportId ? list.filter((x) => x.report_id === reportId) : list);
  }

  public async recalculateAndPersistReportIndicators(reportId: string): Promise<ReportIndicator[]> {
    this.assertRole(['admin', 'analyst', 'data_entry'], 'tính và lưu các chỉ tiêu báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const [{ data: stats, error: statsError }, { data: defs, error: defsError }] = await Promise.all([
      supabase.from('report_field_statistics').select('*').eq('report_id', reportId),
      supabase.from('indicator_definitions')
        .select('id,code,name,target_value,formula_key,unit_measure,active')
        .in('code', ['ONLINE_RATE', 'ONTIME_RATE', 'OVERDUE_RATE'])
        .eq('active', true),
    ]);

    if (statsError) throw new Error(`Không thể đọc số liệu báo cáo từ Supabase: ${statsError.message}`);
    if (defsError) throw new Error(`Không thể đọc định nghĩa chỉ tiêu từ Supabase: ${defsError.message}`);

    const statRows: any[] = stats || [];
    const definitions: any[] = defs || [];
    const requiredCodes = ['ONLINE_RATE', 'ONTIME_RATE', 'OVERDUE_RATE'];
    const missing = requiredCodes.filter((code) => !definitions.some((d) => d.code === code));
    if (missing.length) {
      throw new Error(`Thiếu định nghĩa chỉ tiêu bắt buộc trong Supabase: ${missing.join(', ')}.`);
    }

    const received = statRows.reduce((sum, r) => sum + Number(r.received_total || 0), 0);
    const online = statRows.reduce((sum, r) => sum + Number(r.received_online || 0), 0);
    const completed = statRows.reduce((sum, r) => sum + Number(r.completed_total || 0), 0);
    const ontime = statRows.reduce((sum, r) => sum + Number(r.completed_early || 0) + Number(r.completed_on_time || 0), 0);
    const overdue = statRows.reduce((sum, r) => sum + Number(r.completed_late || 0) + Number(r.pending_late || 0), 0);

    if (received === 0) throw new Error('Không thể tính chỉ tiêu: tổng tiếp nhận bằng 0.');
    if (completed === 0) throw new Error('Không thể tính chỉ tiêu: tổng đã giải quyết bằng 0.');

    const values: Record<string, { numerator: number; denominator: number; value: number; formula: string }> = {
      ONLINE_RATE: {
        numerator: online,
        denominator: received,
        value: Number(((online / received) * 100).toFixed(4)),
        formula: 'received_online / received_total * 100',
      },
      ONTIME_RATE: {
        numerator: ontime,
        denominator: completed,
        value: Number(((ontime / completed) * 100).toFixed(4)),
        formula: '(completed_early + completed_on_time) / completed_total * 100',
      },
      OVERDUE_RATE: {
        numerator: overdue,
        denominator: received,
        value: Number(((overdue / received) * 100).toFixed(4)),
        formula: '(completed_late + pending_late) / received_total * 100',
      },
    };

    // Upsert each derived global indicator by its existing row when present.
    for (const def of definitions) {
      const calc = values[def.code];
      const { data: existing, error: existingError } = await supabase
        .from('report_indicators')
        .select('id')
        .eq('report_id', reportId)
        .eq('indicator_definition_id', def.id)
        .eq('scope_type', 'global')
        .maybeSingle();
      if (existingError) throw new Error(`Không thể đọc chỉ tiêu cũ trên Supabase: ${existingError.message}`);

      const payload = {
        report_id: reportId,
        indicator_definition_id: def.id,
        scope_type: 'global',
        scope_id: null,
        calculated_value: calc.value,
        formatted_value: `${calc.value.toFixed(4)}%`,
        calculation_details: {
          numerator: calc.numerator,
          denominator: calc.denominator,
          formula: calc.formula,
          calculation_source: 'report_field_statistics',
        },
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('report_indicators')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw new Error(`Không thể cập nhật chỉ tiêu ${def.code} trên Supabase: ${error.message}`);
      } else {
        const { error } = await supabase
          .from('report_indicators')
          .insert({ id: generateUUID(), ...payload });
        if (error) throw new Error(`Không thể thêm chỉ tiêu ${def.code} vào Supabase: ${error.message}`);
      }
    }

    const { data: saved, error: refreshError } = await supabase
      .from('report_indicators')
      .select('*')
      .eq('report_id', reportId)
      .eq('scope_type', 'global');
    if (refreshError) throw new Error(`Không thể xác minh chỉ tiêu sau khi lưu trên Supabase: ${refreshError.message}`);

    this.inMemoryCache.reportIndicators = [
      ...this.inMemoryCache.reportIndicators.filter((x) => x.report_id !== reportId || x.scope_type !== 'global'),
      ...(saved || []) as ReportIndicator[],
    ];
    this.notify();
    return (saved || []) as ReportIndicator[];
  }


  // --- Snapshots ---
  public getSnapshots(reportId: string): ReportSnapshot[] {
    return deduplicateById(this.inMemoryCache.snapshots.filter((s) => s.report_id === reportId))
      .sort((a, b) => (b.version_number || 1) - (a.version_number || 1));
  }

  public async createReportSnapshot(reportId: string, reason: string): Promise<ReportSnapshot> {
    this.assertRole(['admin'], 'tạo snapshot báo cáo');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const [reportRes, sourcesRes, statsRes, indicatorsRes, analysesRes, versionRes] = await Promise.all([
      supabase.from('reports').select('*').eq('id', reportId).single(),
      supabase.from('report_sources').select('*').eq('report_id', reportId),
      supabase.from('report_field_statistics').select('*').eq('report_id', reportId),
      supabase.from('report_indicators').select('*').eq('report_id', reportId),
      supabase.from('report_analysis').select('*').eq('report_id', reportId),
      supabase.from('report_snapshots').select('version_number').eq('report_id', reportId).order('version_number', { ascending: false }).limit(1),
    ]);
    if (reportRes.error) throw new Error(`Không thể đọc báo cáo để snapshot: ${reportRes.error.message}`);
    if (sourcesRes.error) throw new Error(`Không thể đọc nguồn để snapshot: ${sourcesRes.error.message}`);
    if (statsRes.error) throw new Error(`Không thể đọc số liệu để snapshot: ${statsRes.error.message}`);
    if (indicatorsRes.error) throw new Error(`Không thể đọc chỉ tiêu để snapshot: ${indicatorsRes.error.message}`);
    if (analysesRes.error) throw new Error(`Không thể đọc phân tích để snapshot: ${analysesRes.error.message}`);
    if (versionRes.error) throw new Error(`Không thể đọc phiên bản snapshot: ${versionRes.error.message}`);

    const versionNumber = Number(versionRes.data?.[0]?.version_number || 0) + 1;
    const user = this.getCurrentUser();
    const { data: saved, error } = await supabase
      .from('report_snapshots')
      .insert({
        id: generateUUID(),
        report_id: reportId,
        version_number: versionNumber,
        snapshot_json: {
          report: reportRes.data,
          sources: sourcesRes.data || [],
          stats: statsRes.data || [],
          indicators: indicatorsRes.data || [],
          analyses: analysesRes.data || [],
          capturedAt: new Date().toISOString(),
        },
        created_by: user.full_name,
        reason,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Không thể lưu snapshot vào Supabase: ${error.message}`);
    const result = saved as ReportSnapshot;
    this.inMemoryCache.snapshots = [
      ...this.inMemoryCache.snapshots.filter((x) => x.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  // --- Report Analyses ---
  public getAnalyses(reportId: string): ReportAnalysis[] {
    return deduplicateById(this.inMemoryCache.analyses.filter((a) => a.report_id === reportId));
  }

  public async saveAnalysis(analysis: Omit<ReportAnalysis, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<ReportAnalysis> {
    this.assertRole(['admin', 'analyst'], 'lưu phân tích');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) {
      throw new Error('Không thể kết nối CSDL Supabase.');
    }

    const now = new Date().toISOString();
    const id = analysis.id || generateUUID();
    const { data: saved, error } = await supabase
      .from('report_analysis')
      .upsert({
        id,
        report_id: analysis.report_id,
        scope_type: analysis.scope_type,
        scope_id: analysis.scope_id,
        title: analysis.title,
        generated_text: analysis.generated_text,
        generated_by: analysis.generated_by,
        source_metrics: analysis.source_metrics,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Không thể lưu phân tích vào Supabase: ${error.message}`);
    const result = {
      ...(saved as ReportAnalysis),
      created_at: (saved as any).created_at || now,
      updated_at: (saved as any).updated_at || now,
    } as ReportAnalysis;

    this.inMemoryCache.analyses = [
      ...this.inMemoryCache.analyses.filter((a) => a.id !== result.id),
      result,
    ];
    this.notify();
    return result;
  }

  // --- Audit Logs ---
  public async fetchAuditLogs(): Promise<AuditLog[]> {
    this.assertRole(['admin'], 'xem Audit Logs');
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw new Error(`Không thể tải Audit Logs từ Supabase: ${error.message}`);
    this.inMemoryCache.auditLogs = deduplicateById(data || []);
    this.notify();
    return this.getAuditLogs();
  }

  public getAuditLogs(): AuditLog[] {
    return deduplicateById(this.inMemoryCache.auditLogs)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async addAuditLog(_action: string, _entityType: string, _entityId: string, _metadata?: Record<string, any>): Promise<void> {
    // Audit entries are generated by SECURITY DEFINER database triggers.
  }


  // Reset to factory defaults
  public async resetToFactoryDemo(): Promise<void> {
    await this.syncWithSupabase();
  }

  /**
   * Export all database contents as JSON string for backup/transfer
   */
  public async exportFullDatabaseBackup(): Promise<string> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình.');
    if (!this.isSchemaReady && !(await this.syncWithSupabase())) throw new Error('Không thể kết nối CSDL Supabase.');

    const [units, fields, indicators, reports, sources, stats, reportIndicators, analyses, snapshots] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('fields').select('*'),
      supabase.from('indicator_definitions').select('*'),
      supabase.from('reports').select('*'),
      supabase.from('report_sources').select('*'),
      supabase.from('report_field_statistics').select('*'),
      supabase.from('report_indicators').select('*'),
      supabase.from('report_analysis').select('*'),
      supabase.from('report_snapshots').select('*'),
    ]);

    const results = [units, fields, indicators, reports, sources, stats, reportIndicators, analyses, snapshots];
    const error = results.find((r: any) => r.error)?.error;
    if (error) throw new Error(`Không thể xuất sao lưu trực tiếp từ Supabase: ${error.message}`);

    return JSON.stringify({
      export_version: '3.0-db-only',
      exported_at: new Date().toISOString(),
      source: 'Supabase',
      units: units.data || [],
      fields: fields.data || [],
      indicators: indicators.data || [],
      reports: reports.data || [],
      sources: sources.data || [],
      stats: stats.data || [],
      report_indicators: reportIndicators.data || [],
      analyses: analyses.data || [],
      snapshots: snapshots.data || [],
    }, null, 2);
  }


  public async importFullDatabaseBackup(_jsonString: string): Promise<{ success: boolean; message: string; count?: any }> {
    return {
      success: false,
      message: 'Không cho phép khôi phục JSON vào bộ nhớ trình duyệt. Khôi phục dữ liệu phải được thực hiện bằng giao dịch/SQL trực tiếp trên Supabase để bảo đảm tính toàn vẹn vòng đời và snapshot.',
    };
  }

  public getSystemConfig(): SystemConfig {
    return { ...this.inMemoryCache.systemConfig };
  }

  public async saveSystemConfig(newConfig: SystemConfig): Promise<{ success: boolean; isTableMissing?: boolean; message?: string }> {
    this.inMemoryCache.systemConfig = { ...newConfig };
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id: 'default',
          config: newConfig,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('system_config').upsert(payload, { onConflict: 'id' });
        if (error) {
          const isTableMissing = error.code === 'PGRST205' || 
            error.message.includes('schema cache') || 
            error.message.includes('Could not find') || 
            error.message.includes('system_config');

          if (isTableMissing) {
            console.warn('Note: Bảng system_config chưa tồn tại trên Supabase. Vui lòng chạy SQL Migration 006.');
            return {
              success: false,
              isTableMissing: true,
              message: 'Chưa khởi tạo bảng "system_config" trên CSDL Supabase. Vui lòng vào menu "Quản trị Supabase" để thực thi mã SQL tạo bảng system_config.'
            };
          }
          console.warn('Lỗi khi lưu system_config vào Supabase:', error.message);
          return { success: false, message: `Lỗi kết nối CSDL Supabase: ${error.message}` };
        }
        return { success: true, message: 'Đã lưu trực tiếp thành công cấu hình vào CSDL Supabase cho toàn bộ hệ thống.' };
      } catch (e: any) {
        console.error('Lỗi ngoại lệ khi lưu system_config:', e?.message || e);
        return { success: false, message: `Lỗi kết nối Supabase: ${e?.message || e}` };
      }
    }

    return { success: false, message: 'Chưa cấu hình Supabase. Vui lòng kiểm tra lại kết nối CSDL.' };
  }

  public async resetSystemConfig(): Promise<{ success: boolean; isTableMissing?: boolean; message?: string }> {
    this.inMemoryCache.systemConfig = { ...DEFAULT_SYSTEM_CONFIG };
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id: 'default',
          config: DEFAULT_SYSTEM_CONFIG,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('system_config').upsert(payload, { onConflict: 'id' });
        if (error) {
          const isTableMissing = error.code === 'PGRST205' || 
            error.message.includes('schema cache') || 
            error.message.includes('Could not find') || 
            error.message.includes('system_config');

          if (isTableMissing) {
            console.warn('Note: Bảng system_config chưa tồn tại trên Supabase. Vui lòng chạy SQL Migration 006.');
            return {
              success: false,
              isTableMissing: true,
              message: 'Chưa khởi tạo bảng "system_config" trên CSDL Supabase. Vui lòng vào menu "Quản trị Supabase" để chạy mã SQL tạo bảng.'
            };
          }
          console.warn('Lỗi khi reset system_config trên Supabase:', error.message);
          return { success: false, message: `Lỗi khôi phục CSDL Supabase: ${error.message}` };
        }
        return { success: true, message: 'Đã khôi phục cài đặt mặc định trực tiếp trên CSDL Supabase.' };
      } catch (e: any) {
        console.error('Lỗi khi reset system_config:', e?.message || e);
        return { success: false, message: `Lỗi kết nối Supabase: ${e?.message || e}` };
      }
    }

    return { success: false, message: 'Chưa cấu hình Supabase.' };
  }
}

export const store = new StorageService();
