
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScriptParts, ScriptPartKey } from "../types";
import { getAiClient, callWithAiFallback } from "./keyService";
import { getScriptLengthInstruction, getPersonaContext, getLanguageLabel } from "../utils/languageUtils";
import * as flowApi from "./flowApiService";

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

/**
 * Làm sạch phản hồi JSON từ mô hình AI bằng cách loại bỏ các thẻ markdown.
 */
const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

/**
 * Chuyển đổi File sang định dạng mà mô hình Generative AI có thể hiểu được.
 */
export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Xử lý ảnh trang phục: Xóa nhân vật và bối cảnh, trả về ảnh trang phục trên nền trắng.
 */
export const extractOutfitImage = async (outfitPart: any): Promise<string> => {
  // Flow API doesn't support outfit extraction — return original data
  if (outfitPart?.data) return `data:image/png;base64,${outfitPart.data}`;
  throw new Error('Outfit extraction requires Gemini API key');
};

const FORBIDDEN_TERMS = `
  Facebook, Shopee, Lazada, Tiki, Zalo, QR, Chuyển khoản, Fanpage, Địa Chỉ, Số điện thoại, Có 1 không 2, giỏ hàng,
  Em đang có, Xem này, Mã giảm sâu, Voucher, Tiktok, dành riêng, ưu đãi, dành riêng, quà tặng, duy nhất, tri ân, nhé, nha, thế chứ.
`;

/**
 * Lấy hướng dẫn chi tiết về giọng đọc dựa trên nhãn lựa chọn.
 */
const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "20-40 tuổi, giọng miền Bắc, năng động, vui vẻ, từ tốn, chậm dãi. Dùng từ: nhé, ạ, thế, chứ. Không dùng: nha, nè, thiệt, hông.",
    "Giọng Nam 20-40 tuổi": "20-40 tuổi, giọng miền Nam, năng động, vui vẻ, từ tốn, chậm dãi. Dùng từ: nha, nè, thiệt, hông. Không dùng: nhé, ạ, thế.",
    "Giọng Bắc 50-60 tuổi": "50-60 tuổi, giọng miền Bắc, giọng trầm, vang, ổn định, uy quyền, đáng tin cậy, hào hứng. Dùng từ: nhé, ạ, thế, chứ.",
    "Giọng Nam 50-60 tuổi": "50-60 tuổi, giọng miền Nam, giọng trầm, vang, ổn định, uy quyền, đáng tin cậy, hào hứng. Dùng từ: nha, nè, thiệt, hông.",
    "Giọng Bắc 60-80 tuổi": "60-80 tuổi, giọng miền Bắc, khàn, hào sảng, chân chất, thực tế. Dùng từ: nhé, ạ, thế, chứ.",
    "Giọng Nam 60-80 tuổi": "60-80 tuổi, giọng miền Nam, khàn, hào sảng, chân chất, thực tế. Dùng từ: nha, nè, thiệt, hông."
  };
  return mapping[voiceLabel] || voiceLabel;
};

/**
 * Tạo kịch bản TikTok với NGUYÊN TẮC CỘNG ĐỒNG nghiêm ngặt.
 */
export const generateKocScript = async (
  imageParts: any[], productName: string, keyword: string, scriptTone: string,
  productSize: string, scriptNote: string, scriptLayout: string, gender: string, voice: string,
  addressing: string,
  sceneCount: number,
  targetAudience: string = "",
  language: string = "vi"
): Promise<ScriptParts> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);

  const targetLang = getLanguageLabel(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Trong vai 1 Creator chuyên tạo video viral hãy tạo kịch bản bán hàng cho "${productName}". USP: "${keyword}". Bố cục (Layout): "${scriptLayout}". 
    ĐỐI TƯỢNG KHÁCH HÀNG MỤC TIÊU: "${targetAudience || 'Mọi người'}". Hãy viết văn phong phù hợp với tệp khách hàng này.
    NHÂN VẬT: Giới tính ${gender}, Đặc điểm giọng nói: ${voiceDetail}.
    NGÔN NGỮ: ${targetLang} (100% chính xác ngữ pháp và chính tả).
    
    YÊU CẦU: Đúng ${sceneCount} phần (v1..v${sceneCount}). KHÔNG nhắc bối cảnh/địa điểm.
    
    !!! QUY TẮC ĐỘ CÀ GIẢI NGHIÊM NGẶT !!!:
    ${lengthInstruction}
    - Phần CTA điều hướng khách hàng mua hàng tại góc trái.
    - Văn phong phải cực kỳ khớp với mô tả giọng nói: ${voiceDetail}.
    
    QUY TẮC XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe). 
    Toàn bộ kịch bản phải tuân thủ đúng cặp xưng hô này một cách tự nhiên và xuyên suốt.
    
    !!! CẢNH BÁO VI PHẠM CỘNG ĐỒNG - TUYỆT ĐỐI KHÔNG SỬ DỤNG CÁC TỪ SAU !!!:
    ${FORBIDDEN_TERMS}
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
    console.error("Lỗi tạo kịch bản KOC 2:", e);
    const fallback: ScriptParts = {};
    for (let i = 1; i <= sceneCount; i++) fallback[`v${i}`] = '';
    return fallback;
  });
};

