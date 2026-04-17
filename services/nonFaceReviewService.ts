import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScriptParts } from "../types";
import { getAiClient, callWithRetry, callWithAiFallback } from "./keyService";
import { getScriptLengthInstruction, getPersonaContext, getLanguageLabel } from "../utils/languageUtils";

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const FORBIDDEN_TERMS = `
  Facebook, Shopee, Lazada, Tiki, Zalo, QR, Chuyển khoản, Fanpage, Địa Chỉ, Số điện thoại, Có 1 không 2,
  Em đang có, Xem này, Mã giảm sâu, Voucher, Tiktok, dành riêng, ưu đãi, dành riêng, quà tặng, duy nhất, triân, nhé, nha, thế chứ.
`;

const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "20-40 years old, Northern Vietnamese (Hanoi) accent, energetic, fast-paced, cheerful, high pitch, youthful vibe",
    "Giọng Nam 20-40 tuổi": "20-40 years old, Southern Vietnamese (Saigon) accent, energetic, fast-paced, cheerful, high pitch, youthful vibe",
    "Giọng Bắc 50-60 tuổi": "50-60 years old, Northern Vietnamese accent, middle-aged, deep, resonant, stable, authoritative and trustworthy",
    "Giọng Nam 50-60 tuổi": "50-60 years old, Southern Vietnamese accent, middle-aged, deep, resonant, stable, authoritative and trustworthy",
    "Giọng Bắc 60-80 tuổi": "60-80 years old, Northern Vietnamese accent, elderly, slightly raspy, hearty, rustic, slow and emotional",
    "Giọng Nam 60-80 tuổi": "60-80 years old, Southern Vietnamese accent, elderly, slightly raspy, hearty, rustic, slow and emotional"
  };
  return mapping[voiceLabel] || voiceLabel;
};

/**
 * Tạo kịch bản TikTok tập trung vào sản phẩm (Voice-over style).
 */
