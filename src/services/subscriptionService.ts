/**
 * Subscription and License Activation Service
 * Supports:
 * 1. Free Trial: Up to 3 free reports/examinations
 * 2. Packages: Monthly ($15) & Yearly ($100)
 * 3. License Key Activation:
 *    - Validates and atomically redeems keys from Firestore's "activation_keys" collection
 *    - Persists successful activations in localStorage and IndexedDB
 */

import { localDB } from './localDB';
import { db } from '../firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

export interface SubscriptionStatus {
  isActivated: boolean;
  isTrial: boolean;
  trialReportsUsed: number;
  trialReportsLimit: number;
  trialExpired: boolean;
  plan: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  daysLeft?: number;
  expiresAt?: string | null;
  licenseKey?: string | null;
  deviceId: string;
}

const STORAGE_KEY_LICENSE = 'smart_audiometry_license_v2';
const STORAGE_KEY_DEVICE = 'smart_audiometry_device_hwid_v2';
const STORAGE_KEY_REPORT_COUNT = 'smart_audiometry_trial_reports_count';

export const DEVELOPER_PHONE = '00967776458925';
export const DEVELOPER_NAME = 'نشوان الشيباني';
export const WHATSAPP_LINK = 'https://wa.me/967776458925';
export const TRIAL_MAX_REPORTS = 3;

export const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    nameAr: 'الباقة الشهرية (Pro)',
    nameEn: 'Monthly Plan (Pro)',
    price: 15,
    currency: '$',
    periodAr: 'شهرياً',
    periodEn: 'per month',
    durationDays: 30,
    featuresAr: [
      'تقارير وفحوصات غير محدودة',
      'تخطيط السمع الكامل (AC / BC)',
      'فحص ضغط الطبلة والمنعكس الصوتي',
      'تحاليل وتشخيص الذكاء الاصطناعي الطبي',
      'تصدير تقارير PDF طبية فورية',
      'حفظ ومزامنة وتصدير واستيراد البيانات',
      'دعم فني مستمر وتحديثات'
    ],
    popular: false,
  },
  {
    id: 'yearly',
    nameAr: 'الباقة السنوية (Ultimate)',
    nameEn: 'Annual Plan (Ultimate)',
    price: 100,
    currency: '$',
    periodAr: 'سنوياً (وفر 80$)',
    periodEn: 'per year (Save $80)',
    durationDays: 365,
    featuresAr: [
      'كل مميزات الباقة الشهرية غير محدودة',
      'توفير ضخم (خصم أكثر من 45%)',
      'تخصيص شعار واسم العيادة والمستشفى في التقارير',
      'أولوية الدعم الفني المباشر مع المطور',
      'استخدام متزامن على الهاتف والكمبيوتر',
      'تحديثات النماذج مفتوحة المصدر مجاناً'
    ],
    popular: true,
  }
];

// Generate or retrieve persistent pseudo-hardware/device ID for browser/device
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY_DEVICE);
    if (!id) {
      const randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const timePart = Date.now().toString(36).toUpperCase().slice(-4);
      id = `AUDI-SYS-776458925-${timePart}-${randPart}`;
      localStorage.setItem(STORAGE_KEY_DEVICE, id);
    }
    return id;
  } catch {
    return 'AUDI-SYS-776458925-X';
  }
}

// Get number of completed reports in free trial
export function getTrialReportsCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORT_COUNT);
    const count = parseInt(raw || '0', 10);
    return isNaN(count) ? 0 : Math.max(0, count);
  } catch {
    return 0;
  }
}

// Increment free trial report usage
export async function incrementTrialReportUsage(): Promise<number> {
  const current = getTrialReportsCount();
  const next = current + 1;
  try {
    localStorage.setItem(STORAGE_KEY_REPORT_COUNT, next.toString());
    await localDB.setSetting('trialReportsCount', next);
  } catch {}
  return next;
}

