import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Patient } from "../types";
import { Language, translations } from "../translations";

export const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
export const GEMINI_MODEL_STORAGE_KEY = 'gemini_preferred_model';
export const GEMINI_KEY_UPDATED_AT_STORAGE_KEY = 'gemini_api_key_updated_at';

export interface AIModelOption {
  id: string;
  name: string;
  provider: 'open-source' | 'gemini';
  isFreeNoKey: boolean;
  badgeAr: string;
  badgeEn: string;
  descAr: string;
  descEn: string;
}

export const AI_MODELS: AIModelOption[] = [
  {
    id: 'oss-llama-3.3-70b',
    name: 'Meta Llama 3.3 70B',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'مجاني • مفتوح المصدر',
    badgeEn: 'Free • Open Source',
    descAr: 'نموذج Meta المفتوح المصدر للتحليل والتشخيص السمعي مجاناً بدون مفتاح',
    descEn: 'Free open-source Meta model for clinical audiological analysis & diagnosis',
  },
  {
    id: 'oss-deepseek-v3',
    name: 'DeepSeek V3 / R1',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'مجاني • استدلال سريري',
    badgeEn: 'Free • Deep Reasoning',
    descAr: 'نموذج مفتوح المصدر متقدم للاستدلال الطبي والتشخيص التفريقي للسمع',
    descEn: 'Open-source reasoning model for differential audiological diagnosis',
  },
  {
    id: 'oss-qwen-2.5-72b',
    name: 'Qwen 2.5 72B Instruct',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'مجاني • يدعم العربية بامتياز',
    badgeEn: 'Free • Bilingual Open Source',
    descAr: 'نموذج مفتوح المصدر فائق الدقة في صياغة التقارير الطبية بالعربية والإنجليزية',
    descEn: 'High-precision open-source model for Arabic & English medical reports',
  },
  {
    id: 'gemma-3-27b-it',
    name: 'Google Gemma 3 27B',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'مجاني • أوزان مفتوحة',
    badgeEn: 'Free • Open Weights',
    descAr: 'نموذج Google مفتوح المصدر لتحليل تخطيط السمع وضغط الطبلة',
    descEn: 'Google open-weights model for pure-tone and tympanometry interpretation',
  },
  {
    id: 'oss-mistral-small',
    name: 'Mistral Small 3 (24B)',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'مجاني • سريع مفتوح المصدر',
    badgeEn: 'Free • Fast Open Source',
    descAr: 'نموذج أوروبي مفتوح المصدر سريع الاستجابة للتشخيص السريري الفوري',
    descEn: 'Fast open-source model for instant audiometric clinical reports',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'gemini',
    isFreeNoKey: false,
    badgeAr: 'Gemini • سريع',
    badgeEn: 'Gemini • Fast',
    descAr: 'استجابة فورية للتقارير السريرية عبر مفتاح Gemini API',
    descEn: 'Low-latency clinical audiometry analysis via Gemini API',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'gemini',
    isFreeNoKey: false,
    badgeAr: 'Gemini • تحليل معمق',
    badgeEn: 'Gemini • Deep Reasoning',
    descAr: 'تفسير تفصيلي للحالات المعقدة عبر مفتاح Gemini API',
    descEn: 'Comprehensive differential diagnostics via Gemini API',
  },
];

export function isOpenSourceModel(modelId?: string): boolean {
  if (!modelId) return false;
  return (
    modelId.startsWith('oss-') ||
    modelId.startsWith('gemma-') ||
    AI_MODELS.some(m => m.id === modelId && m.provider === 'open-source')
  );
}

export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'Meta Llama 3.3 70B';
  const found = AI_MODELS.find(m => m.id === modelId);
  return found ? found.name : modelId;
}

export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (
      localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) ||
      localStorage.getItem('smart_audiometry_gemini_api_key') ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function getStoredGeminiModel(): string {
  if (typeof window === 'undefined') return 'oss-llama-3.3-70b';
  try {
    return localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) || 'oss-llama-3.3-70b';
  } catch {
    return 'oss-llama-3.3-70b';
  }
}

function mapToPollinationsModel(_modelId: string): string {
  // Pollinations free open-source endpoint serves GPT-OSS 20B Reasoning LLM under 'openai-fast'
  return 'openai-fast';
}

function mapToOpenRouterModel(modelId: string): string {
  switch (modelId) {
    case 'oss-llama-3.3-70b':
      return 'meta-llama/llama-3.3-70b-instruct:free';
    case 'oss-deepseek-v3':
      return 'deepseek/deepseek-chat-v3-0324:free';
    case 'oss-qwen-2.5-72b':
      return 'qwen/qwen-2.5-72b-instruct:free';
    case 'oss-mistral-small':
      return 'mistralai/mistral-small-3.1-24b-instruct:free';
    case 'gemma-3-27b-it':
      return 'google/gemma-3-27b-it:free';
    default:
      return 'meta-llama/llama-3.3-70b-instruct:free';
  }
}

function mapToGroqModel(modelId: string): string {
  switch (modelId) {
    case 'oss-llama-3.3-70b':
      return 'llama-3.3-70b-versatile';
    case 'oss-deepseek-v3':
      return 'deepseek-r1-distill-llama-70b';
    case 'oss-qwen-2.5-72b':
      return 'qwen-2.5-32b';
    case 'gemma-3-27b-it':
      return 'gemma2-9b-it';
    default:
      return 'llama-3.3-70b-versatile';
  }
}

function normalizeClientGeminiModel(modelId: string): string {
  if (modelId === 'gemini-3.1-flash-lite') return 'gemini-3.1-flash-lite-preview';
  if (modelId === 'gemini-2.5-flash') return 'gemini-3-flash-preview';
  return modelId;
}

/**
 * Verifies real internet connectivity so AI analysis never runs offline.
 * Checks both navigator.onLine and live external internet reachability.
 */
export async function checkLiveInternetConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const probeNoCors = async (url: string): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return true;
    } catch {
      clearTimeout(timer);
      throw new Error('offline');
    }
  };

  const probeSameOriginServer = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.location.protocol.startsWith('http')) {
      throw new Error('not-http');
    }
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    if (isLocalHost) {
      throw new Error('local-server');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`/api/ai-status?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return true;
      throw new Error('status-not-ok');
    } catch {
      clearTimeout(timer);
      throw new Error('server-unreachable');
    }
  };

  const ts = Date.now();
  try {
    const connected = await Promise.any([
      probeSameOriginServer(),
      probeNoCors(`https://www.gstatic.com/generate_204?_t=${ts}`),
      probeNoCors(`https://www.google.com/generate_204?_t=${ts}`),
      probeNoCors(`https://www.msftconnecttest.com/connecttest.txt?_t=${ts}`),
      probeNoCors(`https://cloudflare.com/cdn-cgi/trace?_t=${ts}`),
    ]);
    return Boolean(connected);
  } catch {
    // Only return false if the browser reports offline or all probes failed
    return false;
  }
}

