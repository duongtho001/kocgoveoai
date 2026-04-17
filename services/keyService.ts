
import { GoogleGenAI } from "@google/genai";
import { OpenRouter } from "@openrouter/sdk";

// ============================================================
// OpenRouter-based Text AI Client
// Wraps OpenRouter SDK to match @google/genai interface
// so all existing services work without modification.
// ============================================================

const OPENROUTER_API_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_TEXT_MODEL = 'google/gemini-2.5-flash';

// Fallback: Google GenAI for image generation (OpenRouter doesn't support image gen)
const GOOGLE_IMAGE_API_KEY = ((import.meta as any).env?.VITE_GEMINI_API_KEY || '').trim();

/**
 * Creates an OpenRouter client wrapper that mimics the GoogleGenAI interface.
 * This allows all existing services to work without modification.
 */
const createOpenRouterAdapter = (apiKey: string) => {
  const openrouter = new OpenRouter({ apiKey });

  return {
    models: {
      generateContent: async (params: any) => {
        const { model, contents, config } = params;

        // Build messages for OpenRouter chat format
        const messages: any[] = [];

        // Add system instruction if present
        if (config?.systemInstruction) {
          messages.push({
            role: 'system',
            content: config.systemInstruction
          });
        }

        // Convert Google GenAI contents format to OpenRouter messages
        if (Array.isArray(contents)) {
          // Multi-turn conversation format
          for (const msg of contents) {
            const role = msg.role === 'model' ? 'assistant' : msg.role || 'user';
            const contentParts: any[] = [];

            for (const part of (msg.parts || [])) {
              if (part.text) {
                contentParts.push({ type: 'text', text: part.text });
              }
              if (part.inlineData) {
                contentParts.push({
                  type: 'image_url',
                  image_url: {
                    url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                  }
                });
              }
            }

            messages.push({ role, content: contentParts.length === 1 && contentParts[0].type === 'text' ? contentParts[0].text : contentParts });
          }
        } else if (contents?.parts) {
          // Single content format: { parts: [...] }
          const contentParts: any[] = [];
          for (const part of contents.parts) {
            if (part.text) {
              contentParts.push({ type: 'text', text: part.text });
            }
            if (part.inlineData) {
              contentParts.push({
                type: 'image_url',
                image_url: {
                  url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                }
              });
            }
          }
          messages.push({
            role: 'user',
            content: contentParts.length === 1 && contentParts[0].type === 'text' ? contentParts[0].text : contentParts
          });
        }

        // Build response_format for structured output
        let responseFormat: any = undefined;
        if (config?.responseMimeType === 'application/json') {
          responseFormat = { type: 'json_object' };
        }

        // Use the configured model, mapping Google model names to OpenRouter equivalents
        const openRouterModel = mapModelName(model || OPENROUTER_TEXT_MODEL);

        const response = await openrouter.chat.send({
          chatRequest: {
            model: openRouterModel,
            messages,
            responseFormat: responseFormat,
            temperature: 0.7,
            maxTokens: 8192,
          }
        });

        const text = (response as any)?.choices?.[0]?.message?.content || '';

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
 * Map Google model names to OpenRouter equivalents
 */
const mapModelName = (googleModel: string): string => {
  const modelMap: Record<string, string> = {
    'gemini-3-flash-preview': OPENROUTER_TEXT_MODEL,
    'gemini-2.5-flash': OPENROUTER_TEXT_MODEL,
    'gemini-1.5-flash': 'google/gemini-2.5-flash',
    'gemini-1.5-flash-8b': 'google/gemini-2.5-flash',
    'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image-preview', // Keep as-is for image gen
  };
  return modelMap[googleModel] || OPENROUTER_TEXT_MODEL;
};

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
 * Get AI client for text generation (uses OpenRouter)
 */
export const getAiClient = (type: 'text' | 'image' = 'text'): any => {
  if (type === 'image') {
    // Image generation: still uses Google GenAI (OpenRouter doesn't support image gen)
    if (!GOOGLE_IMAGE_API_KEY) {
      console.warn('[KeyService] No VITE_GEMINI_API_KEY for image generation, trying OpenRouter adapter...');
      // Fallback: try OpenRouter with image-capable model
      if (OPENROUTER_API_KEY) {
        return createOpenRouterAdapter(OPENROUTER_API_KEY);
      }
      throw new Error("Chưa cấu hình API Key cho tạo ảnh. Vui lòng thêm VITE_GEMINI_API_KEY vào .env");
    }
    return new GoogleGenAI({ apiKey: GOOGLE_IMAGE_API_KEY });
  }

  // Text generation: uses OpenRouter
  if (!OPENROUTER_API_KEY) {
    // Fallback: Try Google GenAI directly
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
      // Try with image client as fallback (Google GenAI direct)
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
