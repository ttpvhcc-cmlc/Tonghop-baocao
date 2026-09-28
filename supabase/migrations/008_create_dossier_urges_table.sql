-- Migration 008: Create dossier_urges table for administrative urging records
CREATE TABLE IF NOT EXISTS public.dossier_urges (
  id TEXT PRIMARY KEY,
  ticket_code TEXT,
  dossier_code TEXT NOT NULL,
  citizen_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  procedure_name TEXT NOT NULL,
  received_date TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  assigned_unit TEXT NOT NULL,
  processor_name TEXT,
  notes TEXT,
  reception_time TEXT,
  proposal TEXT,
  channel TEXT NOT NULL DEFAULT 'direct',
  urge_count INTEGER NOT NULL DEFAULT 1,
  urgency TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_name TEXT NOT NULL DEFAULT 'Cán bộ tiếp nhận',
  created_by_id TEXT,
  response_deadline TEXT,
  unit_feedback TEXT,
  feedback_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and set policies allowing public / authenticated access
ALTER TABLE public.dossier_urges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_urges_select_policy" ON public.dossier_urges;
CREATE POLICY "dossier_urges_select_policy" ON public.dossier_urges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "dossier_urges_insert_policy" ON public.dossier_urges;
CREATE POLICY "dossier_urges_insert_policy" ON public.dossier_urges
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "dossier_urges_update_policy" ON public.dossier_urges;
CREATE POLICY "dossier_urges_update_policy" ON public.dossier_urges
  FOR UPDATE USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "dossier_urges_delete_policy" ON public.dossier_urges;
CREATE POLICY "dossier_urges_delete_policy" ON public.dossier_urges
  FOR DELETE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dossier_urges_dossier_code ON public.dossier_urges(dossier_code);
CREATE INDEX IF NOT EXISTS idx_dossier_urges_assigned_unit ON public.dossier_urges(assigned_unit);
CREATE INDEX IF NOT EXISTS idx_dossier_urges_status ON public.dossier_urges(status);
CREATE INDEX IF NOT EXISTS idx_dossier_urges_created_at ON public.dossier_urges(created_at DESC);