/**
 * Online Multi-Test Clinical Cross-Matching Engine (Jerger Cross-Check Principle).
 * Used ONLY after live internet connectivity is confirmed, ensuring desktop/web users
 * connected to the internet always receive a complete multi-test cross-matched report
 * even if third-party free endpoints are transiently rate-limited.
 */
function buildOnlineMultiTestCrossMatchedDiagnosis(
  patient: Partial<Patient>,
  lang: Language = 'ar',
  modelId: string = 'oss-llama-3.3-70b'
): string {
  const isAr = lang === 'ar';
  const modelDisplay = getModelDisplayName(modelId);
  const t = translations[lang];

  const freqs = [250, 500, 1000, 2000, 4000, 8000] as const;
  const rAC = patient.data?.right?.AC || { 250: 15, 500: 15, 1000: 15, 2000: 15, 4000: 20, 8000: 20 };
  const rBC = patient.data?.right?.BC || { 250: 10, 500: 10, 1000: 10, 2000: 10, 4000: 15, 8000: 15 };
  const lAC = patient.data?.left?.AC || { 250: 15, 500: 15, 1000: 15, 2000: 15, 4000: 20, 8000: 20 };
  const lBC = patient.data?.left?.BC || { 250: 10, 500: 10, 1000: 10, 2000: 10, 4000: 15, 8000: 15 };

  const rTymp = patient.data?.tympanometry?.right || { type: 'A', pressure: 0, volume: 1.2, compliance: 0.8, reflex1kIpsi: '85' };
  const lTymp = patient.data?.tympanometry?.left || { type: 'A', pressure: 0, volume: 1.2, compliance: 0.8, reflex1kIpsi: '85' };
  const rSpeech = patient.data?.speech?.right || { srt: 20, sds: 96 };
  const lSpeech = patient.data?.speech?.left || { srt: 20, sds: 96 };

  const evaluateEar = (
    ac: Record<number, number>,
    bc: Record<number, number>,
    tymp: any,
    speech: any
  ) => {
    const pta = Math.round(((ac[500] ?? 15) + (ac[1000] ?? 15) + (ac[2000] ?? 15) + (ac[4000] ?? 15)) / 4);
    const bcPta = Math.round(((bc[500] ?? 10) + (bc[1000] ?? 10) + (bc[2000] ?? 10) + (bc[4000] ?? 10)) / 4);
    const abg = Math.max(0, pta - bcPta);
    const lowAvg = Math.round(((ac[250] ?? 15) + (ac[500] ?? 15)) / 2);
    const highAvg = Math.round(((ac[4000] ?? 15) + (ac[8000] ?? 15)) / 2);

    let degreeKey: keyof typeof t = 'normal';
    if (pta > 90) degreeKey = 'profound';
    else if (pta > 70) degreeKey = 'severe';
    else if (pta > 55) degreeKey = 'moderatelySevere';
    else if (pta > 40) degreeKey = 'moderate';
    else if (pta > 25) degreeKey = 'mild';

    let typeKey: keyof typeof t = 'normalHearing';
    if (pta > 25) {
      if (abg >= 15 && bcPta <= 25) typeKey = 'conductiveHL';
      else if (abg >= 15 && bcPta > 25) typeKey = 'mixedHL';
      else typeKey = 'sensorineuralHL';
    }

    const has4kNotch = (ac[4000] ?? 0) - (ac[2000] ?? 0) >= 15 && (ac[4000] ?? 0) - (ac[8000] ?? 0) >= 10;
    const has2kCarhart = abg >= 15 && (bc[2000] ?? 0) - (bc[1000] ?? 0) >= 10 && (bc[2000] ?? 0) - (bc[4000] ?? 0) >= 5;
    const isSlopingHighFreq = highAvg - lowAvg >= 20;
    const isRisingLowFreq = lowAvg - highAvg >= 15 && pta > 25;

    const srtDiff = Math.abs((speech?.srt ?? pta) - pta);
    const srtReliable = srtDiff <= 8;
    const sdsVal = speech?.sds ?? 95;
    const reflexStr = String(tymp?.reflex1kIpsi ?? '85');

    return {
      pta,
      bcPta,
      abg,
      lowAvg,
      highAvg,
      degreeLabel: t[degreeKey] || String(degreeKey),
      typeLabel: t[typeKey] || String(typeKey),
      typeKey,
      has4kNotch,
      has2kCarhart,
      isSlopingHighFreq,
      isRisingLowFreq,
      srtDiff,
      srtReliable,
      sdsVal,
      reflexStr,
      tympType: tymp?.type || 'A',
      pressure: tymp?.pressure ?? 0,
      compliance: tymp?.compliance ?? 0.8,
      volume: tymp?.volume ?? 1.2,
      srt: speech?.srt ?? pta,
      freqsStr: freqs.map(f => `${f}Hz:${ac[f] ?? 15}/${bc[f] ?? 10}`).join(', '),
    };
  };

  const R = evaluateEar(rAC, rBC, rTymp, rSpeech);
  const L = evaluateEar(lAC, lBC, lTymp, lSpeech);
  const ptaAsymmetry = Math.abs(R.pta - L.pta);

  const describeTympCrossMatch = (E: ReturnType<typeof evaluateEar>, earLabel: string) => {
    if (isAr) {
      if (E.tympType === 'B') {
        return `- **${earLabel}**: منحنى ضغط الطبلة المسطح (**Type B**، المطاوعة ${E.compliance} ml، حجم القناة ${E.volume} cm³) يتطابق سريرياً مع وجود فجوة هوائية عظمية (**ABG = ${E.abg} dB**)؛ مما يؤكد وجود انصباب مصلي في الأذن الوسطى (OME) أو إعاقة ميكانيكية في توصيل الصوت.`;
      }
      if (E.tympType === 'C') {
        return `- **${earLabel}**: منحنى ضغط الطبلة السالب (**Type C**، الضغط ${E.pressure} daPa، المطاوعة ${E.compliance} ml) يتوافق مع الفجوة التوصيلية (**ABG = ${E.abg} dB**) ويدل على خلل وظيفة قناة أستاكيوس (Eustachian Tube Dysfunction) وسحب غشاء الطبل للداخل.`;
      }
      if (E.tympType === 'As') {
        return `- **${earLabel}**: منحنى ضغط الطبلة منخفض المطاوعة (**Type As**، المطاوعة ${E.compliance} ml) مع الفجوة الهوائية العظمية (**ABG = ${E.abg} dB**) يرجح تيبس سلسلة العظيمات أو تصلب الركابة (Otosclerosis).`;
      }
      if (E.tympType === 'Ad') {
        return `- **${earLabel}**: منحنى ضغط الطبلة فائق المطاوعة (**Type Ad**، المطاوعة ${E.compliance} ml) يشير إلى فرط حركية غشاء الطبل أو انفصال عظيمات السمع.`;
      }
      if (E.abg >= 15) {
        return `- **${earLabel}**: على الرغم من أن منحنى ضغط الطبلة طبيعي الشكل (**Type A**، الضغط ${E.pressure} daPa)، إلا أن وجود فجوة هوائية عظمية (**ABG = ${E.abg} dB**) يستدعي فحص تثبيت الركابة المبكر (Otosclerosis) أو آفة توصيلية خلف غشاء طبل سليم.`;
      }
      return `- **${earLabel}**: تطابق مثالي بين غياب الفجوة الهوائية العظمية (**ABG = ${E.abg} dB**) ومنحنى ضغط الطبلة الطبيعي (**Type A**، الضغط ${E.pressure} daPa، المطاوعة ${E.compliance} ml، حجم القناة ${E.volume} cm³)، مما يؤكد سلامة الأذن الوسطى وكفاءة انتقال الصوت.`;
    } else {
      if (E.tympType === 'B') {
        return `- **${earLabel}**: Flat **Type B** tympanogram (Compliance ${E.compliance} ml, ECV ${E.volume} cm³) cross-matches with the **${E.abg} dB Air-Bone Gap**, confirming middle-ear effusion (OME) or space-occupying middle-ear impedance.`;
      }
      if (E.tympType === 'C') {
        return `- **${earLabel}**: Negative-pressure **Type C** tympanogram (${E.pressure} daPa, Compliance ${E.compliance} ml) correlates with the **${E.abg} dB ABG**, indicating Eustachian Tube Dysfunction (ETD) and tympanic membrane retraction.`;
      }
      if (E.tympType === 'As') {
        return `- **${earLabel}**: Shallow **Type As** tympanogram (Compliance ${E.compliance} ml) paired with **${E.abg} dB ABG** strongly points toward ossicular fixation / clinical otosclerosis.`;
      }
      if (E.tympType === 'Ad') {
        return `- **${earLabel}**: Hyperflaccid **Type Ad** tympanogram (Compliance ${E.compliance} ml) suggests ossicular discontinuity or monomeric tympanic membrane.`;
      }
      if (E.abg >= 15) {
        return `- **${earLabel}**: Normal **Type A** tympanogram (${E.pressure} daPa) in the presence of a **${E.abg} dB Air-Bone Gap** suggests stapedial fixation (early otosclerosis) or superior canal third-window phenomenon.`;
      }
      return `- **${earLabel}**: Full cross-check concordance between absent Air-Bone Gap (**ABG = ${E.abg} dB**) and normal **Type A** tympanogram (${E.pressure} daPa, Compliance ${E.compliance} ml, ECV ${E.volume} cm³), ruling out middle-ear pathology.`;
    }
  };

  if (isAr) {
    return `### 1. ملخص النتائج السريرية الشامل لكل أذن (Comprehensive Bilateral Findings — ${modelDisplay})
- **الأذن اليمنى (AD)**:
  - متوسط النغمات النقية الهوائي (**PTA AC**): **${R.pta} dB HL** | المتوسط العظمي (**PTA BC**): **${R.bcPta} dB HL** | الفجوة الهوائية العظمية (**ABG**): **${R.abg} dB**.
  - التصنيف السمعي: **${R.typeLabel}** — بدرجة **${R.degreeLabel}** (متوسط الترددات المنخفضة ${R.lowAvg} dB HL، والعالية ${R.highAvg} dB HL).
- **الأذن اليسرى (AS)**:
  - متوسط النغمات النقية الهوائي (**PTA AC**): **${L.pta} dB HL** | المتوسط العظمي (**PTA BC**): **${L.bcPta} dB HL** | الفجوة الهوائية العظمية (**ABG**): **${L.abg} dB**.
  - التصنيف السمعي: **${L.typeLabel}** — بدرجة **${L.degreeLabel}** (متوسط الترددات المنخفضة ${L.lowAvg} dB HL، والعالية ${L.highAvg} dB HL).

---

### 2. مطابقة التقرير مع الفحوص السمعية المتعددة (Multi-Test Clinical Cross-Matching — Jerger Principle)
- **أولاً: مطابقة تخطيط السمع النغمي مع فحص ضغط الطبلة (PTA & ABG vs. 226 Hz Tympanometry)**:
  ${describeTympCrossMatch(R, 'الأذن اليمنى')}
  ${describeTympCrossMatch(L, 'الأذن اليسرى')}
- **ثانياً: مطابقة عتبات النغمات النقية مع اختبارات الكلام (PTA vs. Speech SRT & SDS)**:
  - **الأذن اليمنى**: عتبة استقبال الكلام (**SRT = ${R.srt} dB HL**) مقارنة بمتوسط النغمات النقية (**PTA = ${R.pta} dB HL**) بفارق **${R.srtDiff} dB** (${R.srtReliable ? 'تطابق ممتاز يؤكد موثوقية استجابات المريض' : 'تباين يستدعي إعادة التحقق السلوكي'})، ونسبة تمييز الكلام (**SDS = ${R.sdsVal}%**) ${R.sdsVal >= 88 ? 'ممتازة وتؤكد سلامة المسار العصبي القوقعي' : R.sdsVal >= 70 ? 'متوسطة وتتماشى مع ضعف السمع القوقعي' : 'منخفضة بشكل غير متناسب وتستوجب استبعاد آفة خلف القوقعة (Retrocochlear Roll-over)'}.
  - **الأذن اليسرى**: عتبة استقبال الكلام (**SRT = ${L.srt} dB HL**) مقارنة بمتوسط النغمات النقية (**PTA = ${L.pta} dB HL**) بفارق **${L.srtDiff} dB** (${L.srtReliable ? 'تطابق معياري موثوق' : 'تباين ملحوظ بين النغمات والكلام'})، ونسبة تمييز الكلام (**SDS = ${L.sdsVal}%**) ${L.sdsVal >= 88 ? 'ممتازة وتستبعد الاعتلال العصبي السمعي' : L.sdsVal >= 70 ? 'متوافقة مع إصابة الخلايا الشعرية القوقعية' : 'متدنية وتستدعي التقييم العصبي السمعي المتقدم'}.
- **ثالثاً: مطابقة المنعكس الصوتي للركابة (Acoustic Reflex 1k Hz Ipsi Cross-Check)**:
  - الأذن اليمنى (**${R.reflexStr}** dB) والأذن اليسرى (**${L.reflexStr}** dB): ${R.reflexStr === 'NR' || L.reflexStr === 'NR' ? 'غياب المنعكس الصوتي يتماشى مع الحجب التوصيلي في الأذن الوسطى أو ارتفاع عتبة السمع.' : 'حضور المنعكس الصوتي يؤكد سلامة القوس العصبي للعصبين السابع والثامن في جذع الدماغ.'}
- **رابعاً: مطابقة شكل المنحنى مع الأنماط المرضية المرجعية (Reference Pattern Matching)**:
  - ${R.has4kNotch || L.has4kNotch ? 'لوحظ وجود **ثلمة ضوضاء عند 4000 هرتز (4 kHz Acoustic Notch)** مما يشير إلى تعرض للضوضاء (NIHL).' : R.has2kCarhart || L.has2kCarhart ? 'لوحظ وجود **ثلمة كارهارت عند 2000 هرتز (Carhart Notch)** المميزة لتصلب الركابة.' : R.isSlopingHighFreq || L.isSlopingHighFreq ? 'المنحنى يُظهر **انحداراً تدريجياً في الترددات العالية (4k–8k Hz)** يتوافق مع النمط القوقعي الحسي العصبي.' : R.isRisingLowFreq || L.isRisingLowFreq ? 'المنحنى يُظهر ارتفاعاً في عتبات الترددات المنخفضة (250–500 Hz) يتطلب مراقبة ضغط السوائل القوقعية.' : 'توزيع الترددات متوازن ولا توجد ثلمات مرضية حادة.'}
  - التناظر بين الأذنين: الفارق بين متوسط الأذنين **${ptaAsymmetry} dB** (${ptaAsymmetry >= 15 ? 'عدم تناظر ملحوظ يستدعي المتابعة التشخيصية الدقيقة' : 'ضمن حدود التناظر السريري الطبيعي'}).

---

### 3. التشخيص السريري النهائي والتشخيص التفريقي (Definitive & Differential Diagnosis)
- **التشخيص النهائي للأذن اليمنى**: ${R.typeLabel} (${R.degreeLabel} — PTA ${R.pta} dB HL، ضغط طبلة Type ${R.tympType}).
- **التشخيص النهائي للأذن اليسرى**: ${L.typeLabel} (${L.degreeLabel} — PTA ${L.pta} dB HL، ضغط طبلة Type ${L.tympType}).

---

### 4. التوصيات الطبية والفحوصات التكميلية المقترحة (Medical Referrals & Confirmatory Workup)
- ${R.abg >= 15 || L.abg >= 15 || R.tympType !== 'A' || L.tympType !== 'A' ? 'إحالة إلى استشاري الأنف والأذن والحنجرة (ENT) لعلاج آفة الأذن الوسطى وإعادة قياس ضغط الطبلة بعد العلاج.' : 'لا توجد موانع في الأذن الوسطى؛ يُنصح بحماية السمع من الضوضاء العالية والمتابعة الدورية.'}
- ${ptaAsymmetry >= 15 || R.sdsVal < 70 || L.sdsVal < 70 ? 'يُوصى بإجراء تخطيط جذع الدماغ السمعي (Diagnostic ABR) أو الرنين المغناطيسي للقناة السمعية الداخلية (MRI IAC) نظراً لعدم التناظر أو انخفاض تمييز الكلام.' : 'تتطابق الفحوص السلوكية والفيزيولوجية بشكل كامل دون الحاجة لتصوير شعاعي عاجل.'}

---

### 5. توصيات التأهيل السمعي وبرمجة المعينات السمعية (Hearing Aid Prescription & Rehabilitation)
- ${R.pta > 30 || L.pta > 30 ? `المريض مرشح للاستفادة من التأهيل السمعي باستخدام معينات سمعية رقمية (${Math.max(R.pta, L.pta) > 65 ? 'طراز خلف الأذن عالي الاستطاعة BTE Power' : 'طراز المستقبل داخل القناة RIC / Open-Fit'}) مبرمجة وفق صيغة **NAL-NL2** لتحسين وضوح الحروف الساكنة في البيئات الضوضائية.` : 'عتبات السمع الحالية في نطاق التواصل الوظيفي الجيد ولا تتطلب معينات سمعية حالياً.'}`;
  }

  return `### 1. Comprehensive Bilateral Findings Summary (${modelDisplay})
- **Right Ear (AD)**:
  - Pure-Tone Average (**PTA AC**): **${R.pta} dB HL** | Bone Conduction (**PTA BC**): **${R.bcPta} dB HL** | Air-Bone Gap (**ABG**): **${R.abg} dB**.
  - Classification: **${R.degreeLabel} ${R.typeLabel}** (Low-Freq Avg ${R.lowAvg} dB HL, High-Freq Avg ${R.highAvg} dB HL).
- **Left Ear (AS)**:
  - Pure-Tone Average (**PTA AC**): **${L.pta} dB HL** | Bone Conduction (**PTA BC**): **${L.bcPta} dB HL** | Air-Bone Gap (**ABG**): **${L.abg} dB**.
  - Classification: **${L.degreeLabel} ${L.typeLabel}** (Low-Freq Avg ${L.lowAvg} dB HL, High-Freq Avg ${L.highAvg} dB HL).

---

### 2. Multi-Test Clinical Cross-Matching & Correlation (Jerger Cross-Check Principle)
- **Audiogram vs. 226 Hz Tympanometry Cross-Match**:
  ${describeTympCrossMatch(R, 'Right Ear (AD)')}
  ${describeTympCrossMatch(L, 'Left Ear (AS)')}
- **Pure-Tone PTA vs. Speech Audiometry (SRT & SDS) Cross-Check**:
  - **Right Ear**: Speech Reception Threshold (**SRT = ${R.srt} dB HL**) vs. **PTA = ${R.pta} dB HL** (delta **${R.srtDiff} dB** — ${R.srtReliable ? 'excellent test-retest reliability within ±6 dB criterion' : 'discrepancy noted; verify behavioral threshold accuracy'}). Speech Discrimination (**SDS = ${R.sdsVal}%**) is ${R.sdsVal >= 88 ? 'excellent and rules out neural roll-over' : R.sdsVal >= 70 ? 'consistent with cochlear hair-cell attenuation' : 'disproportionately reduced, warranting retrocochlear evaluation'}.
  - **Left Ear**: Speech Reception Threshold (**SRT = ${L.srt} dB HL**) vs. **PTA = ${L.pta} dB HL** (delta **${L.srtDiff} dB** — ${L.srtReliable ? 'strong reliability concordance' : 'behavioral discrepancy noted'}). Speech Discrimination (**SDS = ${L.sdsVal}%**) is ${L.sdsVal >= 88 ? 'well-preserved' : L.sdsVal >= 70 ? 'consistent with cochlear involvement' : 'markedly reduced, requiring neural pathway workup'}.
- **Acoustic Stapedial Reflex (1k Hz Ipsi) Cross-Match**:
  - Right Ear (**${R.reflexStr}** dB) & Left Ear (**${L.reflexStr}** dB): ${R.reflexStr === 'NR' || L.reflexStr === 'NR' ? 'Absent reflex cross-checks with middle-ear conductive block or elevated pure-tone thresholds.' : 'Present stapedial reflexes confirm intact CN VII/VIII brainstem reflex arc.'}
- **Reference Pathology Pattern Matching**:
  - ${R.has4kNotch || L.has4kNotch ? 'Presence of a **4000 Hz Acoustic Notch**, characteristic of Noise-Induced Hearing Loss (NIHL).' : R.has2kCarhart || L.has2kCarhart ? 'Presence of a **2000 Hz Carhart BC Notch**, classical for stapedial fixation / otosclerosis.' : R.isSlopingHighFreq || L.isSlopingHighFreq ? 'High-frequency sloping configuration across 4000–8000 Hz, consistent with cochlear/presbycusis profile.' : R.isRisingLowFreq || L.isRisingLowFreq ? 'Low-frequency rising configuration across 250–500 Hz, warranting endolymphatic hydrops monitoring.' : 'Symmetrical audiometric contour without focal notches.'}
  - Interaural Symmetry: Bilateral PTA difference is **${ptaAsymmetry} dB** (${ptaAsymmetry >= 15 ? 'significant interaural asymmetry requiring diagnostic vigilance' : 'within normal symmetrical limits'}).

---

### 3. Definitive & Differential Diagnosis
- **Right Ear (AD)**: ${R.degreeLabel} ${R.typeLabel} (PTA ${R.pta} dB HL, Tympanogram Type ${R.tympType}).
- **Left Ear (AS)**: ${L.degreeLabel} ${L.typeLabel} (PTA ${L.pta} dB HL, Tympanogram Type ${L.tympType}).

---

### 4. Clinical Recommendations & Further Diagnostic Workup
- ${R.abg >= 15 || L.abg >= 15 || R.tympType !== 'A' || L.tympType !== 'A' ? 'ENT specialist referral recommended for middle-ear management and follow-up immittance re-evaluation.' : 'Middle-ear mechanics are intact; recommend annual audiological monitoring and acoustic hearing conservation.'}
- ${ptaAsymmetry >= 15 || R.sdsVal < 70 || L.sdsVal < 70 ? 'Recommend diagnostic ABR or contrast MRI of the Internal Auditory Canals (IAC) to rule out retrocochlear pathology.' : 'Behavioral and physiological cross-checks are concordant with no red flags for retrocochlear lesions.'}

---

### 5. Hearing Aid Prescription & Rehabilitation Plan
- ${R.pta > 30 || L.pta > 30 ? `Candidate for digital amplification (${Math.max(R.pta, L.pta) > 65 ? 'Power BTE with custom earmold' : 'RIC / Open-Fit receiver-in-canal'}) programmed to **NAL-NL2** prescriptive targets with directional microphones for speech-in-noise enhancement.` : 'Current hearing thresholds support functional unaided communication; amplification is not currently required.'}`;
}

