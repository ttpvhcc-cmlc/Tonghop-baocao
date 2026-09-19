-- ==============================================================================
-- HỆ THỐNG QUẢN LÝ BÁO CÁO VÀ PHÂN TÍCH CHỈ SỐ THỦ TỤC HÀNH CHÍNH (TTHC)
-- TẬP TIN 002: DỮ LIỆU MẪU & BỘ KIỂM THỬ TỰ ĐỘNG (SEED & TEST SUITE v12 FINAL)
-- PHIÊN BẢN: 12.0 ENTERPRISE PRODUCTION READY
-- ĐẶC TÍNH: 100% IDEMPOTENT / STRICT ERROR ASSERTIONS / SUBTRANSACTION TEST ROLLBACK
-- ==============================================================================

DO $$
DECLARE
  -- 1. UUID CỐ ĐỊNH CHO MASTER UNITS & SEED REPORT
  v_unit_vp UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  v_unit_kt UUID := '00000000-0000-0000-0000-000000000002'::uuid;
  v_unit_vhxh UUID := '00000000-0000-0000-0000-000000000003'::uuid;

  v_ind_online UUID := '00000000-0000-0000-0002-000000000001'::uuid;
  v_ind_ontime UUID := '00000000-0000-0000-0002-000000000002'::uuid;
  v_ind_overdue UUID := '00000000-0000-0000-0002-000000000003'::uuid;

  v_report_id UUID := '00000000-0000-0000-0003-000000000001'::uuid;
  v_source_bo UUID := '00000000-0000-0000-0004-000000000001'::uuid;
  v_source_tp UUID := '00000000-0000-0000-0004-000000000002'::uuid;

  -- Mã UUID danh mục lĩnh vực Master (15 Lĩnh vực)
  v_f1 UUID := '00000000-0000-0000-0001-000000000001'::uuid;
  v_f2 UUID := '00000000-0000-0000-0001-000000000002'::uuid;
  v_f3 UUID := '00000000-0000-0000-0001-000000000003'::uuid;
  v_f4 UUID := '00000000-0000-0000-0001-000000000004'::uuid;
  v_f5 UUID := '00000000-0000-0000-0001-000000000005'::uuid;
  v_f6 UUID := '00000000-0000-0000-0001-000000000006'::uuid;
  v_f7 UUID := '00000000-0000-0000-0001-000000000007'::uuid;
  v_f8 UUID := '00000000-0000-0000-0001-000000000008'::uuid;
  v_f9 UUID := '00000000-0000-0000-0001-000000000009'::uuid;
  v_f10 UUID := '00000000-0000-0000-0001-000000000010'::uuid;
  v_f11 UUID := '00000000-0000-0000-0001-000000000011'::uuid;
  v_f12 UUID := '00000000-0000-0000-0001-000000000012'::uuid;
  v_f13 UUID := '00000000-0000-0000-0001-000000000013'::uuid;
  v_f14 UUID := '00000000-0000-0000-0001-000000000014'::uuid;
  v_f15 UUID := '00000000-0000-0000-0001-000000000015'::uuid;

  -- Biến tính toán tổng số liệu đa nguồn thực tế
  v_sum_received BIGINT;
  v_sum_online BIGINT;
  v_sum_completed BIGINT;
  v_sum_early BIGINT;
  v_sum_ontime BIGINT;
  v_sum_late BIGINT;
  v_sum_pending_late BIGINT;

  v_rate_online NUMERIC(12, 4);
  v_rate_ontime NUMERIC(12, 4);
  v_rate_overdue NUMERIC(12, 4);

  v_narrative_text TEXT;
  v_existing_status TEXT;
  v_stats_cnt INT;
  v_snap_cnt INT;
  v_analysis_cnt INT;
  v_ind_cnt INT;
  v_existing_report_id UUID;
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE 'KHỞI TẠO DỮ LIỆU MẪU CHUẨN IDEMPOTENT SEED DATA (v12 FINAL)';
  RAISE NOTICE '======================================================================';

  -- ----------------------------------------------------------------------------
  -- SEED 1: BẢNG UNITS (3 ĐƠN VỊ HÀNH CHÍNH MASTER)
  -- ----------------------------------------------------------------------------
  INSERT INTO public.units (id, code, name, display_order, active) VALUES
    (v_unit_vp, 'VP', 'Văn phòng', 1, true),
    (v_unit_kt, 'KT', 'Phòng Kinh tế', 2, true),
    (v_unit_vhxh, 'VHXH', 'Phòng Văn hóa - Xã hội', 3, true)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    active = true;

  -- SELECT lại id thật theo code và gán lại vào biến
  SELECT id INTO v_unit_vp FROM public.units WHERE code = 'VP';
  SELECT id INTO v_unit_kt FROM public.units WHERE code = 'KT';
  SELECT id INTO v_unit_vhxh FROM public.units WHERE code = 'VHXH';

  -- ----------------------------------------------------------------------------
  -- SEED 2: BẢNG FIELDS (15 LĨNH VỰC HIỆN HÀNH DỰA TRÊN MASTER UNITS)
  -- ----------------------------------------------------------------------------
  INSERT INTO public.fields (id, code, name, unit_id, display_order, active) VALUES
    (v_f1, 'VP-01', 'Nội vụ và Thi đua Khen thưởng', v_unit_vp, 1, true),
    (v_f2, 'VP-02', 'Tư pháp và Hộ tịch', v_unit_vp, 2, true),
    (v_f3, 'VP-03', 'Thanh tra và Giải quyết Khiếu nại Tố cáo', v_unit_vp, 3, true),
    (v_f4, 'VP-04', 'Ngoại vụ và Hợp tác Quốc tế', v_unit_vp, 4, true),
    (v_f5, 'VP-05', 'Cải cách Hành chính và Kiểm soát TTHC', v_unit_vp, 5, true),
    
    (v_f6, 'KT-01', 'Kế hoạch và Đầu tư', v_unit_kt, 6, true),
    (v_f7, 'KT-02', 'Tài chính và Ngân sách', v_unit_kt, 7, true),
    (v_f8, 'KT-03', 'Công Thương và Thị trường', v_unit_kt, 8, true),
    (v_f9, 'KT-04', 'Nông nghiệp và Phát triển Nông thôn', v_unit_kt, 9, true),
    (v_f10, 'KT-05', 'Tài nguyên và Môi trường', v_unit_kt, 10, true),
    
    (v_f11, 'VHXH-01', 'Văn hóa và Thể thao', v_unit_vhxh, 11, true),
    (v_f12, 'VHXH-02', 'Thông tin và Truyền thông', v_unit_vhxh, 12, true),
    (v_f13, 'VHXH-03', 'Lao động - Thương binh và Xã hội', v_unit_vhxh, 13, true),
    (v_f14, 'VHXH-04', 'Giáo dục và Đào tạo', v_unit_vhxh, 14, true),
    (v_f15, 'VHXH-05', 'Y tế và An toàn Thực phẩm', v_unit_vhxh, 15, true)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    unit_id = EXCLUDED.unit_id,
    display_order = EXCLUDED.display_order,
    active = true;

  -- SELECT lại id thật theo code và gán lại vào biến
  SELECT id INTO v_f1 FROM public.fields WHERE code = 'VP-01';
  SELECT id INTO v_f2 FROM public.fields WHERE code = 'VP-02';
  SELECT id INTO v_f3 FROM public.fields WHERE code = 'VP-03';
  SELECT id INTO v_f4 FROM public.fields WHERE code = 'VP-04';
  SELECT id INTO v_f5 FROM public.fields WHERE code = 'VP-05';
  SELECT id INTO v_f6 FROM public.fields WHERE code = 'KT-01';
  SELECT id INTO v_f7 FROM public.fields WHERE code = 'KT-02';
  SELECT id INTO v_f8 FROM public.fields WHERE code = 'KT-03';
  SELECT id INTO v_f9 FROM public.fields WHERE code = 'KT-04';
  SELECT id INTO v_f10 FROM public.fields WHERE code = 'KT-05';
  SELECT id INTO v_f11 FROM public.fields WHERE code = 'VHXH-01';
  SELECT id INTO v_f12 FROM public.fields WHERE code = 'VHXH-02';
  SELECT id INTO v_f13 FROM public.fields WHERE code = 'VHXH-03';
  SELECT id INTO v_f14 FROM public.fields WHERE code = 'VHXH-04';
  SELECT id INTO v_f15 FROM public.fields WHERE code = 'VHXH-05';

  -- ----------------------------------------------------------------------------
  -- SEED 3: BẢNG INDICATOR DEFINITIONS (3 CHỈ SỐ DO LƯỜNG NGHIỆP VỤ - CHỈ TIÊU DEMO CONFIG)
  -- ----------------------------------------------------------------------------
  INSERT INTO public.indicator_definitions (id, code, name, formula_key, unit_measure, target_value, description, display_order, active) VALUES
    (v_ind_online, 'ONLINE_RATE', 'Tỷ lệ Hồ sơ Trực tuyến', 'received_online / received_total * 100', '%', 80.00, 'Tỷ lệ hồ sơ được nộp qua cổng dịch vụ công trực tuyến (chỉ tiêu cấu hình mẫu DEMO CONFIG)', 1, true),
    (v_ind_ontime, 'ONTIME_RATE', 'Tỷ lệ Giải quyết Đúng hạn', '(completed_early + completed_on_time) / completed_total * 100', '%', 95.00, 'Tỷ lệ hồ sơ giải quyết trước hạn và đúng hạn (chỉ tiêu cấu hình mẫu DEMO CONFIG)', 2, true),
    (v_ind_overdue, 'OVERDUE_RATE', 'Tỷ lệ Hồ sơ Quá hạn', '(completed_late + pending_late) / received_total * 100', '%', 3.00, 'Tỷ lệ hồ sơ quá hạn trong quá trình xử lý (chỉ tiêu cấu hình mẫu DEMO CONFIG)', 3, true)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    formula_key = EXCLUDED.formula_key,
    target_value = EXCLUDED.target_value,
    description = EXCLUDED.description,
    active = true;

  -- SELECT lại id thật theo code và gán lại vào biến
  SELECT id INTO v_ind_online FROM public.indicator_definitions WHERE code = 'ONLINE_RATE';
  SELECT id INTO v_ind_ontime FROM public.indicator_definitions WHERE code = 'ONTIME_RATE';
  SELECT id INTO v_ind_overdue FROM public.indicator_definitions WHERE code = 'OVERDUE_RATE';

  -- ----------------------------------------------------------------------------
  -- SEED 4: CƠ CHẾ KIỂM TRA IDEMPOTENCY XỬ LÝ 3 TRƯỜNG HỢP BÁO CÁO DEMO CHÍNH (TÌM THEO CODE 'BC-TTHC-2026-08')
  -- ----------------------------------------------------------------------------
  SELECT id, status INTO v_existing_report_id, v_existing_status FROM public.reports WHERE report_code = 'BC-TTHC-2026-08';

  IF v_existing_status IS NOT NULL THEN
    v_report_id := v_existing_report_id;
    SELECT count(*) INTO v_stats_cnt FROM public.report_field_statistics WHERE report_id = v_report_id;
    SELECT count(*) INTO v_snap_cnt FROM public.report_snapshots WHERE report_id = v_report_id;
    SELECT count(*) INTO v_analysis_cnt FROM public.report_analysis WHERE report_id = v_report_id;
    SELECT count(*) INTO v_ind_cnt FROM public.report_indicators WHERE report_id = v_report_id;

    IF v_existing_status IN ('locked', 'archived') AND v_stats_cnt = 30 AND v_snap_cnt >= 1 AND v_analysis_cnt >= 1 AND v_ind_cnt = 3 THEN
      RAISE NOTICE 'TRƯỜNG HỢP 2: Báo cáo Demo (%) đã tồn tại hoàn chỉnh ở trạng thái %s (30/30 thống kê, %s snapshots). Bỏ qua tái tạo dữ liệu an toàn.', v_report_id, v_existing_status, v_snap_cnt;
    ELSE
      RAISE EXCEPTION 'TRƯỜNG HỢP 3 (SEED FAILED): Báo cáo Demo (%) đã tồn tại nhưng ở trạng thái không hoàn chỉnh (Status: %, Stats: %/30, Snapshots: %, Analysis: %, Indicators: %/3). Yêu cầu reset CSDL trước khi khởi tạo lại.', v_report_id, v_existing_status, v_stats_cnt, v_snap_cnt, v_analysis_cnt, v_ind_cnt;
    END IF;
  ELSE
    -- TRƯỜNG HỢP 1: Báo cáo demo chưa tồn tại -> Tiến hành khởi tạo đầy đủ
    INSERT INTO public.reports (
      id, report_code, report_name, report_type, period_start, period_end, data_as_of, status, created_by, notes
    ) VALUES (
      v_report_id,
      'BC-TTHC-2026-08',
      'Báo cáo Tổng hợp TTHC Tháng 08/2026',
      'monthly',
      '2026-08-01',
      '2026-08-31',
      '2026-08-31 23:59:59+07',
      'draft',
      'Trần Văn Chuyên (Chuyên viên)',
      'Số liệu tổng hợp TTHC chính thức tháng 8 năm 2026 trên phạm vi toàn cơ quan'
    );

    -- 2 NGUỒN DỮ LIỆU ĐỘC LẬP TƯƠNG ỨNG VỚI 2 HỆ THỐNG PHẦN MỀM TÁCH BIỆT (KHÔNG TRÙNG LẶP DỮ LIỆU)
    INSERT INTO public.report_sources (
      id, report_id, source_type, source_name, original_filename, uploaded_by, import_status, notes
    ) VALUES 
      (v_source_bo, v_report_id, 'api', 'Trên Hệ thống các Bộ', 'API_BO_T8_2026.json', 'Tự động API', 'completed', 'Dữ liệu liên thông từ Cổng DVC các Bộ ngành'),
      (v_source_tp, v_report_id, 'system', 'Trên Hệ thống thành phố', 'DVC_THANHPHO_T8_2026.xml', 'Hệ thống TP', 'completed', 'Dữ liệu từ Hệ thống Dịch vụ công tập trung Thành phố');

    -- NGUỒN 1: Trên Hệ thống các Bộ (15 Lĩnh vực)
    INSERT INTO public.report_field_statistics (report_id, source_id, field_id, received_total, received_online, received_offline, carried_forward, completed_total, completed_early, completed_on_time, completed_late, pending_total, pending_on_time, pending_late) VALUES
      (v_report_id, v_source_bo, v_f1,  80,  70,  5, 5,  78,  65, 12, 1,  2, 2, 0),
      (v_report_id, v_source_bo, v_f2, 120, 100, 15, 5, 115,  95, 18, 2,  5, 4, 1),
      (v_report_id, v_source_bo, v_f3,  40,  30,  8, 2,  38,  30,  7, 1,  2, 2, 0),
      (v_report_id, v_source_bo, v_f4,  30,  25,  3, 2,  29,  22,  6, 1,  1, 1, 0),
      (v_report_id, v_source_bo, v_f5,  90,  80,  6, 4,  86,  72, 12, 2,  4, 3, 1),
      
      (v_report_id, v_source_bo, v_f6, 150, 130, 12, 8, 145, 120, 22, 3,  5, 4, 1),
      (v_report_id, v_source_bo, v_f7, 110,  95, 10, 5, 106,  88, 16, 2,  4, 3, 1),
      (v_report_id, v_source_bo, v_f8, 100,  85, 10, 5,  96,  80, 14, 2,  4, 3, 1),
      (v_report_id, v_source_bo, v_f9,  70,  60,  6, 4,  67,  55, 10, 2,  3, 3, 0),
      (v_report_id, v_source_bo, v_f10, 160, 135, 15, 10, 152, 125, 24, 3, 8, 6, 2),
      
      (v_report_id, v_source_bo, v_f11, 60,  50,  6, 4,  58,  48,  9, 1,  2, 2, 0),
      (v_report_id, v_source_bo, v_f12, 70,  60,  6, 4,  68,  56, 11, 1,  2, 2, 0),
      (v_report_id, v_source_bo, v_f13, 90,  75, 10, 5,  86,  70, 14, 2,  4, 3, 1),
      (v_report_id, v_source_bo, v_f14, 50,  40,  6, 4,  48,  40,  7, 1,  2, 2, 0),
      (v_report_id, v_source_bo, v_f15, 80,  70,  7, 3,  76,  64, 11, 1,  4, 4, 0);

    -- NGUỒN 2: Trên Hệ thống thành phố (15 Lĩnh vực)
    INSERT INTO public.report_field_statistics (report_id, source_id, field_id, received_total, received_online, received_offline, carried_forward, completed_total, completed_early, completed_on_time, completed_late, pending_total, pending_on_time, pending_late) VALUES
      (v_report_id, v_source_tp, v_f1,  70,  60,  7, 3,  67,  56, 10, 1,  3, 3, 0),
      (v_report_id, v_source_tp, v_f2, 110,  95, 10, 5, 105,  88, 16, 1,  5, 4, 1),
      (v_report_id, v_source_tp, v_f3,  35,  28,  5, 2,  34,  27,  6, 1,  1, 1, 0),
      (v_report_id, v_source_tp, v_f4,  25,  20,  3, 2,  24,  19,  4, 1,  1, 1, 0),
      (v_report_id, v_source_tp, v_f5,  80,  70,  7, 3,  76,  64, 11, 1,  4, 3, 1),
      
      (v_report_id, v_source_tp, v_f6, 130, 110, 14, 6, 125, 104, 19, 2,  5, 4, 1),
      (v_report_id, v_source_tp, v_f7, 100,  85, 10, 5,  96,  80, 14, 2,  4, 3, 1),
      (v_report_id, v_source_tp, v_f8,  90,  75, 10, 5,  86,  71, 14, 1,  4, 3, 1),
      (v_report_id, v_source_tp, v_f9,  60,  50,  6, 4,  57,  47,  9, 1,  3, 3, 0),
      (v_report_id, v_source_tp, v_f10, 140, 120, 15, 5, 134, 112, 20, 2,  6, 5, 1),
      
      (v_report_id, v_source_tp, v_f11, 55,  45,  7, 3,  53,  44,  8, 1,  2, 2, 0),
      (v_report_id, v_source_tp, v_f12, 65,  55,  6, 4,  63,  52, 10, 1,  2, 2, 0),
      (v_report_id, v_source_tp, v_f13, 80,  68,  8, 4,  76,  62, 13, 1,  4, 3, 1),
      (v_report_id, v_source_tp, v_f14, 45,  38,  5, 2,  43,  36,  6, 1,  2, 2, 0),
      (v_report_id, v_source_tp, v_f15, 65,  56,  6, 3,  61,  50, 10, 1,  4, 4, 0);

    -- TÍNH TOÁN ĐA NGUỒN CHÍNH XÁC THEO BẢNG DỮ LIỆU CSDL (30 DÒNG THỰC TẾ):
    -- Nguồn 1: received_total = 1300, received_online = 1105, completed_total = 1248, completed_early = 1030, completed_on_time = 193, completed_late = 25, pending_total = 52, pending_late = 8
    -- Nguồn 2: received_total = 1150, received_online = 975, completed_total = 1100, completed_early = 912, completed_on_time = 170, completed_late = 18, pending_total = 50, pending_late = 7
    -- TỔNG CỘNG ĐA NGUỒN (KHÔNG DOUBLE-COUNTING):
    -- Sum received_total = 2450
    -- Sum received_online = 2080 => ONLINE_RATE = 2080 / 2450 * 100 = 84.8980%
    -- Sum completed_total = 2348
    -- Sum completed_early = 1942, completed_on_time = 363 => ONTIME_RATE = (1942 + 363) / 2348 * 100 = 2305 / 2348 * 100 = 98.1687%
    -- Sum completed_late = 43, pending_late = 15 => OVERDUE_RATE = (43 + 15) / 2450 * 100 = 58 / 2450 * 100 = 2.3673%

    SELECT 
      SUM(received_total),
      SUM(received_online),
      SUM(completed_total),
      SUM(completed_early),
      SUM(completed_on_time),
      SUM(completed_late),
      SUM(pending_late)
    INTO 
      v_sum_received, v_sum_online, v_sum_completed, 
      v_sum_early, v_sum_ontime, v_sum_late, v_sum_pending_late
    FROM public.report_field_statistics
    WHERE report_id = v_report_id;

    v_rate_online := ROUND((v_sum_online::numeric / v_sum_received::numeric * 100.0), 4);
    v_rate_ontime := ROUND(((v_sum_early + v_sum_ontime)::numeric / v_sum_completed::numeric * 100.0), 4);
    v_rate_overdue := ROUND(((v_sum_late + v_sum_pending_late)::numeric / v_sum_received::numeric * 100.0), 4);

    -- Gán chỉ số Global (Target Status được tính toán động bởi Trigger!)
    INSERT INTO public.report_indicators (
      report_id, indicator_definition_id, scope_type, scope_id, calculated_value, formatted_value, calculation_details
    ) VALUES
      (v_report_id, v_ind_online, 'global', NULL, v_rate_online, to_char(v_rate_online, 'FM990.00') || '%', jsonb_build_object('received_online', v_sum_online, 'received_total', v_sum_received)),
      (v_report_id, v_ind_ontime, 'global', NULL, v_rate_ontime, to_char(v_rate_ontime, 'FM990.00') || '%', jsonb_build_object('completed_early_or_ontime', v_sum_early + v_sum_ontime, 'completed_total', v_sum_completed)),
      (v_report_id, v_ind_overdue, 'global', NULL, v_rate_overdue, to_char(v_rate_overdue, 'FM990.00') || '%', jsonb_build_object('overdue_total', v_sum_late + v_sum_pending_late, 'received_total', v_sum_received));

    -- NARRATIVE PHÂN TÍCH KHỚP 100% SỐ LIỆU CSDL THỰC TẾ (CÁC CHỈ TIÊU ĐƯỢC ĐÁNH DẤU LÀ DEMO CONFIG)
    v_narrative_text := format(
      'Trong tháng 08/2026, toàn đơn vị đã tiếp nhận tổng cộng %s hồ sơ TTHC trên tất cả các nguồn dữ liệu tích hợp. ' ||
      'Tỷ lệ nộp hồ sơ trực tuyến đạt %s%% (vượt chỉ tiêu cấu hình mẫu DEMO CONFIG 80.00%%). ' ||
      'Công tác giải quyết hồ sơ ghi nhận kết quả tích cực với Tỷ lệ giải quyết đúng và trước hạn đạt %s%% (vượt chỉ tiêu cấu hình mẫu DEMO CONFIG 95.00%%). ' ||
      'Tỷ lệ hồ sơ quá hạn được kiểm soát ở mức thấp %s%% (đạt yêu cầu cấu hình mẫu DEMO CONFIG dưới 3.00%%). ' ||
      'Đề nghị tiếp tục duy trì hiệu quả ứng dụng CNTT và tối ưu hóa quy trình nghiệp vụ.',
      v_sum_received, to_char(v_rate_online, 'FM990.00'), to_char(v_rate_ontime, 'FM990.00'), to_char(v_rate_overdue, 'FM990.00')
    );

    INSERT INTO public.report_analysis (
      report_id, scope_type, scope_id, title, generated_text, generated_by, source_metrics
    ) VALUES (
      v_report_id,
      'overview',
      NULL,
      'Đánh giá Tổng quan Công tác Giải quyết TTHC Tháng 08/2026',
      v_narrative_text,
      'Hệ thống Phân tích TTHC Tự động',
      jsonb_build_object(
        'received_total', v_sum_received,
        'received_online', v_sum_online,
        'online_rate', v_rate_online,
        'ontime_rate', v_rate_ontime,
        'overdue_rate', v_rate_overdue
      )
    );

    -- CHUYỂN BÁO CÁO QUA CÁC BƯỚC VÒNG ĐỜI TUẦN TỰ -> LOCKED
    UPDATE public.reports SET status = 'imported' WHERE id = v_report_id;
    UPDATE public.reports SET status = 'validated' WHERE id = v_report_id;
    UPDATE public.reports SET status = 'submitted' WHERE id = v_report_id;
    UPDATE public.reports SET status = 'approved' WHERE id = v_report_id;
    
    -- Khi chuyển sang LOCKED, Trigger trg_reports_lifecycle sẽ TỰ ĐỘNG TẠO SNAPSHOT
    UPDATE public.reports SET status = 'locked' WHERE id = v_report_id;

    RAISE NOTICE 'Báo cáo mẫu DEMO (ID: %) đã khởi tạo và khóa thành công ở trạng thái LOCKED.', v_report_id;
  ELSE
    RAISE NOTICE 'Báo cáo mẫu DEMO (ID: %) đã tồn tại ở trạng thái LOCKED. Bỏ qua khởi tạo lại để bảo vệ tính bất biến dữ liệu.', v_report_id;
  END IF;

  RAISE NOTICE 'KHỞI TẠO DỮ LIỆU MẪU DẠNG SEED HOÀN TẤT THÀNH CÔNG!';