/**
 * Tạo lại một phần kịch bản cụ thể (v1, v2...)
 */
export const regenerateKocScriptPart = async (
  imageParts: any[], 
  productName: string, 
  keyword: string, 
  scriptPartKey: string,
  currentPartContent: string,
  fullScript: ScriptParts,
  gender: string, 
  voice: string,
  addressing: string,
  layout: string,
  targetAudience: string = "",
  language: string = "vi"
): Promise<string> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);

  const targetLang = getLanguageLabel(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Hãy VIẾT LẠI phần kịch bản "${scriptPartKey}" cho sản phẩm "${productName}".
    Tệp khách hàng mục tiêu: "${targetAudience}".
    Nội dung cũ: "${currentPartContent}".
    Bối cảnh toàn bộ kịch bản: ${JSON.stringify(fullScript)}.
    NGÔN NGỮ: ${targetLang} (100% chính xác ngữ pháp và chính tả).
    
    YÊU CẦU:
    1. Giữ nguyên phong cách và sự logic với các phần khác.
    2. Độ dài bắt buộc: ${lengthInstruction}
    3. Giới tính: ${gender}, Đặc điểm giọng nói: ${voiceDetail}.
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
    console.error("Lỗi tạo lại phần kịch bản KOC 2:", error);
    return currentPartContent;
  });
};

/**
 * Hàm xây dựng prompt cho mô hình Gemini-3-Flash để nó tự xác định các yếu tố kỹ thuật và viết Prompt tạo ảnh.
 */
