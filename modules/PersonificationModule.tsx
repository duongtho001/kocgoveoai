
import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/personificationService';
import { PersonificationSegment } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { safeSaveToLocalStorage } from '../utils/storage';
import { theme } from '../constants/colors';

declare var JSZip: any;

const ADDRESSING_OPTIONS = [
  "em - anh chị",
  "em - các bác",
  "tôi - các bạn",
  "tớ - các cậu",
  "mình - các bạn",
  "tao - mày",
  "tui - mấy bà",
  "tui - mấy ní",
  "tui - các bác",
  "tui - mấy ông",
  "mình - cả nhà",
  "mình - mọi người"
];

const VOICE_OPTIONS = [
  "Giọng miền Bắc 20-30 tuổi",
  "Giọng miền Nam 20-30 tuổi",
  "Giọng miền Bắc 50-60 tuổi",
  "Giọng miền Nam 50-60 tuổi",
  "Giọng miền Bắc 60-80 tuổi",
  "Giọng miền Nam 60-80 tuổi",
  "Giọng miền Bắc 5-10 tuổi",
  "Giọng miền Nam 5-10 tuổi"
];

const STYLES = [
    { id: 'arrogant_invader', label: 'Công thức 1: Kẻ Xâm Nhập Ngạo Mạn' },
    { id: 'stubborn_parasite', label: 'Công thức 2: Kẻ Ăn Bám Lì Lợm' },
    { id: 'secret_saboteur', label: 'Công thức 3: Kẻ Thao Túng Bí Mật' },
    { id: 'energy_vampire', label: 'Công thức 4: Kẻ Hút Cạn Năng Lượng' },
    { id: 'blocking_barrier', label: 'Công thức 5: Bức Tường Ngăn Cách' },
    { id: 'social_saboteur', label: 'Công thức 6: Kẻ Phá Bĩnh Đám Đông' },
    { id: 'cravings_monster', label: 'Công thức 7: Bậc Thầy Ảo Giác' },
    { id: 'silent_destroyer', label: 'Công thức 8: Kẻ Ăn Mòn Thầm Lặng' },
    { id: 'internal_chaos', label: 'Công thức 9: Kẻ Nổi Loạn Bên Trong' },
    { id: 'unwanted_returner', label: 'Công thức 10: Kẻ Phục Sinh Dai Dẳng' }
];

interface PersonificationModuleProps {
  language?: string;
}

