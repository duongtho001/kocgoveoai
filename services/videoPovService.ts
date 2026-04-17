
import { GoogleGenAI, Type } from "@google/genai";
import { getAiClient, callWithAiFallback } from "./keyService";
import { getPersonaContext, getScriptLengthInstruction } from "../utils/languageUtils";

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
 * Phân tích trang phục chi tiết từ ảnh tải lên.
 */
export const describePovOutfit = async (outfitPart: any): Promise<string> => {
  const prompt = `
    Analyze the CLOTHING in this image in extreme detail for an AI image generator.
    !!! CRITICAL PRIVACY & IDENTITY RULE !!!: 
    - Focus ONLY on the garments, fabric, shoes, and accessories. 
    - COMPLETELY IGNORE the person's face, hair, and identity. 
    Return a descriptive technical fashion paragraph in English.
  `;
  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, { inlineData: outfitPart }] }
    });
    return response.text?.trim() || "A stylish outfit.";
  }).catch((error) => {
    console.error("Lỗi phân tích trang phục:", error);
    return "Detailed outfit description.";
  });
};

/**
 * Xử lý ảnh trang phục: Xóa nhân vật và bối cảnh, trả về ảnh trang phục trên nền trắng.
 */
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

/**
 * Phân tích và mở rộng bối cảnh chi tiết từ mô tả văn bản (và ảnh tham chiếu nếu có).
 */
export const analyzeDetailedBackground = async (backgroundNote: string, backgroundPart: any | null): Promise<string> => {
  const prompt = `
    Nhiệm vụ: Phân tích và mở rộng mô tả bối cảnh (background) dưới đây thành một mô tả CỰC KỲ CHI TIẾT, CHUYÊN NGHIỆP và ĐỒNG NHẤT để phục vụ việc tạo ảnh AI.
    
    Mô tả gốc từ người dùng: "${backgroundNote}"
    
    YÊU CẦU PHÂN TÍCH CHI TIẾT (MANDATORY):
    1. Chất liệu & Vật liệu: Mô tả rõ bề mặt (nhám, bóng, gỗ, kim loại, vải...), độ dày mỏng của các vật thể.
    2. Vị trí & Khoảng cách: Xác định rõ vị trí các đồ vật chính, khoảng cách tương đối giữa chúng để tạo chiều sâu không gian.
    3. Màu sắc chính xác: Sử dụng các mã màu hoặc mô tả màu sắc cụ thể (VD: xanh navy đậm, trắng kem, vàng đồng...).
    4. Kiểu dáng & Phong cách: Xác định rõ phong cách kiến trúc/nội thất (VD: Minimalist, Industrial, Vintage, Modern Luxury...).
    5. Chi tiết nhỏ nhất: Ánh sáng (hướng sáng, cường độ), bóng đổ, các vật dụng trang trí nhỏ, họa tiết trên bề mặt.
    
    MỤC TIÊU: Tạo ra một bản mô tả bối cảnh "bất biến" để khi áp dụng vào các cảnh khác nhau, không gian vẫn giữ được sự đồng nhất 100%.
    
    LƯU Ý:
    - Nếu có ảnh tham chiếu, hãy trích xuất mọi chi tiết nhỏ nhất từ ảnh.
    - TUYỆT ĐỐI KHÔNG bao gồm nhân vật hay con người trong mô tả này.
    - KẾT QUẢ TRẢ VỀ: Một đoạn văn duy nhất bằng TIẾNG VIỆT, giàu tính hình ảnh và kỹ thuật.
  `;
  
  const parts: any[] = [{ text: prompt }];
  if (backgroundPart) parts.push({ inlineData: backgroundPart });

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts }
    });
    return response.text?.trim() || backgroundNote;
  }).catch((error) => {
    console.error("Lỗi phân tích bối cảnh:", error);
    return backgroundNote;
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

export const analyzeVideoContent = async (videoFile: File): Promise<string> => {
  const part = await fileToGenerativePart(videoFile);
  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { text: "Phân tích video này cực kỳ chi tiết. Bao gồm: 1. Nội dung kịch bản lời thoại (nếu có). 2. Bối cảnh không gian. 3. Các nhân vật xuất hiện và đặc điểm của họ. 4. Diễn biến hành động chính. Hãy viết bằng tiếng Việt rõ ràng." }, 
          { inlineData: part }
        ] 
      }
    });
    return response.text || "";
  }).catch((error) => {
    console.error("Lỗi phân tích video:", error);
    return "";
  });
};

