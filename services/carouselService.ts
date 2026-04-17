import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getAiClient, callWithAiFallback } from "./keyService";
import { getScriptLengthInstruction, getPersonaContext, getLanguageLabel } from "../utils/languageUtils";

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

const hexToRgba = (hex: string, alpha: number) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyTextOverlay = async (
    imageUrl: string, 
    text: string, 
    position: 'Top' | 'Bottom' | 'Center',
    fontId: string = 'Montserrat',
    textColor: string = '#FFFFFF',
    userFontSize: number = 60,
    overlayColor: string = '#000000',
    alignment: 'left' | 'center' = 'center',
    showOverlay: boolean = true,
    overlayOpacity: number = 60
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(imageUrl); return; }

            ctx.drawImage(img, 0, 0);

            const scaleFactor = img.width / 1200;
            let baseFontSize = Math.floor(userFontSize * scaleFactor);
            
            let fontFamily = 'Montserrat, sans-serif';
            switch(fontId) {
              case 'Roboto': fontFamily = '"Roboto", sans-serif'; break;
              case 'Montserrat': fontFamily = '"Montserrat", sans-serif'; break;
              case 'Open Sans': fontFamily = '"Open Sans", sans-serif'; break;
              case 'Oswald': fontFamily = '"Oswald", sans-serif'; break;
              case 'Noto Sans': fontFamily = '"Noto Sans", sans-serif'; break;
              case 'Playfair Display': fontFamily = '"Playfair Display", serif'; break;
              case 'Lora': fontFamily = '"Lora", serif'; break;
              case 'Merriweather': fontFamily = '"Merriweather", serif'; break;
              case 'Pacifico': fontFamily = '"Pacifico", cursive'; break;
              case 'Dancing Script': fontFamily = '"Dancing Script", cursive'; break;
              case 'Lobster': fontFamily = '"Lobster", cursive'; break;
              case 'Charm': fontFamily = '"Charm", cursive'; break;
              case 'Mali': fontFamily = '"Mali", cursive'; break;
              case 'Patrick Hand': fontFamily = '"Patrick Hand", cursive'; break;
              case 'Baloo 2': fontFamily = '"Baloo 2", cursive'; break;
              case 'Comfortaa': fontFamily = '"Comfortaa", cursive'; break;
              case 'Quicksand': fontFamily = '"Quicksand", sans-serif'; break;
              case 'Josefin Sans': fontFamily = '"Josefin Sans", sans-serif'; break;
              case 'Archivo Black': fontFamily = '"Archivo Black", sans-serif'; break;
              case 'Saira Stencil One': fontFamily = '"Saira Stencil One", cursive'; break;
              case 'Noto Sans SC': fontFamily = '"Noto Sans SC", sans-serif'; break;
            }
            
            const fontWeight = ['Pacifico', 'Lobster', 'Archivo Black', 'Saira Stencil One'].includes(fontId) ? '' : '900';
            ctx.font = `${fontWeight} ${baseFontSize}px ${fontFamily}`;
            
            const spacing = Math.floor(baseFontSize * 0.05);
            if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = `${spacing}px`; }

            const maxWidth = img.width * 0.92;
            const lineHeight = baseFontSize * 1.35;

            const wrapTextToLines = (txt: string): string[] => {
                const paragraphs = txt.split('\n');
                let allLines: string[] = [];

                paragraphs.forEach(para => {
                    const words = para.trim().split(' ');
                    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
                        allLines.push("");
                        return;
                    }
                    let currentLine = words[0];

                    for (let i = 1; i < words.length; i++) {
                        const width = ctx.measureText(currentLine + " " + words[i]).width;
                        if (width < maxWidth) {
                            currentLine += " " + words[i];
                        } else {
                            allLines.push(currentLine);
                            currentLine = words[i];
                        }
                    }
                    allLines.push(currentLine);
                });
                return allLines;
            };

            const lines = wrapTextToLines(text);
            const totalTextHeight = lines.length * lineHeight;
            const paddingV = img.height * 0.08;
            const paddingH = img.width * 0.04;

            let startY = 0;
            if (position === 'Top') {
                startY = paddingV;
            } else if (position === 'Bottom') {
                startY = img.height - totalTextHeight - paddingV;
            } else { // Center
                startY = (img.height - totalTextHeight) / 2;
            }

            // --- VẼ LỚP PHỦ PHỦ TOÀN BỘ ẢNH (DYNAMC OPACITY) ---
            if (showOverlay) {
                ctx.fillStyle = hexToRgba(overlayColor, overlayOpacity / 100);
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // --- VẼ CHỮ ---
            ctx.fillStyle = textColor;
            ctx.textAlign = alignment === 'center' ? 'center' : 'left';
            ctx.textBaseline = 'middle';
            
            ctx.lineWidth = Math.max(3, baseFontSize * 0.12);
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            
            let currentY = startY + (lineHeight / 2);
            const x = alignment === 'center' ? img.width / 2 : paddingH;
            
            lines.forEach(line => {
               if (line !== "") {
                   ctx.strokeText(line, x, currentY);
                   ctx.fillText(line, x, currentY);
               }
               currentY += lineHeight;
            });

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
    });
};

