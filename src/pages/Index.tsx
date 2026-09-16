import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseProfiles } from '@/hooks/useSupabaseProfile';
import { AppSidebar, MobileHeader } from '@/components/Sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { AccountsView } from '@/components/views/AccountsView';
import { VideosView } from '@/components/views/VideosView';
import { ContentsView } from '@/components/views/ContentsView';
import { ReferencesView } from '@/components/views/ReferencesView';
import { ScheduleView } from '@/components/views/ScheduleView';
import { AIChatView } from '@/components/views/AIChatView';
import { PerformanceView } from '@/components/views/PerformanceView';
import { HooksCTAsView } from '@/components/views/HooksCTAsView';
import { MissionsView } from '@/components/views/MissionsView';
import { TranscriptionView } from '@/components/views/TranscriptionView';
import { DownloadsView } from '@/components/views/DownloadsView';


import { GamificationView } from '@/components/views/GamificationView';
import { NotificationSettingsView } from '@/components/views/NotificationSettingsView';
import { ViralDetectorView } from '@/components/views/ViralDetectorView';




import { ProfileSelectView } from '@/components/views/ProfileSelectView';
import { LyricsComposerView } from '@/components/views/LyricsComposerView';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  useAuth();
  const {
    profiles,
    activeProfile,
    setActiveProfile,
    createProfile,
    deleteProfile,
    updateProfile,
    addXP,
    logout,
    loading,
  } = useSupabaseProfiles();

  const handleSwitchProfile = () => {
    logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-primary font-[Orbitron] text-xl animate-pulse">Carregando sua conta...</div>
        <p className="text-sm text-muted-foreground">Se isso demorar, recarregue a página.</p>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <ProfileSelectView
        profiles={profiles}
        onSelect={setActiveProfile}
        onCreate={(name) => createProfile(name)}
        onDelete={deleteProfile}
      />
    );
  }

  const profile = activeProfile;

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView profile={profile} onNavigate={setActiveTab} />;
      case 'contents': return <ContentsView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'accounts': return <AccountsView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'videos': return <VideosView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'references': return <ReferencesView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'schedule': return <ScheduleView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'performance': return <PerformanceView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'hooks-ctas': return <HooksCTAsView onXP={addXP} />;
      case 'missions': return <MissionsView profile={profile} onXP={addXP} />;
      case 'transcription': return <TranscriptionView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'downloads': return <DownloadsView />;
      case 'lyrics': return <LyricsComposerView onXP={addXP} />;
      
      
      
      
      
      case 'ai-chat': return <AIChatView profile={profile} onUpdate={updateProfile} onXP={addXP} />;
      case 'gamification': return <GamificationView profile={profile} onUpdate={updateProfile} />;
      case 'notification-settings': return <NotificationSettingsView />;
      default: return <DashboardView profile={profile} onNavigate={setActiveTab} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          profileName={profile.name}
          xp={profile.xp}
          onLogout={handleSwitchProfile}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader />
          <div className="hidden md:flex h-11 items-center border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
            <SidebarTrigger className="ml-3 text-muted-foreground hover:text-foreground transition-colors" />
          </div>
          <main className="flex-1 p-3 md:p-6 lg:p-8 overflow-x-hidden">
            {renderView()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