// Read current subscription status
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const deviceId = getOrCreateDeviceId();
  let licenseData: any = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_LICENSE);
    if (raw) {
      licenseData = JSON.parse(raw);
    }
  } catch {}

  if (!licenseData) {
    try {
      const dbLic = await localDB.getSetting('appLicense');
      if (dbLic && typeof dbLic === 'object') {
        licenseData = dbLic;
      }
    } catch {}
  }

  // If activated
  if (licenseData && licenseData.isActivated) {
    if (licenseData.expiresAt) {
      const expDate = new Date(licenseData.expiresAt);
      const now = new Date();
      if (expDate < now) {
        // Expired
        return {
          isActivated: false,
          isTrial: false,
          trialReportsUsed: TRIAL_MAX_REPORTS,
          trialReportsLimit: TRIAL_MAX_REPORTS,
          trialExpired: true,
          plan: licenseData.plan || 'monthly',
          daysLeft: 0,
          expiresAt: licenseData.expiresAt,
          licenseKey: licenseData.key,
          deviceId,
        };
      } else {
        const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          isActivated: true,
          isTrial: false,
          trialReportsUsed: 0,
          trialReportsLimit: TRIAL_MAX_REPORTS,
          trialExpired: false,
          plan: licenseData.plan || 'monthly',
          daysLeft: diffDays,
          expiresAt: licenseData.expiresAt,
          licenseKey: licenseData.key,
          deviceId,
        };
      }
    } else {
      // Lifetime / permanent activation
      return {
        isActivated: true,
        isTrial: false,
        trialReportsUsed: 0,
        trialReportsLimit: TRIAL_MAX_REPORTS,
        trialExpired: false,
        plan: 'lifetime',
        daysLeft: 9999,
        expiresAt: null,
        licenseKey: licenseData.key,
        deviceId,
      };
    }
  }

  // In trial mode: Check reports count
  const reportsUsed = getTrialReportsCount();
  const trialExpired = reportsUsed >= TRIAL_MAX_REPORTS;

  return {
    isActivated: false,
    isTrial: !trialExpired,
    trialReportsUsed: reportsUsed,
    trialReportsLimit: TRIAL_MAX_REPORTS,
    trialExpired,
    plan: 'trial',
    daysLeft: undefined,
    expiresAt: null,
    licenseKey: null,
    deviceId,
  };
}

