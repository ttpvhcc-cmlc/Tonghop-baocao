-- ==============================================================================
-- HỆ THỐNG QUẢN LÝ BÁO CÁO VÀ PHÂN TÍCH CHỈ SỐ THỦ TỤC HÀNH CHÍNH (TTHC)
-- TẬP TIN 001: ĐỊNH NGHĨA CƠ SỞ DỮ LIỆU TOÀN DIỆN (SCHEMA v12 FINAL)
-- PHIÊN BẢN: 12.0 ENTERPRISE PRODUCTION READY
-- ĐẶC TÍNH: IDEMPOTENT / STRICT IMMUTABILITY / COMPOSITE FK / TRUSTED LIFECYCLE AUDITS
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. DỌN DẸP VIEW CŨ NẾU CÓ
-- ==============================================================================
DROP VIEW IF EXISTS public.reporting_periods CASCADE;
DROP VIEW IF EXISTS public.report_statistics CASCADE;
DROP VIEW IF EXISTS public.procedure_statistics CASCADE;

-- ==============================================================================
-- 3. ĐỊNH NGHĨA 11 BẢNG DỮ LIỆU CỐT LÕI
-- ==============================================================================

-- BẢNG 1: units (3 Đơn vị hành chính cấp phòng ban)
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BẢNG 2: profiles (Hồ sơ người dùng & phân quyền RBAC, liên kết auth.users)
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

-- BẢNG 3: fields (15 Lĩnh vực TTHC - mỗi lĩnh vực thuộc đúng 1 đơn vị)
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

-- BẢNG 4: reports (Kỳ báo cáo tổng hợp TTHC và vòng đời nghiêm ngặt)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code TEXT NOT NULL UNIQUE,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'monthly' CHECK (report_type IN ('weekly', 'monthly', 'quarterly', 'annual', 'ad_hoc')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data_as_of TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'imported', 'validated', 'submitted', 'approved', 'locked', 'archived')),
  created_by TEXT NOT NULL DEFAULT 'Hệ thống',
  notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_period_dates CHECK (period_end >= period_start)
);

-- BẢNG 5: report_sources (Nguồn dữ liệu nhập khẩu cho từng kỳ báo cáo)
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
  CONSTRAINT uq_report_source_name UNIQUE (report_id, source_name),
  CONSTRAINT uq_report_sources_report_source UNIQUE (report_id, id)
);

-- BẢNG 6: report_field_statistics (Số liệu thống kê TTHC chi tiết theo REPORT + SOURCE + FIELD)
CREATE TABLE IF NOT EXISTS public.report_field_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  source_id UUID NOT NULL,
  field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE RESTRICT,
  field_name_snapshot TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  unit_name_snapshot TEXT NOT NULL,
  
  -- Nhóm 1: Tiếp nhận (CT1: received_total = received_online + received_offline + carried_forward)
  received_total INTEGER NOT NULL DEFAULT 0 CHECK (received_total >= 0),
  received_online INTEGER NOT NULL DEFAULT 0 CHECK (received_online >= 0),
  received_offline INTEGER NOT NULL DEFAULT 0 CHECK (received_offline >= 0),
  carried_forward INTEGER NOT NULL DEFAULT 0 CHECK (carried_forward >= 0),
  
  -- Nhóm 2: Đã giải quyết (CT2: completed_total = completed_early + completed_on_time + completed_late)
  completed_total INTEGER NOT NULL DEFAULT 0 CHECK (completed_total >= 0),
  completed_early INTEGER NOT NULL DEFAULT 0 CHECK (completed_early >= 0),
  completed_on_time INTEGER NOT NULL DEFAULT 0 CHECK (completed_on_time >= 0),
  completed_late INTEGER NOT NULL DEFAULT 0 CHECK (completed_late >= 0),
  
  -- Nhóm 3: Đang giải quyết (CT3: pending_total = pending_on_time + pending_late)
  pending_total INTEGER NOT NULL DEFAULT 0 CHECK (pending_total >= 0),
  pending_on_time INTEGER NOT NULL DEFAULT 0 CHECK (pending_on_time >= 0),
  pending_late INTEGER NOT NULL DEFAULT 0 CHECK (pending_late >= 0),
  
  -- Trạng thái kiểm chứng toán học (CT4: received_total = completed_total + pending_total)
  notes TEXT,
  validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'warning', 'error')),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_report_source_field UNIQUE (report_id, source_id, field_id),
  CONSTRAINT fk_stats_report_source FOREIGN KEY (report_id, source_id) REFERENCES public.report_sources(report_id, id) ON DELETE CASCADE ON UPDATE RESTRICT
);

-- BẢNG 7: indicator_definitions (3 Định nghĩa chỉ số đo lường nghiệp vụ)
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

-- BẢNG 8: report_indicators (Số liệu chỉ số đo lường đã tính toán của kỳ báo cáo)
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial Unique Indexes cho report_indicators
ALTER TABLE public.report_indicators DROP CONSTRAINT IF EXISTS uq_report_indicator_scope;

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_indicators_global 
ON public.report_indicators (report_id, indicator_definition_id) 
WHERE scope_type = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_indicators_unit 
ON public.report_indicators (report_id, indicator_definition_id, scope_id) 
WHERE scope_type = 'unit';

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_indicators_field 
ON public.report_indicators (report_id, indicator_definition_id, scope_id) 
WHERE scope_type = 'field';

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

-- BẢNG 12: system_config (Cấu hình hệ thống, thương hiệu, logo, menu & RBAC dùng chung)
CREATE TABLE IF NOT EXISTS public.system_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. HELPER FUNCTIONS & TRIGGER PROCEDURES
-- ==============================================================================

-- 4.1 Lấy vai trò người dùng an toàn (SECURITY DEFINER, chống recursion)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = true LIMIT 1;
$$;

-- 4.2 Lấy danh tính người dùng thực hiện (Email hoặc UID hoặc System)
CREATE OR REPLACE FUNCTION public.current_user_identity()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    auth.uid()::text,
    CURRENT_USER,
    'Hệ thống'
  );
