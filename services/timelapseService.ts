
import { GoogleGenAI, Type } from "@google/genai";
import { getAiClient, callWithAiFallback } from "./keyService";
import { TimelapseContext } from "../types";

// Định nghĩa kiểu cho phần dữ liệu ảnh gửi đi
export interface GenerativeImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  }
}

/**
 * Làm sạch phản hồi JSON từ mô hình AI bằng cách loại bỏ các thẻ markdown.
 */
const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

/**
 * Helper: Chuyển đổi File sang định dạng inlineData base64 để AI có thể xử lý hình ảnh.
 */
export const fileToGenerativePart = async (file: File): Promise<GenerativeImagePart> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({
      inlineData: {
        mimeType: file.type,
        data: (reader.result as string).split(',')[1]
      }
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Hàm helper để chuyển base64 string thành object gửi cho AI (dùng cho ảnh previous)
 */
export const base64ToGenerativePart = (base64String: string): GenerativeImagePart => {
    const [prefix, data] = base64String.split(',');
    const mimeType = prefix.match(/:(.*?);/)?.[1] || 'image/png';
    return {
        inlineData: { mimeType, data }
    };
};

/**
 * BƯỚC 1: PHÂN TÍCH NGỮ CẢNH (CONTEXT ANALYSIS)
 */
const analyzeTransformationContext = async (
  baseImagePart: GenerativeImagePart, 
  finalGoalPart: GenerativeImagePart
): Promise<TimelapseContext> => {
  const prompt = `
    PHÂN TÍCH sự chuyển đổi hình ảnh từ Ảnh A (Bắt đầu) sang Ảnh B (Kết thúc).
    Xác định các thuộc tính sau đây theo định dạng JSON nghiêm ngặt:
    1. "subject": Đối tượng chính là gì? (Ví dụ: Phòng khách, Phòng ngủ, Studio)
    2. "processType": Chọn một trong các loại: "Xây dựng/Cải tạo", "Nghệ thuật/Hội họa", "Phục hồi"
    3. "rawMaterial": Giai đoạn 0% trông như thế nào?
    4. "toolsVisible": Những công cụ nào đang được sử dụng?
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { text: prompt },
          baseImagePart,
          finalGoalPart
        ] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            processType: { type: Type.STRING },
            rawMaterial: { type: Type.STRING },
            toolsVisible: { type: Type.STRING },
          },
          required: ["subject", "processType", "rawMaterial", "toolsVisible"]
        }
      }
    });
    return JSON.parse(cleanJsonResponse(response.text || '{}'));
  }).catch((error) => {
    console.error("Lỗi phân tích ngữ cảnh:", error);
    return {
      subject: "Căn phòng",
      processType: "Xây dựng",
      rawMaterial: "Khung bê tông",
      toolsVisible: "Công cụ xây dựng"
    };
  });
};

/**
 * BƯỚC 2: TẠO KỊCH BẢN (SCRIPT GENERATION)
 */
export const generateTimelapseScript = async (
  baseImagePart: GenerativeImagePart, 
  finalGoalPart: GenerativeImagePart, 
  sceneCount: number,
  progressSteps: number[],
  language: string = 'vi'
): Promise<{ script: string[], context: TimelapseContext }> => {
  const context = await analyzeTransformationContext(baseImagePart, finalGoalPart);

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

  const prompt = `
    NGỮ CẢNH: ${context.subject}, Quy trình: ${context.processType}.
    NHIỆM VỤ: Tạo mô tả hình ảnh gồm ${sceneCount} bước cho video timelapse chuyển đổi.
    CÁC BƯỚC TIẾN ĐỘ: ${progressSteps.join('%, ')}%.

    QUY TẮC NỘI DUNG TIẾN ĐỘ NGHIÊM NGẶT (THEO SÁT CÁC GIAI ĐOẠN SAU):
    1. GIAI ĐOẠN 20%: Tập trung vào BỀ MẶT. Tường đã được sơn mới, sàn nhà đã được lắp đặt. CĂN PHÒNG PHẢI HOÀN TOÀN TRỐNG, không có bất kỳ đồ đạc nào.
    2. GIAI ĐOẠN 40%-60%: DỌN ĐỒ VÀO. Một vài thùng carton màu nâu xuất hiện trên sàn. Một số đồ nội thất từ Ảnh Kết quả bắt đầu xuất hiện nhưng được bọc trong nilon xanh hoặc bị che khuất một phần. Tắt tất cả các loại đèn, điện. tường và kệ và bàn hoàn toàn trống trơn, không bật đèn. xóa hết các đồ trang trí decor.
    3. GIAI ĐOẠN 70%-80%: THÁO DỠ BAO BÌ. Các thùng carton vẫn còn nhưng đang được di chuyển. Đồ nội thất đang được đưa vào vị trí. tường và kệ và bàn hoàn toàn trống trơn, không bật đèn. xóa hết các đồ trang trí decor.
    4. GIAI ĐOẠN 100%: HOÀN THIỆN. Mọi thứ khớp chính xác với Ảnh Kết quả.

    ĐẦU RA: Mảng JSON chứa các chuỗi ký tự bằng ${targetLang}. Mỗi chuỗi nên mô tả trạng thái hình ảnh một cách rõ ràng. TỐI ĐA 180 KÝ TỰ CHO MỖI CHUỖI.
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
    
    return {
      script: JSON.parse(cleanJsonResponse(response.text || '[]')),
      context: context
    };
  }).catch((error) => {
    console.error("Lỗi tạo kịch bản timelapse:", error);
    return {
      script: progressSteps.map(p => `Giai đoạn ${p}%: Tiến trình hoàn thiện...`),
      context: context
    };
  });
};