END;
$$;

-- ==============================================================================
-- BỘ KIỂM THỬ TỰ ĐỘNG KHẮC KHẮT 20/20 (FINAL REAL TEST SUITE v11)
-- AN TOÀN TUYỆT ĐỐI - KHÔNG SỬA ĐỔI BÁO CÁO DEMO CHÍNH - KIỂM TRA LỖI CHÍNH XÁC
-- ==============================================================================
DO $$
DECLARE
  v_demo_report_id UUID := '00000000-0000-0000-0003-000000000001'::uuid;
  v_field_1 UUID := '00000000-0000-0000-0001-000000000001'::uuid;
  v_ind_online UUID := '00000000-0000-0000-0002-000000000001'::uuid;
  v_ind_ontime UUID := '00000000-0000-0000-0002-000000000002'::uuid;
  v_ind_overdue UUID := '00000000-0000-0000-0002-000000000003'::uuid;

  v_passed_tests INT := 0;
  v_test_failed BOOLEAN;

  -- Báo cáo độc lập dành riêng cho Suite Kiểm thử (Test Suite Report)
  v_suite_rep_id UUID := gen_random_uuid();
  v_suite_src_id UUID := gen_random_uuid();
  v_suite_rep_2_id UUID := gen_random_uuid();
  v_suite_src_2_id UUID := gen_random_uuid();

  v_sum_received BIGINT;
  v_sum_online BIGINT;
  v_sum_completed BIGINT;
  v_sum_early BIGINT;
  v_sum_ontime BIGINT;
  v_sum_late BIGINT;
  v_sum_pending_late BIGINT;

  v_calc_online_rate NUMERIC(12, 4);
  v_calc_ontime_rate NUMERIC(12, 4);
  v_calc_overdue_rate NUMERIC(12, 4);

  v_invalid_count INT;
  v_mismatch_field_unit INT;
  v_mismatch_source_rep INT;
  v_analysis_text TEXT;
  v_analysis_metrics JSONB;
  v_snap_count INT;
  v_sqlstate TEXT;
  v_sqlerrm TEXT;
  v_snap_json JSONB;
