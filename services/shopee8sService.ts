import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScriptParts } from "../types";
import { getAiClient, callWithRetry, callWithAiFallback } from "./keyService";
import { getScriptLengthInstruction, getPersonaContext, getLanguageLabel } from "../utils/languageUtils";

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

const SHOPEE_8S_HOOKS: string[] = [];


export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const isNorth = voiceLabel.includes("Bắc");
  
  const dialectInstruction = isNorth ? `
    VĂN PHONG MIỀN BẮC (HÀ NỘI):
    - Sử dụng từ đệm: "nhé", "ạ", "thế", "đấy", "vậy", "vâng", "chứ".
    - Cách dùng từ: "không", "vẫn", "thế này".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Nam như: nha, nè, nghen, thiệt, hông, vầy, bển, trển.
  ` : `
    VĂN PHONG MIỀN NAM (SÀI GÒN):
    - Sử dụng từ đệm: "nha", "nè", "nghen", "hen", "đó", "vầy", "nghen", "ha".
    - Cách dùng từ: "hông" (thay cho không), "thiệt" (thay cho thật), "dễ thương dữ thần", "hết sảy".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Bắc như: nhé, ạ, thế, đấy, chả, vâng.
  `;

  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "20-40 tuổi, giọng miền Bắc, năng động, nhịp độ nhanh, vui vẻ, tông cao, hào hứng.",
    "Giọng Nam 20-40 tuổi": "20-40 tuổi, giọng miền Nam, năng động, nhịp độ nhanh, vui vẻ, tông cao, hào hứng.",
    "Giọng Bắc 50-60 tuổi": "50-60 tuổi, giọng miền Bắc, giọng trầm, vang, ổn định, uy quyền, đáng tin cậy.",
    "Giọng Nam 50-60 tuổi": "50-60 tuổi, giọng miền Nam, giọng trầm, vang, ổn định, uy quyền, đáng tin cậy.",
    "Giọng Bắc 60-80 tuổi": "60-80 tuổi, giọng miền Bắc, khàn, hào sảng, chân chất, thực tế.",
    "Giọng Nam 60-80 tuổi": "60-80 tuổi, giọng miền Nam, khàn, hào sảng, chân chất, thực tế."
  };
  
  return (mapping[voiceLabel] || voiceLabel) + "\n" + dialectInstruction;
};

