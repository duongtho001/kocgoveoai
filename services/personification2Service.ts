
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getAiClient, callWithAiFallback } from "./keyService";
import { AnalyzedCharacter } from "../types";
import { getPersonaContext, getLanguageLabel, getScriptLengthInstruction } from "../utils/languageUtils";

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

const getVoiceDetailedInstruction = (voiceLabel: string, language: string = 'vi') => {
  if (language !== 'vi') {
    return `Giọng nói: ${voiceLabel}. Ngôn ngữ: ${getLanguageLabel(language)}.`;
  }

  const isNorth = voiceLabel.includes("Bắc");
  const dialectInstruction = isNorth ? `
    VĂN PHONG MIỀN BẮC (HÀ NỘI):
    - Sử dụng từ đệm: "nhé", " ạ", " thế", " đấy", " vậy", " vâng", " chứ".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Nam như: nha, nè, nghen, thiệt, hông, vầy.
  ` : `
    VĂN PHONG MIỀN NAM (SÀI GÒN):
    - Sử dụng từ đệm: "nha", " nè", " nghen", " hen", " đó", " vầy", " ha".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Bắc như: nhé, ạ, thế, đấy, chả, vâng.
  `;

  const ageMapping: Record<string, string> = {
    "Giọng miền Bắc 20-40 tuổi": "Độ tuổi 20-40, miền Bắc, năng động, vui vẻ, tông cao.",
    "Giọng miền Nam 20-40 tuổi": "Độ tuổi 20-40, miền Nam, năng động, vui vẻ, tông cao.",
    "Giọng miền Bắc 50-60 tuổi": "Độ tuổi 50-60, miền Bắc, trầm, vang, uy quyền.",
    "Giọng miền Nam 50-60 tuổi": "Độ tuổi 50-60, miền Nam, trầm, vang, uy quyền.",
    "Giọng miền Bắc 60-80 tuổi": "Độ tuổi 60-80, miền Bắc, khàn, hào sảng, chân chất.",
    "Giọng miền Nam 60-80 tuổi": "Độ tuổi 60-80, miền Nam, khàn, hào sảng, chân chất."
  };
  
  return (ageMapping[voiceLabel] || voiceLabel) + "\n" + dialectInstruction;
};

export const analyzePersonDescription = async (desc: string, language: string = 'vi'): Promise<AnalyzedCharacter[]> => {
  const langLabel = getLanguageLabel(language);
  const prompt = `Nhiệm vụ: Phân tích danh sách nhân vật từ mô tả sau: "${desc}".
  YÊU CẦU:
  1. Chỉ xác định số lượng và tên các nhân vật người xuất hiện.
  2. KHÔNG viết mô tả ngoại hình, không viết chi tiết trang phục.
  3. Trả về mảng JSON các đối tượng { "name": "..." }.
  4. Ngôn ngữ phản hồi: ${langLabel}.`;

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
              name: { type: Type.STRING }
            },
            required: ["name"]
          }
        }
      }
    });
    const text = response.text || "[]";
    const data = JSON.parse(cleanJsonResponse(text));
    return data.map((item: any) => ({ name: item.name, description: "" }));
  }).catch((e) => {
    console.error("Lỗi phân tích nhân vật:", e);
    return [{ name: language === 'vi' ? "Nhân vật người" : "Human character", description: "" }];
  });
};

