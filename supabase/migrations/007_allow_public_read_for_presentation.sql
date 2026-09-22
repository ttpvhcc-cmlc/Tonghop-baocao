-- ==============================================================================
-- HỆ THỐNG QUẢN LÝ BÁO CÁO VÀ PHÂN TÍCH CHỈ SỐ THỦ TỤC HÀNH CHÍNH (TTHC)
-- TẬP TIN 007: CẤP QUYỀN ĐỌC CHO KHÁCH CHƯA ĐĂNG NHẬP (TRÌNH DIỄN DỮ LIỆU THẬT)
-- MỤC TIÊU: Cho phép khách vãng lai (anon/public) được SELECT dữ liệu thật
-- từ CSDL Supabase để xem Dashboard Tổng quan & Trình diễn số liệu.
-- Toàn bộ quyền GHI (INSERT, UPDATE, DELETE) vẫn bắt buộc tài khoản có thẩm quyền.
-- ==============================================================================

-- 1. Reports (Kỳ báo cáo)
DROP POLICY IF EXISTS "reports_select_policy" ON public.reports;
CREATE POLICY "reports_select_policy" ON public.reports
  FOR SELECT USING (true);

-- 2. Report Sources (Nguồn dữ liệu báo cáo)
DROP POLICY IF EXISTS "report_sources_select_policy" ON public.report_sources;
CREATE POLICY "report_sources_select_policy" ON public.report_sources
  FOR SELECT USING (true);

-- 3. Report Field Statistics (Số liệu thống kê lĩnh vực & TTHC chi tiết)
DROP POLICY IF EXISTS "stats_select_policy" ON public.report_field_statistics;
CREATE POLICY "stats_select_policy" ON public.report_field_statistics
  FOR SELECT USING (true);

-- 4. Units (Đơn vị giải quyết)
DROP POLICY IF EXISTS "units_select_policy" ON public.units;
CREATE POLICY "units_select_policy" ON public.units
  FOR SELECT USING (true);

-- 5. Fields (Lĩnh vực TTHC)
DROP POLICY IF EXISTS "fields_select_policy" ON public.fields;
CREATE POLICY "fields_select_policy" ON public.fields
  FOR SELECT USING (true);

-- 6. Indicator Definitions (Định nghĩa chỉ số)
DROP POLICY IF EXISTS "indicator_definitions_select_policy" ON public.indicator_definitions;
CREATE POLICY "indicator_definitions_select_policy" ON public.indicator_definitions
  FOR SELECT USING (true);

-- 7. Report Indicators (Chỉ số tổng hợp theo báo cáo)
DROP POLICY IF EXISTS "report_indicators_select_policy" ON public.report_indicators;
CREATE POLICY "report_indicators_select_policy" ON public.report_indicators
  FOR SELECT USING (true);

-- 8. Report Analysis (Nhận xét và phân tích)
DROP POLICY IF EXISTS "report_analysis_select_policy" ON public.report_analysis;
CREATE POLICY "report_analysis_select_policy" ON public.report_analysis
  FOR SELECT USING (true);

-- 9. System Config (Cấu hình hệ thống chung)
DROP POLICY IF EXISTS "system_config_select_policy" ON public.system_config;
CREATE POLICY "system_config_select_policy" ON public.system_config
  FOR SELECT USING (true);

-- Cấp quyền SELECT trên schema public cho anon và authenticated
GRANT SELECT ON public.reports TO anon, authenticated;
GRANT SELECT ON public.report_sources TO anon, authenticated;
GRANT SELECT ON public.report_field_statistics TO anon, authenticated;
GRANT SELECT ON public.units TO anon, authenticated;
GRANT SELECT ON public.fields TO anon, authenticated;
GRANT SELECT ON public.indicator_definitions TO anon, authenticated;
GRANT SELECT ON public.report_indicators TO anon, authenticated;
GRANT SELECT ON public.report_analysis TO anon, authenticated;
GRANT SELECT ON public.system_config TO anon, authenticated;
