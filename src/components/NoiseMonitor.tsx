import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, AlertTriangle, ShieldCheck, Volume2 } from 'lucide-react';
import { noiseDetector } from '../services/noiseDetectionService';

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
  onError,
  onNoiseLevelChange,
  level: externalLevel,
  peak: externalPeak,
  history: externalHistory,
  frequencies: externalFrequencies
}) => {
  const [internalLevel, setInternalLevel] = useState(0);
  const [internalPeak, setInternalPeak] = useState(0);
  const [internalFrequencies, setInternalFrequencies] = useState<number[]>(new Array(16).fill(0));
  const [internalHistory, setInternalHistory] = useState<number[]>(new Array(30).fill(0));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize with noiseDetector service when active
  useEffect(() => {
    if (!isActive) {
      setErrorMessage(null);
      return;
    }

    const unsubscribe = noiseDetector.subscribe(data => {
      setInternalLevel(data.level);
      setInternalPeak(data.peak);
      setInternalFrequencies(data.frequencies);
      setInternalHistory(data.history);
      if (onNoiseLevelChange) {
        onNoiseLevelChange(data.level);
      }
    });

    const unsubscribeError = noiseDetector.onError(errCode => {
      let friendlyError = '';
      if (errCode === 'PERMISSION_DENIED') {
        friendlyError = lang === 'ar' 
          ? 'تم رفض إذن الميكروفون. يرجى السماح بالوصول من إعدادات المتصفح.' 
          : 'Microphone permission denied. Please allow mic access in your browser settings.';
      } else if (errCode === 'NOT_SUPPORTED') {
        friendlyError = lang === 'ar'
          ? 'المتصفح لا يدعم الوصول لميكروفون الهاتف مباشرة.'
          : 'Browser does not support direct microphone audio capture.';
      } else if (errCode === 'NO_DEVICE') {
        friendlyError = lang === 'ar'
          ? 'لم يتم العثور على ميكروفون متصل.'
          : 'No microphone input device detected.';
      } else {
        friendlyError = lang === 'ar'
          ? 'حدث خطأ في تشغيل كاشف الضوضاء. يرجى النقر للبدء مجدداً.'
          : 'Could not access microphone. Tap to retry.';
      }
      setErrorMessage(friendlyError);
      if (onError) onError(friendlyError);
    });

    return () => {
      unsubscribe();
      unsubscribeError();
    };
  }, [isActive, lang, onNoiseLevelChange, onError]);

  const displayLevel = externalLevel !== undefined && externalLevel > 0 ? externalLevel : internalLevel;
  const displayPeak = externalPeak !== undefined && externalPeak > 0 ? externalPeak : internalPeak;
  const displayFreqs = externalFrequencies && externalFrequencies.some(f => f > 0) ? externalFrequencies : internalFrequencies;
  const displayHistory = externalHistory && externalHistory.some(h => h > 0) ? externalHistory : internalHistory;

  const isTooLoud = displayLevel > threshold;
  const isOptimal = displayLevel <= 20;

  const handleToggleClick = async () => {
    if (isActive) {
      noiseDetector.stop();
      onToggle(false);
    } else {
      setErrorMessage(null);
      const started = await noiseDetector.start();
      if (started) {
        onToggle(true);
      } else {
        onToggle(false);
      }
    }
  };

  return (
    <div className="bg-[#0b1329] text-white p-4 sm:p-6 rounded-2xl shadow-xl border border-slate-800 font-sans relative overflow-hidden group">
      {/* Precision ambient background glow */}
      <div 
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[90px] transition-colors duration-700 pointer-events-none ${
          isActive 
            ? (isTooLoud ? 'bg-rose-500/25' : isOptimal ? 'bg-emerald-500/25' : 'bg-amber-500/20') 
            : 'bg-teal-500/10'
        }`} 
      />
      
      <div className="relative z-10 space-y-4 sm:space-y-5">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${isActive ? (isTooLoud ? 'bg-rose-500 animate-ping' : 'bg-emerald-400') : 'bg-slate-600'}`} />
            <div className="min-w-0">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-300 block truncate">
                {lang === 'ar' ? 'مقياس ضجيج الغرفة العازلة' : 'Room Acoustics Calibrator'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:block">ANSI S3.1 / ISO 8253-1 Compliance</span>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleToggleClick}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0 active:scale-95 touch-manipulation ${
              isActive 
                ? 'bg-rose-600/25 text-rose-300 border border-rose-500/40 hover:bg-rose-600/35' 
                : 'bg-teal-600 text-white hover:bg-teal-500'
            }`}
          >
            {isActive ? <MicOff size={14} /> : <Mic size={14} />}
            <span>{isActive ? (lang === 'ar' ? 'إيقاف' : 'Stop') : (lang === 'ar' ? 'تشغيل المايك' : 'Start Monitor')}</span>
          </button>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-400 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Real-time Frequency Spectrum Analyzer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
            <span>125 Hz</span>
            <span>1000 Hz</span>
            <span>8000 Hz</span>
          </div>
          <div className="flex items-end justify-between gap-1 h-16 sm:h-20 p-2 sm:p-2.5 bg-black/40 rounded-xl border border-slate-800">
            {displayFreqs.map((f, i) => (
              <motion.div
                key={i}
                animate={{ height: `${isActive ? Math.max(6, f) : 6}%` }}
                transition={{ duration: 0.08 }}
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
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
            <span>{lang === 'ar' ? 'مخطط زمني مباشر' : 'Live Timeline History'}</span>
            <span>Limit: {threshold} dB SPL</span>
          </div>
          <div className="flex items-end gap-1 h-8 sm:h-9 px-2 bg-black/30 rounded-lg border border-slate-800/80">
            {displayHistory.map((h, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{ height: `${isActive ? Math.max(8, Math.min(100, (h / 70) * 100)) : 8}%` }}
                transition={{ duration: 0.1 }}
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
        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-slate-800">
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
              {lang === 'ar' ? 'المستوى الحالي' : 'Current Sound Level'}
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${
                isActive 
                  ? (isTooLoud ? 'text-rose-400' : isOptimal ? 'text-emerald-400' : 'text-teal-300') 
                  : 'text-slate-600'
              }`}>
                {isActive && displayLevel > 0 ? displayLevel.toString().padStart(2, '0') : '--'}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-400 font-sans">dB SPL</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
              {lang === 'ar' ? 'ذروة الضجيج' : 'Peak Recorded'}
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-300">
                {isActive && displayPeak > 0 ? displayPeak.toString().padStart(2, '0') : '--'}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-400 font-sans">dB SPL</span>
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
              className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl text-xs font-semibold border ${
                isTooLoud 
                  ? 'bg-rose-950/40 text-rose-300 border-rose-800/60' 
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              }`}
            >
              {isTooLoud ? (
                <>
                  <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  <span className="leading-tight">{lang === 'ar' ? 'تحذير: الضجيج يتجاوز معايير الفحص السريري الدقيق' : 'Warning: Ambient noise exceeds clinical diagnostic standards'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span className="leading-tight">{lang === 'ar' ? 'البيئة الصوتية ممتازة ومطابقة لمعايير الفحص' : 'Acoustic environment is optimal & compliant for testing'}</span>
                </>
              )}
            </motion.div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
              <Volume2 size={14} className="text-teal-400 shrink-0" />
              <span>{lang === 'ar' ? 'انقر تشغيل المايك لقياس الضجيج المحيط' : 'Click Start Monitor to measure ambient noise'}</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
