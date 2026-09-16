CREATE TABLE IF NOT EXISTS public.biblia_hooks_translations (
  hook_id INTEGER PRIMARY KEY,
  text_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.biblia_hooks_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read translations" ON public.biblia_hooks_translations FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert translations" ON public.biblia_hooks_translations FOR INSERT TO authenticated WITH CHECK (true);