export const splitScriptIntoSegments = async (originalScript: string, voice: string, addressing: string, segmentCount: number, language: string = 'vi'): Promise<string[]> => {
  const voiceDetail = getVoiceDetailedInstruction(voice, language);
  const lengthInstruction = getScriptLengthInstruction(language);
  const { persona, context } = getPersonaContext(language);
  const langLabel = getLanguageLabel(language);
  
  const prompt = `
    Nhiệm vụ: Phân chia kịch bản văn bản dưới đây thành đúng ${segmentCount} đoạn nhỏ để làm video TikTok.
    Kịch bản gốc: "${originalScript}"
    
    YÊU CẦU NGÔN NGỮ & GIỌNG ĐIỆU:
    - Ngôn ngữ: ${langLabel}
    - Đối tượng/Persona: ${persona}
    - Bối cảnh/Context: ${context}
    - Đặc điểm giọng nói: ${voiceDetail}
    - XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe) phù hợp với văn hóa ${langLabel}.
    
    YÊU CẦU KỸ THUẬT QUAN TRỌNG:
    1. Chia thành ĐÚNG ${segmentCount} phần (từ v1 đến v${segmentCount}).
    2. ${lengthInstruction}
    3. Giữ nguyên nội dung và tính mạch lạc, không làm mất ý nghĩa của câu.
    4. Trả về kết quả dưới dạng một mảng JSON các chuỗi ký tự.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return JSON.parse(cleanJsonResponse(response.text || '[]'));
  }).catch((e) => {
    console.error("Lỗi chia kịch bản:", e);
    return [];
  });
};

export const generatePersonifiedImage = async (
  segmentContent: string,
  characterIdea: string,
  gender: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  personDescription: string = "",
  isPersonified: boolean = true,
  speakerName: string = 'Object',
  personParts: any[] = [],
  backgroundNote: string = "",
  productParts: any[] = [],
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('image');
  const isRealisticMode = imageStyle === 'Realistic';
  const { persona, context } = getPersonaContext(language);
  
  const objectPresenceRule = isPersonified 
    ? `THIẾT KẾ VẬT THỂ NHÂN HÓA: Một nhân vật 3D được nhân hóa dựa trên "${characterIdea || 'vật thể'}". Có đôi mắt to, biểu cảm sinh động. Có chân tay nhưng ngắn ngủn bé xíu dễ thương.`
    : `GHI CHÚ BỔ SUNG CHO CẢNH: ${characterIdea}.`;
  
  const contextStyle = isRealisticMode 
    ? `MÔI TRƯỜNG: Ảnh chụp thực tế (Photorealistic), chất lượng 8k, ánh sáng tự nhiên.`
    : `MÔI TRƯỜNG: Hoạt hình 3D Pixar, rực rỡ sắc màu.`;

  const backgroundRule = backgroundNote 
    ? `BỐI CẢNH CHI TIẾT: ${backgroundNote} tại ${context}. Hãy thiết lập không gian này cho toàn bộ khung hình.` 
    : `BỐI CẢNH: ${context}.`;

  const personIdentityRule = personParts.length > 0
    ? `!!! KHÓA DANH TÍNH NHÂN VẬT TUYỆT ĐỐI (STRICT IDENTITY LOCK) !!!: 
       1. Bạn PHẢI sử dụng chính xác khuôn mặt, kiểu tóc, màu tóc và trang phục từ ảnh mẫu "PERSON_REFERENCE" đính kèm. 
       2. Đối chiếu 1:1, không được thay đổi bất kỳ chi tiết ngoại hình nào để đảm bảo nhân vật đồng nhất 100% giữa các cảnh.
       3. Nhân vật là ${persona} (${gender}).
       4. Giữ nguyên kết cấu da người chi tiết (lỗ chân lông, nếp nhăn vi mô) nếu ở chế độ thực tế.`
    : `NHÂN VẬT NGƯỜI: ${persona} (${gender}) và chỉ xuất hiện 1 phần cơ thể đang trong cảnh quay (không lộ mặt).`;

  const productIdentityRule = productParts.length > 0
    ? `!!! KHÓA DANH TÍNH SẢN PHẨM TUYỆT ĐỐI (STRICT PRODUCT FIDELITY) !!!:
       1. Bạn PHẢI sử dụng chính xác hình dáng, màu sắc, logo và nhãn hiệu từ ảnh mẫu "PRODUCT_REFERENCE" đính kèm.
       2. Sản phẩm phải xuất hiện rõ ràng và chân thực trong cảnh quay.`
    : "";

  const actionFidelityRule = `
    !!! QUY TẮC HÀNH ĐỘNG VẬT LÝ TUYỆT ĐỐI (STRICT PHYSICAL ACTION LOCK) !!!:
    1. BẠN PHẢI vẽ nhân vật đang thực hiện chính xác hành động vật lý được mô tả trong lời thoại này: "${segmentContent}".
    2. VÍ DỤ: 
       - Nếu lời thoại là mắng việc "đổ nước lạnh vào nồi", hãy vẽ nhân vật đang cầm bình nước đổ vào nồi, và nhân vật khác đang chỉ tay hoặc có vẻ mặt giận dữ.
       - Nếu lời thoại là "thắng đường", hãy vẽ nhân vật đang đứng bếp, tay cầm muôi khuấy đường trong nồi/chảo nóng.
       - Nếu lời thoại là "khoe sản phẩm", hãy vẽ nhân vật đang giơ sản phẩm lên.
    3. TẠO TƯƠNG TÁC VỚI ĐẠO CỤ: Phải có các đạo cụ liên quan (bếp, nồi, bình nước, thực phẩm...) xuất hiện chân thực.
    4. NHÂN VẬT ${speakerName} là người thực hiện hành động chính hoặc đang có biểu cảm khớp nhất với lời thoại.
  `;

  const prompt = `
    NHIỆM VỤ: Tạo hình ảnh dọc 9:16 cho TikTok thể hiện một phân cảnh hành động thực tế.
    ${actionFidelityRule}
    ${objectPresenceRule}
    ${contextStyle}
    ${backgroundRule}
    ${personIdentityRule}
    ${productIdentityRule}
    
    NỘI DUNG PHÂN CẢNH CỤ THỂ: "${segmentContent}".
    
    !!! QUY TẮC SỐ LƯỢNG NHÂN VẬT TUYỆT ĐỐI !!!:
    ${isPersonified 
      ? "- CHỈ ĐƯỢC PHÉP xuất hiện DUY NHẤT vật thể nhân hóa (The Object). TUYỆT ĐỐI KHÔNG vẽ thêm bất kỳ con người hay nhân vật nào khác." 
      : `- CHỈ ĐƯỢC PHÉP xuất hiện các nhân vật đã được liệt kê cụ thể: ${personDescription}.`
    }
    - TUYỆT ĐỐI KHÔNG được thêm bất kỳ người lạ hay nhân vật phụ nào khác.
    - KHÔNG NHÂN BẢN NHÂN VẬT TRONG CÙNG 1 KHUNG HÌNH.

    HẠN CHẾ KỸ THUẬT:
    - QUAN TRỌNG: Tuyệt đối không chèn bất kỳ chữ viết nào lên ảnh.
    - Bối cảnh SẠCH, không có biển hiệu, không phụ đề, không biểu tượng.
  `;

  const contents: any[] = [{ text: prompt }];
  if (personParts.length > 0) {
    contents.push({ text: "PERSON_REFERENCE_IMAGES (USE THIS FOR FACE, HAIR, AND OUTFIT FIDELITY):" });
    personParts.forEach(p => contents.push({ inlineData: p }));
  }
  if (productParts.length > 0) {
    contents.push({ text: "PRODUCT_REFERENCE_IMAGES (USE THIS FOR PRODUCT FIDELITY):" });
    productParts.forEach(p => contents.push({ inlineData: p }));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (e) {
    console.error("Lỗi tạo ảnh:", e);
    throw e;
  }
};

export const generateVideoPromptV2 = async (
  segmentContent: string,
  characterIdea: string,
  gender: string,
  voice: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  personDescription: string = "",
  isPersonified: boolean = true,
  speakerName: string = 'Object',
  generatedImageBase64?: string,
  language: string = 'vi'
): Promise<string> => {
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  const isRealisticMode = imageStyle === 'Realistic';
  const { persona, context } = getPersonaContext(language);

  const characterRule = isPersonified
    ? `Section 1: CHARACTER & APPEARANCE. Focus SOLELY on the personified object (The Object) from the reference image. ABSOLUTELY NO other human characters are allowed to appear in this scene.`
    : `Section 1: CHARACTER & APPEARANCE. Describe the character exactly matching the reference image. Assign identifiers to human characters in the list "${personDescription}" as Character A, Character B... in order of appearance.`;

  const lipSyncRule = isPersonified
    ? `Section 4: SPEAKING ACTION RULES (STRICT LIP-SYNC RULE): Only the personified object (The Object) is allowed to move its mouth/vocal parts to speak according to the script.`
    : `Section 4: SPEAKING & SILENCE RULES (STRICT LIP-SYNC RULE): 
      - ONLY THE DESIGNATED SPEAKER CHARACTER (Identify Speaker in Section 6) is allowed to move their mouth to speak and lip-sync.
      - ALL OTHER CHARACTERS IN THE SCENE MUST ABSOLUTELY NOT SPEAK, mouths must be tightly closed, NO lip movement. They only act as listeners, can blink or nod slightly but mouth must not open.`;

  const speakerRule = isPersonified
    ? `Section 6: Dialogue: ✨ Identify speaker: The Object. Speaker details: speaks with ${voice} characteristics (${voiceGender}). Dialogue: "${segmentContent}"`
    : `Section 6: Dialogue: ✨ Identify speaker: If the speaker is "${speakerName}" and is a person in the character list, call them exactly "Character A" or "Character B" accordingly. If it is a personified object, call it "The Object". 
      Speaker details: speaks with ${voice} characteristics (${voiceGender}). Dialogue: "${segmentContent}"`;

  const systemPrompt = `
    You are an expert prompt writer for AI Video (VEO-3). 
    MISSION: Transform reference images into 8-second videos expressing precise physical actions according to the dialogue.
    
    !!! ABSOLUTE CONSISTENCY RULE !!!: 
    - Characters and background MUST REMAIN EXACTLY THE SAME AS THE REFERENCE IMAGE.
    - Persona: ${persona}.
    - Context: ${context}.
    
    PROMPT STRUCTURE (1 LINE):
    ${characterRule}
    Section 2: BACKGROUND & LIGHTING. Space consistent with the reference image background.
    Section 3: MAIN PHYSICAL ACTION (CRITICAL). CHARACTER PERFORMS DETAILED PHYSICAL ACTIONS DESCRIBED IN THE SCRIPT: "${segmentContent}". Body, hand, and shoulder movements must interact with objects realistically according to the script "${segmentContent}".
    ${lipSyncRule}
    Section 5: Camera. Gentle Dolly-in or Static shot focusing on hand actions and facial expressions.
    ${speakerRule}
    Section 7: Specs: 9:16, 4K, 60fps, ${isRealisticMode ? 'Realistic' : '3D Animation'}.
 
    REQUIREMENT: Return the prompt in English (except for the dialogue).
  `;

  const contents: any[] = [];
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });
  }
  contents.push({ text: systemPrompt });

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((e) => {
    console.error("Lỗi khi tạo prompt video:", e);
    return "Lỗi khi tạo prompt video.";
  });
};

export const generatePersonification2ImagePromptAI = async (
  segmentContent: string,
  characterIdea: string,
  gender: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  personDescription: string = "",
  isPersonified: boolean = true,
  speakerName: string = 'Object',
  backgroundNote: string = "",
  customPrompt: string = "",
  language: string = 'vi'
): Promise<string> => {
  const isRealisticMode = imageStyle === 'Realistic';
  const { persona, context } = getPersonaContext(language);
  
  const stylePrompt = isRealisticMode 
    ? "Cinematic photorealistic photography, 8k, highly detailed, natural lighting, professional photo, shallow depth of field."
    : "3D Pixar animation style, vibrant colors, polished CGI, masterpiece, soft global illumination.";

  const objectPresenceRule = isPersonified 
    ? `PERSONIFIED OBJECT: A 3D character personified based on "${characterIdea || 'object'}". Large expressive eyes, cute small limbs.`
    : `CONTEXT: ${characterIdea}.`;

  const characterRule = isPersonified 
    ? "ONLY the personified object is allowed. NO humans." 
    : `Characters: ${personDescription}. Only these characters are allowed.`;

  const systemPrompt = `
    You are an expert AI Image Prompt Engineer (Midjourney, DALL-E, Flux). 
    Your task is to create a highly detailed, descriptive English prompt for a TikTok video frame (9:16).
    
    INPUT DATA:
    - Script: "${segmentContent}"
    - Character Idea: "${characterIdea}"
    - Person Description: "${personDescription}"
    - Background: "${backgroundNote}"
    - Style: ${imageStyle}
    - Custom Note: "${customPrompt}"
    - Persona: ${persona}
    - Context: ${context}
    
    RULES:
    1. STYLE: ${stylePrompt}
    2. ACTION: Describe the character performing the EXACT physical action from the script: "${segmentContent}".
    3. CHARACTERS: ${characterRule}
    4. ENVIRONMENT: ${backgroundNote || `A realistic setting in ${context}`}.
    5. NO TEXT: Absolutely no text, words, subtitles, or UI elements in the image.
    6. ASPECT RATIO: 9:16 vertical.
    
    YÊU CẦU: Trả về 1 đoạn prompt Tiếng Anh duy nhất, tập trung vào mô tả thị giác chi tiết (ánh sáng, chất liệu, bố cục, biểu cảm). Không bao gồm bất kỳ lời dẫn nào.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: systemPrompt }] }
    });
    return response.text?.trim() || "";
  }).catch((e) => {
    console.error("Error generating image prompt:", e);
    return "Lỗi khi tạo prompt ảnh.";
  });
};