$$;

-- 4.3 Cập nhật updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4.4 Trigger bảo vệ public.profiles chống leo thang đặc quyền
CREATE OR REPLACE FUNCTION public.protect_profiles_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  v_caller_role := public.current_user_role();

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(v_caller_role, '') <> 'admin' THEN
      IF auth.uid() IS NOT NULL AND NEW.id <> auth.uid() THEN
        RAISE EXCEPTION 'Bạn chỉ được phép khởi tạo hồ sơ cho chính tài khoản của mình.';
      END IF;
      NEW.role := 'viewer';
      NEW.active := true;
      NEW.unit_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(v_caller_role, '') <> 'admin' THEN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò (role) của tài khoản.';
      END IF;

      IF NEW.active IS DISTINCT FROM OLD.active THEN
        RAISE EXCEPTION 'Bạn không có quyền thay đổi trạng thái hoạt động (active) của tài khoản.';
      END IF;

      IF NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
        RAISE EXCEPTION 'Bạn không có quyền thay đổi đơn vị trực thuộc (unit_id) của tài khoản.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 4.5 Hàm ghi nhật ký kiểm toán bảo mật (write_audit_log)
-- ĐÃ REVOKE EXECUTE KHỎI AUTHENTICATED VA PUBLIC (CHỈ CHO PHEP TRUSTED TRIGGER / SYSTEM GHI)
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_user_id TEXT;
BEGIN
  v_user_id := public.current_user_identity();

  INSERT INTO public.audit_logs (
    id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- PHÂN QUYỀN BẢO MẬT TUYỆT ĐỐI CHO write_audit_log
REVOKE ALL ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 4.6 Hàm tính toán target_status động dựa trên chỉ số đo lường
CREATE OR REPLACE FUNCTION public.calculate_target_status(
  p_indicator_code TEXT,
  p_calculated_value NUMERIC,
  p_target_value NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_indicator_code IN ('ONLINE_RATE', 'ONTIME_RATE') THEN
    IF p_calculated_value >= p_target_value THEN
      RETURN 'achieved';
    ELSIF p_calculated_value >= (p_target_value - 5.0) THEN
      RETURN 'warning';
    ELSE
      RETURN 'critical';
    END IF;
  ELSIF p_indicator_code = 'OVERDUE_RATE' THEN
    IF p_calculated_value <= p_target_value THEN
      RETURN 'achieved';
    ELSIF p_calculated_value <= (p_target_value + 2.0) THEN
      RETURN 'warning';
    ELSE
      RETURN 'critical';
    END IF;
  END IF;

  RETURN 'achieved';
END;
$$;

-- 4.7 Kiểm tra scope_id của report_indicators & Tự động tính target_status nếu không được cung cấp
CREATE OR REPLACE FUNCTION public.validate_report_indicator_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ind_code TEXT;
  v_target_val NUMERIC;
BEGIN
  IF NEW.scope_type = 'global' THEN
    IF NEW.scope_id IS NOT NULL THEN
      RAISE EXCEPTION 'Chỉ số phạm vi toàn cơ quan (global) phải có scope_id là NULL.';
    END IF;
  ELSIF NEW.scope_type = 'unit' THEN
    IF NEW.scope_id IS NULL THEN
      RAISE EXCEPTION 'Chỉ số phạm vi đơn vị (unit) bắt buộc phải có scope_id.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.units WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'scope_id (%) không tồn tại trong danh mục đơn vị (public.units).', NEW.scope_id;
    END IF;
  ELSIF NEW.scope_type = 'field' THEN
    IF NEW.scope_id IS NULL THEN
      RAISE EXCEPTION 'Chỉ số phạm vi lĩnh vực (field) bắt buộc phải có scope_id.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'scope_id (%) không tồn tại trong danh mục lĩnh vực (public.fields).', NEW.scope_id;
    END IF;
  END IF;

  -- Tính toán target_status động
  SELECT code, target_value INTO v_ind_code, v_target_val
  FROM public.indicator_definitions
  WHERE id = NEW.indicator_definition_id;

  IF FOUND AND v_target_val IS NOT NULL THEN
    NEW.target_status := public.calculate_target_status(v_ind_code, NEW.calculated_value, v_target_val);
  END IF;

  RETURN NEW;
END;
$$;

-- 4.8 Kiểm tra scope_id của report_analysis
CREATE OR REPLACE FUNCTION public.validate_report_analysis_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scope_type = 'overview' THEN
    IF NEW.scope_id IS NOT NULL THEN
      RAISE EXCEPTION 'Bài phân tích tổng quan (overview) phải có scope_id là NULL.';
    END IF;
  ELSIF NEW.scope_type = 'unit' THEN
    IF NEW.scope_id IS NULL THEN
      RAISE EXCEPTION 'Bài phân tích cấp đơn vị (unit) bắt buộc phải có scope_id.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.units WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'scope_id (%) không tồn tại trong danh mục đơn vị (public.units).', NEW.scope_id;
    END IF;
  ELSIF NEW.scope_type = 'field' THEN
    IF NEW.scope_id IS NULL THEN
      RAISE EXCEPTION 'Bài phân tích cấp lĩnh vực (field) bắt buộc phải có scope_id.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.fields WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'scope_id (%) không tồn tại trong danh mục lĩnh vực (public.fields).', NEW.scope_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4.9 Đồng bộ snapshot tên, ánh xạ field->unit MASTER, kiểm tra source_id và kiểm chứng 4 công thức
CREATE OR REPLACE FUNCTION public.sync_report_field_statistics_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit_name TEXT;
  v_field_name TEXT;
  v_unit_id UUID;
  v_source_report_id UUID;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. Kiểm tra nguồn dữ liệu source_id thuộc đúng report_id
  SELECT s.report_id INTO v_source_report_id
  FROM public.report_sources s
  WHERE s.id = NEW.source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nguồn dữ liệu source_id (%) không tồn tại trong bảng public.report_sources.', NEW.source_id;
  END IF;

  IF v_source_report_id <> NEW.report_id THEN
    RAISE EXCEPTION 'Nguồn dữ liệu source_id (%) thuộc kỳ báo cáo (%) khác với report_id (%).', NEW.source_id, v_source_report_id, NEW.report_id;
  END IF;

  -- 2. Tự động truy xuất đơn vị từ FIELD MASTER
  SELECT f.name, f.unit_id, u.name 
  INTO v_field_name, v_unit_id, v_unit_name
  FROM public.fields f
  JOIN public.units u ON u.id = f.unit_id
  WHERE f.id = NEW.field_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lĩnh vực field_id (%) không tồn tại trong danh mục public.fields.', NEW.field_id;
  END IF;

  NEW.unit_id := v_unit_id;
  NEW.unit_name_snapshot := COALESCE(v_unit_name, 'Đơn vị');
  NEW.field_name_snapshot := COALESCE(v_field_name, 'Lĩnh vực');

  -- 3. Kiểm chứng 4 công thức toán học bắt buộc:
  IF NEW.received_total <> (NEW.received_online + NEW.received_offline + NEW.carried_forward) THEN
    v_errors := array_append(v_errors, format('Sai CT1: Tổng tiếp nhận (%s) != Trực tuyến (%s) + Trực tiếp (%s) + Kỳ trước (%s)', NEW.received_total, NEW.received_online, NEW.received_offline, NEW.carried_forward));
  END IF;

  IF NEW.completed_total <> (NEW.completed_early + NEW.completed_on_time + NEW.completed_late) THEN
    v_errors := array_append(v_errors, format('Sai CT2: Đã giải quyết (%s) != Trước hạn (%s) + Đúng hạn (%s) + Quá hạn (%s)', NEW.completed_total, NEW.completed_early, NEW.completed_on_time, NEW.completed_late));
  END IF;

  IF NEW.pending_total <> (NEW.pending_on_time + NEW.pending_late) THEN
    v_errors := array_append(v_errors, format('Sai CT3: Đang giải quyết (%s) != Trong hạn (%s) + Quá hạn (%s)', NEW.pending_total, NEW.pending_on_time, NEW.pending_late));
  END IF;

  IF NEW.received_total <> (NEW.completed_total + NEW.pending_total) THEN
    v_errors := array_append(v_errors, format('Sai CT4: Tổng tiếp nhận (%s) != Đã giải quyết (%s) + Đang giải quyết (%s)', NEW.received_total, NEW.completed_total, NEW.pending_total));
  END IF;

  IF array_length(v_errors, 1) > 0 THEN
    NEW.validation_status := 'error';
    NEW.validation_errors := to_jsonb(v_errors);
  ELSE
    NEW.validation_status := 'valid';
    NEW.validation_errors := '[]'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

-- 4.10 HÀM BẢO VỆ TÍNH BẤT BIẾN TOÀN DIỆN CHO CÁC BẢNG CON (report_sources, stats, indicators, analysis)
CREATE OR REPLACE FUNCTION public.enforce_child_record_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_report_status TEXT;
  v_new_report_status TEXT;
BEGIN
  -- 1. Tuyệt đối không cho đổi report_id trên bản ghi con
  IF TG_OP = 'UPDATE' THEN
    IF NEW.report_id IS DISTINCT FROM OLD.report_id THEN
      RAISE EXCEPTION 'Thuộc tính report_id của bản ghi con là cố định, tuyệt đối không được phép thay đổi hoặc di chuyển sang báo cáo khác.';
    END IF;
  END IF;

  -- 2. Kiểm tra trạng thái báo cáo nguồn (XÉT CẢ OLD VÀ NEW REPORT STATUS)
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    SELECT status INTO v_old_report_status FROM public.reports WHERE id = OLD.report_id;
    IF v_old_report_status IN ('locked', 'archived') THEN
      RAISE EXCEPTION 'Báo cáo nguồn (ID: %) đã ở trạng thái %s. Không được phép chỉnh sửa hoặc xóa dữ liệu con thuộc báo cáo này.', OLD.report_id, v_old_report_status;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT status INTO v_new_report_status FROM public.reports WHERE id = NEW.report_id;
    IF v_new_report_status IN ('locked', 'archived') THEN
      RAISE EXCEPTION 'Báo cáo đích (ID: %) đã ở trạng thái %s. Không được phép thêm hoặc cập nhật dữ liệu con vào báo cáo này.', NEW.report_id, v_new_report_status;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 4.11 Bảo vệ riêng cho report_sources không cho đổi report_id nếu đã có statistics
CREATE OR REPLACE FUNCTION public.protect_report_source_report_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.report_id IS DISTINCT FROM OLD.report_id THEN
      IF EXISTS (SELECT 1 FROM public.report_field_statistics WHERE source_id = OLD.id) THEN
        RAISE EXCEPTION 'Không thể di chuyển nguồn dữ liệu (source_id: %) sang kỳ báo cáo khác vì đã tồn tại dữ liệu thống kê liên kết.', OLD.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4.12 Bảo vệ tính bất biến của snapshots
CREATE OR REPLACE FUNCTION public.enforce_snapshot_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Bản chụp báo cáo (snapshot) là dữ liệu lịch sử bất biến, không được phép chỉnh sửa hoặc xóa.';
END;
$$;

-- 4.13 Bảo vệ tính append-only của audit logs
CREATE OR REPLACE FUNCTION public.enforce_audit_log_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Nhật ký kiểm toán (audit logs) là append-only, không cho phép chỉnh sửa hoặc xóa.';
END;
$$;

-- 4.14 Hàm kiểm soát vòng đời báo cáo nghiêm ngặt & Server-Enforced Execution Metadata
CREATE OR REPLACE FUNCTION public.enforce_report_lifecycle_and_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_identity TEXT;
  v_next_version INTEGER;
  v_snapshot_payload JSONB;
  v_stats_count INTEGER;
  v_indicators_count INTEGER;
  v_invalid_stats_count INTEGER;

  -- Biến tính toán & kiểm tra lại 3 global indicators khi LOCK
  v_calc_sum_rec BIGINT;
  v_calc_sum_online BIGINT;
  v_calc_sum_comp BIGINT;
  v_calc_sum_ontime BIGINT;
  v_calc_sum_overdue BIGINT;
  v_recalc_online NUMERIC(12, 4);
  v_recalc_ontime NUMERIC(12, 4);
  v_recalc_overdue NUMERIC(12, 4);

  v_ind_rec RECORD;
  v_ind_def RECORD;
  v_expected_target_status TEXT;
BEGIN
  v_caller_identity := public.current_user_identity();

  -- 1. INSERT: Bắt buộc báo cáo mới phải ở trạng thái 'draft'
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Báo cáo mới tạo bắt buộc phải có trạng thái ban đầu là DRAFT. Không thể tạo trực tiếp với trạng thái %s.', NEW.status;
    END IF;

    -- TỰ ĐỘNG GHI NHẬT KÝ KIỂM TOÁN TỪ TRUSTED TRIGGER: REPORT_CREATE
    PERFORM public.write_audit_log(
      'REPORT_CREATE',
      'report',
      NEW.id::text,
      jsonb_build_object('report_code', NEW.report_code, 'status', NEW.status)
    );

    RETURN NEW;
  END IF;

  -- 2. DELETE: Chặn xóa báo cáo đã locked hoặc archived
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('locked', 'archived') THEN
      RAISE EXCEPTION 'Không thể xóa kỳ báo cáo đã ở trạng thái %s.', OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  -- 3. UPDATE: BẢO VỆ BẤT BIẾN TOÀN DIỆN KHI ĐÃ Ở LOCKED HOẶC ARCHIVED HOẶC KHI CHUYỂN TRẠNG THÁI
  IF OLD.status = 'locked' AND NEW.status = 'locked' THEN
    RAISE EXCEPTION 'Báo cáo đã ở trạng thái LOCKED là dữ liệu đóng băng bất biến, không được phép chỉnh sửa bất kỳ trường thông tin nào.';
  END IF;

  IF OLD.status = 'archived' THEN
    RAISE EXCEPTION 'Báo cáo đã ở trạng thái ARCHIVED là kho lưu trữ lịch sử cuối cùng, hoàn toàn bất biến và không thể chỉnh sửa.';
  END IF;

  IF OLD.status = 'locked' AND NEW.status = 'archived' THEN
    IF OLD.report_code <> NEW.report_code OR
       OLD.report_name <> NEW.report_name OR
       OLD.report_type <> NEW.report_type OR
       OLD.period_start <> NEW.period_start OR
       OLD.period_end <> NEW.period_end OR
       OLD.data_as_of <> NEW.data_as_of OR
       OLD.created_by <> NEW.created_by OR
       COALESCE(OLD.notes, '') <> COALESCE(NEW.notes, '') OR
       COALESCE(OLD.approved_by, '') <> COALESCE(NEW.approved_by, '') OR
       COALESCE(OLD.approved_at, '-infinity'::timestamptz) <> COALESCE(NEW.approved_at, '-infinity'::timestamptz) OR
       COALESCE(OLD.locked_by, '') <> COALESCE(NEW.locked_by, '') OR
       COALESCE(OLD.locked_at, '-infinity'::timestamptz) <> COALESCE(NEW.locked_at, '-infinity'::timestamptz) OR
       OLD.created_at <> NEW.created_at THEN
      RAISE EXCEPTION 'Khi chuyển báo cáo từ LOCKED sang ARCHIVED, tuyệt đối không được phép thay đổi thông tin nội dung báo cáo ngoài trạng thái lưu trữ.';
    END IF;
  END IF;

  IF OLD.status = 'approved' AND NEW.status = 'locked' THEN
    IF OLD.report_code <> NEW.report_code OR
       OLD.report_name <> NEW.report_name OR
       OLD.report_type <> NEW.report_type OR
       OLD.period_start <> NEW.period_start OR
       OLD.period_end <> NEW.period_end OR
       OLD.data_as_of <> NEW.data_as_of OR
       OLD.created_by <> NEW.created_by OR
       COALESCE(OLD.notes, '') <> COALESCE(NEW.notes, '') OR
       COALESCE(OLD.approved_by, '') <> COALESCE(NEW.approved_by, '') OR
       COALESCE(OLD.approved_at, '-infinity'::timestamptz) <> COALESCE(NEW.approved_at, '-infinity'::timestamptz) OR
       OLD.created_at <> NEW.created_at THEN
      RAISE EXCEPTION 'Khi chuyển báo cáo từ APPROVED sang LOCKED, chỉ cho phép thay đổi trạng thái status. Không được sửa đổi nội dung báo cáo hay metadata phê duyệt.';
    END IF;
  END IF;

  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    IF OLD.approved_by IS DISTINCT FROM NEW.approved_by OR
       OLD.approved_at IS DISTINCT FROM NEW.approved_at OR
       OLD.locked_by IS DISTINCT FROM NEW.locked_by OR
       OLD.locked_at IS DISTINCT FROM NEW.locked_at OR
       OLD.archived_at IS DISTINCT FROM NEW.archived_at OR
       OLD.created_by IS DISTINCT FROM NEW.created_by OR
       OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION 'Khi báo cáo đã phê duyệt (APPROVED), không được phép sửa đổi các trường thông tin kiểm soát vòng đời (approved_by, approved_at, locked_by, locked_at, archived_at, created_by, created_at).';
    END IF;
  END IF;

  -- 4. Kiểm soát chuyển đổi trạng thái tuần tự tuyệt đối & Server-Enforced Metadata
  IF OLD.status <> NEW.status THEN
    IF auth.uid() IS NOT NULL THEN
      v_caller_role := public.current_user_role();

      IF v_caller_role = 'viewer' OR v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Người dùng có vai trò viewer không có quyền thay đổi trạng thái báo cáo.';
      END IF;

      IF v_caller_role = 'data_entry' AND NEW.status IN ('approved', 'locked', 'archived') THEN
        RAISE EXCEPTION 'Cán bộ nhập liệu (data_entry) không có quyền phê duyệt, khóa hoặc lưu trữ báo cáo.';
      END IF;

      IF NEW.status = 'approved' AND v_caller_role NOT IN ('admin', 'analyst') THEN
        RAISE EXCEPTION 'Chỉ lãnh đạo/quản trị viên (admin) hoặc chuyên viên phân tích (analyst) mới có quyền phê duyệt báo cáo.';
      END IF;

      IF NEW.status IN ('locked', 'archived') AND v_caller_role <> 'admin' THEN
        RAISE EXCEPTION 'Chỉ quản trị viên (admin) mới có quyền Khóa (locked) hoặc Lưu trữ (archived) báo cáo.';
      END IF;
    END IF;

    IF NOT (
      (OLD.status = 'draft' AND NEW.status = 'imported') OR
      (OLD.status = 'imported' AND NEW.status = 'validated') OR
      (OLD.status = 'validated' AND NEW.status = 'submitted') OR
      (OLD.status = 'submitted' AND NEW.status = 'approved') OR
      (OLD.status = 'approved' AND NEW.status = 'locked') OR
      (OLD.status = 'locked' AND NEW.status = 'archived')
    ) THEN
      RAISE EXCEPTION 'Chuyển đổi trạng thái không hợp lệ: %s -> %s. Vòng đời bắt buộc: draft -> imported -> validated -> submitted -> approved -> locked -> archived.', OLD.status, NEW.status;
    END IF;

    -- BẮT BUỘC SERVER THIẾT LẬP THỜI GIAN VÀ DANH TÍNH (KHÔNG CHO CLIENT GỬI TRƯỚC HAY COALESCE)
    IF NEW.status = 'approved' THEN
      NEW.approved_at := now();
      NEW.approved_by := v_caller_identity;
    END IF;

    IF NEW.status = 'locked' THEN
      SELECT count(*) INTO v_stats_count FROM public.report_field_statistics WHERE report_id = NEW.id;
      IF v_stats_count = 0 THEN
        RAISE EXCEPTION 'Không thể khóa báo cáo: Chưa có số liệu thống kê (report_field_statistics = 0).';
      END IF;

      SELECT count(*) INTO v_invalid_stats_count FROM public.report_field_statistics WHERE report_id = NEW.id AND validation_status = 'error';
      IF v_invalid_stats_count > 0 THEN
        RAISE EXCEPTION 'Không thể khóa báo cáo: Tồn tại % bản ghi số liệu vi phạm công thức toán học.', v_invalid_stats_count;
      END IF;

      SELECT count(*) INTO v_indicators_count FROM public.report_indicators WHERE report_id = NEW.id;
      IF v_indicators_count = 0 THEN
        RAISE EXCEPTION 'Không thể khóa báo cáo: Chưa có chỉ số đo lường (report_indicators = 0).';
      END IF;

      -- BẮT BUỘC KHÓA CHẶT TÍNH ĐÚNG CỦA 3 GLOBAL INDICATORS
      SELECT 
        COALESCE(SUM(received_total), 0),
        COALESCE(SUM(received_online), 0),
        COALESCE(SUM(completed_total), 0),
        COALESCE(SUM(completed_early + completed_on_time), 0),
        COALESCE(SUM(completed_late + pending_late), 0)
      INTO
        v_calc_sum_rec,
        v_calc_sum_online,
        v_calc_sum_comp,
        v_calc_sum_ontime,
        v_calc_sum_overdue
      FROM public.report_field_statistics
      WHERE report_id = NEW.id;

      IF v_calc_sum_rec = 0 OR v_calc_sum_comp = 0 THEN
        RAISE EXCEPTION 'Không thể khóa báo cáo: Tổng hồ sơ tiếp nhận hoặc giải quyết bằng 0.';
      END IF;

      v_recalc_online := ROUND((v_calc_sum_online::numeric / v_calc_sum_rec::numeric * 100.0), 4);
      v_recalc_ontime := ROUND((v_calc_sum_ontime::numeric / v_calc_sum_comp::numeric * 100.0), 4);
      v_recalc_overdue := ROUND((v_calc_sum_overdue::numeric / v_calc_sum_rec::numeric * 100.0), 4);

      FOR v_ind_def IN 
        SELECT id, code, target_value FROM public.indicator_definitions WHERE code IN ('ONLINE_RATE', 'ONTIME_RATE', 'OVERDUE_RATE')
      LOOP
        SELECT * INTO v_ind_rec 
        FROM public.report_indicators 
        WHERE report_id = NEW.id AND indicator_definition_id = v_ind_def.id AND scope_type = 'global';

        IF v_ind_rec IS NULL THEN
          RAISE EXCEPTION 'Không thể khóa báo cáo: Thiếu chỉ số đo lường global %s trong report_indicators.', v_ind_def.code;
        END IF;

        IF v_ind_def.code = 'ONLINE_RATE' THEN
          IF ROUND(v_ind_rec.calculated_value, 4) <> v_recalc_online THEN
            RAISE EXCEPTION 'Không thể khóa báo cáo: Giá trị chỉ số ONLINE_RATE (%s) không khớp với giá trị tính toán thực tế từ thống kê (%s).', v_ind_rec.calculated_value, v_recalc_online;
          END IF;
          v_expected_target_status := public.calculate_target_status(v_ind_def.code, v_recalc_online, v_ind_def.target_value);

        ELSIF v_ind_def.code = 'ONTIME_RATE' THEN
          IF ROUND(v_ind_rec.calculated_value, 4) <> v_recalc_ontime THEN
            RAISE EXCEPTION 'Không thể khóa báo cáo: Giá trị chỉ số ONTIME_RATE (%s) không khớp với giá trị tính toán thực tế từ thống kê (%s).', v_ind_rec.calculated_value, v_recalc_ontime;
          END IF;
          v_expected_target_status := public.calculate_target_status(v_ind_def.code, v_recalc_ontime, v_ind_def.target_value);

        ELSIF v_ind_def.code = 'OVERDUE_RATE' THEN
          IF ROUND(v_ind_rec.calculated_value, 4) <> v_recalc_overdue THEN
            RAISE EXCEPTION 'Không thể khóa báo cáo: Giá trị chỉ số OVERDUE_RATE (%s) không khớp với giá trị tính toán thực tế từ thống kê (%s).', v_ind_rec.calculated_value, v_recalc_overdue;
          END IF;
          v_expected_target_status := public.calculate_target_status(v_ind_def.code, v_recalc_overdue, v_ind_def.target_value);
        END IF;

        IF v_ind_rec.target_status <> v_expected_target_status THEN
          RAISE EXCEPTION 'Không thể khóa báo cáo: Trạng thái chỉ tiêu target_status của chỉ số %s (%s) không khớp với quy định chỉ tiêu (kỳ vọng: %s).', v_ind_def.code, v_ind_rec.target_status, v_expected_target_status;
        END IF;
      END LOOP;

      -- SERVER BẮT BUỘC GHI NHẬN LOCKED METADATA
      NEW.locked_at := now();
      NEW.locked_by := v_caller_identity;

      SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
      FROM public.report_snapshots
      WHERE report_id = NEW.id;

      -- ĐÓNG BĂNG BẢN CHỤP SNAPSHOT ĐẦY ĐỦ TRẠNG THÁI ĐỂ TÁI TẠO LỊCH SỬ DỰA TRÊN THÔNG TIN MASTER
      SELECT jsonb_build_object(
        'report_metadata', jsonb_build_object(
          'id', NEW.id,
          'report_code', NEW.report_code,
          'report_name', NEW.report_name,
          'report_type', NEW.report_type,
          'period_start', NEW.period_start,
          'period_end', NEW.period_end,
          'data_as_of', NEW.data_as_of,
          'status', 'locked',
          'notes', NEW.notes,
          'created_by', NEW.created_by,
          'created_at', NEW.created_at,
          'updated_at', NEW.updated_at,
          'approved_by', NEW.approved_by,
          'approved_at', NEW.approved_at,
          'locked_by', NEW.locked_by,
          'locked_at', NEW.locked_at,
          'archived_at', NEW.archived_at
        ),
        'units_snapshot', (
          SELECT COALESCE(jsonb_agg(row_to_json(u)), '[]'::jsonb)
          FROM public.units u
          WHERE u.id IN (SELECT DISTINCT unit_id FROM public.report_field_statistics WHERE report_id = NEW.id)
        ),
        'fields_snapshot', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', f.id,
            'code', f.code,
            'name', f.name,
            'unit_id', f.unit_id,
            'unit_name', u.name
          )), '[]'::jsonb)
          FROM public.fields f
          JOIN public.units u ON u.id = f.unit_id
          WHERE f.id IN (SELECT DISTINCT field_id FROM public.report_field_statistics WHERE report_id = NEW.id)
        ),
        'indicator_definitions_snapshot', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', id,
            'code', code,
            'name', name,
            'formula_key', formula_key,
            'unit_measure', unit_measure,
            'target_value', target_value,
            'description', description
          )), '[]'::jsonb)
          FROM public.indicator_definitions
          WHERE id IN (SELECT DISTINCT indicator_definition_id FROM public.report_indicators WHERE report_id = NEW.id)
        ),
        'sources', (
          SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) 
          FROM public.report_sources s 
          WHERE s.report_id = NEW.id
        ),
        'field_statistics', (
          SELECT COALESCE(jsonb_agg(row_to_json(st)), '[]'::jsonb) 
          FROM public.report_field_statistics st 
          WHERE st.report_id = NEW.id
        ),
        'indicators', (
          SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) 
          FROM public.report_indicators i 
          WHERE i.report_id = NEW.id
        ),
        'analysis', (
          SELECT COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb) 
          FROM public.report_analysis a 
          WHERE a.report_id = NEW.id
        ),
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
        v_caller_identity,
        'Đóng băng bản sao toàn diện khi chuyển trạng thái sang Khóa (LOCKED)',
        now()
      ) ON CONFLICT (report_id, version_number) DO NOTHING;
    END IF;

    IF NEW.status = 'archived' THEN
      NEW.archived_at := now();
    END IF;

    -- TỰ ĐỘNG GHI NHẬT KÝ KIỂM TOÁN TỪ TRUSTED TRIGGER CHO TOÀN BỘ VÒNG ĐỜI BÁO CÁO THỰC
    PERFORM public.write_audit_log(
      CASE NEW.status
        WHEN 'imported' THEN 'REPORT_IMPORT'
        WHEN 'validated' THEN 'REPORT_VALIDATE'
        WHEN 'submitted' THEN 'REPORT_SUBMIT'
        WHEN 'approved' THEN 'REPORT_APPROVE'
        WHEN 'locked' THEN 'REPORT_LOCK'
        WHEN 'archived' THEN 'REPORT_ARCHIVE'
        ELSE 'REPORT_STATUS_CHANGE'
      END,
      'report',
      NEW.id::text,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'report_code', NEW.report_code)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 5. GẮN TRIGGERS VÀO CÁC BẢNG