export const generateKocImagePromptAI = async (
  productName: string,
  scriptPart: string, 
  characterDescription: string, 
  userCustomPrompt: string | undefined, 
  gender: string, 
  voice: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic', 
  backgroundNote: string = "",
  visualNote: string = "",
  poseLabel: string = "",
  imageFormat: string = "",
  productParts: any[] = [],
  facePart: any | null = null,
  outfitPart: any | null = null,
  language: string = "vi"
): Promise<string> => {
  const { persona, context } = getPersonaContext(language);
  
  const is3D = imageStyle === '3D';
  const lifestyleStyle = "Cảnh chụp phong cách sống tự nhiên, tình huống sử dụng hàng ngày, ảnh chụp tự nhiên, ánh sáng tự nhiên mềm mại chân thực, môi trường gần gũi.";
  const baseStyle = is3D 
    ? `Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, mang âm hưởng ${lifestyleStyle}, màu sắc rực rỡ nhưng tự nhiên, nhân vật biểu cảm, kết xuất CGI tinh xảo.`
    : `Ảnh RAW CHÂN THỰC, ${lifestyleStyle}, độ phân giải 8k, kết cấu da chân thực, ánh sáng tự nhiên mang tính điện ảnh nhưng vẫn thực tế.`;

  const skinRealismRule = is3D ? "" : `
    QUY TẮC THỰC TẾ DA QUAN TRỌNG: 
    - Giữ nguyên kết cấu da người chi tiết: thấy rõ lỗ chân lông, các nếp nhăn vi mô tự nhiên và các khuyết điểm thực tế của da.
    - TUYỆT ĐỐI KHÔNG làm mịn quá mức, KHÔNG làm mờ nhân tạo và KHÔNG tạo vẻ ngoài da "nhựa" hoặc giống búp bê.
    - Da phải thể hiện sự tán xạ ánh sáng tự nhiên để đạt độ chân thực tối đa.
  `;

  let identityRule = "";
  let outfitRule = "";
  let formatRule = "";

  if (imageFormat === "no_character") {
    formatRule = `QUY TẮC ĐỊNH DẠNG (BẮT BUỘC): TUYỆT ĐỐI KHÔNG xuất hiện bất kỳ nhân vật, con người, khuôn mặt hay bộ phận cơ thể nào. CHỈ tập trung vào sản phẩm "${productName}".`;
  } else if (imageFormat === "hands_only") {
    formatRule = `QUY TẮC ĐỊNH DẠNG (BẮT BUỘC): CHỈ xuất hiện bàn tay đang cầm hoặc tương tác với sản phẩm. TUYỆT ĐỐI KHÔNG xuất hiện khuôn mặt hay toàn bộ cơ thể nhân vật. Chỉ hiển thị một phần cánh tay và bàn tay.`;
    outfitRule = outfitPart ? `QUY TẮC THAM CHIẾU BÀN TAY: Sử dụng đặc điểm bàn tay (màu da, hình dáng) từ TỆP ĐÍNH KÈM TRANG PHỤC/TAY/CHÂN.` : "";
  } else if (imageFormat === "legs_only") {
    formatRule = `QUY TẮC ĐỊNH DẠNG (BẮT BUỘC): CHỈ hiển thị từ bụng trở xuống (thân dưới), tập trung vào đôi chân đang đi hoặc đứng sử dụng sản phẩm (váy, giày, dép). TUYỆT ĐỐI KHÔNG xuất hiện khuôn mặt hay thân trên.`;
    outfitRule = outfitPart ? `QUY TẮC THAM CHIẾU ĐÔI CHÂN: Sử dụng đặc điểm đôi chân hoặc trang phục thân dưới từ TỆP ĐÍNH KÈM TRANG PHỤC/TAY/CHÂN.` : "";
  } else {
    // with_koc or default
    identityRule = facePart 
      ? `QUY TẮC DANH TÍNH KHUÔN MẶT (BẮT BUỘC): BẠN PHẢI SỬ DỤNG CHÍNH XÁC các đặc điểm khuôn mặt, màu sắc/kiểu tóc, biểu cảm và cấu trúc xương từ hình ảnh TỆP ĐÍNH KÈM KHUÔN MẶT. Khuôn mặt của nhân vật PHẢI lấy 100% chỉ từ TỆP ĐÍNH KÈM KHUÔN MẶT.`
      : `DANH TÍNH: ${persona} trưởng thành ${gender} khớp với mô tả: "${characterDescription}".`;

    outfitRule = outfitPart ? `
      QUY TẮC NHẤT QUÁN TRANG PHỤC (BẮT BUỘC): Nhân vật PHẢI MẶC CHÍNH XÁC CÙNG một loại trang phục được hiển thị trong hình ảnh TỆP ĐÍNH KÈM TRANG PHỤC. GIỮ NGUYÊN 100% màu sắc, hoa văn, kết cấu, chất liệu vải và thiết kế.
    ` : `TRANG PHỤC: Mặc theo phong cách được mô tả: "${characterDescription}".`;
    
    formatRule = `QUY TẮC ĐỊNH DẠNG: Có sự xuất hiện của nhân vật KOC ${gender} tương tác với sản phẩm.`;
  }

  const visualRules = `
    QUY TẮC THỊ GIÁC QUAN TRỌNG:
    1. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ.
    2. KHÔNG có các yếu diện người dùng (UI), KHÔNG bong bóng thoại, KHÔNG dấu mờ (watermark), KHÔNG phụ đề, KHÔNG EMOJI.
    3. KHUNG HÌNH (FRAMING): Mọi hình ảnh PHẢI là "Medium Shot". ${imageFormat !== "no_character" ? "Nhân vật/Bàn tay phải chiếm tỷ lệ hợp lý trong khung hình đứng." : "Sản phẩm phải là tâm điểm của khung hình."}
    4. TỶ LỆ SẢN PHẨM: Sản phẩm "${productName}" PHẢI duy trì kích thước thực tế. Không bị biến dạng.
  `;

  const backgroundRule = `MÔI TRƯỜNG: Đặt cảnh trong một ${backgroundNote || context || 'bối cảnh phong cách sống hàng ngày'} tự nhiên.`;

  const instruction = `
    Nhiệm vụ: Viết một lời nhắc (Prompt) cực kỳ chi tiết bằng Tiếng Việt để tạo hình ảnh AI chất lượng cao (8k) cho sản phẩm "${productName}".
    
    !!! QUY TẮC PHÂN TÍCH THAM CHIẾU (BẮT BUỘC) !!!
    1. TỆP ĐÍNH KÈM KHUÔN MẶT: Quan sát ảnh mẫu để mô tả chính xác đặc điểm khuôn mặt (mắt, mũi, môi), kiểu tóc và biểu cảm của nhân vật ${persona}. (Bỏ qua nếu định dạng là No Character hoặc Hands Only).
    2. TỆP ĐÍNH KÈM TRANG PHỤC/TAY/CHÂN: Mô tả cực kỳ chi tiết trang phục, bàn tay hoặc đôi chân từ ảnh mẫu tùy theo định dạng đã chọn.
    3. TỆP ĐÍNH KÈM SẢN PHẨM: Mô tả cực kỳ chi tiết về "${productName}" (hình dáng, nhãn hiệu, màu sắc, vật liệu, tỷ lệ kích thước sản phẩm) để đảm bảo độ nhận diện 100%.

    !!! QUY TẮC AN TOÀN & CẤM KỴ (TUYỆT ĐỐI TUÂN THỦ) !!!
    KHÔNG sử dụng các từ sau trong prompt:
    - Nhóm nhạy cảm: lingerie, underwear, panties, bra, thong, bikini, swimwear, swimsuit, sheer, see-through, transparent, sweaty, sultry, seductive, erotic, curvy, busty, voluptuous, skin tight.
    - Nhóm trẻ em: child, kid, baby, toddler, minor, underage, teen, schoolgirl, school uniform, lolita. (Thay bằng "adult", "${persona} woman", "${persona} man").
    - Nhóm bạo lực/vũ khí: blood, gory, wound, injury, gun, pistol, weapon, bomb, war, shoot (Thay "shoot" bằng "capture" hoặc "photograph").
    - Nhóm gây hiểu lầm: chest (Thay bằng "upper body"), hot (Thay bằng "sunny" hoặc "vibrant"), spicy, bath, bedroom.

    CẤU TRÚC PROMPT (PHẢI BAO GỒM CÁC QUY TẮC NHƯ KHI TẠO ẢNH TRỰC TIẾP):
    - [Style & Lighting]: ${baseStyle} ${skinRealismRule}
    - [Format Rule]: ${formatRule}
    - [Subject Description]: ${imageFormat === 'with_koc' ? `Adult ${persona} ${gender}, mô tả cực kỳ chi tiết mặt và tóc từ TỆP ĐÍNH KÈM KHUÔN MẶT (nếu có) hoặc theo mô tả: "${characterDescription}". Dáng người cân đối chuyên nghiệp. ${identityRule}` : ""}
    - [Outfit Description]: ${imageFormat !== 'no_character' ? `Mô tả cực kỳ chi tiết từ TỆP ĐÍNH KÈM TRANG PHỤC/TAY/CHÂN (nếu có). ${outfitRule}` : ""}
    - [Product Interaction]: Cực kỳ chi tiết cách ${imageFormat === 'no_character' ? 'sản phẩm được trưng bày' : (imageFormat === 'legs_only' ? 'đôi chân đang đi/sử dụng' : 'nhân vật/bàn tay cầm/sử dụng')} "${productName}", phù hợp kịch bản "${scriptPart}" và tư thế "${poseLabel}". Sản phẩm phải duy trì kích thước thực tế.
    - [Environment]: Bối cảnh bám sát kịch bản và "${backgroundNote}".
    - [Visual Rules]: ${visualRules} ${visualNote ? `BỐ CỤC THỊ GIÁC: ${visualNote}.` : ""}
    
    YÊU CẦU ĐẦU RA:
    - Trả về DUY NHẤT một đoạn văn bản Tiếng Việt mô tả cực kỳ chi tiết toàn bộ khung cảnh, nhân vật, trang phục, sản phẩm, hành động và bối cảnh.
    - KHÔNG có tiêu đề, KHÔNG giải thích, KHÔNG xuống dòng.
    - Kết hợp mượt mà các yêu cầu trên thành một đoạn prompt hoàn chỉnh, chi tiết và sống động.
    ${userCustomPrompt ? `- ƯU TIÊN TỐI ĐA MÔ TẢ HÀNH ĐỘNG/TƯƠNG TÁC THEO GHI CHÚ NÀY: "${userCustomPrompt}"` : ""}
  `;

  const contents: any[] = [{ text: instruction }];
  if (facePart) {
    contents.push({ text: "TỆP ĐÍNH KÈM KHUÔN MẶT:" });
    contents.push({ inlineData: facePart });
  }
  if (outfitPart) {
    contents.push({ text: "TỆP ĐÍNH KÈM TRANG PHỤC:" });
    contents.push({ inlineData: outfitPart });
  }
  if (productParts.length > 0) {
    contents.push({ text: "TỆP ĐÍNH KÈM SẢN PHẨM:" });
    productParts.forEach(p => contents.push({ inlineData: p }));
  }
  contents.push({ text: `INPUT DATA:\nScript: "${scriptPart}"\nUser Note: "${characterDescription}"\nVisual Note: "${visualNote}"\nCustom: "${userCustomPrompt || ''}"` });

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim() || "";
  }).catch((error: any) => {
    console.error("Lỗi tạo prompt ảnh AI 2:", error);
    return "Error generating safety-compliant detailed prompt.";
  });
};

