import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { playSound, type SoundEffect } from '@/lib/sounds';

interface CelebrationData {
  title: string;
  xp: number;
  icon?: React.ElementType;
  sound?: SoundEffect;
}

interface CelebrationContextType {
  celebrate: (data: CelebrationData) => void;
}

const CelebrationContext = createContext<CelebrationContextType>({
  celebrate: () => {},
});

export const useCelebration = () => useContext(CelebrationContext);

// Particle component for the burst effect
function Particle({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * 360;
  const distance = 60 + Math.random() * 40;
  const size = 3 + Math.random() * 4;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * distance;
  const y = Math.sin(rad) * distance;
  const colors = [
    'hsl(var(--primary))',
    'hsl(45, 100%, 60%)',
    'hsl(280, 80%, 65%)',
    'hsl(160, 80%, 55%)',
    'hsl(20, 95%, 60%)',
  ];
  const color = colors[index % colors.length];

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        top: '50%',
        left: '50%',
      }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x, y, opacity: 0, scale: 0.2 }}
      transition={{ duration: 0.7, ease: 'easeOut', delay: Math.random() * 0.15 }}
    />
  );
}

function CelebrationOverlay({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  const Icon = data.icon || Zap;

  useEffect(() => {
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Dim background */}
      <motion.div
        className="absolute inset-0 bg-background/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-3">
        {/* Glow ring */}
        <motion.div
          className="absolute w-32 h-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2.5, 2], opacity: [0, 0.8, 0] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />

        {/* Second glow pulse */}
        <motion.div
          className="absolute w-24 h-24 rounded-full border-2 border-primary/40"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0.5, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
        />

        {/* Particles */}
        {Array.from({ length: 16 }).map((_, i) => (
          <Particle key={i} index={i} total={16} />
        ))}

        {/* Icon */}
        <motion.div
          className="relative w-16 h-16 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center"
          style={{ boxShadow: '0 0 30px hsl(var(--primary) / 0.5)' }}
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: [0, 1.3, 1], rotate: [-30, 5, 0] }}
          transition={{ duration: 0.5, ease: 'backOut' }}
        >
          <Icon className="w-8 h-8 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
        </motion.div>

        {/* Title */}
        <motion.p
          className="text-lg font-black text-foreground tracking-wide text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {data.title}
        </motion.p>

        {/* XP badge */}
        <motion.div
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/30"
          style={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.3)' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: [0.5, 1.15, 1] }}
          transition={{ delay: 0.5, duration: 0.4, ease: 'backOut' }}
        >
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">+{data.xp} XP</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<CelebrationData[]>([]);
  const [current, setCurrent] = useState<CelebrationData | null>(null);

  const celebrate = useCallback((data: CelebrationData) => {
    playSound(data.sound || 'achievementUnlock');
    setQueue(prev => [...prev, data]);
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(prev => prev.slice(1));
    }
  }, [current, queue]);

  const handleDone = useCallback(() => setCurrent(null), []);

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      <AnimatePresence>
        {current && <CelebrationOverlay key={current.title} data={current} onDone={handleDone} />}
      </AnimatePresence>
    </CelebrationContext.Provider>
  );
}
