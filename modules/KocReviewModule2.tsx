import React, { useState, useEffect, useRef } from 'react';
import { ScriptPartKey, ScriptParts } from '../types';
import { safeSaveToLocalStorage } from '../utils/storage';
import * as service from '../services/kocReviewService2';
import * as flowApi from '../services/flowApiService';
import ScriptSection from '../components/ScriptSection';
import ImageCard, { KOC_POSES, CAMERA_ANGLES } from '../components/ImageCard';
import { HOOK_LAYOUTS } from '../components/45hook';
import { copyToClipboard } from '../utils/clipboard';
import { theme } from '../constants/colors';

declare var JSZip: any;

const LAYOUT_OPTIONS = HOOK_LAYOUTS;

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

// Flow API VEO voice options (for video narration) — matches actual demo files
const FLOW_VOICE_OPTIONS: { value: string; label: string; file: string }[] = [
  { value: '', label: '-- Không có giọng --', file: '' },
  { value: 'Achernar', label: '🎙 Achernar', file: 'Achernar.wav' },
  { value: 'Achird', label: '🎙 Achird', file: 'Achird.wav' },
  { value: 'Algenib', label: '🎙 Algenib', file: 'Algenib.wav' },
  { value: 'Algieba', label: '🎙 Algieba', file: 'Algieba.wav' },
  { value: 'Alnilam', label: '🎙 Alnilam', file: 'Alnilam.wav' },
  { value: 'Aoede', label: '🎙 Aoede', file: 'Aoede.wav' },
  { value: 'Autonoe', label: '🎙 Autonoe', file: 'Autonoe.wav' },
  { value: 'Callirrhoe', label: '🎙 Callirrhoe', file: 'Callirrhoe.wav' },
  { value: 'Charon', label: '🎙 Charon', file: 'Charon.wav' },
  { value: 'Despina', label: '🎙 Despina', file: 'Despina.wav' },
  { value: 'Enceladus', label: '🎙 Enceladus', file: 'Enceladus.wav' },
];

interface KocReviewModule2Props {
  language?: string;
}

/**
 * Run tasks with limited concurrency (parallel batches of N)
 */
const runWithConcurrency = async <T>(
  items: T[],
  handler: (item: T) => Promise<void>,
  concurrency: number = 2
): Promise<void> => {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(item => handler(item)));
  }
};

