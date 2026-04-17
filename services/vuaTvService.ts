
import { GoogleGenAI, Type } from "@google/genai";
import { getAiClient, callWithAiFallback } from "./keyService";

// Helper xử lý lỗi 429 Quota Exceeded với retry
const callWithRetry = async (fn: () => Promise<any>, retries = 2, delay = 4000) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e.message?.includes("429") && i < retries) {
        console.warn(`Quota exceeded, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
};

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateVuaTvImage = async (
  answer: string,
  facePart: { mimeType: string, data: string } | null,
  faceDesc: string,
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient('image');
  const is3D = imageStyle === '3D';

  const baseStyle = is3D 
    ? "High-quality 3D Animation Pixar/Disney style, vibrant colors, expressive character design, polished CGI."
    : "Photorealistic RAW PHOTO, 8k resolution, authentic textures, cinematic lighting.";

  const subject = facePart 
    ? "Maintain the exact face features from the provided reference image." 
    : `Include a young Vietnamese character. ${faceDesc}`;

  const prompt = `
    STYLE: ${baseStyle} 
    RATIO: 9:16 portrait.
    
    GOAL: Create a "SUPER HARD" puzzle for a game. The answer is: "${answer}".
    
    CRITICAL REQUIREMENT: The image must NOT literally represent the answer. Instead, it should be MISLEADING, UNRELATED, or have an OPPOSITE meaning to "${answer}" to confuse players.
    Example: If answer is "THÁI BÌNH" (Peaceful), show a chaotic, stormy scene.
    
    CHARACTER: ${subject}.
    
    MANDATORY: NO TEXT, NO LOGOS, NO OVERLAYS.
    
    ${regenNote ? `User specific feedback: ${regenNote}` : ""}
  `;

  const parts: any[] = [];
  if (facePart) {
    parts.push({ inlineData: facePart });
  }
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned");
    
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data in AI response");
  } catch (error) {
    console.error("Vua TV Image Generation Error:", error);
    throw error;
  }
};

export const generateVuaTvImagePrompt = async (
  answer: string,
  faceDesc: string,
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  userCustomPrompt: string | undefined = "",
  poseLabel: string = "",
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const baseStyle = is3D ? "Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, CGI tinh xảo, màu sắc rực rỡ" : "Ảnh chụp RAW PHOTO chân thực, 8k, ánh sáng tự nhiên mang tính điện ảnh";

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

  const instructionText = `
    Nhiệm vụ: Viết một lời nhắc (Prompt) cực kỳ chi tiết bằng ${targetLang} để tạo hình ảnh AI chất lượng cao (8k) cho chương trình "Vua Tiếng Việt".
    
    QUY TẮC THỊ GIÁC QUAN TRỌNG:
    1. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ.
    2. KHÔNG có các yếu diện người dùng (UI), KHÔNG bong bóng thoại, KHÔNG dấu mờ (watermark), KHÔNG phụ đề, KHÔNG EMOJI.
    3. KHUNG HÌNH (FRAMING): Nhân vật chiếm 3/4 khung hình đứng.
    
    CẤU TRÚC PROMPT:
    - [Style & Lighting]: ${baseStyle}.
    - [Subject Description]: Nhân vật người Việt Nam. Mô tả chi tiết diện mạo, trang phục: "${faceDesc}".
    - [Subject Interaction/Action]: ${poseLabel ? `Tư thế: "${poseLabel}". ` : ""}Cực kỳ chi tiết hành động hoặc biểu cảm liên quan đến đáp án "${answer}".
    - [Environment]: Bối cảnh bám sát "${regenNote || 'trường quay hoặc bối cảnh tự nhiên'}".
    
    YÊU CẦU ĐẦU RA:
    - Trả về DUY NHẤT một đoạn văn bản ${targetLang} mô tả cực kỳ chi tiết toàn bộ khung cảnh, nhân vật, trang phục, hành động và bối cảnh.
    - KHÔNG có tiêu đề, KHÔNG giải thích, KHÔNG xuống dòng.
    - Kết hợp mượt mà các yêu cầu trên thành một đoạn prompt hoàn chỉnh, chi tiết và sống động.
    ${userCustomPrompt ? `- ƯU TIÊN TỐI ĐA MÔ TẢ HÀNH ĐỘNG/BỐ TRÍ THEO GHI CHÚ NÀY: "${userCustomPrompt}"` : ""}
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: instructionText }] }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error: any) => {
    console.error("Lỗi tạo prompt ảnh Vua TV:", error);
    if (error.message?.includes("429")) {
      throw new Error("Lỗi tạo prompt ảnh AI:\n{\"error\":{\"code\":429,\"message\":\"Resource has been exhausted (e.g. check quota).\",\"status\":\"RESOURCE_EXHAUSTED\"}}");
    }
    return "Lỗi tạo prompt ảnh.";
  });
};

export const generateVuaTvVideoPrompt = async (
  answer: string,
  puzzle: string,
  headerTitle: string,
  imageUrl: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';

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

  const systemPrompt = `
    Bạn là chuyên gia viết prompt cho AI Video (VEO-3). Dựa trên hình ảnh đã được tạo và nội dung chương trình "Vua Tiếng Việt", hãy tạo một prompt video hoàn chỉnh.
    PHONG CÁCH VIDEO: ${is3D ? "3D Animation / CGI Style" : "Photorealistic / Real Life Style"}.
    
    CẤU TRÚC BẮT BUỘC (${targetLang.toUpperCase()}):
    Đoạn 1: Nhân vật & bối cảnh. Mô tả rõ nhân vật chính trong ảnh, ngoại hình, trang phục và không gian xung quanh. Video tỉ lệ 9:16. ${is3D ? "Phong cách hoạt hình 3D Pixar/Disney." : "Phong cách người thật chân thực."}
    Đoạn 2: Chuyển động. Mô tả các chuyển động nhẹ nhàng, tự nhiên cho phần hình ảnh bên dưới (chiếm 8/10 khung hình). Nhân vật có thể mỉm cười, chớp mắt hoặc có các chuyển động môi trường như gió thổi lá cây, ánh sáng lung linh.
    QUAN TRỌNG: Phần tiêu đề 2/10 ở trên cùng (chứa chữ "${headerTitle}" và câu đố "${puzzle}") phải được giữ nguyên 100% tĩnh, không biến đổi.
    Đoạn 3: Không khí & thông số kỹ thuật. Mô tả mood tổng thể, ánh sáng chân thực. 
    Thông số: “Tỉ lệ 9:16, độ phân giải 4K, chuyển động mượt, độ chân thật cao, ${is3D ? "3D Animation, Masterpiece CGI" : "Realistic, Cinematic Lighting"}.”

    YÊU CẦU: Trả về kịch bản bằng ${targetLang} súc tích trên một đoạn duy nhất.
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
    console.error("Vua TV Video Prompt Error:", error);
    return "Lỗi khi tạo prompt video.";
  });
};