/**
 * Hàm xây dựng prompt cho model hình ảnh dựa trên các tham số đầu vào. (Concatenated Template)
 */
export const constructKocImagePrompt = (
  productName: string,
  scriptPart: string, 
  characterDescription: string, 
  userCustomPrompt: string | undefined, 
  gender: string, 
  imageStyle: 'Realistic' | '3D' = 'Realistic', 
  backgroundNote: string = "",
  visualNote: string = "",
  poseLabel: string = "",
  imageFormat: string = "",
  hasFaceRef: boolean = false,
  hasOutfitRef: boolean = false,
  hasBgRef: boolean = false,
  language: string = "vi"
): string => {
  const { persona, context: langContext } = getPersonaContext(language);
  const is3D = imageStyle === '3D';
  
  const lifestyleStyle = "Cảnh chụp phong cách sống tự nhiên, tình huống sử dụng hàng ngày, ảnh chụp tự nhiên, ánh sáng tự nhiên mềm mại chân thực, môi trường gần gũi.";
  
  const baseStyle = is3D 
    ? `Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, mang âm hưởng ${lifestyleStyle}, màu sắc rực rỡ nhưng tự nhiên, nhân vật biểu cảm, kết xuất CGI tinh xảo.`
    : `Ảnh RAW CHÂN THỰC, ${lifestyleStyle}, độ phân giải 8k, kết cấu da chân thực, ánh sáng tự nhiên mang tính điện ảnh nhưng vẫn thực tế.`;
    
  const skinRealismRule = is3D ? "" : `
    QUY TẮC THỰC TẾ DA QUAN TRỌNG: 
    - Giữ nguyên kết cấu da người chi tiết: thấy rõ lỗ chân lông, các nếp nhăn vi mô tự nhiên và các khuyết điểm thực tế của da.
    - TUYỆT ĐỐI KHÔNG làm mịn quá mức, KHÔNG làm mờ nhân tạo và KHÔNG tạo vẻ ngoài da "nhựa" hoặc giống búp bê.
    - Da phải thể hiện sự tán xạ ánh sáng tự nhiên để đạt độ chân thực tối đa.
  `;

  let identityRule = "";
  let outfitRule = "";
  let formatRule = "";

  if (imageFormat === "no_character") {
    formatRule = `!!! QUY TẮC ĐỊNH DẠNG (BẮT BUỘC) !!!: TUYỆT ĐỐI KHÔNG xuất hiện bất kỳ nhân vật, con người, khuôn mặt hay bộ phận cơ thể nào. CHỈ tập trung vào sản phẩm "${productName}".`;
  } else if (imageFormat === "hands_only") {
    formatRule = `!!! QUY TẮC ĐỊNH DẠNG (BẮT BUỘC) !!!: CHỈ xuất hiện bàn tay đang cầm hoặc tương tác với sản phẩm. TUYỆT ĐỐI KHÔNG xuất hiện khuôn mặt hay toàn bộ cơ thể nhân vật. Chỉ hiển thị một phần cánh tay và bàn tay.`;
    outfitRule = hasOutfitRef ? `!!! QUY TẮC THAM CHIẾU BÀN TAY (QUAN TRỌNG) !!!: Sử dụng đặc điểm bàn tay (màu da, hình dáng) từ hình ảnh THAM CHIẾU TRANG PHỤC/TAY/CHÂN.` : "";
  } else if (imageFormat === "legs_only") {
    formatRule = `!!! QUY TẮC ĐỊNH DẠNG (BẮT BUỘC) !!!: CHỈ hiển thị từ bụng trở xuống (thân dưới), tập trung vào đôi chân đang đi hoặc đứng sử dụng sản phẩm (váy, giày, dép). TUYỆT ĐỐI KHÔNG xuất hiện khuôn mặt hay thân trên.`;
    outfitRule = hasOutfitRef ? `!!! QUY TẮC THAM CHIẾU ĐÔI CHÂN (QUAN TRỌNG) !!!: Sử dụng đặc điểm đôi chân hoặc trang phục thân dưới từ hình ảnh THAM CHIẾU TRANG PHỤC/TAY/CHÂN.` : "";
  } else {
    // with_koc or default
    identityRule = hasFaceRef 
      ? `!!! QUY TẮC DANH TÍNH KHUÔN MẶT TUYỆT ĐỐI (BẮT BUỘC) !!!:
         1. BẠN PHẢI SỬ DỤNG CHÍNH XÁC các đặc điểm khuôn mặt, màu sắc/kiểu tóc, biểu cảm và cấu trúc xương từ hình ảnh THAM CHIẾU KHUÔN MẶT được cung cấp.
         2. HOÀN TOÀN LỜ ĐI VÀ LOẠI BỎ bất kỳ khuôn mặt, đôi mắt hoặc danh tính nào được tìm thấy trong hình ảnh THAM CHIẾU TRANG PHỤC hoặc THAM CHIẾU SẢN PHẨM.
         3. Khuôn mặt của nhân vật PHẢI lấy 100% chỉ từ THAM CHIẾU KHUÔN MẶT.
         4. Khuôn mặt của nhân vật phải luôn nhìn trực tiếp vào máy ảnh.`
      : `DANH TÍNH: ${persona} trưởng thành ${gender} khớp với mô tả: "${characterDescription}".`;

    outfitRule = hasOutfitRef ? `
      !!! QUY TẮC NHẤT QUÁN TRANG PHỤC TUYỆT ĐỐI (BẮT BUỘC NGHIÊM NGẶT) !!!:
      1. Nhân vật PHẢI MẶC CHÍNH XÁC CÙNG một loại trang phục được hiển thị trong hình ảnh THAM CHIẾU TRANG PHỤC/TAY/CHÂN (hình ảnh được cung cấp trên nền trắng).
      2. GIỮ NGUYÊN 100% màu sắc, hoa văn, kết cấu, chất liệu vải và thiết kế của bộ quần áo cụ thể này.
      3. KHÔNG ĐƯỢC THAY ĐỔI, chỉnh sửa hoặc biến tấu trang phục. Nó phải giống hệt hình ảnh tham chiếu trong mọi cảnh quay.
      4. CHỈ trích xuất quần áo từ tham chiếu này; HOÀN TOÀN LỜ ĐI bất kỳ đặc điểm khuôn mặt hoặc danh tính người nào có thể xuất hiện trong nguồn trang phục gốc nếu nó không được làm sạch hoàn toàn.
      5. Coi trang phục này là ĐỒNG PHỤC VĨNH VIỄN của nhân vật cho toàn bộ bộ sưu tập này.
    ` : `TRANG PHỤC: Mặc theo phong cách được mô tả: "${characterDescription}".`;
    
    formatRule = `QUY TẮC ĐỊNH DẠNG: Có sự xuất hiện của nhân vật KOC ${gender} tương tác với sản phẩm.`;
  }

  const visualRules = `
    QUY TẮC THỊ GIÁC QUAN TRỌNG:
    1. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ.
    2. KHÔNG có các yếu diện người dùng (UI), KHÔNG bong bóng thoại, KHÔNG dấu mờ (watermark), KHÔNG phụ đề, KHÔNG EMOJI.
    3. Hình ảnh phải trông giống như một ẢNH CHỤP RAW chuyên nghiệp hoặc một bản KẾT ƯỚC chuyên nghiệp.
    
    !!! KHÓA TỶ LỆ VÀ BỐ CỤC (BẮT BUỘC NGHIÊM NGẶT) !!!:
    1. KHUNG HÌNH (FRAMING): Mọi hình ảnh PHẢI là "Medium Shot". ${imageFormat !== "no_character" ? "Nhân vật/Bàn tay phải chiếm tỷ lệ hợp lý trong khung hình đứng." : "Sản phẩm phải là tâm điểm của khung hình."}
    2. TỶ LỆ SẢN PHẨM: Sản phẩm "${productName}" PHẢI duy trì kích thước thực tế.
    3. TÍNH NHẤT QUÁN: Sản phẩm KHÔNG ĐƯỢC to ra hoặc nhỏ đi giữa các cảnh.
    4. KHÔNG BIẾN DẠNG: Sản phẩm là một vật thể rắn, không bị biến dạng. Tỷ lệ hình học của nó phải khớp 1:1 với hình ảnh THAM CHIẾU SẢN PHẨM.
  `;

  const backgroundRule = hasBgRef 
    ? `PHỐI CẢNH MÔI TRƯỜNG (QUAN TRỌNG): 
       1. Sử dụng CHÍNH XÁC cùng một môi trường và các yếu tố bối cảnh từ hình ảnh THAM CHIẾU BỐI CẢNH.
       2. Bối cảnh phải trông giống như cùng một căn phòng/không gian vật lý.`
    : `MÔI TRƯỜNG: Đặt cảnh trong một ${backgroundNote || langContext || 'bối cảnh phong cách sống hàng ngày'} tự nhiên.`;

  const poseInstruction = poseLabel ? `TƯ THẾ (BẮT BUỘC): ${imageFormat === 'no_character' ? 'Sản phẩm được đặt' : (imageFormat === 'legs_only' ? 'Đôi chân đang' : 'Nhân vật/Bàn tay đang')} ${poseLabel}.` : "";

  return `
    ${baseStyle} Tỷ lệ khung hình 9:16. 
    ${skinRealismRule}
    ${formatRule}
    ${identityRule}
    ${outfitRule}
    ${backgroundRule}
    ${visualRules}
    ${visualNote ? `BỐ CỤC THỊ GIÁC: ${visualNote}.` : ""}
    ${poseInstruction} 
    BỐI CẢNH CẢNH QUAY: "${scriptPart}". 
    ${userCustomPrompt || ""}
  `.trim();
};

