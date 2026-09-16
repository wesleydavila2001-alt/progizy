CREATE POLICY "Authenticated users can update translations for existing hooks"
ON public.biblia_hooks_translations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.biblia_hooks bh
    WHERE bh.id = hook_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.biblia_hooks bh
    WHERE bh.id = hook_id
  )
);