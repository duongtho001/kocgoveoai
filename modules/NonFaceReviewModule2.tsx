
import React, { useState, useEffect, useRef } from 'react';
import { ScriptParts } from '../types';
import { safeSaveToLocalStorage } from '../utils/storage';
import { theme } from '../constants/colors';
import * as service from '../services/nonFaceReview2Service';
import ScriptSection from '../components/ScriptSection';
import ImageCard from '../components/ImageCard';
import { analyzeDetailedBackground } from '../services/kocReviewService2';
import { HOOK_LAYOUTS } from '../components/45hook';

declare var JSZip: any;

const LAYOUT_OPTIONS = HOOK_LAYOUTS;

const FOOTWEAR_POSES = [
  { "value": "", "label": "-- Chọn góc chụp theo ảnh mẫu --" },
  { "value": "pov_looking_down_concrete", "label": "Góc nhìn xuống bàn chân (POV Pavement)" },
  { "value": "low_angle_sky_background", "label": "Góc thấp từ dưới lên trời (Sky View)" },
  { "value": "sitting_on_green_grass", "label": "Ngồi trên thảm cỏ (Grass Field)" },
  { "value": "standing_firmly_floor", "label": "Đứng vững trên sàn (Góc ngang)" },
  { "value": "walking_cycle_side", "label": "Đang bước đi (Góc nghiêng)" },
  { "value": "low_angle_toe_up", "label": "Góc thấp - Nhấc mũi chân khoe đế" },
  { "value": "putting_on_shoe_sitting", "label": "Ngồi xỏ giày (Sitting & Wearing)" },
  { "value": "crossing_legs_showing_side", "label": "Gác chân khoe dáng bên (Side profile)" },
  { "value": "pov_looking_down_at_feet", "label": "Nhìn xuống chân (Góc mắt)" },
  { "value": "close_up_heel_strike", "label": "Cận cảnh gót chân chạm đất" },
  { "value": "close_up_toe_box", "label": "Cận cảnh mũi giày (Toe close-up)" },
  { "value": "close_up_side_profile", "label": "Cận cảnh thân giày (Side close-up)" },
  { "value": "close_up_sole_texture", "label": "Cận cảnh mặt đế (Sole texture)" },
  { "value": "top_down_flat_lay", "label": "Góc từ trên xuống (Top-down view)" }
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
  "tui - mấy bà",
  "mình - cả nhà",
  "tớ - các cậu",
  "mình - các bạn",
  "tao - mày",
  "tui - mấy ní",
  "tui - các bác",
  "tui - mấy ông",
  "mình - mọi người"
];

interface Props {
  language?: string;
}

