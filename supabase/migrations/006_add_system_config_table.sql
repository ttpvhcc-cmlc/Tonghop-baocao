-- Migration 006: Create system_config table for centralized system settings and RBAC
CREATE TABLE IF NOT EXISTS public.system_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and set policies allowing system config reads and writes
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_config_select_policy" ON public.system_config;
CREATE POLICY "system_config_select_policy" ON public.system_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "system_config_insert_policy" ON public.system_config;
CREATE POLICY "system_config_insert_policy" ON public.system_config
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "system_config_update_policy" ON public.system_config;
CREATE POLICY "system_config_update_policy" ON public.system_config
  FOR UPDATE USING (true)
  WITH CHECK (true);