export const generateNonFaceScript = async (
  imageParts: any[], 
  productName: string, 
  keyword: string, 
  scriptLayout: string, 
  gender: string, 
  voice: string,
  addressing: string,
  sceneCount: number,
  targetAudience: string,
  language: string = 'vi'
): Promise<ScriptParts> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const targetLang = getLanguageLabel(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Trong vai 1 Creator chuyên nghiệp, hãy tạo kịch bản bán hàng (Voice-over) cho sản phẩm "${productName}". 
    USP: "${keyword}". 
    Bố cục: "${scriptLayout}". 
    NHÂN VẬT VOICE-OVER: Giới tính ${gender}, Đặc điểm giọng nói: ${voice} (${voiceDetail}).
    Ngôn ngữ: ${targetLang}.
    
    !!! TỆP KHÁCH HÀNG: "${targetAudience || 'Đại chúng'}" !!!
    => YÊU CẦU: Kịch bản thuần lời dẫn (Voice-over), tập trung hoàn toàn vào lợi ích và trải nghiệm sản phẩm.
    
    YÊU CẦU: Đúng ${sceneCount} phần (v1..v${sceneCount}).
    
    !!! QUY TẮC ĐỘ DÀI NGHIÊM NGẶT !!!:
    ${lengthInstruction}
    XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" xuyên suốt kịch bản.
    - Không dùng từ cấm: ${FORBIDDEN_TERMS}
    - Văn phong phải cực kỳ khớp với đối tượng: ${voice}.
  `;

  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (let i = 1; i <= sceneCount; i++) {
    const key = `v${i}`;
    properties[key] = { type: Type.STRING };
    required.push(key);
  }

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, ...imageParts.slice(0, 3).map(p => ({ inlineData: p }))] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties, required },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return JSON.parse(cleanJsonResponse(response.text || '{}'));
  }).catch((e) => {
    console.error("Lỗi tạo kịch bản Non-Face:", e);
    const fallback: ScriptParts = {};
    for (let i = 1; i <= sceneCount; i++) fallback[`v${i}`] = '';
    return fallback;
  });
};

/**
 * Tạo lại một phần kịch bản cụ thể (v1, v2...) cho Non-Face mode.
 */
export const regenerateNonFaceScriptPart = async (
  imageParts: any[], 
  productName: string, 
  keyword: string, 
  scriptPartKey: string,
  currentPartContent: string,
  fullScript: ScriptParts,
  gender: string, 
  voice: string,
  addressing: string,
  targetAudience: string = "",
  language: string = 'vi'
): Promise<string> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const targetLang = getLanguageLabel(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Hãy VIẾT LẠI phần kịch bản Voice-over "${scriptPartKey}" cho sản phẩm "${productName}".
    Tệp khách hàng mục tiêu: "${targetAudience}".
    Nội dung cũ: "${currentPartContent}".
    Bối cảnh toàn bộ kịch bản: ${JSON.stringify(fullScript)}.
    Ngôn ngữ: ${targetLang}.
    
    YÊU CẦU:
    1. Giữ nguyên phong cách và sự logic với các phần khác.
    2. ĐỘ DÀI NGHIÊM NGẶT: ${lengthInstruction}
    3. Giới tính giọng đọc: ${gender}, Đặc điểm giọng nói: ${voiceDetail}.
    4. XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe).
    5. TUYỆT ĐỐI KHÔNG dùng từ cấm: ${FORBIDDEN_TERMS}
    6. Đảm bảo ngôn từ thu hút và viral hơn bản cũ.
    
    Trả về duy nhất chuỗi ký tự kịch bản mới.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, ...imageParts.slice(0, 3).map(p => ({ inlineData: p }))] },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text?.trim() || currentPartContent;
  }).catch((error) => {
    console.error("Lỗi tạo lại một phần kịch bản Non-Face:", error);
    return currentPartContent;
  });
};

/**
 * Tạo prompt ảnh sản phẩm.
 */
export const generateNonFaceImagePrompt = async (
  productName: string,
  scriptPart: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  handVisibility: 'no_hand' | 'with_hand' = 'no_hand',
  visualNote: string = "",
  productParts: any[] = [],
  userCustomPrompt: string | undefined = "",
  poseLabel: string = "",
  backgroundReferencePart: any | null = null,
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const { persona, context } = getPersonaContext(language);
  const baseStyle = is3D ? "Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, CGI tinh xảo, màu sắc rực rỡ" : "Ảnh chụp sản phẩm thương mại RAW PHOTO, Still Life chuyên nghiệp, 8k, ánh sáng studio điện ảnh";

  const handRule = handVisibility === 'with_hand' 
    ? "BẮT BUỘC: Hiển thị bàn tay người chuyên nghiệp, sạch sẽ đang cầm hoặc tương tác với sản phẩm. Tập trung cận cảnh vào bàn tay và sản phẩm."
    : "!!! QUY TẮC NGHIÊM NGẶT: TUYỆT ĐỐI KHÔNG CÓ NGƯỜI, KHÔNG CÓ TAY, KHÔNG CÓ BẤT KỲ BỘ PHẬN CƠ THỂ NÀO !!!";

  const backgroundInstruction = backgroundReferencePart 
    ? `TỆP ĐÍNH KÈM BỐI CẢNH: Sử dụng bối cảnh và bố cục từ ảnh mẫu bối cảnh để mô tả không gian xung quanh sản phẩm. Đảm bảo bối cảnh mang đậm nét ${context}.`
    : `BỐI CẢNH: Mô tả bối cảnh chuyên nghiệp, tôn lên vẻ đẹp của sản phẩm. Không gian mang đậm nét ${context}.`;

  const instructionText = `
    Nhiệm vụ: Viết một lời nhắc (Prompt) cực kỳ chi tiết bằng Tiếng Việt để tạo hình ảnh AI chất lượng cao (8k) tập trung vào SẢN PHẨM.
    Sản phẩm chính: "${productName}".
    
    !!! QUY TẮC PHÂN TÍCH THAM CHIẾU (BẮT BUỘC) !!!
    ${productParts.length > 0 ? `TỆP ĐÍNH KÈM SẢN PHẨM: Mô tả cực kỳ chi tiết về "${productName}" (hình dáng, nhãn hiệu, màu sắc, vật liệu) từ ảnh mẫu để đảm bảo độ nhận diện 100%.` : `Mô tả cực kỳ chi tiết về "${productName}".`}
    
    ${handRule}
    
    QUY TẮC THỊ GIÁC QUAN TRỌNG:
    1. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ.
    2. KHÔNG có các yếu diện người dùng (UI), KHÔNG bong bóng thoại, KHÔNG dấu mờ (watermark), KHÔNG phụ đề, KHÔNG EMOJI.
    3. TỶ LỆ SẢN PHẨM: Sản phẩm "${productName}" PHẢI duy trì kích thước thực tế, không bị biến dạng.
    4. NHÂN VẬT (NẾU CÓ): ${persona}.
    5. BỐI CẢNH: ${context}.
    
    CẤU TRÚC PROMPT:
    - [Style & Lighting]: ${baseStyle}.
    - [Product Description]: Mô tả cực kỳ chi tiết sản phẩm từ TỆP ĐÍNH KÈM SẢN PHẨM (nếu có).
    - [Product Interaction/Display]: ${poseLabel ? `Sản phẩm được hiển thị theo kiểu: "${poseLabel}". ` : ""}Cực kỳ chi tiết cách sản phẩm được đặt hoặc tương tác (nếu có tay), phù hợp kịch bản "${scriptPart}". Nhân vật thực hiện hành động là ${persona}.
    - [Environment]: ${backgroundInstruction}
    - [Visual Rules]: ${visualNote ? `BỐ CỤC THỊ GIÁC: ${visualNote}.` : ""}
    
    YÊU CẦU ĐẦU RA:
    - Trả về DUY NHẤT một đoạn văn bản Tiếng Việt mô tả cực kỳ chi tiết toàn bộ khung cảnh, sản phẩm, và bối cảnh.
    - KHÔNG có tiêu đề, KHÔNG giải thích, KHÔNG xuống dòng.
    - Kết hợp mượt mà các yêu cầu trên thành một đoạn prompt hoàn chỉnh, chi tiết và sống động.
    ${userCustomPrompt ? `- ƯU TIÊN TỐI ĐA MÔ TẢ HÀNH ĐỘNG/BỐ TRÍ THEO GHI CHÚ NÀY: "${userCustomPrompt}"` : ""}
  `;

  const contents: any[] = [{ text: instructionText }];
  if (productParts.length > 0) {
    contents.push({ text: "TỆP ĐÍNH KÈM SẢN PHẨM:" });
    productParts.forEach(p => contents.push({ inlineData: p }));
  }
  if (backgroundReferencePart) {
    contents.push({ text: "TỆP ĐÍNH KÈM BỐI CẢNH:" });
    contents.push({ inlineData: backgroundReferencePart });
  }

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error: any) => {
    console.error("Lỗi tạo prompt ảnh Non-Face:", error);
    if (error.message?.includes("429")) {
      throw new Error("Lỗi tạo prompt ảnh AI:\n{\"error\":{\"code\":429,\"message\":\"Resource has been exhausted (e.g. check quota).\",\"status\":\"RESOURCE_EXHAUSTED\"}}");
    }
    return "Lỗi tạo prompt ảnh.";
  });
};

/**
 * Tạo hình ảnh sản phẩm.
 */
export const generateNonFaceImage = async (
  referenceImageParts: any[], 
  handReferencePart: any | null,
  productName: string,
  scriptPart: string, 
  userCustomPrompt: string | undefined, 
  imageStyle: 'Realistic' | '3D' = 'Realistic', 
  handVisibility: 'no_hand' | 'with_hand' = 'no_hand',
  backgroundNote: string = "",
  visualNote: string = "",
  backgroundReferencePart: any | null = null,
  productAngle: string = "",
  poseLabel: string = "",
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('image');
  const is3D = imageStyle === '3D';
  const { persona, context } = getPersonaContext(language);
  
  const angleMapping: Record<string, string> = {
    "0": "front view",
    "45": "front-right quarter view",
    "90": "right side view",
    "270": "left side view",
    "315": "front-left quarter view"
  };
  const angleLabel = angleMapping[productAngle] || "";

  const baseStyle = is3D 
    ? "Phong cách Hoạt hình 3D chất lượng cao Pixar Style, màu sắc rực rỡ, CGI trau chuốt."
    : "Ảnh chụp sản phẩm thương mại RAW PHOTO, Still Life chuyên nghiệp, 8k, cinematic lighting.";
    
  let handRule = "";
  if (handVisibility === 'with_hand') {
    handRule = `Góc máy có xuất hiện bàn tay người (${persona}) đang cầm hoặc tương tác với sản phẩm một cách khéo léo và thẩm mỹ. ${handReferencePart ? "Sử dụng bàn tay từ ảnh HAND_REFERENCE làm mẫu." : ""}`;
  } else {
    handRule = "!!! CẢNH BÁO TỐI QUAN TRỌNG: TUYỆT ĐỐI KHÔNG CÓ NGƯỜI, KHÔNG CÓ BẤT KỲ BỘ PHẬN CƠ THỂ NÀO (KHÔNG CÓ TAY CẦM SẢN PHẨM) !!!";
  }

  const poseInstruction = poseLabel ? `PRODUCT DISPLAY STYLE (MANDATORY): The product is ${poseLabel}. Ensure the visual arrangement matches this specific style.` : "";

  const visualRules = `
    ${handRule}
    ${poseInstruction}
    1. CHI TIẾT SẢN PHẨM "${productName}" PHẢI GIỐNG ẢNH THAM CHIẾU 100% (luôn luôn tham chiếu lại hình ảnh sản phẩm mà người dùng tải lên trước khi tạo hình ảnh).
    2. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, LOGO LẠ, ICON, EFFECT, BONG BÓNG CHAT.
    3. NHÂN VẬT (NẾU CÓ): ${persona}.
    4. BỐI CẢNH: ${context}.
    ${angleLabel ? `- Góc nhìn sản phẩm: ${angleLabel}.` : ""}
  `;

  const backgroundRule = backgroundReferencePart 
    ? `MÔI TRƯỜNG: Sử dụng bối cảnh và bố cục từ ảnh BACKGROUND_REFERENCE. Không gian mang đậm nét ${context}.`
    : `MÔI TRƯỜNG: Đặt sản phẩm trong bối cảnh ${backgroundNote || 'studio cao cấp'}. Không gian mang đậm nét ${context}.`;

  const prompt = `
    ${baseStyle} Tỷ lệ khung hình 9:16. 
    ${visualRules}
    ${backgroundRule}
    ${visualNote ? `BỐ CỤC: ${visualNote}.` : ""}
    MÔ TẢ CẢNH: "${scriptPart}". 
    ${userCustomPrompt || ""}
  `;
  
  const contents: any[] = [{ text: prompt }];
  if (backgroundReferencePart) contents.push({ inlineData: backgroundReferencePart });
  if (handReferencePart) contents.push({ inlineData: handReferencePart });
  referenceImageParts.forEach(part => contents.push({ inlineData: part }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imgPart) throw new Error("Fail");
    return `data:image/png;base64,${imgPart.inlineData.data}`;
  } catch (error) { throw error; }
};

/**
 * Tạo lời nhắc video tập trung vào SẢN PHẨM (VEO-3).
 */
export const generateNonFaceVeoPrompt = async (
  productName: string, 
  scriptText: string, 
  gender: string, 
  voice: string,
  handVisibility: 'no_hand' | 'with_hand' = 'no_hand',
  productImageBase64?: string,
  generatedImageBase64?: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  
  const handInstruction = handVisibility === 'with_hand'
    ? `- Xuất hiện bàn tay đang cầm hoặc tương tác tinh tế với sản phẩm.`
    : `!!! TUYỆT ĐỐI KHÔNG CÓ NGƯỜI HAY TAY NGƯỜI XUẤT HIỆN TRONG VIDEO !!!`;

  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết tạo video AI (VEO-3) dài 8 giây tập trung hoàn toàn vào SẢN PHẨM.
  ${handInstruction}
  
  CẤU TRÚC PROMPT BẮT BUỘC:
  PHẦN 1: SẢN PHẨM & BỐI CẢNH. Mô tả sản phẩm "${productName}" ở chính giữa khung hình, sắc nét, giữ nguyên tỷ lệ 1:1, không biến dạng. ${is3D ? "3D Pixar Animation style." : "Cinematic Realistic style."} Bối cảnh đồng nhất với ảnh tham chiếu.
  PHẦN 2: CHUYỂN ĐỘNG CAMERA (9:16). Dolly in, Pan hoặc Zoom mượt mà vào sản phẩm 1 cách chuyên nghiệp. Tuyệt đối không thay đổi bối cảnh và sản phẩm suốt 8s. 
  
  PHẦN 3: LỜI THOẠI (BẮT BUỘC THAM CHIẾU GIỌNG NÓI & ĐỘ TUỔI): 
  ✨ Model performs Voice-over with specific traits: "${voice}" (Technical specs: ${voiceDetail}). 
  Speaker Gender: ${voiceGender}. 
  Script content: "${scriptText}"

  PHẦN 4: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Cinematic Studio Lighting. 
  Tuyệt đối không có nhạc nền, Khung hình tại giây 8.0 phải giống hệt khung hình tại giây 6.5.
  Video là một cảnh quay liên tục duy nhất từ đầu đến cuối.
  
  YÊU CẦU: Trả về 1 dòng Tiếng Anh duy nhất (trừ phần lời thoại). Không xuống dòng.`;

  const contents: any[] = [{ text: instructionPrompt }];
  if (productImageBase64) contents.push({ inlineData: { mimeType: 'image/png', data: productImageBase64.split(',')[1] || productImageBase64 } });
  if (generatedImageBase64) contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error) => {
    console.error("Lỗi tạo prompt video Non-Face:", error);
    return "Error generating video prompt.";
  });
};