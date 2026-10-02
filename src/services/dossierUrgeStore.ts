import {
  DossierUrgeRecord,
  UrgeFilterCriteria,
  UnitUrgeSummary,
  ProcessorUrgeSummary,
  UrgeKPIStats,
} from '../types/dossierUrge';
import { sanitizePrivacyContent } from '../utils/privacySanitizer';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const getSortTimestamp = (r: DossierUrgeRecord): number => {
  if (r.reception_time) {
    const parts = r.reception_time.match(/(\d+)\/(\d+)\/(\d+)/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      let year = parseInt(parts[3], 10);
      if (year < 100) year += 2000;
      
      let hour = 12; // default midday to avoid timezone edge cases
      let min = 0;
      const timeParts = r.reception_time.match(/\s+(\d+):(\d+)/);
      if (timeParts) {
        hour = parseInt(timeParts[1], 10);
        min = parseInt(timeParts[2], 10);
      }
      return new Date(year, month, day, hour, min).getTime();
    }
  }
  return new Date(r.created_at).getTime();
};

/**
 * Chuẩn hóa tên đơn vị chủ trì theo đúng danh mục Đơn vị giải quyết chính thức.
 * Tránh việc cùng một đơn vị nhưng bị tách làm hai dòng (như 'Kinh tế' và 'Phòng Kinh tế').
 */
export const normalizeUnitName = (rawUnit?: string): string => {
  if (!rawUnit) return 'Chưa phân loại đơn vị';
  const trimmed = rawUnit.trim();
  const lower = trimmed.toLowerCase();

  // Biến thể của Phòng Kinh tế
  if (
    lower === 'kinh tế' ||
    lower === 'kinh te' ||
    lower === 'phòng kinh tế' ||
    lower === 'phong kinh te' ||
    lower === 'pkt' ||
    lower.includes('kinh tế') ||
    lower.includes('kinh te')
  ) {
    return 'Phòng Kinh tế';
  }

  // Biến thể của Phòng Văn hóa - Xã hội
  if (
    lower === 'văn hóa - xã hội' ||
    lower === 'van hoa - xa hoi' ||
    lower === 'phòng văn hóa - xã hội' ||
    lower === 'phong van hoa - xa hoi' ||
    lower === 'phòng vhxh' ||
    lower === 'phong vhxh' ||
    lower === 'vhxh' ||
    lower === 'pvhxh' ||
    lower === 'văn hóa' ||
    lower === 'van hoa' ||
    lower.includes('văn hóa') ||
    lower.includes('van hoa') ||
    lower.includes('xã hội') ||
    lower.includes('xa hoi')
  ) {
    return 'Phòng Văn hóa - Xã hội';
  }

  // Biến thể của Văn phòng
  if (
    lower === 'văn phòng' ||
    lower === 'van phong' ||
    lower === 'vp' ||
    lower.includes('văn phòng') ||
    lower.includes('van phong')
  ) {
    return 'Văn phòng';
  }

  return trimmed;
};

const STORAGE_KEY = 'tthc_dossier_urges_v1';

export const INITIAL_SAMPLE_URGES: DossierUrgeRecord[] = [];

type UrgeListener = () => void;

class DossierUrgeStore {
  private records: DossierUrgeRecord[] = [];
  private listeners: Set<UrgeListener> = new Set();
  private deletedIdentifiers: Set<string> = new Set();

  public isSupabaseConnected: boolean = false;
  public isSyncing: boolean = false;
  public lastSyncTime: string | null = null;
  public syncError: string | null = null;
  private hasDossierUrgesTable: boolean = false;

  constructor() {
    // Không sử dụng localStorage - xóa bỏ triệt để cache cũ trên trình duyệt để tránh khôi phục nhầm bản ghi đã xóa
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // Ignored
      }

      // Tải trực tiếp dữ liệu từ CSDL Supabase
      setTimeout(() => {
        void this.syncWithSupabase();
        this.setupRealtimeSubscription();
      }, 0);

      window.addEventListener('focus', () => {
        void this.syncWithSupabase();
      });

