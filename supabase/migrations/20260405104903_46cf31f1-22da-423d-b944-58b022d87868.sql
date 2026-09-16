
CREATE TABLE public.biblia_hooks (
  id SERIAL PRIMARY KEY,
  hook_original TEXT NOT NULL,
  hook_pt TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Curiosidade',
  angulo TEXT NOT NULL DEFAULT 'Curiosidade',
  placeholders TEXT[] NOT NULL DEFAULT '{}',
  plataforma TEXT NOT NULL DEFAULT 'TikTok / Reels / Shorts',
  intensidade TEXT NOT NULL DEFAULT 'Média',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.biblia_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read biblia_hooks" ON public.biblia_hooks
  FOR SELECT TO authenticated USING (true);
