import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, LogIn, User, Zap } from 'lucide-react';
import { MasterProfile, getLevelInfo } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ProfileSelectViewProps {
  profiles: MasterProfile[];
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export function ProfileSelectView({ profiles, onSelect, onCreate, onDelete }: ProfileSelectViewProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('ProgizyN');

  const handleCreate = () => {
    onCreate(name.trim() || 'ProgizyN');
    setName('ProgizyN');
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10 relative z-10"
      >
        <h1 className="text-2xl sm:text-3xl font-black tracking-[0.15em] mb-2">
          <span className="text-gradient-red">PROG</span>
          <span className="text-foreground">CONTROL</span>
        </h1>
        <p className="text-muted-foreground text-xs tracking-widest uppercase">Selecione ou crie seu Perfil Mestre</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl w-full relative z-10">
        {profiles.map((p, i) => {
          const info = getLevelInfo(p.xp);
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card rounded-lg p-5 cursor-pointer hover:border-primary/30 transition-all group relative"
              onClick={() => onSelect(p.id)}
            >
              <button
                onClick={e => { e.stopPropagation(); onDelete(p.id); }}
                className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-md hover:bg-destructive/10"
                title="Remover perfil"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-xl gradient-red flex items-center justify-center text-primary-foreground text-lg font-bold glow-red">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{p.name}</p>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <Zap className="w-3 h-3 text-primary" />
                    <p className="text-[10px] text-primary font-medium">{info.name}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span>{p.accounts.length} contas</span>
                  <span className="text-border">•</span>
                  <span>{(p.contents || []).length} conteúdos</span>
                  <span className="text-border">•</span>
                  <span>{p.xp} XP</span>
                </div>
                <Button variant="outline" size="sm" className="w-full border-primary/20 text-primary hover:bg-primary/10 gap-1.5 text-[11px] h-8 mt-1">
                  <LogIn className="w-3 h-3" /> Entrar
                </Button>
              </div>
            </motion.div>
          );
        })}

        {/* New profile card */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: profiles.length * 0.08 }}
              className="glass-card rounded-lg p-5 cursor-pointer hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-3 border-dashed border-2 border-border min-h-[200px]"
            >
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Novo Perfil</p>
            </motion.div>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2 text-base">
                <User className="w-4 h-4 text-primary" /> Criar Perfil Mestre
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              <Input
                placeholder="Nome do perfil (ex: Tiago)"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="bg-secondary border-border h-9"
                autoFocus
              />
              <Button onClick={handleCreate} className="w-full gradient-red text-primary-foreground glow-red h-9 text-sm">
                Criar Perfil
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
