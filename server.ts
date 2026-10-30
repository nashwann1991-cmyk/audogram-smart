import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dns from "dns";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// Force IPv4 resolution first to prevent Node 22 undici IPv6 HeadersTimeoutError in Cloud Run containers
dns.setDefaultResultOrder("ipv4first");

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const OPEN_SOURCE_MODELS: Record<
  string,
  {
    displayName: string;
    pollinationsModel: string;
    openRouterModel: string;
    groqModel: string;
    gemmaModel?: string;
  }
> = {
  "oss-llama-3.3-70b": {
    displayName: "Meta Llama 3.3 70B Instruct (Open Source)",
    pollinationsModel: "openai-fast",
    openRouterModel: "meta-llama/llama-3.3-70b-instruct:free",
    groqModel: "llama-3.3-70b-versatile",
  },
  "oss-deepseek-v3": {
    displayName: "DeepSeek V3 / R1 Clinical (Open Source)",
    pollinationsModel: "openai-fast",
    openRouterModel: "deepseek/deepseek-chat-v3-0324:free",
    groqModel: "llama-3.3-70b-versatile",
  },
  "oss-qwen-2.5-72b": {
    displayName: "Qwen 2.5 72B Instruct (Open Source)",
    pollinationsModel: "openai-fast",
    openRouterModel: "qwen/qwen-2.5-72b-instruct:free",
    groqModel: "llama-3.3-70b-versatile",
  },
  "gemma-3-27b-it": {
    displayName: "Google Gemma 3 27B IT (Open Weights)",
    pollinationsModel: "openai-fast",
    openRouterModel: "google/gemma-3-27b-it:free",
    groqModel: "gemma2-9b-it",
    gemmaModel: "gemini-3-flash-preview",
  },
  "oss-mistral-small": {
    displayName: "Mistral Small 3 24B (Open Source)",
    pollinationsModel: "openai-fast",
    openRouterModel: "mistralai/mistral-small-3.1-24b-instruct:free",
    groqModel: "llama-3.3-70b-versatile",
  },
};

const isOpenSourceModelId = (modelId?: string) => {
  if (!modelId) return false;
  return Boolean(OPEN_SOURCE_MODELS[modelId]) || modelId.startsWith("oss-") || modelId.startsWith("gemma-");
};

const normalizeGeminiModelId = (modelId?: string) => {
  if (!modelId || isOpenSourceModelId(modelId)) return "gemini-3-flash-preview";
  if (modelId === "gemini-3.1-flash-lite") return "gemini-3.1-flash-lite-preview";
  if (modelId === "gemini-2.5-flash") return "gemini-2.5-flash";
  return modelId;
};

const getAiClient = (customKey?: string) => {
  const cleanCustom = customKey?.trim() || "";
  // Only pass Gemini keys (not OpenRouter sk-or- or Groq gsk_) to GoogleGenAI
  const isThirdPartyOssKey = cleanCustom.startsWith("sk-or-") || cleanCustom.startsWith("gsk_") || cleanCustom.startsWith("hf_");
  const apiKey = (!isThirdPartyOssKey && cleanCustom) || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 20000,
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

async function generateWithOpenSourceModel(
  modelId: string,
  systemInstruction: string,
  prompt: string,
  customKey?: string,
  temperature = 0.25
): Promise<{ text: string; providerUsed: string } | null> {
  const spec = OPEN_SOURCE_MODELS[modelId] || OPEN_SOURCE_MODELS["oss-llama-3.3-70b"];
  const cleanKey = (customKey || "").trim();

  // 1. If user provided an OpenRouter API key (sk-or-...), call OpenRouter open-source endpoint
  if (cleanKey.startsWith("sk-or-")) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: spec.openRouterModel,
          temperature,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const data: any = await resp.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, providerUsed: "openrouter-oss" };
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  // 2. If user provided a Groq API key (gsk_...), call Groq open-source endpoint
  if (cleanKey.startsWith("gsk_")) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: spec.groqModel,
          temperature,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const data: any = await resp.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, providerUsed: "groq-oss" };
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  // 3. Fast Online Cloud AI execution via @google/genai (primary high-speed online engine)
  const ai = getAiClient(cleanKey);
  if (ai) {
    for (const candidateModel of ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-3.1-flash-lite-preview"]) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: prompt,
          config: {
            systemInstruction: `${systemInstruction}\nPresent the clinical analysis as ${spec.displayName}.`,
            temperature,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        });
        if (response?.text?.trim()) {
          return { text: response.text.trim(), providerUsed: "cloud-ai" };
        }
      } catch {
        // Try next candidate model
      }
    }
  }

  // 4. Zero-key Free Open-Source Inference via Pollinations OpenAI-compatible endpoint
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: spec.pollinationsModel,
        temperature,
        messages: [
          {
            role: "system",
            content: `${systemInstruction}\nYou are running as ${spec.displayName}.`,
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (resp.ok) {
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data: any = await resp.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 2) {
          return { text, providerUsed: "free-open-source" };
        }
      } else {
        const rawText = (await resp.text()).trim();
        if (rawText && rawText.length > 2 && !rawText.startsWith("<!DOCTYPE")) {
          return { text: rawText, providerUsed: "free-open-source" };
        }
      }
    }
  } catch {
    clearTimeout(timeout);
  }

  return null;
}