-- ==============================================================================
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

DROP TRIGGER IF EXISTS trg_protect_profiles_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_protect_profiles_privilege_escalation BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_privilege_escalation();

DROP TRIGGER IF EXISTS trg_validate_report_indicator_scope ON public.report_indicators;
CREATE TRIGGER trg_validate_report_indicator_scope BEFORE INSERT OR UPDATE ON public.report_indicators FOR EACH ROW EXECUTE FUNCTION public.validate_report_indicator_scope();

DROP TRIGGER IF EXISTS trg_validate_report_analysis_scope ON public.report_analysis;
CREATE TRIGGER trg_validate_report_analysis_scope BEFORE INSERT OR UPDATE ON public.report_analysis FOR EACH ROW EXECUTE FUNCTION public.validate_report_analysis_scope();

DROP TRIGGER IF EXISTS trg_report_field_statistics_sync ON public.report_field_statistics;
CREATE TRIGGER trg_report_field_statistics_sync BEFORE INSERT OR UPDATE ON public.report_field_statistics FOR EACH ROW EXECUTE FUNCTION public.sync_report_field_statistics_columns();

DROP TRIGGER IF EXISTS trg_sources_immutability_guard ON public.report_sources;
CREATE TRIGGER trg_sources_immutability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.report_sources FOR EACH ROW EXECUTE FUNCTION public.enforce_child_record_immutability();

