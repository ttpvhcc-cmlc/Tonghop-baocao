-- ==============================================================================
-- HỆ THỐNG QUẢN LÝ BÁO CÁO VÀ PHÂN TÍCH CHỈ SỐ THỦ TỤC HÀNH CHÍNH (TTHC)
-- SEED DATA CHUẨN ĐÃ ĐƯỢC TÍCH HỢP TRỰC TIẾP TRONG 001_initial.sql
-- ==============================================================================

-- Kiểm tra tính sẵn sàng của 11 bảng
SELECT 'profiles' AS table_name, count(*) AS total_rows FROM public.profiles
UNION ALL
SELECT 'units', count(*) FROM public.units
UNION ALL
SELECT 'fields', count(*) FROM public.fields
UNION ALL
SELECT 'reports', count(*) FROM public.reports
UNION ALL
SELECT 'report_sources', count(*) FROM public.report_sources
UNION ALL
SELECT 'report_field_statistics', count(*) FROM public.report_field_statistics
UNION ALL
SELECT 'indicator_definitions', count(*) FROM public.indicator_definitions
UNION ALL
SELECT 'report_indicators', count(*) FROM public.report_indicators
UNION ALL
SELECT 'report_analysis', count(*) FROM public.report_analysis
UNION ALL
SELECT 'report_snapshots', count(*) FROM public.report_snapshots
UNION ALL
SELECT 'audit_logs', count(*) FROM public.audit_logs;