const NonFaceReviewModule2: React.FC<Props> = ({ language = 'vi' }) => {
  const storageKey = "nonface_footwear_project_v2_stable";
  const [state, setState] = useState<any>({
    backgroundFile: null,
    backgroundPreviewUrl: null,
    footFile: null,
    footPreviewUrl: null,
    isExtractingFoot: false,
    footDescription: '',
    gender: 'Nữ',
    voice: VOICE_OPTIONS[0],
    addressing: '',
    targetAudience: '',
    imageStyle: 'Realistic',
    displayMode: 'on_foot', 
    sceneCount: 5,
    productFiles: [], 
    productPreviewUrls: [],
    productName: '',
    keyword: '',
    scriptNote: '', 
    visualNote: '',
    isAnalyzingBackground: false,
    scriptLayout: '',
    isGeneratingScript: false,
    isRegeneratingPart: {},
    script: null,
    images: {},
    videoPrompts: {},
    imagePrompts: {}
  });

  const productInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const footInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setState((prev: any) => ({
            ...prev,
            ...parsed,
            productFiles: [],
            backgroundFile: null,
            footFile: null,
            isGeneratingScript: false,
            isExtractingFoot: false,
            isRegeneratingPart: {}
          }));
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const { isGeneratingScript, isExtractingFoot, isRegeneratingPart, productFiles, backgroundFile, footFile, ...persistentData } = state;
    safeSaveToLocalStorage(storageKey, persistentData);
  }, [state]);

  const processImportData = async (importedData: any) => {
    if (!Array.isArray(importedData) || importedData.length === 0) return;
    window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 10, complete: false } }));
    
    try {
      const firstItem = importedData[0];
      const inputs = firstItem.inputs || {};
      const settings = inputs.settings || {};
      const media = inputs.inputMedia || {};

      const newState = {
        ...state,
        productName: inputs.productName || state.productName,
        keyword: inputs.keyword || state.keyword,
        targetAudience: inputs.targetAudience || state.targetAudience,
        visualNote: inputs.visualNote || state.visualNote,
        scriptNote: inputs.scriptNote || state.scriptNote,
        footDescription: inputs.footDescription || state.footDescription,
        gender: settings.gender || state.gender,
        voice: settings.voice || state.voice,
        addressing: settings.addressing || state.addressing,
        imageStyle: settings.imageStyle || state.imageStyle,
        displayMode: settings.displayMode || 'on_foot',
        scriptLayout: settings.scriptLayout || state.scriptLayout,
        productPreviewUrls: media.productImages || [],
        backgroundPreviewUrl: media.backgroundImage || "",
        footPreviewUrl: media.footImage || "",
        sceneCount: importedData.length,
        script: {}, images: {}, videoPrompts: {}
      };

      for (let i = 0; i < importedData.length; i++) {
        const item = importedData[i];
        const key = `v${i + 1}`;
        const itemInputs = item.inputs || {};
        const itemSettings = itemInputs.settings || {};
        const itemSegmentData = itemInputs.segmentData || {};
        
        newState.script[key] = item.script || '';
        newState.images[key] = { 
          url: item.outputImage || '', 
          loading: false, 
          angle: itemSettings.angle || '', 
          pose: itemSettings.pose || '',
          customPrompt: itemSettings.customPrompt || itemSegmentData.characterIdea || '' 
        };
        newState.videoPrompts[key] = { 
          text: item.videoPrompt || '', 
          loading: false, 
          visible: !!item.videoPrompt 
        };

        const percent = Math.round(((i + 1) / importedData.length) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent, complete: i === importedData.length - 1 } }));
        await new Promise(r => setTimeout(r, 20));
      }
      setState(newState);
    } catch (e) {
      alert("Lỗi khi nạp dữ liệu JSON!");
    }
  };

  const handleExportData = async () => {
    const getBase64 = async (file: File | null, fallbackUrl: string | null) => {
      if (file) {
        const part = await service.fileToGenerativePart(file);
        return `data:${file.type};base64,${part.data}`;
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

    const backgroundBase64 = await getBase64(state.backgroundFile, state.backgroundPreviewUrl);
    const footBase64 = await getBase64(state.footFile, state.footPreviewUrl);

    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const exportData = activeKeys.map((key, index) => ({
      stt: index + 1,
      inputs: {
        productName: state.productName,
        keyword: state.keyword,
        targetAudience: state.targetAudience, 
        visualNote: state.visualNote,
        scriptNote: state.scriptNote, 
        footDescription: state.footDescription,
        inputMedia: {
          productImages: productImagesBase64.filter(i => i),
          backgroundImage: backgroundBase64,
          footImage: footBase64
        },
        settings: {
          gender: state.gender,
          voice: state.voice,
          addressing: state.addressing,
          imageStyle: state.imageStyle,
          displayMode: state.displayMode,
          scriptLayout: state.scriptLayout,
          angle: state.images[key]?.angle || '',
          pose: state.images[key]?.pose || '',
          customPrompt: state.images[key]?.customPrompt || ''
        }
      },
      script: state.script ? state.script[key] : '',
      outputImage: state.images[key]?.url || '',
      videoPrompt: state.videoPrompts[key]?.text || ''
    }));
    return exportData;
  };

  useEffect(() => {
    const onGlobalExport = async () => {
      const data = await handleExportData();
      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { detail: { data, moduleName: 'Review_GiayDep_V2' } }));
    };
    const onGlobalImport = (e: any) => processImportData(e.detail);
    window.addEventListener('REQUEST_EXPORT_DATA', onGlobalExport);
    window.addEventListener('REQUEST_IMPORT_DATA', onGlobalImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', onGlobalExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', onGlobalImport);
    };
  }, [state]);

  const handleProductFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const updatedFiles = [...state.productFiles, ...selectedFiles].slice(0, 3);
      const updatedUrls = updatedFiles.map(f => URL.createObjectURL(f));
      setState((prev: any) => ({ ...prev, productFiles: updatedFiles, productPreviewUrls: updatedUrls }));
    }
  };

  const removeProductFile = (idx: number) => {
    const updatedFiles = state.productFiles.filter((_: any, i: number) => i !== idx);
    const updatedPreviewUrls = state.productPreviewUrls.filter((_: any, i: number) => i !== idx);
    setState((prev: any) => ({ ...prev, productFiles: updatedFiles, productPreviewUrls: updatedPreviewUrls }));
  };

  const handleAnalyzeBackground = async () => {
    let part = null;
    if (state.backgroundFile) {
      part = await service.fileToGenerativePart(state.backgroundFile);
    } else if (state.backgroundPreviewUrl?.startsWith('data:')) {
      part = { mimeType: 'image/png', data: state.backgroundPreviewUrl.split(',')[1] };
    }

    if (!part && !state.scriptNote) {
      alert("Vui lòng tải ảnh bối cảnh hoặc nhập mô tả sơ bộ để phân tích.");
      return;
    }

    setState(p => ({ ...p, isAnalyzingBackground: true }));
    try {
      const analysis = await analyzeDetailedBackground(state.scriptNote || "", part);
      setState(p => ({ ...p, scriptNote: analysis, isAnalyzingBackground: false }));
    } catch (e) {
      console.error(e);
      setState(p => ({ ...p, isAnalyzingBackground: false }));
      alert("Lỗi khi phân tích bối cảnh.");
    }
  };

  const handleGenerate = async () => {
    if (state.productFiles.length === 0 && state.productPreviewUrls.length === 0) return alert("Vui lòng tải ảnh giày dép.");
    if (!state.productName) return alert("Vui lòng nhập tên sản phẩm.");

    setState((prev: any) => ({ ...prev, isGeneratingScript: true }));
    try {
      let imageParts = [];
      if (state.productFiles.length > 0) {
        imageParts = await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)));
      } else {
        imageParts = state.productPreviewUrls.map((url: string) => ({ mimeType: 'image/png', data: url.split(',')[1] }));
      }

      let layoutToUse = state.scriptLayout;
      if (!layoutToUse) layoutToUse = LAYOUT_OPTIONS[Math.floor(Math.random() * LAYOUT_OPTIONS.length)];

      const script = await service.generateNonFaceScript(
        imageParts, state.productName, state.keyword, layoutToUse, 
        state.gender, state.voice, state.addressing, state.sceneCount, state.targetAudience,
        language
      );
      setState((prev: any) => ({ ...prev, script, scriptLayout: layoutToUse, isGeneratingScript: false }));
    } catch (e) {
      setState((prev: any) => ({ ...prev, isGeneratingScript: false }));
    }
  };

  const handleRegenerateScriptPart = async (key: string) => {
    if (state.isGeneratingScript || state.isRegeneratingPart[key] || !state.script) return;
    setState((p: any) => ({ ...p, isRegeneratingPart: { ...p.isRegeneratingPart, [key]: true } }));
    try {
      let imageParts = [];
      if (state.productFiles.length > 0) {
        imageParts = await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)));
      } else {
        imageParts = state.productPreviewUrls.map((url: string) => ({ mimeType: 'image/png', data: url.split(',')[1] }));
      }
      const newPartContent = await service.regenerateNonFaceScriptPart(
        imageParts, state.productName, state.keyword, key, state.script[key], state.script, state.gender, state.voice, state.addressing, state.targetAudience,
        language
      );
      setState((p: any) => ({ ...p, script: { ...p.script, [key]: newPartContent }, isRegeneratingPart: { ...p.isRegeneratingPart, [key]: false } }));
    } catch (error) {
      setState((p: any) => ({ ...p, isRegeneratingPart: { ...p.isRegeneratingPart, [key]: false } }));
    }
  };

  const handleExtractFoot = async () => {
    if (!state.footPreviewUrl) return;
    setState((p: any) => ({ ...p, isExtractingFoot: true }));
    try {
      let part;
      if (state.footFile) {
        part = await service.fileToGenerativePart(state.footFile);
      } else {
        part = {
          mimeType: 'image/png',
          data: state.footPreviewUrl.split(',')[1]
        };
      }
      const newFootUrl = await service.extractFootImage(part);
      setState((p: any) => ({ ...p, footPreviewUrl: newFootUrl, footFile: null, isExtractingFoot: false }));
    } catch (error) {
      setState((p: any) => ({ ...p, isExtractingFoot: false }));
      alert("Lỗi khi tách chân từ ảnh.");
    }
  };

  const handleGenImageForKey = async (key: string) => {
    setState((prev: any) => ({ ...prev, images: { ...prev.images, [key]: { ...prev.images[key], loading: true } } }));
    try {
      // Helper to clean base64 data and get generic parts
      const getGenericPart = (url: string) => ({
        mimeType: 'image/png',
        data: url.includes('base64,') ? url.split('base64,')[1] : url
      });

      let productParts = state.productFiles.length > 0 
        ? await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)))
        : state.productPreviewUrls.map((url: string) => getGenericPart(url));

      const bgRefPart = state.backgroundFile ? await service.fileToGenerativePart(state.backgroundFile) : 
                       (state.backgroundPreviewUrl?.startsWith('data:') ? getGenericPart(state.backgroundPreviewUrl) : null);

      const footRefPart = state.footFile ? await service.fileToGenerativePart(state.footFile) : 
                       (state.footPreviewUrl?.startsWith('data:') ? getGenericPart(state.footPreviewUrl) : null);

      const poseLabel = FOOTWEAR_POSES.find(p => p.value === state.images[key]?.pose)?.label || "";

      const url = await service.generateFootwearImage(
        productParts, footRefPart, state.productName, state.script[key], state.images[key]?.customPrompt,
        state.imageStyle, state.displayMode, state.scriptNote, state.visualNote, bgRefPart, state.images[key]?.angle, poseLabel, state.footDescription,
        language
      );
      setState((prev: any) => ({ ...prev, images: { ...prev.images, [key]: { ...prev.images[key], url, loading: false } } }));
    } catch (e) {
      console.error("Failed to generate image:", e);
      setState((prev: any) => ({ ...prev, images: { ...prev.images, [key]: { ...prev.images[key], loading: false, error: 'Failed to call Gemini API' } } }));
    }
  };

  const handleGenerateImagePromptForKey = async (key: string) => {
    const poseLabel = FOOTWEAR_POSES.find(p => p.value === state.images[key]?.pose)?.label || "";

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

      const prompt = await service.generateNonFace2ImagePrompt(
        state.productName,
        state.script[key],
        state.imageStyle,
        state.displayMode,
        state.visualNote,
        productParts.filter(p => p !== null),
        state.images[key]?.customPrompt,
        poseLabel,
        language
      );

      setState((prev: any) => ({
        ...prev,
        imagePrompts: {
          ...prev.imagePrompts,
          [key]: { text: prompt, loading: false, visible: true }
        }
      }));
    } catch (error: any) {
      console.error("Error generating image prompt:", error);
      alert(error.message || "Lỗi tạo prompt ảnh.");
      setState((prev: any) => ({
        ...prev,
        imagePrompts: {
          ...prev.imagePrompts,
          [key]: { ...prev.imagePrompts[key], loading: false }
        }
      }));
    }
  };

  const handleGeneratePromptForKey = async (key: string) => {
    setState((prev: any) => ({ ...prev, videoPrompts: { ...prev.videoPrompts, [key]: { ...prev.videoPrompts[key], loading: true, visible: true } } }));
    try {
      let productImageData = state.productFiles[0] ? (await service.fileToGenerativePart(state.productFiles[0])).data : (state.productPreviewUrls[0]?.split(',')[1] || "");
      const prompt = await service.generateFootwearVeoPrompt(
        state.productName, state.script[key], state.gender, state.voice, state.displayMode, productImageData, state.images[key]?.url, state.imageStyle,
        language
      );
      setState((p:any) => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { text: prompt, loading: false, visible: true } } }));
    } catch (e) {
      setState((p:any) => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } }));
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

  const handleBulkAction = async (type: 'image' | 'prompt' | 'imagePrompt') => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    for (const key of keys) {
      if (type === 'image') await handleGenImageForKey(key);
      else if (type === 'prompt') await handleGeneratePromptForKey(key);
      else if (type === 'imagePrompt') await handleGenerateImagePromptForKey(key);
    }
  };

  const downloadAllImagePrompts = () => {
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const text = activeKeys.map(key => state.imagePrompts[key]?.text || "").filter(t => t.trim().length > 0).join('\n\n');
    if (!text) return alert("Chưa có prompt ảnh nào.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `image_prompts_nonface2_${state.productName || 'project'}.txt`;
    link.click();
  };

  const downloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') return alert("Thư viện ZIP chưa sẵn sàng.");
    const zip = new JSZip();
    let count = 0;
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    activeKeys.forEach((key, i) => {
      if (state.images[key]?.url) {
        const base64Data = state.images[key].url.split(',')[1];
        if (base64Data) { zip.file(`${String(i + 1).padStart(2, '0')}.png`, base64Data, { base64: true }); count++; }
      }
    });
    if (count === 0) return alert("Không có ảnh để tải.");
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `giay_dep_images_${state.productName || 'project'}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadAllPromptsTxt = () => {
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const text = activeKeys
      .map(key => state.videoPrompts[key]?.text || "")
      .filter(t => t.trim().length > 0)
      .map(t => t.replace(/\n/g, ' '))
      .join('\n');

    if (!text) return alert("Vui lòng tạo Video Prompt trước khi tải xuống.");

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts_giaydep_${state.productName || 'project'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasAnyMedia = state.script && (Object.values(state.images).some((img: any) => img.url) || Object.values(state.videoPrompts).some((pr: any) => pr.text));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">1. Ảnh giày/dép (Max 3)</label>
                <div onClick={() => productInputRef.current?.click()} className={`w-full aspect-[3/4] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 overflow-hidden relative group hover:border-orange-400 transition-all ${theme.colors.primaryBorder}/20`}>
                  {state.productPreviewUrls.length === 0 ? (
                    <div className="text-center opacity-40 group-hover:opacity-60">
                      <svg className={`w-10 h-10 mx-auto ${theme.colors.primaryText} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-black uppercase tracking-tighter">Tải ảnh SP</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-px w-full h-full relative">
                        <div className={`grid w-full h-full gap-0.5 ${state.productPreviewUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {state.productPreviewUrls.map((url: string, idx: number) => (
                             <div key={idx} className="relative w-full h-full group/img">
                                <img src={url} className="w-full h-full object-cover" />
                                <button 
                                  onClick={(e) => { e.stopPropagation(); removeProductFile(idx); }}
                                  className={`absolute top-1 right-1 ${theme.colors.primaryBg} text-white p-1 rounded-full opacity-0 group-hover/img:opacity-100 transition-all`}
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                             </div>
                          ))}
                        </div>
                        {state.productPreviewUrls.length < 3 && (
                           <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                              <span className="bg-white/90 text-slate-800 text-[8px] font-black px-2 py-1 rounded-full uppercase shadow-sm">Thêm ảnh</span>
                           </div>
                        )}
                    </div>
                  )}
                  <input type="file" multiple ref={productInputRef} onChange={handleProductFilesChange} className="hidden" accept="image/*" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">2. Bàn chân mẫu (Ref)</label>
                <div onClick={() => footInputRef.current?.click()} className={`w-full aspect-[3/4] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-slate-50 cursor-pointer hover:border-orange-400 transition-all group overflow-hidden relative shadow-sm ${theme.colors.primaryBorder}/20`}>
                    {state.footPreviewUrl ? (
                      <div className="w-full h-full relative group/foot">
                        <img src={state.footPreviewUrl} className={`w-full h-full object-cover ${state.isExtractingFoot ? 'blur-sm grayscale opacity-50' : ''}`} />
                        <button 
                          onClick={(e) => { e.stopPropagation(); setState((p:any)=>({...p, footFile: null, footPreviewUrl: null})); }} 
                          className={`absolute top-2 right-2 ${theme.colors.primaryBg} text-white p-1 rounded-full opacity-0 group-hover/foot:opacity-100 transition-all z-10`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        {state.isExtractingFoot && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px]">
                            <div className={`w-8 h-8 border-4 ${theme.colors.primaryBorder} border-t-transparent rounded-full animate-spin`}></div>
                            <span className={`mt-2 text-[9px] font-black ${theme.colors.primaryText} uppercase animate-pulse`}>Đang tách...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center opacity-40 group-hover:opacity-60">
                        <svg className={`w-8 h-8 mx-auto ${theme.colors.primaryText} mb-1`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                        <span className="text-[9px] font-black uppercase tracking-tighter">Tải mẫu chân</span>
                      </div>
                    )}
                  <input type="file" ref={footInputRef} onChange={(e) => { if (e.target.files?.[0]) { const f = e.target.files[0]; setState((p:any) => ({ ...p, footFile: f, footPreviewUrl: URL.createObjectURL(f) })); } }} className="hidden" accept="image/*" />
                </div>
                {state.footPreviewUrl && !state.isExtractingFoot && (
                  <button 
                    onClick={handleExtractFoot}
                    className={`w-full py-2.5 mt-2 text-[10px] text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2`}
                    style={{ backgroundColor: 'var(--primary-color)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.121 14.121L19 19m-7-7l7 7m-7-7l-2.879 2.879M12 12L9.121 9.121m0 0L5 5m4.121 4.121L5 19m4.121-9.879L19 5" /></svg>
                    Tách chân trần
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1 tracking-widest">Đặc điểm bàn chân & đôi chân</label>
              <textarea 
                value={state.footDescription} 
                onChange={e => setState((p:any) => ({ ...p, footDescription: e.target.value }))} 
                placeholder="VD: Da trắng, gót hồng, bắp chân thon, đi tất trắng..." 
                className={`w-full p-4 border border-slate-200 rounded-[1.5rem] text-xs h-24 resize-none font-bold bg-slate-50 ${theme.colors.inputFocus} transition-all outline-none`}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1 tracking-widest">Bối cảnh & Visual Note</label>
              <div className="grid grid-cols-2 gap-4">
                <div onClick={() => backgroundInputRef.current?.click()} className={`aspect-square border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center cursor-pointer bg-slate-50 overflow-hidden relative group hover:border-orange-400 transition-all ${theme.colors.primaryBorder}/20`}>
                  {state.backgroundPreviewUrl ? (
                    <>
                      <img src={state.backgroundPreviewUrl} className="h-full w-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setState((p:any) => ({ ...p, backgroundFile: null, backgroundPreviewUrl: null })); }} className={`absolute top-2 right-2 ${theme.colors.primaryBg} text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </>
                  ) : <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Tải bối cảnh</span>}
                  <input type="file" ref={backgroundInputRef} onChange={(e) => { if (e.target.files?.[0]) { const f = e.target.files[0]; setState((p:any) => ({ ...p, backgroundFile: f, backgroundPreviewUrl: URL.createObjectURL(f) })); } }} className="hidden" accept="image/*" />
                </div>
                <div className="flex flex-col gap-2 h-full">
                  <textarea value={state.scriptNote} onChange={e => setState((p:any) => ({ ...p, scriptNote: e.target.value }))} placeholder="Mô tả bối cảnh..." className={`w-full p-4 border border-slate-200 rounded-[2rem] text-xs flex-1 resize-none font-bold bg-slate-50 ${theme.colors.inputFocus} transition-all outline-none`} />
                  <button 
                    onClick={handleAnalyzeBackground}
                    disabled={state.isAnalyzingBackground || (!state.backgroundPreviewUrl && !state.scriptNote)}
                    className={`w-full py-2 text-white text-[10px] font-black rounded-xl shadow-md disabled:opacity-50 transition-all uppercase tracking-widest flex items-center justify-center gap-2`}
                    style={{ backgroundColor: 'var(--primary-color)' }}
                  >
                    {state.isAnalyzingBackground ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    )}
                    Phân tích bối cảnh chi tiết
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Tên sản phẩm</label>
                <input type="text" value={state.productName} onChange={e => setState((p:any) => ({ ...p, productName: e.target.value }))} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold ${theme.colors.inputFocus} outline-none`} placeholder="VD: Giày Sneaker cao cấp..." />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Tệp khách hàng mục tiêu</label>
                <input type="text" value={state.targetAudience} onChange={e => setState((p:any) => ({ ...p, targetAudience: e.target.value }))} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold ${theme.colors.inputFocus} outline-none`} placeholder="VD: Nam giới 25-40 tuổi..." />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">USP nổi bật (Keyword)</label>
              <textarea value={state.keyword} onChange={e => setState((p:any) => ({ ...p, keyword: e.target.value }))} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-20 text-sm font-bold ${theme.colors.inputFocus} outline-none`} placeholder="VD: Đế cao su non, da bò thật, chống thấm nước..." />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Giới tính Người mẫu</label>
                <select value={state.gender} onChange={e => setState((p:any) => ({ ...p, gender: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none">
                  <option value="Nữ">Nữ</option>
                  <option value="Nam">Nam</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Giọng vùng miền (VO)</label>
                <select value={state.voice} onChange={e => setState((p:any) => ({ ...p, voice: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none">
                  {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Phong cách ảnh</label>
                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                  <button 
                    onClick={() => setState((p: any) => ({ ...p, imageStyle: 'Realistic' }))} 
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${state.imageStyle === 'Realistic' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    style={state.imageStyle === 'Realistic' ? { backgroundColor: 'var(--primary-color)' } : {}}
                  >
                    Real
                  </button>
                  <button 
                    onClick={() => setState((p: any) => ({ ...p, imageStyle: '3D' }))} 
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${state.imageStyle === '3D' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    style={state.imageStyle === '3D' ? { backgroundColor: 'var(--primary-color)' } : {}}
                  >
                    3D
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Chế độ hiển thị</label>
                <select value={state.displayMode} onChange={e => setState((p:any) => ({ ...p, displayMode: e.target.value }))} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none">
                  <option value="on_foot">Đang đi sử dụng</option>
                  <option value="close_up_foot">Cận cảnh bàn chân (Close-up)</option>
                  <option value="beside_foot">Đặt cạnh người</option>
                  <option value="no_foot">Chỉ sản phẩm (Product only)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Bố cục kịch bản (Layout)</label>
              <select value={state.scriptLayout} onChange={e => setState((p:any) => ({ ...p, scriptLayout: e.target.value }))} className={`w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none ${theme.colors.inputFocus} transition-all`}>
                <option value="">-- Random Layout --</option>
                {LAYOUT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Xưng hô kịch bản</label>
                <input list="nf2-addr" value={state.addressing} onChange={e => setState((p:any) => ({ ...p, addressing: e.target.value }))} className={`w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none ${theme.colors.inputFocus}`} placeholder="VD: em - anh chị" />
                <datalist id="nf2-addr">{ADDRESSING_OPTIONS.map(o => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Thời lượng (Scenes)</label>
                <select value={state.sceneCount} onChange={e => setState((p:any) => ({ ...p, sceneCount: parseInt(e.target.value) }))} className={`w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none`}>
                  {SCENE_COUNT_OPTIONS.map(o => <option key={o.count} value={o.count}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <button 
              onClick={handleGenerate} 
              disabled={state.isGeneratingScript} 
              className={`w-full py-5 text-white font-black rounded-3xl uppercase shadow-xl transition-all tracking-[0.2em] flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50`}
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              {state.isGeneratingScript ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}
            </button>
          </div>
        </div>
      </div>

      {state.script && (
        <div className="space-y-10 pb-32 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
            {Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`).map((key, idx) => (
              <div key={key} className="space-y-4">
                <ScriptSection title={`Phần ${idx + 1}`} content={state.script[key]} color={theme.colors.primaryBorder} onChange={(v) => setState((p:any) => ({ ...p, script: { ...p.script, [key]: v } }))} onRegenerate={() => handleRegenerateScriptPart(key)} isRegenerating={state.isRegeneratingPart[key]} maxChars={180} />
                <ImageCard
                  label={`Cảnh ${idx + 1}`} imageData={state.images[key] || { url: '', loading: false }} videoPrompt={state.videoPrompts[key] || { text: '', loading: false, visible: false }}
                  imagePrompt={state.imagePrompts[key] || { text: '', loading: false, visible: false }}
                  onGenerateImagePrompt={() => handleGenerateImagePromptForKey(key)}
                  onGeneratePrompt={() => handleGeneratePromptForKey(key)} onRegenerate={() => handleGenImageForKey(key)} onTranslate={() => {}}
                  onDelete={() => setState((p:any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], url: '', loading: false } } }))}
                  poseOptions={FOOTWEAR_POSES} pose={state.images[key]?.pose || ''} onPoseChange={(val) => setState((p:any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], pose: val } } }))}
                  customPrompt={state.images[key]?.customPrompt || ''} onCustomPromptChange={(v) => setState((p:any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], customPrompt: v } } }))}
                  onUpload={(file) => handleUploadImageForKey(key, file)}
                />
              </div>
            ))}
          </div>

          {/* Action Footer Sync with KocReview style */}
          <div className="flex flex-col items-center gap-12 py-12 border-t border-slate-200 mt-12">
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button 
                onClick={() => handleBulkAction('image')} 
                className={`w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest`}
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Vẽ tất cả ảnh
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
              </button>
              <button 
                onClick={() => handleBulkAction('imagePrompt')} 
                className={`w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest`}
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Tạo tất cả Prompt ảnh
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
              <button 
                onClick={() => handleBulkAction('prompt')} 
                className={`w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest`}
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Tạo tất cả Prompt video
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
              </button>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
              <button
                onClick={downloadAllImagesZip}
                className={`w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm`}
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Tải Ảnh (ZIP)
              </button>
              <button
                onClick={downloadAllImagePrompts}
                className={`w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm`}
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Tải Prompt Ảnh (.txt)
              </button>
              <button
                onClick={downloadAllPromptsTxt}
                className={`w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm`}
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Tải Video Prompt (.txt)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NonFaceReviewModule2;