export const generateCarouselScript = async (
  topic: string, 
  imageCount: number, 
  notes: string, 
  productName: string,
  category: string, 
  subCategory: string, 
  storyIdea: string,
  gender: string = 'Nữ',
  addressing: string = '',
  language: string = 'vi'
): Promise<string[]> => {
  const targetLang = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);

  const strategy = `CHIẾN LƯỢC: Tạo sự đồng cảm, khai thác Insight, hoặc kể chuyện cá nhân. NHÂN VẬT: Giới tính ${gender}, là ${persona}. BỐI CẢNH: ${context}.`;
  
  const categoryInstruction = category === "Giữ nguyên văn phong kịch bản" 
    ? "GIỮ NGUYÊN VĂN PHONG: Hãy tôn trọng tối đa văn phong và cách diễn đạt của người dùng trong Topic/Story, chỉ điều chỉnh độ dài để khớp với số slide và yêu cầu ký tự."
    : `DANH MỤC: ${category}${subCategory ? ` - ${subCategory}` : ""}. Hãy viết theo phong cách phù hợp với danh mục này.`;

  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Tạo kịch bản cho ${imageCount} slide TikTok Carousel. 
    Topic: "${topic}". 
    Story: "${storyIdea}". 
    Pro: ${productName}. 
    Note: ${notes}. 
    ${strategy}
    ${categoryInstruction}
    
    XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe).
    
    !!! YÊU CẦU ĐỘ DÀI NGHIÊM NGẶT !!!:
    - Mỗi slide BẮT BUỘC chỉ gồm 1 câu duy nhất.
    - ${lengthInstruction}
    - Ngôn ngữ: ${targetLang} chuẩn 100%, viral, súc tích.
    
    Trả về mảng JSON các chuỗi ký tự.
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
  }).catch((e) => {
    console.error("Lỗi tạo kịch bản Carousel:", e);
    return [];
  });
};

export const generateCarouselImage = async (
  productImages: any[], 
  faceImage: any | null, 
  textContent: string,
  characterNote: string, 
  extraNote: string, 
  regenerateNote: string,
  fontFamily: string = "Montserrat", 
  textPosition: string = "Bottom",
  gender: string = 'Nữ',
  textColor: string = '#FFFFFF',
  overlayColor: string = '#000000',
  fontSize: number = 60,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  alignment: 'left' | 'center' = 'center',
  showOverlay: boolean = true,
  overlayOpacity: number = 60,
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('image');
  const is3D = imageStyle === '3D';
  const { persona, context } = getPersonaContext(language);
  
  const baseStyle = is3D 
    ? "3D Animation Pixar/Disney style, vibrant colors, expressive 3D character design, high-quality CGI."
    : "Photorealistic RAW PHOTO, professional lifestyle commercial photography, cinematic lighting, 8k resolution.";

  const prompt = `
    TASK: Generate a high-quality ${is3D ? '3D Animation' : 'Photorealistic'} slide for TikTok Carousel (3:4 ratio).
    ${baseStyle}
    
    CONSISTENCY:
    - FACE: Match provided Face reference exactly.
    - GENDER: Adult ${gender}, ${persona}.
    - OUTFIT: ${characterNote}.
    - PRODUCT: Must match input reference image exactly.

    SUBJECT: A ${persona} in a lifestyle setting.
    CONTEXT: ${context}.
    VIBE: Matching the story: "${textContent}".
    SCENE: ${extraNote}. ${regenerateNote ? `Feedback: ${regenerateNote}` : ""}
    STRICT CONSTRAINT: NO TEXT IN IMAGE. 
    
    COMPOSITION GUIDANCE FOR TEXT OVERLAY:
    - Text Content: "${textContent}"
    - Text Position: ${textPosition}
    - Alignment: ${alignment}
    - Text Color: ${textColor}
    - Overlay: ${showOverlay ? `Yes (Color: ${overlayColor}, Opacity: ${overlayOpacity})` : "No"}
    Please ensure the composition leaves appropriate negative space at the ${textPosition} for this text overlay. DO NOT generate the text itself.
  `;

  const parts: any[] = [{ text: prompt }];
  if (faceImage) parts.push({ inlineData: faceImage });
  productImages.forEach(p => parts.push({ inlineData: p }));

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });
    
    const imgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imgPart?.inlineData?.data) throw new Error("No image generated");

    const rawBase64 = `data:image/png;base64,${imgPart.inlineData.data}`;
    return await applyTextOverlay(rawBase64, textContent, textPosition as any, fontFamily, textColor, fontSize, overlayColor, alignment, showOverlay, overlayOpacity);
  });
};