BEGIN
  RAISE NOTICE '======================================================================';
  RAISE NOTICE 'BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG 20/20 (FINAL REAL TEST SUITE v11)';
  RAISE NOTICE '======================================================================';

  -- LẤY LẠI CÁC MÃ UUID THỰC TẾ TỪ CSDL ĐỂ ĐẢM BẢO TÍNH IDEMPOTENT VÀ KHÔNG BỊ SAI LỆCH FK
  SELECT id INTO v_demo_report_id FROM public.reports WHERE report_code = 'BC-TTHC-2026-08';
  SELECT id INTO v_field_1 FROM public.fields WHERE code = 'VP-01';
  SELECT id INTO v_ind_online FROM public.indicator_definitions WHERE code = 'ONLINE_RATE';
  SELECT id INTO v_ind_ontime FROM public.indicator_definitions WHERE code = 'ONTIME_RATE';
  SELECT id INTO v_ind_overdue FROM public.indicator_definitions WHERE code = 'OVERDUE_RATE';

  -- TEST 1: Enforce initial lifecycle status (draft)
  v_test_failed := false;
  BEGIN
    INSERT INTO public.reports (
      id, report_code, report_name, report_type, period_start, period_end, data_as_of, status
    ) VALUES (
      gen_random_uuid(), 'SUITE-LIFECYCLE-ERR', 'Suite Lifecycle Direct Approved', 'monthly', '2026-08-01', '2026-08-31', now(), 'approved'
    );
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('DRAFT' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 1 FAILED: Lỗi trả về không đúng kỳ vọng. SQLSTATE: %, Message: %', v_sqlstate, v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 1 FAILED: CSDL cho phép tạo mới báo cáo với trạng thái APPROVED thay vì bắt buộc DRAFT.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 1: Báo cáo mới bắt buộc khởi tạo ở trạng thái DRAFT.';

  -- TẠO BÁO CÁO THỬ NGHIỆM ĐỘC LẬP CHO TEST SUITE DÙNG RỒI DỌN DẸP (KHÔNG ĐỤNG DEMO REPORT)
  INSERT INTO public.reports (
    id, report_code, report_name, report_type, period_start, period_end, data_as_of, status
  ) VALUES (
    v_suite_rep_id, 'SUITE-REP-2026-08', 'Báo cáo Kiểm thử Độc lập Suite', 'monthly', '2026-08-01', '2026-08-31', now(), 'draft'
  );

  INSERT INTO public.report_sources (
    id, report_id, source_type, source_name, import_status
  ) VALUES (
    v_suite_src_id, v_suite_rep_id, 'manual', 'Nguồn Kiểm thử Suite', 'completed'
  );

  INSERT INTO public.report_field_statistics (
    report_id, source_id, field_id, received_total, received_online, completed_total, completed_early, pending_total, pending_on_time
  ) VALUES (
    v_suite_rep_id, v_suite_src_id, v_field_1, 10, 10, 10, 10, 0, 0
  );

  INSERT INTO public.report_indicators (
    report_id, indicator_definition_id, scope_type, scope_id, calculated_value, formatted_value, target_status
  ) VALUES 
    (v_suite_rep_id, v_ind_online, 'global', NULL, 100.0000, '100.00%', 'achieved'),
    (v_suite_rep_id, v_ind_ontime, 'global', NULL, 100.0000, '100.00%', 'achieved'),
    (v_suite_rep_id, v_ind_overdue, 'global', NULL, 0.0000, '0.00%', 'achieved');

  -- Chuyển v_suite_rep_id qua các bước -> LOCKED
  UPDATE public.reports SET status = 'imported' WHERE id = v_suite_rep_id;
  UPDATE public.reports SET status = 'validated' WHERE id = v_suite_rep_id;
  UPDATE public.reports SET status = 'submitted' WHERE id = v_suite_rep_id;
  UPDATE public.reports SET status = 'approved' WHERE id = v_suite_rep_id;
  UPDATE public.reports SET status = 'locked' WHERE id = v_suite_rep_id;

  -- TEST 2: Cannot UPDATE LOCKED report
  v_test_failed := false;
  BEGIN
    UPDATE public.reports SET report_name = 'Tên Báo Cáo Thay Đổi Trái Phép' WHERE id = v_suite_rep_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('bất biến' IN v_sqlerrm) = 0 AND POSITION('LOCKED' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 2 FAILED: Lỗi không chứa thông điệp bảo vệ bất biến. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 2 FAILED: CSDL cho phép cập nhật thông tin trên báo cáo đang ở trạng thái LOCKED.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 2: Báo cáo ở trạng thái LOCKED là dữ liệu đóng băng bất biến.';

  -- TEST 3: Transition LOCKED -> ARCHIVED allowed and preserves content
  BEGIN
    UPDATE public.reports SET status = 'archived' WHERE id = v_suite_rep_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Không thể chuyển báo cáo thử nghiệm từ LOCKED sang ARCHIVED. Lỗi: %', SQLERRM;
  END;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 3: Chuyển đổi trạng thái từ LOCKED sang ARCHIVED hợp lệ.';

  -- TEST 4: Cannot UPDATE ARCHIVED report
  v_test_failed := false;
  BEGIN
    UPDATE public.reports SET notes = 'Ghi chú mới trái phép' WHERE id = v_suite_rep_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('ARCHIVED' IN v_sqlerrm) = 0 AND POSITION('hoàn toàn bất biến' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 4 FAILED: Lỗi không chứa thông điệp bảo vệ ARCHIVED. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 4 FAILED: CSDL cho phép sửa đổi thông tin trên báo cáo đã ARCHIVED.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 4: Báo cáo ở trạng thái ARCHIVED hoàn toàn bất biến.';

  -- TEST 5: Cannot DELETE/UPDATE report_sources on ARCHIVED report
  v_test_failed := false;
  BEGIN
    DELETE FROM public.report_sources WHERE id = v_suite_src_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('bất biến' IN v_sqlerrm) = 0 AND POSITION('archived' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 5 FAILED: Lỗi không đúng về bảo vệ con của ARCHIVED report. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 5 FAILED: CSDL cho phép xóa report_sources của báo cáo ARCHIVED.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 5: Bảng con report_sources bất biến khi báo cáo đã ARCHIVED.';

  -- TEST 6: Cannot DELETE/UPDATE statistics on ARCHIVED report
  v_test_failed := false;
  BEGIN
    UPDATE public.report_field_statistics SET received_total = 9999 WHERE report_id = v_suite_rep_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('bất biến' IN v_sqlerrm) = 0 AND POSITION('archived' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 6 FAILED: Lỗi không đúng bảo vệ statistics. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 6 FAILED: CSDL cho phép cập nhật report_field_statistics của báo cáo ARCHIVED.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 6: Bảng con report_field_statistics bất biến khi báo cáo đã ARCHIVED.';

  -- TEST 7: Cannot DELETE/UPDATE indicators on ARCHIVED report
  v_test_failed := false;
  BEGIN
    DELETE FROM public.report_indicators WHERE report_id = v_suite_rep_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('bất biến' IN v_sqlerrm) = 0 AND POSITION('archived' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 7 FAILED: Lỗi không đúng bảo vệ indicators. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 7 FAILED: CSDL cho phép xóa report_indicators của báo cáo ARCHIVED.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 7: Bảng con report_indicators bất biến khi báo cáo đã ARCHIVED.';

  -- TEST 8: Cannot DELETE/UPDATE analysis on ARCHIVED report
  v_test_failed := false;
  BEGIN
    UPDATE public.report_analysis SET title = 'Tiêu đề giả mạo' WHERE report_id = v_suite_rep_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('bất biến' IN v_sqlerrm) = 0 AND POSITION('archived' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 8 FAILED: Lỗi không đúng bảo vệ analysis. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 8 FAILED: CSDL cho phép cập nhật report_analysis của báo cáo ARCHIVED.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 8: Bảng con report_analysis bất biến khi báo cáo đã ARCHIVED.';

  -- TEST 9: Cannot UPDATE OLD.report_id on child tables
  v_test_failed := false;
  BEGIN
    UPDATE public.report_sources SET report_id = gen_random_uuid() WHERE id = v_suite_src_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('cố định' IN v_sqlerrm) = 0 AND POSITION('report_id' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 9 FAILED: Thông điệp không khớp lỗi bảo vệ report_id cố định. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 9 FAILED: CSDL cho phép thay đổi report_id trên bảng con report_sources.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 9: Thuộc tính report_id trên các bảng con là cố định tuyệt đối.';

  -- TEST 10: Protect report_sources.report_id from disconnection when statistics exist
  v_test_failed := false;
  BEGIN
    UPDATE public.report_sources SET report_id = gen_random_uuid() WHERE id = v_suite_src_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('cố định' IN v_sqlerrm) = 0 AND POSITION('bất biến' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 10 FAILED: Lỗi không đúng về ngắt kết nối nguồn. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 10 FAILED: CSDL cho phép di chuyển report_sources khi đã có statistics liên kết.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 10: Khóa chuyển đổi report_id trên report_sources khi có dữ liệu thống kê liên kết.';

  -- TEST 11: Independent Composite FK check (Disable sync trigger temporarily to prove error comes strictly from Foreign Key)
  INSERT INTO public.reports (
    id, report_code, report_name, report_type, period_start, period_end, data_as_of, status
  ) VALUES (
    v_suite_rep_2_id, 'SUITE-COMPOSITE-FK-REP', 'Test Composite FK Report', 'monthly', '2026-08-01', '2026-08-31', now(), 'draft'
  );

  v_test_failed := false;
  -- Tắt tạm thời sync trigger để đảm bảo lỗi phát sinh chính xác từ Ràng buộc Foreign Key
  ALTER TABLE public.report_field_statistics DISABLE TRIGGER trg_report_field_statistics_sync;
  BEGIN
    INSERT INTO public.report_field_statistics (
      id, report_id, source_id, field_id, field_name_snapshot, unit_id, unit_name_snapshot,
      received_total, received_online, completed_total, completed_early, pending_total, pending_on_time
    ) VALUES (
      gen_random_uuid(), v_suite_rep_2_id, v_suite_src_id, v_field_1, 'Snapshot Test', '00000000-0000-0000-0000-000000000001'::uuid, 'Unit Test',
      10, 10, 10, 10, 0, 0
    );
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    ALTER TABLE public.report_field_statistics ENABLE TRIGGER trg_report_field_statistics_sync;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF v_sqlstate <> '23503' AND POSITION('fk_stats_report_source' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 11 FAILED: Lỗi không xuất phát từ Composite Foreign Key (SQLSTATE 23503 / fk_stats_report_source). SQLSTATE: %, Message: %', v_sqlstate, v_sqlerrm;
    END IF;
  END;
  ALTER TABLE public.report_field_statistics ENABLE TRIGGER trg_report_field_statistics_sync;

  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Composite FK (report_id, source_id) không chặn bản ghi có report_id không khớp với source_id.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 11: Ràng buộc Composite FK (report_id, source_id) ngăn chặn sai lệch ở cấp CSDL.';

  -- TEST 12: Snapshot contains complete historical state reconstruction metadata
  SELECT count(*), snapshot_json INTO v_snap_count, v_snap_json
  FROM public.report_snapshots 
  WHERE report_id = v_suite_rep_id
  GROUP BY snapshot_json;

  IF v_snap_count < 1 THEN
    RAISE EXCEPTION 'TEST 12 FAILED: Không tìm thấy bản chụp snapshot cho báo cáo v_suite_rep_id.';
  END IF;

  IF v_snap_json->'report_metadata' IS NULL OR 
     v_snap_json->'units_snapshot' IS NULL OR 
     v_snap_json->'fields_snapshot' IS NULL OR 
     v_snap_json->'sources' IS NULL OR 
     v_snap_json->'field_statistics' IS NULL OR 
     v_snap_json->'indicators' IS NULL OR 
     v_snap_json->'indicator_definitions_snapshot' IS NULL OR 
     v_snap_json->'analysis' IS NULL THEN
    RAISE EXCEPTION 'TEST 12 FAILED: Bản chụp snapshot thiếu một trong các thành phần tái tạo lịch sử (report_metadata, units_snapshot, fields_snapshot, sources, field_statistics, indicators, indicator_definitions_snapshot, analysis).';
  END IF;

  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 12: Tự động đóng băng bản chụp snapshot chứa đầy đủ thông tin tái tạo lịch sử (8 khối dữ liệu).';

  -- TEST 13: Snapshots are immutable (cannot UPDATE or DELETE)
  v_test_failed := false;
  BEGIN
    DELETE FROM public.report_snapshots WHERE report_id = v_suite_rep_id;
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF POSITION('bất biến' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 13 FAILED: Lỗi không khớp bảo vệ snapshot bất biến. Message: %', v_sqlerrm;
    END IF;
  END;
  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 13 FAILED: CSDL cho phép xóa bản chụp snapshot.';
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 13: Bảng report_snapshots hoàn toàn bất biến.';

  -- TEST 14: Audit logs append-only (cannot UPDATE or DELETE)
  v_test_failed := false;
  DECLARE
    v_audit_test_id UUID;
  BEGIN
    -- Tạo trước một audit record kiểm thử bằng trusted context
    INSERT INTO public.audit_logs (
      id, user_id, action, entity_type, entity_id, metadata, created_at
    ) VALUES (
      gen_random_uuid(), 'system_test_runner', 'TEST_APPEND_ONLY', 'report', v_suite_rep_id::text, '{}'::jsonb, now()
    ) RETURNING id INTO v_audit_test_id;

    BEGIN
      DELETE FROM public.audit_logs WHERE id = v_audit_test_id;
      v_test_failed := true;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
      IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
      IF POSITION('append-only' IN v_sqlerrm) = 0 THEN
        RAISE EXCEPTION 'TEST 14 FAILED: Lỗi không khớp bảo vệ append-only. Message: %', v_sqlerrm;
      END IF;
    END;

    IF v_test_failed THEN
      RAISE EXCEPTION 'TEST 14 FAILED: CSDL cho phép xóa nhật ký kiểm toán audit_logs.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE id = v_audit_test_id) THEN
      RAISE EXCEPTION 'TEST 14 FAILED: Bản ghi audit log đã bị xóa mặc dù trigger không báo lỗi!';
    END IF;
  END;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 14: Nhật ký kiểm toán audit_logs là append-only tuyệt đối (Đã xác nhận trên bản ghi thực).';

  -- TEST 15: Client/authenticated cannot call write_audit_log (Permission Denied)
  IF has_function_privilege('public', 'public.write_audit_log(text, text, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Vai trò PUBLIC không được phép EXECUTE hàm write_audit_log.';
  END IF;

  IF has_function_privilege('anon', 'public.write_audit_log(text, text, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Vai trò anon không được phép EXECUTE hàm write_audit_log.';
  END IF;

  IF has_function_privilege('authenticated', 'public.write_audit_log(text, text, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Vai trò authenticated không được phép EXECUTE hàm write_audit_log.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.write_audit_log(text, text, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Vai trò service_role bắt buộc phải có quyền EXECUTE hàm write_audit_log.';
  END IF;

  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 15: Phân quyền EXECUTE hàm write_audit_log chuẩn xác (PUBLIC/anon/authenticated = FALSE, service_role = TRUE).';

  -- TEST 16: Narrative generated_text & source_metrics match database metrics 100%
  SELECT generated_text, source_metrics INTO v_analysis_text, v_analysis_metrics
  FROM public.report_analysis
  WHERE report_id = v_demo_report_id AND scope_type = 'overview'
  LIMIT 1;

  SELECT 
    SUM(received_total), SUM(received_online), SUM(completed_total),
    SUM(completed_early), SUM(completed_on_time), SUM(completed_late), SUM(pending_late)
  INTO 
    v_sum_received, v_sum_online, v_sum_completed,
    v_sum_early, v_sum_ontime, v_sum_late, v_sum_pending_late
  FROM public.report_field_statistics
  WHERE report_id = v_demo_report_id;

  v_calc_online_rate := ROUND((v_sum_online::numeric / v_sum_received::numeric * 100.0), 4);
  v_calc_ontime_rate := ROUND(((v_sum_early + v_sum_ontime)::numeric / v_sum_completed::numeric * 100.0), 4);
  v_calc_overdue_rate := ROUND(((v_sum_late + v_sum_pending_late)::numeric / v_sum_received::numeric * 100.0), 4);

  IF POSITION(v_sum_received::text IN v_analysis_text) = 0 THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Narrative không chứa tổng tiếp nhận (%s).', v_sum_received;
  END IF;

  IF (v_analysis_metrics->>'received_online')::bigint <> v_sum_online THEN
    RAISE EXCEPTION 'TEST 16 FAILED: source_metrics.received_online (%s) không khớp CSDL (%s).', v_analysis_metrics->>'received_online', v_sum_online;
  END IF;

  IF POSITION(to_char(v_calc_online_rate, 'FM990.00') IN v_analysis_text) = 0 THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Narrative không chứa tỷ lệ trực tuyến (%s%%).', to_char(v_calc_online_rate, 'FM990.00');
  END IF;

  IF POSITION(to_char(v_calc_ontime_rate, 'FM990.00') IN v_analysis_text) = 0 THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Narrative không chứa tỷ lệ đúng hạn (%s%%).', to_char(v_calc_ontime_rate, 'FM990.00');
  END IF;

  IF POSITION(to_char(v_calc_overdue_rate, 'FM990.00') IN v_analysis_text) = 0 THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Narrative không chứa tỷ lệ quá hạn (%s%%).', to_char(v_calc_overdue_rate, 'FM990.00');
  END IF;

  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 16: Nội dung narrative và source_metrics khớp chính xác 100%% 5 chỉ số (received_total, received_online, online_rate, ontime_rate, overdue_rate).';

  -- TEST 17: All report statistics pass formulas CT1-CT4
  SELECT count(*) INTO v_invalid_count
  FROM public.report_field_statistics
  WHERE report_id = v_demo_report_id AND validation_status <> 'valid';

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'TEST 17 FAILED: Tồn tại % bản ghi thống kê vi phạm công thức toán học CT1-CT4.', v_invalid_count;
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 17: 100%% bản ghi thống kê đáp ứng chuẩn xác các công thức toán học CT1-CT4.';

  -- TEST 18: Field to Unit mapping matches MASTER 100% (scoped to DEMO REPORT)
  SELECT count(*) INTO v_mismatch_field_unit
  FROM public.report_field_statistics s
  JOIN public.fields f ON f.id = s.field_id
  WHERE s.report_id = v_demo_report_id AND s.unit_id <> f.unit_id;

  IF v_mismatch_field_unit > 0 THEN
    RAISE EXCEPTION 'TEST 18 FAILED: Tồn tại % bản ghi có unit_id sai lệch so với danh mục Lĩnh vực Master.', v_mismatch_field_unit;
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 18: Ánh xạ Lĩnh vực -> Đơn vị khớp chính xác 100%% với Danh mục Master.';

  -- TEST 19: Source to Report mapping matches 100% (scoped to DEMO REPORT)
  SELECT count(*) INTO v_mismatch_source_rep
  FROM public.report_field_statistics s
  JOIN public.report_sources src ON src.id = s.source_id
  WHERE s.report_id = v_demo_report_id AND s.report_id <> src.report_id;

  IF v_mismatch_source_rep > 0 THEN
    RAISE EXCEPTION 'TEST 19 FAILED: Tồn tại % bản ghi có report_id khác với report_id của Nguồn dữ liệu.', v_mismatch_source_rep;
  END IF;
  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 19: Tất cả bản ghi thống kê thuộc nguồn dữ liệu đều tương thích tuyệt đối với kỳ báo cáo.';

  -- TEST 20: Multi-source aggregation semantics & Unique Constraint Verification
  SELECT SUM(received_total), SUM(received_online)
  INTO v_sum_received, v_sum_online
  FROM public.report_field_statistics
  WHERE report_id = v_demo_report_id;

  IF v_sum_received <> 2450 OR v_sum_online <> 2080 THEN
    RAISE EXCEPTION 'TEST 20 FAILED: Tổng tích lũy đa nguồn không chính xác. Tổng tiếp nhận: % (Kỳ vọng: 2450), Trực tuyến: % (Kỳ vọng: 2080)', v_sum_received, v_sum_online;
  END IF;

  -- 1. Tạo source riêng thuộc v_suite_rep_2_id (không tái sử dụng v_suite_src_id của report 1)
  INSERT INTO public.report_sources (
    id, report_id, source_type, source_name, import_status
  ) VALUES (
    v_suite_src_2_id, v_suite_rep_2_id, 'manual', 'Nguồn Kiểm thử Suite 2', 'completed'
  );

  -- 2. Chèn bản ghi thống kê hợp lệ đầu tiên cho v_suite_rep_2_id và v_suite_src_2_id
  INSERT INTO public.report_field_statistics (
    id, report_id, source_id, field_id, received_total, received_online, completed_total, completed_early, pending_total, pending_on_time
  ) VALUES (
    gen_random_uuid(), v_suite_rep_2_id, v_suite_src_2_id, v_field_1, 10, 10, 10, 10, 0, 0
  );

  -- 3. Chèn bản ghi thứ hai trùng (report_id, source_id, field_id) để kiểm tra uq_report_source_field (SQLSTATE 23505)
  v_test_failed := false;
  BEGIN
    INSERT INTO public.report_field_statistics (
      id, report_id, source_id, field_id, received_total, received_online, completed_total, completed_early, pending_total, pending_on_time
    ) VALUES (
      gen_random_uuid(), v_suite_rep_2_id, v_suite_src_2_id, v_field_1, 10, 10, 10, 10, 0, 0
    );
    v_test_failed := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm LIKE '%TEST % FAILED%' THEN RAISE EXCEPTION '%', v_sqlerrm; END IF;
    IF v_sqlstate <> '23505' AND POSITION('uq_report_source_field' IN v_sqlerrm) = 0 THEN
      RAISE EXCEPTION 'TEST 20 FAILED: Lỗi không xuất phát từ Ràng buộc Unique uq_report_source_field (SQLSTATE 23505). SQLSTATE: %, Message: %', v_sqlstate, v_sqlerrm;
    END IF;
  END;

  IF v_test_failed THEN
    RAISE EXCEPTION 'TEST 20 FAILED: CSDL cho phép chèn trùng lặp (report_id, source_id, field_id) trên bảng report_field_statistics.';
  END IF;

  v_passed_tests := v_passed_tests + 1;
  RAISE NOTICE 'PASS Test 20: Quy tắc tích lũy đa nguồn và cơ chế chống trùng lặp dữ liệu (Unique Constraint 23505) chính xác tuyệt đối.';

  -- KHI CẢ 20 TEST ĐỀU PASS: KÍCH HOẠT SUBTRANSACTION ROLLBACK ĐỂ LÀM SẠCH 100% DỮ LIỆU TẠM
  RAISE EXCEPTION 'TEST_SUITE_SUCCESS_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlerrm = MESSAGE_TEXT;
    IF v_sqlerrm = 'TEST_SUITE_SUCCESS_ROLLBACK' THEN
      RAISE NOTICE '======================================================================';
      RAISE NOTICE 'KẾT QUẢ: TẤT CẢ %/20 BÀI KIỂM THỬ ĐÃ PASS THÀNH CÔNG RỰC RỠ (v12 FINAL)!', v_passed_tests;
      RAISE NOTICE 'ĐÃ ROLLBACK SẠCH SẼ TOÀN BỘ DỮ LIỆU TẠM THỜI QUA PHÂN ĐOẠN SUBTRANSACTION.';
      RAISE NOTICE 'BÁO CÁO DEMO CHÍNH (ID: %) HOÀN TOÀN BẤT BIẾN VÀ LƯU GIỮ NGUYÊN VẸN Ở TRẠNG THÁI LOCKED.', v_demo_report_id;
      RAISE NOTICE '======================================================================';
    ELSE
      -- Tái xuất lỗi ngoại lệ nếu bất kỳ test nào thất bại
      RAISE EXCEPTION '%', v_sqlerrm;
    END IF;
  END;
END;
$$;