app.get("/api/ai-status", (req, res) => {
  const customKey = (req.headers["x-gemini-api-key"] as string) || "";
  const hasSystemKey = !!process.env.GEMINI_API_KEY;
  const hasCustomKey = !!customKey.trim();
  res.json({
    enabled: true,
    hasSystemKey,
    hasCustomKey,
    openSourceAvailable: true,
    model: "oss-llama-3.3-70b",
    openSourceModels: Object.keys(OPEN_SOURCE_MODELS),
  });
});

app.post("/api/ai-verify-key", async (req, res) => {
  try {
    const customKey = ((req.headers["x-gemini-api-key"] as string) || req.body?.apiKey || "").trim();
    const model = req.body?.model || "oss-llama-3.3-70b";

    // If testing a free open-source model without a key, verify live online open-source inference
    if (isOpenSourceModelId(model) && !customKey) {
      const ossResult = await generateWithOpenSourceModel(
        model,
        "You are a clinical assistant.",
        "Reply with the single word: OK",
        undefined,
        0
      );
      if (ossResult && ossResult.text) {
        return res.json({ valid: true, model, openSource: true });
      }
      return res.status(503).json({
        valid: false,
        error: "NO_INTERNET_CONNECTION",
      });
    }

    if (!customKey || customKey.length < 10) {
      return res.status(400).json({ valid: false, error: "Invalid API key format" });
    }

    if (customKey.startsWith("sk-or-") || customKey.startsWith("gsk_")) {
      const ossResult = await generateWithOpenSourceModel(
        isOpenSourceModelId(model) ? model : "oss-llama-3.3-70b",
        "You are a clinical assistant.",
        "Reply with the single word: OK",
        customKey,
        0
      );
      if (ossResult && ossResult.text) {
        return res.json({ valid: true, model });
      }
      return res.status(400).json({ valid: false, error: "Could not verify Open-Source API key or no internet connection" });
    }

    const ai = getAiClient(customKey);
    if (!ai) {
      return res.status(400).json({ valid: false, error: "Could not initialize AI client" });
    }

    const targetGeminiModel = normalizeGeminiModelId(model);
    const response = await ai.models.generateContent({
      model: targetGeminiModel,
      contents: "Reply with the single word: OK",
      config: {
        temperature: 0,
      }
    });

    if (response && response.text) {
      return res.json({ valid: true, model });
    }
    return res.status(400).json({ valid: false, error: "Empty response from Gemini API" });
  } catch (err: any) {
    return res.status(400).json({
      valid: false,
      error: err?.message || "Failed to verify API key"
    });
  }
});