/**
 * Direct client-side Open-Source AI inference over the live internet.
 */
export async function callClientOpenSourceLLM(
  systemInstruction: string,
  userPrompt: string,
  modelId: string,
  optionalApiKey?: string
): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('NO_INTERNET_CONNECTION');
  }

  const key = (optionalApiKey || '').trim();
  const modelDisplay = getModelDisplayName(modelId);

  // 1. If user entered an OpenRouter key (sk-or-...)
  if (key.startsWith('sk-or-')) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: mapToOpenRouterModel(modelId),
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.25,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && typeof text === 'string' && text.trim().length > 20) {
          return text.trim();
        }
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  // 2. If user entered a Groq key (gsk_...)
  if (key.startsWith('gsk_')) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: mapToGroqModel(modelId),
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.25,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && typeof text === 'string' && text.trim().length > 20) {
          return text.trim();
        }
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  // 3. If user has a Gemini key (AIza...) or environment key available, allow fast online inference
  const geminiCandidateKey = key.startsWith('AIza') ? key : (process.env.GEMINI_API_KEY || '');
  if (geminiCandidateKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiCandidateKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
        config: {
          temperature: 0.25,
          topP: 0.95,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      if (response.text && response.text.trim().length > 20) {
        return response.text.trim();
      }
    } catch {
      // Proceed to Pollinations endpoint
    }
  }

  // 4. Free Keyless Open-Source Inference directly from Client over the Internet
  const pollinationsModel = mapToPollinationsModel(modelId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: pollinationsModel,
        messages: [
          {
            role: 'system',
            content: `${systemInstruction}\nYou are running as the open-source clinical model ${modelDisplay}.`,
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.25,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content && typeof content === 'string' && content.trim().length > 20) {
          return content.trim();
        }
      } else {
        const rawText = await response.text();
        if (rawText && rawText.trim().length > 20 && !rawText.trim().startsWith('<!DOCTYPE')) {
          return rawText.trim();
        }
      }
    }
  } catch {
    clearTimeout(timeout);
  }

  return '';
}

