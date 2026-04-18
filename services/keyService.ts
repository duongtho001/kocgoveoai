
import { GoogleGenAI } from "@google/genai";

// ============================================================
// OpenRouter-based Text AI Client (Direct Fetch - no SDK)
// The @openrouter/sdk has strict Zod validation that rejects
// multimodal content parts. Using direct fetch instead.
// ============================================================

const OPENROUTER_API_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_TEXT_MODEL = 'google/gemini-2.5-flash';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Fallback: Google GenAI for image generation (OpenRouter doesn't support image gen)
const GOOGLE_IMAGE_API_KEY = ((import.meta as any).env?.VITE_GEMINI_API_KEY || '').trim();

/**
 * Map Google model names to OpenRouter equivalents
 */
const mapModelName = (googleModel: string): string => {
  const modelMap: Record<string, string> = {
    'gemini-3-flash-preview': OPENROUTER_TEXT_MODEL,
    'gemini-2.5-flash': OPENROUTER_TEXT_MODEL,
    'gemini-1.5-flash': 'google/gemini-2.5-flash',
    'gemini-1.5-flash-8b': 'google/gemini-2.5-flash',
  };
  return modelMap[googleModel] || OPENROUTER_TEXT_MODEL;
};

/**
 * Direct fetch to OpenRouter /chat/completions endpoint.
 * Converts Google GenAI format → OpenAI chat completion format.
 */
const createOpenRouterAdapter = (apiKey: string) => {
  return {
    models: {
      generateContent: async (params: any) => {
        const { model, contents, config } = params;

        // ============================================================
        // INTERCEPT: If imageConfig is present, redirect to Flow API T2I
        // This handles ALL services that used Gemini image generation
        // ============================================================
        if (config?.imageConfig) {
          const { generateImage } = await import('./flowApiService');
          // Extract text prompt from contents
          let prompt = '';
          const parts = contents?.parts || (Array.isArray(contents) ? contents[0]?.parts : []) || [];
          for (const part of parts) {
            if (part.text) prompt += part.text + ' ';
          }
          prompt = prompt.trim();
          if (!prompt) prompt = 'Photorealistic product photo, 9:16, cinematic lighting, 8k';
          
          const aspectRatio = config.imageConfig.aspectRatio || '9:16';
          console.log(`[Adapter] Intercepted imageConfig → Flow API T2I ${aspectRatio}`);
          const imageUrl = await generateImage(prompt, aspectRatio);
          
          // Fetch the image and convert to base64 to match Gemini response format
          let base64Data = '';
          try {
            const imgResponse = await fetch(imageUrl);
            const blob = await imgResponse.blob();
            base64Data = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result as string;
                resolve(dataUrl.split(',')[1] || '');
              };
              reader.readAsDataURL(blob);
            });
          } catch (fetchErr) {
            // If fetch fails (CORS), return URL directly — services will handle it
            console.warn('[Adapter] Could not fetch image for base64, returning URL directly');
            return {
              text: imageUrl,
              candidates: [{ content: { parts: [{ text: imageUrl }] } }]
            };
          }
          
          // Return in exact Gemini-compatible format with inlineData
          return {
            text: null,
            candidates: [{
              content: {
                parts: [{ 
                  inlineData: {
                    mimeType: 'image/png',
                    data: base64Data
                  }
                }]
              }
            }]
          };
        }

        // Build messages for OpenRouter (OpenAI) chat format  
        const messages: any[] = [];

        // Add system instruction if present
        if (config?.systemInstruction) {
          const sysText = typeof config.systemInstruction === 'string'
            ? config.systemInstruction
            : config.systemInstruction?.parts?.[0]?.text || JSON.stringify(config.systemInstruction);
          messages.push({
            role: 'system',
            content: sysText
          });
        }

        // Convert Google GenAI contents format to OpenAI messages
        if (Array.isArray(contents)) {
          // Multi-turn conversation: [{ role: 'user', parts: [...] }, ...]
          for (const msg of contents) {
            const role = msg.role === 'model' ? 'assistant' : (msg.role || 'user');
            const contentParts = convertParts(msg.parts || []);
            messages.push({
              role,
              content: contentParts.length === 1 && typeof contentParts[0] === 'string'
                ? contentParts[0]
                : contentParts
            });
          }
        } else if (contents?.parts) {
          // Single content: { parts: [{ text: '...' }, { inlineData: {...} }] }
          const contentParts = convertParts(contents.parts);
          messages.push({
            role: 'user',
            content: contentParts.length === 1 && typeof contentParts[0] === 'string'
              ? contentParts[0]
              : contentParts
          });
        }

        // Build response_format
        let response_format: any = undefined;
        if (config?.responseMimeType === 'application/json') {
          response_format = { type: 'json_object' };
        }

        const openRouterModel = mapModelName(model || OPENROUTER_TEXT_MODEL);

        // Direct fetch to OpenRouter API
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
            'X-Title': 'KOC Studio',
          },
          body: JSON.stringify({
            model: openRouterModel,
            messages,
            response_format,
            temperature: 0.7,
            max_tokens: 16384,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || '';

        // Return in GoogleGenAI-compatible format
        return {
          text,
          candidates: [{
            content: {
              parts: [{ text }]
            }
          }]
        };
      }
    }
  };
};

