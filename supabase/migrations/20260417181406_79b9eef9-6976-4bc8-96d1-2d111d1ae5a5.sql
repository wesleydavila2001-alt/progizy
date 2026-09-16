DROP POLICY IF EXISTS "Authenticated can insert translations" ON public.biblia_hooks_translations;
CREATE POLICY "Authenticated users can create translations for existing hooks"
ON public.biblia_hooks_translations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.biblia_hooks bh
    WHERE bh.id = hook_id
  )
);