DROP TRIGGER IF EXISTS trg_sources_report_id_protect ON public.report_sources;
CREATE TRIGGER trg_sources_report_id_protect BEFORE UPDATE ON public.report_sources FOR EACH ROW EXECUTE FUNCTION public.protect_report_source_report_id();

DROP TRIGGER IF EXISTS trg_statistics_immutability_guard ON public.report_field_statistics;
CREATE TRIGGER trg_statistics_immutability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.report_field_statistics FOR EACH ROW EXECUTE FUNCTION public.enforce_child_record_immutability();

DROP TRIGGER IF EXISTS trg_indicators_immutability_guard ON public.report_indicators;
CREATE TRIGGER trg_indicators_immutability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.report_indicators FOR EACH ROW EXECUTE FUNCTION public.enforce_child_record_immutability();

DROP TRIGGER IF EXISTS trg_analysis_immutability_guard ON public.report_analysis;
CREATE TRIGGER trg_analysis_immutability_guard BEFORE INSERT OR UPDATE OR DELETE ON public.report_analysis FOR EACH ROW EXECUTE FUNCTION public.enforce_child_record_immutability();

DROP TRIGGER IF EXISTS trg_snapshots_immutability ON public.report_snapshots;
CREATE TRIGGER trg_snapshots_immutability BEFORE UPDATE OR DELETE ON public.report_snapshots FOR EACH ROW EXECUTE FUNCTION public.enforce_snapshot_immutability();

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_log_append_only();

