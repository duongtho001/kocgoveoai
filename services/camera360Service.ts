import { GenerateContentResponse } from "@google/genai";
import { CameraState, AdvancedSettings } from "../types";
import { buildCameraPrompt } from "../utils/camera360";
import { getAiClient } from "./keyService";

export async function editImageCamera(
  imageSource: string,
  camera: CameraState,
  settings: AdvancedSettings
): Promise<string> {
  const ai = getAiClient('image');
  const promptText = buildCameraPrompt(camera.azimuth, camera.elevation, camera.distance);
  
  const systemInstruction = `
    You are an expert AI image editor specializing in camera perspective transformations.
    Your task is to re-render the input image from a new camera angle specified in the prompt.
    The prompt starts with a special token <sks> followed by descriptors like "front view", "high-angle shot", "wide shot".
    
    CRITICAL RULES:
    1. STRICTLY PRESERVE the subject, their clothing, features, environment, and overall lighting from the original image.
    2. Change ONLY the camera angle (Azimuth, Elevation, and Distance).
    3. Output the result as a high-quality image.
    4. The user's prompt is: ${promptText}
  `;

  const base64Data = imageSource.split(",")[1];
  const mimeType = imageSource.split(";")[0].split(":")[1];

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: `Edit this image's camera angle to: ${promptText}` }
      ]
    },
    config: {
      systemInstruction,
      temperature: 1.0,
      seed: settings.randomizeSeed ? Math.floor(Math.random() * 2147483647) : settings.seed,
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated from API");
}
