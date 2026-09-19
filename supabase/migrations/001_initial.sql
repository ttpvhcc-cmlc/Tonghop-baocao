-- ==============================================================================
-- HỆ THỐNG QUẢN LÝ BÁO CÁO VÀ PHÂN TÍCH CHỈ SỐ THỦ TỤC HÀNH CHÍNH (TTHC)
-- TOÀN BỘ MIGRATION KHỞI TẠO 11 BẢNG, PHÂN QUYỀN RBAC & SEED DATA CHUẨN SUPABASE
-- 100% IDEMPOTENT / RE-RUNNABLE / TUÂN THỦ NGUYÊN TẮC BẢO MẬT & QUẢN TRỊ AUTH
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TẠO 11 BẢNG DỮ LIỆU CỐT LÕI THEO ĐÚNG THỨ TỰ PHỤ THUỘC (DEPENDENCY CHAIN)
-- Thứ tự: units -> profiles -> fields -> reports -> report_sources ->
--         report_field_statistics -> indicator_definitions -> report_indicators ->
--         report_analysis -> report_snapshots -> audit_logs
-- ==============================================================================

-- BẢNG 1: units (Đơn vị hành chính cấp phòng ban)
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BẢNG 2: profiles (Hồ sơ người dùng & phân quyền RBAC, liên kết trực tiếp auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'data_entry', 'viewer')),
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BẢNG 3: fields (Lĩnh vực TTHC, thuộc về 1 đơn vị duy nhất)
CREATE TABLE IF NOT EXISTS public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BẢNG 4: reports (Kỳ báo cáo tổng hợp TTHC và vòng đời báo cáo)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code TEXT NOT NULL UNIQUE,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'monthly' CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'adhoc')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data_as_of TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'imported', 'validated', 'submitted', 'approved', 'locked')),
  created_by TEXT NOT NULL DEFAULT 'Hệ thống',
  notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_period_dates CHECK (period_end >= period_start)
);

-- BẢNG 5: report_sources (Nguồn dữ liệu nhập liệu vào kỳ báo cáo)
CREATE TABLE IF NOT EXISTS public.report_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'system' CHECK (source_type IN ('system', 'excel', 'api', 'manual')),
  source_name TEXT NOT NULL,
  original_filename TEXT,
  uploaded_by TEXT NOT NULL DEFAULT 'Hệ thống',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  import_status TEXT NOT NULL DEFAULT 'completed' CHECK (import_status IN ('pending', 'processing', 'completed', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_source_name UNIQUE (report_id, source_name)
);

-- BẢNG 6: report_field_statistics (Số liệu thống kê TTHC chi tiết theo kỳ, nguồn và lĩnh vực)
CREATE TABLE IF NOT EXISTS public.report_field_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.report_sources(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE RESTRICT,
  field_name_snapshot TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  unit_name_snapshot TEXT NOT NULL,
  
  -- Nhóm chỉ số 1: Tiếp nhận hồ sơ (CT1: received_total = online + offline + carried_forward)
  received_total INTEGER NOT NULL DEFAULT 0 CHECK (received_total >= 0),
  received_online INTEGER NOT NULL DEFAULT 0 CHECK (received_online >= 0),
  received_offline INTEGER NOT NULL DEFAULT 0 CHECK (received_offline >= 0),
  carried_forward INTEGER NOT NULL DEFAULT 0 CHECK (carried_forward >= 0),
  
  -- Nhóm chỉ số 2: Đã giải quyết (CT2: completed_total = early + on_time + late)
  completed_total INTEGER NOT NULL DEFAULT 0 CHECK (completed_total >= 0),
  completed_early INTEGER NOT NULL DEFAULT 0 CHECK (completed_early >= 0),
  completed_on_time INTEGER NOT NULL DEFAULT 0 CHECK (completed_on_time >= 0),
  completed_late INTEGER NOT NULL DEFAULT 0 CHECK (completed_late >= 0),
  
  -- Nhóm chỉ số 3: Đang giải quyết (CT3: pending_total = on_time + late)
  pending_total INTEGER NOT NULL DEFAULT 0 CHECK (pending_total >= 0),
  pending_on_time INTEGER NOT NULL DEFAULT 0 CHECK (pending_on_time >= 0),
  pending_late INTEGER NOT NULL DEFAULT 0 CHECK (pending_late >= 0),
  
  -- Trạng thái kiểm chứng toán học & ghi chú
  notes TEXT,
  validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'warning', 'error')),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_report_source_field UNIQUE (report_id, source_id, field_id)
);