/**
 * Tạo hình ảnh với TUÂN THỦ TUYỆT ĐỐI GHI CHÚ NHÂN VẬT & SẢN PHẨM & TRANG PHỤC.
 */
export const generateKocImage = async (
  referenceImageParts: any[], 
  faceImagePart: any | null, 
  outfitImagePart: any | null,
  outfitDescription: string, 
  productName: string,
  scriptPart: string, 
  characterDescription: string, 
  userCustomPrompt: string | undefined, 
  gender: string, 
  imageStyle: 'Realistic' | '3D' = 'Realistic', 
  backgroundNote: string = "",
  visualNote: string = "",
  poseLabel: string = "",
  backgroundReferencePart: any | null = null,
  imageFormat: string = "",
  language: string = "vi"
): Promise<string> => {
  // Flow API T2I only — 9:16
  const prompt = constructKocImagePrompt(
    productName, scriptPart, characterDescription, userCustomPrompt,
    gender, imageStyle, backgroundNote, visualNote, poseLabel, imageFormat,
    !!faceImagePart, !!outfitImagePart, !!backgroundReferencePart, language
  );
  
  console.log(`[KocService2] Flow API T2I 9:16`);
  const result = await flowApi.textToImage([prompt], { aspect_ratio: '9:16' });
  if (result.imageUrls && result.imageUrls.length > 0) {
    return result.imageUrls[0];
  }
  throw new Error('Flow API T2I: không tạo được ảnh');
};

