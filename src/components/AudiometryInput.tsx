import React, { useState, useMemo } from 'react';
import { FREQUENCIES, AudiometryData, DEFAULT_THRESHOLDS, TympanometryData, SpeechAudiometryData } from '../types';
import { Language, translations } from '../translations';
import { 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  Waves, 
  Volume2, 
  Radio, 
  Plus, 
  Minus,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface Props {
  data: AudiometryData;
  onChange: (newData: AudiometryData) => void;
  lang: Language;
}

export const AudiometryInput: React.FC<Props> = ({ data, onChange, lang }) => {
  const t = translations[lang];
  const [showThresholds, setShowThresholds] = useState(false);
  const [activeTab, setActiveTab] = useState<'pta' | 'tymp' | 'speech' | 'reflex'>('pta');
  
  const thresholds = data.thresholds || DEFAULT_THRESHOLDS;

  // Calculate Pure Tone Average (PTA) at 500, 1000, 2000 Hz for both ears
  const rightPTA = useMemo(() => {
    const ac = data.right.AC;
    const pta = Math.round(((ac[500] ?? 0) + (ac[1000] ?? 0) + (ac[2000] ?? 0)) / 3);
    return isNaN(pta) ? 0 : pta;
  }, [data.right.AC]);

  const leftPTA = useMemo(() => {
    const ac = data.left.AC;
    const pta = Math.round(((ac[500] ?? 0) + (ac[1000] ?? 0) + (ac[2000] ?? 0)) / 3);
    return isNaN(pta) ? 0 : pta;
  }, [data.left.AC]);

  // Hearing classification helper
  const getHearingGrade = (pta: number) => {
    if (pta <= 20) return { label: lang === 'ar' ? 'سمع طبيعي' : 'Normal Hearing', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' };
    if (pta <= 40) return { label: lang === 'ar' ? 'فقدان خفيف' : 'Mild Loss', color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800' };
    if (pta <= 55) return { label: lang === 'ar' ? 'فقدان متوسط' : 'Moderate Loss', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' };
    if (pta <= 70) return { label: lang === 'ar' ? 'فقدان متوسط الشدة' : 'Mod. Severe Loss', color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800' };
    if (pta <= 90) return { label: lang === 'ar' ? 'فقدان شديد' : 'Severe Loss', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' };
    return { label: lang === 'ar' ? 'فقدان عميق' : 'Profound Loss', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' };
  };

  const rightGrade = getHearingGrade(rightPTA);
  const leftGrade = getHearingGrade(leftPTA);

  const handleValueChange = (ear: 'right' | 'left', type: 'AC' | 'BC', freq: number, value: string) => {
    let numValue = parseInt(value);
    if (isNaN(numValue)) numValue = 0;
    
    const currentThresholds = thresholds[ear][type];
    const clampedValue = Math.max(currentThresholds.min, Math.min(currentThresholds.max, numValue));
    
    const newData = { ...data };
    newData[ear][type][freq] = clampedValue;
    onChange(newData);
  };

  const handleStepValue = (ear: 'right' | 'left', type: 'AC' | 'BC', freq: number, delta: number) => {
    const currentVal = data[ear][type][freq] ?? 0;
    const currentThresholds = thresholds[ear][type];
    const newVal = Math.max(currentThresholds.min, Math.min(currentThresholds.max, currentVal + delta));
    const newData = { ...data };
    newData[ear][type][freq] = newVal;
    onChange(newData);
  };

  const handleThresholdChange = (ear: 'right' | 'left', type: 'AC' | 'BC', field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return;

    const newData = { ...data };
    if (!newData.thresholds) newData.thresholds = JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));
    
    newData.thresholds![ear][type][field] = numValue;
    
    const currentThresholds = newData.thresholds![ear][type];
    FREQUENCIES.forEach(f => {
      const val = newData[ear][type][f];
      newData[ear][type][f] = Math.max(currentThresholds.min, Math.min(currentThresholds.max, val));
    });

    onChange(newData);
  };

  const handleReflexChange = (ear: 'right' | 'left', type: 'ipsi' | 'contra', freq: number, value: string) => {
    const newData = { ...data };
    if (!newData.reflex) {
      newData.reflex = {
        right: { 
          ipsi: { 500: '', 1000: '', 2000: '', 4000: '' }, 
          contra: { 500: '', 1000: '', 2000: '', 4000: '' } 
        },
        left: { 
          ipsi: { 500: '', 1000: '', 2000: '', 4000: '' }, 
          contra: { 500: '', 1000: '', 2000: '', 4000: '' } 
        }
      };
    }
    (newData.reflex[ear][type] as any)[freq] = value;
    if (type === 'ipsi' && freq === 1000) {
      if (!newData.tympanometry) {
        newData.tympanometry = {
          right: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75, reflex1kIpsi: '85' },
          left: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75, reflex1kIpsi: '85' }
        };
      }
      newData.tympanometry[ear].reflex1kIpsi = value;
    }
    onChange(newData);
  };

  const handleTympanometryChange = (ear: 'right' | 'left', field: keyof TympanometryData, value: string) => {
    const newData = { ...data };
    if (!newData.tympanometry) {
      newData.tympanometry = {
        right: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75, reflex1kIpsi: '85' },
        left: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75, reflex1kIpsi: '85' }
      };
    }
    const val = (field === 'type' || field === 'reflex1kIpsi') ? value : parseFloat(value.toString()) || 0;
    (newData.tympanometry[ear] as any)[field] = val;

    if (field === 'reflex1kIpsi') {
      if (!newData.reflex) {
        newData.reflex = {
          right: { ipsi: { 500: '', 1000: '', 2000: '', 4000: '' }, contra: { 500: '', 1000: '', 2000: '', 4000: '' } },
          left: { ipsi: { 500: '', 1000: '', 2000: '', 4000: '' }, contra: { 500: '', 1000: '', 2000: '', 4000: '' } }
        };
      }
      (newData.reflex[ear].ipsi as any)[1000] = value;
    }

    onChange(newData);
  };

  const handleSpeechChange = (ear: 'right' | 'left', field: keyof SpeechAudiometryData, value: string) => {
    const newData = { ...data };
    if (!newData.speech) {
      newData.speech = {
        right: { srt: 0, sds: 0 },
        left: { srt: 0, sds: 0 }
      };
    }
    const val = parseFloat(value) || 0;
    (newData.speech[ear] as any)[field] = val;
    onChange(newData);
  };

  const renderThresholdEditor = () => (
    <div className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 mb-6 transition-all shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <Settings size={18} className="text-teal-600 dark:text-teal-400" />
          {t.thresholdSettings}
        </h3>
        <span className="text-xs text-slate-500">ISO 8253-1 / ANSI S3.6 standard range: -10 to 120 dB</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(['right', 'left'] as const).map(ear => (
          <div key={ear} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className={`font-bold text-sm flex items-center gap-2 ${ear === 'right' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${ear === 'right' ? 'bg-red-500' : 'bg-blue-500'}`} />
                {ear === 'right' ? t.rightEar : t.leftEar}
              </span>
              <span className="text-[11px] font-mono text-slate-400 uppercase">Limits</span>
            </div>
            {(['AC', 'BC'] as const).map(type => (
              <div key={type} className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">{type} {t.minDb}</label>
                  <input
                    type="number"
                    value={thresholds[ear][type].min}
                    onChange={(e) => handleThresholdChange(ear, type, 'min', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">{type} {t.maxDb}</label>
                  <input
                    type="number"
                    value={thresholds[ear][type].max}
                    onChange={(e) => handleThresholdChange(ear, type, 'max', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('pta')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'pta'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity size={16} />
            <span>{lang === 'ar' ? 'تخطيط السمع النغمي (AC / BC)' : 'Pure Tone Audiometry'}</span>
          </button>
          <button
            onClick={() => setActiveTab('tymp')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'tymp'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Waves size={16} />
            <span>{t.tympanometry}</span>
          </button>
          <button
            onClick={() => setActiveTab('speech')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'speech'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Volume2 size={16} />
            <span>{t.speechAudiometry}</span>
          </button>
          <button
            onClick={() => setActiveTab('reflex')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'reflex'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Radio size={16} />
            <span>{t.acousticReflex}</span>
          </button>
        </div>

        <button
          onClick={() => setShowThresholds(!showThresholds)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <Settings size={14} />
          <span>{t.thresholdSettings}</span>
          {showThresholds ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showThresholds && renderThresholdEditor()}

      {/* Pure Tone Audiometry Section */}
      {activeTab === 'pta' && (
        <div className="space-y-6">
          {/* Clinical Real-time PTA & Air-Bone Gap HUD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Right Ear Summary HUD */}
            <div className="bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  R
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{t.rightEar}</span>
                    <span className="text-xs text-red-600 dark:text-red-400 font-mono font-medium">(O / &lt;)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'المتوسط النغمي PTA' : 'Pure Tone Average'}: <span className="font-mono font-bold text-slate-900 dark:text-white">{rightPTA} dB HL</span>
                  </p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${rightGrade.color}`}>
                {rightGrade.label}
              </div>
            </div>

            {/* Left Ear Summary HUD */}
            <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  L
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{t.leftEar}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-mono font-medium">(X / &gt;)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'المتوسط النغمي PTA' : 'Pure Tone Average'}: <span className="font-mono font-bold text-slate-900 dark:text-white">{leftPTA} dB HL</span>
                  </p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${leftGrade.color}`}>
                {leftGrade.label}
              </div>
            </div>
          </div>

          {/* Air Conduction (AC) Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-teal-500" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {t.ac} - {lang === 'ar' ? 'التوصيل الهوائي' : 'Air Conduction'}
                  </h3>
                  <p className="text-xs text-slate-400">Standard test frequencies (125 Hz – 8000 Hz)</p>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                dB HL
              </span>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2.5 px-3 text-start font-bold uppercase tracking-wider text-[11px] text-slate-400 w-28">
                      {lang === 'ar' ? 'التردد (هرتز)' : 'Ear / Frequency'}
                    </th>
                    {FREQUENCIES.map(freq => (
                      <th key={freq} className="py-2.5 px-2 text-center font-mono font-semibold text-xs text-slate-700 dark:text-slate-300">
                        {freq}
                        <span className="block text-[9px] font-normal text-slate-400 uppercase">Hz</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {/* Right Ear AC Row */}
                  <tr className="hover:bg-red-50/20 dark:hover:bg-red-950/10 transition-colors">
                    <td className="py-3 px-3 font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                        <span>{t.rightEar} (O)</span>
                      </div>
                    </td>
                    {FREQUENCIES.map(freq => (
                      <td key={freq} className="py-3 px-1 text-center">
                        <div className="inline-flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-red-400 focus-within:border-red-400">
                          <button
                            type="button"
                            onClick={() => handleStepValue('right', 'AC', freq, -5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="-5 dB"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            value={data.right.AC[freq]}
                            onChange={(e) => handleValueChange('right', 'AC', freq, e.target.value)}
                            className="w-11 sm:w-12 text-center bg-transparent text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none"
                            min={thresholds.right.AC.min}
                            max={thresholds.right.AC.max}
                            step="5"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepValue('right', 'AC', freq, 5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="+5 dB"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Left Ear AC Row */}
                  <tr className="hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-colors">
                    <td className="py-3 px-3 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                        <span>{t.leftEar} (X)</span>
                      </div>
                    </td>
                    {FREQUENCIES.map(freq => (
                      <td key={freq} className="py-3 px-1 text-center">
                        <div className="inline-flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400">
                          <button
                            type="button"
                            onClick={() => handleStepValue('left', 'AC', freq, -5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="-5 dB"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            value={data.left.AC[freq]}
                            onChange={(e) => handleValueChange('left', 'AC', freq, e.target.value)}
                            className="w-11 sm:w-12 text-center bg-transparent text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none"
                            min={thresholds.left.AC.min}
                            max={thresholds.left.AC.max}
                            step="5"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepValue('left', 'AC', freq, 5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="+5 dB"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bone Conduction (BC) Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {t.bc} - {lang === 'ar' ? 'التوصيل العظمي' : 'Bone Conduction'}
                  </h3>
                  <p className="text-xs text-slate-400">Mastoid placement (250 Hz – 4000 Hz)</p>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                dB HL
              </span>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2.5 px-3 text-start font-bold uppercase tracking-wider text-[11px] text-slate-400 w-28">
                      {lang === 'ar' ? 'التردد (هرتز)' : 'Ear / Frequency'}
                    </th>
                    {FREQUENCIES.map(freq => (
                      <th key={freq} className="py-2.5 px-2 text-center font-mono font-semibold text-xs text-slate-700 dark:text-slate-300">
                        {freq}
                        <span className="block text-[9px] font-normal text-slate-400 uppercase">Hz</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {/* Right Ear BC Row */}
                  <tr className="hover:bg-red-50/20 dark:hover:bg-red-950/10 transition-colors">
                    <td className="py-3 px-3 font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                        <span>{t.rightEar} (&lt;)</span>
                      </div>
                    </td>
                    {FREQUENCIES.map(freq => (
                      <td key={freq} className="py-3 px-1 text-center">
                        <div className="inline-flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-red-400 focus-within:border-red-400">
                          <button
                            type="button"
                            onClick={() => handleStepValue('right', 'BC', freq, -5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="-5 dB"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            value={data.right.BC[freq]}
                            onChange={(e) => handleValueChange('right', 'BC', freq, e.target.value)}
                            className="w-11 sm:w-12 text-center bg-transparent text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none"
                            min={thresholds.right.BC.min}
                            max={thresholds.right.BC.max}
                            step="5"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepValue('right', 'BC', freq, 5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="+5 dB"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Left Ear BC Row */}
                  <tr className="hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-colors">
                    <td className="py-3 px-3 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                        <span>{t.leftEar} (&gt;)</span>
                      </div>
                    </td>
                    {FREQUENCIES.map(freq => (
                      <td key={freq} className="py-3 px-1 text-center">
                        <div className="inline-flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400">
                          <button
                            type="button"
                            onClick={() => handleStepValue('left', 'BC', freq, -5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="-5 dB"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            value={data.left.BC[freq]}
                            onChange={(e) => handleValueChange('left', 'BC', freq, e.target.value)}
                            className="w-11 sm:w-12 text-center bg-transparent text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none"
                            min={thresholds.left.BC.min}
                            max={thresholds.left.BC.max}
                            step="5"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepValue('left', 'BC', freq, 5)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="+5 dB"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tympanometry Section */}
      {activeTab === 'tymp' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.tympanometry}</h3>
                <p className="text-xs text-slate-400">Middle ear pressure, static acoustic admittance & canal volume (226 Hz)</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
              Jerger Classification: Types A, As, Ad, B, C
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(['right', 'left'] as const).map(ear => (
              <div 
                key={ear} 
                className={`p-5 rounded-2xl border ${
                  ear === 'right' 
                    ? 'border-red-200/80 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10' 
                    : 'border-blue-200/80 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10'
                }`}
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <h4 className={`font-bold text-sm flex items-center gap-2 ${ear === 'right' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${ear === 'right' ? 'bg-red-500' : 'bg-blue-500'}`} />
                    {ear === 'right' ? t.rightEar : t.leftEar}
                  </h4>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    Type {data.tympanometry?.[ear]?.type || 'A'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">{t.tympType}</label>
                    <select 
                      value={data.tympanometry?.[ear]?.type || 'A'} 
                      onChange={(e) => handleTympanometryChange(ear, 'type', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {['A', 'As', 'Ad', 'B', 'C'].map(type => (
                        <option key={type} value={type}>Type {type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">{t.pressure} (daPa)</label>
                    <input 
                      type="number" 
                      value={data.tympanometry?.[ear]?.pressure ?? 0}
                      onChange={(e) => handleTympanometryChange(ear, 'pressure', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">{t.volume} (ml)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={data.tympanometry?.[ear]?.volume ?? 0}
                      onChange={(e) => handleTympanometryChange(ear, 'volume', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">{t.compliance} (ml)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={data.tympanometry?.[ear]?.compliance ?? 0}
                      onChange={(e) => handleTympanometryChange(ear, 'compliance', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">{t.gradient} (daPa)</label>
                    <input 
                      type="number" 
                      value={data.tympanometry?.[ear]?.gradient ?? 0}
                      onChange={(e) => handleTympanometryChange(ear, 'gradient', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase flex items-center justify-between">
                      <span>{t.reflex1kIpsi || 'Reflex 1k (Ipsi)'}</span>
                      <span className="text-[9px] text-purple-600 dark:text-purple-400 font-mono font-bold">1 kHz</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 85, 95, NR"
                      value={data.tympanometry?.[ear]?.reflex1kIpsi ?? (data.reflex?.[ear]?.ipsi?.[1000] || '')}
                      onChange={(e) => handleTympanometryChange(ear, 'reflex1kIpsi', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speech Audiometry Section */}
      {activeTab === 'speech' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.speechAudiometry}</h3>
                <p className="text-xs text-slate-400">Speech Recognition Threshold (SRT) and Word Recognition / SDS Score</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">Standard Arabic / English Spondee & PB-50 Lists</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['right', 'left'] as const).map(ear => (
              <div 
                key={ear} 
                className={`p-5 rounded-2xl border ${
                  ear === 'right' 
                    ? 'border-red-200/80 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10' 
                    : 'border-blue-200/80 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10'
                }`}
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <h4 className={`font-bold text-sm flex items-center gap-2 ${ear === 'right' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${ear === 'right' ? 'bg-red-500' : 'bg-blue-500'}`} />
                    {ear === 'right' ? t.rightEar : t.leftEar}
                  </h4>
                  <span className="text-xs font-mono text-slate-500">
                    SDS: <strong className="text-slate-900 dark:text-white">{data.speech?.[ear]?.sds ?? 0}%</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor={`${ear}-srt`} className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      {t.srt} (dB HL)
                    </label>
                    <input 
                      id={`${ear}-srt`}
                      type="number" 
                      value={data.speech?.[ear]?.srt ?? 0}
                      onChange={(e) => handleSpeechChange(ear, 'srt', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                      min="0"
                      max="120"
                      step="5"
                    />
                    <span className="text-[10px] text-slate-400">Normal: 0 – 20 dB</span>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={`${ear}-sds`} className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      {t.sds} (%)
                    </label>
                    <input 
                      id={`${ear}-sds`}
                      type="number" 
                      value={data.speech?.[ear]?.sds ?? 0}
                      onChange={(e) => handleSpeechChange(ear, 'sds', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                      min="0"
                      max="100"
                      step="2"
                    />
                    <span className="text-[10px] text-slate-400">Excellent: 90 – 100%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acoustic Reflex Section */}
      {activeTab === 'reflex' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.acousticReflex}</h3>
                <p className="text-xs text-slate-400">Ipsilateral & Contralateral Acoustic Stapedial Reflex Thresholds (dB HL or NR)</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">NR = No Response</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(['right', 'left'] as const).map(ear => (
              <div 
                key={ear} 
                className={`p-5 rounded-2xl border overflow-x-auto ${
                  ear === 'right' 
                    ? 'border-red-200/80 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10' 
                    : 'border-blue-200/80 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10'
                }`}
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <h4 className={`font-bold text-sm flex items-center gap-2 ${ear === 'right' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${ear === 'right' ? 'bg-red-500' : 'bg-blue-500'}`} />
                    {ear === 'right' ? t.rightEar : t.leftEar}
                  </h4>
                  <span className="text-xs font-mono text-slate-400">Stapedial Reflex</span>
                </div>

                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200/60 dark:border-slate-800">
                      <th className="py-2 text-start font-semibold text-slate-500 w-24">Type</th>
                      {[500, 1000, 2000, 4000].map(f => (
                        <th key={f} className="py-2 text-center text-slate-600 dark:text-slate-300">
                          {f} Hz
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(['ipsi', 'contra'] as const).map(type => (
                      <tr key={type} className="hover:bg-white/40 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300">
                          {t[type]}
                        </td>
                        {[500, 1000, 2000, 4000].map(f => (
                          <td key={f} className="py-2.5 px-1 text-center">
                            <input 
                              type="text"
                              placeholder="85"
                              value={data.reflex?.[ear]?.[type]?.[f] || ''}
                              onChange={(e) => handleReflexChange(ear, type, f, e.target.value)}
                              className="w-16 px-2 py-1.5 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
