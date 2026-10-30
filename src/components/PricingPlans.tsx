import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Star, Building2, Zap, Phone } from 'lucide-react';
import { translations } from '../translations';

interface PricingPlansProps {
  lang: 'en' | 'ar';
  currentPlan?: string;
  onUpgrade?: (plan: string) => void;
}

const PricingPlans: React.FC<PricingPlansProps> = ({ lang, currentPlan, onUpgrade }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar';
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const plans = [
    {
      id: 'trial',
      name: t.freePlan,
      price: '0$',
      desc: t.freePlanDesc,
      icon: <Zap className="text-blue-500" />,
      features: [
        t.freePlanDesc,
      ],
      color: 'blue',
    },
    {
      id: 'pro',
      name: t.proPlan,
      price: billingCycle === 'monthly' ? t.proPlanPriceMonthly : t.proPlanPriceYearly,
      desc: t.proPlanDesc,
      icon: <Star className="text-emerald-500" />,
      features: [
        t.planFeatureAudiometry,
        t.planFeatureAI,
        t.planFeaturePDF,
        t.planFeaturePatients,
        t.planFeatureHistory,
        t.planFeatureSettings,
      ],
      color: 'emerald',
      popular: true,
    },
  ];

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.pricingTitle}</h2>
        
        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-4">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-emerald-600' : 'text-slate-500'}`}>
            {t.monthly}
          </span>
          <button 
            onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
            className="w-12 h-6 bg-slate-200 dark:bg-slate-800 rounded-full relative p-1 transition-colors"
          >
            <motion.div 
              animate={{ x: billingCycle === 'yearly' ? (isRTL ? -24 : 24) : 0 }}
              className="w-4 h-4 bg-emerald-500 rounded-full shadow-sm"
            />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-emerald-600' : 'text-slate-500'}`}>
              {t.yearly}
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
              {t.save20}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -5 }}
            className={`relative p-6 rounded-3xl border-2 transition-all ${
              plan.popular 
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10 shadow-xl shadow-emerald-200/20' 
                : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                {lang === 'en' ? 'Most Popular' : 'الأكثر طلباً'}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className={`p-3 rounded-2xl bg-${plan.color}-100 dark:bg-${plan.color}-900/30`}>
                  {plan.icon}
                </div>
                {currentPlan === plan.id && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
                    {t.currentPlan}
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{plan.desc}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{plan.price}</span>
                <span className="text-slate-500 dark:text-slate-400 text-sm">
                  / {plan.id === 'trial' ? (lang === 'en' ? 'forever' : 'للأبد') : (billingCycle === 'monthly' ? t.perMonth : t.perYear)}
                </span>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <Check size={16} className="text-emerald-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => onUpgrade?.(plan.id)}
                className={`w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                  plan.id === 'trial'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-default'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none'
                }`}
              >
                {plan.id === 'trial' ? (
                  t.freePlan
                ) : (
                  <>
                    <Phone size={18} />
                    {t.upgrade}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PricingPlans;