export const analyzeTextContent = async (text: string): Promise<string> => {
  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { text: `Phân tích kịch bản/nội dung sau đây cực kỳ chi tiết để phục vụ việc tạo video POV. Bao gồm: 1. Nội dung kịch bản chi tiết. 2. Bối cảnh không gian mô tả. 3. Các nhân vật và đặc điểm ngoại hình/tính cách. 4. Các hành động chính diễn ra. Kịch bản gốc: "${text}"` }
        ] 
      }
    });
    return response.text || "";
  }).catch((error) => {
    console.error("Lỗi phân tích văn bản:", error);
    return "";
  });
};

export const generatePovSegments = async (
  analysis: string, 
  style: string, 
  count: number, 
  gender: string, 
  voice: string, 
  addressing: string,
  charDesc: string, 
  contextNote: string,
  language: string = 'vi'
): Promise<string[]> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const { persona, context } = getPersonaContext(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Dựa trên bản phân tích nội dung sau: "${analysis}".
    Hãy tạo ra một kịch bản POV mới hoàn toàn, phong cách: "${style}".
    
    YÊU CẦU VỀ NỘI DUNG KỊCH BẢN (CỰC KỲ QUAN TRỌNG):
    1. Kịch bản CHỈ bao gồm lời thoại (dialogue) hoặc lời dẫn truyện (narration).
    2. TUYỆT ĐỐI KHÔNG mô tả nhân vật vào nội dung kịch bản (ví dụ: KHÔNG viết "Cô gái xinh đẹp nói...", "Mặc áo đỏ...").
    3. TUYỆT ĐỐI KHÔNG mô tả bối cảnh vào nội dung kịch bản (ví dụ: KHÔNG viết "Trong căn phòng...", "Dưới ánh nắng...").
    4. TUYỆT ĐỐI KHÔNG viết các ghi chú hành động hoặc cảm xúc trong ngoặc (ví dụ: KHÔNG viết "(cười)", "(khóc)", "(đi bộ)").
    5. Nội dung kịch bản phải thuần túy là câu nói tự nhiên dựa trên "${analysis}".
    6. XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe) xuyên suốt 100%.
    7. Ngôn ngữ đầu ra: ${language} (100% chính xác ngữ pháp và chính tả).
    8. ${lengthInstruction}

    THÔNG TIN THAM KHẢO (Dùng để định hướng nội dung nhưng KHÔNG viết vào kịch bản):
    - Giới tính nhân vật chính: ${gender}.
    - Đặc điểm giọng nói & Văn phong: ${voiceDetail}.
    - Mô tả nhân vật: ${charDesc || persona}.
    - Ghi chú bối cảnh: ${contextNote || context}.

    YÊU CẦU CẤU TRÚC:
    - Trả về kết quả dưới dạng một mảng JSON các chuỗi ký tự.
    - Số lượng đoạn: ${count}.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: { 
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    
    return JSON.parse(cleanJsonResponse(response.text || '[]'));
  }).catch((e) => {
    console.error("Parse script error", e);
    return [];
  });
};

/**
 * Viết lại một đoạn kịch bản POV cụ thể.
 */