/**
 * BƯỚC 3: TẠO ẢNH TRUNG GIAN (UNIVERSAL IMAGE GENERATION)
 */
export const generateTimelapseImage = async (
  context: TimelapseContext,
  sceneDescription: string,
  baseImagePart: GenerativeImagePart,
  finalGoalPart: GenerativeImagePart,
  progress: number,
  previousImagePart: GenerativeImagePart | null
): Promise<string> => {
  const ai = getAiClient('image');
  const modelId = "gemini-3.1-flash-image-preview";

  let phaseConstraint = "";
  
  if (progress <= 30) {
      phaseConstraint = `
      QUY TẮC GIAI ĐOẠN NGHIÊM NGẶT: 
      - Kiến trúc phòng (tường, sàn, trần) PHẢI khớp với Ảnh Kết quả (Ảnh B) 100%.
      - NHƯNG căn phòng PHẢI HOÀN TOÀN TRỐNG. 
      - TUYỆT ĐỐI KHÔNG có đồ nội thất, KHÔNG đồ trang trí, và KHÔNG có thùng hộp, đồ treo tường, máy lạnh. 
      - Nó phải trông giống như một vỏ căn phòng trống vừa mới hoàn thiện.
      `;
  } else if (progress > 30 && progress <= 80) {
      phaseConstraint = `
      QUY TẮC GIAI ĐOẠN NGHIÊM NGẶT:
      - THAM CHIẾU: Sử dụng Ảnh Kết quả (Ảnh B) làm nguồn DUY NHẤT cho đồ nội thất và các vật dụng.
      - BỔ SUNG: Bạn được phép thêm một vài THÙNG CARTON màu nâu trên sàn để thể hiện tiến trình.
      - RÀNG BUỘC PHỦ ĐỊNH: KHÔNG thêm bất kỳ đồ nội thất, đồ vật hoặc vật dụng nào không có trong Ảnh Kết quả.
      - Một số vật dụng từ Ảnh Kết quả có thể được hiển thị dưới dạng "vừa mới chuyển đến" (có thể được bọc trong nilon).
      - Tắt tất cả các loại đèn, điện.
      - Tường và kệ hoàn toàn trống trơn, không bật đèn.
      `;
  } else {
      phaseConstraint = `
      QUY TẮC GIAI ĐOẠN NGHIÊM NGẶT:
      - Khớp gần như 80% với Ảnh Kết quả.
      - Chỉ còn lại một vài thùng carton, sắp sửa được dọn đi.
      `;
  }

  const prompt = `
    NHIỆM VỤ: Tạo một khung hình timelapse trung gian tại mức ${progress}% cho "${context.subject}".
    ${phaseConstraint}
    
    TÍNH LIÊN TỤC CỦA HÌNH ẢNH:
    - THAM CHIẾU: Sử dụng Ảnh Kết quả (Ảnh B) được cung cấp làm tham chiếu tuyệt đối cho trạng thái hoàn thiện.
    - KHÔNG TỰ Ý THÊM THẮT: KHÔNG phát minh hoặc thêm bất kỳ đồ nội thất hoặc đồ vật nào không hiển thị rõ ràng trong Ảnh Kết quả (ngoại trừ các thùng carton màu nâu trong giai đoạn di chuyển).
    - MÁY ẢNH: Duy trì chính xác vị trí máy ảnh, độ dài tiêu cự và góc nhìn của Ảnh Kết quả.
    ${previousImagePart ? "- Đảm bảo tiến trình logic từng bước từ trạng thái được hiển thị trong Ảnh Trước đó." : ""}

    MÔ TẢ CẢNH: "${sceneDescription}"
    PHONG CÁCH: Chụp ảnh nội thất chuyên nghiệp, chân thực, độ phân giải 8k. Không có chữ chèn lên ảnh.
  `;

  let contents: any[] = [{ text: prompt }, finalGoalPart];
  if (previousImagePart) contents.push(previousImagePart);

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imgPart) throw new Error("Không có hình ảnh nào được tạo ra.");
    return `data:image/png;base64,${imgPart.inlineData.data}`;
  } catch (error) {
    throw error;
  }
};