/**
 * Tạo lời nhắc video cho mô hình VEO-3 dựa trên kịch bản và bối cảnh thị giác.
 */
export const generateKocVeoPrompt = async (
  productName: string, 
  scriptText: string, 
  gender: string, 
  voice: string,
  productImageData?: string,
  generatedImageBase64?: string,
  isNoProductRequested: boolean = false,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  imageFormat: string = "",
  language: string = "vi"
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Nữ' : 'Nam';
  const { persona, context } = getPersonaContext(language);

  let formatRule = "";
  if (imageFormat === "no_character") {
    formatRule = `!!! QUY TẮC ĐỊNH DẠNG (BẮT BUỘC) !!!: TUYỆT ĐỐI KHÔNG xuất hiện bất kỳ nhân vật, con người, khuôn mặt hay bộ phận cơ thể nào. CHỈ tập trung vào sản phẩm "${productName}".`;
  } else if (imageFormat === "hands_only") {
    formatRule = `!!! QUY TẮC ĐỊNH DẠNG (BẮT BUỘC) !!!: CHỈ xuất hiện bàn tay đang cầm hoặc tương tác với sản phẩm. TUYỆT ĐỐI KHÔNG xuất hiện khuôn mặt hay toàn bộ cơ thể nhân vật. Chỉ hiển thị một phần cánh tay và bàn tay.`;
  } else if (imageFormat === "legs_only") {
    formatRule = `!!! QUY TẮC ĐỊNH DẠNG (BẮT BUỘC) !!!: CHỈ hiển thị từ bụng trở xuống (thân dưới), tập trung vào đôi chân đang đi hoặc đứng sử dụng sản phẩm (váy, giày, dép). TUYỆT ĐỐI KHÔNG xuất hiện khuôn mặt hay thân trên.`;
  } else {
    formatRule = `!!! QUY TẮC ĐỊNH DẠNG !!!: Có sự xuất hiện của nhân vật KOC ${gender} tương tác với sản phẩm. Duy trì sự nhất quán 100% về khuôn mặt, tóc và TRANG PHỤC với các hình ảnh tham chiếu được cung cấp.`;
  }
  
  const productInteractionRule = isNoProductRequested
    ? `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - TUYỆT ĐỐI KHÔNG xuất hiện sản phẩm "${productName}".
      - Cách nhân vật di chuyển, nói chuyện và tương tác phù hợp với kịch bản: "${scriptText}".`
    : `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - ${imageFormat === 'no_character' ? 'Sản phẩm' : (imageFormat === 'legs_only' ? 'Đôi chân' : 'Nhân vật/Bàn tay')} đang tương tác với sản phẩm "${productName}".
      - Cách di chuyển và tương tác phù hợp với kịch bản: "${scriptText}".
      - [SẢN PHẨM PHẢI GIỐNG ẢNH THAM CHIẾU 100%, KHÔNG BIẾN DẠNG]`

  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết để tạo video AI (VEO-3) dài 8 giây cho video KOC Review.
  PHONG CÁCH VIDEO: ${is3D ? "Hoạt hình 3D / Phong cách CGI" : "Ảnh chụp thực tế / Phong cách đời thực"}.
  ${formatRule}

!!! CRITICAL RULE: ONE CONTINUOUS SHOT (QUAN TRỌNG: MỘT CÚ MÁY LIỀN MẠCH) !!!
  - Video phải là một cảnh quay liên tục (Single Take).
  - TUYỆT ĐỐI KHÔNG CẮT CẢNH (NO CUTS).
  - TUYỆT ĐỐI KHÔNG CHUYỂN CẢNH (NO SCENE TRANSITIONS).
  - Duy trì 100% sự nhất quán về bối cảnh và trang phục (nếu có nhân vật).

  CẤU TRÚC LỜI NHẮC:
  PHẦN 1: CHỦ THỂ & DIỆN MẠO. ${imageFormat === 'no_character' ? `Tập trung vào sản phẩm "${productName}".` : `Mô tả nhân vật/bàn tay, trang phục và khuôn mặt (nếu có) y hệt ảnh tham chiếu.`}
  ${productInteractionRule}
  PHẦN 3: BỐI CẢNH & ÁNH SÁNG. Không gian đồng nhất với bối cảnh ảnh tham chiếu (${context}).
  PHẦN 4: CHUYỂN ĐỘNG MÁY ẢNH (9:16). Chuyển động chậm (slow motion) vào chủ thể hoặc sản phẩm. Tuyệt đối không thay đổi bối cảnh trong suốt 8 giây.
  PHẦN 5: LỜI THOẠI (DÙNG CHO ĐỒNG BỘ GIỌNG NÓI CHI TIẾT): 
  - GIỚI TÍNH: ${voiceGender}.
  - NHÃN GIỌNG NÓI: "${voice}".
  - ĐẶC ĐIỂM CHI TIẾT (VÙNG MIỀN & ĐỘ TUỔI): "${voiceDetail}".
  - NỘI DUNG LỜI THOẠI: "${scriptText}"
  => Yêu cầu: Khớp môi (Lip-sync) hoàn hảo (nếu có mặt) và biểu cảm cực kỳ tự nhiên theo ngữ điệu vùng miền được chỉ định.
  PHẦN 6: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Không có nhạc nền, Không hiệu ứng chuyển cảnh.

  YÊU CẦU: Trả về 1 đoạn văn bản Tiếng Việt duy nhất mô tả chi tiết toàn bộ video. Không xuống dòng.`;

  const contents: any[] = [{ text: instructionPrompt }];
  if (productImageData) {
    contents.push({ inlineData: { mimeType: 'image/png', data: productImageData.split(',')[1] || productImageData } });
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
  }).catch((error: any) => {
    console.error("Lỗi tạo lời nhắc video KOC 2:", error);
    return "Lỗi khi tạo lời nhắc video.";
  });
};

/**
 * Phân tích chi tiết bối cảnh để đồng nhất 100% qua các cảnh.
 */
export const analyzeDetailedBackground = async (backgroundNote: string, backgroundPart: any | null): Promise<string> => {
  const prompt = `
    Nhiệm vụ: Phân tích và mở rộng mô tả bối cảnh (background) dưới đây thành một mô tả CỰC KỲ CHI TIẾT và CHUYÊN NGHIỆP để đảm bảo tính đồng nhất 100% khi tạo ảnh/video AI.
    
    Mô tả gốc: "${backgroundNote}"
    
    YÊU CẦU PHÂN TÍCH:
    1. CHI TIẾT KHÔNG GIAN: Mô tả loại phòng, kích thước ước lượng, phong cách thiết kế (VD: Hiện đại, Tối giản, Vintage...).
    2. CHI TIẾT VẬT LIỆU: Mô tả chất liệu sàn (gỗ, gạch, thảm), tường (sơn, giấy dán tường, ốp gỗ), trần nhà.
    3. CHI TIẾT NỘI THẤT & ĐỒ ĐẠC: Liệt kê các vật dụng cụ thể xuất hiện trong bối cảnh (bàn, ghế, kệ sách, cây xanh, tranh treo tường...) kèm theo màu sắc và vị trí của chúng.
    4. ÁNH SÁNG & KHÔNG KHÍ: Mô tả nguồn sáng (ánh sáng tự nhiên từ cửa sổ, đèn trần, đèn led decor), cường độ sáng, nhiệt độ màu (ấm, lạnh) và cảm giác chung của không gian.
    5. CHI TIẾT NHỎ (MICRO-DETAILS): Các chi tiết giúp tăng độ chân thực như bụi mịn trong nắng, vân gỗ, phản chiếu trên mặt kính...
    
    YÊU CẦU ĐẦU RA:
    - Trả về một đoạn văn bản Tiếng Việt súc tích nhưng đầy đủ các yếu tố trên.
    - Tập trung vào các từ khóa thị giác mạnh mẽ.
    - Mục tiêu là để AI có thể tái tạo lại CHÍNH XÁC bối cảnh này trong mọi lần tạo ảnh.
  `;

  const contents: any[] = [{ text: prompt }];
  if (backgroundPart) {
    contents.push({ text: "ẢNH THAM CHIẾU BỐI CẢNH:" });
    contents.push({ inlineData: backgroundPart });
  }

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim() || backgroundNote;
  }).catch((error) => {
    console.error("Lỗi phân tích bối cảnh:", error);
    return backgroundNote;
  });
};