export const regeneratePovSegment = async (
  analysis: string,
  style: string,
  gender: string,
  voice: string,
  addressing: string,
  charDesc: string,
  contextNote: string,
  currentContent: string,
  allSegments: string[],
  language: string = 'vi'
): Promise<string> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const { persona } = getPersonaContext(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Hãy viết lại ĐOẠN kịch bản POV sau đây cho hay hơn và viral hơn.
    Nội dung cũ: "${currentContent}"
    Toàn bộ kịch bản hiện tại để đảm bảo tính liên kết: "${allSegments.join(' ')}"
    
    YÊU CẦU:
    1. Chỉ trả về lời thoại mới.
    2. ${lengthInstruction}
    3. XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe).
    4. Đặc điểm giọng nói & Văn phong: ${voiceDetail}.
    5. Ngôn ngữ đầu ra: ${language} (100% chính xác ngữ pháp và chính tả).
    6. Trả về duy nhất lời thoại mới.
    7. Không thêm mô tả nhân vật hay bối cảnh.
    8. Persona tham khảo: ${persona}.
  `;
  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] }
    });
    return response.text?.trim() || currentContent;
  }).catch((e) => {
    console.error("Lỗi viết lại đoạn kịch bản POV:", e);
    return currentContent;
  });
};

export const generatePovImage = async (
  script: string, 
  facePart: any | null, 
  gender: string, 
  charDesc: string,
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  contextNote: string = "",
  outfitPart: any | null = null,
  poseLabel: string = "",
  backgroundReferencePart: any | null = null,
  imageFormat: string = 'with_koc',
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('image');
  const modelId = "gemini-3.1-flash-image-preview";
  const is3D = imageStyle === '3D';
  const { persona, context } = getPersonaContext(language);
  
  const baseStyle = is3D 
    ? "3D Animation Pixar/Disney style, vibrant colors, expressive 3D character design, polished CGI."
    : "Photorealistic RAW PHOTO, 8k resolution, authentic textures, cinematic lighting.";
    
  let subjectDescription = "";
  if (imageFormat === 'no_character') {
    subjectDescription = "NO CHARACTER. Focus entirely on the environment and atmosphere.";
  } else if (imageFormat === 'hand_only') {
    subjectDescription = `Close-up shot showing ONLY the hands of a ${gender} character. The hands are interacting with the environment or objects. No face or body visible.`;
  } else {
    const faceInstruction = facePart 
      ? "Maintain the exact facial features of the person in the provided face reference image." 
      : `Appearance: Vietnamese ${gender}. ${charDesc || persona}`;
    subjectDescription = `Subject: ${faceInstruction}.`;
  }

  const outfitInstruction = (outfitPart && imageFormat !== 'no_character')
    ? "The character MUST wear the exact outfit shown in the OUTFIT_REFERENCE image. Match the style, fabric, and colors perfectly. IGNORE any text descriptions of clothing or outfit details."
    : (imageFormat === 'with_koc' ? "The character wears an outfit matching the description: " + (charDesc || persona) : "");
  
  const characterFidelityRule = (imageFormat !== 'no_character' && (charDesc || persona)) ? `
    CRITICAL CHARACTER FIDELITY (MANDATORY):
    - You MUST follow these specific appearance details for the character: "${charDesc || persona}".
    - DO NOT deviate from the described age, physique, or personality.
    ${(outfitPart && imageFormat !== 'no_character') ? "- IMPORTANT: IGNORE any clothing descriptions in the text above, prioritize the OUTFIT_REFERENCE image for clothes." : ""}
    - The character must look EXACTLY as described in every detail.
    ${is3D ? "- Translate these details into a cute and stylized 3D character design." : ""}
  ` : "";

  const backgroundRule = backgroundReferencePart 
    ? `CRITICAL BACKGROUND INSTRUCTION (PRIORITY):
       - You MUST place the character in the EXACT environment shown in the BACKGROUND_REFERENCE image.
       - Maintain 100% consistency with the objects, colors, and spatial layout of that background.
       - IGNORE any text descriptions of the background, environment, or context note.`
    : (contextNote || context ? `
    CRITICAL BACKGROUND INSTRUCTION (PRIORITY):
    - You MUST place the character in the following environment: "${contextNote || context}".
    - Strictly adhere to all details, objects, and atmosphere described in this background note.
  ` : "ENVIRONMENT: Natural lifestyle setting appropriate for the scene.");

  const poseInstruction = (poseLabel && imageFormat !== 'no_character') ? `CHARACTER POSE (MANDATORY): The person is ${poseLabel}. Ensure the action and facial expression match this POV pose perfectly.` : "";

  const prompt = `
    ${baseStyle} 9:16 aspect ratio.
    ${subjectDescription}
    ${outfitInstruction}
    ${poseInstruction}
    Action/Scene: "${script}".
    
    ${characterFidelityRule}
    ${backgroundRule}

    CRITICAL VISUAL RULES (STRICT NO-TEXT & NO-UI POLICY):
    1. ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO CHARACTERS.
    2. The background must be CLEAN and FREE of signage, posters, labels, or written words.
    3. If the context implies a screen or sign, leave it BLANK or Abstract.
    4. NO UI elements, NO speech bubbles, NO watermarks, NO subtitles.
    5. The image must be purely visual storytelling.
    6. ABSOLUTELY NO ICONS, NO GRAPHICS, NO EMOJIS, NO VISUAL EFFECTS, NO OVERLAYS.
    7. Do NOT simulate TikTok UI or video editing effects. It must look like a RAW PHOTO.
    
    CRITICAL RESTRICTIONS & RULES: 
    1. NO CHILDREN, NO KIDS, NO BABIES. The subject must be an adult.
    2. ${is3D ? "Must look like high-quality 3D CGI." : "Must look like a real photo."}

    MANDATORY: NO TEXT, NO SUBTITLES, NO OVERLAYS, NO ICONS, NO GRAPHICS, NO EMOJIS, NO VISUAL EFFECT.
    ${regenNote ? `Additional Feedback: ${regenNote}` : ""}
  `;

  const parts: any[] = [{ text: prompt }];
  if (facePart) parts.push({ inlineData: facePart });
  if (outfitPart) parts.push({ inlineData: outfitPart });
  if (backgroundReferencePart) parts.push({ inlineData: backgroundReferencePart });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

export const formatVideoPrompt = async (
  script: string, 
  gender: string, 
  voice: string, 
  charDesc: string, 
  contextNote: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  generatedImageBase64?: string,
  poseLabel: string = "",
  regenNote: string = "",
  imageFormat: string = 'with_koc',
  language: string = 'vi'
): Promise<string> => {
    const is3D = imageStyle === '3D';
    const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
    const { persona, context } = getPersonaContext(language);
    const voiceDetail = getVoiceDetailedInstruction(voice);

    let subjectPrompt = "";
    if (imageFormat === 'no_character') {
      subjectPrompt = "NO CHARACTER visible in the video. Focus entirely on the environment and atmosphere.";
    } else if (imageFormat === 'hand_only') {
      subjectPrompt = `Close-up shot showing ONLY the hands of a ${gender} character. The hands are interacting with the environment or objects. No face or body visible.`;
    } else {
      subjectPrompt = `Character ${persona}, wearing outfit as in the image. ${is3D ? "3D Animation style." : "Realistic style."}`;
    }

    const systemPrompt = `
    Bạn là chuyên gia viết prompt cho AI Video (VEO-3). Nhiệm vụ của bạn là viết một bản mô tả chi tiết để chuyển hóa hình ảnh tĩnh thành video POV sinh động.
    
    NGUYÊN TẮC QUAN TRỌNG (BẮT BUỘC):
    1. MÔ TẢ DỰA TRÊN HÌNH ẢNH THAM CHIẾU: Bạn phải nhìn kỹ ảnh được cung cấp và mô tả lại ĐÚNG nhân vật (trang phục, kiểu tóc, gương mặt) và bối cảnh (vật dụng quanh đó, ánh sáng) đang xuất hiện trong đó.
    2. ƯU TIÊN HÌNH ẢNH: Nếu có hình ảnh tham chiếu, hãy ƯU TIÊN TUYỆT ĐỐI các chi tiết trong ảnh và BỎ QUA các mô tả văn bản về bối cảnh hoặc trang phục nếu chúng mâu thuẫn hoặc khác biệt với ảnh.
    3. KHÔNG TỰ Ý BỊA ĐẶT BỐI CẢNH: Tuyệt đối không thêm thắt các chi tiết bối cảnh lạ lẫm không có trong ảnh.
    4. TƯƠNG THÍCH KỊCH BẢN & HÀNH ĐỘNG: Biểu cảm gương mặt và cử động của nhân vật phải khớp với nội dung kịch bản nói: "${script}" và ghi chú hành động: "${regenNote || poseLabel}".
    5. DUY TRÌ TÍNH NHẤT QUÁN: Đảm bảo nhân vật trong video giống hệt nhân vật trong ảnh.
    6. ĐỊNH DẠNG HÌNH ẢNH: ${imageFormat === 'no_character' ? 'KHÔNG CÓ NHÂN VẬT' : imageFormat === 'hand_only' ? 'CHỈ CÓ TAY' : 'CÓ KOC'}.

    PHONG CÁCH VIDEO: ${is3D ? "3D Animation / CGI Style" : "Photorealistic / Real Life Style"}.

    CẤU TRÚC PHẢI TUÂN THỦ 6 ĐOẠN (VIẾT LIỀM MẠCH TRÊN 1 DÒNG):
    Đoạn 1: Nhân vật & bối cảnh. (${subjectPrompt} Video 9:16).
    Đoạn 2: Hành động & tương tác. (HÃY TỰ SÁNG TẠO: Mô tả chi tiết hành động, cử chỉ tay, biểu cảm khuôn mặt sinh động, tự nhiên dựa trên nội dung lời thoại: "${script}" và ghi chú hành động: "${regenNote || poseLabel}").
    Đoạn 3: Góc quay & chuyển động máy. (HÃY TỰ SÁNG TẠO: Mô tả chuyển động máy quay như Pan, Tilt, Zoom, Dolly hoặc Tracking shot một cách nghệ thuật, tập trung vào nhân vật và hành động đang diễn ra, đảm bảo không làm thay đổi bối cảnh gốc, tạo cảm giác điện ảnh).
    Đoạn 4: Hậu cảnh & đạo cụ. (Mô tả chi tiết các vật thể đang có trong ảnh tham chiếu. Lưu ý bối cảnh/cấm kỵ: ${contextNote || context}).
    Đoạn 5: Lời thoại (QUAN TRỌNG NHẤT): ✨ Model speaks in ${voiceDetail} characteristics (${voiceGender}): "${script}"
    Đoạn 6: Thông số kỹ thuật. (9:16, 4K, ${is3D ? "3D Animation, Masterpiece CGI, 60fps" : "Realistic, Cinematic Lighting, Photorealistic, 60fps"}).

    YÊU CẦU ĐẦU RA: Chỉ trả về 1 dòng Tiếng Anh duy nhất (trừ phần lời thoại).
    `;

    const parts: any[] = [{ text: systemPrompt }];
    if (generatedImageBase64) {
      parts.push({ 
        inlineData: { 
          mimeType: 'image/png', 
          data: generatedImageBase64.split(',')[1] || generatedImageBase64 
        } 
      });
    }

    return callWithAiFallback(async (ai) => {
      const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: { parts }
      });
      return response.text?.trim().replace(/\n/g, ' ') || "";
    }).catch((error) => {
      console.error("Lỗi định dạng prompt video POV:", error);
      return "";
    });
};

/**
 * Tạo prompt tiếng Anh chi tiết cho AI tạo ảnh (Midjourney/Imagen 3).
 */
export const generatePovImagePromptAI = async (
  script: string,
  gender: string,
  charDesc: string,
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  contextNote: string = "",
  poseLabel: string = "",
  imageFormat: string = 'with_koc',
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const { persona, context } = getPersonaContext(language);
  
  let subjectDescription = "";
  if (imageFormat === 'no_character') {
    subjectDescription = "NO CHARACTER. Focus entirely on the environment and atmosphere.";
  } else if (imageFormat === 'hand_only') {
    subjectDescription = `Close-up shot showing ONLY the hands of a ${gender} character. The hands are interacting with the environment or objects. No face or body visible.`;
  } else {
    subjectDescription = `Subject: Vietnamese ${gender}. ${charDesc || persona}.`;
  }

  const prompt = `
    Nhiệm vụ: Viết một prompt tiếng Anh chi tiết để tạo ảnh AI (Midjourney/Imagen 3).
    
    Bối cảnh nhân vật:
    - Định dạng: ${imageFormat}
    - Giới tính: ${gender}
    - Mô tả ngoại hình: ${imageFormat === 'with_koc' ? (charDesc || persona) : 'N/A'}
    - Hành động/Lời thoại: "${script}"
    - Tư thế: ${imageFormat !== 'no_character' ? poseLabel : 'N/A'}
    - Không gian/Bối cảnh: ${contextNote || context}
    - Phong cách: ${imageStyle}
    - Ghi chú thêm (ƯU TIÊN): ${regenNote}
    
    Yêu cầu prompt:
    1. Ngôn ngữ: Tiếng Anh.
    2. Chi tiết về ánh sáng, góc máy, chất liệu.
    3. ${subjectDescription}
    4. Nếu là Realistic: Mô tả như một bức ảnh chụp thật (RAW photo, 8k, cinematic lighting).
    5. Nếu là 3D: Mô tả như phim hoạt hình 3D (Pixar style, Disney style, high-end CGI).
    6. TUYỆT ĐỐI KHÔNG có chữ (No text, no letters).
    7. Tỷ lệ khung hình 9:16.
    
    Chỉ trả về đoạn prompt tiếng Anh duy nhất.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] }
    });
    return response.text?.trim() || "";
  }).catch((error) => {
    console.error("Lỗi tạo prompt ảnh POV:", error);
    return "A detailed AI image prompt.";
  });
};