      window.addEventListener('online', () => {
        void this.syncWithSupabase();
      });
    }
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Urge listener error:', e);
      }
    });
  }

  public subscribe(listener: UrgeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Tải và đồng bộ trực tiếp từ Database (Supabase) - Không lưu/đọc qua localStorage
   * Áp dụng cơ chế Danh sách đen (Tombstones Blacklist) ngăn chặn triệt để bản ghi đã xóa hồi sinh.
   */
  public async syncWithSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      this.isSupabaseConnected = false;
      return false;
    }

    this.isSyncing = true;
    this.notify();

    try {
      // 0. Nạp danh sách các phiếu đã bị xóa vĩnh viễn (Tombstones Blacklist) từ Supabase
      try {
        const { data: delRow } = await supabase
          .from('system_config')
          .select('*')
          .eq('id', 'dossier_urges_deleted')
          .maybeSingle();

        if (delRow && Array.isArray(delRow.config)) {
          delRow.config.forEach((item: string) => {
            if (item) this.deletedIdentifiers.add(item);
          });
        }
      } catch (delErr) {
        console.warn('Lỗi đọc danh mục phiếu đã xóa:', delErr);
      }

      const isDeletedRecord = (r: any): boolean => {
        if (!r) return true;
        if (r.id && this.deletedIdentifiers.has(r.id)) return true;
        if (r.ticket_code && this.deletedIdentifiers.has(r.ticket_code)) return true;
        return false;
      };

      // 1. Thử truy vấn bảng riêng dossier_urges nếu có
      const { data: tableData, error: tableError } = await supabase
        .from('dossier_urges')
        .select('*')
        .order('created_at', { ascending: false });

      if (!tableError && tableData) {
        this.hasDossierUrgesTable = true;
        this.isSupabaseConnected = true;
        this.syncError = null;
        const cleanList = (tableData || [])
          .filter((r: any) => r && r.id && !r.id.startsWith('urge_seed_') && !/^urge_00[1-9]/.test(r.id))
          .filter((r: any) => !isDeletedRecord(r))
          .map((r: any) => ({
            ...r,
            assigned_unit: normalizeUnitName(r.assigned_unit),
          }));
        this.records = this.migrateTicketCodes(cleanList);
      } else {
        // 2. Fallback sang bảng lưu cấu hình hệ thống system_config (dòng id = 'dossier_urges')
        this.hasDossierUrgesTable = false;
        const { data: cfgRow, error: cfgError } = await supabase
          .from('system_config')
          .select('*')
          .eq('id', 'dossier_urges')
          .maybeSingle();

        if (!cfgError) {
          this.isSupabaseConnected = true;
          this.syncError = null;
          const remoteList: DossierUrgeRecord[] = (cfgRow && Array.isArray(cfgRow.config)) ? cfgRow.config : [];
          const cleanList = remoteList
            .filter((r: any) => r && r.id && !r.id.startsWith('urge_seed_') && !/^urge_00[1-9]/.test(r.id))
            .filter((r: any) => !isDeletedRecord(r))
            .map((r: any) => ({
              ...r,
              assigned_unit: normalizeUnitName(r.assigned_unit),
            }));
          this.records = this.migrateTicketCodes(cleanList);

          // Nếu phát hiện trong CSDL vẫn còn bản ghi đã bị xóa, tự động làm sạch dứt điểm
          if (remoteList.length > cleanList.length) {
            void supabase.from('system_config').upsert({
              id: 'dossier_urges',
              config: cleanList,
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          this.syncError = cfgError.message;
          this.isSupabaseConnected = false;
        }
      }

      this.lastSyncTime = new Date().toISOString();
      return true;
    } catch (err: any) {
      console.warn('Lỗi tải hồ sơ đôn đốc từ Supabase:', err);
      this.syncError = err.message || 'Lỗi kết nối CSDL Supabase';
      this.isSupabaseConnected = false;
      return false;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Đẩy danh sách bản ghi trực tiếp lên Supabase (CSDL trung tâm)
   */
  public async pushToSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      if (this.hasDossierUrgesTable) {
        try {
          await supabase.from('dossier_urges').upsert(this.records);
        } catch (e) {
          console.warn('dossier_urges table upsert:', e);
        }
      }

      // Luôn ghi trực tiếp vào system_config đảm bảo tính toàn vẹn
      const { error } = await supabase.from('system_config').upsert({
        id: 'dossier_urges',
        config: this.records,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      this.lastSyncTime = new Date().toISOString();
      this.isSupabaseConnected = true;
      this.syncError = null;
    } catch (err: any) {
      console.error('Lỗi ghi đôn đốc lên Supabase:', err);
      this.syncError = err.message;
      throw err;
    }
  }

  /**
   * Thiết lập lắng nghe Realtime thay đổi từ các phiên làm việc khác
   */
  private setupRealtimeSubscription() {
    if (typeof window === 'undefined' || !isSupabaseConfigured || !supabase) return;

    try {
      supabase
        .channel('dossier_urges_realtime_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_config', filter: 'id=eq.dossier_urges' },
          (payload: any) => {
            if (payload?.new && Array.isArray(payload.new.config)) {
              const isDeletedRecord = (r: any): boolean => {
                if (!r) return true;
                if (r.id && this.deletedIdentifiers.has(r.id)) return true;
                if (r.ticket_code && this.deletedIdentifiers.has(r.ticket_code)) return true;
                return false;
              };

              const cleaned = payload.new.config
                .filter((r: any) => r && r.id && !r.id.startsWith('urge_seed_') && !/^urge_00[1-9]/.test(r.id))
                .filter((r: any) => !isDeletedRecord(r))
                .map((r: any) => ({
                  ...r,
                  assigned_unit: normalizeUnitName(r.assigned_unit),
                }));
              this.records = this.migrateTicketCodes(cleaned);
              this.lastSyncTime = new Date().toISOString();
              this.notify();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_config', filter: 'id=eq.dossier_urges_deleted' },
          (payload: any) => {
            if (payload?.new && Array.isArray(payload.new.config)) {
              payload.new.config.forEach((item: string) => {
                if (item) this.deletedIdentifiers.add(item);
              });
              this.records = this.records.filter((r) => !this.deletedIdentifiers.has(r.id) && (!r.ticket_code || !this.deletedIdentifiers.has(r.ticket_code)));
              this.notify();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dossier_urges' },
          () => {
            void this.syncWithSupabase();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Lỗi khởi tạo Realtime cho hồ sơ đôn đốc:', err);
    }
  }

  /**
   * Lấy toàn bộ danh sách bản ghi đôn đốc
   */
  public getRecords(): DossierUrgeRecord[] {
    return this.getUrges();
  }

  /**
   * Lấy toàn bộ danh sách đôn đốc kèm bộ lọc đa tiêu chí
   */
  public getUrges(criteria?: Partial<UrgeFilterCriteria>): DossierUrgeRecord[] {
    let list = [...this.records];

    if (!criteria) {
      return list.sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
    }

    // 1. Tìm kiếm chuỗi tự do (Mã hồ sơ, Tên công dân, Thủ tục, Cán bộ thụ lý, Đơn vị, Ghi chú)
    if (criteria.searchQuery && criteria.searchQuery.trim()) {
      const q = criteria.searchQuery.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.dossier_code.toLowerCase().includes(q) ||
          r.citizen_name.toLowerCase().includes(q) ||
          r.procedure_name.toLowerCase().includes(q) ||
          (r.processor_name && r.processor_name.toLowerCase().includes(q)) ||
          r.assigned_unit.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q)) ||
          (r.original_content && r.original_content.toLowerCase().includes(q))
      );
    }

    // 2. Kênh tiếp nhận
    if (criteria.channel && criteria.channel !== 'all') {
      list = list.filter((r) => r.channel === criteria.channel);
    }

    // 3. Đơn vị chủ trì
    if (criteria.assignedUnit && criteria.assignedUnit !== 'all') {
      const targetUnit = normalizeUnitName(criteria.assignedUnit);
      list = list.filter((r) => normalizeUnitName(r.assigned_unit) === targetUnit);
    }

    // 4. Người thụ lý
    if (criteria.processorName && criteria.processorName !== 'all') {
      list = list.filter((r) => r.processor_name === criteria.processorName);
    }

    // 5. Trạng thái xử lý
    if (criteria.status && criteria.status !== 'all') {
      list = list.filter((r) => r.status === criteria.status);
    }

    // 6. Mức độ khẩn
    if (criteria.urgency && criteria.urgency !== 'all') {
      list = list.filter((r) => r.urgency === criteria.urgency);
    }

    // 7. Tiêu chí tần suất: Đôn đốc lần đầu (1 lần) vs Đôn đốc nhiều lần (>= 2 lần)
    if (criteria.urgeFrequency) {
      if (criteria.urgeFrequency === 'first_time') {
        list = list.filter((r) => r.urge_count === 1);
      } else if (criteria.urgeFrequency === 'multiple') {
        list = list.filter((r) => r.urge_count >= 2);
      }
    }

    // 8. Khoảng thời gian (Lọc dựa trên Cột Ngày đôn đốc thông qua getSortTimestamp)
    if (criteria.timeRange && criteria.timeRange !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      if (criteria.timeRange === 'today') {
        list = list.filter((r) => getSortTimestamp(r) >= startOfDay);
      } else if (criteria.timeRange === '7days') {
        const sevenDaysAgo = startOfDay - 7 * 24 * 60 * 60 * 1000;
        list = list.filter((r) => getSortTimestamp(r) >= sevenDaysAgo);
      } else if (criteria.timeRange === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        list = list.filter((r) => getSortTimestamp(r) >= startOfMonth);
      } else if (criteria.timeRange === 'this_quarter') {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1).getTime();
        list = list.filter((r) => getSortTimestamp(r) >= startOfQuarter);
      } else if (criteria.timeRange === 'custom') {
        if (criteria.startDate) {
          const sTime = new Date(`${criteria.startDate}T00:00:00`).getTime();
          list = list.filter((r) => getSortTimestamp(r) >= sTime);
        }
        if (criteria.endDate) {
          const eTime = new Date(`${criteria.endDate}T23:59:59`).getTime();
          list = list.filter((r) => getSortTimestamp(r) <= eTime);
        }
      }
    }

    return list.sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
  }

  /**
   * Lấy thông tin đôn đốc theo ID
   */
  public getUrgeById(id: string): DossierUrgeRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /**
   * Lấy lịch sử đôn đốc của một mã hồ sơ cụ thể (sắp xếp theo thứ tự lần đôn đốc)
   */
  public getDossierUrgeHistory(dossierCode: string): DossierUrgeRecord[] {
    const code = dossierCode.trim().toLowerCase();
    return this.records
      .filter((r) => r.dossier_code.trim().toLowerCase() === code)
      .sort((a, b) => a.urge_count - b.urge_count);
  }

  /**
   * Tính số lần hồ sơ này đã được đôn đốc trước đó
   */
  public getUrgeCountForDossier(dossierCode: string): number {
    const history = this.getDossierUrgeHistory(dossierCode);
    return history.length;
  }

  private getYYMMDDKey(receptionTime?: string, createdAt?: string): string {
    let d = new Date();
    if (receptionTime) {
      const parts = receptionTime.match(/(\d+)\/(\d+)\/(\d+)/);
      if (parts) {
        const day = parts[1].padStart(2, '0');
        const month = parts[2].padStart(2, '0');
        let year = parts[3];
        if (year.includes(' ')) {
          year = year.split(' ')[0];
        }
        const yy = year.length === 4 ? year.slice(-2) : year.padStart(2, '0');
        return `${yy}${month}${day}`;
      }
    }
    if (createdAt) {
      d = new Date(createdAt);
    }
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }

  private generateTicketCode(receptionTime?: string, dateKey?: string, existingList?: DossierUrgeRecord[]): string {
    const key = dateKey || this.getYYMMDDKey(receptionTime);
    const listToCheck = existingList || this.records;
    const prefix = `TB-${key}-`;
    const matchRecords = listToCheck.filter(r => r.ticket_code && r.ticket_code.startsWith(prefix));
    
    let maxSeq = 0;
    matchRecords.forEach(r => {
      if (r.ticket_code) {
        const parts = r.ticket_code.split('-');
        if (parts.length === 3) {
          const seqNum = parseInt(parts[2], 10);
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(3, '0');
    return `${prefix}${seqStr}`;
  }

  private migrateTicketCodes(records: DossierUrgeRecord[]): DossierUrgeRecord[] {
    const sorted = [...records].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const migrated: DossierUrgeRecord[] = [];
    
    sorted.forEach((r) => {
      const isNewFormat = r.ticket_code && /^TB-\d{6}-\d{3}$/.test(r.ticket_code);
      if (!isNewFormat) {
        const dateKey = this.getYYMMDDKey(r.reception_time, r.created_at);
        r.ticket_code = this.generateTicketCode(r.reception_time, dateKey, migrated);
      }
      migrated.push(r);
    });

    return migrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Thêm một bản ghi đôn đốc mới và tự động lưu vào Supabase
   */
  public createUrge(data: Omit<DossierUrgeRecord, 'id' | 'created_at' | 'urge_count'> & { urge_count?: number }): DossierUrgeRecord {
    const currentCount = this.getUrgeCountForDossier(data.dossier_code);
    const urgeNumber = data.urge_count || currentCount + 1;

    const { original_content, proposal, ...cleanedData } = data as any;

    const newRecord: DossierUrgeRecord = {
      ...cleanedData,
      id: `urge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ticket_code: data.ticket_code || this.generateTicketCode(data.reception_time),
      assigned_unit: normalizeUnitName(data.assigned_unit),
      urge_count: urgeNumber,
      status: data.status || 'pending',
      urgency: data.urgency || (urgeNumber >= 2 ? 'express' : 'normal'),
      created_at: new Date().toISOString(),
    };

    this.records.unshift(newRecord);
    this.notify();
    void this.pushToSupabase();
    return newRecord;
  }

  /**
   * Cập nhật bản ghi đôn đốc và đồng bộ lên Supabase
   */
  public updateUrge(id: string, updates: Partial<DossierUrgeRecord>): DossierUrgeRecord | null {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) return null;

    if (updates.original_content) {
      updates.original_content = sanitizePrivacyContent(updates.original_content).cleanText;
    }

    if (updates.assigned_unit) {
      updates.assigned_unit = normalizeUnitName(updates.assigned_unit);
    }

    const updated = {
      ...this.records[index],
      ...updates,
    };

    this.records[index] = updated;
    this.notify();
    void this.pushToSupabase();
    return updated;
  }

  /**
   * Xóa dứt điểm một bản ghi đôn đốc khỏi CSDL Supabase và bộ nhớ (Không dùng localStorage).
   * Ghi nhận vĩnh viễn vào Danh mục đen (Tombstone Blacklist) để chặn đứng mọi khả năng hồi sinh.
   */
  public async deleteUrge(idOrCode: string): Promise<boolean> {
    const target = this.records.find((r) => r.id === idOrCode || r.ticket_code === idOrCode);
    const targetId = target ? target.id : idOrCode;
    const targetCode = target ? target.ticket_code : idOrCode;

    // 1. Thêm vào danh sách đen trong bộ nhớ
    this.deletedIdentifiers.add(targetId);
    if (targetCode) this.deletedIdentifiers.add(targetCode);
    this.deletedIdentifiers.add(idOrCode);

    // 2. Lọc bỏ khỏi mảng hiện tại
    const initialLen = this.records.length;
    this.records = this.records.filter((r) => r.id !== targetId && r.ticket_code !== targetCode && r.id !== idOrCode && r.ticket_code !== idOrCode);

    this.notify();

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }

    if (!isSupabaseConfigured || !supabase) {
      return true;
    }

    try {
      // 3. Đọc và cập nhật Danh sách đen (Tombstones Blacklist) vĩnh viễn trên Supabase
      const { data: delRow } = await supabase
        .from('system_config')
        .select('*')
        .eq('id', 'dossier_urges_deleted')
        .maybeSingle();

      const currentDel: string[] = (delRow && Array.isArray(delRow.config)) ? delRow.config : [];
      const updatedSet = new Set(currentDel);
      updatedSet.add(targetId);
      if (targetCode) updatedSet.add(targetCode);
      updatedSet.add(idOrCode);
      const updatedDelArray = Array.from(updatedSet);

      await supabase.from('system_config').upsert({
        id: 'dossier_urges_deleted',
        config: updatedDelArray,
        updated_at: new Date().toISOString(),
      });

      // 4. Nếu có bảng riêng dossier_urges, xóa trực tiếp dòng đó
      if (this.hasDossierUrgesTable) {
        try {
          await supabase.from('dossier_urges').delete().or(`id.eq.${targetId},ticket_code.eq.${targetCode}`);
        } catch (e) {
          console.warn('dossier_urges table delete warning:', e);
        }
      }

      // 5. Cập nhật mảng đã loại bỏ bản ghi bị xóa vào CSDL Supabase (system_config)
      const { error } = await supabase.from('system_config').upsert({
        id: 'dossier_urges',
        config: this.records,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Lỗi khi cập nhật CSDL Supabase sau khi xóa:', error);
        this.syncError = error.message;
        throw new Error(`Lỗi cập nhật CSDL: ${error.message}`);
      }

      this.lastSyncTime = new Date().toISOString();
      this.isSupabaseConnected = true;
      this.syncError = null;
      this.notify();
      return true;
    } catch (err: any) {
      console.error('Lỗi nghiêm trọng khi xóa bản ghi đôn đốc trên Supabase:', err);
      this.syncError = err.message || 'Lỗi kết nối CSDL Supabase';
      throw err;
    }
  }

  /**
   * Đặt lại dữ liệu mẫu ban đầu
   */
  public async resetSampleData() {
    this.records = [...INITIAL_SAMPLE_URGES];
    this.notify();
    await this.pushToSupabase();
  }

  // ==========================================
  // CÁC HÀM TỔNG HỢP SỐ LIỆU ĐA TIÊU CHÍ
  // ==========================================

  /**
   * 1. Tổng hợp theo Đơn vị chủ trì
   */
  public getUnitSummary(filteredRecords?: DossierUrgeRecord[]): UnitUrgeSummary[] {
    const data = filteredRecords || this.records;
    const map = new Map<string, { total: number; dossierSet: Set<string>; multipleSet: Set<string>; responded: number; pending: number }>();

    data.forEach((r) => {
      const u = normalizeUnitName(r.assigned_unit);
      if (!map.has(u)) {
        map.set(u, { total: 0, dossierSet: new Set(), multipleSet: new Set(), responded: 0, pending: 0 });
      }
      const entry = map.get(u)!;
      entry.total += 1;
      entry.dossierSet.add(r.dossier_code);
      if (r.urge_count >= 2) {
        entry.multipleSet.add(r.dossier_code);
      }
      if (r.status === 'responded' || r.status === 'completed') {
        entry.responded += 1;
      } else {
        entry.pending += 1;
      }
    });

    return Array.from(map.entries())
      .map(([unitName, val]) => ({
        unitName,
        totalUrges: val.total,
        dossierCount: val.dossierSet.size,
        multipleUrgeCount: val.multipleSet.size,
        respondedCount: val.responded,
        pendingCount: val.pending,
        responseRate: val.total > 0 ? Math.round((val.responded / val.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalUrges - a.totalUrges);
  }

  /**
   * 2. Tổng hợp theo Người thụ lý
   */
  public getProcessorSummary(filteredRecords?: DossierUrgeRecord[]): ProcessorUrgeSummary[] {
    const data = filteredRecords || this.records;
    const map = new Map<string, { unit: string; total: number; dossierSet: Set<string>; multipleSet: Set<string>; pending: number; responded: number }>();

    data.forEach((r) => {
      const p = r.processor_name || 'Chưa xác định cán bộ';
      const u = normalizeUnitName(r.assigned_unit);
      if (!map.has(p)) {
        map.set(p, { unit: u, total: 0, dossierSet: new Set(), multipleSet: new Set(), pending: 0, responded: 0 });
      }
      const entry = map.get(p)!;
      entry.total += 1;
      if (u && (!entry.unit || entry.unit !== u)) entry.unit = u;
      entry.dossierSet.add(r.dossier_code);
      if (r.urge_count >= 2) {
        entry.multipleSet.add(r.dossier_code);
      }
      if (r.status === 'responded' || r.status === 'completed') {
        entry.responded += 1;
      } else {
        entry.pending += 1;
      }
    });

    return Array.from(map.entries())
      .map(([processorName, val]) => ({
        processorName,
        unitName: val.unit,
        totalUrges: val.total,
        dossierCount: val.dossierSet.size,
        multipleUrgeCount: val.multipleSet.size,
        pendingCount: val.pending,
        respondedCount: val.responded,
      }))
      .sort((a, b) => b.totalUrges - a.totalUrges);
  }

  /**
   * 3. Chuyên đề tổng hợp: Danh sách các hồ sơ "Đôn đốc nhiều lần" (>= 2 lần)
   */
  public getMultipleUrgeDossiers(minCount: number = 2, filteredRecords?: DossierUrgeRecord[]): Array<{
    dossier_code: string;
    citizen_name: string;
    procedure_name: string;
    assigned_unit: string;
    processor_name: string;
    maxUrgeCount: number;
    records: DossierUrgeRecord[];
    latest: DossierUrgeRecord;
  }> {
    const data = filteredRecords || this.records;
    const groups = new Map<string, DossierUrgeRecord[]>();

    data.forEach((r) => {
      if (!groups.has(r.dossier_code)) {
        groups.set(r.dossier_code, []);
      }
      groups.get(r.dossier_code)!.push(r);
    });

    const result: Array<{
      dossier_code: string;
      citizen_name: string;
      procedure_name: string;
      assigned_unit: string;
      processor_name: string;
      maxUrgeCount: number;
      records: DossierUrgeRecord[];
      latest: DossierUrgeRecord;
    }> = [];

    groups.forEach((records, code) => {
      records.sort((a, b) => a.urge_count - b.urge_count);
      const maxCount = Math.max(...records.map((r) => r.urge_count), records.length);
      if (maxCount >= minCount) {
        const latest = records[records.length - 1];
        result.push({
          dossier_code: code,
          citizen_name: latest.citizen_name,
          procedure_name: latest.procedure_name,
          assigned_unit: latest.assigned_unit,
          processor_name: latest.processor_name || 'Chưa phân công',
          maxUrgeCount: maxCount,
          records,
          latest,
        });
      }
    });

    return result.sort((a, b) => b.maxUrgeCount - a.maxUrgeCount);
  }

  /**
   * 4. Tính toán các chỉ số KPI đôn đốc tổng quan
   */
  public getKPIStats(filteredRecords?: DossierUrgeRecord[]): UrgeKPIStats {
    const data = filteredRecords || this.records;
    const totalUrges = data.length;
    const uniqueDossiers = new Set(data.map((r) => r.dossier_code)).size;
    
    const multipleDossiers = this.getMultipleUrgeDossiers(2, data).length;

    let directCount = 0;
    let phoneCount = 0;
    let pendingCount = 0;
    let inProgressCount = 0;
    let respondedCount = 0;
    let completedCount = 0;

    data.forEach((r) => {
      if (r.channel === 'phone') phoneCount++;
      else directCount++;

      if (r.status === 'pending') pendingCount++;
      else if (r.status === 'in_progress') inProgressCount++;
      else if (r.status === 'responded') respondedCount++;
      else if (r.status === 'completed') completedCount++;
    });

    const directPercent = totalUrges > 0 ? Math.round((directCount / totalUrges) * 100) : 0;
    const phonePercent = totalUrges > 0 ? 100 - directPercent : 0;

    return {
      totalUrges,
      uniqueDossiers,
      multipleUrgeDossiers: multipleDossiers,
      directCount,
      phoneCount,
      directPercent,
      phonePercent,
      pendingCount,
      inProgressCount,
      respondedCount,
      completedCount,
    };
  }
}

export const dossierUrgeStore = new DossierUrgeStore();
