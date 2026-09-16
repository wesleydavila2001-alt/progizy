import { motion } from 'framer-motion';
import { getLevelInfo, getRarityColor, getLevelBand } from '@/lib/store';
import { Zap } from 'lucide-react';

interface XPBarProps {
  xp: number;
  level?: number;
}

export function XPBar({ xp }: XPBarProps) {
  const info = getLevelInfo(xp);
  const band = getLevelBand(info.level);

  return (
    <div className="glass-card rounded-lg p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          {/* Level badge with gradient from band */}
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-lg border ${band.borderColor}`}
            style={{ background: band.gradient }}
          >
            {info.level}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className={`text-sm font-semibold leading-tight ${band.textColor}`}>{info.name}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${info.bgColor} ${getRarityColor(info.rarity)} font-semibold`}>
                {info.rarity}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {info.isMax ? '🔥 Nível Máximo!' : `${info.xpInLevel}/${info.xpNeeded} XP → Nível ${info.level + 1}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Zap className={`w-3.5 h-3.5 ${band.textColor}`} />
          <p className={`text-xs font-mono font-semibold ${band.textColor}`}>{xp.toLocaleString()} XP</p>
        </div>
      </div>
      {/* Progress bar with band gradient */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${info.progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: band.gradient }}
        />
      </div>
      <p className={`text-[9px] mt-1.5 font-medium ${band.textColor} opacity-70`}>
        Faixa visual: {band.label}
      </p>
    </div>
  );
}
