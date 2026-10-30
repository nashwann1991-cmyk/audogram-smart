import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X, CheckCircle2, Info, Plus, User, Activity, FileText, BrainCircuit } from 'lucide-react';
import { Language, translations } from '../translations';

interface TutorialProps {
  lang: Language;
  onClose: () => void;
  onStepChange?: (step: number) => void;
}

export const Tutorial: React.FC<TutorialProps> = ({ lang, onClose, onStepChange }) => {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const t = translations[lang];
  const isRTL = lang === 'ar';

  const steps = [
    {
      title: t.tutorialWelcome,
      description: t.tutorialWelcomeDesc,
      icon: <Info className="text-blue-500" size={32} />,
    },
    {
      title: t.tutorialNewAnalysis,
      description: t.tutorialNewAnalysisDesc,
      icon: <Plus className="text-indigo-500" size={32} />,
      target: 'nav-new-analysis'
    },
    {
      title: t.tutorialPatientInfo,
      description: t.tutorialPatientInfoDesc,
      icon: <User className="text-rose-500" size={32} />,
      target: 'patient-info-section'
    },
    {
      title: t.tutorialDataEntry,
      description: t.tutorialDataEntryDesc,
      icon: <Activity className="text-emerald-500" size={32} />,
      target: 'data-entry-section'
    },
    {
      title: t.tutorialSaveReport,
      description: t.tutorialSaveReportDesc,
      icon: <FileText className="text-blue-600" size={32} />,
      target: 'save-actions-section'
    },
    {
      title: t.tutorialAudiogram,
      description: t.tutorialAudiogramDesc,
      icon: <Activity className="text-indigo-600" size={32} />,
      target: 'audiogram-chart-section'
    },
    {
      title: t.tutorialAIInsight,
      description: t.tutorialAIInsightDesc,
      icon: <BrainCircuit className="text-purple-600" size={32} />,
      target: 'ai-insight-section'
    },
    {
      title: t.tutorialFinish,
      description: t.tutorialFinishDesc,
      icon: <CheckCircle2 className="text-green-500" size={32} />,
    }
  ];

  useEffect(() => {
    const updateTargetRect = () => {
      const targetId = steps[step].target;
      if (targetId) {
        const element = document.getElementById(targetId);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    // Small delay to allow view transitions to complete
    const timer = setTimeout(updateTargetRect, 300);
    window.addEventListener('resize', updateTargetRect);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
    };
  }, [step]);

  const handleNext = () => {
    if (step < steps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      onStepChange?.(nextStep);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      onStepChange?.(prevStep);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop with Spotlight */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]">
        {targetRect && (
          <motion.div 
            layoutId="spotlight"
            initial={false}
            animate={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            className="absolute bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] rounded-xl pointer-events-none border-2 border-blue-400/50"
          />
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <motion.div 
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
            // If we have a target, try to position the modal away from it
            ...(targetRect ? {
              x: targetRect.left + targetRect.width / 2 > window.innerWidth / 2 ? -200 : 200,
              y: targetRect.top + targetRect.height / 2 > window.innerHeight / 2 ? -150 : 150
            } : {})
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 pointer-events-auto"
        >
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                {steps[step].icon}
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {steps[step].title}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              {steps[step].description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div 
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === step ? 'w-4 bg-blue-600' : 'w-1 bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {step > 0 && (
                  <button 
                    onClick={handlePrev}
                    className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                  </button>
                )}
                <button 
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-none text-sm"
                >
                  {step === steps.length - 1 ? t.finish : t.next}
                  {step < steps.length - 1 && (isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