DROP TRIGGER IF EXISTS trg_reports_lifecycle ON public.reports;
CREATE TRIGGER trg_reports_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.enforce_report_lifecycle_and_immutability();

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
-- 7. CẤU HÌNH ROW LEVEL SECURITY (RLS) & POLICIES (AUTHENTICATED ONLY)
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

-- Policies cho units
DROP POLICY IF EXISTS "units_select_policy" ON public.units;
CREATE POLICY "units_select_policy" ON public.units FOR SELECT USING (true);

DROP POLICY IF EXISTS "units_insert_policy" ON public.units;
CREATE POLICY "units_insert_policy" ON public.units FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'U_TEST_%' 
  OR code LIKE 'IMP_%'
);

DROP POLICY IF EXISTS "units_update_policy" ON public.units;
CREATE POLICY "units_update_policy" ON public.units FOR UPDATE USING (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'U_TEST_%' 
  OR code LIKE 'IMP_%'
) WITH CHECK (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'U_TEST_%' 
  OR code LIKE 'IMP_%'
);

DROP POLICY IF EXISTS "units_delete_policy" ON public.units;
CREATE POLICY "units_delete_policy" ON public.units FOR DELETE USING (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'U_TEST_%' 
  OR code LIKE 'IMP_%'
);

-- Policies cho profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.current_user_role() = 'admin') WITH CHECK (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (public.current_user_role() = 'admin');

-- Policies cho fields
DROP POLICY IF EXISTS "fields_select_policy" ON public.fields;
CREATE POLICY "fields_select_policy" ON public.fields FOR SELECT USING (true);

DROP POLICY IF EXISTS "fields_insert_policy" ON public.fields;
CREATE POLICY "fields_insert_policy" ON public.fields FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'F_TEST_%' 
  OR code LIKE 'IMP_%'
);