-- BẢNG 7: indicator_definitions (Từ điển định nghĩa công thức chỉ số đo lường)
CREATE TABLE IF NOT EXISTS public.indicator_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  formula_key TEXT NOT NULL,
  unit_measure TEXT NOT NULL DEFAULT '%',
  target_value NUMERIC(10, 2),
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BẢNG 8: report_indicators (Giá trị các chỉ số đã tính toán cho từng kỳ báo cáo)
CREATE TABLE IF NOT EXISTS public.report_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  indicator_definition_id UUID NOT NULL REFERENCES public.indicator_definitions(id) ON DELETE RESTRICT,
  scope_type TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'unit', 'field')),
  scope_id UUID,
  calculated_value NUMERIC(12, 4) NOT NULL,
  formatted_value TEXT NOT NULL,
  target_status TEXT NOT NULL DEFAULT 'achieved' CHECK (target_status IN ('achieved', 'warning', 'critical')),
  calculation_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_indicator_scope UNIQUE (report_id, indicator_definition_id, scope_type, scope_id)
);

-- BẢNG 9: report_analysis (Nhận xét, đánh giá và phân tích chuyên môn của báo cáo)
CREATE TABLE IF NOT EXISTS public.report_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'overview' CHECK (scope_type IN ('overview', 'unit', 'field')),
  scope_id UUID,
  title TEXT NOT NULL,
  generated_text TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'Hệ thống',
  source_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BẢNG 10: report_snapshots (Bản chụp đóng băng bất biến khi báo cáo đạt trạng thái locked)
CREATE TABLE IF NOT EXISTS public.report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_snapshot_version UNIQUE (report_id, version_number)
);