/**
 * Convert Google GenAI parts to OpenAI content parts
 */
function convertParts(parts: any[]): any[] {
  const result: any[] = [];
  for (const part of parts) {
    if (part.text) {
      result.push({ type: 'text', text: part.text });
    }
    if (part.inlineData) {
      result.push({
        type: 'image_url',
        image_url: {
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        }
      });
    }
  }
  // If only one text part, return as simple string
  if (result.length === 1 && result[0].type === 'text') {
    return [result[0].text];
  }
  return result;
}

// ============================================================
// Public API (same interface as before)
// ============================================================

export const callWithRetry = async (fn: () => Promise<any>, retries = 2, delay = 4000) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if ((e.message?.includes("429") || e.message?.includes("rate")) && i < retries) {
        console.warn(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
};

/**
 * Get AI client for text generation (uses OpenRouter) or image (uses Google GenAI)
 */
export const getAiClient = (type: 'text' | 'image' = 'text'): any => {
  if (type === 'image') {
    // Image generation: prefers Google GenAI, falls back to OpenRouter adapter
    if (!GOOGLE_IMAGE_API_KEY) {
      // No Gemini key — return OpenRouter adapter (vision/analysis works,
      // actual image gen will fail and services fallback to Flow API T2I)
      if (OPENROUTER_API_KEY) {
        return createOpenRouterAdapter(OPENROUTER_API_KEY);
      }
      throw new Error("Chưa cấu hình API Key. Vui lòng thêm VITE_GEMINI_API_KEY hoặc VITE_OPENROUTER_API_KEY vào .env");
    }
    return new GoogleGenAI({ apiKey: GOOGLE_IMAGE_API_KEY });
  }

  // Text generation: uses OpenRouter via direct fetch
  if (!OPENROUTER_API_KEY) {
    if (GOOGLE_IMAGE_API_KEY) {
      console.warn('[KeyService] No OpenRouter API key, falling back to Google GenAI');
      return new GoogleGenAI({ apiKey: GOOGLE_IMAGE_API_KEY });
    }
    throw new Error("Chưa cấu hình API Key. Vui lòng thêm VITE_OPENROUTER_API_KEY vào .env");
  }

  return createOpenRouterAdapter(OPENROUTER_API_KEY);
};

/**
 * Try text AI first, fallback to image AI if fails
 */
export const callWithAiFallback = async <T>(task: (ai: any) => Promise<T>): Promise<T> => {
  try {
    return await task(getAiClient('text'));
  } catch (error) {
    console.warn("[KeyService] Text AI failed, trying fallback...", error);
    try {
      if (GOOGLE_IMAGE_API_KEY) {
        return await task(new GoogleGenAI({ apiKey: GOOGLE_IMAGE_API_KEY }));
      }
      throw error;
    } catch (error2) {
      console.error("[KeyService] All AI providers failed:", error2);
      throw error2;
    }
  }
};

// Legacy exports (no longer needed but kept for compatibility)
export const getStoredKeys = (type: 'text' | 'image' = 'text'): string[] => [];
export const saveStoredKeys = (keysString: string, type: 'text' | 'image' = 'text') => {};
export const testApiKey = async (apiKey: string, type: 'text' | 'image'): Promise<{ success: boolean; error?: string }> => {
  return { success: true };
};
