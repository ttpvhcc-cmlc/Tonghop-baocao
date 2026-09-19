export type UserRole = 'admin' | 'analyst' | 'data_entry' | 'viewer';

export type ReportType = 'monthly' | 'quarterly' | 'annual' | 'adhoc' | 'weekly' | 'ad_hoc' | 'other';

export type ReportStatus = 'draft' | 'imported' | 'validated' | 'submitted' | 'approved' | 'locked' | 'archived';

export type ScopeType = 'report' | 'unit' | 'field' | 'source';

export type ValidationStatus = 'valid' | 'warning' | 'error';

// 1. profiles
export interface Profile {
  id: string;
  user_id?: string;
  email?: string;
  full_name: string;
  role: UserRole;
  unit_id?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

// 2. units
export interface Unit {
  id: string;
  code: string;
  name: string;
  display_order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

// 3. fields (Each FIELD belongs to exactly ONE UNIT)
export interface Field {
  id: string;
  code: string;
  name: string;
  unit_id: string;
  display_order: number;
  active: boolean;
  unit?: Unit;
  created_at?: string;
  updated_at?: string;

  // Extra metadata columns from Excel
  co_quan_cong_bo?: string;
  loai_tthc?: string;
  co_quan_thuc_hien?: string;
  cap_thuc_hien?: string;
  muc_do_cung_cap?: string;
  phi_le_phi?: string;
  linh_vuc?: string;
}

// 4. reports (Central report table)
export interface Report {
  id: string;
  report_code: string;
  report_name: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  data_as_of: string;
  status: ReportStatus;
  created_by?: string;
  approved_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  locked_at?: string | null;
  is_demo?: boolean;
}

// 5. report_sources
export interface ReportSource {
  id: string;
  report_id: string;
  source_name: string;
  source_type: string;
  original_filename?: string;
  storage_path?: string;
  file_hash?: string;
  uploaded_by?: string;
  uploaded_at: string;
  import_status?: 'pending' | 'processing' | 'completed' | 'error';
  import_summary?: Record<string, any>;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
  type: 'error' | 'warning';
  details?: Record<string, any>;
}

// 6. report_field_statistics
export interface ReportFieldStatistic {
  id: string;
  report_id: string;
  source_id: string;
  field_id: string;

  // Snapshot fields (preserving historic names)
  field_code?: string;
  field_name?: string;
  unit_id: string;
  unit_name?: string;

  // Aliases for historical snapshot fields
  field_name_snapshot?: string;
  unit_name_snapshot?: string;

  // Statistics (standardized columns)
  received_total: number;
  online?: number;
  in_person?: number;
  previous_period?: number;

  resolved_total?: number;
  early?: number;
  on_time?: number;
  late?: number;

  pending_total: number;
  within_deadline?: number;
  overdue?: number;

  // Backward compatibility aliases (guaranteed numbers for typed calculations)
  received_online: number;
  received_offline: number;
  carried_forward: number;
  completed_total: number;
  completed_early: number;
  completed_on_time: number;
  completed_late: number;
  pending_on_time: number;
  pending_late: number;

  // Validation
  validation_status: ValidationStatus;
  validation_errors: ValidationErrorItem[];
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Backward compatibility types
export type ReportStatistic = ReportFieldStatistic;
export type ReportingPeriod = Report;

// 7. indicator_definitions
export interface IndicatorDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  calculation_key?: string;
  formula_key?: string; // alias
  unit?: string;
  unit_measure?: string; // alias
  display_order?: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

// 8. report_indicators
export interface ReportIndicator {
  id: string;
  report_id: string;
  indicator_definition_id: string;
  value: number;
  unit: string;
  metadata?: Record<string, any>;
  created_at?: string;
  // Aliases
  indicator_code?: string;
  indicator_name?: string;
  scope_type?: ScopeType;
  scope_id?: string;
  scope_name_snapshot?: string;
  value_numeric?: number;
  numerator?: number;
  denominator?: number;
  calculation_metadata?: Record<string, any>;
}

// 9. report_analysis
export interface ReportAnalysis {
  id: string;
  report_id: string;
  section?: string;
  content?: string;
  generated_by?: string;
  created_at?: string;
  updated_at?: string;
  // Aliases
  scope_type?: 'report' | 'unit' | 'field';
  scope_id?: string;
  title?: string;
  generated_text?: string;
  source_metrics?: Record<string, any>;
}

// 10. report_snapshots
export interface ReportSnapshot {
  id: string;
  report_id: string;
  snapshot_json: Record<string, any>;
  created_at: string;
  created_by?: string;
  version_number?: number;
  reason?: string;
}

export interface ReportExport {
  id: string;
  report_id: string;
  file_type: 'xlsx' | 'csv' | 'pdf';
  storage_path: string;
  created_by: string;
  created_at: string;
}

// 11. audit_logs
export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}
