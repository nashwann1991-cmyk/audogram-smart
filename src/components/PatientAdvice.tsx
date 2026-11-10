import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Shield, Sparkles, RefreshCw, Copy, Check, Printer, Ear } from 'lucide-react';
import { Patient } from '../types';
import { translations, Language } from '../translations';
import {
  extractPatientConservationFactors,
  getLocalPatientAdvice,
} from '../services/localAnalysisService';
import {
  getModelDisplayName,
  isOpenSourceModel,
  runClientAIPatientAdvice,
} from '../services/aiService';

interface PatientAdviceProps {
  patient: Partial<Patient>;
  lang: Language;
  apiKey?: string;
  model?: string;
  includeInPrint: boolean;
  onToggleIncludeInPrint: (include: boolean) => void;
  onUpdateAdvice: (advice: string, isAiGenerated: boolean) => void;
}

export const PatientAdvice: React.FC<PatientAdviceProps> = ({
  patient,
  lang,
  apiKey,
  model,
  includeInPrint,
  onToggleIncludeInPrint,
  onUpdateAdvice,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<'ai' | 'profile' | 'unknown'>(
    patient.patientAdviceSource === 'local'
      ? 'profile'
      : patient.patientAdviceSource ?? (patient.patientAdvice ? 'unknown' : 'profile')
  );

  const t = translations[lang];
  const isRTL = lang === 'ar';

  const profileSummary = useMemo(
    () => extractPatientConservationFactors(patient, lang),
    [patient, lang]
  );

  const activeAdviceText = useMemo(() => {
    if (patient.patientAdvice && patient.patientAdvice.trim().length > 0) {
      return patient.patientAdvice;
    }
    return getLocalPatientAdvice(patient, lang);
  }, [patient, lang]);

  const handleGenerateAdvice = async () => {
    setOfflineError(null);
    setIsGenerating(true);
    try {
      const result = await runClientAIPatientAdvice(
        patient,
        lang,
        apiKey || undefined,
        model || 'oss-llama-3.3-70b'
      );
      if (result.advice && result.advice.trim()) {
        setLastSource(result.isAiPowered ? 'ai' : 'profile');
        onUpdateAdvice(result.advice.trim(), result.isAiPowered);
      } else {
        setOfflineError(
          lang === 'ar'
            ? '⚠️ تعذر الاتصال بالإنترنت! يرجى الاتصال بالإنترنت لإجراء التحليل عبر الذكاء الاصطناعي.'
            : '⚠️ Please connect to the internet to run AI analysis.'
        );
      }
    } catch {
      setOfflineError(
        lang === 'ar'
          ? '⚠️ لا يوجد اتصال بالإنترنت! يرجى الاتصال بالإنترنت لإجراء التحليل عبر نماذج الذكاء الاصطناعي مفتوحة المصدر.'
          : '⚠️ No internet connection! Please connect to the internet to run live Open-Source AI analysis.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!activeAdviceText) return;
    try {
      await navigator.clipboard.writeText(activeAdviceText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
    }
  };

  return (
    <div
      className="w-[820px] max-w-full mx-auto bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs print:hidden transition-colors"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Shield size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                {t.patientAdviceTitle}
              </h3>
              <span className="text-[11px] font-mono text-teal-700 dark:text-teal-400">
                · {lastSource === 'ai'
                  ? (isRTL
                      ? `مُخصص بالذكاء الاصطناعي (${getModelDisplayName(model)}${isOpenSourceModel(model) ? ' • مفتوح المصدر' : ''})`
                      : `AI-Personalized (${getModelDisplayName(model)}${isOpenSourceModel(model) ? ' • Open Source' : ''})`)
                  : lastSource === 'unknown'
                    ? (isRTL ? 'نصائح محفوظة' : 'Saved guidance')
                    : (isRTL ? 'إرشادات محلية قائمة على القواعد' : 'Local rule-based guidance')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.patientAdviceSubtitle}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleIncludeInPrint(!includeInPrint)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              includeInPrint
                ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
            title={t.showOnPrintReport}
          >
            <Printer size={14} />
            <span>{t.showOnPrintReport}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? t.adviceCopied : t.copyAdvice}</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateAdvice}
            disabled={isGenerating}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>
              {isGenerating
                ? t.generatingAdvice
                : patient.patientAdvice
                ? t.regeneratePatientAdvice
                : t.generatePatientAdvice}
            </span>
          </button>
        </div>
      </div>

      {/* Unboxed Clinical Profile Metadata Line (Zero-Pill Discipline) */}
      {profileSummary.factors.length > 0 && (
        <div className="py-2.5 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
            <Ear size={13} className="text-teal-600 dark:text-teal-400" />
            {t.adviceTailoredTo}:
          </span>
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
            {profileSummary.factors.join(' · ')}
          </span>
        </div>
      )}

      {offlineError && (
        <div className="mt-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
          <span>{offlineError}</span>
        </div>
      )}

      {/* Markdown Conservation Tips Body */}
      <div className="mt-4 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/70 dark:border-slate-800">
        <div
          className={`prose prose-sm prose-slate dark:prose-invert max-w-none prose-headings:font-extrabold prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:mt-3 prose-headings:mb-1.5 first:prose-headings:mt-0 prose-p:leading-relaxed prose-li:my-1 prose-strong:text-teal-800 dark:prose-strong:text-teal-300 ${
            isRTL ? 'text-right' : 'text-left'
          }`}
        >
          <div className="markdown-body text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <ReactMarkdown>{activeAdviceText}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};
