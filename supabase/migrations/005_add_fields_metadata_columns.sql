-- MIGRATION: 005_add_fields_metadata_columns.sql
-- Thêm các cột metadata nghiệp vụ TTHC từ file Excel vào bảng public.fields
-- BẮT BUỘC: linh_vuc, co_quan_cong_bo, loai_tthc, co_quan_thuc_hien, cap_thuc_hien, muc_do_cung_cap, phi_le_phi
-- TUYỆT ĐỐI KHÔNG THÊM quyet_dinh_cong_bo

DO $$
BEGIN
  -- 1. linh_vuc
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fields' AND column_name = 'linh_vuc'
  ) THEN
    ALTER TABLE public.fields ADD COLUMN linh_vuc TEXT DEFAULT 'Chưa phân loại';
  END IF;

  -- 2. co_quan_cong_bo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fields' AND column_name = 'co_quan_cong_bo'
  ) THEN
    ALTER TABLE public.fields ADD COLUMN co_quan_cong_bo TEXT;
  END IF;

  -- 3. loai_tthc
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fields' AND column_name = 'loai_tthc'
  ) THEN
    ALTER TABLE public.fields ADD COLUMN loai_tthc TEXT;
  END IF;

  -- 4. co_quan_thuc_hien
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fields' AND column_name = 'co_quan_thuc_hien'
  ) THEN
    ALTER TABLE public.fields ADD COLUMN co_quan_thuc_hien TEXT;
  END IF;

  -- 5. cap_thuc_hien
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fields' AND column_name = 'cap_thuc_hien'
  ) THEN
    ALTER TABLE public.fields ADD COLUMN cap_thuc_hien TEXT;
  END IF;

  -- 6. muc_do_cung_cap
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fields' AND column_name = 'muc_do_cung_cap'
  ) THEN
    ALTER TABLE public.fields ADD COLUMN muc_do_cung_cap TEXT;
  END IF;

  -- 7. phi_le_phi
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fields' AND column_name = 'phi_le_phi'
  ) THEN
    ALTER TABLE public.fields ADD COLUMN phi_le_phi TEXT;
  END IF;
END $$;
