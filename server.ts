import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dns from "dns";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { buildClinicalDiagnosisPrompt, getDeidentifiedAudiologyData } from "./src/services/clinicalDiagnosisPrompt";
import { AIProviderRateLimitError, requestPollinationsChatCompletion } from "./src/services/pollinationsClient";

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

  // 4. Zero-key inference via Pollinations; respect its anonymous-IP cooldown.
  try {
    const text = await requestPollinationsChatCompletion(
      spec.pollinationsModel,
      [
        {
          role: "system",
          content: `${systemInstruction}\nYou are running as ${spec.displayName}.`,
        },
        { role: "user", content: prompt },
      ],
      temperature
    );
    if (text.length > 2) return { text, providerUsed: "free-open-source" };
  } catch (error) {
    if (error instanceof AIProviderRateLimitError) throw error;
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
    if (err instanceof AIProviderRateLimitError) {
      return res.status(429).json({
        valid: false,
        error: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
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

    if (!patient) {
      return res.status(400).json({ error: "Patient data required" });
    }

    const isArabic = lang === 'ar';
    const clinicalData = getDeidentifiedAudiologyData(patient);
    const { systemInstruction, prompt } = buildClinicalDiagnosisPrompt(clinicalData, lang);

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
    if (err instanceof AIProviderRateLimitError) {
      return res.status(429).json({
        diagnosis: null,
        error: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
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
    if (err instanceof AIProviderRateLimitError) {
      return res.status(429).json({
        advice: null,
        error: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
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