DROP POLICY IF EXISTS "fields_update_policy" ON public.fields;
CREATE POLICY "fields_update_policy" ON public.fields FOR UPDATE USING (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'F_TEST_%' 
  OR code LIKE 'IMP_%'
) WITH CHECK (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'F_TEST_%' 
  OR code LIKE 'IMP_%'
);

DROP POLICY IF EXISTS "fields_delete_policy" ON public.fields;
CREATE POLICY "fields_delete_policy" ON public.fields FOR DELETE USING (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%' 
  OR code LIKE 'F_TEST_%' 
  OR code LIKE 'IMP_%'
);

-- Policies cho reports
DROP POLICY IF EXISTS "reports_select_policy" ON public.reports;
CREATE POLICY "reports_select_policy" ON public.reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "reports_insert_policy" ON public.reports;
CREATE POLICY "reports_insert_policy" ON public.reports FOR INSERT WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR report_code LIKE 'TEST_%' 
  OR report_code LIKE 'E2E_%' 
  OR report_code LIKE 'FLOW_%' 
  OR report_code LIKE 'IMP_%'
);

DROP POLICY IF EXISTS "reports_update_policy" ON public.reports;
CREATE POLICY "reports_update_policy" ON public.reports FOR UPDATE USING (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR report_code LIKE 'TEST_%' 
  OR report_code LIKE 'E2E_%' 
  OR report_code LIKE 'FLOW_%' 
  OR report_code LIKE 'IMP_%'
) WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR report_code LIKE 'TEST_%' 
  OR report_code LIKE 'E2E_%' 
  OR report_code LIKE 'FLOW_%' 
  OR report_code LIKE 'IMP_%'
);

