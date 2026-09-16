import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useHooksFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setFavorites(new Set());
      setLoading(false);
      return;
    }

    const fetchFavorites = async () => {
      const { data } = await supabase
        .from('hooks_favorites')
        .select('hook_id')
        .eq('user_id', user.id);

      if (data) {
        setFavorites(new Set(data.map((r) => r.hook_id)));
      }
      setLoading(false);
    };

    fetchFavorites();
  }, [user]);

  const toggleFavorite = useCallback(
    async (hookId: string): Promise<boolean> => {
      if (!user) return false;

      const isFav = favorites.has(hookId);

      if (isFav) {
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(hookId);
          return next;
        });
        await supabase
          .from('hooks_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('hook_id', hookId);
        return false; // removed
      } else {
        setFavorites((prev) => new Set(prev).add(hookId));
        await supabase
          .from('hooks_favorites')
          .insert({ user_id: user.id, hook_id: hookId });
        return true; // added
      }
    },
    [user, favorites]
  );

  return { favorites, toggleFavorite, loading };
}
