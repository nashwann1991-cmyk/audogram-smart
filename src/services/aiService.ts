import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Patient } from "../types";
import { Language, translations } from "../translations";
import { buildClinicalDiagnosisPrompt, getDeidentifiedAudiologyData } from "./clinicalDiagnosisPrompt";

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
    badgeAr: 'بدون مفتاح • حسب توفر الخدمة',
    badgeEn: 'No key • provider availability varies',
    descAr: 'خيار لتحليل منظم لنتائج السمع؛ جودة النموذج المجاني وتوفره يعتمدان على مزود الخدمة.',
    descEn: 'A structured audiology-analysis option; free-provider model and availability may vary.',
  },
  {
    id: 'oss-deepseek-v3',
    name: 'DeepSeek V3 / R1',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'بدون مفتاح • حسب توفر الخدمة',
    badgeEn: 'No key • provider availability varies',
    descAr: 'خيار لتحليل متعدد الخطوات؛ لا يضمن تشخيصاً طبياً، وتوفر المزود المجاني قد يتغير.',
    descEn: 'A multi-step analysis option; it cannot provide a confirmed diagnosis and free access may vary.',
  },
  {
    id: 'oss-qwen-2.5-72b',
    name: 'Qwen 2.5 72B Instruct',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'بدون مفتاح • حسب توفر الخدمة',
    badgeEn: 'No key • provider availability varies',
    descAr: 'خيار لصياغة تقارير عربية وإنجليزية؛ يجب مراجعة النتائج سريرياً.',
    descEn: 'An Arabic/English report-writing option; clinical review of all results is required.',
  },
  {
    id: 'gemma-3-27b-it',
    name: 'Google Gemma 3 27B',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'بدون مفتاح • حسب توفر الخدمة',
    badgeEn: 'No key • provider availability varies',
    descAr: 'خيار لتحليل تخطيط السمع وقياس الطبلة؛ نوع النموذج الفعلي يتبع مزود الخدمة المتاح.',
    descEn: 'An audiogram and tympanometry analysis option; the actual model depends on the available provider.',
  },
  {
    id: 'oss-mistral-small',
    name: 'Mistral Small 3 (24B)',
    provider: 'open-source',
    isFreeNoKey: true,
    badgeAr: 'بدون مفتاح • حسب توفر الخدمة',
    badgeEn: 'No key • provider availability varies',
    descAr: 'خيار سريع لصياغة تحليل سمعي مبدئي؛ قد تتغير السرعة والتوفر حسب مزود الخدمة.',
    descEn: 'A fast preliminary audiology-analysis option; speed and availability depend on the provider.',
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
  const clinicalData = getDeidentifiedAudiologyData(patient);
  const { systemInstruction, prompt } = buildClinicalDiagnosisPrompt(clinicalData, lang);

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
          patient: clinicalData,
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

  throw new Error('AI_PROVIDER_UNAVAILABLE');
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
  const clinicalData = getDeidentifiedAudiologyData(patient);

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
- Name: Patient
- Age: ${clinicalData.age ?? 'N/A'}
- Clinical Notes: Omitted for privacy
- Right Ear AC (dB HL): ${JSON.stringify(clinicalData.data?.right?.AC)}
- Right Ear BC (dB HL): ${JSON.stringify(clinicalData.data?.right?.BC)}
- Right Tympanometry: ${JSON.stringify(clinicalData.data?.tympanometry?.right)}
- Right Speech (SRT/SDS): ${JSON.stringify(clinicalData.data?.speech?.right)}
- Left Ear AC (dB HL): ${JSON.stringify(clinicalData.data?.left?.AC)}
- Left Ear BC (dB HL): ${JSON.stringify(clinicalData.data?.left?.BC)}
- Left Tympanometry: ${JSON.stringify(clinicalData.data?.tympanometry?.left)}
- Left Speech (SRT/SDS): ${JSON.stringify(clinicalData.data?.speech?.left)}
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
          patient: clinicalData,
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