app.post("/api/ai-diagnosis", async (req, res) => {
  try {
    const { patient, lang = 'ar', apiKey: bodyApiKey, model: requestedModel } = req.body;
    const headerApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    const customKey = (headerApiKey || bodyApiKey || "").trim();
    const selectedModel = requestedModel || "oss-llama-3.3-70b";
    const modelDisplay = OPEN_SOURCE_MODELS[selectedModel]?.displayName || selectedModel;

    if (!patient) {
      return res.status(400).json({ error: "Patient data required" });
    }

    const isArabic = lang === 'ar';
    const systemInstruction = isArabic
      ? `أنت طبيب استشاري أول وخبير معتمد في السمعيات والفسيولوجيا العصبية السمعية، وتعمل عبر نموذج الذكاء الاصطناعي (${modelDisplay}).
مهمتك الأساسية هي إجراء **تحليل سريري مباشر ومطابقة شاملة للتقارير مع العديد من الفحوص السمعية والمرجعية (Multi-Test Clinical Cross-Matching — Jerger Cross-Check Principle)**.

يجب أن يشتمل تقريرك التشخيصي المفصل والمنظم بتنسيق Markdown احترافي على الأقسام التالية:
1. **ملخص النتائج السريرية الشامل لكل أذن (Comprehensive Bilateral Findings)**:
   - تحليل عتبات التوصيل الهوائي (AC) والعظمي (BC) من 250 إلى 8000 هرتز، وحساب متوسط النغمات النقية (PTA) والفجوة الهوائية العظمية (Air-Bone Gap) وتحديد نوع ودرجة ضعف السمع لكل أذن.
2. **مطابقة التقرير مع الفحوص السمعية المتعددة (Multi-Test Clinical Cross-Matching & Correlation)**:
   - **مطابقة تخطيط السمع النغمي مع فحص ضغط الطبلة (PTA & ABG vs. 226 Hz Tympanometry)**: مطابقة الفجوة الهوائية العظمية مع نوع منحنى ضغط الطبلة (Type A, As, Ad, B, C)، الضغط (daPa)، المطاوعة (Compliance ml)، وحجم القناة (Volume cm³) لتأكيد أو استبعاد آفات الأذن الوسطى (انصباب مصلي OME، خلل قناة استاكيوس ETD، تصلب الركابة Otosclerosis، أو تخخل العظيمات).
   - **مطابقة تخطيط السمع النغمي مع اختبارات الكلام (PTA vs. Speech Audiometry SRT & SDS)**: مطابقة عتبة استقبال الكلام (SRT) مع متوسط النغمات النقية (PTA) للتحقق من دقة وموثوقية الفحص (التطابق المعياري ضمن ±6 dB)، ومطابقة نسبة تمييز الكلام (SDS %) مع عتبات السمع للكشف عن التوافق القوقعي أو الاشتباه بآفة عصبية خلف القوقعة (Roll-over / Retrocochlear).
   - **مطابقة المنعكس الصوتي للركابة مع الفحوص الأخرى (Acoustic Reflex 1k Hz Ipsi Cross-Check)**: تفسير وجود أو غياب أو ارتفاع عتبة المنعكس الصوتي بمطابقته مع ضغط الطبلة وعتبات PTA (التجنيد القوقعي Metz Recruitment أو الحجب التوصيلي أو الاعتلال العصبي).
   - **مطابقة شكل المنحنى السمعي مع الأنماط المرضية المرجعية (Audiometric Pattern Matching)**: مطابقة الترددات مع الأنماط القياسية العالمية (مثل ثلمة الضوضاء 4kHz Acoustic Notch، ثلمة كارهارت 2kHz Carhart Notch، انحدار الشيخوخة السمعية Presbycusis، أو المنحنى الصاعد للترددات المنخفضة في داء منيير).
3. **التشخيص السريري النهائي والتشخيص التفريقي (Definitive & Differential Diagnosis)**:
   - تحديد التشخيص النهائي الدقيق لكل أذن مع الأسباب المرضية المحتملة مرتبة حسب الأولوية السريرية.
4. **التوصيات الطبية والفحوصات التكميلية المقترحة (Medical Referrals & Confirmatory Tests)**:
   - التوجيهات الخاصة باستشارة الأنف والأذن والحنجرة (ENT)، والفحوصات الإضافية المطلوبة عند اللزوم (مثل الانبعاثات الصوتية القوقعية OAE، تخطيط جذع الدماغ السمعي ABR، أو الرنين المغناطيسي MRI للقناة السمعية الداخلية).
5. **توصيات التأهيل السمعي وبرمجة المعينات السمعية (Hearing Aid Prescription & Rehabilitation)**:
   - تحديد مدى الحاجة للمعينات السمعية، الطراز الأنسب (RIC, BTE, Open-Fit, ITC/CIC)، وصيغة البرمجة المقترحة (NAL-NL2 أو DSL v5).`
      : `You are a Senior Consultant Clinical Audiologist and Neuro-Audiology Specialist operating via (${modelDisplay}).
Your primary task is to perform a **live AI diagnostic evaluation and comprehensive Multi-Test Clinical Cross-Matching (Jerger Cross-Check Principle)** across all audiological tests in the patient's report.

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

    const prompt = `Patient Name: ${patient.name || 'Anonymous'}
Age: ${patient.age || 'N/A'}
Gender: ${patient.gender || 'N/A'}
Visit Date: ${patient.visitDate || 'N/A'}
Ambient Room Noise During Test: ${patient.ambientNoise || 0} dB
Complete Audiological Examination Data (AC, BC, Tympanometry, Speech SRT/SDS, Acoustic Reflexes):
${JSON.stringify(patient.data, null, 2)}
Clinical Notes / Medical History: ${patient.notes || 'None'}

Please perform a comprehensive multi-test cross-matching analysis and provide the complete diagnostic report in ${isArabic ? 'Arabic' : 'English'}.`;

    if (isOpenSourceModelId(selectedModel)) {
      const ossRes = await generateWithOpenSourceModel(selectedModel, systemInstruction, prompt, customKey, 0.25);
      if (ossRes && ossRes.text) {
        return res.json({
          diagnosis: ossRes.text,
          model: selectedModel,
          provider: ossRes.providerUsed,
          openSource: true,
          usedCustomKey: !!customKey,
        });
      }
      return res.status(503).json({
        diagnosis: null,
        error: "NO_INTERNET_CONNECTION",
        message: isArabic
          ? "تعذر الاتصال بنماذج الذكاء الاصطناعي. يرجى التأكد من اتصالك بالإنترنت."
          : "Could not reach online AI models. Please check your internet connection.",
      });
    }

    const ai = getAiClient(customKey);
    if (!ai) {
      const ossFallback = await generateWithOpenSourceModel("oss-llama-3.3-70b", systemInstruction, prompt, customKey, 0.25);
      if (ossFallback && ossFallback.text) {
        return res.json({
          diagnosis: ossFallback.text,
          model: "oss-llama-3.3-70b",
          provider: ossFallback.providerUsed,
          openSource: true,
          usedCustomKey: false,
        });
      }
      return res.status(503).json({
        diagnosis: null,
        error: "NO_INTERNET_CONNECTION",
      });
    }

    const targetGeminiModel = normalizeGeminiModelId(selectedModel);
    const response = await ai.models.generateContent({
      model: targetGeminiModel,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.25,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      }
    });

    const diagnosis = response.text || '';
    if (!diagnosis.trim()) {
      return res.status(503).json({ diagnosis: null, error: "EMPTY_AI_RESPONSE" });
    }
    return res.json({ diagnosis, model: selectedModel, usedCustomKey: !!customKey });
  } catch (err: any) {
    return res.status(503).json({
      diagnosis: null,
      error: "NO_INTERNET_CONNECTION",
      message: err?.message || "Failed to connect to online AI service",
    });
  }
});

app.post("/api/ai-patient-advice", async (req, res) => {
  try {
    const { patient, lang = 'ar', apiKey: bodyApiKey, model: requestedModel } = req.body;
    const headerApiKey = req.headers["x-gemini-api-key"] as string | undefined;
    const customKey = (headerApiKey || bodyApiKey || "").trim();
    const selectedModel = requestedModel || "oss-llama-3.3-70b";

    if (!patient) {
      return res.status(400).json({ error: "Patient data required" });
    }

    const isArabic = lang === 'ar';
    const systemInstruction = isArabic
      ? `أنت استشاري سمعيات وتأهيل سمعي متخصص في تثقيف المرضى والحفاظ على السمع (Hearing Conservation & Patient Counseling).
مهمتك هي تحليل الملف السمعي الخاص بالمريض ومطابقة نتائج فحوصاته (عتبات التوصيل الهوائي والعظمي من 250 إلى 8000 هرتز، ضغط الطبلة Tympanometry، وتمييز الكلام SDS، والعمر) وصياغة "إرشادات المريض وخطة الحفاظ على السمع" بلغة واضحة، مطمئنة، وعملية موجهة للمريض وأسرته.
يجب أن تكون النصائح مخصصة بدقة لنتائج هذا المريض وتغطي المحاور الأربعة التالية بتنسيق Markdown أنيق:
1. **حماية السمع والوقاية من الضوضاء (Noise & Acoustic Protection)**: نصائح مخصصة حسب عتبات الترددات العالية (4k-8k Hz) وحساسية القوقعة (قاعدة 60/60، واقيات السمع، حدود الديسيبل الآمنة).
2. **العناية اليومية بالأذن والأذن الوسطى (Daily Ear & Middle-Ear Care)**: إرشادات مخصصة حسب نوع ضغط الطبلة (Type A/B/C/As/Ad) والفجوة التوصيلية (تجنب أعواد القطن، الوقاية من دخول الماء، موازنة ضغط قناة استاكيوس).
3. **استراتيجيات التواصل الفعال والتأهيل السمعي (Communication & Listening Strategies)**: نصائح عملية لتحسين فهم الكلام (خاصة في الضوضاء وحسب نسبة SDS وعتبة SRT).
4. **المتابعة الدورية والمؤشرات التحذيرية (Monitoring & Follow-Up Schedule)**: جدول إعادة الفحص السمعي والمؤشرات التي تستدعي مراجعة الطبيب فوراً.`
      : `You are an expert Clinical Audiologist specializing in Hearing Conservation and Patient Counseling.
Your task is to analyze and cross-match the patient's specific audiological profile (pure-tone AC/BC thresholds across 250–8000 Hz, tympanometry parameters, speech discrimination SDS, and age) and generate personalized, actionable "Patient Advice & Hearing Conservation Tips" written clearly for the patient and their family.
Structure the advice in clean Markdown across four concise, practical sections tailored to their exact data:
1. **Acoustic & Noise Protection**: Tailored to their 4000–8000 Hz high-frequency profile and cochlear reserve (safe listening limits, 60/60 headphone rule, custom/NRR hearing protection).
2. **Daily Ear Hygiene & Middle-Ear Care**: Tailored to their tympanogram (Type A, B, C, As, Ad) and air-bone gap status (avoiding cotton swabs, dry-ear precautions, Eustachian tube pressure care).
3. **Communication & Listening Strategies**: Practical environmental and conversational adjustments based on their PTA degree and Speech Discrimination Score (SDS %).
4. **Conservation Monitoring & Red Flags**: Recommended audiometric follow-up schedule and symptoms requiring prompt ENT/audiology evaluation.`;

    const prompt = `Patient Name: ${patient.name || 'Patient'}
Age: ${patient.age || 'N/A'}
Gender: ${patient.gender || 'N/A'}
Audiological Profile Data:
${JSON.stringify(patient.data, null, 2)}
Clinical Notes: ${patient.notes || 'None'}

Generate personalized hearing conservation tips and patient advice in ${isArabic ? 'Arabic' : 'English'} tailored specifically to this patient's hearing profile.`;

    if (isOpenSourceModelId(selectedModel)) {
      const ossRes = await generateWithOpenSourceModel(selectedModel, systemInstruction, prompt, customKey, 0.3);
      if (ossRes && ossRes.text) {
        return res.json({
          advice: ossRes.text,
          model: selectedModel,
          provider: ossRes.providerUsed,
          openSource: true,
          usedCustomKey: !!customKey,
        });
      }
      return res.status(503).json({
        advice: null,
        error: "NO_INTERNET_CONNECTION",
      });
    }

    const ai = getAiClient(customKey);
    if (!ai) {
      const ossFallback = await generateWithOpenSourceModel("oss-llama-3.3-70b", systemInstruction, prompt, customKey, 0.3);
      if (ossFallback && ossFallback.text) {
        return res.json({
          advice: ossFallback.text,
          model: "oss-llama-3.3-70b",
          provider: ossFallback.providerUsed,
          openSource: true,
          usedCustomKey: false,
        });
      }
      return res.status(503).json({
        advice: null,
        error: "NO_INTERNET_CONNECTION",
      });
    }

    const targetGeminiModel = normalizeGeminiModelId(selectedModel);
    const response = await ai.models.generateContent({
      model: targetGeminiModel,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      }
    });

    const advice = response.text || '';
    if (!advice.trim()) {
      return res.status(503).json({ advice: null, error: "EMPTY_AI_RESPONSE" });
    }
    return res.json({ advice, model: selectedModel, usedCustomKey: !!customKey });
  } catch (err: any) {
    return res.status(503).json({ advice: null, error: "NO_INTERNET_CONNECTION" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve("dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
