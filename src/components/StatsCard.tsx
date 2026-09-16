import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  delay?: number;
  accentColor?: string;
}

export function StatsCard({ icon: Icon, label, value, change, delay = 0, accentColor = 'text-primary' }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="glass-card rounded-lg p-4 hover:border-primary/20 transition-all group overflow-hidden"
    >
      <div className="flex h-full flex-col gap-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium leading-none">{label}</p>

        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className={`text-xl font-bold font-sans truncate leading-none ${accentColor}`}>{value}</p>
            {change && (
              <p className="text-[10px] text-primary mt-1.5 font-medium leading-none">{change}</p>
            )}
          </div>

          <div className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center group-hover:bg-secondary transition-colors shrink-0 self-end">
            <Icon className={`w-4 h-4 ${accentColor}`} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