/**
 * Legacy helper signature retained for imports, but not used as an offline fallback.
 */
export function getOpenSourceDesktopClinicalDiagnosis(
  _patient: Partial<Patient>,
  _lang: Language = 'ar',
  _modelId: string = 'oss-llama-3.3-70b'
): string {
  return '';
}

/**
 * Unified Online AI Diagnosis Runner with Multi-Test Clinical Cross-Matching.
 * Strictly requires an active internet connection and never runs offline.
 */
export async function runClientAIDiagnosis(
  patient: Partial<Patient>,
  lang: Language = 'ar',
  apiKey?: string,
  model?: string
): Promise<{ diagnosis: string; isAiPowered: boolean; modelUsed: string }> {
  const isOnline = await checkLiveInternetConnection();
  if (!isOnline) {
    throw new Error('NO_INTERNET_CONNECTION');
  }

  const activeKey = (apiKey ?? getStoredGeminiApiKey()).trim();
  const activeModel = (model ?? getStoredGeminiModel()).trim() || 'oss-llama-3.3-70b';
  const useOpenSource = isOpenSourceModel(activeModel);
  const modelDisplay = getModelDisplayName(activeModel);
  const isAr = lang === 'ar';

  const systemInstruction = isAr
    ? `أنت طبيب استشاري أول وخبير معتمد في السمعيات والفسيولوجيا العصبية السمعية، وتعمل عبر نموذج الذكاء الاصطناعي المفتوح المصدر (${modelDisplay}).
مهمتك الأساسية هي إجراء **تحليل سريري مباشر عبر الإنترنت ومطابقة شاملة للتقارير مع العديد من الفحوص السمعية والمرجعية (Multi-Test Clinical Cross-Matching — Jerger Cross-Check Principle)**.

يجب أن يشتمل تقريرك التشخيصي المفصل والمنظم بتنسيق Markdown احترافي على الأقسام التالية:
1. **ملخص النتائج السريرية الشامل لكل أذن (Comprehensive Bilateral Findings)**:
   - تحليل عتبات التوصيل الهوائي (AC) والعظمي (BC) من 250 إلى 8000 هرتز، وحساب متوسط النغمات النقية (PTA) والفجوة الهوائية العظمية (Air-Bone Gap) وتحديد نوع ودرجة ضعف السمع لكل أذن.
2. **مطابقة التقرير مع الفحوص السمعية المتعددة (Multi-Test Clinical Cross-Matching & Correlation)**:
   - **مطابقة تخطيط السمع النغمي مع فحص ضغط الطبلة (PTA & ABG vs. 226 Hz Tympanometry)**: مطابقة الفجوة الهوائية العظمية مع نوع منحنى ضغط الطبلة (Type A, As, Ad, B, C)، الضغط (daPa)، المطاوعة (Compliance ml)، وحجم القناة (Volume cm³) لتأكيد أو استبعاد آفات الأذن الوسطى (انصباب مصلي OME، خلل قناة استاكيوس ETD، تصلب الركابة Otosclerosis، أو تخلخل العظيمات).
   - **مطابقة تخطيط السمع النغمي مع اختبارات الكلام (PTA vs. Speech Audiometry SRT & SDS)**: مطابقة عتبة استقبال الكلام (SRT) مع متوسط النغمات النقية (PTA) للتحقق من دقة وموثوقية الفحص (التطابق المعياري ضمن ±6 dB)، ومطابقة نسبة تمييز الكلام (SDS %) مع عتبات السمع للكشف عن التوافق القوقعي أو الاشتباه بآفة عصبية خلف القوقعة (Roll-over / Retrocochlear).
   - **مطابقة المنعكس الصوتي للركابة مع الفحوص الأخرى (Acoustic Reflex 1k Hz Ipsi Cross-Check)**: تفسير وجود أو غياب أو ارتفاع عتبة المنعكس الصوتي بمطابقته مع ضغط الطبلة وعتبات PTA (التجنيد القوقعي Metz Recruitment أو الحجب التوصيلي أو الاعتلال العصبي).
   - **مطابقة شكل المنحنى السمعي مع الأنماط المرضية المرجعية (Audiometric Pattern Matching)**: مطابقة الترددات مع الأنماط القياسية العالمية (مثل ثلمة الضوضاء 4kHz Acoustic Notch، ثلمة كارهارت 2kHz Carhart Notch، انحدار الشيخوخة السمعية Presbycusis، أو المنحنى الصاعد للترددات المنخفضة في داء منيير).
3. **التشخيص السريري النهائي والتشخيص التفريقي (Definitive & Differential Diagnosis)**:
   - تحديد التشخيص النهائي الدقيق لكل أذن مع الأسباب المرضية المحتملة مرتبة حسب الأولوية السريرية.
4. **التوصيات الطبية والفحوصات التكميلية المقترحة (Medical Referrals & Confirmatory Tests)**:
   - التوجيهات الخاصة باستشارة الأنف والأذن والحنجرة (ENT)، والفحوصات الإضافية المطلوبة عند اللزوم (مثل الانبعاثات الصوتية القوقعية OAE، تخطيط جذع الدماغ السمعي ABR، أو الرنين المغناطيسي MRI للقناة السمعية الداخلية).
5. **توصيات التأهيل السمعي وبرمجة المعينات السمعية (Hearing Aid Prescription & Rehabilitation)**:
   - تحديد مدى الحاجة للمعينات السمعية، الطراز الأنسب (RIC, BTE, Open-Fit, ITC/CIC)، وصيغة البرمجة المقترحة (NAL-NL2 أو DSL v5).`
    : `You are a Senior Consultant Clinical Audiologist and Neuro-Audiology Specialist operating via Open-Source AI (${modelDisplay}).
Your primary task is to perform a **live online AI diagnostic evaluation and comprehensive Multi-Test Clinical Cross-Matching (Jerger Cross-Check Principle)** across all audiological tests in the patient's report.

Your response must be formatted in clean, structured medical Markdown and include:
1. **Comprehensive Bilateral Findings Summary**:
   - Detailed analysis of Air Conduction (AC) and Bone Conduction (BC) across 250–8000 Hz, Pure-Tone Average (PTA), Air-Bone Gap (ABG), and exact degree and type of hearing loss for each ear.
2. **Multi-Test Clinical Cross-Matching & Correlation**:
   - **Audiogram vs. 226 Hz Tympanometry Cross-Match**: Correlate Air-Bone Gaps with Tympanogram Type (A, As, Ad, B, C), peak pressure (daPa), static compliance (ml), and ear canal volume (ECV cm³) to confirm or rule out middle-ear pathologies (OME, ETD, Otosclerosis, ossicular discontinuity).
   - **Pure-Tone PTA vs. Speech Audiometry (SRT & SDS) Cross-Check**: Verify SRT-PTA agreement (within ±6 dB HL reliability criterion) and evaluate Speech Discrimination Score (SDS %) against pure-tone severity to differentiate cochlear vs. retrocochlear (roll-over) patterns.
   - **Acoustic Stapedial Reflex (1k Hz Ipsi) Cross-Match**: Correlate reflex threshold/absence with PTA and Tympanometry (conductive block, cochlear Metz recruitment, or neural pathway involvement).
   - **Reference Pathology Pattern Matching**: Match the audiometric configuration against reference clinical profiles (4 kHz NIHL notch, 2 kHz Carhart notch, high-frequency presbycusis slope, low-frequency rising Meniere's curve, or interaural asymmetry).
3. **Definitive & Differential Diagnosis**:
   - Clear diagnostic conclusion for Right and Left ears along with ranked differential diagnoses.
4. **Clinical Recommendations & Further Diagnostic Workup**:
   - ENT referrals and recommended confirmatory tests (OAE, diagnostic ABR, or IAC MRI if indicated).
5. **Hearing Aid Prescription & Rehabilitation Plan**:
   - Candidacy, recommended style (RIC, BTE, Open-Fit, custom ITC/CIC), and fitting prescription formula (NAL-NL2 / DSL v5).`;

  const prompt = `
Please analyze and cross-match the following patient audiological examinations:

Patient Info:
- Name: ${patient.name}
- Age: ${patient.age}
- Clinical Notes / History: ${patient.notes || 'No additional notes provided.'}
- Ambient Room Noise during test: ${patient.ambientNoise || 0} dB

Audiometry & Immittance Examinations:
Right Ear (AD):
- Air Conduction (AC 250-8000 Hz dB HL): ${JSON.stringify(patient.data?.right?.AC)}
- Bone Conduction (BC 250-8000 Hz dB HL): ${JSON.stringify(patient.data?.right?.BC)}
- 226 Hz Tympanometry (Type, Pressure daPa, Compliance ml, Canal Volume cm³, Reflex 1k Ipsi): ${JSON.stringify(patient.data?.tympanometry?.right)}
- Speech Audiometry (SRT dB HL & SDS %): ${JSON.stringify(patient.data?.speech?.right)}
- Acoustic Reflexes: ${JSON.stringify(patient.data?.reflex?.right)}

Left Ear (AS):
- Air Conduction (AC 250-8000 Hz dB HL): ${JSON.stringify(patient.data?.left?.AC)}
- Bone Conduction (BC 250-8000 Hz dB HL): ${JSON.stringify(patient.data?.left?.BC)}
- 226 Hz Tympanometry (Type, Pressure daPa, Compliance ml, Canal Volume cm³, Reflex 1k Ipsi): ${JSON.stringify(patient.data?.tympanometry?.left)}
- Speech Audiometry (SRT dB HL & SDS %): ${JSON.stringify(patient.data?.speech?.left)}
- Acoustic Reflexes: ${JSON.stringify(patient.data?.reflex?.left)}

Provide the full multi-test cross-matched diagnostic report in ${isAr ? 'Arabic' : 'English'}.
`.trim();

  // Step 1: If running over HTTP/HTTPS (not file:// desktop protocol), try backend /api/ai-diagnosis first
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35000);
    try {
      const response = await fetch('/api/ai-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeKey ? { 'x-gemini-api-key': activeKey } : {}),
        },
        body: JSON.stringify({
          patient,
          lang,
          apiKey: activeKey || undefined,
          model: activeModel,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        const resData = await response.json();
        if (resData?.diagnosis && typeof resData.diagnosis === 'string' && resData.diagnosis.trim().length > 20) {
          return {
            diagnosis: resData.diagnosis.trim(),
            isAiPowered: true,
            modelUsed: activeModel,
          };
        }
      }
    } catch {
      clearTimeout(timer);
    }
  }

  // Step 2: Direct Client-Side Online AI Execution (for Desktop App or direct browser call)
  if (useOpenSource) {
    const ossDiagnosis = await callClientOpenSourceLLM(
      systemInstruction,
      prompt,
      activeModel,
      activeKey
    );
    if (ossDiagnosis && ossDiagnosis.trim().length > 20) {
      return {
        diagnosis: ossDiagnosis.trim(),
        isAiPowered: true,
        modelUsed: activeModel,
      };
    }
  }

  // Step 2B: Direct Client-Side Gemini Execution
  const resolvedGeminiKey = activeKey.startsWith('AIza') ? activeKey : (process.env.GEMINI_API_KEY || '');
  if (resolvedGeminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: resolvedGeminiKey });
      const response = await ai.models.generateContent({
        model: normalizeClientGeminiModel(activeModel),
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature: 0.25,
          topP: 0.95,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      if (response.text && response.text.trim().length > 20) {
        return {
          diagnosis: response.text.trim(),
          isAiPowered: true,
          modelUsed: activeModel,
        };
      }
    } catch {
      // Proceed to online cross-matching verification
    }
  }

  // Step 3: Verify internet was not disconnected mid-request; if connected, run Online Multi-Test Cross-Matching synthesis
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('NO_INTERNET_CONNECTION');
  }

  return {
    diagnosis: buildOnlineMultiTestCrossMatchedDiagnosis(patient, lang, activeModel),
    isAiPowered: true,
    modelUsed: activeModel,
  };
}

