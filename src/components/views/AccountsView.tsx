import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Star, StarOff, Wifi, WifiOff, User, RefreshCw, ArrowRightLeft, ExternalLink, Shield, Crown } from 'lucide-react';
import { UserProfile, TikTokAccount } from '@/lib/store';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  crescimento: '📈 Crescimento',
  monetizacao: '💰 Monetização',
  vendas: '🛒 Vendas',
  geral: '📌 Geral',
};

const categoryColors: Record<string, string> = {
  crescimento: 'bg-green-500/15 text-green-400 border-green-500/30',
  monetizacao: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  vendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  geral: 'bg-muted text-muted-foreground border-border',
};

interface AccountsViewProps {
  profile: UserProfile;
  onUpdate: (updates: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

export function AccountsView({ profile, onUpdate, onXP }: AccountsViewProps) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [niche, setNiche] = useState('');
  const [category, setCategory] = useState<TikTokAccount['category']>('geral');
  const [activeAccountId, setActiveAccountId] = useState<string | null>(
    profile.accounts.find(a => a.isPrimary)?.id || profile.accounts[0]?.id || null
  );

  const addAccount = () => {
    if (!username.trim()) return;
    const newAcc: TikTokAccount = {
      id: Date.now().toString(),
      username: username.startsWith('@') ? username : `@${username}`,
      displayName: displayName || username,
      niche: niche || 'Geral',
      followers: 0,
      connected: true,
      isPrimary: profile.accounts.length === 0,
      category,
    };
    onUpdate({ accounts: [...profile.accounts, newAcc] });
    onXP(2);
    setUsername('');
    setDisplayName('');
    setNiche('');
    setCategory('geral');
    setOpen(false);
    toast.success('Conta conectada com sucesso! +50 XP');
  };

  const removeAccount = (id: string) => {
    onUpdate({ accounts: profile.accounts.filter(a => a.id !== id) });
    if (activeAccountId === id) {
      setActiveAccountId(profile.accounts.find(a => a.id !== id)?.id || null);
    }
    toast.success('Conta removida');
  };

  const togglePrimary = (id: string) => {
    onUpdate({
      accounts: profile.accounts.map(a => ({ ...a, isPrimary: a.id === id })),
    });
    toast.success('Conta principal atualizada');
  };

  const toggleConnection = (id: string) => {
    onUpdate({
      accounts: profile.accounts.map(a =>
        a.id === id ? { ...a, connected: !a.connected } : a
      ),
    });
  };

  const reconnectAccount = (id: string) => {
    onUpdate({
      accounts: profile.accounts.map(a =>
        a.id === id ? { ...a, connected: true } : a
      ),
    });
    toast.success('Conta reconectada com sucesso!');
  };

  const switchToAccount = (id: string) => {
    setActiveAccountId(id);
    toast.success('Conta ativa alterada');
  };

  const primaryAccount = profile.accounts.find(a => a.isPrimary);
  const otherAccounts = profile.accounts.filter(a => !a.isPrimary);
  const totalConnected = profile.accounts.filter(a => a.connected).length;
  const totalFollowers = profile.accounts.reduce((sum, a) => sum + a.followers, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-wide text-foreground font-[Orbitron]">
            Contas <span className="text-primary">Conectadas</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie suas contas TikTok em um só lugar
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-red text-primary-foreground gap-2 glow-red font-semibold">
              <Plus className="w-4 h-4" /> Conectar Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground font-[Orbitron]">Conectar Conta TikTok</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} className="bg-secondary border-border" />
              <Input placeholder="Nome de exibição" value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-secondary border-border" />
              <Input placeholder="Nicho (ex: Marketing Digital)" value={niche} onChange={e => setNiche(e.target.value)} className="bg-secondary border-border" />
              <Select value={category} onValueChange={(v) => setCategory(v as TikTokAccount['category'])}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="crescimento">📈 Crescimento</SelectItem>
                  <SelectItem value="monetizacao">💰 Monetização</SelectItem>
                  <SelectItem value="vendas">🛒 Vendas</SelectItem>
                  <SelectItem value="geral">📌 Geral</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addAccount} className="w-full gradient-red text-primary-foreground font-semibold">
                <Shield className="w-4 h-4 mr-2" /> Conectar +50 XP
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de Contas', value: profile.accounts.length, icon: User },
          { label: 'Conectadas', value: totalConnected, icon: Wifi },
          { label: 'Desconectadas', value: profile.accounts.length - totalConnected, icon: WifiOff },
          { label: 'Seguidores Total', value: totalFollowers.toLocaleString(), icon: Crown },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl p-4 text-center"
          >
            <stat.icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Primary account highlight */}
      {primaryAccount && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 border-primary/40 glow-red relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-1.5 mb-4">
            <Crown className="w-4 h-4 text-primary fill-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-widest font-[Orbitron]">Conta Principal</span>
          </div>
          <AccountCard
            account={primaryAccount}
            isActive={activeAccountId === primaryAccount.id}
            onRemove={removeAccount}
            onTogglePrimary={togglePrimary}
            onToggleConnection={toggleConnection}
            onReconnect={reconnectAccount}
            onSwitch={switchToAccount}
            isPrimarySection
          />
        </motion.div>
      )}

      {/* Other accounts grid */}
      {otherAccounts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Outras Contas ({otherAccounts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {otherAccounts.map((acc, i) => (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.08 }}
                  className={`glass-card rounded-xl p-5 transition-all duration-300 ${
                    activeAccountId === acc.id
                      ? 'border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
                      : 'hover:border-primary/20'
                  }`}
                >
                  <AccountCard
                    account={acc}
                    isActive={activeAccountId === acc.id}
                    onRemove={removeAccount}
                    onTogglePrimary={togglePrimary}
                    onToggleConnection={toggleConnection}
                    onReconnect={reconnectAccount}
                    onSwitch={switchToAccount}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {profile.accounts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl p-12 text-center"
        >
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma conta conectada</h3>
          <p className="text-sm text-muted-foreground mb-6">Conecte sua primeira conta TikTok para começar</p>
          <Button onClick={() => setOpen(true)} className="gradient-red text-primary-foreground gap-2 glow-red">
            <Plus className="w-4 h-4" /> Conectar Conta
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function AccountCard({
  account,
  isActive,
  onRemove,
  onTogglePrimary,
  onToggleConnection,
  onReconnect,
  onSwitch,
  isPrimarySection,
}: {
  account: TikTokAccount;
  isActive: boolean;
  onRemove: (id: string) => void;
  onTogglePrimary: (id: string) => void;
  onToggleConnection: (id: string) => void;
  onReconnect: (id: string) => void;
  onSwitch: (id: string) => void;
  isPrimarySection?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Top: avatar + info + status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-full gradient-red flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20">
              {account.avatar ? (
                <img src={account.avatar} className="w-full h-full rounded-full object-cover" alt="" />
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            {/* Connection dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
              account.connected ? 'bg-green-500' : 'bg-destructive'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">{account.displayName}</p>
              {isActive && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold uppercase tracking-wider">
                  Ativa
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{account.username}</p>
            <p className="text-xs text-muted-foreground/70">{account.niche}</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${categoryColors[account.category]}`}>
          {categoryLabels[account.category]}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between py-3 border-y border-border">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Seguidores</p>
          <p className="text-lg font-bold text-foreground">{account.followers.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
          <p className={`text-xs font-semibold ${account.connected ? 'text-green-400' : 'text-destructive'}`}>
            {account.connected ? '● Conectada' : '○ Desconectada'}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {!isActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSwitch(account.id)}
            className="flex-1 text-xs gap-1.5 border-border hover:border-primary/40 hover:text-primary"
          >
            <ArrowRightLeft className="w-3 h-3" /> Acessar
          </Button>
        )}
        {!account.connected && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReconnect(account.id)}
            className="flex-1 text-xs gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500/50"
          >
            <RefreshCw className="w-3 h-3" /> Reconectar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onTogglePrimary(account.id)}
          title={account.isPrimary ? 'Conta principal' : 'Tornar principal'}
          className={`text-xs gap-1.5 ${account.isPrimary ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`}
        >
          {account.isPrimary ? <Star className="w-3 h-3 fill-yellow-400" /> : <StarOff className="w-3 h-3" />}
          {account.isPrimary ? 'Principal' : 'Tornar Principal'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggleConnection(account.id)}
          className={`text-xs gap-1.5 ${account.connected ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground'}`}
        >
          {account.connected ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
          {account.connected ? 'Desconectar' : 'Conectar'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(account.id)}
          className="text-xs gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3 h-3" /> Remover
        </Button>
      </div>
    </div>
  );
}