export const extractOutfitImage = async (outfitPart: any): Promise<string> => {
  const ai = getAiClient('image');
  const prompt = `
    Tạo một hình ảnh chụp ảnh sản phẩm chuyên nghiệp CHỈ bao gồm trang phục được hiển thị trong ảnh tham chiếu.
    1. XÓA hoàn toàn người/nhân vật.
    2. XÓA hoàn toàn bối cảnh.
    3. Trang phục phải được hiển thị một mình trên nền trắng tinh khiết (#FFFFFF).
    4. Giữ nguyên chính xác hoa văn, màu sắc và kết cấu của quần áo 100%.
    5. Sắp xếp quần áo tự nhiên như thể trên một ma-nơ-canh tàng hình hoặc đặt trên mặt phẳng sạch sẽ.
    6. Đảm bảo kết quả là một hình ảnh sắc nét, chất lượng cao chỉ chứa quần áo.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: [{ text: prompt }, { inlineData: outfitPart }] }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Thất bại");
  } catch (error) { 
    console.error("Lỗi trích xuất ảnh trang phục:", error);
    throw error; 
  }
};

export const generateShopee8sScript = async (productName: string, usp: string, voice: string, addressing: string, gender: string, language: string = 'vi'): Promise<ScriptParts> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const targetLang = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const scriptRules = `
  QUY TẮC NỘI DUNG KỊCH BẢN (8 GIÂY):
  - Độ dài: 160-180 ký tự.
  - Tập trung kết hợp ngẫu nhiên các yếu tố:
    + Đánh vào thị giác & Cảm xúc.
    + Ngôn ngữ của "Người thật việc thật", gần gũi, đời thường.
    + Tính thúc giục (Scarcity & Urgency).
    + Kỹ thuật "Cảnh báo/Vấn đề".
    + Kỹ thuật "Cực đoan hóa" cảm xúc hoặc tình huống.
    + Cụ thể hóa cảm giác (mùi vị, xúc giác, cảm nhận thực tế).
    + Xác thực xã hội (Social Proof) nhưng KHÔNG nhắc đến con số cụ thể.
    + Khớp nối bối cảnh sử dụng thực tế.
    + Xóa bỏ rào cản mua hàng.
  - CẤM (NEGATIVE CONSTRAINTS):
    + KHÔNG dùng từ "nhất".
    + KHÔNG khẳng định tuyệt đối.
    + KHÔNG so sánh về giá.
  `;

  const prompt = `Bạn là chuyên gia content Shopee chuyên nghiệp chuyên tạo video viral. 
  Nhiệm vụ: Tạo 4 kịch bản khác nhau cho 4 video ngắn (mỗi video dài 8 giây).
  
  CẤU TRÚC:
  - v1, v2, v3, v4: 4 kịch bản độc lập, khác nhau hoàn toàn về cách tiếp cận nhưng cùng quảng bá cho 1 sản phẩm.
  
  ${scriptRules}
 
  YÊU CẦU ĐỘ DÀI (QUAN TRỌNG):
  - Mỗi phần (v1, v2, v3, v4) PHẢI nằm trong khoảng 160-180 ký tự.
  
  NỘI DUNG:
  - Sản phẩm: "${productName}".
  - USP (Keyword quan trọng): "${usp}".
  - Nhân vật: ${persona}, Giới tính ${gender}, Đặc điểm giọng nói & Văn phong: ${voiceDetail}.
  - Bối cảnh: ${context}.
  - XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe) xuyên suốt 100%.
  - Ngôn ngữ trẻ trung, thu hút, đánh thẳng vào USP.
  - Ngôn ngữ đầu ra: ${targetLang} (100% chính xác ngữ pháp và chính tả).
  - Không dùng từ cấm: Shopee, Lazada, Tiki, TikTok Shop.
  
  Trả về duy nhất JSON: { "v1": "...", "v2": "...", "v3": "...", "v4": "..." }`;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { 
            v1: { type: Type.STRING }, 
            v2: { type: Type.STRING }, 
            v3: { type: Type.STRING }, 
            v4: { type: Type.STRING } 
          },
          required: ["v1", "v2", "v3", "v4"]
        }
      }
    });
    return JSON.parse(cleanJsonResponse(response.text || '{}'));
  }).catch((error) => {
    console.error("Lỗi tạo kịch bản Shopee 8s:", error);
    return { v1: '', v2: '', v3: '', v4: '' };
  });
};

export const generateShopee8sScriptsBulk = async (
  products: { id: number, name: string, usp: string }[],
  voice: string,
  addressing: string,
  gender: string,
  language: string = 'vi'
): Promise<{ id: number, script: ScriptParts }[]> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const targetLang = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const scriptRules = `
  QUY TẮC NỘI DUNG KỊCH BẢN (8 GIÂY):
  - Độ dài: 160-180 ký tự.
  - Tập trung kết hợp ngẫu nhiên các yếu tố:
    + Đánh vào thị giác & Cảm xúc.
    + Ngôn ngữ của "Người thật việc thật", gần gũi, đời thường.
    + Tính thúc giục (Scarcity & Urgency).
    + Kỹ thuật "Cảnh báo/Vấn đề".
    + Kỹ thuật "Cực đoan hóa" cảm xúc hoặc tình huống.
    + Cụ thể hóa cảm giác (mùi vị, xúc giác, cảm nhận thực tế).
    + Xác thực xã hội (Social Proof) nhưng KHÔNG nhắc đến con số cụ thể.
    + Khớp nối bối cảnh sử dụng thực tế.
    + Xóa bỏ rào cản mua hàng.
  - CẤM (NEGATIVE CONSTRAINTS):
    + KHÔNG dùng từ "nhất".
    + KHÔNG khẳng định tuyệt đối.
    + KHÔNG so sánh về giá.
  `;

  const productList = products.map(p => `- ID ${p.id}: Sản phẩm "${p.name}", USP: "${p.usp}"`).join('\n');

  const prompt = `Bạn là chuyên gia content Shopee chuyên nghiệp chuyên tạo video viral. 
  Nhiệm vụ: Tạo 4 kịch bản khác nhau cho mỗi sản phẩm (mỗi kịch bản dài 8 giây).
  
  DANH SÁCH SẢN PHẨM:
  ${productList}
  
  CẤU TRÚC MỖI SẢN PHẨM:
  - v1, v2, v3, v4: 4 kịch bản độc lập, khác nhau hoàn toàn về cách tiếp cận.
  
  ${scriptRules}
 
  YÊU CẦU ĐỘ DÀI (QUAN TRỌNG):
  - Mỗi phần (v1, v2, v3, v4) PHẢI nằm trong khoảng 160-180 ký tự.
  
  NỘI DUNG CHUNG:
  - Nhân vật: ${persona}, Giới tính ${gender}, Đặc điểm giọng nói & Văn phong: ${voiceDetail}.
  - Bối cảnh: ${context}.
  - XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" xuyên suốt.
  - Ngôn ngữ trẻ trung, thu hút, đánh thẳng vào USP.
  - Ngôn ngữ đầu ra: ${targetLang} (100% chính xác ngữ pháp và chính tả).
  
  Trả về JSON là một mảng các đối tượng:
  [
    { "id": 1, "v1": "...", "v2": "...", "v3": "...", "v4": "..." },
    ...
  ]`;

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
              id: { type: Type.INTEGER },
              v1: { type: Type.STRING },
              v2: { type: Type.STRING },
              v3: { type: Type.STRING },
              v4: { type: Type.STRING }
            },
            required: ["id", "v1", "v2", "v3", "v4"]
          }
        }
      }
    });
    
    const results = JSON.parse(cleanJsonResponse(response.text || '[]'));
    return results.map((r: any) => ({
      id: r.id,
      script: { v1: r.v1, v2: r.v2, v3: r.v3, v4: r.v4 }
    }));
  }).catch((error) => {
    console.error("Bulk script error:", error);
    return [];
  });
};

export const generateShopee8sImage = async (
  imageParts: any[], 
  productName: string, 
  scriptPart: string, 
  charDesc: string,
  facePart: any | null,
  outfitPart: any | null = null,
  isFollowUp: boolean = false,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  gender: string = 'Nữ',
  language: string = 'vi',
  visualFormat: string = ''
): Promise<string> => {
  const ai = getAiClient('image');
  const is3D = imageStyle === '3D';
  const { persona, context } = getPersonaContext(language);
  
  let faceFidelityRule = facePart 
    ? `IDENTITY MANDATE: You MUST use the EXACT facial features, hair, and look from the provided FACE_REFERENCE image. 1:1 match.
       CRITICAL: DO NOT use the face of any person found in the product images. ONLY use the FACE_REFERENCE for the character's head.`
    : `SUBJECT: Adult ${persona}. Gender: ${gender}. ${charDesc}`;

  if (visualFormat === 'Có xuât hiện tay (chỉ bàn tay)') {
    faceFidelityRule = `VISUAL FORMAT: ONLY SHOW HANDS. The character's face and body must NOT be visible. Focus entirely on the hands interacting with the product. Close-up shot of hands.`;
  }

  const outfitRule = outfitPart
    ? `OUTFIT MANDATE: The character MUST wear the EXACT outfit shown in the OUTFIT_REFERENCE image. 
       Maintain 100% consistency in colors, patterns, and style of the clothing.`
    : "";

  const baseStyle = is3D 
    ? "High-quality 3D Animation Pixar/Disney style, vibrant colors, expressive 3D character design, polished CGI, masterpiece."
    : "Photorealistic high-end commercial RAW PHOTO, 8k resolution, cinematic lighting, authentic skin textures.";

  const visualRules = `
    CRITICAL VISUAL RULES (STRICT NO-TEXT POLICY):
    1. ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO CHARACTERS.
    2. The background must be CLEAN and FREE of signage, posters, labels, or written words.
    3. If the context implies a sign, leave it BLANK or Abstract.
    4. NO UI elements, NO speech bubbles, NO watermarks, NO subtitles.
    5. The image must be purely visual storytelling.
    6. ABSOLUTELY NO ICONS, NO GRAPHICS, NO EMOJIS, NO VISUAL EFFECTS, NO OVERLAYS.
    7. Do NOT simulate TikTok UI or video editing effects. It must look like a RAW PHOTO.
    8. If the context refers to a screen, display a random image that does not contain any logos.
    9. Absolutely do not divide the photo into multiple frames.
    10. Maintain consistent product size across all scenes.
    
    CRITICAL RESTRICTIONS & RULES: 
    1. NO CHILDREN, NO KIDS, NO BABIES. The subject must be an adult.
    2. ${is3D ? "Must look like high-quality 3D CGI." : "Must look like a real photo."}
    
    STRICT PRODUCT FIDELITY (MANDATORY - TUYỆT ĐỐI):
       - The product "${productName}" MUST MATCH the input reference image 1:1.
       - PRESERVE PATTERNS & TEXTURES: Any pattern (họa tiết), logo, or design on the product surface must be preserved.
       - PRESERVE DIMENSIONS: Do not resize or distort the product logic.
       - DO NOT change shape, proportions, or physical parts.
       - LOCK the product appearance exactly to the original photo provided.
       - If it's adult fashion, it must be worn, and the reference image must be 100% identical to the sample product.
       - If it's children's fashion, it must still be held in the hand.
  `;

  const consistencyRule = isFollowUp 
    ? "CRITICAL: Maintain ABSOLUTE consistency in character appearance, outfit, and background environment as the previous scene."
    : "Establish a clear character appearance and background setting.";

  const prompt = `
    STYLE: ${baseStyle} 
    RATIO: 9:16 aspect ratio.
    ${faceFidelityRule}
    ${outfitRule}
    ${visualRules}
    ${consistencyRule}
    SCENE: Action/Scenario: ${scriptPart}. Additional Character Note: ${charDesc}.
  `;
  
  const contents: any[] = [{ text: prompt }];
  if (facePart) {
    contents.push({ text: "FACE_REFERENCE:" });
    contents.push({ inlineData: facePart });
  }
  if (outfitPart) {
    contents.push({ text: "OUTFIT_REFERENCE:" });
    contents.push({ inlineData: outfitPart });
  }
  if (imageParts.length > 0) {
    contents.push({ text: "PRODUCT_REFERENCE:" });
    contents.push({ inlineData: imageParts[0] });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (error) { throw error; }
};

