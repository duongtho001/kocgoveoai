
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

/**
 * Nhiệm vụ: Tách đôi chân trần từ ảnh tham chiếu, loại bỏ giày dép.
 * Giữ lại chi tiết hình xăm, sơn móng chân trên nền trắng.
 */
export const extractFootImage = async (footPart: any): Promise<string> => {
  const ai = getAiClient('image');
  const prompt = `
    TASK: Create a professional commercial photography shot of ONLY the human legs and feet.
    1. REMOVE all footwear: no shoes, no sandals, no socks. The feet MUST be completely bare.
    2. POSE: Straight standing posture, front view facing the camera directly.
    3. FIDELITY: Maintain the exact skin tone, anatomy, and special details like toenail polish and tattoos from the reference image.
    4. BACKGROUND: Pure white background (#FFFFFF).
    5. QUALITY: High resolution, 8k, sharp textures, clean edges, photorealistic.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: [{ text: prompt }, { inlineData: footPart }] }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part) throw new Error("Fail");
    return `data:image/png;base64,${part.inlineData.data}`;
  } catch (error) {
    console.error("Error extracting foot image:", error);
    throw error;
  }
};

const FORBIDDEN_TERMS = `Facebook, Shopee, Lazada, Tiki, Zalo, QR, Sale sốc, Mua ngay, Cam kết.`;

const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "Northern Vietnamese (Hanoi) accent, energetic, fast-paced, cheerful, youthful vibe",
    "Giọng Nam 20-40 tuổi": "Southern Vietnamese (Saigon) accent, energetic, fast-paced, cheerful, youthful vibe",
    "Giọng Bắc 50-60 tuổi": "Northern Vietnamese accent, resonant, stable, authoritative",
    "Giọng Nam 50-60 tuổi": "Southern Vietnamese accent, resonant, stable, authoritative",
    "Giọng Bắc 60-80 tuổi": "Northern Vietnamese accent, raspy, hearty, rustic",
    "Giọng Nam 60-80 tuổi": "Southern Vietnamese accent, raspy, hearty, rustic"
  };
  return mapping[voiceLabel] || voiceLabel;
};

export const generateNonFaceScript = async (
  imageParts: any[], productName: string, keyword: string, scriptLayout: string, 
  gender: string, voice: string, addressing: string, sceneCount: number, targetAudience: string,
  language: string = 'vi'
): Promise<ScriptParts> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const { persona, context } = getPersonaContext(language);
  const languageLabel = getLanguageLabel(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Persona: ${persona}. Context: ${context}.
    Bạn là chuyên gia marketing Giày dép. Hãy tạo kịch bản Voice-over bằng ${languageLabel} cho sản phẩm "${productName}". 
    USP: "${keyword}". Layout: "${scriptLayout}". 
    Đặc điểm giọng đọc: ${voice} (${voiceDetail}). Tệp khách hàng: "${targetAudience || 'Đại chúng'}".
    
    YÊU CẦU: Chia thành đúng ${sceneCount} phần (v1..v${sceneCount}).
    ${lengthInstruction}
    XƯNG HÔ: "${addressing}".
    Tập trung vào cảm giác đi êm chân, form dáng đẹp, phối đồ sang xịn.
    Không dùng từ cấm: ${FORBIDDEN_TERMS}
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
    console.error("Lỗi tạo kịch bản Non-Face 2:", e);
    return {};
  });
};

export const regenerateNonFaceScriptPart = async (
  imageParts: any[], productName: string, keyword: string, scriptPartKey: string,
  currentPartContent: string, fullScript: ScriptParts, gender: string, voice: string,
  addressing: string, targetAudience: string = "", language: string = 'vi'
): Promise<string> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const personaContext = getPersonaContext(language);
  const languageLabel = getLanguageLabel(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    ${personaContext}
    Viết lại lời thoại TikTok bằng ${languageLabel} cho giày "${productName}". 
    Nội dung cũ: "${currentPartContent}". 
    Tệp khách hàng: "${targetAudience}". 
    Xưng hô: "${addressing}". 
    Giọng: ${voiceDetail}. 
    ${lengthInstruction}
    Chỉ trả về text mới.
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
    console.error("Lỗi tạo lại một phần kịch bản Non-Face 2:", error);
    return currentPartContent;
  });
};

export const generateNonFace2ImagePrompt = async (
  productName: string,
  scriptPart: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  displayMode: string,
  visualNote: string = "",
  productParts: any[] = [],
  userCustomPrompt: string | undefined = "",
  poseLabel: string = "",
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const baseStyle = is3D ? "Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, CGI tinh xảo, màu sắc rực rỡ" : "Ảnh chụp sản phẩm thương mại RAW PHOTO, Still Life chuyên nghiệp, 8k, ánh sáng studio điện ảnh";
  const languageLabel = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);

  const interactionInstruction = (displayMode === 'on_foot' || displayMode === 'close_up_foot')
    ? "BẮT BUỘC: Hiển thị đôi chân người đang đi đôi giày/dép một cách tự nhiên. Tập trung cận cảnh vào đôi chân và sản phẩm."
    : displayMode === 'beside_foot'
    ? "BẮT BUỘC: Sản phẩm đặt trên sàn, ngay cạnh đôi chân trần hoặc đang đi tất. Tập trung cận cảnh vào sản phẩm và đôi chân."
    : "!!! QUY TẮC NGHIÊM NGẶT: TUYỆT ĐỐI KHÔNG CÓ NGƯỜI, KHÔNG CÓ CHÂN, KHÔNG CÓ BẤT KỲ BỘ PHẬN CƠ THỂ NÀO !!!";

  const instructionText = `
    Persona: ${persona}. Context: ${context}.
    Nhiệm vụ: Viết một lời nhắc (Prompt) cực kỳ chi tiết bằng ${languageLabel} để tạo hình ảnh AI chất lượng cao (8k) tập trung vào SẢN PHẨM GIÀY/DÉP.
    Sản phẩm chính: "${productName}".
    
    !!! QUY TẮC PHÂN TÍCH THAM CHIẾU (BẮT BUỘC) !!!
    ${productParts.length > 0 ? `TỆP ĐÍNH KÈM SẢN PHẨM: Mô tả cực kỳ chi tiết về "${productName}" (hình dáng, nhãn hiệu, màu sắc, vật liệu) từ ảnh mẫu để đảm bảo độ nhận diện 100%.` : `Mô tả cực kỳ chi tiết về "${productName}".`}
    
    ${interactionInstruction}
    
    QUY TẮC THỊ GIÁC QUAN TRỌNG:
    1. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ.
    2. KHÔNG có các yếu diện người dùng (UI), KHÔNG bong bóng thoại, KHÔNG dấu mờ (watermark), KHÔNG phụ đề, KHÔNG EMOJI.
    3. TỶ LỆ SẢN PHẨM: Sản phẩm "${productName}" PHẢI duy trì kích thước thực tế, không bị biến dạng.
    
    CẤU TRÚC PROMPT:
    - [Style & Lighting]: ${baseStyle}.
    - [Product Description]: Mô tả cực kỳ chi tiết sản phẩm từ TỆP ĐÍNH KÈM SẢN PHẨM (nếu có).
    - [Product Interaction/Display]: ${poseLabel ? `Sản phẩm được hiển thị theo kiểu: "${poseLabel}". ` : ""}Cực kỳ chi tiết cách sản phẩm được đặt hoặc tương tác (nếu có chân), phù hợp kịch bản "${scriptPart}".
    - [Environment]: Bối cảnh chuyên nghiệp, tôn lên vẻ đẹp của sản phẩm.
    - [Visual Rules]: ${visualNote ? `BỐ CỤC THỊ GIÁC: ${visualNote}.` : ""}
    
    YÊU CẦU ĐẦU RA:
    - Trả về DUY NHẤT một đoạn văn bản bằng ${languageLabel} mô tả cực kỳ chi tiết toàn bộ khung cảnh, sản phẩm, và bối cảnh.
    - KHÔNG có tiêu đề, KHÔNG giải thích, KHÔNG xuống dòng.
    - Kết hợp mượt mà các yêu cầu trên thành một đoạn prompt hoàn chỉnh, chi tiết và sống động.
    ${userCustomPrompt ? `- ƯU TIÊN TỐI ĐA MÔ TẢ HÀNH ĐỘNG/BỐ TRÍ THEO GHI CHÚ NÀY: "${userCustomPrompt}"` : ""}
  `;

  const contents: any[] = [{ text: instructionText }];
  if (productParts.length > 0) {
    contents.push({ text: "TỆP ĐÍNH KÈM SẢN PHẨM:" });
    productParts.forEach(p => contents.push({ inlineData: p }));
  }

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error: any) => {
    console.error("Lỗi tạo prompt ảnh Non-Face 2:", error);
    if (error.message?.includes("429")) {
      throw new Error("Lỗi tạo prompt ảnh AI:\n{\"error\":{\"code\":429,\"message\":\"Resource has been exhausted (e.g. check quota).\",\"status\":\"RESOURCE_EXHAUSTED\"}}");
    }
    return "Lỗi tạo prompt ảnh.";
  });
};

export const generateFootwearImage = async (
  referenceImageParts: any[], 
  footReferencePart: any | null,
  productName: string,
  scriptPart: string, 
  userCustomPrompt: string | undefined, 
  imageStyle: 'Realistic' | '3D' = 'Realistic', 
  displayMode: 'no_foot' | 'beside_foot' | 'on_foot' | 'close_up_foot' = 'on_foot',
  backgroundNote: string = "",
  visualNote: string = "",
  backgroundReferencePart: any | null = null,
  productAngle: string = "",
  poseLabel: string = "",
  footDescription: string = "",
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('image');
  const is3D = imageStyle === '3D';
  const languageLabel = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);
  
  const baseStyle = is3D 
    ? "High-quality 3D Animation, Pixar character style, polished CGI, vibrant colors." 
    : "Ultra-realistic raw commercial photography, 8k resolution, cinematic lighting, sharp focus on footwear textures.";

  let specificEnvironment = backgroundNote || "High-end fashion retail store or modern home interior";
  let specificComposition = productAngle || "Eye-level professional footwear shot";

  if (poseLabel.includes("Sky View")) {
    specificEnvironment = "Clear blue sky with soft white clouds as the background. Low angle shot looking straight up.";
    specificComposition = "Extreme low angle view. The soles of the shoes are the main focus against the vast sky.";
  } else if (poseLabel.includes("POV Pavement") || poseLabel.includes("concrete")) {
    specificEnvironment = "Clean urban pavement or concrete ground with natural texture. Daylight.";
    specificComposition = "POV perspective, looking directly down at the feet from the wearer's point of view.";
  } else if (poseLabel.includes("Grass")) {
    specificEnvironment = "Lush green artificial grass or natural garden lawn. Soft sunlight.";
    specificComposition = "Low angle or eye-level sitting position on the grass.";
  } else if (poseLabel.includes("Toe close-up")) {
    specificComposition = "Extreme close-up on the front toe box of the shoe. Sharp focus on material texture and stitching.";
  } else if (poseLabel.includes("Side close-up")) {
    specificComposition = "Extreme close-up on the side profile of the shoe. Focus on the logo, material, and overall shape.";
  } else if (poseLabel.includes("Sole texture")) {
    specificComposition = "Extreme close-up on the bottom sole of the shoe. Show the grip pattern and material texture clearly.";
  } else if (poseLabel.includes("Top-down")) {
    specificComposition = "Direct top-down flat lay view of the shoes. Perfect symmetry.";
  } else if (poseLabel.includes("Heel close-up")) {
    specificComposition = "Extreme close-up on the back heel of the shoe. Sharp focus on the heel counter and sole edge.";
  }

  const physicsRules = `
    !!! CRITICAL PHYSICAL REALISM (MANDATORY) !!!:
    1. FLOOR CONTACT: The feet and shoes MUST be firmly planted on the ground surface. Use realistic "contact shadows" where the sole meets the floor.
    2. GRAVITY: Show natural weight distribution. If the person is standing, the heels and soles must look pressed against the floor.
    3. NO FLOATING: Absolutely no floating shoes or hovering feet. Everything must be grounded.
    4. ANATOMY: The connection between the legs, ankles, and feet must be anatomically correct.
    5. SKIN TEXTURE: Natural human skin texture for legs, with subtle micro-folds at the joints.
  `;

  const footIdentity = `
    FOOT CHARACTERISTICS: ${footDescription || "Clean, realistic human legs and feet"}. 
    ${footReferencePart ? "MANDATORY: Use foot structure and characteristics from the attached FOOT_REFERENCE image." : ""}
  `;

  let interactionRule = "";
  if (displayMode === 'on_foot' || displayMode === 'close_up_foot') {
    interactionRule = `MANDATORY: A person is WEARING the ${productName} on their feet. Show the natural interaction between the skin and the shoe material.`;
    if (displayMode === 'close_up_foot') interactionRule += " Focus on an extreme close-up of the feet and shoes.";
  } else if (displayMode === 'beside_foot') {
    interactionRule = `Show the ${productName} placed neatly on the floor directly NEXT TO the person's feet.`;
  } else {
    interactionRule = "!!! STRICT RULE: PRODUCT ONLY. NO PEOPLE, NO FEET, NO LEGS. Show the shoes on a realistic surface.";
  }

  const visualRules = `
    - PRODUCT FIDELITY: The ${productName} MUST be 100% identical to the reference product images. Preserve patterns and materials.
    - NO TEXT: Strictly no text, labels, or watermarks.
    - COMPOSITION: ${specificComposition}.
    - POSE: ${poseLabel || "Natural stance"}.
  `;

  const prompt = `
    Persona: ${persona}. Context: ${context}.
    ${baseStyle} Aspect ratio 9:16.
    ${physicsRules}
    ${footIdentity}
    ${interactionRule}
    ${visualRules}
    ENVIRONMENT: ${backgroundReferencePart ? "Use background from BACKGROUND_REFERENCE." : specificEnvironment}.
    SCENE CONTEXT: "${scriptPart}". 
    ${visualNote ? `LAYOUT: ${visualNote}.` : ""}
    ${userCustomPrompt || ""}
  `;
  
  const contents: any[] = [{ text: prompt }];

  // Helper function to clean base64 data
  const cleanData = (part: any) => ({
    inlineData: {
      mimeType: part.mimeType,
      data: part.data.includes('base64,') ? part.data.split('base64,')[1] : part.data
    }
  });

  if (backgroundReferencePart) {
    contents.push({ text: "BACKGROUND_REFERENCE:" });
    contents.push(cleanData(backgroundReferencePart));
  }
  
  if (footReferencePart) {
    contents.push({ text: "FOOT_REFERENCE:" });
    contents.push(cleanData(footReferencePart));
  }

  if (referenceImageParts && referenceImageParts.length > 0) {
    contents.push({ text: "PRODUCT_REFERENCE_IMAGES:" });
    referenceImageParts.forEach(part => contents.push(cleanData(part)));
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part) throw new Error("API did not return image data");
    return `data:image/png;base64,${part.inlineData.data}`;
  } catch (error) { 
    console.error("Error in generateFootwearImage:", error);
    throw error; 
  }
};

