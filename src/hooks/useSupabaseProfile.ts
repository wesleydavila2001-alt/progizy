import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getLevelInfo, getRankTier, xpForLevel } from '@/lib/store';
import type {
  MasterProfile,
  TikTokAccount,
  VideoEntry,
  ReferenceItem,
  ContentEntry,
  ScheduleEntry,
  PerformanceEntry,
} from '@/lib/store';
import { playSound } from '@/lib/sounds';

const MASTER_PROFILE_NAME = 'ProgizyN';
const MASTER_PROFILE_ID = 'progizyn-master-local';
const MASTER_PROFILE_XP = xpForLevel(1000);

const createForcedMasterProfile = (id = MASTER_PROFILE_ID): MasterProfile => ({
  id,
  name: MASTER_PROFILE_NAME,
  selectedTitle: 'Entidade Suprema',
  createdAt: new Date().toISOString(),
  xp: MASTER_PROFILE_XP,
  level: 1000,
  streak: 12,
  totalVideos: 48,
  interactions: 42,
  accounts: [],
  videos: [],
  references: [],
  schedule: [],
  contents: [],
  performance: [],
});

// Maps DB rows to the local MasterProfile shape
function mapDbProfile(
  row: any,
  accounts: any[],
  videos: any[],
  references: any[],
  schedule: any[],
  contents: any[],
  performance: any[],
): MasterProfile {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar_url ?? undefined,
    selectedTitle: row.selected_title ?? undefined,
    createdAt: row.created_at,
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    streak: row.streak ?? 0,
    totalVideos: row.total_videos ?? 0,
    interactions: row.interactions ?? 0,
    accounts: accounts.map(a => ({
      id: a.id,
      username: a.username,
      displayName: a.display_name ?? a.username,
      niche: a.niche ?? '',
      followers: a.followers ?? 0,
      avatar: a.avatar_url ?? undefined,
      connected: a.connected ?? true,
      isPrimary: a.is_primary ?? false,
      category: (a.category as any) ?? 'geral',
    })),
    videos: videos.map(v => ({
      id: v.id,
      title: v.title,
      niche: v.niche ?? '',
      status: (v.status as any) ?? 'idea',
      category: (v.category as any) ?? 'crescimento',
      scheduledDate: v.scheduled_date ?? undefined,
      accountId: v.account_id ?? undefined,
      thumbnail: v.thumbnail_url ?? undefined,
    })),
    references: references.map(r => ({
      id: r.id,
      type: (r.type as any) ?? 'link',
      url: r.url ?? '',
      title: r.title,
      niche: r.niche ?? '',
      category: r.category as any,
      refType: r.ref_type as any,
      description: r.description ?? undefined,
      createdAt: r.created_at,
      favorite: r.favorite ?? false,
    })),
    schedule: schedule.map(s => ({
      id: s.id,
      videoId: s.video_id ?? undefined,
      accountId: s.account_id ?? undefined,
      date: s.date,
      time: s.time,
      title: s.title,
      description: s.description ?? undefined,
      hashtags: s.hashtags ?? undefined,
      category: s.category as any,
      objective: s.objective ?? undefined,
      status: (s.status as any) ?? 'idea',
      postedAt: s.posted_at ?? undefined,
    })),
    contents: contents.map(c => ({
      id: c.id,
      title: c.title,
      category: (c.category as any) ?? 'crescimento',
      objective: c.objective ?? '',
      videoLink: c.video_link ?? '',
      imageUrl: c.image_url ?? '',
      description: c.description ?? '',
      hashtags: c.hashtags ?? '',
      cta: c.cta ?? '',
      observations: c.observations ?? '',
      status: (c.status as any) ?? 'idea',
      priority: (c.priority as any) ?? 'medium',
      accountId: c.account_id ?? '',
      favorite: c.favorite ?? false,
      createdAt: c.created_at,
    })),
    performance: performance.map(p => ({
      id: p.id,
      contentId: p.content_id ?? undefined,
      title: p.title,
      accountId: p.account_id,
      category: (p.category as any) ?? 'crescimento',
      date: p.date,
      views: p.views ?? 0,
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      shares: p.shares ?? 0,
      saves: p.saves ?? 0,
      objective: p.objective ?? undefined,
      result: p.result ?? undefined,
    })),
  };
}