const KocReviewModule2: React.FC<KocReviewModule2Props> = ({ language = 'vi' }) => {
  const storageKey = "koc_project_v23_clone_instance";
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
    imageQuality: 'normal' as 'normal' | '4K',
    videoVoice: '' as string,
    batchConcurrency: 2,
    sceneCount: 5,
    mergedVideoUrl: '' as string,
    mergeLoading: false,
    showGuide: false,
    showHistory: false,
    productFiles: [], 
    productPreviewUrls: [],
    productName: '',
    keyword: '',
    scriptTone: '',
    productSize: '',
    scriptNote: '', 
    visualNote: '',
    scriptLayout: '',
    customLayout: '',
    isGeneratingScript: false,
    isAnalyzingBackground: false,
    isRegeneratingPart: {},
    script: null,
    images: {},
    imagePrompts: {},
    videoPrompts: {}
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
          
          setState((prev: any) => ({
            ...prev,
            ...parsed,
            sceneCount: safeSceneCount,
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
            angle: state.images[key]?.angle || '',
            customPrompt: state.images[key]?.customPrompt || ''
          }
        },
        script: state.script ? state.script[key] : '',
        outputImage: state.images[key]?.url || '',
        videoPrompt: state.videoPrompts[key]?.text || ''
      }));

      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
        detail: { data: exportData, moduleName: 'KOC_Project_2_Complete' } 
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
        const itemSegmentData = smartFind(itemInputs, ['segmentData']) || {};
        const key = `v${i + 1}`;

        newState.script[key] = smartFind(item, ['script', 'content', 'text']) || '';
        newState.images[key] = {
          url: smartFind(item, ['outputImage', 'image', 'base64']) || '',
          loading: false,
          pose: smartFind(itemSettings, ['pose']) || '',
          angle: smartFind(itemSettings, ['angle']) || '',
          customPrompt: smartFind(itemSettings, ['customPrompt']) || smartFind(itemSegmentData, ['characterIdea']) || ''
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
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const updatedFiles = [...state.productFiles, ...selectedFiles].slice(0, 3);
      const updatedUrls = updatedFiles.map(f => URL.createObjectURL(f));
      setState((prev: any) => ({
        ...prev,
        productFiles: updatedFiles,
        productPreviewUrls: updatedUrls
      }));
    }
    if (productInputRef.current) productInputRef.current.value = "";
  };

  const removeProductFile = (idx: number) => {
    setState((prev: any) => {
      const updatedFiles = prev.productFiles.filter((_: any, i: number) => i !== idx);
      const updatedPreviewUrls = prev.productPreviewUrls.filter((_: any, i: number) => i !== idx);
      return {
        ...prev,
        productFiles: updatedFiles,
        productPreviewUrls: updatedPreviewUrls
      };
    });
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

  const handlePasteImage = (e: React.ClipboardEvent, callback: (file: File) => void) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          callback(blob);
        }
      }
    }
  };

  const handlePasteProductImage = (e: React.ClipboardEvent) => {
    handlePasteImage(e, (file) => {
      setState((prev: any) => {
        const updatedFiles = [...prev.productFiles, file].slice(0, 3);
        const updatedUrls = updatedFiles.map((f: File) => URL.createObjectURL(f));
        return {
          ...prev,
          productFiles: updatedFiles,
          productPreviewUrls: updatedUrls
        };
      });
    });
  };

  const handlePasteFaceImage = (e: React.ClipboardEvent) => {
    handlePasteImage(e, (file) => {
      setState((prev: any) => ({
        ...prev,
        faceFile: file,
        facePreviewUrl: URL.createObjectURL(file)
      }));
    });
  };

  const handlePasteOutfitImage = (e: React.ClipboardEvent) => {
    handlePasteImage(e, (file) => {
      setState((prev: any) => ({
        ...prev,
        outfitFile: file,
        outfitPreviewUrl: URL.createObjectURL(file),
        processedOutfitUrl: null
      }));
    });
  };

  const handlePasteBackgroundImage = (e: React.ClipboardEvent) => {
    handlePasteImage(e, (file) => {
      setState((prev: any) => ({
        ...prev,
        backgroundFile: file,
        backgroundPreviewUrl: URL.createObjectURL(file)
      }));
    });
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

  const handleAnalyzeBackground = async () => {
    if (!state.scriptNote && !state.backgroundPreviewUrl) {
      alert("Vui lòng nhập mô tả hoặc tải ảnh bối cảnh.");
      return;
    }

    setState(p => ({ ...p, isAnalyzingBackground: true }));
    try {
      let bgPart = null;
      if (state.backgroundFile) {
        bgPart = await service.fileToGenerativePart(state.backgroundFile);
      } else if (state.backgroundPreviewUrl?.startsWith('data:')) {
        bgPart = { mimeType: 'image/png', data: state.backgroundPreviewUrl.split(',')[1] };
      }

      const detailedBg = await service.analyzeDetailedBackground(state.scriptNote, bgPart);
      setState(p => ({ ...p, scriptNote: detailedBg, isAnalyzingBackground: false }));
    } catch (e) {
      console.error(e);
      setState(p => ({ ...p, isAnalyzingBackground: false }));
      alert("Lỗi khi phân tích bối cảnh.");
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
      initialImages[k] = { url: '', loading: false, customPrompt: '', pose: '', format: '' };
      initialPrompts[k] = { text: '', loading: false, visible: false };
      initialImagePrompts[k] = { text: '', loading: false, visible: false };
    });

    setState((prev: any) => ({
      ...prev,
      isGeneratingScript: true,
      script: null,
      images: initialImages,
      imagePrompts: initialImagePrompts,
      videoPrompts: initialPrompts
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
      if (layoutToUse === 'Tự sáng tạo') {
        layoutToUse = state.customLayout || 'Tự sáng tạo';
      } else if (!layoutToUse) {
        layoutToUse = LAYOUT_OPTIONS[Math.floor(Math.random() * LAYOUT_OPTIONS.length)];
      }

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
      // Auto-save to history
      setTimeout(() => saveToHistory(), 500);
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
        state.scriptLayout === 'Tự sáng tạo' ? state.customLayout : state.scriptLayout,
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
    const imageFormat = state.images[key]?.format || "";

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
        imageFormat,
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

      const currentFormat = state.images[key]?.format || "";

      const url = await service.generateKocImage(
        productParts,
        facePart,
        outfitPart,
        "", 
        state.productName,
        state.script[key],
        state.characterDescription,
        state.images[key]?.customPrompt,
        state.gender,
        state.imageStyle,
        state.scriptNote,
        state.visualNote,
        poseLabel,
        bgRefPart,
        currentFormat,
        language,
        state.imageQuality
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

  const handleBulkImage = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    await runWithConcurrency(keys, handleGenImageForKey, state.batchConcurrency);
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
      const currentFormat = state.images[key]?.format || "";

      const prompt = await service.generateKocVeoPrompt(
        state.productName,
        state.script[key],
        state.gender,
        state.voice,
        productImageData,
        state.images[key].url,
        isNoProduct,
        state.imageStyle,
        currentFormat,
        language
      );
      setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { text: prompt, loading: false, visible: true } } }));
    } catch (e) {
      setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } }));
    }
  };

  const handleBulkImagePrompt = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    await runWithConcurrency(keys, handleGenerateImagePromptForKey, state.batchConcurrency);
  };

  const handleBulkPrompt = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    await runWithConcurrency(keys, handleGeneratePromptForKey, state.batchConcurrency);
  };

  // Flow API: Tạo video cho từng cảnh
  const handleFlowVideoForKey = async (key: string) => {
    if (!state.videoPrompts[key]?.text) {
      alert(`Cảnh ${key}: Chưa có Video Prompt.`);
      return;
    }
    const imageUrl = state.images[key]?.url || '';
    setState((prev: any) => ({
      ...prev,
      images: { ...prev.images, [key]: { ...prev.images[key], videoLoading: true } }
    }));
    try {
      let videoUrl: string;
      const voiceOpt = state.videoVoice || undefined;
      if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('blob:'))) {
        videoUrl = await flowApi.base64ImageToVideo(
          imageUrl,
          state.videoPrompts[key].text,
          '9:16',
          (job) => console.log(`[Flow I2V ${key}] ${job.progress}%`),
          voiceOpt
        );
      } else {
        const result = await flowApi.textToVideo(
          [state.videoPrompts[key].text],
          { aspect_ratio: '9:16', voice: voiceOpt },
          (job) => console.log(`[Flow T2V ${key}] ${job.progress}%`)
        );
        videoUrl = result.videoUrl;
      }
      setState((prev: any) => ({
        ...prev,
        images: { ...prev.images, [key]: { ...prev.images[key], videoUrl, videoLoading: false } }
      }));
    } catch (e) {
      console.error(`Flow video for ${key} failed`, e);
      setState((prev: any) => ({
        ...prev,
        images: { ...prev.images, [key]: { ...prev.images[key], videoLoading: false } }
      }));
    }
  };

  // Bulk: Tạo tất cả video (luôn I2V từ ảnh)
  const handleBulkVideo = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`)
      .filter(key => state.videoPrompts[key]?.text && state.images[key]?.url);
    await runWithConcurrency(keys, handleFlowVideoForKey, state.batchConcurrency);
  };

  // Merge: Nối tất cả video thành 1
  const handleMergeVideos = async () => {
    const videoKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`)
      .filter(key => state.images[key]?.videoUrl);
    
    if (videoKeys.length < 2) {
      alert('Cần ít nhất 2 video để nối.');
      return;
    }

    setState((p: any) => ({ ...p, mergeLoading: true, mergedVideoUrl: '' }));
    try {
      console.log(`[Merge] Uploading ${videoKeys.length} videos...`);
      // Upload all video blob URLs to server to get paths
      const videoPaths: string[] = [];
      for (const key of videoKeys) {
        const videoUrl = state.images[key].videoUrl;
        const resp = await fetch(videoUrl);
        const blob = await resp.blob();
        const file = new File([blob], `scene_${key}.mp4`, { type: 'video/mp4' });
        const path = await flowApi.uploadVideo(file);
        videoPaths.push(path);
        console.log(`[Merge] Uploaded ${key}: ${path}`);
      }

      console.log(`[Merge] Merging ${videoPaths.length} videos...`);
      const result = await flowApi.mergeVideos(
        videoPaths,
        `koc_${state.productName || 'merged'}`,
        (job) => console.log(`[Merge] ${job.progress}%`)
      );

      setState((p: any) => ({ ...p, mergedVideoUrl: result.videoUrl, mergeLoading: false }));
      console.log('[Merge] ✅ Done:', result.videoUrl);
    } catch (e) {
      console.error('[Merge] Failed:', e);
      alert('Nối video thất bại: ' + (e as Error).message);
      setState((p: any) => ({ ...p, mergeLoading: false }));
    }
  };

  // DỰ ÁN TỰ ĐỘNG: Pipeline đầy đủ với nút Stop
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStep, setAutoStep] = useState('');
  const abortRef = useRef(false);

  const handleStopAuto = () => {
    abortRef.current = true;
    setAutoRunning(false);
    setAutoStep('⏹ Đã dừng');
    setTimeout(() => setAutoStep(''), 3000);
  };

  const handleAutoProject = async () => {
    if (autoRunning) return;
    abortRef.current = false;
    setAutoRunning(true);
    try {
      // Step 1: Tạo Prompt Ảnh
      setAutoStep('1/4: Tạo Prompt Ảnh...');
      console.log('[AutoProject] Step 1/4: Tạo Prompt Ảnh...');
      await handleBulkImagePrompt();
      if (abortRef.current) return;
      
      // Step 2: Tạo Ảnh (R2I/T2I)
      setAutoStep('2/4: Tạo Ảnh...');
      console.log('[AutoProject] Step 2/4: Tạo Ảnh...');
      await handleBulkImage();
      if (abortRef.current) return;
      
      // Step 3: Tạo Video Prompt
      setAutoStep('3/4: Tạo Video Prompt...');
      console.log('[AutoProject] Step 3/4: Tạo Video Prompt...');
      await handleBulkPrompt();
      if (abortRef.current) return;
      
      // Step 4: Tạo Video từ Ảnh (I2V)
      setAutoStep('4/4: Tạo Video (I2V)...');
      console.log('[AutoProject] Step 4/4: Tạo Video...');
      await handleBulkVideo();
      
      if (!abortRef.current) {
        setAutoStep('✅ Hoàn tất!');
        console.log('[AutoProject] ✅ Hoàn tất!');
        setTimeout(() => setAutoStep(''), 5000);
      }
    } catch (e) {
      console.error('[AutoProject] Lỗi:', e);
      setAutoStep('❌ Lỗi: ' + (e as Error).message);
    } finally {
      setAutoRunning(false);
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
    link.download = `koc_images_2_${state.productName || 'project'}.zip`;
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
    link.download = `video_prompts_2_${state.productName || 'koc'}.txt`;
    link.click();
  };

  const downloadAllImagePrompts = () => {
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const text = activeKeys
      .map(key => state.imagePrompts[key]?.text || "")
      .filter(t => t.trim().length > 0)
      .map(t => t.replace(/\n/g, ' '))
      .join('\n');

    if (!text) {
      alert("Vui lòng tạo Prompt Ảnh trước khi tải xuống.");
      return;
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob as any);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image_prompts_2_${state.productName || 'koc'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Lịch sử đã tạo
  const HISTORY_KEY = 'koc_v2_project_history';
  
  const getHistory = (): any[] => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch { return []; }
  };

  const saveToHistory = () => {
    if (!state.productName || !state.script) return;
    const history = getHistory();
    const entry = {
      id: Date.now(),
      name: state.productName,
      date: new Date().toLocaleDateString('vi-VN'),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      sceneCount: state.sceneCount,
      imageStyle: state.imageStyle,
      imageQuality: state.imageQuality,
      thumbnail: state.productPreviewUrls?.[0] || '',
      stateSnapshot: JSON.stringify(state),
    };
    // Keep last 20 entries
    history.unshift(entry);
    if (history.length > 20) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  };

  const loadFromHistory = (entry: any) => {
    try {
      const restored = JSON.parse(entry.stateSnapshot);
      setState(restored);
    } catch (e) {
      alert('Không thể khôi phục dự án này.');
    }
  };

  const deleteFromHistory = (id: number) => {
    const history = getHistory().filter((h: any) => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    setState((p: any) => ({ ...p })); // force re-render
  };

  const hasGeneratedItems = state.script && Object.values(state.images).some((img: any) => img.url);

  const currentSceneCount = typeof state.sceneCount === 'object' ? (state.sceneCount.count || 0) : (state.sceneCount || 0);


  return (
    <div className="max-w-7xl mx-auto px-4 py-8 koc-review-v2-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .koc-review-v2-container .text-sm, 
        .koc-review-v2-container .text-base, 
        .koc-review-v2-container input, 
        .koc-review-v2-container select, 
        .koc-review-v2-container textarea {
          border-color: #ccc !important;
        }
      ` }} />

      {/* HƯỚNG DẪN + LỊCH SỬ */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setState((p: any) => ({ ...p, showGuide: !p.showGuide, showHistory: false }))}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            state.showGuide ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          📖 Hướng dẫn
        </button>
        <button
          onClick={() => setState((p: any) => ({ ...p, showHistory: !p.showHistory, showGuide: false }))}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            state.showHistory ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          🕐 Lịch sử ({getHistory().length})
        </button>
      </div>

      {/* GUIDE SECTION */}
      {state.showGuide && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 mb-6 animate-fadeIn">
          <h3 className="text-sm font-black text-blue-800 uppercase tracking-tight mb-4 flex items-center gap-2">
            📖 HƯỚNG DẪN SỬ DỤNG KOC STUDIO V2
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center flex-shrink-0">1</span>
                <div><b>Upload ảnh sản phẩm</b> (tối đa 3 ảnh) + ảnh mặt mẫu + trang phục nếu có</div>
              </div>
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center flex-shrink-0">2</span>
                <div><b>Điền thông tin</b>: Tên SP, USP, đối tượng, giới tính, giọng điệu, xưng hô</div>
              </div>
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center flex-shrink-0">3</span>
                <div><b>Chọn cài đặt</b>: Số cảnh, phong cách (Chân thực/3D), chất lượng (Nhanh/4K), giọng video, luồng song song</div>
              </div>
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center flex-shrink-0">4</span>
                <div><b>Nhấn "Bắt đầu tạo kịch bản"</b> để AI viết kịch bản review</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-violet-600 text-white font-black flex items-center justify-center flex-shrink-0">5</span>
                <div><b>Dự án tự động</b>: Nhấn nút tím để chạy pipeline đầy đủ (Prompt → Ảnh → Video Prompt → Video)</div>
              </div>
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-violet-600 text-white font-black flex items-center justify-center flex-shrink-0">6</span>
                <div><b>Hoặc chạy từng bước</b>: Tạo Prompt Ảnh → Tạo Ảnh → Tạo Prompt Video → Tạo Video</div>
              </div>
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center flex-shrink-0">7</span>
                <div><b>Nối Video</b>: Khi có ≥2 video, nhấn "Nối Video" để ghép tất cả thành 1 video</div>
              </div>
              <div className="flex gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center flex-shrink-0">8</span>
                <div><b>Tải xuống</b>: Tải ảnh (ZIP), prompt ảnh, prompt video hoặc video đã nối</div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800 font-bold">💡 <b>Mẹo</b>: Dùng "Luồng song song" 2x-3x để tăng tốc tạo ảnh/video. Chọn "Nhanh" nếu không cần 4K upscale.</p>
          </div>
        </div>
      )}

      {/* HISTORY SECTION */}
      {state.showHistory && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-6 mb-6 animate-fadeIn">
          <h3 className="text-sm font-black text-violet-800 uppercase tracking-tight mb-4 flex items-center gap-2">
            🕐 LỊCH SỬ DỰ ÁN ĐÃ TẠO
          </h3>
          {getHistory().length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">Chưa có dự án nào. Hãy tạo kịch bản để lưu lịch sử.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {getHistory().map((entry: any) => (
                <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3 hover:shadow-md transition-all group">
                  {entry.thumbnail && (
                    <img src={entry.thumbnail} className="w-12 h-16 object-cover rounded-lg border border-slate-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-800 truncate">{entry.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold">{entry.date} {entry.time}</p>
                    <p className="text-[10px] text-slate-500">{entry.sceneCount} cảnh • {entry.imageStyle} • {entry.imageQuality}</p>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => loadFromHistory(entry)}
                        className="px-2 py-1 bg-violet-100 text-violet-700 rounded-md text-[10px] font-black hover:bg-violet-200 transition-all"
                      >
                        📂 Mở
                      </button>
                      <button
                        onClick={() => { if (confirm('Xóa dự án này?')) deleteFromHistory(entry.id); }}
                        className="px-2 py-1 bg-red-50 text-red-500 rounded-md text-[10px] font-black hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 flex flex-col gap-4">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700">1. Hình ảnh sản phẩm (Chọn tối đa 3 ảnh)</label>
                <div 
                  onClick={() => productInputRef.current?.click()} 
                  onPaste={handlePasteProductImage}
                  tabIndex={0}
                  className={`w-full h-32 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all ${theme.colors.primaryBorder}/20 group focus:ring-2 focus:ring-slate-200 focus:outline-none`}
                >
                  <div className="flex flex-col items-center opacity-40 group-hover:opacity-60 transition-opacity">
                    <svg className={`w-8 h-8 ${theme.colors.primaryText} mb-1`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest text-center">Tải ảnh sản phẩm (Multiple) <br/> hoặc Paste từ Clipboard</span>
                </div>
                <input type="file" multiple ref={productInputRef} onChange={handleProductFilesChange} className="hidden" accept="image/*" />
              </div>

              {state.productPreviewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {state.productPreviewUrls.map((url: string, idx: number) => (
                    <div key={idx} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 group/item shadow-sm">
                      <img src={url} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removeProductFile(idx)}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full opacity-90 transition-all z-20 shadow-md border border-white/20"
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
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Ghi chú nhân vật</label>
                <textarea
                  value={state.characterDescription}
                  onChange={e => setState(p => ({ ...p, characterDescription: e.target.value }))}
                  placeholder="Mô tả phong cách, diện mạo nhân vật..."
                  className={`w-full p-3 border rounded-xl h-24 text-sm ${theme.colors.inputFocus} outline-none transition-all`}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">0. Ảnh mặt mẫu</label>
                <div 
                  onClick={() => faceInputRef.current?.click()} 
                  onPaste={handlePasteFaceImage}
                  tabIndex={0}
                  className="relative w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden group focus:ring-2 focus:ring-slate-200 focus:outline-none"
                >
                  {state.facePreviewUrl ? (
                    <>
                      <img src={state.facePreviewUrl} className="h-full object-cover" />
                      <button 
                        onClick={removeFaceFile}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full opacity-90 transition-all z-10 shadow-lg border border-white/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : <span className="text-slate-400 text-[10px] uppercase font-bold text-center p-2">Mặt mẫu</span>}
                  <input type="file" ref={faceInputRef} onChange={handleFaceFileChange} className="hidden" accept="image/*" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">2. Trang phục/Tay/Chân mẫu</label>
                <div 
                  onClick={() => outfitInputRef.current?.click()} 
                  onPaste={handlePasteOutfitImage}
                  tabIndex={0}
                  className="relative w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden group focus:ring-2 focus:ring-slate-200 focus:outline-none"
                >
                  {state.outfitPreviewUrl ? (
                    <>
                      <img src={state.outfitPreviewUrl} className="h-full object-cover" />
                      <button 
                        onClick={removeOutfitFile}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full opacity-90 transition-all z-10 shadow-lg border border-white/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : <span className="text-slate-400 text-[10px] uppercase font-bold text-center p-2">Trang phục/Tay/Chân mẫu</span>}
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Tên sản phẩm</label>
                <input type="text" value={state.productName} onChange={e => setState(p => ({ ...p, productName: e.target.value }))} placeholder="Nhập tên sản phẩm..." className={`w-full p-3 border rounded-xl ${theme.colors.inputFocus} outline-none transition-all`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Tệp khách hàng mục tiêu</label>
                <input type="text" value={state.targetAudience} onChange={e => setState(p => ({ ...p, targetAudience: e.target.value }))} placeholder="VD: Mẹ bỉm sữa, dân văn phòng, sinh viên..." className={`w-full p-3 border rounded-xl ${theme.colors.inputFocus} outline-none transition-all`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">USP sản phẩm (Đặc điểm nổi bật, công dụng, giá trị...)</label>
                <textarea
                  value={state.keyword}
                  onChange={e => setState(p => ({ ...p, keyword: e.target.value }))}
                  placeholder="Điền các điểm USP nổi bật của sản phẩm..."
                  className={`w-full p-3 border rounded-xl h-24 text-sm ${theme.colors.inputFocus} outline-none transition-all`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Giới tính nhân vật</label>
                <select value={state.gender} onChange={e => setState(p => ({ ...p, gender: e.target.value }))} className={`w-full p-3 border rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold`}>
                  <option value="Nữ">Nữ</option>
                  <option value="Nam">Nam</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Giọng điệu vùng miền</label>
                <select value={state.voice} onChange={e => setState(p => ({ ...p, voice: e.target.value }))} className={`w-full p-3 border rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold`}>
                  {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Cách xưng hô (Người nói - Người nghe)</label>
              <div className="flex gap-2">
                <div className="flex-1 relative group">
                   <input 
                      list="addressing-list-2"
                      value={state.addressing} 
                      onChange={e => setState(p => ({ ...p, addressing: e.target.value }))}
                      placeholder="Chọn hoặc tự nhập (VD: em - các bác)"
                      className={`w-full p-3 border rounded-xl bg-white ${theme.colors.inputFocus} font-bold text-sm outline-none shadow-sm`}
                   />
                   <datalist id="addressing-list-2">
                      {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                   </datalist>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Thời lượng (Scenes)</label>
                <select value={currentSceneCount} onChange={e => setState(p => ({ ...p, sceneCount: parseInt(e.target.value) }))} className={`w-full p-3 border rounded-xl bg-white focus:ring-2 ${theme.colors.secondaryBg} outline-none font-bold text-slate-700`}>
                  {SCENE_COUNT_OPTIONS.map(opt => (
                    <option key={opt.count} value={opt.count}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Phong cách ảnh (Lifestyle)</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setState(p => ({ ...p, imageStyle: 'Realistic' }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === 'Realistic' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    style={state.imageStyle === 'Realistic' ? { backgroundColor: 'var(--primary-color)' } : {}}
                  >
                    Chân thực
                  </button>
                  <button
                    onClick={() => setState(p => ({ ...p, imageStyle: '3D' }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === '3D' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    style={state.imageStyle === '3D' ? { backgroundColor: 'var(--primary-color)' } : {}}
                  >
                    3D Animation
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Chất lượng ảnh</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setState(p => ({ ...p, imageQuality: 'normal' as any }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageQuality === 'normal' ? 'text-white shadow-md bg-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ⚡ Nhanh
                  </button>
                  <button
                    onClick={() => setState(p => ({ ...p, imageQuality: '4K' as any }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageQuality === '4K' ? 'text-white shadow-md bg-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    🔥 4K Upscale
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">🎙 Giọng video (VEO Voice)</label>
                <div className="flex gap-2">
                  <select
                    value={state.videoVoice}
                    onChange={e => setState(p => ({ ...p, videoVoice: e.target.value }))}
                    className={`flex-1 p-2.5 border rounded-xl bg-white ${theme.colors.inputFocus} outline-none text-sm font-bold`}
                  >
                    {FLOW_VOICE_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  {state.videoVoice && (() => {
                    const selectedVoice = FLOW_VOICE_OPTIONS.find(v => v.value === state.videoVoice);
                    return selectedVoice?.file ? (
                      <button
                        onClick={() => {
                          const audio = new Audio(`/audio-demo/${selectedVoice.file}`);
                          audio.play().catch(e => console.error('Audio play failed:', e));
                        }}
                        className="px-3 py-2 bg-violet-100 text-violet-700 rounded-xl hover:bg-violet-200 transition-all text-xs font-black flex items-center gap-1 whitespace-nowrap"
                        title={`Nghe thử giọng ${selectedVoice.value}`}
                      >
                        🔊 Nghe thử
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">⚡ Luồng song song</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                  {[1, 2, 3, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setState(p => ({ ...p, batchConcurrency: n }))}
                      className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${state.batchConcurrency === n ? 'text-white shadow-md bg-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Bố cục kịch bản (Layout)</label>
              <select value={state.scriptLayout} onChange={e => setState(p => ({ ...p, scriptLayout: e.target.value }))} className={`w-full p-3 border rounded-xl bg-white ${theme.colors.inputFocus} outline-none`}>
                <option value="">-- Random Layout --</option>
                {LAYOUT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {state.scriptLayout === 'Tự sáng tạo' && (
                <textarea
                  value={state.customLayout}
                  onChange={e => setState(p => ({ ...p, customLayout: e.target.value }))}
                  placeholder="Tự điền bố cục hoặc câu hook theo nhu cầu của bạn..."
                  className={`w-full p-3 border rounded-xl h-24 text-sm mt-2 ${theme.colors.inputFocus} outline-none transition-all`}
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Background bối cảnh (Bắt buộc dùng cho ảnh)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => backgroundInputRef.current?.click()}
                  onPaste={handlePasteBackgroundImage}
                  tabIndex={0}
                  className="aspect-video border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden group relative focus:ring-2 focus:ring-slate-200 focus:outline-none"
                >
                  {state.backgroundPreviewUrl ? (
                    <>
                      <img src={state.backgroundPreviewUrl} className="h-full w-full object-cover" />
                      <button 
                        onClick={removeBackgroundFile}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-90 transition-all z-10 shadow-lg border border-white/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tải ảnh bối cảnh</span>
                    </div>
                  )}
                  <input type="file" ref={backgroundInputRef} onChange={handleBackgroundFileChange} className="hidden" accept="image/*" />
                </div>
                <div className="relative h-full">
                  <textarea
                    value={state.scriptNote}
                    onChange={e => setState(p => ({ ...p, scriptNote: e.target.value }))}
                    placeholder="Mô tả bối cảnh chi tiết bằng chữ (VD: phòng khách sang trọng, ánh sáng ấm...)"
                    className={`w-full p-3 border rounded-xl h-full text-sm ${theme.colors.inputFocus} outline-none transition-all resize-none font-medium pr-12`}
                  />
                  <button
                    onClick={handleAnalyzeBackground}
                    disabled={state.isAnalyzingBackground}
                    className={`absolute bottom-2 right-2 p-2 ${theme.colors.secondaryBg} ${theme.colors.primaryText} rounded-lg ${theme.colors.secondaryHover} transition-all shadow-sm group`}
                    title="Phân tích chi tiết bối cảnh"
                  >
                    {state.isAnalyzingBackground ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={state.isGeneratingScript} 
              className="w-full py-4 text-white font-black rounded-xl shadow-lg disabled:opacity-50 transition-all active:scale-[0.98] uppercase tracking-widest"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              {state.isGeneratingScript ? "Đang xử lý kịch bản..." : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}
            </button>
          </div>
        </div>
      </div>

      {state.script && (
        <div className="space-y-8 pb-32">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
            <h3 className="text-sm font-black text-white uppercase tracking-tight">KẾT QUẢ CHIẾN DỊCH (LIFESTYLE MODE - CLONE)</h3>
            <p className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest`}>
              Đã tạo xong {currentSceneCount} cảnh ({currentSceneCount * 8}s) • Style: {state.imageStyle === 'Realistic' ? 'Chân thực' : '3D Animation'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {Array.from({ length: currentSceneCount }, (_, i) => `v${i + 1}`).map((key, idx) => (
              <div key={key} className="space-y-4">
                <ScriptSection
                  title={`Phần ${idx + 1}`}
                  content={state.script[key]}
                  color={theme.colors.primaryBorder}
                  onChange={(val) => setState(p => ({ ...p, script: { ...p.script, [key]: val } }))}
                  onRegenerate={() => handleRegenerateScriptPart(key)}
                  isRegenerating={state.isRegeneratingPart[key]}
                  minChars={160}
                  maxChars={180}
                />
                <ImageCard
                  label={`Cảnh ${idx + 1}`}
                  imageData={state.images[key]}
                  videoPrompt={state.videoPrompts[key]}
                  imagePrompt={state.imagePrompts[key]}
                  onGeneratePrompt={() => handleGeneratePromptForKey(key)}
                  onGenerateImagePrompt={() => handleGenerateImagePromptForKey(key)}
                  onRegenerate={() => handleGenImageForKey(key)}
                  onGenerateVideo={() => handleFlowVideoForKey(key)}
                  onTranslate={() => { }}
                  onUpload={(file) => handleUploadImageForKey(key, file)}
                  onDelete={() => handleDeleteImageForKey(key)}
                  format={state.images[key]?.format || ''}
                  onFormatChange={(val) => setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], format: val } } }))}
                  customPrompt={state.images[key]?.customPrompt || ''}
                  onCustomPromptChange={(val) => setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], customPrompt: val } } }))}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-8 py-12">
            {/* NÚT DỰ ÁN TỰ ĐỘNG + STOP */}
            <div className="w-full px-4 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleAutoProject}
                  disabled={autoRunning}
                  className={`flex-1 py-5 text-white font-black rounded-2xl shadow-2xl transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest ${
                    autoRunning
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 cursor-wait'
                      : 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  {autoRunning ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {autoStep || 'ĐANG CHẠY...'}</>
                  ) : (
                    <>🚀 DỰ ÁN TỰ ĐỘNG (Prompt → Ảnh → Video Prompt → Video)</>
                  )}
                </button>
                {autoRunning && (
                  <button
                    onClick={handleStopAuto}
                    className="px-6 py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-2xl transition-all active:scale-95 uppercase tracking-widest text-sm"
                  >
                    ⏹ DỪNG
                  </button>
                )}
              </div>
              {autoStep && !autoRunning && (
                <div className="text-center text-sm font-bold text-slate-600 bg-slate-100 rounded-xl py-2">{autoStep}</div>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button
                onClick={handleBulkImagePrompt}
                className="w-full md:w-auto px-6 py-3 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 uppercase tracking-widest"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                📝 Tạo Prompt ảnh
              </button>
              <button
                onClick={handleBulkImage}
                className="w-full md:w-auto px-6 py-3 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 uppercase tracking-widest"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                🖼 Tạo Ảnh (R2I)
              </button>
              <button
                onClick={handleBulkPrompt}
                className="w-full md:w-auto px-6 py-3 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 uppercase tracking-widest"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                ⚡ Tạo Prompt video
              </button>
              <button
                onClick={handleBulkVideo}
                className="w-full md:w-auto px-6 py-3 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 uppercase tracking-widest bg-gradient-to-r from-violet-600 to-fuchsia-600"
              >
                🎥 Tạo Video (I2V)
              </button>
            </div>

            {/* VIDEO GALLERY */}
            {(() => {
              const videoKeys = Array.from({ length: currentSceneCount }, (_, i) => `v${i + 1}`)
                .filter(key => state.images[key]?.videoUrl);
              if (videoKeys.length === 0) return null;
              return (
                <div className="w-full px-4">
                  <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">🎬 VIDEO ĐÃ TẠO ({videoKeys.length}/{currentSceneCount})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      {videoKeys.map((key, idx) => (
                        <div key={key} className="space-y-2">
                          <video
                            src={state.images[key].videoUrl}
                            controls
                            playsInline
                            className="w-full aspect-[9/16] bg-black rounded-xl border border-slate-700"
                          />
                          <p className="text-xs text-slate-400 font-bold text-center">Cảnh {parseInt(key.replace('v',''))}</p>
                        </div>
                      ))}
                    </div>
                    {videoKeys.length >= 2 && (
                      <div className="mt-4 flex flex-col items-center gap-4">
                        <button
                          onClick={handleMergeVideos}
                          disabled={state.mergeLoading}
                          className={`w-full py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-3 ${
                            state.mergeLoading
                              ? 'bg-amber-500/20 text-amber-400 cursor-wait'
                              : state.mergedVideoUrl
                                ? 'bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 active:scale-95'
                                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg hover:scale-[1.02] active:scale-95'
                          }`}
                        >
                          {state.mergeLoading ? (
                            <><div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> Đang nối video...</>
                          ) : state.mergedVideoUrl ? (
                            <><span>🔄</span> Nối lại Video ({videoKeys.length} cảnh)</>
                          ) : (
                            <><span>🎬</span> Nối Video ({videoKeys.length} cảnh → 1 video)</>
                          )}
                        </button>
                        {state.mergedVideoUrl && (
                          <div className="w-full space-y-3">
                            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest text-center">✅ VIDEO ĐÃ NỐI</h4>
                            <video
                              src={state.mergedVideoUrl}
                              controls
                              playsInline
                              className="w-full max-w-md mx-auto aspect-[9/16] bg-black rounded-xl border-2 border-emerald-500/30"
                            />
                            <a
                              href={state.mergedVideoUrl}
                              download={`koc_merged_${state.productName || 'video'}.mp4`}
                              className="block w-full max-w-md mx-auto py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-center text-sm uppercase tracking-wider transition-all active:scale-95"
                            >
                              ⬇ Tải Video Đã Nối
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {hasGeneratedItems && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                <button
                  onClick={downloadAllImages}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải Ảnh (ZIP)
                </button>
                <button
                  onClick={downloadAllImagePrompts}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Tải Prompt Ảnh (.txt)
                </button>
                <button
                  onClick={downloadAllPrompts}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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

export default KocReviewModule2;