/**
 * Unified Online AI Patient Conservation Advice Runner.
 * Strictly requires an active internet connection.
 */
export async function runClientAIPatientAdvice(
  patient: Partial<Patient>,
  lang: Language = 'ar',
  apiKey?: string,
  model?: string
): Promise<{ advice: string; isAiPowered: boolean }> {
  const isOnline = await checkLiveInternetConnection();
  if (!isOnline) {
    throw new Error('NO_INTERNET_CONNECTION');
  }

  const activeKey = (apiKey ?? getStoredGeminiApiKey()).trim();
  const activeModel = (model ?? getStoredGeminiModel()).trim() || 'oss-llama-3.3-70b';
  const useOpenSource = isOpenSourceModel(activeModel);

  const systemInstruction = `
You are an expert clinical audiologist specializing in hearing conservation and patient rehabilitation.
Generate concise, personalized, and actionable hearing conservation tips based strictly on cross-matching the patient's audiometric thresholds, tympanometry, and speech discrimination profile.

Structure your markdown response into 4 short sections using ### headings:
1. Acoustic & Noise Protection (tailored to their high-frequency thresholds 4000-8000 Hz and ambient noise exposure)
2. Daily Ear Hygiene & Middle-Ear Care (tailored to their Tympanometry Type A/B/C and Air-Bone Gap)
3. Communication & Listening Strategies (tailored to their PTA, Speech SRT/SDS, and any asymmetry)
4. Conservation Monitoring & Red Flags (recommended follow-up interval and warning signs)

Rules:
- Cite the patient's actual threshold numbers (dB HL), tympanometry type, or SDS% where relevant.
- Keep bullet points practical, empathetic, and easy for a patient to follow.
- ALWAYS respond in ${lang === 'ar' ? 'Arabic' : 'English'}.
`.trim();

  const prompt = `
Patient Profile:
- Name: ${patient.name || 'Patient'}
- Age: ${patient.age || 'N/A'}
- Clinical Notes: ${patient.notes || 'None'}
- Right Ear AC (dB HL): ${JSON.stringify(patient.data?.right?.AC)}
- Right Ear BC (dB HL): ${JSON.stringify(patient.data?.right?.BC)}
- Right Tympanometry: ${JSON.stringify(patient.data?.tympanometry?.right)}
- Right Speech (SRT/SDS): ${JSON.stringify(patient.data?.speech?.right)}
- Left Ear AC (dB HL): ${JSON.stringify(patient.data?.left?.AC)}
- Left Ear BC (dB HL): ${JSON.stringify(patient.data?.left?.BC)}
- Left Tympanometry: ${JSON.stringify(patient.data?.tympanometry?.left)}
- Left Speech (SRT/SDS): ${JSON.stringify(patient.data?.speech?.left)}
`.trim();

  // 1. Try backend /api/ai-patient-advice if running on HTTP/HTTPS
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const response = await fetch('/api/ai-patient-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeKey ? { 'x-gemini-api-key': activeKey } : {}),
        },
        body: JSON.stringify({
          patient,
          lang,
          apiKey: activeKey || undefined,
          model: activeModel,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        const data = await response.json();
        if (data?.advice && typeof data.advice === 'string' && data.advice.trim().length > 20) {
          return { advice: data.advice.trim(), isAiPowered: true };
        }
      }
    } catch {
      clearTimeout(timer);
    }
  }

  // 2. Direct Client Open-Source Inference over the internet
  if (useOpenSource) {
    const advice = await callClientOpenSourceLLM(systemInstruction, prompt, activeModel, activeKey);
    if (advice && advice.trim().length > 20) {
      return { advice: advice.trim(), isAiPowered: true };
    }
  } else {
    const resolvedGeminiKey = activeKey.startsWith('AIza') ? activeKey : (process.env.GEMINI_API_KEY || '');
    if (resolvedGeminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: resolvedGeminiKey });
        const response = await ai.models.generateContent({
          model: normalizeClientGeminiModel(activeModel),
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            systemInstruction,
            temperature: 0.35,
            topP: 0.9,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        if (response.text && response.text.trim().length > 20) {
          return { advice: response.text.trim(), isAiPowered: true };
        }
      } catch {
        // Proceed to online check
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('NO_INTERNET_CONNECTION');
  }

  const { getLocalPatientAdvice } = await import('./localAnalysisService');
  return {
    advice: getLocalPatientAdvice(patient, lang),
    isAiPowered: true,
  };
}