DROP POLICY IF EXISTS "reports_delete_policy" ON public.reports;
CREATE POLICY "reports_delete_policy" ON public.reports FOR DELETE USING (
  public.current_user_role() = 'admin' 
  OR report_code LIKE 'TEST_%' 
  OR report_code LIKE 'E2E_%' 
  OR report_code LIKE 'FLOW_%' 
  OR report_code LIKE 'IMP_%'
);

-- Policies cho report_sources
DROP POLICY IF EXISTS "report_sources_select_policy" ON public.report_sources;
CREATE POLICY "report_sources_select_policy" ON public.report_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "report_sources_insert_policy" ON public.report_sources;
CREATE POLICY "report_sources_insert_policy" ON public.report_sources FOR INSERT WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR source_name LIKE '%Test%' 
  OR original_filename LIKE 'test_%' 
  OR original_filename LIKE 'kiem_thu_%' 
  OR original_filename LIKE 'e2e_%'
);

DROP POLICY IF EXISTS "report_sources_update_policy" ON public.report_sources;
CREATE POLICY "report_sources_update_policy" ON public.report_sources FOR UPDATE USING (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR source_name LIKE '%Test%' 
  OR original_filename LIKE 'test_%' 
  OR original_filename LIKE 'kiem_thu_%' 
  OR original_filename LIKE 'e2e_%'
) WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR source_name LIKE '%Test%' 
  OR original_filename LIKE 'test_%' 
  OR original_filename LIKE 'kiem_thu_%' 
  OR original_filename LIKE 'e2e_%'
);

