
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { DhbcPhrase } from "../types";
import { getAiClient, callWithAiFallback } from "./keyService";

export const suggestDhbcPhrases = async (language: string = 'vi'): Promise<DhbcPhrase[]> => {
  const langMap: Record<string, string> = {
    'vi': 'Tiếng Việt',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh-CN': 'Chinese',
    'th': 'Thai',
    'id': 'Indonesian',
    'ms': 'Malay',
    'tl': 'Filipino',
    'km': 'Khmer',
    'lo': 'Lao',
    'my': 'Burmese',
    'fr': 'French',
    'de': 'German'
  };
  const targetLang = langMap[language] || 'Tiếng Việt';

  const prompt = `Gợi ý 10 câu ngẫu nhiên để chơi trò "Đuổi hình bắt chữ". 
  Nội dung bao gồm: hot trends hiện nay, ca dao tục ngữ, thành ngữ, câu slang của giới trẻ (Gen Z) bằng ${targetLang}.
  Với mỗi câu, hãy tạo ra một chuỗi gợi ý ô chữ (hint) theo quy tắc nghiêm ngặt:
  - Chỉ giữ lại CHÍNH XÁC 2 ký tự ngẫu nhiên trong toàn bộ câu (không tính khoảng trắng).
  - Tất cả các ký tự còn lại phải được thay thế bằng dấu gạch dưới "_".
  - Giữ nguyên các khoảng trắng giữa các từ.
  Ví dụ (Tiếng Việt): "Chó cắn áo rách" có thể thành "_h_ ___ __ _á__".
  Trả về duy nhất mảng JSON các đối tượng { phrase: string, hint: string }.`;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              phrase: { type: Type.STRING },
              hint: { type: Type.STRING }
            },
            required: ["phrase", "hint"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  }).catch((error) => {
    console.error("Error suggesting phrases:", error);
    return [];
  });
};

export const generateDhbcIllustration = async (
  phrase: string,
  facePart: { mimeType: string, data: string } | null,
  faceDesc: string,
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient('image');
  const is3D = imageStyle === '3D';
  
  const baseStyle = is3D 
    ? "High-quality 3D Animation Pixar/Disney style, vibrant colors, expressive character design, polished CGI, masterpiece."
    : "Photorealistic RAW PHOTO, professional commercial photography, 8k resolution, cinematic lighting, authentic textures.";

  const subject = facePart 
    ? "Generate the character using the EXACT face features from the provided reference image." 
    : `Include a character if appropriate. ${faceDesc}`;

  const prompt = `
    TASK: Generate a ${imageStyle} visual illustration for the Vietnamese phrase: "${phrase}".
    STYLE: ${baseStyle}
    RATIO: 1:1 Square aspect ratio.
    
    CONCEPT: Create a creative visual metaphor or literal illustration of "${phrase}". 
    Example: If phrase is "Chó cắn áo rách", show a cinematic scene of a dog biting a torn shirt.
    
    CHARACTER: ${subject}. 
    
    MANDATORY VISUAL RULES:
    - NO TEXT, NO LOGOS, NO WATERMARKS, NO SUBTITLES.
    - NO USER INTERFACE ELEMENTS, NO BUTTONS.
    - The illustration must occupy the FULL FRAME.
    - Sharp focus, high detail, artistic composition.
    
    ${regenNote ? `ADDITIONAL FEEDBACK TO APPLY: ${regenNote}` : ""}
  `;

  // Putting facePart first often improves reference fidelity for Nano-Banana models
  const parts: any[] = [];
  if (facePart) {
    parts.push({ inlineData: facePart });
  }
  parts.push({ text: prompt });

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts },
      config: { 
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    // Safer extraction of image data
    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned from AI");
    
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("AI response did not contain an image part. It might have returned a text refusal instead.");
  });
};