-- BẢNG 11: audit_logs (Nhật ký kiểm toán hệ thống append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. VIEWS TƯƠNG THÍCH NGƯỢC (BACKWARD COMPATIBILITY)
-- ==============================================================================
CREATE OR REPLACE VIEW public.reporting_periods AS
SELECT * FROM public.reports;

CREATE OR REPLACE VIEW public.report_statistics AS
SELECT * FROM public.report_field_statistics;

-- ==============================================================================
-- 4. HELPER FUNCTIONS & TRIGGER PROCEDURES
-- ==============================================================================

-- Hàm lấy vai trò người dùng hiện tại (SECURITY DEFINER, chống recursion RLS)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = true LIMIT 1;
$$;

-- Hàm tự động cập nhật trường updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Hàm tự động sao lưu snapshot tên đơn vị & lĩnh vực
CREATE OR REPLACE FUNCTION public.sync_report_field_statistics_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit_name TEXT;
  v_field_name TEXT;
  v_unit_id UUID;
BEGIN
  SELECT f.name, f.unit_id, u.name 
  INTO v_field_name, v_unit_id, v_unit_name
  FROM public.fields f
  JOIN public.units u ON u.id = f.unit_id
  WHERE f.id = NEW.field_id;

  IF NEW.field_name_snapshot IS NULL OR NEW.field_name_snapshot = '' THEN
    NEW.field_name_snapshot = COALESCE(v_field_name, 'Lĩnh vực');
  END IF;

  IF NEW.unit_id IS NULL THEN
    NEW.unit_id = v_unit_id;
  END IF;

  IF NEW.unit_name_snapshot IS NULL OR NEW.unit_name_snapshot = '' THEN
    NEW.unit_name_snapshot = COALESCE(v_unit_name, 'Đơn vị');
  END IF;

  RETURN NEW;
END;
$$;

-- Hàm bảo vệ tính bất biến của số liệu khi báo cáo đã khóa
CREATE OR REPLACE FUNCTION public.enforce_locked_statistics_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_report_id UUID;
  v_report_status TEXT;
BEGIN
  v_target_report_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.report_id ELSE NEW.report_id END;

  SELECT status INTO v_report_status FROM public.reports WHERE id = v_target_report_id;

  IF v_report_status = 'locked' THEN
    RAISE EXCEPTION 'Báo cáo này đã bị khóa (LOCKED). Không được phép thêm, sửa hoặc xóa số liệu thống kê.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Hàm bảo vệ tính bất biến của chỉ số khi báo cáo đã khóa
CREATE OR REPLACE FUNCTION public.enforce_locked_indicators_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_report_id UUID;
  v_report_status TEXT;
BEGIN
  v_target_report_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.report_id ELSE NEW.report_id END;

  SELECT status INTO v_report_status FROM public.reports WHERE id = v_target_report_id;

  IF v_report_status = 'locked' THEN
    RAISE EXCEPTION 'Báo cáo này đã bị khóa (LOCKED). Không được phép thêm, sửa hoặc xóa chỉ số đo lường.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Hàm bảo vệ tính bất biến của phân tích nhận xét khi báo cáo đã khóa
CREATE OR REPLACE FUNCTION public.enforce_locked_analysis_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_report_id UUID;
  v_report_status TEXT;
BEGIN
  v_target_report_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.report_id ELSE NEW.report_id END;

  SELECT status INTO v_report_status FROM public.reports WHERE id = v_target_report_id;

  IF v_report_status = 'locked' THEN
    RAISE EXCEPTION 'Báo cáo này đã bị khóa (LOCKED). Không được phép thêm, sửa hoặc xóa bài phân tích nhận xét.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Hàm bảo vệ tính bất biến của snapshots
CREATE OR REPLACE FUNCTION public.enforce_snapshot_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Bản chụp báo cáo (snapshot) là dữ liệu lưu trữ lịch sử bất biến, không được phép chỉnh sửa hoặc xóa.';
END;
$$;

-- Hàm bảo vệ tính append-only của audit logs
CREATE OR REPLACE FUNCTION public.enforce_audit_log_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Nhật ký kiểm toán (audit logs) là append-only, không cho phép chỉnh sửa hoặc xóa.';
END;
$$;

-- Hàm kiểm soát vòng đời báo cáo & tự động chụp snapshot khi khóa
CREATE OR REPLACE FUNCTION public.enforce_report_lifecycle_and_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_version INTEGER;
  v_snapshot_payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'Không thể xóa kỳ báo cáo đã ở trạng thái khóa (LOCKED).';
    END IF;
    RETURN OLD;
  END IF;

  -- Nếu đang ở trạng thái locked, không cho phép sửa đổi dữ liệu cốt lõi
  IF OLD.status = 'locked' AND NEW.status = 'locked' THEN
    IF OLD.report_code <> NEW.report_code OR
       OLD.period_start <> NEW.period_start OR
       OLD.period_end <> NEW.period_end OR
       OLD.data_as_of <> NEW.data_as_of THEN
      RAISE EXCEPTION 'Báo cáo đã khóa (LOCKED) không được phép chỉnh sửa thông tin kỳ hoặc ngày dữ liệu.';
    END IF;
  END IF;

  -- Kiểm tra chuyển đổi trạng thái hợp lệ
  IF OLD.status <> NEW.status THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'Không thể mở lại hoặc thay đổi trạng thái của báo cáo đã khóa (LOCKED).';
    END IF;

    -- Tự động cập nhật timestamp và người duyệt/khóa
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
      NEW.approved_at = COALESCE(NEW.approved_at, now());
      NEW.approved_by = COALESCE(NEW.approved_by, 'Người phê duyệt');
    END IF;

    IF NEW.status = 'locked' AND OLD.status <> 'locked' THEN
      NEW.locked_at = COALESCE(NEW.locked_at, now());

      -- Tự động tạo snapshot nếu chưa tồn tại
      SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
      FROM public.report_snapshots
      WHERE report_id = NEW.id;

      SELECT jsonb_build_object(
        'report', row_to_json(NEW),
        'sources', (SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) FROM public.report_sources s WHERE s.report_id = NEW.id),
        'statistics', (SELECT COALESCE(jsonb_agg(row_to_json(st)), '[]'::jsonb) FROM public.report_field_statistics st WHERE st.report_id = NEW.id),
        'indicators', (SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) FROM public.report_indicators i WHERE i.report_id = NEW.id),
        'captured_at', now()
      ) INTO v_snapshot_payload;

      INSERT INTO public.report_snapshots (
        id,
        report_id,
        version_number,
        snapshot_json,
        created_by,
        reason,
        created_at
      ) VALUES (
        gen_random_uuid(),
        NEW.id,
        v_next_version,
        v_snapshot_payload,
        COALESCE(NEW.created_by, 'Hệ thống'),
        'Tự động chụp bản sao đóng băng khi chuyển trạng thái sang Khóa (LOCKED)',
        now()
      ) ON CONFLICT (report_id, version_number) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 5. GẮN TRIGGERS VÀO CÁC BẢNG
-- ==============================================================================

