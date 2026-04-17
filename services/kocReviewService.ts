import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScriptParts, ScriptPartKey } from "../types";
import { getAiClient, callWithRetry, callWithAiFallback } from "./keyService";
import { getScriptLengthInstruction, getPersonaContext, getLanguageLabel } from "../utils/languageUtils";

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
  language: string = 'vi'
): Promise<ScriptParts> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const targetLang = getLanguageLabel(language);
  const lengthInstruction = getScriptLengthInstruction(language);
  const { persona, context } = getPersonaContext(language);

  const prompt = `
    Trong vai 1 Creator chuyên tạo video viral hãy tạo kịch bản bán hàng cho "${productName}". USP: "${keyword}". Bố cục (Layout): "${scriptLayout}". 
    ĐỐI TƯỢNG KHÁCH HÀNG MỤC TIÊU: "${targetAudience || 'Mọi người'}". Hãy viết văn phong phù hợp với tệp khách hàng này.
    NHÂN VẬT: Giới tính ${gender}, Đặc điểm giọng nói: ${voiceDetail}. Nhân vật: ${persona}. Bối cảnh: ${context}.
    NGÔN NGỮ ĐẦU RA: ${targetLang} (Hãy viết toàn bộ kịch bản bằng ngôn ngữ này)
    
    YÊU CẦU: Đúng ${sceneCount} phần (v1..v${sceneCount}). KHÔNG nhắc bối cảnh/địa điểm.
    
    !!! QUAN TRỌNG NHẤT (QUY TẮC ĐỘ DÀI NGHIÊM NGẶT) !!!:
    ${lengthInstruction}
    - Phần CTA điều hướng khách hàng mua hàng tại giỏ hàng góc trái.
    - Văn phong phải cực kỳ khớp với mô tả giọng nói (nếu là Tiếng Việt): ${voiceDetail}.
    - Kịch bản phải bắt đầu bằng một câu hỏi.
    
    QUY TẮC XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe). (Nếu ngôn ngữ không phải Tiếng Việt, hãy sử dụng đại từ tương đương phù hợp nhất).
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
    console.error("Lỗi tạo kịch bản KOC:", e);
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
  language: string = 'vi'
): Promise<string> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);

  const prompt = `
    Hãy VIẾT LẠI phần kịch bản "${scriptPartKey}" cho sản phẩm "${productName}".
    Tệp khách hàng mục tiêu: "${targetAudience}".
    Nội dung cũ: "${currentPartContent}".
    Bối cảnh toàn bộ kịch bản: ${JSON.stringify(fullScript)}.
    NGÔN NGỮ ĐẦU RA: ${language} (Hãy viết toàn bộ kịch bản bằng ngôn ngữ này)
    
    YÊU CẦU:
    1. Giữ nguyên phong cách và sự logic với các phần khác.
    2. Độ dài bắt buộc: Từ 160 đến 180 ký tự. Tuyệt đối không vượt quá 180 ký tự và không dưới 160 ký tự.
    3. Giới tính: ${gender}, Đặc điểm giọng nói (nếu là Tiếng Việt): ${voiceDetail}.
    4. XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe). (Nếu ngôn ngữ không phải Tiếng Việt, hãy sử dụng đại từ tương đương phù hợp nhất).
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
    console.error("Lỗi tạo lại phần kịch bản KOC:", error);
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
  cameraAngle: string = "",
  productParts: any[] = [],
  facePart: any | null = null,
  outfitPart: any | null = null,
  language: string = 'vi'
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

  const identityRule = facePart 
    ? `QUY TẮC DANH TÍNH KHUÔN MẶT (BẮT BUỘC): BẠN PHẢI SỬ DỤNG CHÍNH XÁC các đặc điểm khuôn mặt, màu sắc/kiểu tóc, biểu cảm và cấu trúc xương từ hình ảnh TỆP ĐÍNH KÈM KHUÔN MẶT. Khuôn mặt của nhân vật PHẢI lấy 100% chỉ từ TỆP ĐÍNH KÈM KHUÔN MẶT.`
    : `DANH TÍNH: ${persona} trưởng thành ${gender} khớp với mô tả: "${characterDescription}".`;

  const outfitRule = outfitPart ? `
    QUY TẮC NHẤT QUÁN TRANG PHỤC (BẮT BUỘC): Nhân vật PHẢI MẶC CHÍNH XÁC CÙNG một loại trang phục được hiển thị trong hình ảnh TỆP ĐÍNH KÈM TRANG PHỤC. GIỮ NGUYÊN 100% màu sắc, hoa văn, kết cấu, chất liệu vải và thiết kế.
  ` : `TRANG PHỤC: Mặc theo phong cách được mô tả: "${characterDescription}".`;

  const visualRules = `
    QUY TẮC THỊ GIÁC QUAN TRỌNG:
    1. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ.
    2. KHÔNG có các yếu diện người dùng (UI), KHÔNG bong bóng thoại, KHÔNG dấu mờ (watermark), KHÔNG phụ đề, KHÔNG EMOJI.
    3. KHUNG HÌNH (FRAMING): Mọi hình ảnh PHẢI là "Medium Shot". Nhân vật phải chiếm đúng 3/4 chiều cao của khung hình đứng.
    4. TỶ LỆ SẢN PHẨM: Sản phẩm "${productName}" PHẢI duy trì kích thước thực tế, cố định so với nhân vật. Không bị biến dạng.
  `;

  const backgroundRule = `MÔI TRƯỜNG: Đặt cảnh trong một ${backgroundNote || 'bối cảnh phong cách sống hàng ngày'} tự nhiên. ${context}. Phối cảnh của môi trường phải khớp với góc máy ảnh: "${cameraAngle || 'chính diện'}".`;

  const instruction = `
    Nhiệm vụ: Viết một lời nhắc (Prompt) cực kỳ chi tiết bằng Tiếng Việt để tạo hình ảnh AI chất lượng cao (8k) cho sản phẩm "${productName}".
    
    !!! QUY TẮC PHÂN TÍCH THAM CHIẾU (BẮT BUỘC) !!!
    1. TỆP ĐÍNH KÈM KHUÔN MẶT: Quan sát ảnh mẫu để mô tả chính xác đặc điểm khuôn mặt (mắt, mũi, môi), kiểu tóc và biểu cảm của nhân vật. ${persona}.
    2. TỆP ĐÍNH KÈM TRANG PHỤC: Mô tả cực kỳ chi tiết trang phục (kiểu dáng, màu sắc, hoa văn, chất liệu vải) từ ảnh mẫu.
    3. TỆP ĐÍNH KÈM SẢN PHẨM: Mô tả cực kỳ chi tiết về "${productName}" (hình dáng, nhãn hiệu, màu sắc, vật liệu, tỷ lệ kích thước sản phẩm so với tỷ lệ nhân vật) để đảm bảo độ nhận diện 100%.
 
    !!! QUY TẮC AN TOÀN & CẤM KỴ (TUYỆT ĐỐI TUÂN THỦ) !!!
    KHÔNG sử dụng các từ sau trong prompt:
    - Nhóm nhạy cảm: lingerie, underwear, panties, bra, thong, bikini, swimwear, swimsuit, sheer, see-through, transparent, sweaty, sultry, seductive, erotic, curvy, busty, voluptuous, skin tight.
    - Nhóm trẻ em: child, kid, baby, toddler, minor, underage, teen, schoolgirl, school uniform, lolita. (Thay bằng "adult", "${persona} woman", "${persona} man").
    - Nhóm bạo lực/vũ khí: blood, gory, wound, injury, gun, pistol, weapon, bomb, war, shoot (Thay "shoot" bằng "capture" hoặc "photograph").
    - Nhóm gây hiểu lầm: chest (Thay bằng "upper body"), hot (Thay bằng "sunny" hoặc "vibrant"), spicy, bath, bedroom.

    CẤU TRÚC PROMPT (PHẢI BAO GỒM CÁC QUY TẮC NHƯ KHI TẠO ẢNH TRỰC TIẾP):
    - [Style & Lighting]: ${baseStyle} ${skinRealismRule}
    - [Subject Description]: Adult ${persona} ${gender}, mô tả cực kỳ chi tiết mặt và tóc từ TỆP ĐÍNH KÈM KHUÔN MẶT (nếu có) hoặc theo mô tả: "${characterDescription}". Dáng người cân đối chuyên nghiệp. ${identityRule}
    - [Outfit Description]: Mô tả cực kỳ chi tiết trang phục từ TỆP ĐÍNH KÈM TRANG PHỤC (nếu có) hoặc theo mô tả: "${characterDescription}". ${outfitRule}
    - [Product Interaction]: Cực kỳ chi tiết cách nhân vật cầm/sử dụng "${productName}", phù hợp kịch bản "${scriptPart}" và tư thế "${poseLabel}". Sản phẩm phải duy trì tỷ lệ thực tế.
    - [Background & Context]: ${backgroundRule}
    - [Visual Rules]: ${visualRules}
    - [User Custom Prompt]: ${userCustomPrompt || ""}

    HÃY VIẾT PROMPT CHI TIẾT (BẰNG TIẾNG VIỆT) DỰA TRÊN CÁC THÔNG TIN TRÊN.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: instruction,
    });
    return response.text || "Error generating safety-compliant detailed prompt.";
  }).catch((error) => {
    console.error("Lỗi tạo prompt ảnh KOC:", error);
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
  cameraAngle: string = "",
  hasFaceRef: boolean = false,
  hasOutfitRef: boolean = false,
  hasBgRef: boolean = false,
  language: string = 'vi'
): string => {
  const is3D = imageStyle === '3D';
  const { persona, context } = getPersonaContext(language);
  
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

  // !!! QUY TẮC ĐỘC QUYỀN KHUUÔN MẶT NGHIÊM NGẶT !!!
  const identityRule = hasFaceRef 
    ? `!!! QUY TẮC DANH TÍNH KHUÔN MẶT TUYỆT ĐỐI (BẮT BUỘC) !!!:
       1. BẠN PHẢI SỬ DỤNG CHÍNH XÁC các đặc điểm khuôn mặt, màu sắc/kiểu tóc, biểu cảm và cấu trúc xương từ hình ảnh THAM CHIẾU KHUÔN MẶT được cung cấp.
       2. HOÀN TOÀN LỜ ĐI VÀ LOẠI BỎ bất kỳ khuôn mặt, đôi mắt hoặc danh tính nào được tìm thấy trong hình ảnh THAM CHIẾU TRANG PHỤC hoặc THAM CHIẾU SẢN PHẨM.
       3. Khuôn mặt của nhân vật PHẢI lấy 100% chỉ từ THAM CHIẾU KHUÔN MẶT.
       4. Khuôn mặt của nhân vật phải luôn nhìn trực tiếp vào máy ảnh.`
    : `DANH TÍNH: ${persona} trưởng thành ${gender} khớp với mô tả: "${characterDescription}".`;

  // !!! QUY TẮC NHẤT QUÁN TRANG PHỤC TUYỆT ĐỐI !!!
  const outfitRule = hasOutfitRef ? `
    !!! QUY TẮC NHẤT QUÁN TRANG PHỤC TUYỆT ĐỐI (BẮT BUỘC NGHIÊM NGẶT) !!!:
    1. Nhân vật PHẢI MẶC CHÍNH XÁC CÙNG một loại trang phục được hiển thị trong hình ảnh THAM CHIẾU TRANG PHỤC (hình ảnh được cung cấp trên nền trắng).
    2. GIỮ NGUYÊN 100% màu sắc, hoa văn, kết cấu, chất liệu vải và thiết kế của bộ quần áo cụ thể này.
    3. KHÔNG ĐƯỢC THAY ĐỔI, chỉnh sửa hoặc biến tấu trang phục. Nó phải giống hệt hình ảnh tham chiếu trong mọi cảnh quay.
    4. CHỈ trích xuất quần áo từ tham chiếu này; HOÀN TOÀN LỜ ĐI bất kỳ đặc điểm khuôn mặt hoặc danh tính người nào có thể xuất hiện trong nguồn trang phục gốc nếu nó không được làm sạch hoàn toàn.
    5. Coi trang phục này là ĐỒNG PHỤC VĨNH VIỄN của nhân vật cho toàn bộ bộ sưu tập này.
  ` : `TRANG PHỤC: Mặc theo phong cách được mô tả: "${characterDescription}".`;

  const visualRules = `
    QUY TẮC THỊ GIÁC QUAN TRỌNG:
    1. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ.
    2. KHÔNG có các yếu diện người dùng (UI), KHÔNG bong bóng thoại, KHÔNG dấu mờ (watermark), KHÔNG phụ đề, KHÔNG EMOJI.
    3. Hình ảnh phải trông giống như một ẢNH CHỤP RAW chuyên nghiệp hoặc một bản KẾT ƯỚC chuyên nghiệp.
    
    !!! KHÓA TỶ LỆ VÀ BỐ CỤC (BẮT BUỘC NGHIÊM NGẶT) !!!:
    1. KHUNG HÌNH (FRAMING): Mọi hình ảnh PHẢI là "Medium Shot". Nhân vật phải chiếm đúng 3/4 chiều cao của khung hình đứng.
    2. TỶ LỆ SẢN PHẨM: Sản phẩm "${productName}" PHẢI duy trì kích thước thực tế, cố định so với nhân vật.
    3. TÍNH NHẤT QUÁN: Sản phẩm KHÔNG ĐƯỢC to ra hoặc nhỏ đi giữa các cảnh.
    4. KHÔNG BIẾN DẠNG: Sản phẩm là một vật thể rắn, không bị biến dạng. Tỷ lệ hình học của nó phải khớp 1:1 với hình ảnh THAM CHIẾU SẢN PHẨM.
  `;

  const backgroundRule = hasBgRef 
    ? `PHỐI CẢNH MÔI TRƯỜNG (QUAN TRỌNG): 
       1. Sử dụng CHÍNH XÁC cùng một môi trường và các yếu tố bối cảnh từ hình ảnh THAM CHIẾU BỐI CẢNH.
       2. ĐỊNH HƯỚNG LẠI góc nhìn của máy ảnh đối với môi trường này dựa trên góc được chỉ định: "${cameraAngle || 'chính diện'}".
       3. Bối cảnh phải trông giống như cùng một căn phòng/không gian vật lý, nhưng được nhìn từ một góc độ khác phù hợp với chủ thể.`
    : `MÔI TRƯỜNG: Đặt cảnh trong một ${backgroundNote || 'bối cảnh phong cách sống hàng ngày'} tự nhiên. ${context}. Phối cảnh của môi trường phải khớp với góc máy ảnh: "${cameraAngle || 'chính diện'}".`;

  return `
    [Style & Lighting]: ${baseStyle} ${skinRealismRule}
    [Subject Description]: ${persona} ${gender}, mô tả cực kỳ chi tiết mặt và tóc từ THAM CHIẾU KHUÔN MẶT (nếu có) hoặc theo mô tả: "${characterDescription}". Dáng người cân đối chuyên nghiệp. ${identityRule}
    [Outfit Description]: Mô tả cực kỳ chi tiết trang phục từ THAM CHIẾU TRANG PHỤC (nếu có) hoặc theo mô tả: "${characterDescription}". ${outfitRule}
    [Product Interaction]: Cực kỳ chi tiết cách nhân vật cầm/sử dụng "${productName}", phù hợp kịch bản "${scriptPart}" và tư thế "${poseLabel}". Sản phẩm phải duy trì tỷ lệ thực tế.
    [Background & Context]: ${backgroundRule}
    [Visual Rules]: ${visualRules}
    [User Custom Prompt]: ${userCustomPrompt || ""}
  `.trim();
};

/**
 * Tạo ảnh KOC Review bằng cách kết hợp prompt AI và các tham chiếu.
 */
export const generateKocImage = async (
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
  cameraAngle: string = "",
  referenceImageParts: any[] = [],
  faceImagePart: any | null = null,
  outfitImagePart: any | null = null,
  backgroundReferencePart: any | null = null,
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('image');
  
  const prompt = constructKocImagePrompt(
    productName,
    scriptPart,
    characterDescription,
    userCustomPrompt,
    gender,
    imageStyle,
    backgroundNote,
    visualNote,
    poseLabel,
    cameraAngle,
    !!faceImagePart,
    !!outfitImagePart,
    !!backgroundReferencePart,
    language
  );
  
  const contents: any[] = [{ text: prompt }];
  if (faceImagePart) contents.push({ inlineData: faceImagePart });
  if (outfitImagePart) contents.push({ inlineData: outfitImagePart });
  if (backgroundReferencePart) contents.push({ inlineData: backgroundReferencePart });
  
  const noProductKeywords = ["không có sản phẩm", "xóa sản phẩm", "không xuất hiện sản phẩm", "bỏ sản phẩm", "không thấy sản phẩm", "no product", "remove product", "without product"];
  const isNoProductRequested = userCustomPrompt && noProductKeywords.some(kw => userCustomPrompt.toLowerCase().includes(kw));

  if (!isNoProductRequested) {
    referenceImageParts.forEach(part => contents.push({ inlineData: part }));
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Thất bại");
  } catch (error) { throw error; }
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
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('text');
  const is3D = imageStyle === '3D';
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Nữ' : 'Nam';
  const { persona, context } = getPersonaContext(language);
  
  const productInteractionRule = isNoProductRequested
    ? `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - TUYỆT ĐỐI KHÔNG xuất hiện sản phẩm "${productName}".
      - Cách nhân vật di chuyển, nói chuyện và tương tác phù hợp với kịch bản: "${scriptText}".`
    : `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - Nhân vật đang cầm trên tay sản phẩm "${productName}".
      - Cách nhân vật di chuyển, nói chuyện và tương tác phù hợp với kịch bản: "${scriptText}".
      - [SẢN PHẨM PHẢI GIỐNG ẢNH THAM CHIẾU 100%, KHÔNG BIẾN DẠNG]`

  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết để tạo video AI (VEO-3) dài 8 giây cho video KOC Review.
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
  PHẦN 3: BỐI CẢNH & ÁNH SÁNG. Không gian đồng nhất với bối cảnh ảnh tham chiếu. ${context}.
  PHẦN 4: CHUYỂN ĐỘNG MÁY ẢNH (9:16). Chuyển động chậm (slow motion) vào nhân vật hoặc sản phẩm. Tuyệt đối không thay đổi bối cảnh, nhân vật và trang phục trong suốt 8 giây.
  PHẦN 5: LỜI THOẠI (DÙNG CHO ĐỒNG BỘ GIỌNG NÓI CHI TIẾT): 
  - GIỚI TÍNH: ${voiceGender}.
  - NHÃN GIỌNG NÓI: "${voice}".
  - ĐẶC ĐIỂM CHI TIẾT (VÙNG MIỀN & ĐỘ TUỔI): "${voiceDetail}".
  - NỘI DUNG LỜI THOẠI: "${scriptText}"
  => Yêu cầu: Khớp môi (Lip-sync) hoàn hảo và biểu cảm khuôn mặt cực kỳ tự nhiên theo ngữ điệu vùng miền được chỉ định.
  
  PHẦN 6: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Không có nhạc nền, Không hiệu ứng chuyển cảnh.

  YÊU CẦU: Trả về 1 dòng Tiếng Anh duy nhất (trừ phần lời thoại). Không xuống dòng.`;

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
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error) => {
    console.error("Lỗi tạo lời nhắc video KOC:", error);
    return "Lỗi khi tạo lời nhắc video.";
  });
};
