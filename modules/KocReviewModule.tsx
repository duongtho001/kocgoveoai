import React, { useState, useEffect, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { ScriptPartKey, ScriptParts } from '../types';
import { safeSaveToLocalStorage } from '../utils/storage';
import { LANGUAGE_CONSTRAINTS } from '../utils/languageUtils';
import * as service from '../services/kocReviewService';
import { translateText } from '../services/geminiService';
import { analyzeDetailedBackground } from '../services/kocReviewService2';
import ScriptSection from '../components/ScriptSection';
import ImageCard, { KOC_POSES, CAMERA_ANGLES } from '../components/ImageCard';
import { theme } from '../constants/colors';

declare var JSZip: any;

const LAYOUT_OPTIONS = [
  "Hình ảnh cá nhân + nỗi đau trong cuộc sống + trải nghiệm thực tế + giới thiệu sản phẩm/chức năng + trường hợp sử dụng + CTA",
  "Câu chuyện theo chủ đề + giới thiệu sản phẩm + đánh giá so sánh + sử dụng sản phẩm trong nhiều trường hợp + CTA",
  "Hình thức phỏng vấn + chia sẻ trải nghiệm người dùng + giới thiệu sản phẩm + CTA",
  "Chủ đề đời sống + đánh giá só sánh + điểm nổi bật + sử dụng sản phẩm trong nhiều trường hợp",
  "Nỗi đau + nguyên nhân + bán hàng từ nhà san xuất + uy tín thương hiệu + CTA",
  "Hình ảnh cá nhân + nỗi đau + trải nghiệm thực tế + đánh giá so sánh + bằng chứng khoa học + CTA",
  "Chia sẻ chân thực + kiến thức nghành + giới thiệu chức năng + đặc điểm nổi bật + ưu đãi + CTA",
  "Thu hút đối tượng mục tiêu cụ thể + câu hỏi từ góc độ người dùng + giải đáp + giới thiệu sản phẩm + ưu đãi + CTA",
  "Kết quả và đánh giá trước + nỗi đau trong cuộc sống + giới thiệu sản phẩm + ưu đãi + CTA",
  "Câu hỏi + giải pháp cho nỗi đau + đặc điểm nổi bật sản phẩm + đảm bảo từ nhiều góc độ/trường hợp + CTA",
  "Nỗi đau theo khu vực/mùa + giới thiệu sản phẩm + hoàn cảnh sử dụng + hình thức và cảm nhận khi trải nghiệm + đảm bảo + CTA",
  "Sở thích + giới thiệu sản phẩm + so sánh + giải thích về giá trị và hình thức + đảm bảo + CTA",
  "Xác định đối tượng mục tiêu + giới thiệu sản phẩm + hướng dẫn sử dụng + thử nghiệm và đánh giá + CTA",
  "Phản hồi và trải nghiệm của người dùng + kiến thức chuyên môn + nỗi đau + giới thiệu sản phẩm + ưu đãi + CTA",
  "Nỗi đau của khách hàng + giải pháp của sản phẩm + kết quả thực tế + CTA",
  "Câu chuyện thất bại + bài học rút ra + sản phẩm là giải pháp + CTA",
  "Đặt câu hỏi + kể chuyện + dẫn dắt + thuyết phục + đưa ra sản phẩm + khẳng định + CTA",
  "Câu chuyện hàng ngày + biến cố bất ngờ + loay hoay tìm cách giải quyết + gặp sản phẩm như cơ duyên + kết quả + CTA",
  "Sai lầm phổ biến + tôi cũng vậy + hậu quả kéo dài + quyết định đổi hướng + sản phẩm xuất hiện + CTA",
  "Ước muốn + rào cản + thử nhiều cách vẫn thất bại + một lựa chọn khác biệt + đạt được điều mong muốn + CTA",
  "Định vị sản phẩm + độ đa dạng + Lợi thế cạnh tranh + Ưu đãi theo nhóm + Chính sách dự án + CTA nhắn tin báo giá",
  "Hook mạnh + giới thiệu công năng + CTA"
];

const SCENE_COUNT_OPTIONS = Array.from({ length: 13 }, (_, i) => {
  const count = i + 3;
  const seconds = count * 8;
  return { count, label: `${count} cảnh - ${seconds}s` };
});

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

interface SceneItemProps {
  sceneKey: string;
  idx: number;
  state: any;
  setState: React.Dispatch<React.SetStateAction<any>>;
  handleRegenerateScriptPart: (key: string) => void;
  handleGeneratePromptForKey: (key: string) => void;
  handleGenerateImagePromptForKey: (key: string) => void;
  handleGenImageForKey: (key: string) => void;
  handleUploadImageForKey: (key: string, file: File) => void;
  handleDeleteImageForKey: (key: string) => void;
  handleTranslateForKey: (key: string, type: 'image' | 'video') => void;
  language: string;
}

const SceneItem: React.FC<SceneItemProps> = ({
  sceneKey,
  idx,
  state,
  setState,
  handleRegenerateScriptPart,
  handleGeneratePromptForKey,
  handleGenerateImagePromptForKey,
  handleGenImageForKey,
  handleUploadImageForKey,
  handleDeleteImageForKey,
  handleTranslateForKey,
  language
}) => {
  const dragControls = useDragControls();
  const constraint = LANGUAGE_CONSTRAINTS[language] || LANGUAGE_CONSTRAINTS['vi'];

  return (
    <Reorder.Item 
      key={sceneKey} 
      value={sceneKey} 
      dragControls={dragControls}
      dragListener={false}
      className="space-y-4 relative group"
    >
      <div 
        onPointerDown={(e) => dragControls.start(e)}
        className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-white border border-slate-200 rounded-full p-1 shadow-md hover:scale-110 hover:border-brand-primary"
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>
      <ScriptSection
        title={`Phần ${idx + 1}`}
        content={state.script[sceneKey]}
        color={theme.colors.primaryBorder}
        onChange={(val) => setState((p: any) => ({ ...p, script: { ...p.script, [sceneKey]: val } }))}
        onRegenerate={() => handleRegenerateScriptPart(sceneKey)}
        isRegenerating={state.isRegeneratingPart[sceneKey]}
        minChars={constraint.charRange[0]}
        maxChars={constraint.charRange[1]}
      />
      <ImageCard
        label={`Cảnh ${idx + 1}`}
        imageData={state.images[sceneKey]}
        videoPrompt={state.videoPrompts[sceneKey]}
        imagePrompt={state.imagePrompts[sceneKey]}
        onGeneratePrompt={() => handleGeneratePromptForKey(sceneKey)}
        onGenerateImagePrompt={() => handleGenerateImagePromptForKey(sceneKey)}
        onRegenerate={() => handleGenImageForKey(sceneKey)}
        onTranslate={(type) => handleTranslateForKey(sceneKey, type)}
        onUpload={(file) => handleUploadImageForKey(sceneKey, file)}
        onDelete={() => handleDeleteImageForKey(sceneKey)}
        pose={state.images[sceneKey]?.pose || ''}
        onPoseChange={(val) => setState((p: any) => ({ ...p, images: { ...p.images, [sceneKey]: { ...p.images[sceneKey], pose: val } } }))}
        angle={state.images[sceneKey]?.angle || ''}
        onAngleChange={(val) => setState((p: any) => ({ ...p, images: { ...p.images, [sceneKey]: { ...p.images[sceneKey], angle: val } } }))}
        customPrompt={state.images[sceneKey]?.customPrompt || ''}
        onCustomPromptChange={(val) => setState((p: any) => ({ ...p, images: { ...p.images, [sceneKey]: { ...p.images[sceneKey], customPrompt: val } } }))}
      />
    </Reorder.Item>
  );
};

interface KocReviewModuleProps {
  language?: string;
}

const KocReviewModule: React.FC<KocReviewModuleProps> = ({ language = 'vi' }) => {
  const storageKey = "koc_project_v23_image_prompts";
  const [state, setState] = useState<any>({
    faceFile: null,
    facePreviewUrl: null,
    outfitFile: null,
    outfitPreviewUrl: null,
    processedOutfitUrl: null,
    isExtractingOutfit: false,
    backgroundFile: null,
    backgroundPreviewUrl: null,
    characterDescription: '',
    gender: 'Nữ',
    voice: 'Giọng miền Bắc 20-30 tuổi',
    addressing: '',
    targetAudience: '',
    imageStyle: 'Realistic',
    sceneCount: 5,
    productFiles: [], 
    productPreviewUrls: [],
    productName: '',
    keyword: '',
    scriptTone: '',
    productSize: '',
    scriptNote: '', 
    visualNote: '',
    scriptLayout: '',
    isGeneratingScript: false,
    isAnalyzingBackground: false,
    isRegeneratingPart: {},
    script: null,
    images: {},
    imagePrompts: {}, // Lưu trữ technical image prompts
    videoPrompts: {},
    sceneOrder: []
  });

  const productInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const safeSceneCount = typeof parsed.sceneCount === 'object' ? (parsed.sceneCount.count || 5) : (parsed.sceneCount || 5);
          
          const initialSceneOrder = parsed.sceneOrder || Array.from({ length: safeSceneCount }, (_, i) => `v${i + 1}`);
          setState((prev: any) => ({
            ...prev,
            ...parsed,
            sceneCount: safeSceneCount,
            sceneOrder: initialSceneOrder,
            productFiles: [],
            faceFile: null,
            outfitFile: null,
            backgroundFile: null,
            isGeneratingScript: false,
            isExtractingOutfit: false,
            isRegeneratingPart: {},
            imagePrompts: parsed.imagePrompts || {}
          }));
        }
      }
    } catch (e) {
      console.error("Failed to restore KOC state", e);
    }
  }, []);

  useEffect(() => {
    const { isGeneratingScript, isExtractingOutfit, isRegeneratingPart, productFiles, faceFile, outfitFile, backgroundFile, ...persistentData } = state;
    safeSaveToLocalStorage(storageKey, persistentData);
  }, [state]);

  // Handle Global Import / Export
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
          : state.productPreviewUrls.map((url: string) => url.startsWith('data:') ? Promise.resolve(url) : Promise.resolve(""))
      );

      const faceBase64 = await getBase64(state.faceFile, state.facePreviewUrl);
      const outfitBase64 = await getBase64(state.outfitFile, state.outfitPreviewUrl);
      const backgroundBase64 = await getBase64(state.backgroundFile, state.backgroundPreviewUrl);

      const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
      const exportData = activeKeys.map((key, index) => ({
        stt: index + 1,
        inputs: {
          productName: state.productName,
          keyword: state.keyword,
          targetAudience: state.targetAudience,
          characterDescription: state.characterDescription,
          processedOutfitUrl: state.processedOutfitUrl,
          visualNote: state.visualNote,
          scriptNote: state.scriptNote, 
          inputMedia: {
            productImages: productImagesBase64.filter(i => i),
            faceImage: faceBase64,
            outfitImage: outfitBase64,
            backgroundImage: backgroundBase64
          },
          settings: {
            gender: state.gender,
            voice: state.voice,
            addressing: state.addressing,
            imageStyle: state.imageStyle,
            scriptLayout: state.scriptLayout,
            pose: state.images[key]?.pose || '',
            angle: state.images[key]?.angle || ''
          }
        },
        script: state.script ? state.script[key] : '',
        outputImage: state.images[key]?.url || '',
        videoPrompt: state.videoPrompts[key]?.text || ''
      }));

      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
        detail: { data: exportData, moduleName: 'KOC_Project_Complete' } 
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
        productName: smartFind(inputs, ['productName', 'name']) || state.productName,
        keyword: smartFind(inputs, ['keyword', 'usp']) || state.keyword,
        targetAudience: smartFind(inputs, ['targetAudience', 'audience']) || state.targetAudience,
        characterDescription: smartFind(inputs, ['characterDescription', 'character']) || state.characterDescription,
        processedOutfitUrl: smartFind(inputs, ['processedOutfitUrl', 'outfit_img']) || state.processedOutfitUrl,
        visualNote: smartFind(inputs, ['visualNote']) || state.visualNote,
        scriptNote: smartFind(inputs, ['scriptNote', 'note']) || state.scriptNote,
        gender: smartFind(settings, ['gender']) || state.gender,
        voice: smartFind(settings, ['voice']) || state.voice,
        addressing: smartFind(settings, ['addressing', 'xưng hô']) || state.addressing,
        imageStyle: smartFind(settings, ['imageStyle']) || state.imageStyle,
        scriptLayout: smartFind(settings, ['scriptLayout', 'layout']) || state.scriptLayout,
        sceneCount: importedData.length,
        productPreviewUrls: smartFind(media, ['productImages', 'images']) || [],
        facePreviewUrl: smartFind(media, ['faceImage', 'face']) || "",
        outfitPreviewUrl: smartFind(media, ['outfitImage', 'outfit_img']) || "",
        backgroundPreviewUrl: smartFind(media, ['backgroundImage', 'background']) || "",
        script: {},
        images: {},
        imagePrompts: {},
        videoPrompts: {}
      };

      const total = importedData.length;
      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const itemInputs = smartFind(item, ['inputs', 'input']) || {};
        const itemSettings = smartFind(itemInputs, ['settings']) || {};
        const key = `v${i + 1}`;

        newState.script[key] = smartFind(item, ['script', 'content', 'text']) || '';
        newState.images[key] = {
          url: smartFind(item, ['outputImage', 'image', 'base64']) || '',
          loading: false,
          pose: smartFind(itemSettings, ['pose']) || '',
          angle: smartFind(itemSettings, ['angle']) || '',
          customPrompt: ''
        };
        newState.imagePrompts[key] = { text: '', loading: false, visible: false };
        newState.videoPrompts[key] = {
          text: smartFind(item, ['videoPrompt', 'prompt']) || '',
          loading: false,
          visible: !!smartFind(item, ['videoPrompt', 'prompt'])
        };

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

  const handleProductFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const updatedFiles = [...state.productFiles, ...selectedFiles].slice(0, 3);
      const updatedUrls = updatedFiles.map(f => URL.createObjectURL(f));
      setState((prev: any) => ({ ...prev, productFiles: updatedFiles, productPreviewUrls: updatedUrls }));
    }
    if (productInputRef.current) productInputRef.current.value = "";
  };

  const removeProductFile = (idx: number) => {
    const updatedFiles = state.productFiles.filter((_: any, i: number) => i !== idx);
    const updatedUrls = updatedFiles.map((f: File) => URL.createObjectURL(f));
    const updatedPreviewUrls = state.productPreviewUrls.filter((_: any, i: number) => i !== idx);
    setState((prev: any) => ({
      ...prev,
      productFiles: updatedFiles,
      productPreviewUrls: updatedFiles.length > 0 ? updatedUrls : updatedPreviewUrls
    }));
  };

  const removeFaceFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev: any) => ({
      ...prev,
      faceFile: null,
      facePreviewUrl: null
    }));
    if (faceInputRef.current) faceInputRef.current.value = "";
  };

  const removeOutfitFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev: any) => ({
      ...prev,
      outfitFile: null,
      outfitPreviewUrl: null,
      processedOutfitUrl: null
    }));
    if (outfitInputRef.current) outfitInputRef.current.value = "";
  };

  const removeBackgroundFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev: any) => ({
      ...prev,
      backgroundFile: null,
      backgroundPreviewUrl: null
    }));
    if (backgroundInputRef.current) backgroundInputRef.current.value = "";
  };

  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setState((prev: any) => ({
        ...prev,
        faceFile: file,
        facePreviewUrl: URL.createObjectURL(file)
      }));
    }
  };

  const handleOutfitFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setState((prev: any) => ({
        ...prev,
        outfitFile: file,
        outfitPreviewUrl: URL.createObjectURL(file),
        processedOutfitUrl: null
      }));
    }
  };

  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setState((prev: any) => ({
        ...prev,
        backgroundFile: file,
        backgroundPreviewUrl: URL.createObjectURL(file)
      }));
    }
  };

  const handleAnalyzeBackground = async () => {
    let part = null;
    if (state.backgroundFile) {
      part = await service.fileToGenerativePart(state.backgroundFile);
    } else if (state.backgroundPreviewUrl?.startsWith('data:')) {
      part = { mimeType: 'image/png', data: state.backgroundPreviewUrl.split(',')[1] };
    }

    if (!part && !state.visualNote) {
      alert("Vui lòng tải ảnh bối cảnh hoặc nhập mô tả sơ bộ để phân tích.");
      return;
    }

    setState(p => ({ ...p, isAnalyzingBackground: true }));
    try {
      const analysis = await analyzeDetailedBackground(state.visualNote || "", part);
      setState(p => ({ ...p, visualNote: analysis, isAnalyzingBackground: false }));
    } catch (e) {
      console.error(e);
      setState(p => ({ ...p, isAnalyzingBackground: false }));
      alert("Lỗi khi phân tích bối cảnh.");
    }
  };

  const handleExtractOutfit = async () => {
    let part = null;
    if (state.outfitFile) {
        part = await service.fileToGenerativePart(state.outfitFile);
    } else if (state.outfitPreviewUrl?.startsWith('data:')) {
        part = { mimeType: 'image/png', data: state.outfitPreviewUrl.split(',')[1] };
    }

    if (!part) return;
    setState(p => ({ ...p, isExtractingOutfit: true }));
    try {
      const imgUrl = await service.extractOutfitImage(part);
      setState(p => ({ ...p, processedOutfitUrl: imgUrl, isExtractingOutfit: false }));
    } catch (e) {
      console.error(e);
      setState(p => ({ ...p, isExtractingOutfit: false }));
    }
  };

  const handleGenerate = async () => {
    if (state.productFiles.length === 0 && state.productPreviewUrls.length === 0) {
      alert("Vui lòng tải ảnh sản phẩm.");
      return;
    }
    if (!state.productName) {
      alert("Vui lòng nhập tên sản phẩm.");
      return;
    }

    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const initialImages: any = {};
    const initialPrompts: any = {};
    const initialImagePrompts: any = {};
    activeKeys.forEach(k => {
      initialImages[k] = { url: '', loading: false, customPrompt: '', pose: '', angle: '' };
      initialPrompts[k] = { text: '', loading: false, visible: false };
      initialImagePrompts[k] = { text: '', loading: false, visible: false };
    });

    setState((prev: any) => ({
      ...prev,
      isGeneratingScript: true,
      script: null,
      images: initialImages,
      imagePrompts: initialImagePrompts,
      videoPrompts: initialPrompts,
      sceneOrder: activeKeys
    }));

    try {
      let imageParts = [];
      if (state.productFiles.length > 0) {
        imageParts = await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)));
      } else {
        imageParts = state.productPreviewUrls.map((url: string) => ({
          mimeType: 'image/png',
          data: url.split(',')[1]
        }));
      }

      let layoutToUse = state.scriptLayout;
      if (!layoutToUse) layoutToUse = LAYOUT_OPTIONS[Math.floor(Math.random() * LAYOUT_OPTIONS.length)];

      const script = await service.generateKocScript(
        imageParts,
        state.productName,
        state.keyword,
        state.scriptTone,
        state.productSize,
        state.scriptNote,
        layoutToUse,
        state.gender,
        state.voice,
        state.addressing,
        state.sceneCount,
        state.targetAudience,
        language
      );
      setState((prev: any) => ({ ...prev, script, scriptLayout: layoutToUse }));
    } catch (e) {
      console.error(e);
    } finally {
      setState((prev: any) => ({ ...prev, isGeneratingScript: false }));
    }
  };

  const handleRegenerateScriptPart = async (key: string) => {
    if (state.isGeneratingScript || state.isRegeneratingPart[key] || !state.script) return;
    
    setState((p: any) => ({ 
      ...p, 
      isRegeneratingPart: { ...p.isRegeneratingPart, [key]: true } 
    }));
    
    try {
      let imageParts = [];
      if (state.productFiles.length > 0) {
        imageParts = await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)));
      } else {
        imageParts = state.productPreviewUrls.map((url: string) => ({
          mimeType: 'image/png',
          data: url.split(',')[1]
        }));
      }

      const newPartContent = await service.regenerateKocScriptPart(
        imageParts,
        state.productName,
        state.keyword,
        key,
        state.script[key],
        state.script,
        state.gender,
        state.voice,
        state.addressing,
        state.scriptLayout,
        state.targetAudience,
        language
      );
      
      setState((p: any) => ({
        ...p,
        script: { ...p.script, [key]: newPartContent },
        isRegeneratingPart: { ...p.isRegeneratingPart, [key]: false }
      }));
    } catch (error) {
      console.error("Regen script part failed", error);
      setState((p: any) => ({ 
        ...p, 
        isRegeneratingPart: { ...p.isRegeneratingPart, [key]: false } 
      }));
    }
  };

  const handleGenerateImagePromptForKey = async (key: string) => {
    const poseLabel = KOC_POSES.find(p => p.value === state.images[key]?.pose)?.label || "";
    const angleValue = state.images[key]?.angle || "";

    setState((prev: any) => ({
      ...prev,
      imagePrompts: {
        ...prev.imagePrompts,
        [key]: { ...prev.imagePrompts[key], loading: true, visible: true }
      }
    }));

    try {
      const getPart = async (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:')) return { mimeType: 'image/png', data: url.split(',')[1] };
        // Handle external blob URLs if necessary
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ mimeType: blob.type, data: (reader.result as string).split(',')[1] });
            reader.readAsDataURL(blob);
          });
        } catch (e) { return null; }
      };

      const productParts = state.productFiles.length > 0 
        ? await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)))
        : await Promise.all(state.productPreviewUrls.map((url: string) => getPart(url)));

      const facePart = await getPart(state.facePreviewUrl);
      const outfitPart = await getPart(state.processedOutfitUrl || state.outfitPreviewUrl);

      const prompt = await service.generateKocImagePromptAI(
        state.productName,
        state.script[key],
        state.characterDescription,
        state.images[key]?.customPrompt,
        state.gender,
        state.voice,
        state.imageStyle,
        state.scriptNote,
        state.visualNote,
        poseLabel,
        angleValue,
        productParts.filter(p => p !== null),
        facePart,
        outfitPart,
        language
      );

      setState((prev: any) => ({
        ...prev,
        imagePrompts: {
          ...prev.imagePrompts,
          [key]: { text: prompt, loading: false, visible: true }
        }
      }));
    } catch (error) {
      console.error("Generate image prompt failed", error);
      setState((prev: any) => ({
        ...prev,
        imagePrompts: {
          ...prev.imagePrompts,
          [key]: { ...prev.imagePrompts[key], loading: false }
        }
      }));
    }
  };

  const handleGenImageForKey = async (key: string) => {
    setState((prev: any) => ({ ...prev, images: { ...prev.images, [key]: { ...prev.images[key], loading: true } } }));
    try {
      let productParts = [];
      if (state.productFiles.length > 0) {
        productParts = await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)));
      } else {
        productParts = state.productPreviewUrls.map((url: string) => ({
          mimeType: 'image/png',
          data: url.split(',')[1]
        }));
      }

      const getPart = async (file: File | null, url: string | null) => {
        if (file) return await service.fileToGenerativePart(file);
        if (url?.startsWith('data:')) return { mimeType: 'image/png', data: url.split(',')[1] };
        return null;
      };

      const facePart = await getPart(state.faceFile, state.facePreviewUrl);
      
      const outfitPart = state.processedOutfitUrl 
        ? { mimeType: 'image/png', data: state.processedOutfitUrl.split(',')[1] }
        : await getPart(state.outfitFile, state.outfitPreviewUrl);

      const bgRefPart = await getPart(state.backgroundFile, state.backgroundPreviewUrl);

      const currentPoseKey = state.images[key]?.pose || "";
      const poseLabel = KOC_POSES.find(p => p.value === currentPoseKey)?.label || "";

      // Sử dụng trực tiếp technical string (ví dụ: "front-right quarter view")
      const currentAngleValue = state.images[key]?.angle || "";

      const url = await service.generateKocImage(
        state.productName,
        state.script[key],
        state.characterDescription,
        state.images[key]?.customPrompt,
        state.gender,
        state.voice,
        state.imageStyle,
        state.scriptNote,
        state.visualNote,
        poseLabel,
        currentAngleValue,
        productParts,
        facePart,
        outfitPart,
        bgRefPart,
        language
      );
      setState((prev: any) => ({ ...prev, images: { ...prev.images, [key]: { ...prev.images[key], url, loading: false } } }));
    } catch (e) {
      console.error(e);
      setState((prev: any) => ({ ...prev, images: { ...prev.images, [key]: { ...prev.images[key], loading: false, error: 'Failed' } } }));
    }
  };

  const handleUploadImageForKey = (key: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result as string;
      setState((prev: any) => ({
        ...prev,
        images: {
          ...prev.images,
          [key]: { ...prev.images[key], url: b64, loading: false }
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImageForKey = (key: string) => {
    setState((prev: any) => ({
      ...prev,
      images: {
        ...prev.images,
        [key]: { ...prev.images[key], url: '', loading: false }
      }
    }));
  };

  const handleBulkImagePrompt = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    for (const key of keys) {
      await handleGenerateImagePromptForKey(key);
    }
  };

  const handleBulkImage = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    for (const key of keys) {
      await handleGenImageForKey(key);
    }
  };

  const handleGeneratePromptForKey = async (key: string) => {
    setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: true, visible: true } } }));
    try {
      let productImageData = "";
      if (state.productFiles.length > 0) {
        const p = await service.fileToGenerativePart(state.productFiles[0]);
        productImageData = p.data;
      } else if (state.productPreviewUrls.length > 0) {
        productImageData = state.productPreviewUrls[0].split(',')[1];
      }

      const noProductKeywords = ["không có sản phẩm", "xóa sản phẩm", "không xuất hiện sản phẩm", "bỏ sản phẩm", "không thấy sản phẩm", "no product", "remove product", "without product"];
      const customPrompt = state.images[key]?.customPrompt || "";
      const isNoProduct = noProductKeywords.some(kw => customPrompt.toLowerCase().includes(kw));

      const prompt = await service.generateKocVeoPrompt(
        state.productName,
        state.script[key],
        state.gender,
        state.voice,
        productImageData,
        state.images[key].url,
        isNoProduct,
        state.imageStyle,
        language
      );
      setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { text: prompt, loading: false, visible: true } } }));
    } catch (e) {
      setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } }));
    }
  };

  const handleBulkPrompt = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    for (const key of keys) {
      await handleGeneratePromptForKey(key);
    }
  };

  const handleTranslateForKey = async (key: string, type: 'image' | 'video') => {
    const promptState = type === 'image' ? state.imagePrompts[key] : state.videoPrompts[key];
    if (!promptState || !promptState.text || promptState.loading) return;

    const stateKey = type === 'image' ? 'imagePrompts' : 'videoPrompts';
    
    setState((prev: any) => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        [key]: { ...prev[stateKey][key], loading: true }
      }
    }));

    try {
      const translated = await translateText(promptState.text);
      setState((prev: any) => ({
        ...prev,
        [stateKey]: {
          ...prev[stateKey],
          [key]: { ...prev[stateKey][key], text: translated, loading: false }
        }
      }));
    } catch (error) {
      console.error("Translation failed", error);
      setState((prev: any) => ({
        ...prev,
        [stateKey]: {
          ...prev[stateKey],
          [key]: { ...prev[stateKey][key], loading: false }
        }
      }));
    }
  };

  const downloadAllImages = async () => {
    if (typeof JSZip === 'undefined') {
      alert("Đang tải thư viện nén, vui lòng thử lại sau giây lát.");
      return;
    }

    const zip = new JSZip();
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    let count = 0;

    for (let i = 0; i < activeKeys.length; i++) {
      const key = activeKeys[i];
      const imageData = state.images[key];
      if (imageData?.url) {
        const base64Data = imageData.url.split(',')[1];
        if (base64Data) {
          const fileName = `${String(i + 1).padStart(2, '0')}.png`;
          zip.file(fileName, base64Data, { base64: true });
          count++;
        }
      }
    }

    if (count === 0) {
      alert("Không có ảnh nào để tải xuống.");
      return;
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content as any);
    link.download = `koc_images_${state.productName || 'project'}.zip`;
    link.click();
  };

  const downloadAllPrompts = () => {
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const text = activeKeys
      .map(key => state.videoPrompts[key]?.text || "")
      .filter(t => t.trim().length > 0)
      .map(t => t.replace(/\n/g, ' '))
      .join('\n');

    if (!text) {
      alert("Vui lòng tạo Video Prompt trước khi tải xuống.");
      return;
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob as any);
    const link = document.createElement('a');
    link.href = url;
    link.download = `video_prompts_${state.productName || 'koc'}.txt`;
    link.click();
  };

  const downloadAllImagePrompts = () => {
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const text = activeKeys
      .map(key => state.imagePrompts[key]?.text || "")
      .filter(t => t.trim().length > 0)
      .map(t => t.replace(/\n/g, ' ')) // Đảm bảo mỗi prompt nằm trên 1 dòng duy nhất
      .join('\n');

    if (!text) {
      alert("Vui lòng tạo Prompt Ảnh trước khi tải xuống.");
      return;
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob as any);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image_prompts_${state.productName || 'koc'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasGeneratedItems = state.script && Object.values(state.images).some((img: any) => img.url);

  // Ép kiểu render để tránh React child error nếu state.sceneCount là object
  const currentSceneCount = typeof state.sceneCount === 'object' ? (state.sceneCount.count || 0) : (state.sceneCount || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className={`bg-white rounded-2xl shadow-sm border ${theme.colors.secondaryBorder} p-6 mb-8`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 flex flex-col gap-4">
            <div className="space-y-3">
              <label className={`block text-sm font-bold ${theme.colors.primaryText}`}>1. Hình ảnh sản phẩm (Chọn tối đa 3 ảnh)</label>
              <div 
                onClick={() => productInputRef.current?.click()} 
                className={`w-full h-32 rounded-xl border-2 border-dashed ${theme.colors.secondaryBorder} flex flex-col items-center justify-center cursor-pointer ${theme.colors.secondaryBg} hover:bg-slate-100 transition-all ${theme.colors.primaryBorder}/20 group`}
              >
                <div className="flex flex-col items-center opacity-40 group-hover:opacity-60 transition-opacity">
                  <svg className={`w-8 h-8 ${theme.colors.primaryText} mb-1`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">Tải ảnh sản phẩm (Multiple)</span>
                </div>
                <input type="file" multiple ref={productInputRef} onChange={handleProductFilesChange} className="hidden" accept="image/*" />
              </div>

              {state.productPreviewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {state.productPreviewUrls.map((url: string, idx: number) => (
                    <div key={idx} className={`relative aspect-[3/4] rounded-lg overflow-hidden border ${theme.colors.secondaryBorder} group/item shadow-sm`}>
                      <img src={url} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removeProductFile(idx)}
                        className={`absolute top-1 right-1 ${theme.colors.buttonPrimary} p-1 rounded-full opacity-90 transition-all z-20 shadow-md border border-white/20`}
                        title="Xóa ảnh"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Ghi chú nhân vật</label>
              <textarea
                value={state.characterDescription}
                onChange={e => setState(p => ({ ...p, characterDescription: e.target.value }))}
                placeholder="Mô tả phong cách, diện mạo nhân vật..."
                className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl h-24 text-sm ${theme.colors.inputFocus} outline-none transition-all`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={`block text-sm font-bold ${theme.colors.primaryText}`}>0. Ảnh mặt mẫu</label>
                <div onClick={() => faceInputRef.current?.click()} className={`relative w-full aspect-square rounded-xl border-2 border-dashed ${theme.colors.secondaryBorder} flex items-center justify-center cursor-pointer ${theme.colors.secondaryBg} hover:bg-slate-100 transition-colors overflow-hidden group`}>
                  {state.facePreviewUrl ? (
                    <>
                      <img src={state.facePreviewUrl} className="h-full object-cover" />
                      <button 
                        onClick={removeFaceFile}
                        className={`absolute top-2 right-2 ${theme.colors.buttonPrimary} p-1 rounded-full opacity-90 transition-all z-10 shadow-lg border border-white/20`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : <span className={`${theme.colors.secondaryText} text-[10px] uppercase font-bold text-center p-2`}>Mặt mẫu</span>}
                  <input type="file" ref={faceInputRef} onChange={handleFaceFileChange} className="hidden" accept="image/*" />
                </div>
              </div>
              <div className="space-y-2">
                <label className={`block text-sm font-bold ${theme.colors.primaryText}`}>2. Ảnh trang phục</label>
                <div onClick={() => outfitInputRef.current?.click()} className={`relative w-full aspect-square rounded-xl border-2 border-dashed ${theme.colors.secondaryBorder} flex items-center justify-center cursor-pointer ${theme.colors.secondaryBg} hover:bg-slate-100 transition-colors overflow-hidden group`}>
                  {state.outfitPreviewUrl ? (
                    <>
                      <img src={state.outfitPreviewUrl} className="h-full object-cover" />
                      <button 
                        onClick={removeOutfitFile}
                        className={`absolute top-2 right-2 ${theme.colors.buttonPrimary} p-1 rounded-full opacity-90 transition-all z-10 shadow-lg border border-white/20`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : <span className={`${theme.colors.secondaryText} text-[10px] uppercase font-bold text-center p-2`}>Trang phục</span>}
                  <input type="file" ref={outfitInputRef} onChange={handleOutfitFileChange} className="hidden" accept="image/*" />
                </div>
                {(state.outfitFile || state.outfitPreviewUrl?.startsWith('data:')) && (
                  <button
                    onClick={handleExtractOutfit}
                    disabled={state.isExtractingOutfit}
                    className={`w-full py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${state.processedOutfitUrl ? 'bg-green-100 text-green-700 border border-green-200' : `${theme.colors.buttonPrimary}`}`}
                  >
                    {state.isExtractingOutfit ? "Đang xử lý..." : state.processedOutfitUrl ? "Đã xóa nền ✓" : "Xóa nền & nhân vật"}
                  </button>
                )}
              </div>
            </div>

            {state.processedOutfitUrl && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl animate-fadeIn space-y-2">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Kết quả tách trang phục:</label>
                <div className="aspect-square w-full rounded-lg overflow-hidden border border-slate-100 bg-slate-50 relative group">
                   <img src={state.processedOutfitUrl} className="w-full h-full object-contain" alt="processed outfit" />
                   <a 
                      href={state.processedOutfitUrl} 
                      download="outfit_no_bg.png"
                      className="absolute top-2 right-2 bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10 shadow-lg border border-white/20"
                      title="Tải ảnh đã tách nền"
                   >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                   </a>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-7 space-y-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Tên sản phẩm</label>
                <input type="text" value={state.productName} onChange={e => setState(p => ({ ...p, productName: e.target.value }))} placeholder="Nhập tên sản phẩm..." className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl ${theme.colors.inputFocus} outline-none transition-all`} />
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Tệp khách hàng mục tiêu</label>
                <input type="text" value={state.targetAudience} onChange={e => setState(p => ({ ...p, targetAudience: e.target.value }))} placeholder="VD: Mẹ bỉm sữa, dân văn phòng, sinh viên..." className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl ${theme.colors.inputFocus} outline-none transition-all`} />
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>USP sản phẩm (Đặc điểm nổi bật, công dụng, giá trị...)</label>
                <textarea
                  value={state.keyword}
                  onChange={e => setState(p => ({ ...p, keyword: e.target.value }))}
                  placeholder="Điền các điểm USP nổi bật của sản phẩm..."
                  className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl h-24 text-sm ${theme.colors.inputFocus} outline-none transition-all`}
                />
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Ghi chú hiển thị (Visual Appearance)</label>
                <input
                  type="text"
                  value={state.visualNote}
                  onChange={e => setState(p => ({ ...p, visualNote: e.target.value }))}
                  placeholder="Mô tả cách sản phẩm và nhân vật xuất hiện (VD: nhân vật đứng cạnh sản phẩm...)"
                  className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl ${theme.colors.inputFocus} outline-none transition-all`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Giới tính nhân vật</label>
                <select value={state.gender} onChange={e => setState(p => ({ ...p, gender: e.target.value }))} className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold`}>
                  <option value="Nữ">Nữ</option>
                  <option value="Nam">Nam</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Giọng điệu vùng miền</label>
                <select value={state.voice} onChange={e => setState(p => ({ ...p, voice: e.target.value }))} className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold`}>
                  {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Cách xưng hô (Người nói - Người nghe)</label>
              <div className="flex gap-2">
                <div className="flex-1 relative group">
                   <input 
                      list="addressing-list"
                      value={state.addressing} 
                      onChange={e => setState(p => ({ ...p, addressing: e.target.value }))}
                      placeholder="Chọn hoặc tự nhập (VD: em - các bác)"
                      className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold text-sm`}
                   />
                   <datalist id="addressing-list">
                      {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                   </datalist>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Thời lượng (Scenes)</label>
                <select value={currentSceneCount} onChange={e => setState(p => ({ ...p, sceneCount: parseInt(e.target.value) }))} className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold ${theme.colors.primaryText}`}>
                  {SCENE_COUNT_OPTIONS.map(opt => (
                    <option key={opt.count} value={opt.count}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Phong cách ảnh (Lifestyle)</label>
                <div className={`flex ${theme.colors.secondaryBg} p-1 rounded-xl border ${theme.colors.secondaryBorder}`}>
                  <button
                    onClick={() => setState(p => ({ ...p, imageStyle: 'Realistic' }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === 'Realistic' ? `${theme.colors.primaryBg} text-white shadow-md` : `${theme.colors.secondaryText} hover:text-slate-600`}`}
                  >
                    Chân thực
                  </button>
                  <button
                    onClick={() => setState(p => ({ ...p, imageStyle: '3D' }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === '3D' ? `${theme.colors.primaryBg} text-white shadow-md` : `${theme.colors.secondaryText} hover:text-slate-600`}`}
                  >
                    3D Animation
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Bố cục kịch bản (Layout)</label>
              <select value={state.scriptLayout} onChange={e => setState(p => ({ ...p, scriptLayout: e.target.value }))} className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl bg-white ${theme.colors.inputFocus} outline-none`}>
                <option value="">-- Random Layout --</option>
                {LAYOUT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className={`block text-[10px] font-bold ${theme.colors.secondaryText} uppercase px-1`}>Background bối cảnh (Bắt buộc dùng cho ảnh)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div 
                    onClick={() => backgroundInputRef.current?.click()}
                    className={`aspect-video border-2 border-dashed ${theme.colors.secondaryBorder} rounded-xl flex items-center justify-center cursor-pointer ${theme.colors.secondaryBg} hover:bg-slate-100 transition-colors overflow-hidden group relative`}
                  >
                    {state.backgroundPreviewUrl ? (
                      <>
                        <img src={state.backgroundPreviewUrl} className="h-full w-full object-cover" />
                        <button 
                          onClick={removeBackgroundFile}
                          className={`absolute top-2 right-2 ${theme.colors.buttonPrimary} p-1.5 rounded-full opacity-90 transition-all z-10 shadow-lg border border-white/20`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <svg className={`w-8 h-8 ${theme.colors.secondaryBorder} mx-auto mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className={`text-[9px] font-black ${theme.colors.secondaryText} uppercase tracking-widest`}>Tải ảnh bối cảnh</span>
                      </div>
                    )}
                    <input type="file" ref={backgroundInputRef} onChange={handleBackgroundFileChange} className="hidden" accept="image/*"/>
                  </div>
                  <button 
                    onClick={handleAnalyzeBackground}
                    disabled={state.isAnalyzingBackground}
                    className={`w-full py-2 ${theme.colors.buttonPrimary} text-[10px] font-black rounded-xl uppercase shadow-md disabled:opacity-50 transition-all`}
                  >
                    {state.isAnalyzingBackground ? "Đang phân tích..." : "Phân tích bối cảnh chi tiết"}
                  </button>
                </div>
                <textarea
                  value={state.visualNote}
                  onChange={e => setState(p => ({ ...p, visualNote: e.target.value }))}
                  placeholder="Mô tả bối cảnh chi tiết bằng chữ (VD: phòng khách sang trọng, ánh sáng ấm...)"
                  className={`w-full p-3 border ${theme.colors.secondaryBorder} rounded-xl h-full text-sm ${theme.colors.inputFocus} outline-none transition-all resize-none font-medium`}
                />
              </div>
            </div>

            <button onClick={handleGenerate} disabled={state.isGeneratingScript} className={`w-full py-4 ${theme.colors.buttonPrimary} font-black rounded-xl shadow-lg disabled:opacity-50 transition-all active:scale-[0.98] uppercase tracking-widest`}>
              {state.isGeneratingScript ? "Đang xử lý kịch bản..." : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}
            </button>
          </div>
        </div>
      </div>

      {state.script && (
        <div className="space-y-8 pb-32">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
            <h3 className="text-sm font-black text-white uppercase tracking-tight">KẾT QUẢ CHIẾN DỊCH (LIFESTYLE MODE)</h3>
            <p className={`text-[10px] font-bold ${theme.colors.primaryText} uppercase tracking-widest`}>
              Đã tạo xong {currentSceneCount} cảnh ({currentSceneCount * 8}s) • Style: {state.imageStyle === 'Realistic' ? 'Chân thực' : '3D Animation'}
            </p>
          </div>

          <Reorder.Group 
            axis="y" 
            values={state.sceneOrder || []} 
            onReorder={(newOrder) => setState(p => ({ ...p, sceneOrder: newOrder }))}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6"
          >
            {(state.sceneOrder && state.sceneOrder.length > 0 ? state.sceneOrder : Array.from({ length: currentSceneCount }, (_, i) => `v${i + 1}`)).map((key, idx) => (
              <SceneItem
                key={key}
                sceneKey={key}
                idx={idx}
                state={state}
                setState={setState}
                handleRegenerateScriptPart={handleRegenerateScriptPart}
                handleGeneratePromptForKey={handleGeneratePromptForKey}
                handleGenerateImagePromptForKey={handleGenerateImagePromptForKey}
                handleGenImageForKey={handleGenImageForKey}
                handleUploadImageForKey={handleUploadImageForKey}
                handleDeleteImageForKey={handleDeleteImageForKey}
                handleTranslateForKey={handleTranslateForKey}
                language={language}
              />
            ))}
          </Reorder.Group>

          <div className="flex flex-col items-center gap-12 py-12 border-t border-slate-200 mt-12">
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button
                onClick={handleBulkImage}
                className={`w-full md:w-auto px-8 py-4 ${theme.colors.buttonPrimary} font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest`}
              >
                Vẽ tất cả ảnh
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
              </button>
              <button
                onClick={handleBulkImagePrompt}
                className={`w-full md:w-auto px-8 py-4 ${theme.colors.buttonPrimary} font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest`}
              >
                Tạo tất cả Prompt ảnh
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
              <button
                onClick={handleBulkPrompt}
                className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                Tạo tất cả Prompt video
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
              </button>
            </div>

            {hasGeneratedItems && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                <button
                  onClick={downloadAllImages}
                  className="w-full md:w-auto px-8 py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải Ảnh (ZIP)
                </button>
                <button
                  onClick={downloadAllImagePrompts}
                  className={`w-full md:w-auto px-8 py-5 ${theme.colors.buttonPrimary} font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Tải Prompt Ảnh (.txt)
                </button>
                <button
                  onClick={downloadAllPrompts}
                  className={`w-full md:w-auto px-8 py-5 ${theme.colors.buttonPrimary} font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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

export default KocReviewModule;