-- Triggers cập nhật updated_at
DROP TRIGGER IF EXISTS trg_units_updated_at ON public.units;
CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_fields_updated_at ON public.fields;
CREATE TRIGGER trg_fields_updated_at BEFORE UPDATE ON public.fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_report_sources_updated_at ON public.report_sources;
CREATE TRIGGER trg_report_sources_updated_at BEFORE UPDATE ON public.report_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_report_field_statistics_updated_at ON public.report_field_statistics;
CREATE TRIGGER trg_report_field_statistics_updated_at BEFORE UPDATE ON public.report_field_statistics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_indicator_definitions_updated_at ON public.indicator_definitions;
CREATE TRIGGER trg_indicator_definitions_updated_at BEFORE UPDATE ON public.indicator_definitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_report_indicators_updated_at ON public.report_indicators;
CREATE TRIGGER trg_report_indicators_updated_at BEFORE UPDATE ON public.report_indicators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_report_analysis_updated_at ON public.report_analysis;
CREATE TRIGGER trg_report_analysis_updated_at BEFORE UPDATE ON public.report_analysis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Trigger đồng bộ snapshot tên đơn vị & lĩnh vực cho bảng thống kê
DROP TRIGGER IF EXISTS trg_report_field_statistics_sync ON public.report_field_statistics;
CREATE TRIGGER trg_report_field_statistics_sync BEFORE INSERT OR UPDATE ON public.report_field_statistics FOR EACH ROW EXECUTE FUNCTION public.sync_report_field_statistics_columns();

-- Triggers bảo vệ tính bất biến khi báo cáo bị khóa
DROP TRIGGER IF EXISTS trg_statistics_lock_guard ON public.report_field_statistics;
CREATE TRIGGER trg_statistics_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.report_field_statistics FOR EACH ROW EXECUTE FUNCTION public.enforce_locked_statistics_immutability();

DROP TRIGGER IF EXISTS trg_indicators_lock_guard ON public.report_indicators;
CREATE TRIGGER trg_indicators_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.report_indicators FOR EACH ROW EXECUTE FUNCTION public.enforce_locked_indicators_immutability();

DROP TRIGGER IF EXISTS trg_analysis_lock_guard ON public.report_analysis;
CREATE TRIGGER trg_analysis_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON public.report_analysis FOR EACH ROW EXECUTE FUNCTION public.enforce_locked_analysis_immutability();

-- Trigger bảo vệ snapshots & audit logs
DROP TRIGGER IF EXISTS trg_snapshots_immutability ON public.report_snapshots;
CREATE TRIGGER trg_snapshots_immutability BEFORE UPDATE OR DELETE ON public.report_snapshots FOR EACH ROW EXECUTE FUNCTION public.enforce_snapshot_immutability();

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_log_append_only();

-- Trigger vòng đời báo cáo
DROP TRIGGER IF EXISTS trg_reports_lifecycle ON public.reports;
CREATE TRIGGER trg_reports_lifecycle BEFORE UPDATE OR DELETE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.enforce_report_lifecycle_and_immutability();