export const generateCarouselImagePrompt = async (
  textContent: string,
  characterNote: string,
  extraNote: string,
  regenerateNote: string,
  gender: string = 'Nữ',
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  userCustomPrompt: string | undefined = "",
  textPosition: string = 'Bottom',
  alignment: string = 'center',
  textColor: string = '#FFFFFF',
  overlayColor: string = '#000000',
  overlayOpacity: number = 0.5,
  showOverlay: boolean = true,
  language: string = 'vi'
): Promise<string> => {
  const is3D = imageStyle === '3D';
  const baseStyle = is3D ? "Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, CGI tinh xảo, màu sắc rực rỡ" : "Ảnh chụp RAW PHOTO chân thực, 8k, ánh sáng tự nhiên mang tính điện ảnh";

  const targetLang = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);

  const prompt = `Bạn là một chuyên gia viết prompt cho AI tạo ảnh (Midjourney/DALL-E/Imagen).
Nhiệm vụ: Viết một lời nhắc (Prompt) cực kỳ chi tiết bằng ${targetLang} để tạo ảnh cho slide TikTok Carousel (tỷ lệ 3:4).

QUY TẮC BẮT BUỘC:
1. KHÔNG BAO GIỜ có chữ, văn bản, logo, watermark trong ảnh.
2. Tỷ lệ khung hình: 3:4 (Portrait).
3. Phong cách: ${baseStyle}.
4. Bố cục tập trung vào chủ thể, rõ nét, chi tiết cao.
5. Nhân vật chính: ${persona}, giới tính ${gender}.
6. Bối cảnh: ${context}.

THÔNG TIN CHI TIẾT VỀ HÌNH ẢNH:
    - Nội dung slide: "${textContent}"
    - Đặc điểm nhân vật: ${characterNote}
    - Ghi chú thêm: ${extraNote}
    ${regenerateNote ? `- Yêu cầu điều chỉnh: ${regenerateNote}` : ""}
    ${userCustomPrompt ? `- Prompt tùy chỉnh từ người dùng: ${userCustomPrompt}` : ""}
    
    BỐ CỤC CHỮ TRÊN ẢNH (QUAN TRỌNG):
    - Vị trí chữ: ${textPosition}.
    - Căn lề: ${alignment}.
    - Màu chữ: ${textColor}.
    - Màu lớp phủ: ${overlayColor} (Độ mờ: ${overlayOpacity * 100}%).
    - Hiển thị lớp phủ: ${showOverlay ? "Có" : "Không"}.
    => Hãy mô tả không gian trống trong ảnh để chèn chữ vào vị trí ${textPosition} mà không che mất chủ thể.
    
    Chỉ trả về chuỗi prompt bằng ${targetLang}, không thêm giải thích.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text || "";
  }).catch((error) => {
    console.error("Lỗi tạo prompt ảnh Carousel:", error);
    return "";
  });
};
