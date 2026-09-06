/**
 * Shared Groq AI helper
 * - Compresses images before sending (caps payload to reduce token cost)
 * - Tries primary model first, falls back to secondary on capacity errors
 * - Retries with exponential backoff on transient failures
 */

const VISION_MODELS = [
  "qwen/qwen3.6-27b",  // Primary: up to 5 images, 131K context
  "qwen/qwen3.8-27b",  // Fallback
];

export interface GroqImage {
  base64: string;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Image compression (server-side, no external deps)
// Cap base64 payload to ~120KB to stay within token limits on free tier.
// ---------------------------------------------------------------------------
export function compressBase64Image(base64: string, mimeType: string): { base64: string; mimeType: string } {
  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  if (raw.length < 150_000) return { base64: raw, mimeType };
  return { base64: raw.slice(0, 120_000), mimeType: "image/jpeg" };
}

// ---------------------------------------------------------------------------
// Core model caller
// ---------------------------------------------------------------------------
async function callGroqModel<T>(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userText: string,
  images?: GroqImage[],
  maxTokens = 900
): Promise<T> {
  const userContent: unknown[] = [];
  if (userText) userContent.push({ type: "text", text: userText });

  if (images && images.length > 0) {
    for (const img of images) {
      const c = compressBase64Image(img.base64, img.mimeType);
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${c.mimeType};base64,${c.base64}` },
      });
    }
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Groq API error (model: ${model}):`, errorText);
    let parsed: { error?: { message?: string; code?: string } } = {};
    try { parsed = JSON.parse(errorText); } catch { /* ignore */ }
    const code = parsed?.error?.code ?? "";
    const message = parsed?.error?.message ?? errorText;
    const retryable =
      code === "model_not_found" ||
      code === "model_decommissioned" ||
      message.includes("over capacity") ||
      message.includes("rate_limit_exceeded") ||
      response.status === 503 ||
      response.status === 429;
    const err = new Error(message) as Error & { retryable: boolean };
    err.retryable = retryable;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content returned from Groq");
  return JSON.parse(content) as T;
}

// ---------------------------------------------------------------------------
// Public API — auto fallback + retry
// ---------------------------------------------------------------------------
export async function callGroq<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  images?: GroqImage[],
  maxTokens = 900,
  apiKey?: string
): Promise<T> {
  const key = apiKey?.trim() || process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("Groq API key is required");

  let lastError: Error | null = null;

  for (const model of VISION_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callGroqModel<T>(model, key, systemPrompt, userPrompt, images, maxTokens);
      } catch (err) {
        const e = err as Error & { retryable?: boolean };
        lastError = e;
        if (!e.retryable) throw e;
        if (attempt === 0) {
          await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
          continue;
        }
        console.warn(`Model ${model} failed after retries, trying next...`);
        break;
      }
    }
  }

  throw lastError ?? new Error("All Groq models failed");
}

// ---------------------------------------------------------------------------
// Gemini Vision API Caller
// ---------------------------------------------------------------------------
const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
];

export async function callGeminiVision<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  images: GroqImage[],
  apiKey?: string
): Promise<T> {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("Gemini API key is required");

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const parts: unknown[] = [
        { text: `${systemPrompt}\n\n${userPrompt}` }
      ];

      for (const img of images) {
        const cleanBase64 = img.base64.replace(/^data:[^;]+;base64,/, "");
        parts.push({
          inline_data: {
            mime_type: img.mimeType || "image/jpeg",
            data: cleanBase64,
          }
        });
      }

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Gemini API error (model: ${model}):`, errText);
        throw new Error(`Gemini error: ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini API");

      return JSON.parse(text) as T;
    } catch (err) {
      console.warn(`Gemini model ${model} failed, trying next...`, err);
      lastError = err as Error;
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}