const PersonificationModule: React.FC<PersonificationModuleProps> = ({ language = 'vi' }) => {
  const storageKey = "personification_project_v7_voice_sync";
  const [state, setState] = useState<any>({
    healthKeyword: '',
    ctaProduct: '',
    frameCount: 4,
    gender: 'Nữ',
    voice: VOICE_OPTIONS[0],
    addressing: '',
    style: STYLES[0].id,
    visualStyle: '3D',
    characterDescription: '',
    backgroundDescription: '',
    characterFile: null,
    characterPreviewUrl: null,
    productFiles: [],
    productPreviews: [],
    isGeneratingScript: false,
    isGeneratingChar: false,
    isAnalyzingBackground: false,
    isBulkImageLoading: false,
    isBulkPromptLoading: false,
    segments: []
  });
  const [copyStatus, setCopyStatus] = useState<{[key: string]: boolean}>({});

  const handleCopy = async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopyStatus(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [id]: false }));
      }, 2000);
    }
  };

  const productInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);

  // Restore from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((p: any) => ({ 
          ...p, 
          ...parsed, 
          visualStyle: parsed.visualStyle || '3D',
          productFiles: [], 
          productPreviews: parsed.productPreviews || [], 
          characterDescription: parsed.characterDescription || '',
          backgroundDescription: parsed.backgroundDescription || '',
          characterFile: null,
          characterPreviewUrl: parsed.characterPreviewUrl || null,
          segments: (parsed.segments || []).map((s: any) => ({ 
            ...s, 
            showProduct: s.showProduct !== undefined ? s.showProduct : true,
            image: { ...s.image, url: s.image.url || '', loading: false },
            imagePrompt: { ...s.imagePrompt, loading: false },
            videoPrompt: { ...s.videoPrompt, loading: false }
          })) 
        }));
      }
    } catch (e) {}
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    const { productFiles, characterFile, isGeneratingScript, ...rest } = state;
    safeSaveToLocalStorage(storageKey, rest);
  }, [state]);

  // HANDLE GLOBAL IMPORT / EXPORT
  useEffect(() => {
    const handleExport = async () => {
      const getBase64 = async (file: File | null, fallbackUrl: string | null) => {
        if (file) {
          const part = await service.fileToGenerativePart(file);
          return `data:${part.mimeType};base64,${part.data}`;
        }
        if (!fallbackUrl) return "";
        if (fallbackUrl.startsWith('data:')) return fallbackUrl;
        if (fallbackUrl.startsWith('blob:')) {
          try {
            const response = await fetch(fallbackUrl);
            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.error("Failed to convert blob to base64", e);
            return "";
          }
        }
        return "";
      };

      const productImagesBase64 = await Promise.all(
        state.productFiles.length > 0 
          ? state.productFiles.map((f: File) => getBase64(f, null))
          : state.productPreviews.map((url: string) => url.startsWith('data:') ? Promise.resolve(url) : Promise.resolve(""))
      );

      const charImageBase64 = await getBase64(state.characterFile, state.characterPreviewUrl);

      const exportData = state.segments.map((seg: any, index: number) => ({
        stt: index + 1,
        inputs: {
          healthKeyword: state.healthKeyword,
          ctaProduct: state.ctaProduct,
          characterDescription: state.characterDescription,
          sceneIdea: seg.sceneIdea,
          inputMedia: {
            productImages: productImagesBase64.filter(i => i),
            characterReference: charImageBase64
          },
          settings: {
            gender: state.gender,
            voice: state.voice,
            addressing: state.addressing,
            style: state.style,
            visualStyle: state.visualStyle,
            frameCount: state.frameCount,
            regenNote: seg.image.regenNote
          }
        },
        script: seg.content,
        outputImage: seg.image.url || '',
        imagePrompt: seg.imagePrompt?.text || '',
        videoPrompt: seg.videoPrompt.text || ''
      }));

      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
        detail: { data: exportData, moduleName: 'Nhan_Hoa_Project' } 
      }));
    };

    const smartFind = (obj: any, keys: string[]) => {
      if (!obj) return undefined;
      const lowerKeys = keys.map(k => k.toLowerCase());
      const foundKey = Object.keys(obj).find(k => lowerKeys.includes(k.toLowerCase()));
      return foundKey ? obj[foundKey] : undefined;
    };

    const handleImport = async (e: any) => {
      const importedData = e.detail;
      if (!Array.isArray(importedData) || importedData.length === 0) return;

      const firstItem = importedData[0];
      const inputs = smartFind(firstItem, ['inputs', 'input', 'data']) || {};
      const settings = smartFind(inputs, ['settings', 'config']) || {};
      const media = smartFind(inputs, ['inputMedia', 'media']) || {};

      const newState = {
        ...state,
        healthKeyword: smartFind(inputs, ['healthKeyword', 'keyword']) || state.healthKeyword,
        ctaProduct: smartFind(inputs, ['ctaProduct', 'product']) || state.ctaProduct,
        characterDescription: smartFind(inputs, ['characterDescription', 'character']) || state.characterDescription,
        gender: smartFind(settings, ['gender']) || state.gender,
        voice: smartFind(settings, ['voice']) || state.voice,
        addressing: smartFind(settings, ['addressing', 'xưng hô']) || state.addressing,
        style: smartFind(settings, ['style', 'phong cách']) || state.style,
        visualStyle: smartFind(settings, ['visualStyle', 'phong cách hình ảnh']) || state.visualStyle,
        frameCount: smartFind(settings, ['frameCount', 'frames']) || importedData.length,
        productPreviews: smartFind(media, ['productImages', 'images']) || [],
        characterPreviewUrl: smartFind(media, ['characterReference', 'char_img']) || "",
        segments: []
      };

      const total = importedData.length;
      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const itemInputs = smartFind(item, ['inputs', 'input']) || {};
        const itemSettings = smartFind(itemInputs, ['settings']) || {};
        const itemSegmentData = smartFind(itemInputs, ['segmentData']) || {};
        
        newState.segments.push({
          id: i + 1,
          sceneIdea: smartFind(itemInputs, ['sceneIdea', 'ý tưởng cảnh']) || '',
          content: smartFind(item, ['script', 'content', 'text']) || '',
          image: {
            url: smartFind(item, ['outputImage', 'image', 'base64']) || '',
            loading: false,
            regenNote: smartFind(itemSettings, ['regenNote', 'ghi chú sửa', 'customPrompt']) || smartFind(itemSegmentData, ['characterIdea']) || ''
          },
          imagePrompt: {
            text: smartFind(item, ['imagePrompt', 'prompt_anh']) || '',
            loading: false,
            visible: !!smartFind(item, ['imagePrompt', 'prompt_anh'])
          },
          videoPrompt: {
            text: smartFind(item, ['videoPrompt', 'prompt']) || '',
            loading: false,
            visible: !!smartFind(item, ['videoPrompt', 'prompt'])
          }
        });

        const percent = Math.round(((i + 1) / total) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { 
          detail: { percent, complete: i === total - 1 } 
        }));
        await new Promise(r => setTimeout(r, 50));
      }

      setState(newState);
    };

    window.addEventListener('REQUEST_EXPORT_DATA', handleExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleImport);
    };
  }, [state]);

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = (Array.from(e.target.files) as File[]).slice(0, 5);
      const urls = files.map(f => URL.createObjectURL(f));
      setState((p: any) => ({ ...p, productFiles: files, productPreviews: urls }));
    }
  };

  const handleCharacterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setState((p: any) => ({ ...p, characterFile: file, characterPreviewUrl: URL.createObjectURL(file) }));
    }
  };

  const handleClearCharacter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((p: any) => ({ ...p, characterFile: null, characterPreviewUrl: null }));
    if (characterInputRef.current) characterInputRef.current.value = "";
  };

  const handleGenCharacterRef = async () => {
    if (!state.healthKeyword || !state.ctaProduct) return alert("Vui lòng nhập Ý tưởng và Sản phẩm trước.");
    setState((p: any) => ({ ...p, isGeneratingChar: true }));
    try {
      const url = await service.generateCharacterRef(
        state.healthKeyword,
        state.ctaProduct,
        state.characterDescription,
        state.visualStyle,
        state.gender
      );
      setState((p: any) => ({ ...p, characterPreviewUrl: url, isGeneratingChar: false }));
    } catch (e) {
      setState((p: any) => ({ ...p, isGeneratingChar: false }));
      alert("Lỗi khi tạo ảnh nhân vật mẫu.");
    }
  };

  const handleAnalyzeBackground = async () => {
    if (!state.backgroundDescription) return alert("Vui lòng nhập mô tả bối cảnh cơ bản trước.");
    setState((p: any) => ({ ...p, isAnalyzingBackground: true }));
    try {
      let backgroundPart = null;
      if (state.productFiles.length > 0) {
        backgroundPart = await service.fileToGenerativePart(state.productFiles[0]);
      } else if (state.productPreviews.length > 0 && state.productPreviews[0].startsWith('data:')) {
        backgroundPart = { mimeType: 'image/png', data: state.productPreviews[0].split(',')[1] };
      }

      const detailed = await service.analyzeDetailedBackground(state.backgroundDescription, backgroundPart);
      setState((p: any) => ({ ...p, backgroundDescription: detailed, isAnalyzingBackground: false }));
    } catch (e) {
      setState((p: any) => ({ ...p, isAnalyzingBackground: false }));
      alert("Lỗi khi phân tích bối cảnh.");
    }
  };

  const handleGenerateScript = async () => {
    if (!state.healthKeyword || !state.ctaProduct) return;
    setState((p: any) => ({ ...p, isGeneratingScript: true }));
    try {
      const scripts = await service.generatePersonificationScript(
        state.healthKeyword,
        state.ctaProduct,
        state.frameCount,
        state.gender,
        state.voice,
        state.addressing,
        state.style,
        state.characterDescription,
        state.backgroundDescription,
        language
      );
      const newSegments = scripts.map((content, i) => {
        const hasProduct = content.toLowerCase().includes(state.ctaProduct.toLowerCase());
        return {
          id: i + 1,
          sceneIdea: '',
          content,
          showProduct: hasProduct,
          image: { url: '', loading: false, regenNote: '' },
          imagePrompt: { text: '', loading: false, visible: false },
          videoPrompt: { text: '', loading: false, visible: false }
        };
      });
      setState((p: any) => ({ ...p, segments: newSegments, isGeneratingScript: false }));
    } catch (e) {
      setState((p: any) => ({ ...p, isGeneratingScript: false }));
    }
  };

  const handleGenImage = async (id: number) => {
    setState((p: any) => ({ 
      ...p, 
      segments: p.segments.map((s: any) => s.id === id ? { ...s, image: { ...s.image, loading: true } } : s) 
    }));
    
    try {
      const currentSeg = state.segments.find((s: any) => s.id === id);
      
      let productParts = [];
      if (state.productFiles.length > 0) {
        productParts = await Promise.all(state.productFiles.map((f: any) => service.fileToGenerativePart(f)));
      } else {
        productParts = state.productPreviews.map((url: string) => ({ 
          mimeType: 'image/png', 
          data: url.split(',')[1] 
        }));
      }
      
      let charPart = null;
      if (state.characterFile) {
        charPart = await service.fileToGenerativePart(state.characterFile);
      } else if (state.characterPreviewUrl?.startsWith('data:')) {
        charPart = { mimeType: 'image/png', data: state.characterPreviewUrl.split(',')[1] };
      }

      const url = await service.generatePersonificationImage(
        currentSeg.content, 
        state.healthKeyword, 
        state.ctaProduct, 
        state.gender, 
        state.characterDescription, 
        state.backgroundDescription,
        currentSeg.sceneIdea,
        currentSeg.id,
        state.segments.length,
        currentSeg.image.regenNote,
        currentSeg.showProduct,
        state.visualStyle,
        charPart || undefined,
        productParts,
        language
      );
      
      setState((p: any) => ({ 
        ...p, 
        segments: p.segments.map((s: any) => s.id === id ? { ...s, image: { ...s.image, url, loading: false } } : s) 
      }));
    } catch (e) {
      setState((p: any) => ({ 
        ...p, 
        segments: p.segments.map((s: any) => s.id === id ? { ...s, image: { ...s.image, loading: false } } : s) 
      }));
    }
  };

  const handleDeleteImage = (id: number) => {
    setState((p: any) => ({
      ...p,
      segments: p.segments.map((s: any) => s.id === id ? { ...s, image: { ...s.image, url: '' } } : s)
    }));
  };

  const handleUploadImage = async (id: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setState((p: any) => ({
        ...p,
        segments: p.segments.map((s: any) => s.id === id ? { ...s, image: { ...s.image, url, loading: false } } : s)
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleGenImagePrompt = async (id: number) => {
    setState((p: any) => ({ 
      ...p, 
      segments: p.segments.map((s: any) => s.id === id ? { ...s, imagePrompt: { ...s.imagePrompt, loading: true, visible: true } } : s) 
    }));
    
    try {
      const currentSeg = state.segments.find((s: any) => s.id === id);
      const prompt = await service.generatePersonificationImagePromptAI(
        currentSeg.content, 
        state.gender, 
        state.voice, 
        state.style, 
        state.characterDescription, 
        state.backgroundDescription,
        currentSeg.sceneIdea,
        currentSeg.id,
        state.segments.length,
        state.visualStyle,
        currentSeg.image.regenNote,
        language
      );
      setState((p: any) => ({ 
        ...p, 
        segments: p.segments.map((s: any) => s.id === id ? { ...s, imagePrompt: { text: prompt, loading: false, visible: true } } : s) 
      }));
    } catch (e) {
      setState((p: any) => ({ 
        ...p, 
        segments: p.segments.map((s: any) => s.id === id ? { ...s, imagePrompt: { ...s.imagePrompt, loading: false } } : s) 
      }));
    }
  };

  const handleGenPrompt = async (id: number) => {
    setState((p: any) => ({ 
      ...p, 
      segments: p.segments.map((s: any) => s.id === id ? { ...s, videoPrompt: { ...s.videoPrompt, loading: true, visible: true } } : s) 
    }));
    
    try {
      const currentSeg = state.segments.find((s: any) => s.id === id);
      const prompt = await service.generatePersonificationVeoPrompt(
        currentSeg.content, 
        state.healthKeyword, 
        state.ctaProduct,
        state.gender, 
        state.voice, 
        state.style, 
        state.characterDescription, 
        state.backgroundDescription,
        currentSeg.sceneIdea,
        currentSeg.id,
        state.segments.length,
        state.visualStyle,
        language
      );
      setState((p: any) => ({ 
        ...p, 
        segments: p.segments.map((s: any) => s.id === id ? { ...s, videoPrompt: { text: prompt, loading: false, visible: true } } : s) 
      }));
    } catch (e) {
      setState((p: any) => ({ 
        ...p, 
        segments: p.segments.map((s: any) => s.id === id ? { ...s, videoPrompt: { ...s.videoPrompt, loading: false } } : s) 
      }));
    }
  };

  const handleBulkImage = async () => {
    if (state.segments.length === 0) return;
    setState((p: any) => ({ ...p, isBulkImageLoading: true }));
    for (const seg of state.segments) {
      await handleGenImage(seg.id);
    }
    setState((p: any) => ({ ...p, isBulkImageLoading: false }));
  };

  const handleBulkImagePrompt = async () => {
    if (state.segments.length === 0) return;
    setState((p: any) => ({ ...p, isBulkPromptLoading: true }));
    for (const seg of state.segments) {
      await handleGenImagePrompt(seg.id);
    }
    setState((p: any) => ({ ...p, isBulkPromptLoading: false }));
  };

  const handleBulkVideoPrompt = async () => {
    if (state.segments.length === 0) return;
    setState((p: any) => ({ ...p, isBulkPromptLoading: true }));
    for (const seg of state.segments) {
      await handleGenPrompt(seg.id);
    }
    setState((p: any) => ({ ...p, isBulkPromptLoading: false }));
  };

  const downloadAllImages = async () => {
    if (typeof JSZip === 'undefined') return alert("ZIP lib not loaded");
    const zip = new JSZip();
    let count = 0;
    state.segments.forEach((seg: any, i: number) => {
      if (seg.image.url) { zip.file(`${String(i + 1).padStart(2, '0')}.png`, seg.image.url.split(',')[1], { base64: true }); count++; }
    });
    if (count === 0) return alert("Không có ảnh.");
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a'); link.href = URL.createObjectURL(content as any); link.download = `nhan_hoa_${Date.now()}.zip`; link.click();
  };

  const downloadAllVideoPromptsTxt = () => {
    const text = state.segments.map((s: any) => s.videoPrompt?.text || "").filter((t: string) => t).join('\n');
    if (!text) return alert("Vui lòng tạo Video Prompt.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `video_prompts_nhan_hoa_${Date.now()}.txt`; link.click();
  };

  const downloadAllImagePromptsTxt = () => {
    const text = state.segments.map((s: any) => s.imagePrompt?.text || "").filter((t: string) => t).join('\n');
    if (!text) return alert("Vui lòng tạo Image Prompt.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `image_prompts_nhan_hoa_${Date.now()}.txt`; link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CỘT TRÁI */}
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">1. USP sản phẩm</label>
              <textarea 
                value={state.healthKeyword}
                onChange={e => setState((p: any) => ({ ...p, healthKeyword: e.target.value }))}
                placeholder="Nhập các điểm bán hàng độc nhất (USP) của sản phẩm..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium text-sm h-40 resize-none leading-relaxed shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">2. Sản phẩm muốn CTA</label>
              <input 
                type="text" 
                value={state.ctaProduct}
                onChange={e => setState((p: any) => ({ ...p, ctaProduct: e.target.value }))}
                placeholder="Ví dụ: máy massage, trà thảo mộc..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">Giới tính</label>
                <select value={state.gender} onChange={e => setState((p: any) => ({ ...p, gender: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm outline-none">
                  <option value="Nữ">Nữ</option>
                  <option value="Nam">Nam</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">Giọng điệu (Vùng miền & Tuổi)</label>
                <select value={state.voice} onChange={e => setState((p: any) => ({ ...p, voice: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm outline-none text-[10px]">
                  {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">Cách xưng hô</label>
                <div className="relative">
                  <input 
                    list="personification-addressing-list"
                    value={state.addressing} 
                    onChange={e => setState((p: any) => ({ ...p, addressing: e.target.value }))}
                    placeholder="VD: em - anh chị"
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-sm shadow-sm"
                  />
                  <datalist id="personification-addressing-list">
                    {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">Bố cục kịch bản</label>
                <select value={state.style} onChange={e => setState((p: any) => ({ ...p, style: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm outline-none">
                  {STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI */}
          <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">Phong cách hình ảnh</label>
                <select value={state.visualStyle} onChange={e => setState((p: any) => ({ ...p, visualStyle: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm outline-none">
                  <option value="3D">3D Animation (Pixar style)</option>
                  <option value="Realistic">Chân thực (Realistic Photo)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">Thời lượng video</label>
                <select value={state.frameCount} onChange={e => setState((p: any) => ({ ...p, frameCount: parseInt(e.target.value) }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-blue-600 shadow-sm outline-none">
                  {Array.from({ length: 12 }, (_, i) => i + 4).map(n => <option key={n} value={n}>{n} khung hình - {n * 8}s</option>)}
                </select>
              </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">4. Nhân vật & Bối cảnh (Mẫu)</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  onClick={() => characterInputRef.current?.click()}
                  className="relative aspect-square border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:border-blue-400 transition-all overflow-hidden shadow-sm"
                >
                  {state.characterPreviewUrl ? (
                    <>
                      <img src={state.characterPreviewUrl} className="w-full h-full object-cover" alt="char-ref" />
                      <button 
                        onClick={handleClearCharacter}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg z-10"
                        title="Xóa ảnh nhân vật"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : (
                    <div className="text-center opacity-30">
                       <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                       <span className="text-[8px] font-black uppercase tracking-tighter">Ảnh nhân vật</span>
                    </div>
                  )}
                  <input type="file" ref={characterInputRef} onChange={handleCharacterUpload} className="hidden" accept="image/*" />
                </div>
          <div className="md:col-span-2 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mô tả nhân vật & Vị trí</label>
                    <textarea 
                      value={state.characterDescription}
                      onChange={e => setState((p: any) => ({ ...p, characterDescription: e.target.value }))}
                      placeholder="Mô tả nhân vật và vị trí (VD: Mụn cóc xù xì trên ngón tay, Răng sâu đen kịt trong hàm răng...)"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium text-xs h-32 resize-none leading-relaxed shadow-inner"
                    />
                  </div>
                  <div className="space-y-2">
                    <button 
                      onClick={handleGenCharacterRef}
                      disabled={state.isGeneratingChar || !state.healthKeyword || !state.ctaProduct}
                      style={{ backgroundColor: 'var(--primary-color)' }}
                      className="w-full py-2 text-white text-[10px] font-black rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest shadow-md"
                    >
                      {state.isGeneratingChar ? (
                        <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> ĐANG VẼ...</>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> TẠO NHÂN VẬT TRÊN NỀN TRẮNG</>
                      )}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Bối cảnh chung</label>
                      <button 
                        onClick={handleAnalyzeBackground}
                        disabled={state.isAnalyzingBackground || !state.backgroundDescription}
                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all disabled:opacity-50 shadow-sm"
                        title="Phân tích bối cảnh chi tiết"
                      >
                        {state.isAnalyzingBackground ? (
                          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-6.364l-.707-.707M6.364 18.364l.707-.707M18.364 18.364l-.707-.707M12 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <textarea 
                      value={state.backgroundDescription}
                      onChange={e => setState((p: any) => ({ ...p, backgroundDescription: e.target.value }))}
                      placeholder="Mô tả bối cảnh chung (VD: Trong phòng khách, Trong bệnh viện, Khu rừng kỳ ảo...)"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium text-xs h-24 resize-none leading-relaxed shadow-inner"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest px-1">5. Ảnh sản phẩm mẫu (Max 5)</label>
              <div onClick={() => productInputRef.current?.click()} className="min-h-[140px] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-all overflow-hidden p-2 shadow-sm">
                {state.productPreviews.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2 w-full">{state.productPreviews.map((url: string, i: number) => <img key={i} src={url} className="w-full aspect-square object-cover rounded-lg" />)}</div>
                ) : (
                  <div className="text-center opacity-30"><svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-[10px] font-black uppercase tracking-widest">Tải ảnh sản phẩm</span></div>
                )}
                <input type="file" multiple ref={productInputRef} onChange={handleProductUpload} className="hidden" accept="image/*" />
              </div>
            </div>
            
            <button 
              onClick={handleGenerateScript} 
              disabled={state.isGeneratingScript || !state.healthKeyword || !state.ctaProduct} 
              style={{ backgroundColor: 'var(--primary-color)' }}
              className="w-full py-5 text-white font-black rounded-2xl shadow-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest"
            >
              {state.isGeneratingScript ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> ĐANG TẠO KỊCH BẢN...</> : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {state.segments.length > 0 && (
        <div className="space-y-12 pb-32">
          <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl gap-4">
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Kịch bản chi tiết ({state.frameCount} khung)</h3>
              <p className={`text-[10px] ${theme.colors.primaryText} font-bold uppercase tracking-widest mt-1`}>{state.voice} • {state.style}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {state.segments.map((seg: any) => (
              <div key={seg.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full group hover:shadow-xl transition-all">
                <div className="relative aspect-[9/16] bg-slate-100 overflow-hidden">
                  {seg.image.url ? (
                    <>
                      <img src={seg.image.url} className={`w-full h-full object-cover ${seg.image.loading ? 'blur-sm grayscale opacity-50' : ''}`} />
                      <button 
                        onClick={() => handleDeleteImage(seg.id)}
                        className="absolute top-4 right-4 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-all z-10"
                        title="Xóa hình ảnh"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : null}
                  
                  {seg.image.loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/5 backdrop-blur-[2px]">
                      <div className={`w-10 h-10 border-4 ${theme.colors.primaryBorder} border-t-transparent rounded-full animate-spin`}></div>
                      <span className={`mt-4 text-[10px] font-black ${theme.colors.primaryText} uppercase tracking-widest animate-pulse`}>Đang vẽ...</span>
                    </div>
                  ) : !seg.image.url && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                       <div className="flex flex-col items-center gap-4">
                          <svg className="w-12 h-12 text-slate-300 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <button 
                              onClick={() => document.getElementById(`seg-image-upload-${seg.id}`)?.click()}
                              className="w-32 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[9px] font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 uppercase"
                          >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                              Tải ảnh
                          </button>
                          <input 
                              id={`seg-image-upload-${seg.id}`}
                              type="file" 
                              onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadImage(seg.id, file);
                              }} 
                              className="hidden" 
                              accept="image/*" 
                          />
                       </div>
                    </div>
                  )}
                  
                  <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-4 py-2 rounded-full border border-white/10 shadow-lg">CẢNH #{seg.id}</div>
                </div>

                <div className="p-6 flex flex-col flex-1 gap-4 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <input 
                      type="checkbox" 
                      id={`show-product-${seg.id}`}
                      checked={seg.showProduct !== false} 
                      onChange={e => setState((p: any) => ({ 
                        ...p, 
                        segments: p.segments.map((s: any) => s.id === seg.id ? { ...s, showProduct: e.target.checked } : s) 
                      }))}
                      className={`w-4 h-4 rounded border-slate-300 ${theme.colors.primaryText} focus:ring-blue-500`}
                    />
                    <label htmlFor={`show-product-${seg.id}`} className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer">Xuất hiện sản phẩm</label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">Ý tưởng bối cảnh này:</label>
                    <textarea 
                      value={seg.sceneIdea || ''} 
                      onChange={e => setState((p: any) => ({ ...p, segments: p.segments.map((s: any) => s.id === seg.id ? { ...s, sceneIdea: e.target.value } : s) }))} 
                      placeholder="VD: Chú gấu đang nằm ôm bụng đói..." 
                      className="w-full h-20 p-3 text-xs font-bold text-slate-600 bg-blue-50/30 border border-blue-100 rounded-xl outline-none resize-none leading-relaxed placeholder:text-slate-300 focus:bg-white transition-all shadow-inner"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Lời thoại:</label>
                      <span className={`text-[9px] font-black ${seg.content.length > 180 ? 'text-red-500' : 'text-slate-300'}`}>{seg.content.length}/180</span>
                    </div>
                    <textarea 
                      value={seg.content} 
                      onChange={e => {
                        const newContent = e.target.value;
                        const hasProduct = newContent.toLowerCase().includes(state.ctaProduct.toLowerCase());
                        setState((p: any) => ({ 
                          ...p, 
                          segments: p.segments.map((s: any) => s.id === seg.id ? { ...s, content: newContent, showProduct: hasProduct } : s) 
                        }));
                      }} 
                      className="w-full h-32 p-3 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none resize-none leading-relaxed focus:bg-white transition-all" 
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú sửa ảnh:</label>
                    <textarea 
                      value={seg.image.regenNote || ''} 
                      onChange={e => setState((p: any) => ({ ...p, segments: p.segments.map((s: any) => s.id === seg.id ? { ...s, image: { ...s.image, regenNote: e.target.value } } : s) }))} 
                      placeholder="VD: Thêm hiệu ứng lấp lánh..." 
                      className="w-full h-32 p-3 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white transition-all resize-none leading-relaxed"
                    />
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleGenImage(seg.id)} 
                        disabled={seg.image.loading} 
                        style={{ backgroundColor: 'var(--primary-color)' }}
                        className="py-3 text-white text-[10px] font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-tighter disabled:opacity-50 flex items-center justify-center gap-2 shadow-md active:scale-95"
                      >
                        {seg.image.loading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (seg.image.url ? "Tạo lại AI" : "Vẽ ảnh 3D")}
                      </button>
                      <button 
                        onClick={() => handleGenImagePrompt(seg.id)} 
                        disabled={seg.imagePrompt.loading} 
                        style={{ backgroundColor: 'var(--primary-color)' }}
                        className="py-3 text-white text-[10px] font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-tighter disabled:opacity-50 flex items-center justify-center gap-2 shadow-md active:scale-95"
                      >
                        {seg.imagePrompt.loading ? <div className="w-3 h-3 border-white border-t-transparent rounded-full animate-spin"></div> : "Prompt Ảnh"}
                      </button>
                    </div>
                    <button 
                      onClick={() => handleGenPrompt(seg.id)} 
                      disabled={seg.videoPrompt.loading} 
                      style={{ backgroundColor: 'var(--primary-color)' }}
                      className="w-full py-3 text-white text-[10px] font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-tighter disabled:opacity-50 flex items-center justify-center gap-2 shadow-md active:scale-95"
                    >
                      {seg.videoPrompt.loading ? <div className="w-3 h-3 border-white border-t-transparent rounded-full animate-spin"></div> : "VEO-3 Prompt"}
                    </button>
                  </div>
                </div>

                {seg.imagePrompt.visible && (
                  <div className="p-4 bg-blue-900 border-t border-blue-800 animate-slideUp">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[8px] font-black text-blue-300 uppercase tracking-widest">Image Prompt Ready</span>
                      <button 
                        onClick={() => handleCopy(seg.imagePrompt.text, `img-prompt-${seg.id}`)} 
                        className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`img-prompt-${seg.id}`] ? 'text-green-400' : 'text-white underline'}`}
                      >
                        {copyStatus[`img-prompt-${seg.id}`] ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {seg.imagePrompt.loading ? (
                      <div className="h-24 flex items-center justify-center bg-blue-950 rounded border border-blue-800"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <textarea 
                        readOnly 
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        className="w-full h-24 bg-blue-950 text-blue-100 text-[9px] p-2 rounded border border-blue-800 focus:outline-none resize-none font-mono italic opacity-80 leading-snug"
                        value={seg.imagePrompt.text}
                      />
                    )}
                  </div>
                )}

                {seg.videoPrompt.visible && (
                  <div className="p-4 bg-slate-900 border-t border-slate-800 animate-slideUp">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Video Prompt Ready</span>
                      <button 
                        onClick={() => handleCopy(seg.videoPrompt.text, `seg-${seg.id}`)} 
                        className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`seg-${seg.id}`] ? 'text-green-400' : 'text-white underline'}`}
                      >
                        {copyStatus[`seg-${seg.id}`] ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {seg.videoPrompt.loading ? (
                      <div className="h-24 flex items-center justify-center bg-slate-950 rounded border border-slate-800"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <textarea 
                        readOnly 
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        className="w-full h-24 bg-slate-950 text-slate-300 text-[9px] p-2 rounded border border-slate-800 focus:outline-none resize-none font-mono italic opacity-80 leading-snug"
                        value={seg.videoPrompt.text}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-12 py-12">
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button
                onClick={handleBulkImage}
                disabled={state.isBulkImageLoading}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
              >
                Vẽ tất cả ảnh
                {state.isBulkImageLoading ? (
                  <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
                )}
              </button>
              <button
                onClick={handleBulkImagePrompt}
                disabled={state.isBulkPromptLoading}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
              >
                Tạo tất cả Prompt ảnh
                {state.isBulkPromptLoading ? (
                  <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
              </button>
              <button
                onClick={handleBulkVideoPrompt}
                disabled={state.isBulkPromptLoading}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
              >
                Tạo tất cả Prompt video
                {state.isBulkPromptLoading ? (
                  <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
                )}
              </button>
            </div>

            {state.segments.some((s: any) => s.image.url || s.videoPrompt) && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                <button
                  onClick={downloadAllImages}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải Ảnh (ZIP)
                </button>
                <button
                  onClick={downloadAllImagePromptsTxt}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Tải Prompt Ảnh (.txt)
                </button>
                <button
                  onClick={downloadAllVideoPromptsTxt}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Tải Video Prompt (.txt)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonificationModule;
