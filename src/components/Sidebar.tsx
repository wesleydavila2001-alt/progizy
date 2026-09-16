import { LayoutDashboard, Users, Video, Image, Calendar, MessageSquare, Trophy, Settings, LogOut, FileText, Zap, BarChart3, BookOpen, Target, Languages, Download, Wand2, Flame, UserSearch, Library, BookMarked, Music } from 'lucide-react';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { getLevelInfo, getRankTier, getRarityColor } from '@/lib/store';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Download, label: 'Downloads', id: 'downloads' },
  { icon: Trophy, label: 'Gamificação', id: 'gamification' },
  { icon: BookOpen, label: 'Hooks & CTAs', id: 'hooks-ctas' },
  { icon: Music, label: 'Letras (Suno)', id: 'lyrics' },
  { icon: Target, label: 'Missões', id: 'missions' },
  { icon: MessageSquare, label: 'Pesquisa AI', id: 'ai-chat' },
  
  { icon: Languages, label: 'Transcrição', id: 'transcription' },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  profileName: string;
  xp: number;
  onLogout: () => void;
}

export function AppSidebar({ activeTab, onTabChange, profileName, xp, onLogout }: SidebarProps) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const levelInfo = getLevelInfo(xp);
  const tier = getRankTier(levelInfo.level);

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        {/* Brand */}
        <div className={`p-4 pb-3 transition-all duration-300 ${collapsed && !isMobile ? 'px-2' : 'px-4'}`}>
          {collapsed && !isMobile ? (
            <div className="flex justify-center">
              <span className="text-xl font-black text-primary glow-red-text">C</span>
            </div>
          ) : (
            <div>
              <h1 className="text-lg font-black tracking-[0.15em] leading-none">
                <span className="text-gradient-red">CREATOR</span>
                <span className="text-foreground">CORE</span>
              </h1>
              <p className="text-[10px] text-muted-foreground mt-1.5 tracking-widest uppercase">O núcleo do seu conteúdo</p>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className={`px-4 pb-4 transition-all duration-300 ${collapsed && !isMobile ? 'px-2' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 min-w-[2.25rem] rounded-lg gradient-red flex items-center justify-center text-primary-foreground font-bold text-sm glow-red">
              {profileName[0]?.toUpperCase()}
            </div>
            <div className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${collapsed && !isMobile ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              <p className="text-sm font-semibold text-foreground truncate">{profileName}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Zap className={`w-3 h-3 ${tier.color}`} />
                <p className={`text-[10px] font-medium ${tier.color}`}>{tier.name}</p>
                <span className={`text-[7px] px-1 py-0.5 rounded-sm font-bold ${getRarityColor(tier.rarity)} bg-secondary/60`}>
                  {tier.rarity}
                </span>
                <span className="text-[7px] px-1 py-0.5 rounded-sm font-bold text-foreground/80 bg-secondary/60">
                  Lv {levelInfo.level}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Trocar perfil"
              className={`p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 ${collapsed && !isMobile ? 'w-0 opacity-0 overflow-hidden p-0' : 'opacity-100'}`}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      isActive={isActive}
                      tooltip={item.label}
                      className={
                        isActive
                          ? 'bg-primary/12 text-primary border border-primary/25 hover:bg-primary/18 hover:text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80 sidebar-glow-hover'
                      }
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? 'drop-shadow-[0_0_6px_hsl(0_90%_48%/0.5)]' : ''}`} />
                      <span className="text-[13px]">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onTabChange('notification-settings')}
              isActive={activeTab === 'notification-settings'}
              tooltip="Configurações"
              className={activeTab === 'notification-settings'
                ? 'bg-primary/12 text-primary border border-primary/25 hover:bg-primary/18 hover:text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'}
            >
              <Settings className="w-4 h-4" />
              <span className="text-[13px]">Configurações</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}

export function MobileHeader() {
  return (
    <header className="h-12 flex items-center border-b border-border/60 bg-background/90 backdrop-blur-md md:hidden sticky top-0 z-30">
      <SidebarTrigger className="ml-3 text-muted-foreground" />
      <h1 className="ml-3 text-sm font-black tracking-[0.12em]">
        <span className="text-gradient-red">CREATOR</span>
        <span className="text-foreground">CORE</span>
      </h1>
    </header>
  );
}

export { AppSidebar as Sidebar };
