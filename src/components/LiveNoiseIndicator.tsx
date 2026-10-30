import React from 'react';
import { motion } from 'motion/react';
import { Volume2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  level: number;
  isActive: boolean;
  threshold?: number;
  lang?: 'en' | 'ar';
}

export const LiveNoiseIndicator: React.FC<Props> = ({ level, isActive, threshold = 30, lang = 'en' }) => {
  const isTooLoud = level > threshold;
  if (!isActive) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
        isTooLoud 
          ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300' 
          : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
      }`}
    >
      <div className="relative flex items-center">
        {isTooLoud ? (
          <AlertTriangle size={14} className="text-rose-500 animate-pulse" />
        ) : (
          <ShieldCheck size={14} className="text-emerald-500" />
        )}
      </div>
      
      <div className="flex items-center gap-1.5 font-mono">
        <span className="font-bold">{level} dB</span>
        <span className="text-[10px] uppercase font-sans text-slate-500 dark:text-slate-400">
          {isTooLoud 
            ? (lang === 'ar' ? 'ضجيج مرتفع' : 'High Noise') 
            : (lang === 'ar' ? 'غرفة معزولة' : 'Acoustics OK')}
        </span>
      </div>

      <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div 
          animate={{ width: `${Math.min(100, (level / 60) * 100)}%` }}
          className={`h-full ${isTooLoud ? 'bg-rose-500' : 'bg-emerald-500'}`}
        />
      </div>
    </motion.div>
  );
};
