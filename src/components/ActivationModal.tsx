import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  Check, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  MessageCircle, 
  X, 
  Zap, 
  Lock,
  ArrowRight,
  Gift
} from 'lucide-react';
import { 
  SubscriptionStatus, 
  SUBSCRIPTION_PLANS, 
  DEVELOPER_PHONE, 
  DEVELOPER_NAME, 
  WHATSAPP_LINK, 
  TRIAL_MAX_REPORTS,
  activateLicenseKey 
} from '../services/subscriptionService';

interface ActivationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  status: SubscriptionStatus;
  onActivationSuccess: () => void;
  lang?: 'ar' | 'en';
  canDismiss?: boolean;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({
  isOpen,
  onClose,
  status,
  onActivationSuccess,
  lang = 'ar',
  canDismiss = false,
}) => {
  const isAr = lang === 'ar';
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [selectedPlanTab, setSelectedPlanTab] = useState<'yearly' | 'monthly'>('yearly');

  if (!isOpen) return null;

  const handleCopyHwid = () => {
    navigator.clipboard.writeText(status.deviceId);
    setCopiedHwid(true);
    setTimeout(() => setCopiedHwid(false), 2500);
  };

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setFeedback({
        type: 'error',
        message: isAr ? '⚠️ يرجى إدخال كود التفعيل أولاً' : '⚠️ Please enter license key first',
      });
      return;
    }

    setIsVerifying(true);
    setFeedback({ type: 'idle', message: '' });

    try {
      const res = await activateLicenseKey(licenseKeyInput.trim());
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message,
        });
        setTimeout(() => {
          onActivationSuccess();
          if (onClose) onClose();
        }, 1200);
      } else {
        setFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: isAr ? 'تعذر الاتصال بخدمة التفعيل، يرجى المحاولة ثانية' : 'Could not reach activation server',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    isAr
      ? `السلام عليكم أستاذ نشوان، أود الاشتراك في نظام Smart Audiometry.\nمعرف جهازي هو:\n${status.deviceId}\nالباقة المطلوبة: ${selectedPlanTab === 'yearly' ? 'السنوية (100 دولار)' : 'الشهرية (15 دولار)'}`
      : `Hello Nashwan, I would like to subscribe to Smart Audiometry.\nMy Device ID: ${status.deviceId}\nSelected Plan: ${selectedPlanTab === 'yearly' ? 'Annual ($100)' : 'Monthly ($15)'}`
  );

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="relative w-full max-w-4xl bg-[#0f172a] text-slate-100 rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden my-auto"
      >
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Dismiss Button (if trial is still active) */}
        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-20 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        )}

        {/* Header Alert Ribbon (When trial has expired or warning) */}
        <div className={`p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap ${
          status.trialExpired 
            ? 'bg-rose-950/40 text-rose-300 border-rose-900/50' 
            : 'bg-teal-950/30 text-teal-300 border-teal-900/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              status.trialExpired ? 'bg-rose-600 text-white' : 'bg-teal-600 text-white'
            }`}>
              {status.trialExpired ? <Lock size={20} /> : <Gift size={20} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {status.trialExpired
                  ? (isAr ? '⚠️ انتهت الفترة المجانية للنظام' : '⚠️ Free Trial Period Has Expired')
                  : (isAr ? '✨ مرحباً بك في النسخة التجريبية المجانية' : '✨ Welcome to Free Trial Period')}
              </h2>
              <p className="text-xs text-slate-400">
                {status.trialExpired
                  ? (isAr 
                      ? 'لقد استهلكت الـ 3 تقارير المجانية. للاستمرار في الاستخدام يرجى تفعيل أحد الاشتراكات.'
                      : 'You have completed 3 free reports. Please activate a subscription to continue.')
                  : (isAr
                      ? `لديك ${TRIAL_MAX_REPORTS} تقارير مجانية (تم استخدام ${status.trialReportsUsed} من ${TRIAL_MAX_REPORTS})`
                      : `You have ${TRIAL_MAX_REPORTS} free reports (${status.trialReportsUsed} of ${TRIAL_MAX_REPORTS} used)`)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300">
              {isAr ? 'التقارير المستخدمة:' : 'Reports Used:'} <strong className="text-teal-400">{status.trialReportsUsed} / {TRIAL_MAX_REPORTS}</strong>
            </span>
          </div>
        </div>

        {/* Main Grid: Plans (Left/Right) & Activation Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-800">
          
          {/* Subscription Plans Section (Col 7) */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold border border-teal-500/20 mb-2">
                <Sparkles size={14} />
                <span>{isAr ? 'باقات الاشتراك الرسمية' : 'Official Pricing Packages'}</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                {isAr ? 'اختر باقة الاشتراك المناسبة لعيادتك' : 'Choose Your Clinic Subscription'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAr 
                  ? 'اشتراك شهري بـ 15$ أو سنوي بـ 100$ مع كافة مميزات الذكاء الاصطناعي وتقارير الـ PDF'
                  : 'Monthly at $15 or Annual at $100 with full AI analysis & medical PDF reports'}
              </p>
            </div>

            {/* Plans Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const isSelected = selectedPlanTab === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanTab(plan.id as any)}
                    className={`relative p-5 rounded-2xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-gradient-to-b from-teal-950/60 to-slate-900 border-teal-500 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-teal-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm">
                        {isAr ? 'الأكثر توفيراً ⭐' : 'Best Value ⭐'}
                      </span>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-sm text-white">{isAr ? plan.nameAr : plan.nameEn}</h4>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-teal-500 border-teal-500 text-slate-950' : 'border-slate-700'
                      }`}>
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black font-mono text-white">{plan.currency}{plan.price}</span>
                        <span className="text-xs text-slate-400">{isAr ? plan.periodAr : plan.periodEn}</span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-300">
                      {plan.featuresAr.slice(0, 4).map((f, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-teal-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Developer Contact Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950/40 to-slate-900 border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-teal-400 font-bold mb-1">
                  {isAr ? 'للاشتراك وتفعيل الحساب تواصل مع المطور:' : 'To subscribe & activate, contact the developer:'}
                </p>
                <p className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>{DEVELOPER_NAME}</span>
                  <span className="text-xs text-slate-400 font-normal">|</span>
                  <span className="font-mono text-teal-300 text-sm">{DEVELOPER_PHONE}</span>
                </p>
              </div>

              <a
                href={`${WHATSAPP_LINK}?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <MessageCircle size={16} />
                <span>{isAr ? 'تواصل عبر واتساب 💬' : 'Chat on WhatsApp'}</span>
              </a>
            </div>
          </div>

          {/* Activation Key Panel (Col 5) */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-slate-900/40 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2 text-teal-400">
                <Key size={18} />
                <h3 className="font-bold text-base text-white">{isAr ? 'تنشيط الترخيص' : 'Activate License'}</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isAr 
                  ? 'إذا وصلك كود التفعيل من المطور، أدخله هنا لتفعيل النظام فوراً وبدء العمل.' 
                  : 'Enter your license activation key provided by developer to unlock.'}
              </p>

              {/* Hardware / Device ID Box */}
              <div className="mt-4 p-3.5 rounded-xl bg-[#0b1329] border border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="font-semibold">{isAr ? 'المعرف الفريد لجهازك (Hardware ID):' : 'Your Unique Device ID:'}</span>
                  <button
                    onClick={handleCopyHwid}
                    className="flex items-center gap-1 text-teal-400 hover:text-teal-300 transition-colors"
                    title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                  >
                    {copiedHwid ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedHwid ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-teal-300 font-bold break-all bg-black/40 p-2 rounded-lg border border-slate-800/80">
                  {status.deviceId}
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleActivate} className="mt-5 space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    {isAr ? 'كود الترخيص (License Key):' : 'License Key:'}
                  </label>
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder={isAr ? 'أدخل كود التفعيل هنا (مثال: YEAR-XXXX-XXXX)' : 'Enter activation code...'}
                    className="w-full px-4 py-3 bg-[#0b1329] border border-slate-700 focus:border-teal-400 rounded-xl text-center font-mono text-sm uppercase tracking-wider outline-none text-white transition-all shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/20 active:scale-98 disabled:opacity-50"
                >
                  {isVerifying ? (
                    <span>{isAr ? 'جاري التحقق من السيرفر...' : 'Verifying...'}</span>
                  ) : (
                    <>
                      <span>{isAr ? 'تنشيط والبدء الآن 🚀' : 'Activate & Unlock 🚀'}</span>
                    </>
                  )}
                </button>
              </form>

              {/* Status Alert */}
              <AnimatePresence>
                {feedback.message && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                      feedback.type === 'success'
                        ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
                        : 'bg-rose-950/50 text-rose-300 border-rose-800'
                    }`}
                  >
                    {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{feedback.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Trial remaining footer banner if not expired */}
            {!status.trialExpired && (
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>{isAr ? `متبقي لك ${TRIAL_MAX_REPORTS - status.trialReportsUsed} تقارير مجانية` : `${TRIAL_MAX_REPORTS - status.trialReportsUsed} free reports left`}</span>
                {canDismiss && onClose && (
                  <button
                    onClick={onClose}
                    className="text-teal-400 hover:text-teal-300 font-bold underline"
                  >
                    {isAr ? 'متابعة الاستخدام المجاني ←' : 'Continue Free Trial →'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