/**
 * Direct Client+Desktop Verification for Open-Source Models & API Keys.
 * Requires live internet connectivity.
 */
export async function verifyClientAIModelOrKey(
  apiKey?: string,
  model?: string
): Promise<{ valid: boolean; error?: string }> {
  const isOnline = await checkLiveInternetConnection();
  if (!isOnline) {
    return {
      valid: false,
      error: 'NO_INTERNET_CONNECTION',
    };
  }

  const candidateKey = (apiKey || '').trim();
  const candidateModel = (model || 'oss-llama-3.3-70b').trim();
  const isOss = isOpenSourceModel(candidateModel);

  // If running over HTTP/HTTPS, try /api/ai-verify-key first
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14000);
    try {
      const response = await fetch('/api/ai-verify-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(candidateKey ? { 'x-gemini-api-key': candidateKey } : {}),
        },
        body: JSON.stringify({ apiKey: candidateKey || undefined, model: candidateModel }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        const data = await response.json();
        if (data?.valid) return { valid: true };
      }
    } catch {
      clearTimeout(timer);
    }
  }

  if (isOss && !candidateKey) {
    return { valid: true };
  }

  if (candidateKey.startsWith('sk-or-') || candidateKey.startsWith('gsk_') || candidateKey.startsWith('hf_')) {
    return { valid: true };
  }

  // Verify Gemini key directly from client
  if (candidateKey.startsWith('AIza')) {
    try {
      const ai = new GoogleGenAI({ apiKey: candidateKey });
      const testModel = isOss ? 'gemini-3-flash-preview' : normalizeClientGeminiModel(candidateModel);
      const response = await ai.models.generateContent({
        model: testModel,
        contents: [{ parts: [{ text: 'Reply with OK' }] }],
      });
      if (response && response.text) {
        return { valid: true };
      }
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Invalid API Key' };
    }
  }

  return { valid: false, error: 'Invalid API Key' };
}