export const generateFootwearVeoPrompt = async (
  productName: string, 
  scriptText: string, 
  gender: string, 
  voice: string,
  displayMode: string,
  productImageData?: string,
  generatedImageBase64?: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  const languageLabel = getLanguageLabel(language);
  const personaContext = getPersonaContext(language);
  
  const interactionInstruction = (displayMode === 'on_foot' || displayMode === 'close_up_foot')
    ? `- Xuất hiện đôi chân đang đi đôi "${productName}" một cách tự nhiên, dồn trọng tâm và bước đi nhanh tự nhiên.`
    : displayMode === 'beside_foot'
    ? `- Sản phẩm "${productName}" đặt trên sàn, ngay cạnh đôi chân trần hoặc đang đi tất.`
    : `!!! TUYỆT ĐỐI KHÔNG CÓ NGƯỜI HAY CHÂN NGƯỜI XUẤT HIỆN TRONG VIDEO !!!`;

  const instructionPrompt = `
  ${personaContext}
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết bằng ${languageLabel} tạo video AI (VEO-3) dài 8 giây tập trung hoàn toàn vào SẢN PHẨM GIÀY DÉP.
  ${interactionInstruction}
  
  CẤU TRÚC PROMPT BẮT BUỘC:
  PHẦN 1: SẢN PHẨM & BỐI CẢNH. Mô tả sản phẩm "${productName}" ở chính giữa khung hình, sắc nét, giữ nguyên tỷ lệ 1:1, không biến dạng. ${is3D ? "3D Pixar Animation style." : "Cinematic Realistic style."} Bối cảnh đồng nhất với ảnh tham chiếu. Đảm bảo đế giày tiếp xúc thực tế với mặt sàn, có bóng đổ tiếp xúc rõ rệt.
  PHẦN 2: Tự sáng tạo hành động tự nhiên như đang ngắm nghía, trải nghiệm sản phẩm.
  PHẦN 3: CHUYỂN ĐỘNG CAMERA (9:16). Dolly in, Pan hoặc Zoom mượt mà vào chi tiết sản phẩm hoặc tracking theo nhân vật. Tuyệt đối không thay đổi bối cảnh và sản phẩm suốt 8s. 
  PHẦN 4: LỜI THOẠI (BẮT BUỘC THAM CHIẾU GIỌNG NÓI & ĐỘ TUỔI): 
  ✨ Model performs Voice-over with specific traits: "${voice}" (Technical specs: ${voiceDetail}). 
  Speaker Gender: ${voiceGender}. 
  Script content: "${scriptText}"

  PHẦN 5: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Cinematic Studio Lighting. 
  Tuyệt đối không có nhạc nền. Khung hình tại giây 8.0 phải giống hệt khung hình tại giây 6.5.
  Video là một cảnh quay liên tục duy nhất từ đầu đến cuối.
  
  YÊU CẦU: Trả về 1 đoạn văn bản bằng Tiếng Anh duy nhất mô tả chi tiết toàn bộ video. Không xuống dòng.`;

  const contents: any[] = [{ text: instructionPrompt }];
  
  const cleanB64 = (b64: string) => b64.includes('base64,') ? b64.split('base64,')[1] : b64;

  if (productImageData) {
    contents.push({ inlineData: { mimeType: 'image/png', data: cleanB64(productImageData) } });
  }
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: cleanB64(generatedImageBase64) } });
  }

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error) => {
    console.error("Lỗi tạo prompt video Non-Face 2:", error);
    return "Error generating footwear video prompt.";
  });
};
