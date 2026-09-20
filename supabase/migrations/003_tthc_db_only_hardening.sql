-- ==============================================================================
-- TTHC DB-ONLY HARDENING v1
-- Mục tiêu:
-- 1) Supabase/Postgres là nguồn dữ liệu nghiệp vụ duy nhất.
-- 2) Không có bypass TEST/IMP trong RLS của dữ liệu production.
-- 3) Không cho client trực tiếp ghi snapshot/audit; database trigger ghi nhận.
-- 4) Tất cả thay đổi nghiệp vụ quan trọng được kiểm soát bằng RLS + trigger.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RLS: authenticated users may READ business data; writes follow RBAC.
-- ------------------------------------------------------------------------------
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

-- Units
DROP POLICY IF EXISTS "units_select_policy" ON public.units;
CREATE POLICY "units_select_policy" ON public.units
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "units_insert_policy" ON public.units;
CREATE POLICY "units_insert_policy" ON public.units
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "units_update_policy" ON public.units;
CREATE POLICY "units_update_policy" ON public.units
  FOR UPDATE USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "units_delete_policy" ON public.units;
CREATE POLICY "units_delete_policy" ON public.units
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.current_user_role() = 'admin')
  WITH CHECK (auth.uid() = id OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Fields
DROP POLICY IF EXISTS "fields_select_policy" ON public.fields;
CREATE POLICY "fields_select_policy" ON public.fields
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "fields_insert_policy" ON public.fields;
CREATE POLICY "fields_insert_policy" ON public.fields
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "fields_update_policy" ON public.fields;
CREATE POLICY "fields_update_policy" ON public.fields
  FOR UPDATE USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "fields_delete_policy" ON public.fields;
CREATE POLICY "fields_delete_policy" ON public.fields
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Reports
DROP POLICY IF EXISTS "reports_select_policy" ON public.reports;
CREATE POLICY "reports_select_policy" ON public.reports
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "reports_insert_policy" ON public.reports;
CREATE POLICY "reports_insert_policy" ON public.reports
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "reports_update_policy" ON public.reports;
CREATE POLICY "reports_update_policy" ON public.reports
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "reports_delete_policy" ON public.reports;
CREATE POLICY "reports_delete_policy" ON public.reports
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Sources
DROP POLICY IF EXISTS "report_sources_select_policy" ON public.report_sources;
CREATE POLICY "report_sources_select_policy" ON public.report_sources
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "report_sources_insert_policy" ON public.report_sources;
CREATE POLICY "report_sources_insert_policy" ON public.report_sources
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_sources_update_policy" ON public.report_sources;
CREATE POLICY "report_sources_update_policy" ON public.report_sources
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_sources_delete_policy" ON public.report_sources;
CREATE POLICY "report_sources_delete_policy" ON public.report_sources
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst','data_entry'));

-- Statistics
DROP POLICY IF EXISTS "stats_select_policy" ON public.report_field_statistics;
CREATE POLICY "stats_select_policy" ON public.report_field_statistics
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stats_insert_policy" ON public.report_field_statistics;
CREATE POLICY "stats_insert_policy" ON public.report_field_statistics
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "stats_update_policy" ON public.report_field_statistics;
CREATE POLICY "stats_update_policy" ON public.report_field_statistics
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "stats_delete_policy" ON public.report_field_statistics;
CREATE POLICY "stats_delete_policy" ON public.report_field_statistics
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst','data_entry'));

-- Indicator definitions
DROP POLICY IF EXISTS "indicators_def_select_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_select_policy" ON public.indicator_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "indicators_def_insert_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_insert_policy" ON public.indicator_definitions
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "indicators_def_update_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_update_policy" ON public.indicator_definitions
  FOR UPDATE USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "indicators_def_delete_policy" ON public.indicator_definitions;
CREATE POLICY "indicators_def_delete_policy" ON public.indicator_definitions
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Calculated report indicators
DROP POLICY IF EXISTS "report_indicators_select_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_select_policy" ON public.report_indicators
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "report_indicators_insert_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_insert_policy" ON public.report_indicators
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_indicators_update_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_update_policy" ON public.report_indicators
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst','data_entry'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst','data_entry'));

DROP POLICY IF EXISTS "report_indicators_delete_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_delete_policy" ON public.report_indicators
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst','data_entry'));

-- Analyses
DROP POLICY IF EXISTS "analysis_select_policy" ON public.report_analysis;
CREATE POLICY "analysis_select_policy" ON public.report_analysis
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "analysis_insert_policy" ON public.report_analysis;
CREATE POLICY "analysis_insert_policy" ON public.report_analysis
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','analyst'));

DROP POLICY IF EXISTS "analysis_update_policy" ON public.report_analysis;
CREATE POLICY "analysis_update_policy" ON public.report_analysis
  FOR UPDATE USING (public.current_user_role() IN ('admin','analyst'))
  WITH CHECK (public.current_user_role() IN ('admin','analyst'));

DROP POLICY IF EXISTS "analysis_delete_policy" ON public.report_analysis;
CREATE POLICY "analysis_delete_policy" ON public.report_analysis
  FOR DELETE USING (public.current_user_role() IN ('admin','analyst'));

-- Snapshots are history, generated by the database lock trigger only.
DROP POLICY IF EXISTS "snapshots_select_policy" ON public.report_snapshots;
CREATE POLICY "snapshots_select_policy" ON public.report_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "snapshots_insert_policy" ON public.report_snapshots;
DROP POLICY IF EXISTS "snapshots_update_policy" ON public.report_snapshots;
DROP POLICY IF EXISTS "snapshots_delete_policy" ON public.report_snapshots;

-- Audit logs are append-only and generated by SECURITY DEFINER triggers.
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON public.audit_logs;

-- ------------------------------------------------------------------------------
-- 2. Generic DB audit trigger for business-table changes not covered by report
--    lifecycle trigger.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_business_table_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id TEXT;
  v_action TEXT;
  v_payload JSONB;
BEGIN
  v_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
  v_action := TG_TABLE_NAME || '_' || lower(TG_OP);
  v_payload := CASE
    WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
    WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
    ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  END;

  PERFORM public.write_audit_log(
    upper(v_action),
    TG_TABLE_NAME,
    v_id,
    v_payload
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_units_audit ON public.units;
CREATE TRIGGER trg_units_audit
AFTER INSERT OR UPDATE OR DELETE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_profiles_audit ON public.profiles;
CREATE TRIGGER trg_profiles_audit
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_fields_audit ON public.fields;
CREATE TRIGGER trg_fields_audit
AFTER INSERT OR UPDATE OR DELETE ON public.fields
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_indicator_definitions_audit ON public.indicator_definitions;
CREATE TRIGGER trg_indicator_definitions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.indicator_definitions
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_sources_audit ON public.report_sources;
CREATE TRIGGER trg_report_sources_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_sources
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_field_statistics_audit ON public.report_field_statistics;
CREATE TRIGGER trg_report_field_statistics_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_field_statistics
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_indicators_audit ON public.report_indicators;
CREATE TRIGGER trg_report_indicators_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_indicators
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

DROP TRIGGER IF EXISTS trg_report_analysis_audit ON public.report_analysis;
CREATE TRIGGER trg_report_analysis_audit
AFTER INSERT OR UPDATE OR DELETE ON public.report_analysis
FOR EACH ROW EXECUTE FUNCTION public.audit_business_table_change();

COMMIT;
