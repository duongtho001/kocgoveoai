
import { GoogleGenAI, Type } from "@google/genai";
import { getAiClient, callWithAiFallback } from "./keyService";

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Nhiệm vụ 1: Tạo kịch bản bộ sưu tập đồng bộ (6 phân cảnh)
 */
export const generateFashionTrackingScenario = async (
  backgroundNote: string = ""
): Promise<string[]> => {
  const prompt = `
    Bạn là một Giám đốc Sáng tạo Thời trang (Fashion Creative Director).
    Nhiệm vụ: Tạo kịch bản hành động cho một bộ sưu tập thời trang gồm 6 phân cảnh quay theo phong cách "Candid Paparazzi Tracking".
    Bối cảnh chung: "${backgroundNote || 'Đường phố hiện đại'}".
    
    YÊU CẦU:
    1. Mỗi cảnh là một mô tả hành động ngắn gọn của người mẫu (VD: đang bước ra từ xe hơi, đang cầm cafe đi dạo, đang đứng chờ đèn xanh...). Tối đa 180 ký tự mỗi cảnh.
    2. Các cảnh phải có tính liên kết như một câu chuyện ngắn về một ngày của nhân vật.
    3. Ngôn ngữ: Tiếng Việt.
    4. Trả về mảng JSON gồm đúng 6 chuỗi ký tự. Tối đa 180 ký tự mỗi chuỗi.
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
    return JSON.parse(response.text || '[]');
  }).catch((error) => {
    console.error("Lỗi tạo kịch bản Fashion Tracking:", error);
    return Array(6).fill("Đang đi bộ tự nhiên trên phố.");
  });
};

/**
 * Tạo hình ảnh thời trang Fashion Tracking bằng Gemini 2.5 Flash Image
 */
export const generateFashionTrackingImage = async (
  outfitPart: any,
  index: number,
  backgroundNote: string = "",
  regenNote: string = "",
  facePart: any | null = null,
  scenarioPart: string = "",
  angle: string = ""
): Promise<string> => {
  const ai = getAiClient('image');

  // Góc máy mặc định nếu người dùng không chọn (mở rộng lên 12 góc)
  const defaultAngles = [
    "Side profile view from a distance",
    "Three-quarter view from behind",
    "High angle looking down from an elevated position",
    "Hidden camera style, shot through some gaps",
    "Low angle side view",
    "Over-the-shoulder view",
    "Reflected view through a glass window",
    "Extreme long shot tracking subject in crowd",
    "Low ground-level tracking of shoes",
    "Birds-eye view from directly above",
    "Handheld aesthetic following from behind",
    "Peeking from behind a building corner"
  ];
  
  const selectedAngle = angle || defaultAngles[index % defaultAngles.length];
  const envDescription = backgroundNote || "Một khu công nghiệp hoặc đường phố Việt Nam thực tế, giờ giao ca bận rộn.";
  
  // Quy tắc gương mặt
  const identityRule = facePart 
    ? `!!! QUY TẮC DANH TÍNH KHUÔN MẶT TUYỆT ĐỐI (BẮT BUỘC) !!!:
       1. BẠN PHẢI SỬ DỤNG CHÍNH XÁC các đặc điểm khuôn mặt, cấu trúc xương và kiểu tóc từ ảnh FACE_REFERENCE đính kèm.
       2. Duy trì sự đồng nhất 100% về diện mạo nhân vật cho tất cả các cảnh quay.
       3. Nhân vật là phụ nữ Việt Nam trẻ tuổi.`
    : `ĐỐI TƯỢNG: Một phụ nữ Việt Nam trẻ (20-30 tuổi). 
       QUY TẮC BIẾN THỂ: Tạo một nhân vật ngẫu nhiên: hình dáng khuôn mặt ngẫu nhiên, kiểu tóc độc đáo và phong cách trang điểm tự nhiên.`;

  const prompt = `
    NHIỆM VỤ: Chụp ảnh thời trang phong cách "Candid Paparazzi" (Chụp lén, không dàn dựng).
    PHONG CÁCH: Street style tự nhiên, chân thực, cảm giác như thợ săn ảnh đang bắt trọn khoảnh khắc của nhân vật.
    
    !!! QUY TẮC MÁY ẢNH (BẮT BUỘC) !!!:
    - GÓC MÁY: ${selectedAngle}.
    - TUYỆT ĐỐI KHÔNG CHỤP CHÍNH DIỆN (NO FRONT VIEW).
    - Cảm giác máy ảnh đặt ở một vị trí khuất hoặc không gây chú ý.
    - Nhân vật hoàn toàn không biết mình đang bị chụp ảnh.
    
    ${identityRule}
    
    !!! ĐỒNG NHẤT TRANG PHỤC (BẮT BUỘC 100%) !!!:
    1. Đối tượng PHẢI MẶC CHÍNH XÁC BỘ TRANG PHỤC như trong ẢNH THAM CHIẾU TRANG PHỤC (OUTFIT_REFERENCE).
    2. Duy trì sự đồng nhất 100% về màu sắc, hoa văn, kết cấu vải và thiết kế của bộ đồ cụ thể này.
    
    HÀNH ĐỘNG CỤ THỂ: ${scenarioPart || 'Đang đi bộ tự nhiên'}.

    MÔI TRƯỜNG & BỐI CẢNH (QUAN TRỌNG):
    - BỐI CẢNH: ${envDescription}
    - Đảm bảo ánh sáng tự nhiên phù hợp với môi trường mô tả.
    
    TẠO PHONG CÁCH BỔ SUNG:
    - Thêm các phụ kiện thời trang hiện đại: một chiếc túi xách sành điệu, vòng tay tinh tế và giày đi bộ thoải mái.
    - TƯ THẾ: Đi bộ tự nhiên, đầu hơi cúi hoặc nhìn sang hướng khác. TUYỆT ĐỐI KHÔNG NHÌN VÀO CAMERA.
    
    CHẤT LƯỢNG & ĐỘ CHÂN THỰC:
    - Ảnh chân thực (photorealistic), ánh sáng tự nhiên, độ phân giải 8k, phong cách đời thường (lifestyle).
    - Giữ nguyên kết cấu da người chi tiết: lỗ chân lông, nếp nhăn vi mô.
    
    TỶ LỆ: 9:16 dọc.
    BẮT BUỘC: KHÔNG CÓ CHỮ, KHÔNG CÓ LOGO, KHÔNG CÓ DẤU MỜ.
    
    ${regenNote ? `GHI CHÚ CHỈNH SỬA TỪ NGƯỜI DÙNG: ${regenNote}` : ""}
  `;

  const parts: any[] = [{ text: prompt }];
  if (facePart) {
    parts.push({ text: "FACE_REFERENCE:" });
    parts.push({ inlineData: facePart });
  }
  parts.push({ text: "OUTFIT_REFERENCE:" });
  parts.push({ inlineData: outfitPart });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: parts },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });

    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imgPart) throw new Error("Tạo ảnh thất bại");
    return `data:image/png;base64,${imgPart.inlineData.data}`;
  } catch (error) {
    console.error("Lỗi tạo ảnh Fashion Tracking:", error);
    throw error;
  }
};

/**
 * Nhiệm vụ 4: Tạo Image Prompt chi tiết cho Fashion Tracking
 */
export const generateFashionTrackingImagePromptAI = async (
  outfitPart: any,
  index: number,
  backgroundNote: string = "",
  regenNote: string = "",
  facePart: any | null = null,
  angle: string = ""
): Promise<string> => {
  const defaultAngles = [
    "Side profile view from a distance",
    "Three-quarter view from behind",
    "High angle looking down from an elevated position",
    "Hidden camera style, shot through some gaps",
    "Low angle side view",
    "Over-the-shoulder view",
    "Reflected view through a glass window",
    "Extreme long shot tracking subject in crowd",
    "Low ground-level tracking of shoes",
    "Birds-eye view from directly above",
    "Handheld aesthetic following from behind",
    "Peeking from behind a building corner"
  ];
  
  const selectedAngle = angle || defaultAngles[index % defaultAngles.length];
  const envDescription = backgroundNote || "Một khu công nghiệp hoặc đường phố Việt Nam thực tế, giờ giao ca bận rộn.";

  const instruction = `
    Nhiệm vụ: Viết một lời nhắc (Prompt) cực kỳ chi tiết bằng Tiếng Việt để tạo hình ảnh AI chất lượng cao (8k) cho phong cách "Fashion Tracking - Candid Paparazzi".
    
    YÊU CẦU NỘI DUNG:
    1. PHONG CÁCH: Street style tự nhiên, chân thực, cảm giác như thợ săn ảnh đang bắt trọn khoảnh khắc của nhân vật.
    2. GÓC MÁY: ${selectedAngle}. TUYỆT ĐỐI KHÔNG CHỤP CHÍNH DIỆN.
    3. NHÂN VẬT: Một phụ nữ Việt Nam trẻ (20-30 tuổi). 
    4. TRANG PHỤC: Mô tả cực kỳ chi tiết trang phục từ OUTFIT_REFERENCE đính kèm.
    5. BỐI CẢNH: ${envDescription}. Ánh sáng tự nhiên, chân thực.
    6. CHẤT LƯỢNG: Photorealistic, 8k resolution, cinematic lighting, lifestyle aesthetic.
    
    QUY TẮC AN TOÀN:
    - KHÔNG sử dụng các từ nhạy cảm (lingerie, underwear, bikini, sheer, see-through, etc.).
    - KHÔNG có văn bản, chữ cái, logo hay dấu mờ.
    
    YÊU CẦU ĐẦU RA:
    - Trả về DUY NHẤT một đoạn văn bản Tiếng Việt mô tả cực kỳ chi tiết toàn bộ khung cảnh.
    - KHÔNG có tiêu đề, KHÔNG giải thích, KHÔNG xuống dòng.
    ${regenNote ? `- LƯU Ý THÊM TỪ NGƯỜI DÙNG: "${regenNote}"` : ""}
  `;

  const parts: any[] = [{ text: instruction }];
  if (facePart) {
    parts.push({ text: "FACE_REFERENCE:" });
    parts.push({ inlineData: facePart });
  }
  parts.push({ text: "OUTFIT_REFERENCE:" });
  parts.push({ inlineData: outfitPart });

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: parts }
    });
    return response.text?.trim() || "";
  }).catch((error) => {
    console.error("Lỗi tạo image prompt Fashion Tracking:", error);
    return "Error generating image prompt.";
  });
};
export const generateFashionTrackingVideoPrompt = async (
  imageBase64: string,
  backgroundNote: string = "",
  scenarioPart: string = ""
): Promise<string> => {
  const envDescription = backgroundNote || "bối cảnh thực tế sống động";
  
  const instruction = `
  Phân tích hình ảnh thời trang đính kèm và viết một Prompt Video AI chi tiết cho VEO-3 (8 giây).
  Tạo 1 video 8s
  Nhân vật: Một cô gái người Việt Nam mặc đúng bộ trang phục trong hình ảnh tham chiếu.
  Bối cảnh: [Dựa trên ảnh và mô tả: ${envDescription}]
  Hành động: nhân vật bước đi nhanh, tự nhiên về phía trước.
  Camera: tracking theo nhân vật
  Chất lượng: video 4k, 60 fps, không nhạc nền, không tiếng chụp ảnh, không cắt cảnh, không thay đổi bối cảnh trong suốt 8s. nhân vật bước đi nhanh từ A-B liền mạch.
  YÊU CẦU: Trả về kết quả trên 1 dòng duy nhất bằng Tiếng việt.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { text: instruction },
          { inlineData: { mimeType: 'image/png', data: imageBase64.split(',')[1] } }
        ] 
      }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error) => {
    console.error("Lỗi tạo prompt video Fashion Tracking:", error);
    return "Lỗi khi tạo prompt video.";
  });
};
