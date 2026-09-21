-- ==============================================================================
-- TTHC MIGRATION 004: ALLOW NULL UNIT_ID FOR FIELDS IN 2-STAGE WORKFLOW
-- ==============================================================================
-- Mục tiêu:
-- 1) Cho phép public.fields.unit_id mang giá trị NULL trong giai đoạn nhập danh mục chưa phân công.
-- 2) Giữ nguyên quan hệ khóa ngoại: REFERENCES public.units(id) ON DELETE SET NULL.
-- 3) Giữ nguyên report_field_statistics.unit_id NOT NULL (nghiêm ngặt chặn import số liệu nếu chưa có đơn vị).
-- 4) Không xóa dữ liệu và không seed dữ liệu mới.
-- ==============================================================================

BEGIN;

-- 1. Alter public.fields to allow NULL for unit_id
ALTER TABLE public.fields ALTER COLUMN unit_id DROP NOT NULL;

-- 2. Ensure foreign key constraint allows NULL and sets NULL on unit deletion if not already configured
ALTER TABLE public.fields DROP CONSTRAINT IF EXISTS fields_unit_id_fkey;
ALTER TABLE public.fields
  ADD CONSTRAINT fields_unit_id_fkey
  FOREIGN KEY (unit_id)
  REFERENCES public.units(id)
  ON DELETE SET NULL;

-- 3. Confirm report_field_statistics.unit_id remains NOT NULL
-- (Validation check; already NOT NULL in prior schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_field_statistics'
      AND column_name = 'unit_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.report_field_statistics ALTER COLUMN unit_id SET NOT NULL;
  END IF;
END $$;

COMMIT;