export function useSupabaseProfiles() {
  const { user, isReady } = useAuth();
  const [profiles, setProfiles] = useState<MasterProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;

  const forceMasterProfile = useCallback(() => {
    const master = createForcedMasterProfile();
    setProfiles([master]);
    setActiveProfileId(master.id);
    localStorage.setItem('progcontrol-active-profile', master.id);
    setLoading(false);
  }, []);

  const fetchProfiles = useCallback(async () => {
    if (!isReady) {
      setLoading(true);
      return;
    }

    if (!user) {
      forceMasterProfile();
      return;
    }

    // Entra imediatamente no Perfil Mestre, mesmo se a nuvem estiver lenta/offline.
    forceMasterProfile();

    try {
      const { data: mpRows, error: profilesError } = await supabase
        .from('master_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');

      if (profilesError) throw profilesError;

      let rows = mpRows ?? [];
      if (!rows.some((row) => row.name?.toLowerCase() === MASTER_PROFILE_NAME.toLowerCase())) {
        // Força o Perfil Mestre ProgizyN no nível 1000.
        const { data: created, error: createError } = await supabase
          .from('master_profiles')
          .insert({
            user_id: user.id,
            name: MASTER_PROFILE_NAME,
            xp: MASTER_PROFILE_XP,
            level: 1000,
            streak: 12,
            total_videos: 48,
            interactions: 42,
            selected_title: 'Entidade Suprema',
          })
          .select()
          .single();

        if (createError) throw createError;
        if (created) {
          rows = [created, ...rows];
        }
      }

      const mpIds = rows.map(r => r.id);

      const [accts, vids, refs, sched, conts, perfs] = await Promise.all([
        supabase.from('tiktok_accounts').select('*').in('master_profile_id', mpIds),
        supabase.from('videos').select('*').in('master_profile_id', mpIds),
        supabase.from('references').select('*').in('master_profile_id', mpIds),
        supabase.from('schedule').select('*').in('master_profile_id', mpIds),
        supabase.from('contents').select('*').in('master_profile_id', mpIds),
        supabase.from('performance').select('*').in('master_profile_id', mpIds),
      ]);

      const childErrors = [accts.error, vids.error, refs.error, sched.error, conts.error, perfs.error].filter(Boolean);
      if (childErrors.length > 0) throw childErrors[0];

      const mapped = rows.map(mp =>
        mapDbProfile(
          mp,
          (accts.data ?? []).filter(a => a.master_profile_id === mp.id),
          (vids.data ?? []).filter(v => v.master_profile_id === mp.id),
          (refs.data ?? []).filter(r => r.master_profile_id === mp.id),
          (sched.data ?? []).filter(s => s.master_profile_id === mp.id),
          (conts.data ?? []).filter(c => c.master_profile_id === mp.id),
          (perfs.data ?? []).filter(p => p.master_profile_id === mp.id),
        )
      );

      setProfiles(mapped);

      const masterProfile = mapped.find((p) => p.name.toLowerCase() === MASTER_PROFILE_NAME.toLowerCase());
      const nextActiveId = masterProfile?.id ?? mapped[0]?.id ?? null;
      setActiveProfileId(nextActiveId);
      if (nextActiveId) localStorage.setItem('progcontrol-active-profile', nextActiveId);
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
      forceMasterProfile();
    } finally {
      setLoading(false);
    }
  }, [user, isReady, forceMasterProfile]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const setActiveProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    localStorage.setItem('progcontrol-active-profile', id);
  }, []);

  const createProfile = useCallback(async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('master_profiles')
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (data && !error) {
      await fetchProfiles();
      setActiveProfile(data.id);
    }
  }, [user, fetchProfiles, setActiveProfile]);

  const deleteProfile = useCallback(async (id: string) => {
    await supabase.from('master_profiles').delete().eq('id', id);
    await fetchProfiles();
    if (activeProfileId === id) {
      setActiveProfileId(null);
      localStorage.removeItem('progcontrol-active-profile');
    }
  }, [activeProfileId, fetchProfiles]);

  const updateProfile = useCallback(async (updates: Partial<MasterProfile>) => {
    if (!activeProfileId) return;

    // Map local field names to DB columns
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;
    if (updates.selectedTitle !== undefined) dbUpdates.selected_title = updates.selectedTitle;
    if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
    if (updates.totalVideos !== undefined) dbUpdates.total_videos = updates.totalVideos;
    if (updates.interactions !== undefined) dbUpdates.interactions = updates.interactions;

    // Handle child collections
    if (updates.accounts) {
      await syncAccounts(activeProfileId, updates.accounts);
    }
    if (updates.videos) {
      await syncVideos(activeProfileId, updates.videos);
    }
    if (updates.references) {
      await syncReferences(activeProfileId, updates.references);
    }
    if (updates.schedule) {
      await syncSchedule(activeProfileId, updates.schedule);
    }
    if (updates.contents) {
      await syncContents(activeProfileId, updates.contents);
    }
    if (updates.performance) {
      await syncPerformance(activeProfileId, updates.performance);
    }

    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from('master_profiles').update(dbUpdates).eq('id', activeProfileId);
    }

    await fetchProfiles();
    playSound('saveContent');
  }, [activeProfileId, fetchProfiles, user]);

  const addXP = useCallback(async (amount: number) => {
    if (!activeProfileId || !activeProfile) return;
    const oldLevel = activeProfile.level;
    const newInteractions = (activeProfile.interactions || 0) + 1;
    const bonus = newInteractions % 8 === 0 ? 5 : 0;
    const finalXP = activeProfile.xp + amount + bonus;
    const info = getLevelInfo(finalXP);

    await supabase.from('master_profiles').update({
      xp: finalXP,
      level: info.level,
      interactions: newInteractions,
    }).eq('id', activeProfileId);

    if (info.level > oldLevel) {
      setTimeout(() => playSound('levelUp'), 100);
    }

    await fetchProfiles();
  }, [activeProfileId, activeProfile, fetchProfiles]);

  const logout = useCallback(() => {
    setActiveProfileId(null);
    localStorage.removeItem('progcontrol-active-profile');
  }, []);

  // Sync helpers — delete all + re-insert for simplicity
  async function syncAccounts(mpId: string, accounts: TikTokAccount[]) {
    if (!user) return;
    await supabase.from('tiktok_accounts').delete().eq('master_profile_id', mpId);
    if (accounts.length > 0) {
      await supabase.from('tiktok_accounts').insert(
        accounts.map(a => ({
          id: a.id?.length === 36 ? a.id : undefined, // keep UUID ids
          master_profile_id: mpId,
          user_id: user.id,
          username: a.username,
          display_name: a.displayName,
          niche: a.niche,
          followers: a.followers,
          avatar_url: a.avatar,
          connected: a.connected,
          is_primary: a.isPrimary,
          category: a.category,
        }))
      );
    }
  }

  async function syncVideos(mpId: string, videos: VideoEntry[]) {
    if (!user) return;
    await supabase.from('videos').delete().eq('master_profile_id', mpId);
    if (videos.length > 0) {
      await supabase.from('videos').insert(
        videos.map(v => ({
          id: v.id?.length === 36 ? v.id : undefined,
          master_profile_id: mpId,
          user_id: user.id,
          title: v.title,
          niche: v.niche,
          status: v.status,
          category: v.category,
          scheduled_date: v.scheduledDate,
          account_id: v.accountId,
          thumbnail_url: v.thumbnail,
        }))
      );
    }
  }

  async function syncReferences(mpId: string, refs: ReferenceItem[]) {
    if (!user) return;
    await supabase.from('references').delete().eq('master_profile_id', mpId);
    if (refs.length > 0) {
      await supabase.from('references').insert(
        refs.map(r => ({
          id: r.id?.length === 36 ? r.id : undefined,
          master_profile_id: mpId,
          user_id: user.id,
          type: r.type,
          url: r.url,
          title: r.title,
          niche: r.niche,
          category: r.category,
          ref_type: r.refType,
          description: r.description,
          favorite: r.favorite,
        }))
      );
    }
  }

  async function syncSchedule(mpId: string, schedule: ScheduleEntry[]) {
    if (!user) return;
    await supabase.from('schedule').delete().eq('master_profile_id', mpId);
    if (schedule.length > 0) {
      await supabase.from('schedule').insert(
        schedule.map(s => ({
          id: s.id?.length === 36 ? s.id : undefined,
          master_profile_id: mpId,
          user_id: user.id,
          video_id: s.videoId,
          account_id: s.accountId,
          date: s.date,
          time: s.time,
          title: s.title,
          description: s.description,
          hashtags: s.hashtags,
          category: s.category,
          objective: s.objective,
          status: s.status,
          posted_at: s.postedAt,
        }))
      );
    }
  }

  async function syncContents(mpId: string, contents: ContentEntry[]) {
    if (!user) return;
    await supabase.from('contents').delete().eq('master_profile_id', mpId);
    if (contents.length > 0) {
      await supabase.from('contents').insert(
        contents.map(c => ({
          id: c.id?.length === 36 ? c.id : undefined,
          master_profile_id: mpId,
          user_id: user.id,
          title: c.title,
          category: c.category,
          objective: c.objective,
          video_link: c.videoLink,
          image_url: c.imageUrl,
          description: c.description,
          hashtags: c.hashtags,
          cta: c.cta,
          observations: c.observations,
          status: c.status,
          priority: c.priority,
          account_id: c.accountId,
          favorite: c.favorite,
        }))
      );
    }
  }

  async function syncPerformance(mpId: string, perf: PerformanceEntry[]) {
    if (!user) return;
    await supabase.from('performance').delete().eq('master_profile_id', mpId);
    if (perf.length > 0) {
      await supabase.from('performance').insert(
        perf.map(p => ({
          id: p.id?.length === 36 ? p.id : undefined,
          master_profile_id: mpId,
          user_id: user.id,
          content_id: p.contentId,
          title: p.title,
          account_id: p.accountId,
          category: p.category,
          date: p.date,
          views: p.views,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
          saves: p.saves,
          objective: p.objective,
          result: p.result,
        }))
      );
    }
  }

  return {
    profiles,
    activeProfile,
    profile: activeProfile,
    setActiveProfile,
    createProfile,
    deleteProfile,
    updateProfile,
    addXP,
    logout,
    loading,
    refetch: fetchProfiles,
  };
}