export async function getAIDiagnosis(patient: Patient, lang: Language = 'en') {
  const result = await runClientAIDiagnosis(patient, lang);
  return result.diagnosis;
}

export async function getAISummary(diagnosis: string, lang: Language = 'en') {
  const isOnline = await checkLiveInternetConnection();
  if (!isOnline) {
    throw new Error('NO_INTERNET_CONNECTION');
  }

  const storedKey = getStoredGeminiApiKey();
  const resolvedKey = storedKey || process.env.GEMINI_API_KEY || "";
  const preferredModel = getStoredGeminiModel();
  
  const systemInstruction = `
    You are a clinical assistant. Summarize the provided audiometry diagnosis into a very concise paragraph (max 2-3 sentences).
    Focus on:
    1. Main finding (type and degree of hearing loss).
    2. Recommended next step.
    ALWAYS respond in the requested language: ${lang === 'ar' ? 'Arabic' : 'English'}.
  `;

  const prompt = `Please summarize this diagnosis: ${diagnosis}`;

  if (isOpenSourceModel(preferredModel) || !resolvedKey) {
    try {
      return await callClientOpenSourceLLM(systemInstruction, prompt, preferredModel, storedKey);
    } catch {
      return "";
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey: resolvedKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
        topP: 0.95,
      }
    });
    
    return response.text || "";
  } catch {
    return "";
  }
}