/**
 * BƯỚC 4: TẠO VIDEO PROMPT (UNIVERSAL ACTION)
 */
export const generateTimelapseVideoPrompt = async (
  context: TimelapseContext,
  description: string,
  currentImageBase64: string,
  progress: number,
  previousImagePart: GenerativeImagePart | null
): Promise<string> => {
  let specificInstruction = "";
  if (progress === 0) {
    // Logic cho cảnh hiện trạng (0%)
    specificInstruction = `
      HÀNH ĐỘNG BẮT BUỘC: Cảnh tập trung vào việc DỌN DẸP CẢI TẠO MẶT BẰNG.
      - Hiển thị 1-2 cô gái đang tích cực dọn dẹp và di chuyển các vật liệu cũ.
      - Sau đo cô gái bắt đầu sơn tường, lát sàn và làm mới cửa sổ.
      - 1-2 cô gái liên tục đi ra đi vào trong suốt 8s.
      - Anh sáng được chiếu sáng bởi ánh nắng mặt trời.
      - Môi trường trông thô sơ và trống trải.
      - CAMERA: Cố định 100% trên chân máy (static tripod shot).
    `;
  } else if (progress === 100) {
    // Logic cho cảnh kết quả (100%)
    specificInstruction = `
      HÀNH ĐỘNG BẮT BUỘC: Quay phim nghệ thuật (CINEMATIC REVEAL) không gian đã hoàn thiện.
      - Không có người xuất hiện.
      - CHUYỂN ĐỘNG CAMERA: Camera di chuyển LIỀN MẠCH và CHẬM RÃI trong một chuyển động liên tục kéo dài 8 giây.
      - Sử dụng kết hợp xoay máy chậm (slow pan) và đẩy máy nhẹ (subtle push-in) để khoe các góc nhìn, vật liệu và ánh sáng hoàn hảo của thiết kế nội thất.
      - Hiển thị các đèn phát sáng và màn hình hoạt động như trong thiết kế cuối cùng.
      - không có hiệu ứng chuyển cảnh, không cắt cảnh, không chuyển tiếp.
    `;
  } else {
    // Logic cho các giai đoạn thi công trung gian
    specificInstruction = `
      HÀNH ĐỘNG BẮT BUỘC: Bao gồm 1-2 cô gái trẻ người Việt Nam mặc đồ thường ngày với chân váy ngắn và áo 2 dây.
      - Họ đang bận rộn làm việc, di chuyển một món đồ nội thất vào vị trí, treo ảnh, sắp xếp các đồ trang trí hoặc đang gỡ tấm nilon bảo vệ trong suốt 8s.
      - Căn phòng lộn xộn với các dụng cụ và tấm nilon trắng bảo vệ.
      - CAMERA: Cố định 100% và KHÓA CHẶT (Tripod shot). KHÔNG pan, KHÔNG zoom.
    `;
  }

  const prompt = `
    Hãy tạo một lời nhắc (prompt) video VEO-3 chi tiết cho một cảnh timelapse chân thực dài 8 giây.
    MÔ TẢ CẢNH: ${description}.
    TIẾN ĐỘ: Đã hoàn thành ${progress}%.
    
    ${specificInstruction}
    
    KHÔNG DÙNG HIỆU ỨNG ĐẶC BIỆT: Tuyệt đối không có hoạt ảnh ma thuật hay tia neon, không hiệu ứng, không chuyển cảnh, không cắt cảnh.
    KHÔNG KHÍ: Chân thực cao cấp như tạp chí kiến trúc. Ánh sáng chuyên nghiệp.
    
    THÔNG SỐ KỸ THUẬT: 9:16 aspect ratio, 4K resolution, 60fps, photorealistic.
    YÊU CẦU ĐẦU RA: Trả về DUY NHẤT 1 dòng bằng Tiếng Anh (English) để mô hình video hiểu rõ nhất. Không kèm nhãn hay tiêu đề.
    ĐỒ ĐẠC: PHẢI ĐƯỢC CON NGƯỜI ĐƯA VÀO hoặc chuyển đến 1 CÁCH TỰ NHIÊN. KHÔNG ĐƯỢC TỰ Ý XUẤT HIỆN HOẶC BIẾN ĐỔI trước sau.
    Các bề mặt như tưởng, sàn, cửa sổ, trần phải được thi công. không được tự ý biến từ trước sau cũ thành mới.
  `;

  const currentImagePart = base64ToGenerativePart(currentImageBase64);
  const contents: any[] = [{ text: prompt }, currentImagePart];
  if (previousImagePart) contents.push(previousImagePart);

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error) => {
    console.error("Lỗi tạo lời nhắc video timelapse:", error);
    return `Timelapse of ${context.subject}, ${progress}% progress.`;
  });
};
