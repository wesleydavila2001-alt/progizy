import { motion } from 'framer-motion';
import { Bell, BellOff, Volume2, VolumeX, Vibrate, Check, Clock, AlertTriangle, Settings2, LogOut, User, Music } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSoundSettings, saveSoundSettings, playSound } from '@/lib/sounds';

export interface NotificationSettings {
  enabled: boolean;
  vibration: boolean;
  sound: boolean;
  reminderMinutes: number;
  confirmPosted: boolean;
  alertUnposted: boolean;
}

const DEFAULT_NOTIF: NotificationSettings = {
  enabled: true,
  vibration: true,
  sound: true,
  reminderMinutes: 10,
  confirmPosted: true,
  alertUnposted: true,
};

export const getNotifSettings = (): NotificationSettings => {
  try {
    const saved = localStorage.getItem('progcontrol-notif');
    return saved ? { ...DEFAULT_NOTIF, ...JSON.parse(saved) } : DEFAULT_NOTIF;
  } catch { return DEFAULT_NOTIF; }
};

export const saveNotifSettings = (s: NotificationSettings) => {
  localStorage.setItem('progcontrol-notif', JSON.stringify(s));
};

interface NotificationSettingsViewProps {
  onLogout?: () => void;
}

export function NotificationSettingsView({ onLogout }: NotificationSettingsViewProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(getNotifSettings);
  const [soundSettings, setSoundSettings] = useState(getSoundSettings);

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
  const userEmail = user?.email || '';
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

  const update = (patch: Partial<NotificationSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveNotifSettings(next);
  };

  const items: { key: keyof NotificationSettings; label: string; desc: string; icon: React.ReactNode; type: 'toggle' }[] = [
    { key: 'enabled', label: 'Notificações', desc: 'Receba lembretes sobre postagens agendadas', icon: settings.enabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />, type: 'toggle' },
    { key: 'vibration', label: 'Vibração', desc: 'Vibrar o dispositivo ao receber alertas', icon: <Vibrate className="w-5 h-5 text-muted-foreground" />, type: 'toggle' },
    { key: 'sound', label: 'Som de Alerta', desc: 'Tocar som quando chegar um lembrete', icon: settings.sound ? <Volume2 className="w-5 h-5 text-muted-foreground" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />, type: 'toggle' },
    { key: 'alertUnposted', label: 'Alerta de Pendência', desc: 'Avisar quando conteúdo agendado não for postado', icon: <AlertTriangle className="w-5 h-5 text-muted-foreground" />, type: 'toggle' },
    { key: 'confirmPosted', label: 'Confirmação de Postagem', desc: 'Exibir confirmação ao marcar como postado', icon: <Check className="w-5 h-5 text-muted-foreground" />, type: 'toggle' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-wide text-foreground flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-primary" /> Configurações de Notificação
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Personalize os alertas do cronograma de postagens</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        {items.map(item => (
          <div key={item.key} className="glass-card rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <Label className="text-sm font-semibold text-foreground">{item.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
            <Switch checked={settings[item.key] as boolean} onCheckedChange={v => update({ [item.key]: v })} />
          </div>
        ))}

        {/* Reminder time */}
        <div className="glass-card rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-semibold text-foreground">Tempo de Lembrete</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Quantos minutos antes da postagem receber aviso</p>
            </div>
          </div>
          <Select value={String(settings.reminderMinutes)} onValueChange={v => update({ reminderMinutes: Number(v) })}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 30, 60].map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Sound Effects */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" /> Efeitos Sonoros
        </h3>
        <p className="text-[11px] text-muted-foreground">Sons curtos para reforçar conquistas e ações importantes</p>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              {soundSettings.enabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <Label className="text-sm font-semibold text-foreground">Ativar Sons</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Sons ao completar missões, subir de nível, etc.</p>
            </div>
          </div>
          <Switch
            checked={soundSettings.enabled}
            onCheckedChange={v => {
              const next = { ...soundSettings, enabled: v };
              setSoundSettings(next);
              saveSoundSettings(next);
              if (v) playSound('taskComplete');
            }}
          />
        </div>

        {soundSettings.enabled && (
          <div className="flex items-center gap-4 pt-2">
            <VolumeX className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider
              value={[soundSettings.volume * 100]}
              max={100}
              step={5}
              onValueChange={([v]) => {
                const next = { ...soundSettings, volume: v / 100 };
                setSoundSettings(next);
                saveSoundSettings(next);
              }}
              onValueCommit={() => playSound('saveContent')}
              className="flex-1"
            />
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(soundSettings.volume * 100)}%</span>
          </div>
        )}
      </motion.div>

      <div className="glass-card rounded-xl p-4 border-primary/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          💡 Essas configurações se aplicam a <strong className="text-foreground">todos os conteúdos agendados</strong> no cronograma.
          Os lembretes são verificados a cada minuto enquanto o app estiver aberto.
        </p>
      </div>
      {/* Conta */}
      {onLogout && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Conta
          </h3>

          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14 border-2 border-primary/20">
              {userAvatar ? (
                <AvatarImage src={userAvatar} alt={userName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {userName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/60">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive py-3 text-sm font-semibold transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Você será desconectado e redirecionado para a tela de login. Nenhum dado será apagado.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