export const generateShopee8sImagePrompt = async (
  productName: string,
  scriptPart: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  gender: string,
  voice: string,
  backgroundNote: string = "",
  visualNote: string = "",
  userCustomPrompt: string | undefined = "",
  poseLabel: string = "",
  isNoProductRequested: boolean = false,
  language: string = 'vi',
  visualFormat: string = ''
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const targetLang = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);
  const baseStyle = is3D ? "Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, CGI tinh xảo, màu sắc rực rỡ" : "Ảnh chụp RAW PHOTO chân thực, 8k, ánh sáng tự nhiên mang tính điện ảnh";

  let subjectDescription = `${persona} adult ${gender}. Detailed description of appearance and outfit suitable for short review videos.`;
  let visualComposition = visualNote;

  if (visualFormat === 'Có xuât hiện tay (chỉ bàn tay)') {
    subjectDescription = `Only the character's hands are visible. The face and body are completely out of frame. Focus on the hands interacting with the product.`;
    visualComposition = `Close-up shot focusing on hands. ${visualNote}`;
  }

  const productInteractionRule = isNoProductRequested
    ? `ABSOLUTELY NO appearance of the product "${productName}". Character performs actions according to the script "${scriptPart}".`
    : `Extremely detailed description of how the character holds/uses "${productName}", matching the script "${scriptPart}". The product must maintain realistic size and be fixed relative to the character.`;

  const instructionText = `
    Mission: Write an extremely detailed Prompt in English to create high-quality (8k) AI images for SHOPEE 8S videos.
    
    CRITICAL VISUAL RULES:
    1. ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO CHARACTERS.
    2. NO UI elements, NO speech bubbles, NO watermarks, NO subtitles, NO EMOJI.
    3. FRAMING: Character occupies 3/4 of the vertical frame.
    
    PROMPT STRUCTURE:
    - [Style & Lighting]: ${baseStyle}.
    - [Subject Description]: ${subjectDescription}
    - [Subject Interaction/Action]: ${poseLabel ? `Pose: "${poseLabel}". ` : ""}${productInteractionRule}
    - [Environment]: Background closely follows "${backgroundNote || context || 'studio or natural setting'}".
    - [Visual Rules]: ${visualComposition ? `VISUAL COMPOSITION: ${visualComposition}.` : ""}
    
    OUTPUT REQUIREMENT:
    - Return ONLY a single English paragraph describing the entire scene, character, outfit, action, and background in extreme detail.
    - NO titles, NO explanations, NO line breaks.
    - Smoothly combine the above requirements into a complete, detailed, and vivid prompt.
    ${userCustomPrompt ? `- MAXIMUM PRIORITY FOR ACTION/LAYOUT DESCRIPTION ACCORDING TO THIS NOTE: "${userCustomPrompt}"` : ""}
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: instructionText }] }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error: any) => {
    console.error("Lỗi tạo prompt ảnh Shopee 8s:", error);
    return "Lỗi tạo prompt ảnh.";
  });
};

export const generateShopee8sVeoPrompt = async (
  productName: string, 
  scriptText: string, 
  gender: string, 
  voice: string,
  productImageBase64?: string,
  generatedImageBase64?: string,
  isNoProductRequested: boolean = false,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const targetLang = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Nữ' : 'Nam';
  
  const productInteractionRule = isNoProductRequested
    ? `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - TUYỆT ĐỐI KHÔNG xuất hiện sản phẩm "${productName}".
      - Cách nhân vật di chuyển, nói chuyện và tương tác phù hợp với kịch bản: "${scriptText}".`
    : `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - Nhân vật đang cầm trên tay sản phẩm "${productName}".
      - Cách nhân vật di chuyển, nói chuyện và tương tác phù hợp với kịch bản: "${scriptText}".
      - [SẢN PHẨM PHẢI GIỐNG ẢNH THAM CHIẾU 100%, KHÔNG BIẾN DẠNG]`

  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết bằng ${targetLang} để tạo video AI (VEO-3) dài 8 giây cho video Shopee Affiliate.
  PHONG CÁCH VIDEO: ${is3D ? "Hoạt hình 3D / Phong cách CGI" : "Ảnh chụp thực tế / Phong cách đời thực"}.
  !!! QUY TẮC TRUNG THỰC QUAN TRỌNG !!!: Duy trì sự nhất quán 100% về khuôn mặt, tóc và TRANG PHỤC với các hình ảnh tham chiếu được cung cấp. Nhân vật phải mặc CHÍNH XÁC cùng một bộ quần áo như được hiển thị trong khung hình bắt đầu.

!!! CRITICAL RULE: ONE CONTINUOUS SHOT (QUAN TRỌNG: MỘT CÚ MÁY LIỀN MẠCH) !!!
  - Video phải là một cảnh quay liên tục (Single Take).
  - TUYỆT ĐỐI KHÔNG CẮT CẢNH (NO CUTS).
  - TUYỆT ĐỐI KHÔNG CHUYỂN CẢNH (NO SCENE TRANSITIONS).
  - Duy trì 100% sự nhất quán về khuôn mặt, tóc và trang phục với hình ảnh tham chiếu.

  CẤU TRÚC LỜI NHẮC:
  PHẦN 1: NHÂN VẬT & DIỆN MẠO (BẮT BUỘC NHẤT QUÁN). Mô tả nhân vật (${persona}), trang phục và khuôn mặt y hệt ảnh tham chiếu.
  ${productInteractionRule}
  PHẦN 3: BỐI CẢNH & ÁNH SÁNG. Không gian đồng nhất với bối cảnh ảnh tham chiếu (${context}).
  PHẦF 4: CHUYỂN ĐỘNG MÁY ẢNH (9:16). Chuyển động chậm (slow motion) vào nhân vật hoặc sản phẩm. Tuyệt đối không thay đổi bối cảnh, nhân vật và trang phục trong suốt 8 giây.
  PHẦN 5: LỜI THOẠI (DÙNG CHO ĐỒNG BỘ GIỌNG NÓI CHI TIẾT): 
  - GIỚI TÍNH: ${voiceGender}.
  - NHÃN GIỌNG NÓI: "${voice}".
  - ĐẶC ĐIỂM CHI TIẾT (VÙNG MIỀN & ĐỘ TUỔI): "${voiceDetail}".
  - NỘI DUNG LỜI THOẠI: "${scriptText}"
  => Yêu cầu: Khớp môi (Lip-sync) hoàn hảo và biểu cảm khuôn mặt cực kỳ tự nhiên theo ngữ điệu vùng miền được chỉ định.
  PHẦN 6: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Không có nhạc nền, Không hiệu ứng chuyển cảnh, không chèn chữ hay icon trong suốt 8s.

  YÊU CẦU: Trả về 1 đoạn văn bản Tiếng Anh duy nhất mô tả chi tiết toàn bộ video. Không xuống dòng.`;

  const contents: any[] = [{ text: instructionPrompt }];
  if (productImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: productImageBase64.split(',')[1] || productImageBase64 } });
  }
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });
  }

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim() || "";
  }).catch((error) => {
    console.error("Lỗi tạo lời nhắc video Shopee 8s:", error);
    return "Lỗi khi tạo lời nhắc video.";
  });
};
