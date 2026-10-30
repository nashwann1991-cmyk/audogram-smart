import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, AlertTriangle, CheckCircle2, ShieldCheck, Volume2 } from 'lucide-react';

interface NoiseMonitorProps {
  onNoiseLevelChange?: (level: number) => void;
  threshold?: number;
  lang?: 'en' | 'ar';
  isActive: boolean;
  onToggle: (active: boolean) => void;
  onError?: (error: string) => void;
  level?: number;
  peak?: number;
  history?: number[];
  frequencies?: number[];
}

export const NoiseMonitor: React.FC<NoiseMonitorProps> = ({ 
  threshold = 30,
  lang = 'en',
  isActive,
  onToggle,
  level = 0,
  peak = 0,
  history = new Array(40).fill(0),
  frequencies = new Array(16).fill(0)
}) => {
  const isTooLoud = level > threshold;
  const isOptimal = level <= 20;

  return (
    <div className="bg-[#0b1329] text-white p-6 rounded-2xl shadow-xl border border-slate-800 font-sans relative overflow-hidden group">
      {/* Precision ambient background glow */}
      <div 
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[90px] transition-colors duration-700 pointer-events-none ${
          isActive 
            ? (isTooLoud ? 'bg-rose-500/25' : isOptimal ? 'bg-emerald-500/25' : 'bg-amber-500/20') 
            : 'bg-teal-500/10'
        }`} 
      />
      
      <div className="relative z-10 space-y-5">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isActive ? (isTooLoud ? 'bg-rose-500 animate-ping' : 'bg-emerald-400') : 'bg-slate-600'}`} />
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-slate-300 block">
                {lang === 'ar' ? 'مقياس ضجيج الغرفة العازلة' : 'Room Acoustics Calibrator'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">ANSI S3.1 / ISO 8253-1 Compliance</span>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => onToggle(!isActive)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              isActive 
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30' 
                : 'bg-teal-600 text-white hover:bg-teal-500'
            }`}
          >
            {isActive ? <MicOff size={14} /> : <Mic size={14} />}
            <span>{isActive ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'تشغيل المايك' : 'Start Monitor')}</span>
          </button>
        </div>

        {/* Real-time Frequency Spectrum Real-time Analyzer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>125 Hz</span>
            <span>1000 Hz</span>
            <span>8000 Hz</span>
          </div>
          <div className="flex items-end justify-between gap-1 h-20 p-2.5 bg-black/40 rounded-xl border border-slate-800">
            {frequencies.map((f, i) => (
              <motion.div
                key={i}
                animate={{ height: `${Math.max(4, f)}%` }}
                className={`flex-1 rounded-t-sm transition-colors duration-150 ${
                  isActive 
                    ? (isTooLoud ? 'bg-rose-500/80' : isOptimal ? 'bg-emerald-400/80' : 'bg-teal-400/80') 
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Time-series level ribbon */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>{lang === 'ar' ? 'مخطط زمني مباشر' : 'Live Timeline History'}</span>
            <span>Limit: {threshold} dB SPL</span>
          </div>
          <div className="flex items-end gap-1 h-9 px-2 bg-black/30 rounded-lg border border-slate-800/80">
            {history.map((h, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{ height: `${Math.max(6, h)}%` }}
                className={`flex-1 rounded-t-xs transition-colors duration-200 ${
                  isActive 
                    ? (h > threshold ? 'bg-rose-500' : 'bg-emerald-500/70') 
                    : 'bg-slate-800/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Numeric Telemetry Readouts */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {lang === 'ar' ? 'المستوى الحالي' : 'Current Sound Level'}
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className={`text-3xl font-extrabold tabular-nums ${
                isActive 
                  ? (isTooLoud ? 'text-rose-400' : isOptimal ? 'text-emerald-400' : 'text-teal-300') 
                  : 'text-slate-600'
              }`}>
                {isActive ? level.toString().padStart(2, '0') : '--'}
              </span>
              <span className="text-xs text-slate-400 font-sans">dB SPL</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {lang === 'ar' ? 'ذروة الضجيج' : 'Peak Recorded'}
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-3xl font-extrabold tabular-nums text-slate-300">
                {isActive ? peak.toString().padStart(2, '0') : '--'}
              </span>
              <span className="text-xs text-slate-400 font-sans">dB SPL</span>
            </div>
          </div>
        </div>

        {/* Clinical Environment Suitability Banner */}
        <AnimatePresence>
          {isActive ? (
            <motion.div 
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold border ${
                isTooLoud 
                  ? 'bg-rose-950/40 text-rose-300 border-rose-800/60' 
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              }`}
            >
              {isTooLoud ? (
                <>
                  <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  <span>{lang === 'ar' ? 'تحذير: الضجيج يتجاوز معايير الفحص السريري الدقيق' : 'Warning: Ambient noise exceeds clinical diagnostic standards'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span>{lang === 'ar' ? 'البيئة الصوتية ممتازة ومطابقة لمعايير الفحص' : 'Acoustic environment is optimal & compliant for testing'}</span>
                </>
              )}
            </motion.div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
              <Volume2 size={14} className="text-teal-400" />
              <span>{lang === 'ar' ? 'انقر تشغيل المايك لقياس الضجيج المحيط' : 'Click Start Monitor to measure ambient noise'}</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