// Verify and activate license key
export async function activateLicenseKey(rawKey: string): Promise<{
  success: boolean;
  message: string;
  daysLeft?: number;
  expiresAt?: string;
  plan?: 'monthly' | 'yearly' | 'lifetime';
}> {
  const key = rawKey.trim();
  if (!key) return { success: false, message: '⚠️ يرجى إدخال كود التفعيل' };
  if (key.length > 128 || key.includes('/')) {
    return { success: false, message: '⚠️ صيغة كود التفعيل غير صحيحة' };
  }

  const deviceId = getOrCreateDeviceId();
  const activationTime = new Date();
  const candidateKeys = Array.from(new Set([key, key.toUpperCase(), key.toLowerCase()]));

  try {
    const result = await runTransaction(db, async (transaction) => {
      let keyRef = null;
      let keyData: Record<string, unknown> | null = null;

      for (const candidate of candidateKeys) {
        const candidateRef = doc(db, 'activation_keys', candidate);
        const snapshot = await transaction.get(candidateRef);
        if (snapshot.exists()) {
          keyRef = candidateRef;
          keyData = snapshot.data();
          break;
        }
      }

      if (!keyRef || !keyData) return { error: 'not-found' as const };

      if (
        keyData.active === false ||
        keyData.disabled === true ||
        keyData.status === 'disabled' ||
        keyData.status === 'inactive'
      ) {
        return { error: 'disabled' as const };
      }
      if (keyData.status === 'expired') return { error: 'expired' as const };

      const isUsed = keyData.isUsed === true;
      if (isUsed && keyData.deviceId !== deviceId) {
        return { error: 'used' as const };
      }

      const keyExpiry = toDate(keyData.expiresAt);
      if (keyExpiry && keyExpiry.getTime() <= activationTime.getTime()) {
        return { error: 'expired' as const };
      }

      const plan = getPlan(keyData, key);
      const activatedAt = isUsed
        ? toDate(keyData.activatedAt) ?? activationTime
        : activationTime;

      const expiresAt = plan === 'lifetime'
        ? null
        : new Date(activatedAt.getTime() + getPlanDays(keyData, plan) * 24 * 60 * 60 * 1000);

      if (expiresAt && expiresAt.getTime() <= activationTime.getTime()) {
        return { error: 'expired' as const };
      }

      if (!isUsed) {
        transaction.update(keyRef, {
          isUsed: true,
          deviceId,
          activatedAt: serverTimestamp(),
        });
      }

      return { plan, activatedAt, expiresAt };
    });

    if ('error' in result) {
      const messages = {
        'not-found': '❌ لم يتم العثور على مفتاح التفعيل في قاعدة البيانات. تأكد من صحة المفتاح.',
        disabled: '⛔ كود التفعيل معطل أو غير نشط في النظام',
        used: '🚫 كود التفعيل مستخدم على جهاز آخر مسبقاً',
        expired: '⛔ انتهت صلاحية كود التفعيل هذا',
      };
      return { success: false, message: messages[result.error] };
    }

    const expiresAt = result.expiresAt?.toISOString() ?? null;
    await saveLicenseLocally({
      isActivated: true,
      key,
      plan: result.plan,
      activatedAt: result.activatedAt.toISOString(),
      expiresAt,
      deviceId,
    });

    const daysLeft = result.expiresAt
      ? Math.ceil((result.expiresAt.getTime() - activationTime.getTime()) / (24 * 60 * 60 * 1000))
      : 9999;

    return {
      success: true,
      message: `🎉 تم التحقق وتنشيط النظام بنجاح! (${result.plan === 'yearly' ? 'باقة سنوية' : result.plan === 'monthly' ? 'باقة شهرية' : 'تفعيل دائم'})`,
      daysLeft,
      expiresAt: expiresAt ?? undefined,
      plan: result.plan,
    };
  } catch (error) {
    console.error('Activation key verification failed:', error);
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      return { success: false, message: 'تعذر التحقق من المفتاح بسبب صلاحيات قاعدة البيانات. يرجى مراجعة قواعد Firestore.' };
    }
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      return { success: false, message: 'تعذر الاتصال بقاعدة التفعيل. تحقق من الإنترنت ثم حاول مرة أخرى.' };
    }
    return { success: false, message: 'حدث خطأ أثناء التحقق من مفتاح التفعيل. حاول مرة أخرى.' };
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function'
      ? value.toDate()
      : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPlan(data: Record<string, unknown>, key: string): 'monthly' | 'yearly' | 'lifetime' {
  const value = typeof data.plan === 'string' ? data.plan.toLowerCase() : '';
  if (value.includes('life') || value.includes('perm') || value.includes('دائم') || value.includes('مدى')) {
    return 'lifetime';
  }
  if (value.includes('month') || value.includes('شهر')) return 'monthly';
  if (value.includes('year') || value.includes('annual') || value.includes('سنو') || value.includes('سنة')) {
    return 'yearly';
  }

  const duration = Number(data.days ?? data.durationDays ?? data.duration);
  if (Number.isFinite(duration) && duration > 3000) return 'lifetime';
  if (Number.isFinite(duration) && duration > 0) return duration < 300 ? 'monthly' : 'yearly';
  if (Number(data.years) > 0) return 'yearly';
  if (Number(data.months) > 0) return Number(data.months) >= 10 ? 'yearly' : 'monthly';

  const normalizedKey = key.toUpperCase();
  if (normalizedKey.startsWith('LIFETIME')) return 'lifetime';
  return normalizedKey.startsWith('MONTH') ? 'monthly' : 'yearly';
}

function getPlanDays(data: Record<string, unknown>, plan: 'monthly' | 'yearly' | 'lifetime'): number {
  if (plan === 'lifetime') return 9999;
  const duration = Number(data.days ?? data.durationDays ?? data.duration);
  if (Number.isFinite(duration) && duration > 0) return duration;
  const years = Number(data.years);
  if (Number.isFinite(years) && years > 0) return years * 365;
  const months = Number(data.months);
  if (Number.isFinite(months) && months > 0) return months * 30;
  return plan === 'monthly' ? 30 : 365;
}

async function saveLicenseLocally(lic: {
  isActivated: boolean;
  key: string;
  plan: 'monthly' | 'yearly' | 'lifetime';
  activatedAt: string;
  expiresAt: string | null;
  deviceId: string;
}) {
  localStorage.setItem(STORAGE_KEY_LICENSE, JSON.stringify(lic));
  await localDB.setSetting('appLicense', lic);
}

// Reset trial (for testing/admin if needed)
export async function resetTrialUsage() {
  try {
    localStorage.removeItem(STORAGE_KEY_REPORT_COUNT);
    await localDB.setSetting('trialReportsCount', 0);
  } catch {}
}