export const generateDhbcImagePrompt = async (
  phrase: string,
  faceDesc: string,
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  userCustomPrompt: string | undefined = ""
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const baseStyle = is3D ? "Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, CGI tinh xảo, màu sắc rực rỡ" : "Ảnh chụp RAW PHOTO chân thực, 8k, ánh sáng tự nhiên mang tính điện ảnh";

  const prompt = `Bạn là một chuyên gia viết prompt cho AI tạo ảnh (Midjourney/DALL-E/Imagen).
Nhiệm vụ: Viết một prompt bằng TIẾNG ANH để tạo ảnh minh họa cho câu đố Đuổi Hình Bắt Chữ: "${phrase}".

QUY TẮC BẮT BUỘC:
1. KHÔNG BAO GIỜ có chữ, văn bản, logo, watermark trong ảnh.
2. Tỷ lệ khung hình: 1:1 (Square).
3. Phong cách: ${baseStyle}.
4. Bố cục tập trung vào chủ thể, rõ nét, chi tiết cao.
5. Tạo ra một hình ảnh ẩn dụ sáng tạo hoặc minh họa trực tiếp cho câu "${phrase}". Ví dụ: "Chó cắn áo rách" -> cảnh một con chó đang cắn một chiếc áo rách nát.

THÔNG TIN CHI TIẾT:
- Khuôn mặt nhân vật (nếu có): TỆP ĐÍNH KÈM KHUÔN MẶT. ${faceDesc ? `Mô tả thêm: ${faceDesc}` : ""}
${regenNote ? `- Ghi chú chỉnh sửa từ người dùng: ${regenNote}` : ""}
${userCustomPrompt ? `- Yêu cầu đặc biệt từ người dùng (ƯU TIÊN HÀNG ĐẦU): ${userCustomPrompt}` : ""}

Hãy viết prompt chi tiết, mô tả rõ hành động, biểu cảm, bối cảnh, ánh sáng và phong cách nghệ thuật.
Chỉ trả về nội dung prompt bằng TIẾNG ANH, không cần giải thích thêm.`;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text || "";
  }).catch((error) => {
    console.error("Error generating image prompt:", error);
    return "";
  });
};

export const generateDhbcVideoPrompt = async (
  phrase: string,
  hint: string,
  imageUrl: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const is3D = imageStyle === '3D';

  const systemPrompt = `
    Bạn là chuyên gia viết prompt cho AI Video (VEO-3). Dựa trên hình ảnh đã được tạo và câu đuổi hình bắt chữ "${phrase}", hãy viết một kịch bản video sáng tạo.
    PHONG CÁCH VIDEO: ${is3D ? "3D Animation / CGI Style" : "Photorealistic / Real Life Style"}.
    
    CẤU TRÚC BẮT BUỘC (TIẾNG VIỆT):
    Đoạn 1: Nhân vật & bối cảnh. Bắt đầu bằng cách mô tả rõ ràng nhân vật chính, ngoại hình, trang phục và không gian xung quanh. Video tỉ lệ 9:16. ${is3D ? "Phong cách hoạt hình 3D Pixar/Disney." : "Phong cách người thật chân thực."}
    Đoạn 2: Hành động & tương tác. Dựa vào câu "${phrase}", tạo ra 1 hành động nhằm gợi ý cho khán giả hiểu được nội dung ẩn dụ đó. 
    LƯU Ý QUAN TRỌNG: Video phải giữ nguyên lớp phủ tiêu đề ở trên cùng và các ô chữ ở dưới cùng y hệt hình ảnh gốc, không cho chúng chuyển động hay biến đổi.
    Đoạn 3: Không khí & thông số kỹ thuật. Kết đoạn bằng mô tả mood tổng thể, ánh sáng, phong cách. Thông số như “Tỉ lệ 9:16, độ phân giải 4K, chuyển động mượt, độ chân thật cao, ${is3D ? "3D Animation, Masterpiece CGI" : "Realistic, Cinematic Lighting"}.”

    YÊU CẦU: Trả về kịch bản bằng Tiếng Việt súc tích trên 1 dòng duy nhất.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { text: systemPrompt },
          { inlineData: { mimeType: "image/png", data: imageUrl.split(",")[1] } }
        ] 
      }
    });
    return response.text?.trim() || "Không thể tạo prompt video.";
  }).catch((error) => {
    console.error("Dhbc Video Prompt Error:", error);
    return "Lỗi khi tạo prompt video.";
  });
};