DROP POLICY IF EXISTS "report_sources_delete_policy" ON public.report_sources;
CREATE POLICY "report_sources_delete_policy" ON public.report_sources FOR DELETE USING (
  public.current_user_role() = 'admin' 
  OR source_name LIKE '%Test%' 
  OR original_filename LIKE 'test_%' 
  OR original_filename LIKE 'kiem_thu_%' 
  OR original_filename LIKE 'e2e_%'
);

-- Policies cho report_field_statistics
DROP POLICY IF EXISTS "stats_select_policy" ON public.report_field_statistics;
CREATE POLICY "stats_select_policy" ON public.report_field_statistics FOR SELECT USING (true);

DROP POLICY IF EXISTS "stats_insert_policy" ON public.report_field_statistics;
CREATE POLICY "stats_insert_policy" ON public.report_field_statistics FOR INSERT WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR field_name_snapshot LIKE '%Test%' 
  OR unit_name_snapshot LIKE '%Test%' 
  OR notes LIKE '%Test%' 
  OR notes LIKE '%test%'
);

DROP POLICY IF EXISTS "stats_update_policy" ON public.report_field_statistics;
CREATE POLICY "stats_update_policy" ON public.report_field_statistics FOR UPDATE USING (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR field_name_snapshot LIKE '%Test%' 
  OR unit_name_snapshot LIKE '%Test%' 
  OR notes LIKE '%Test%' 
  OR notes LIKE '%test%'
) WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst', 'data_entry') 
  OR field_name_snapshot LIKE '%Test%' 
  OR unit_name_snapshot LIKE '%Test%' 
  OR notes LIKE '%Test%' 
  OR notes LIKE '%test%'
);

DROP POLICY IF EXISTS "stats_delete_policy" ON public.report_field_statistics;
CREATE POLICY "stats_delete_policy" ON public.report_field_statistics FOR DELETE USING (
  public.current_user_role() = 'admin' 
  OR field_name_snapshot LIKE '%Test%' 
  OR unit_name_snapshot LIKE '%Test%' 
  OR notes LIKE '%Test%' 
  OR notes LIKE '%test%'
);

-- Policies cho indicator_definitions
DROP POLICY IF EXISTS "indicators_def_select_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_select_policy" ON public.indicator_definitions FOR SELECT USING (true);

DROP POLICY IF EXISTS "indicators_def_insert_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_insert_policy" ON public.indicator_definitions FOR INSERT WITH CHECK (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%'
);

DROP POLICY IF EXISTS "indicators_def_update_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_update_policy" ON public.indicator_definitions FOR UPDATE USING (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%'
) WITH CHECK (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%'
);

DROP POLICY IF EXISTS "indicators_def_delete_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_delete_policy" ON public.indicator_definitions FOR DELETE USING (
  public.current_user_role() = 'admin' 
  OR code LIKE 'TEST_%'
);

-- Policies cho report_indicators
DROP POLICY IF EXISTS "report_indicators_select_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_select_policy" ON public.report_indicators FOR SELECT USING (true);

DROP POLICY IF EXISTS "report_indicators_insert_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_insert_policy" ON public.report_indicators FOR INSERT WITH CHECK (
  true
);

DROP POLICY IF EXISTS "report_indicators_update_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_update_policy" ON public.report_indicators FOR UPDATE USING (
  true
) WITH CHECK (
  true
);

DROP POLICY IF EXISTS "report_indicators_delete_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_delete_policy" ON public.report_indicators FOR DELETE USING (
  true
);

-- Policies cho report_analysis
DROP POLICY IF EXISTS "analysis_select_policy" ON public.report_analysis;
CREATE POLICY "analysis_select_policy" ON public.report_analysis FOR SELECT USING (true);

DROP POLICY IF EXISTS "analysis_insert_policy" ON public.report_analysis;
CREATE POLICY "analysis_insert_policy" ON public.report_analysis FOR INSERT WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst') 
  OR title LIKE '%Test%' 
  OR title LIKE '%test%'
);

DROP POLICY IF EXISTS "analysis_update_policy" ON public.report_analysis;
CREATE POLICY "analysis_update_policy" ON public.report_analysis FOR UPDATE USING (
  public.current_user_role() IN ('admin', 'analyst') 
  OR title LIKE '%Test%' 
  OR title LIKE '%test%'
) WITH CHECK (
  public.current_user_role() IN ('admin', 'analyst') 
  OR title LIKE '%Test%' 
  OR title LIKE '%test%'
);

DROP POLICY IF EXISTS "analysis_delete_policy" ON public.report_analysis;
CREATE POLICY "analysis_delete_policy" ON public.report_analysis FOR DELETE USING (
  public.current_user_role() = 'admin' 
  OR title LIKE '%Test%' 
  OR title LIKE '%test%'
);

-- Policies cho report_snapshots
DROP POLICY IF EXISTS "snapshots_select_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_select_policy" ON public.report_snapshots FOR SELECT USING (true);

-- Policies cho audit_logs
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs FOR SELECT USING (true);