-- ==============================================================================
-- 6. TẠO INDEXES TỐI ƯU TRUY VẤN
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_fields_unit_id ON public.fields(unit_id);
CREATE INDEX IF NOT EXISTS idx_reports_period ON public.reports(period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_report_sources_report_id ON public.report_sources(report_id);
CREATE INDEX IF NOT EXISTS idx_stats_report_id ON public.report_field_statistics(report_id);
CREATE INDEX IF NOT EXISTS idx_stats_source_id ON public.report_field_statistics(source_id);
CREATE INDEX IF NOT EXISTS idx_stats_field_id ON public.report_field_statistics(field_id);
CREATE INDEX IF NOT EXISTS idx_stats_unit_id ON public.report_field_statistics(unit_id);
CREATE INDEX IF NOT EXISTS idx_indicators_report_id ON public.report_indicators(report_id);
CREATE INDEX IF NOT EXISTS idx_analysis_report_id ON public.report_analysis(report_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_report_id ON public.report_snapshots(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 7. CẤU HÌNH ROW LEVEL SECURITY (RLS) & POLICIES AN TOÀN
-- ==============================================================================
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_field_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Policies cho units
DROP POLICY IF EXISTS "units_select_policy" ON public.units;
CREATE POLICY "units_select_policy" ON public.units FOR SELECT USING (true);

DROP POLICY IF EXISTS "units_insert_policy" ON public.units;
CREATE POLICY "units_insert_policy" ON public.units FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "units_update_policy" ON public.units;
CREATE POLICY "units_update_policy" ON public.units FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "units_delete_policy" ON public.units;
CREATE POLICY "units_delete_policy" ON public.units FOR DELETE USING (true);

-- 2. Policies cho profiles (liên kết với auth.uid())
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (true);

-- 3. Policies cho fields
DROP POLICY IF EXISTS "fields_select_policy" ON public.fields;
CREATE POLICY "fields_select_policy" ON public.fields FOR SELECT USING (true);

DROP POLICY IF EXISTS "fields_insert_policy" ON public.fields;
CREATE POLICY "fields_insert_policy" ON public.fields FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "fields_update_policy" ON public.fields;
CREATE POLICY "fields_update_policy" ON public.fields FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fields_delete_policy" ON public.fields;
CREATE POLICY "fields_delete_policy" ON public.fields FOR DELETE USING (true);

-- 4. Policies cho reports
DROP POLICY IF EXISTS "reports_select_policy" ON public.reports;
CREATE POLICY "reports_select_policy" ON public.reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "reports_insert_policy" ON public.reports;
CREATE POLICY "reports_insert_policy" ON public.reports FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reports_update_policy" ON public.reports;
CREATE POLICY "reports_update_policy" ON public.reports FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reports_delete_policy" ON public.reports;
CREATE POLICY "reports_delete_policy" ON public.reports FOR DELETE USING (true);

-- 5. Policies cho report_sources
DROP POLICY IF EXISTS "report_sources_select_policy" ON public.report_sources;
CREATE POLICY "report_sources_select_policy" ON public.report_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "report_sources_insert_policy" ON public.report_sources;
CREATE POLICY "report_sources_insert_policy" ON public.report_sources FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "report_sources_update_policy" ON public.report_sources;
CREATE POLICY "report_sources_update_policy" ON public.report_sources FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "report_sources_delete_policy" ON public.report_sources;
CREATE POLICY "report_sources_delete_policy" ON public.report_sources FOR DELETE USING (true);

-- 6. Policies cho report_field_statistics
DROP POLICY IF EXISTS "stats_select_policy" ON public.report_field_statistics;
CREATE POLICY "stats_select_policy" ON public.report_field_statistics FOR SELECT USING (true);

DROP POLICY IF EXISTS "stats_insert_policy" ON public.report_field_statistics;
CREATE POLICY "stats_insert_policy" ON public.report_field_statistics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "stats_update_policy" ON public.report_field_statistics;
CREATE POLICY "stats_update_policy" ON public.report_field_statistics FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stats_delete_policy" ON public.report_field_statistics;
CREATE POLICY "stats_delete_policy" ON public.report_field_statistics FOR DELETE USING (true);

-- 7. Policies cho indicator_definitions
DROP POLICY IF EXISTS "indicators_def_select_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_select_policy" ON public.indicator_definitions FOR SELECT USING (true);

DROP POLICY IF EXISTS "indicators_def_insert_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_insert_policy" ON public.indicator_definitions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "indicators_def_update_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_update_policy" ON public.indicator_definitions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "indicators_def_delete_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_delete_policy" ON public.indicator_definitions FOR DELETE USING (true);

-- 8. Policies cho report_indicators
DROP POLICY IF EXISTS "report_indicators_select_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_select_policy" ON public.report_indicators FOR SELECT USING (true);

DROP POLICY IF EXISTS "report_indicators_insert_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_insert_policy" ON public.report_indicators FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "report_indicators_update_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_update_policy" ON public.report_indicators FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "report_indicators_delete_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_delete_policy" ON public.report_indicators FOR DELETE USING (true);

-- 9. Policies cho report_analysis
DROP POLICY IF EXISTS "analysis_select_policy" ON public.report_analysis;
CREATE POLICY "analysis_select_policy" ON public.report_analysis FOR SELECT USING (true);

DROP POLICY IF EXISTS "analysis_insert_policy" ON public.report_analysis;
CREATE POLICY "analysis_insert_policy" ON public.report_analysis FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "analysis_update_policy" ON public.report_analysis;
CREATE POLICY "analysis_update_policy" ON public.report_analysis FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "analysis_delete_policy" ON public.report_analysis;
CREATE POLICY "analysis_delete_policy" ON public.report_analysis FOR DELETE USING (true);

-- 10. Policies cho report_snapshots
DROP POLICY IF EXISTS "snapshots_select_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_select_policy" ON public.report_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "snapshots_insert_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_insert_policy" ON public.report_snapshots FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "snapshots_update_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_update_policy" ON public.report_snapshots FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "snapshots_delete_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_delete_policy" ON public.report_snapshots FOR DELETE USING (true);

-- 11. Policies cho audit_logs
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 8. DEMO SEED DATA (KHÔNG TẠO NGƯỜI DÙNG GIẢ TRONG SCHEMA AUTH)
-- ==============================================================================

-- 8.1 Nạp 3 Đơn vị hành chính
INSERT INTO public.units (id, code, name, display_order, active) VALUES
('a0000000-0000-0000-0000-000000000001', 'VP', 'Văn phòng', 1, true),
('a0000000-0000-0000-0000-000000000002', 'PKT', 'Phòng Kinh tế', 2, true),
('a0000000-0000-0000-0000-000000000003', 'PVHXH', 'Phòng VHXH', 3, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  active = EXCLUDED.active;

-- 8.2 Nạp 15 Lĩnh vực TTHC
INSERT INTO public.fields (id, code, name, unit_id, display_order, active) VALUES
-- Văn phòng
('b0000000-0000-0000-0000-000000000001', 'CT', 'Chứng thực', 'a0000000-0000-0000-0000-000000000001', 1, true),
('b0000000-0000-0000-0000-000000000002', 'HT', 'Hộ tịch', 'a0000000-0000-0000-0000-000000000001', 2, true),
('b0000000-0000-0000-0000-000000000003', 'PLP', 'Phí, lệ phí', 'a0000000-0000-0000-0000-000000000001', 3, true),
-- Phòng Kinh tế
('b0000000-0000-0000-0000-000000000004', 'ATTP', 'An toàn thực phẩm', 'a0000000-0000-0000-0000-000000000002', 4, true),
('b0000000-0000-0000-0000-000000000005', 'HHDT', 'Hàng hải và đường thủy nội địa', 'a0000000-0000-0000-0000-000000000002', 5, true),
('b0000000-0000-0000-0000-000000000006', 'QH', 'Quy hoạch đô thị và nông thôn', 'a0000000-0000-0000-0000-000000000002', 6, true),
('b0000000-0000-0000-0000-000000000007', 'XD', 'Hoạt động xây dựng', 'a0000000-0000-0000-0000-000000000002', 7, true),
('b0000000-0000-0000-0000-000000000008', 'LTHH', 'Lưu thông hàng hóa trong nước', 'a0000000-0000-0000-0000-000000000002', 8, true),
('b0000000-0000-0000-0000-000000000009', 'DD', 'Đất đai', 'a0000000-0000-0000-0000-000000000002', 9, true),
('b0000000-0000-0000-0000-000000000010', 'TS', 'Thủy sản', 'a0000000-0000-0000-0000-000000000002', 10, true),
-- Phòng VHXH
('b0000000-0000-0000-0000-000000000011', 'BTXH', 'Bảo trợ xã hội', 'a0000000-0000-0000-0000-000000000003', 11, true),
('b0000000-0000-0000-0000-000000000012', 'GDMN', 'Giáo dục mầm non', 'a0000000-0000-0000-0000-000000000003', 12, true),
('b0000000-0000-0000-0000-000000000013', 'GDTH', 'Giáo dục trung học', 'a0000000-0000-0000-0000-000000000003', 13, true),
('b0000000-0000-0000-0000-000000000014', 'NCC', 'Người có công', 'a0000000-0000-0000-0000-000000000003', 14, true),
('b0000000-0000-0000-0000-000000000015', 'CS', 'Chính sách', 'a0000000-0000-0000-0000-000000000003', 15, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  unit_id = EXCLUDED.unit_id,
  display_order = EXCLUDED.display_order,
  active = EXCLUDED.active;

-- 8.3 Nạp 5 Chỉ tiêu đo lường chuẩn
INSERT INTO public.indicator_definitions (id, code, name, formula_key, unit_measure, target_value, description, display_order, active) VALUES
('c0000000-0000-0000-0000-000000000001', 'ONLINE_RATE', 'Tỷ lệ nộp hồ sơ trực tuyến', 'ONLINE_SUBMISSION_RATE', '%', 80.00, 'Tỷ lệ hồ sơ nộp trực tuyến qua Cổng DVC / Tổng số tiếp nhận mới', 1, true),
('c0000000-0000-0000-0000-000000000002', 'ON_TIME_COMPLETION_RATE', 'Tỷ lệ giải quyết đúng và trước hạn', 'ON_TIME_COMPLETION_RATE', '%', 98.00, 'Tỷ lệ hồ sơ giải quyết trước hạn + đúng hạn / Tổng số đã giải quyết', 2, true),
('c0000000-0000-0000-0000-000000000003', 'OVERDUE_COMPLETION_RATE', 'Tỷ lệ giải quyết quá hạn', 'OVERDUE_COMPLETION_RATE', '%', 2.00, 'Tỷ lệ hồ sơ giải quyết quá hạn / Tổng số đã giải quyết', 3, true),
('c0000000-0000-0000-0000-000000000004', 'DIGITIZATION_RATE', 'Tỷ lệ số hóa hồ sơ, kết quả TTHC', 'DIGITIZATION_RATE', '%', 85.00, 'Tỷ lệ hồ sơ được số hóa đầy đủ thành phần hồ sơ và kết quả', 4, true),
('c0000000-0000-0000-0000-000000000005', 'SATISFACTION_RATE', 'Mức độ hài lòng của người dân', 'SATISFACTION_RATE', '%', 95.00, 'Tỷ lệ đánh giá hài lòng và rất hài lòng của người dân, doanh nghiệp', 5, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  formula_key = EXCLUDED.formula_key,
  target_value = EXCLUDED.target_value,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- 8.4 Nạp 2 Kỳ Báo Cáo
INSERT INTO public.reports (id, report_code, report_name, report_type, period_start, period_end, data_as_of, status, created_by, notes) VALUES
('d0000000-0000-0000-0000-000000000001', 'BC-2026-01', 'Báo cáo TTHC Tháng 01/2026', 'monthly', '2026-01-01', '2026-01-31', '2026-01-31 17:00:00+07', 'approved', 'Hệ thống', 'Kỳ báo cáo chính thức Tháng 01/2026'),
('d0000000-0000-0000-0000-000000000002', 'BC-2026-02', 'Báo cáo TTHC Tháng 02/2026', 'monthly', '2026-02-01', '2026-02-28', '2026-02-28 17:00:00+07', 'validated', 'Hệ thống', 'Kỳ báo cáo chính thức Tháng 02/2026')
ON CONFLICT (report_code) DO UPDATE SET
  report_name = EXCLUDED.report_name,
  period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end,
  data_as_of = EXCLUDED.data_as_of,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;

-- 8.5 Nạp Nguồn Dữ Liệu
INSERT INTO public.report_sources (id, report_id, source_type, source_name, original_filename, uploaded_by, uploaded_at, import_status) VALUES
-- Tháng 01/2026
('e0000000-0000-0000-1000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'system', 'Trên Hệ thống các Bộ', 'du_lieu_cac_bo_t1.xlsx', 'Hệ thống', now(), 'completed'),
('e0000000-0000-0000-1000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'system', 'Trên Hệ thống thành phố', 'du_lieu_thanh_pho_t1.xlsx', 'Hệ thống', now(), 'completed'),
-- Tháng 02/2026
('e0000000-0000-0000-2000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'system', 'Trên Hệ thống các Bộ', 'du_lieu_cac_bo_t2.xlsx', 'Hệ thống', now(), 'completed'),
('e0000000-0000-0000-2000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'system', 'Trên Hệ thống thành phố', 'du_lieu_thanh_pho_t2.xlsx', 'Hệ thống', now(), 'completed')
ON CONFLICT (report_id, source_name) DO NOTHING;

-- 8.6 Nạp Số Liệu Thống Kê Chuẩn 4 Công Thức Toán Học
-- CT1: received_total = online + offline + carried_forward
-- CT2: completed_total = early + on_time + late
-- CT3: pending_total = on_time + late
-- CT4: received_total = completed_total + pending_total
INSERT INTO public.report_field_statistics (
  id, report_id, source_id, field_id, field_name_snapshot, unit_id, unit_name_snapshot,
  received_total, received_online, received_offline, carried_forward,
  completed_total, completed_early, completed_on_time, completed_late,
  pending_total, pending_on_time, pending_late,
  validation_status, validation_errors
) VALUES
-- Tháng 01 - Nguồn Các Bộ - Văn phòng
('f0000000-0000-0000-1001-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Chứng thực', 'a0000000-0000-0000-0000-000000000001', 'Văn phòng', 150, 120, 25, 5, 145, 80, 65, 0, 5, 5, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Hộ tịch', 'a0000000-0000-0000-0000-000000000001', 'Văn phòng', 90, 75, 15, 0, 85, 45, 40, 0, 5, 5, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000003', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Phí, lệ phí', 'a0000000-0000-0000-0000-000000000001', 'Văn phòng', 60, 50, 10, 0, 58, 30, 28, 0, 2, 2, 0, 'valid', '[]'::jsonb),

-- Tháng 01 - Nguồn Các Bộ - Phòng Kinh tế
('f0000000-0000-0000-1001-000000000004', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'An toàn thực phẩm', 'a0000000-0000-0000-0000-000000000002', 'Phòng Kinh tế', 45, 35, 10, 0, 42, 20, 22, 0, 3, 3, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000005', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'Hàng hải và đường thủy nội địa', 'a0000000-0000-0000-0000-000000000002', 'Phòng Kinh tế', 25, 20, 5, 0, 23, 10, 13, 0, 2, 2, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000006', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'Quy hoạch đô thị và nông thôn', 'a0000000-0000-0000-0000-000000000002', 'Phòng Kinh tế', 35, 25, 8, 2, 32, 15, 17, 0, 3, 3, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000007', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000007', 'Hoạt động xây dựng', 'a0000000-0000-0000-0000-000000000002', 'Phòng Kinh tế', 70, 55, 15, 0, 65, 35, 30, 0, 5, 5, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000008', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000008', 'Lưu thông hàng hóa trong nước', 'a0000000-0000-0000-0000-000000000002', 'Phòng Kinh tế', 40, 32, 8, 0, 38, 20, 18, 0, 2, 2, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000009', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000009', 'Đất đai', 'a0000000-0000-0000-0000-000000000002', 'Phòng Kinh tế', 110, 85, 20, 5, 102, 50, 51, 1, 8, 7, 1, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000010', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000010', 'Thủy sản', 'a0000000-0000-0000-0000-000000000002', 'Phòng Kinh tế', 30, 25, 5, 0, 28, 15, 13, 0, 2, 2, 0, 'valid', '[]'::jsonb),

-- Tháng 01 - Nguồn Các Bộ - Phòng VHXH
('f0000000-0000-0000-1001-000000000011', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'Bảo trợ xã hội', 'a0000000-0000-0000-0000-000000000003', 'Phòng VHXH', 50, 40, 10, 0, 48, 25, 23, 0, 2, 2, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000012', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'Giáo dục mầm non', 'a0000000-0000-0000-0000-000000000003', 'Phòng VHXH', 20, 18, 2, 0, 19, 10, 9, 0, 1, 1, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000013', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000013', 'Giáo dục trung học', 'a0000000-0000-0000-0000-000000000003', 'Phòng VHXH', 25, 22, 3, 0, 24, 12, 12, 0, 1, 1, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000014', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000014', 'Người có công', 'a0000000-0000-0000-0000-000000000003', 'Phòng VHXH', 40, 30, 10, 0, 38, 20, 18, 0, 2, 2, 0, 'valid', '[]'::jsonb),
('f0000000-0000-0000-1001-000000000015', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-1000-000000000001', 'b0000000-0000-0000-0000-000000000015', 'Chính sách', 'a0000000-0000-0000-0000-000000000003', 'Phòng VHXH', 30, 24, 6, 0, 29, 15, 14, 0, 1, 1, 0, 'valid', '[]'::jsonb)
ON CONFLICT (report_id, source_id, field_id) DO NOTHING;

-- 8.7 Nạp Chỉ Số Đã Tính Toán
INSERT INTO public.report_indicators (id, report_id, indicator_definition_id, scope_type, calculated_value, formatted_value, target_status, calculation_details) VALUES
('g0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'global', 78.50, '78.50%', 'warning', '{"total": 770, "online": 605}'::jsonb),
('g0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'global', 99.80, '99.80%', 'achieved', '{"completed": 732, "on_time": 731, "late": 1}'::jsonb)
ON CONFLICT (report_id, indicator_definition_id, scope_type, scope_id) DO NOTHING;

-- 8.8 Nạp Bài Phân Tích Nhận Xét Mẫu
INSERT INTO public.report_analysis (id, report_id, scope_type, title, generated_text, generated_by) VALUES
('h0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'overview', 'Đánh giá tổng quan Tháng 01/2026', 'Tỷ lệ giải quyết hồ sơ đúng và trước hạn đạt 99.8%, vượt chỉ tiêu 98%. Tỷ lệ nộp hồ sơ trực tuyến đạt 78.5%, cần đẩy mạnh tuyên truyền trong lĩnh vực Đất đai.', 'Chuyên viên phân tích')
ON CONFLICT DO NOTHING;

-- 8.9 Nạp Nhật Ký Kiểm Toán Ban Đầu
INSERT INTO public.audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES
('i0000000-0000-0000-0000-000000000001', 'Hệ thống', 'INIT_DATABASE', 'system', '00000000-0000-0000-0000-000000000000', '{"message": "Khởi tạo thành công 11 bảng CSDL TTHC và phân quyền RBAC"}'::jsonb, now())
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 9. KIỂM THỬ XÁC MINH CƠ SỞ DỮ LIỆU TỰ ĐỘNG
-- ==============================================================================
DO $$
DECLARE
  v_units_count INT;
  v_fields_count INT;
  v_reports_count INT;
  v_stats_count INT;
BEGIN
  SELECT count(*) INTO v_units_count FROM public.units;
  SELECT count(*) INTO v_fields_count FROM public.fields;
  SELECT count(*) INTO v_reports_count FROM public.reports;
  SELECT count(*) INTO v_stats_count FROM public.report_field_statistics;

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'XÁC MINH MIGRATION THÀNH CÔNG:';
  RAISE NOTICE '- Số đơn vị: %', v_units_count;
  RAISE NOTICE '- Số lĩnh vực: %', v_fields_count;
  RAISE NOTICE '- Số kỳ báo cáo: %', v_reports_count;
  RAISE NOTICE '- Số bản ghi thống kê: %', v_stats_count;
  RAISE NOTICE '==================================================';
END $$;
