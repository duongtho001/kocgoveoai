
import React, { useState, useEffect, useRef } from 'react';
import { ScriptParts } from '../types';
import { safeSaveToLocalStorage } from '../utils/storage';
import { LANGUAGE_CONSTRAINTS } from '../utils/languageUtils';
import * as service from '../services/reviewDoiThoaiService';
import { runBatch, getConcurrencySettings } from '../services/concurrencyService';
import { theme } from '../constants/colors';
import { analyzeDetailedBackground } from '../services/kocReviewService2';
import ScriptSection from '../components/ScriptSection';
import ImageCard, { KOC_POSES, CAMERA_ANGLES, CAMERA_SHOTS } from '../components/ImageCard';

declare var JSZip: any;

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
const ADDRESSING_OPTIONS = ["em - anh chị", "tui - mấy bà", "mình - mọi người", "con - cô chú", "con - ba mẹ", "cháu - ông bà", "tao - mày"];
const TONE_OPTIONS = ["Hào hứng", "Chân thành", "Kịch tính", "Hài hước", "Chuyên gia", "Nhẹ nhàng", "Thúc giục"];

const SCENE_COUNT_OPTIONS = Array.from({ length: 13 }, (_, i) => ({ count: i + 3, label: `${i + 3} cảnh - ${(i + 3) * 8}s` }));

const SPEAKER_OPTIONS = [
  { value: 'A', label: 'NHÂN VẬT A' },
  { value: 'B', label: 'NHÂN VẬT B' }
];

interface Props {
  language?: string;
}

const ReviewDoiThoaiModule: React.FC<Props> = ({ language = 'vi' }) => {
  const storageKey = "review_doithoai_v24_note_only";
  const [state, setState] = useState<any>({
    charA: { facePreview: null, outfitPreview: null, processedOutfit: null, isExtractingOutfit: false, gender: 'Nữ', voice: VOICE_OPTIONS[0], addressing: 'em - anh chị', description: '' },
    charB: { facePreview: null, outfitPreview: null, processedOutfit: null, isExtractingOutfit: false, gender: 'Nam', voice: VOICE_OPTIONS[1], addressing: 'anh - em', description: '' },
    productFiles: [], productPreviews: [], productName: '', keyword: '',
    backgroundFile: null, backgroundPreviewUrl: null, isAnalyzingBackground: false,
    sceneCount: 5, backgroundNote: '', imageStyle: 'Realistic', 
    userContent: '', scriptTone: 'Hào hứng',
    isGenerating: false, script: null, images: {}, videoPrompts: {}, sceneChars: {}
  });

  const productInput = useRef<HTMLInputElement>(null);
  const faceAInput = useRef<HTMLInputElement>(null);
  const faceBInput = useRef<HTMLInputElement>(null);
  const outfitAInput = useRef<HTMLInputElement>(null);
  const outfitBInput = useRef<HTMLInputElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const localJsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        // Đảm bảo sceneCount là number để tránh lỗi React child object
        const safeSceneCount = typeof p.sceneCount === 'object' ? (p.sceneCount.count || 5) : (p.sceneCount || 5);
        
        setState((prev: any) => ({ 
          ...prev, 
          ...p, 
          sceneCount: safeSceneCount,
          productFiles: [], 
          charA: { ...p.charA, isExtractingOutfit: false }, 
          charB: { ...p.charB, isExtractingOutfit: false }
        }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const { productFiles, isGenerating, ...rest } = state;
    safeSaveToLocalStorage(storageKey, rest);
  }, [state]);

  const handleExtractOutfit = async (char: 'A' | 'B') => {
    const charData = char === 'A' ? state.charA : state.charB;
    const outfitUrl = charData.outfitPreview;
    if (!outfitUrl) return;

    setState((p: any) => ({
      ...p,
      [char === 'A' ? 'charA' : 'charB']: { ...charData, isExtractingOutfit: true }
    }));

    try {
      const part = { mimeType: 'image/png', data: outfitUrl.split(',')[1] };
      const processedUrl = await service.extractOutfitImage(part);
      setState((p: any) => ({
        ...p,
        [char === 'A' ? 'charA' : 'charB']: { ...charData, processedOutfit: processedUrl, isExtractingOutfit: false }
      }));
    } catch (e) {
      setState((p: any) => ({
        ...p,
        [char === 'A' ? 'charA' : 'charB']: { ...charData, isExtractingOutfit: false }
      }));
      alert("Lỗi khi tách nền trang phục.");
    }
  };

  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setState(p => ({ ...p, backgroundFile: file, backgroundPreviewUrl: URL.createObjectURL(file) }));
    }
  };

  const removeBackgroundFile = () => {
    setState(p => ({ ...p, backgroundFile: null, backgroundPreviewUrl: null }));
  };

  const handlePasteImage = (e: React.ClipboardEvent, callback: (file: File) => void) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) callback(blob);
      }
    }
  };

  const handlePasteBackgroundImage = (e: React.ClipboardEvent) => {
    handlePasteImage(e, (file) => {
      setState(p => ({ ...p, backgroundFile: file, backgroundPreviewUrl: URL.createObjectURL(file) }));
    });
  };

  const handleAnalyzeBackground = async () => {
    if (!state.backgroundPreviewUrl && !state.backgroundNote) return alert("Vui lòng tải ảnh bối cảnh hoặc nhập mô tả bối cảnh trước.");
    
    setState(p => ({ ...p, isAnalyzingBackground: true }));
    try {
      let part = null;
      if (state.backgroundFile) {
        const p = await service.fileToGenerativePart(state.backgroundFile);
        part = { mimeType: p.mimeType, data: p.data };
      } else if (state.backgroundPreviewUrl?.startsWith('data:')) {
        part = { mimeType: 'image/png', data: state.backgroundPreviewUrl.split(',')[1] };
      }

      const analysis = await analyzeDetailedBackground(state.backgroundNote || "", part);
      if (analysis) {
        setState(p => ({ ...p, backgroundNote: analysis, isAnalyzingBackground: false }));
      }
    } catch (error) {
      console.error("Background analysis failed:", error);
      setState(p => ({ ...p, isAnalyzingBackground: false }));
      alert("Phân tích bối cảnh thất bại.");
    }
  };

  const toBase64 = async (url: string | null): Promise<string> => {
    if (!url || !url.startsWith('blob:')) return url || '';
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to convert blob to base64", e);
      return url;
    }
  };

  const processImportData = async (importedData: any) => {
    try {
      if (!Array.isArray(importedData) || importedData.length === 0) return;
      window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 10, complete: false } }));
      
      const first = importedData[0];
      const inputs = first.inputs || {};
      const settings = inputs.settings || {};

      const newState = {
        ...state,
        productName: inputs.productName || state.productName,
        keyword: inputs.keyword || state.keyword,
        userContent: inputs.userContent || state.userContent,
        backgroundNote: inputs.backgroundNote || state.backgroundNote,
        backgroundPreviewUrl: inputs.backgroundPreviewUrl || state.backgroundPreviewUrl,
        scriptTone: settings.scriptTone || state.scriptTone,
        sceneCount: importedData.length, // Luôn lấy độ dài mảng làm số cảnh
        imageStyle: settings.imageStyle || state.imageStyle,
        charA: { ...state.charA, ...inputs.charA },
        charB: { ...state.charB, ...inputs.charB },
        productPreviews: inputs.productPreviews || [],
        script: {}, images: {}, videoPrompts: {}, sceneChars: {}
      };

      for (let i = 0; i < importedData.length; i++) {
        const item = importedData[i];
        const key = `v${i + 1}`;
        const itemInputs = item.inputs || {};
        const itemSettings = itemInputs.settings || {};

        newState.script[key] = typeof item.script === 'string' ? { charA: item.script, charB: '' } : (item.script || { charA: '', charB: '' });
        newState.sceneChars[key] = itemInputs.sceneChar || (i % 2 === 0 ? 'A' : 'B');
        newState.images[key] = {
          url: item.outputImage || '',
          loading: false,
          pose: itemSettings.pose || '',
          customPrompt: itemSettings.customPrompt || itemInputs.segmentData?.characterIdea || ''
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
    } catch (e) { alert("Lỗi nạp dữ liệu!"); }
  };

  const constructExportData = async () => {
    const keys = state.script ? Object.keys(state.script) : [];
    
    const charAFaceBase64 = await toBase64(state.charA.facePreview);
    const charAOutfitBase64 = await toBase64(state.charA.outfitPreview);
    const charAProcessedOutfitBase64 = await toBase64(state.charA.processedOutfit);
    
    const charBFaceBase64 = await toBase64(state.charB.facePreview);
    const charBOutfitBase64 = await toBase64(state.charB.outfitPreview);
    const charBProcessedOutfitBase64 = await toBase64(state.charB.processedOutfit);
    
    const backgroundBase64 = await toBase64(state.backgroundPreviewUrl);
    const productPreviewsBase64 = await Promise.all((state.productPreviews || []).map((url: string) => toBase64(url)));

    return keys.map((key, index) => ({
      stt: index + 1,
      inputs: {
        productName: state.productName,
        keyword: state.keyword,
        userContent: state.userContent,
        backgroundNote: state.backgroundNote,
        backgroundPreviewUrl: backgroundBase64,
        charA: { 
          gender: state.charA.gender, 
          voice: state.charA.voice, 
          addressing: state.charA.addressing, 
          description: state.charA.description, 
          facePreview: charAFaceBase64, 
          processedOutfit: charAProcessedOutfitBase64, 
          outfitPreview: charAOutfitBase64 
        },
        charB: { 
          gender: state.charB.gender, 
          voice: state.charB.voice, 
          addressing: state.charB.addressing, 
          description: state.charB.description, 
          facePreview: charBFaceBase64, 
          processedOutfit: charBProcessedOutfitBase64, 
          outfitPreview: charBOutfitBase64 
        },
        productPreviews: productPreviewsBase64,
        sceneChar: state.sceneChars[key],
        settings: {
          imageStyle: state.imageStyle,
          scriptTone: state.scriptTone,
          pose: state.images[key]?.pose || '',
          customPrompt: state.images[key]?.customPrompt || ''
        }
      },
      script: state.script[key],
      outputImage: state.images[key]?.url || '',
      videoPrompt: state.videoPrompts[key]?.text || ''
    }));
  };

  const handleLocalExportJson = async () => {
    const exportData = await constructExportData();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Review_DoiThoai_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleGlobalExport = async () => {
      const data = await constructExportData();
      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { detail: { data, moduleName: 'Review_Doi_Thoai' } }));
    };
    const handleGlobalImport = (e: any) => processImportData(e.detail);
    window.addEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    };
  }, [state]);

  const handleGenerateScript = async () => {
    if (!state.productName) return alert("Thiếu tên sản phẩm");
    setState(p => ({ ...p, isGenerating: true }));
    try {
      const pParts = state.productFiles.length > 0 
        ? await Promise.all(state.productFiles.map(f => service.fileToGenerativePart(f)))
        : (state.productPreviews || []).map((url: string) => ({ mimeType: 'image/png', data: url.split(',')[1] }));
      const script = await service.generateDoiThoaiScript(pParts, state.productName, state.keyword, state.sceneCount, state.charA, state.charB, state.userContent, state.backgroundNote, language);
      const sceneChars: any = {};
      const initialImages: any = {};
      const initialPrompts: any = {};
      Object.keys(script).forEach((k, i) => {
          const defaultChar = (i % 2 === 0) ? 'A' : 'B';
          sceneChars[k] = defaultChar;
          initialImages[k] = { url: '', loading: false, pose: '', format: '', customPrompt: '' };
          initialPrompts[k] = { text: '', loading: false, visible: false };
      });
      setState(p => ({ ...p, script, sceneChars, images: initialImages, videoPrompts: initialPrompts, isGenerating: false }));
    } catch (e) { setState(p => ({ ...p, isGenerating: false })); }
  };

  const handleGenerateImagePromptForKey = async (key: string) => {
    setState((p: any) => ({ ...p, imagePrompts: { ...p.imagePrompts, [key]: { ...(p.imagePrompts?.[key] || { text: '', loading: false, visible: false }), loading: true, visible: true } } }));
    try {
      const currentImg = state.images[key] || {};
      const text = await service.generateDoiThoaiImagePrompt(
        state.productName, state.script[key]?.charA || '', state.script[key]?.charB || '', state.imageStyle, state.sceneChars[key],
        state.charA.gender, state.charB.gender, currentImg.pose || '', '',
        '', currentImg.customPrompt || '', state.backgroundNote, currentImg.format || '', language
      );
      setState((p: any) => ({ ...p, imagePrompts: { ...p.imagePrompts, [key]: { text, loading: false, visible: true } } }));
    } catch (e: any) {
      setState((p: any) => ({ ...p, imagePrompts: { ...p.imagePrompts, [key]: { text: e.message || 'Lỗi', loading: false, visible: true } } }));
    }
  };

  const handleGenImage = async (key: string) => {
    setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], loading: true } } }));
    try {
      const getB64Part = (url: string | null) => (url && url.startsWith('data:')) ? { mimeType: 'image/png', data: url.split(',')[1] } : null;
      
      const productParts = state.productFiles.length > 0 
        ? await Promise.all(state.productFiles.map((f: File) => service.fileToGenerativePart(f)))
        : (state.productPreviews || []).map((url: string) => getB64Part(url)).filter((p: any) => p !== null);

      const currentImg = state.images[key];
      const url = await service.generateDoiThoaiImage(
        productParts, 
        getB64Part(state.charA.facePreview), 
        getB64Part(state.charB.facePreview),
        getB64Part(state.charA.processedOutfit || state.charA.outfitPreview),
        getB64Part(state.charB.processedOutfit || state.charB.outfitPreview),
        state.productName, state.script[key]?.charA || '', state.script[key]?.charB || '', state.imageStyle, state.sceneChars[key],
        state.charA.gender, state.charB.gender, currentImg.pose || '', '',
        '', currentImg.customPrompt || '', getB64Part(state.backgroundPreviewUrl), state.backgroundNote, currentImg.format || '', language
      );
      setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...currentImg, url, loading: false } } }));
    } catch (e) { 
      setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], loading: false, error: 'Lỗi' } } })); 
    }
  };

  const handleGenVideoPrompt = async (key: string) => {
    setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: true, visible: true } } }));
    try {
      const speakerTag = state.sceneChars[key];
      const speakerLabel = speakerTag === 'B' ? 'Nhân vật B' : (speakerTag === 'A' ? 'Nhân vật A' : 'Cả hai nhân vật');
      const speakerDescription = speakerTag === 'B' ? state.charB.description : state.charA.description;
      const gender = speakerTag === 'B' ? state.charB.gender : state.charA.gender;
      const voice = speakerTag === 'B' ? state.charB.voice : state.charA.voice;
      const currentImg = state.images[key];
      const prompt = await service.generateDoiThoaiVeoPrompt(
        state.productName, state.script[key]?.charA || '', state.script[key]?.charB || '', speakerLabel, speakerDescription,
        gender, voice, state.imageStyle, state.scriptTone, 'Medium Shot',
        state.backgroundNote, currentImg.format || '', false, currentImg.url, state.productPreviews?.[0]?.split(',')[1], language
      );
      setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { text: prompt, loading: false, visible: true } } }));
    } catch (e) { setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } })); }
  };

  const handleBulkAction = async (type: 'image' | 'prompt') => {
    if (!state.script) return;
    const keys = Object.keys(state.script);
    const { imageConcurrency, videoPromptConcurrency } = getConcurrencySettings();
    const concurrency = type === 'image' ? imageConcurrency : videoPromptConcurrency;
    const handler = type === 'image' ? handleGenImage : handleGenVideoPrompt;
    await runBatch(
      keys.map(key => ({ key, fn: () => handler(key) })),
      concurrency
    );
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 py-8 ${theme.colors.textPrimary}`}>
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-10">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
           <h2 className={`text-2xl font-black ${theme.colors.textPrimary} uppercase tracking-tighter`}>Review Đối Thoại</h2>
           <span className={`bg-slate-100 ${theme.colors.primaryText} text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest`}>PRO 2.6 (Dialogue Lock)</span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Nhân vật A */}
          <div className={`space-y-4 ${theme.colors.secondaryBg} p-6 rounded-2xl border ${theme.colors.secondaryBorder}`}>
            <h3 className={`text-xs font-black ${theme.colors.primaryText} uppercase tracking-widest px-1`}>Nhân vật A</h3>
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => faceAInput.current?.click()} className={`aspect-square border-2 border-dashed ${theme.colors.secondaryBorder} rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group`}>
                {state.charA.facePreview ? (
                  <>
                    <img src={state.charA.facePreview} className="h-full object-cover w-full" />
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setState(p => ({ ...p, charA: { ...p.charA, facePreview: null } })); }} 
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </>
                ) : <span className="text-[9px] font-bold text-slate-400 uppercase">Mặt A</span>}
                <input type="file" ref={faceAInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charA: { ...p.charA, facePreview: ev.target?.result as string } })); r.readAsDataURL(f); } }} />
              </div>
              <div onClick={() => outfitAInput.current?.click()} className={`aspect-square border-2 border-dashed ${theme.colors.secondaryBorder} rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group`}>
                {state.charA.outfitPreview ? (
                  <>
                    <img src={state.charA.processedOutfit || state.charA.outfitPreview} className="h-full object-cover w-full" />
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setState(p => ({ ...p, charA: { ...p.charA, outfitPreview: null, processedOutfit: null } })); }} 
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </>
                ) : <span className="text-[9px] font-bold text-slate-400 uppercase">Đồ A</span>}
                <input type="file" ref={outfitAInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charA: { ...p.charA, outfitPreview: ev.target?.result as string, processedOutfit: null } })); r.readAsDataURL(f); } }} />
              </div>
            </div>
            {state.charA.outfitPreview && (
                <button 
                  onClick={() => handleExtractOutfit('A')} 
                  disabled={state.charA.isExtractingOutfit}
                  className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${state.charA.processedOutfit ? 'bg-green-100 text-green-700' : `${theme.colors.buttonPrimary} text-white`}`}
                >
                  {state.charA.isExtractingOutfit ? "Đang xử lý..." : state.charA.processedOutfit ? "Đã tách nền ✓" : "Tách nền Đồ A"}
                </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select value={state.charA.gender} onChange={e => setState(p => ({ ...p, charA: { ...p.charA, gender: e.target.value } }))} className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-xs`}><option value="Nữ">Nữ</option><option value="Nam">Nam</option></select>
              <select value={state.charA.voice} onChange={e => setState(p => ({ ...p, charA: { ...p.charA, voice: e.target.value } }))} className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-[10px]`}>{VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select>
            </div>
            <input list="doi-thoai-addr-a" value={state.charA.addressing} onChange={e => setState(p => ({ ...p, charA: { ...p.charA, addressing: e.target.value } }))} className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-xs`} placeholder="Xưng hô A" />
            <datalist id="doi-thoai-addr-a">{ADDRESSING_OPTIONS.map(o => <option key={o} value={o} />)}</datalist>
            <textarea value={state.charA.description} onChange={e => setState(p => ({ ...p, charA: { ...p.charA, description: e.target.value } }))} placeholder="Mô tả ngoại hình A" className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-xs resize-none h-16`} />
          </div>

          {/* Nhân vật B */}
          <div className={`space-y-4 ${theme.colors.secondaryBg} p-6 rounded-2xl border ${theme.colors.secondaryBorder}`}>
            <h3 className={`text-xs font-black ${theme.colors.primaryText} uppercase tracking-widest px-1`}>Nhân vật B</h3>
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => faceBInput.current?.click()} className={`aspect-square border-2 border-dashed ${theme.colors.secondaryBorder} rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group`}>
                {state.charB.facePreview ? (
                  <>
                    <img src={state.charB.facePreview} className="h-full object-cover w-full" />
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setState(p => ({ ...p, charB: { ...p.charB, facePreview: null } })); }} 
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </>
                ) : <span className="text-[9px] font-bold text-slate-400 uppercase">Mặt B</span>}
                <input type="file" ref={faceBInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charB: { ...p.charB, facePreview: ev.target?.result as string } })); r.readAsDataURL(f); } }} />
              </div>
              <div onClick={() => outfitBInput.current?.click()} className={`aspect-square border-2 border-dashed ${theme.colors.secondaryBorder} rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group`}>
                {state.charB.outfitPreview ? (
                  <>
                    <img src={state.charB.processedOutfit || state.charB.outfitPreview} className="h-full object-cover w-full" />
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setState(p => ({ ...p, charB: { ...p.charB, outfitPreview: null, processedOutfit: null } })); }} 
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </>
                ) : <span className="text-[9px] font-bold text-slate-400 uppercase">Đồ B</span>}
                <input type="file" ref={outfitBInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charB: { ...p.charB, outfitPreview: ev.target?.result as string, processedOutfit: null } })); r.readAsDataURL(f); } }} />
              </div>
            </div>
            {state.charB.outfitPreview && (
                <button 
                  onClick={() => handleExtractOutfit('B')} 
                  disabled={state.charB.isExtractingOutfit}
                  className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${state.charB.processedOutfit ? 'bg-green-100 text-green-700' : `${theme.colors.buttonAccent} text-white`}`}
                >
                  {state.charB.isExtractingOutfit ? "Đang xử lý..." : state.charB.processedOutfit ? "Đã tách nền ✓" : "Tách nền Đồ B"}
                </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select value={state.charB.gender} onChange={e => setState(p => ({ ...p, charB: { ...p.charB, gender: e.target.value } }))} className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-xs`}><option value="Nữ">Nữ</option><option value="Nam">Nam</option></select>
              <select value={state.charB.voice} onChange={e => setState(p => ({ ...p, charB: { ...p.charB, voice: e.target.value } }))} className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-[10px]`}>{VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select>
            </div>
            <input list="doi-thoai-addr-b" value={state.charB.addressing} onChange={e => setState(p => ({ ...p, charB: { ...p.charB, addressing: e.target.value } }))} className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-xs`} placeholder="Xưng hô B" />
            <datalist id="doi-thoai-addr-b">{ADDRESSING_OPTIONS.map(o => <option key={o} value={o} />)}</datalist>
            <textarea value={state.charB.description} onChange={e => setState(p => ({ ...p, charB: { ...p.charB, description: e.target.value } }))} placeholder="Mô tả ngoại hình B" className={`w-full p-3 bg-white border ${theme.colors.secondaryBorder} rounded-xl font-bold text-xs resize-none h-16`} />
          </div>

          {/* Cài đặt chung */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Nội dung & Sản phẩm</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Ảnh Sản Phẩm</label>
                <div onClick={() => productInput.current?.click()} className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer overflow-hidden relative group">
                  {state.productPreviews?.[0] ? (
                    <>
                      <img src={state.productPreviews[0]} className="h-full object-contain" />
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setState(p => ({ ...p, productFiles: [], productPreviews: [] })); }} 
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </>
                  ) : <span className="text-[9px] font-bold text-slate-400 uppercase">Ảnh SP</span>}
                  <input type="file" multiple ref={productInput} className="hidden" onChange={e => { if (!e.target.files) return; const files = Array.from(e.target.files as FileList); Promise.all(files.map((f: File) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = (ev) => resolve(ev.target?.result as string); r.readAsDataURL(f); }))).then(results => setState(p => ({ ...p, productFiles: files, productPreviews: results }))); }} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Background bối cảnh (Bắt buộc dùng cho ảnh)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => backgroundInput.current?.click()}
                  onPaste={handlePasteBackgroundImage}
                  tabIndex={0}
                  className="aspect-video border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden group relative focus:ring-2 focus:ring-slate-100 focus:outline-none"
                >
                  {state.backgroundPreviewUrl ? (
                    <>
                      <img src={state.backgroundPreviewUrl} className="h-full w-full object-cover" />
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeBackgroundFile(); }}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center block">Tải ảnh bối cảnh</span>
                    </div>
                  )}
                  <input type="file" ref={backgroundInput} className="hidden" onChange={handleBackgroundFileChange} />
                </div>
                <div className="relative h-full">
                  <textarea
                    value={state.backgroundNote}
                    onChange={e => setState(p => ({ ...p, backgroundNote: e.target.value }))}
                    placeholder="Mô tả bối cảnh chi tiết bằng chữ (VD: phòng khách sang trọng, ánh sáng ấm...)"
                    className={`w-full p-3 border border-slate-200 rounded-xl h-full text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none pr-12`}
                  />
                  <button
                    onClick={handleAnalyzeBackground}
                    disabled={state.isAnalyzingBackground || (!state.backgroundPreviewUrl && !state.backgroundNote)}
                    className={`absolute bottom-2 right-2 p-2 ${theme.colors.secondaryBg} ${theme.colors.primaryText} rounded-lg ${theme.colors.secondaryHover} transition-all shadow-sm group disabled:opacity-50`}
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
            <input type="text" value={state.productName} onChange={e => setState(p => ({ ...p, productName: e.target.value }))} placeholder="Tên sản phẩm..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" />
            <textarea value={state.userContent} onChange={e => setState(p => ({ ...p, userContent: e.target.value }))} placeholder="Ý tưởng kịch bản..." className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-24 text-xs font-bold focus:ring-2 ${theme.colors.secondaryBg} outline-none resize-none leading-relaxed`} />
            <div className="grid grid-cols-2 gap-3">
              <select value={state.imageStyle} onChange={e => setState(p => ({ ...p, imageStyle: e.target.value }))} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs text-indigo-600">
                <option value="Realistic">Chân thực (Realistic)</option>
                <option value="3D">Hoạt hình 3D</option>
              </select>
              <select value={state.scriptTone} onChange={e => setState(p => ({ ...p, scriptTone: e.target.value }))} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs">{TONE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
            </div>
            <select value={state.sceneCount} onChange={e => setState(p => ({ ...p, sceneCount: parseInt(e.target.value) }))} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-blue-600 text-xs">
              {SCENE_COUNT_OPTIONS.map(o => <option key={o.count} value={o.count}>{o.label}</option>)}
            </select>
            <button onClick={handleGenerateScript} disabled={state.isGenerating} className={`w-full py-4 ${theme.colors.buttonPrimary} font-black rounded-xl shadow-lg uppercase text-xs disabled:opacity-50`}>{state.isGenerating ? "Đang tạo..." : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}</button>
          </div>
        </div>
      </div>

      {state.script && (
        <div className="space-y-12 pb-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {Object.keys(state.script).map((key, idx) => {
              const charInShot = state.sceneChars[key] || 'A';
              const speakerTalking = charInShot;
              const imageData = state.images[key] || { url: '', loading: false, pose: '', customPrompt: '' };
              const promptData = state.videoPrompts[key] || { text: '', loading: false, visible: false };
              const maxChars = 90;

              return (
                <div key={key} className="space-y-4 animate-fadeIn">
                  <div className={`p-2 rounded-xl text-[9px] font-black uppercase text-center border-b-2 ${charInShot === 'A' ? `${theme.colors.secondaryBg} ${theme.colors.primaryText} ${theme.colors.secondaryBorder}` : charInShot === 'B' ? `${theme.colors.secondaryBg} ${theme.colors.primaryText} ${theme.colors.secondaryBorder}` : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    Nhân vật {charInShot} xuất hiện
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    {['A', 'B', 'Both'].map(c => (
                      <button 
                        key={c} 
                        onClick={() => setState((p: any) => ({ 
                          ...p, 
                          sceneChars: { ...p.sceneChars, [key]: c }
                        }))} 
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${charInShot === c ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {c === 'Both' ? 'Cả hai' : `Mẫu ${c}`}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <ScriptSection 
                      title={`Cảnh ${idx + 1} - Nhân vật A`} 
                      content={state.script[key]?.charA || ''} 
                      color={theme.colors.primaryBorder} 
                      onChange={v => setState((p: any) => ({ ...p, script: { ...p.script, [key]: { ...p.script[key], charA: v } } }))} 
                      minChars={0}
                      maxChars={maxChars}
                      heightClass="min-h-[90px]"
                    />
                    <ScriptSection 
                      title={`Cảnh ${idx + 1} - Nhân vật B`} 
                      content={state.script[key]?.charB || ''} 
                      color={theme.colors.secondaryBorder} 
                      onChange={v => setState((p: any) => ({ ...p, script: { ...p.script, [key]: { ...p.script[key], charB: v } } }))} 
                      minChars={0}
                      maxChars={maxChars}
                      heightClass="min-h-[90px]"
                    />
                  </div>
                    <ImageCard 
                      label={`Cảnh ${idx+1}`} 
                      imageData={imageData} 
                      videoPrompt={promptData} 
                      imagePrompt={state.imagePrompts?.[key] || { text: '', loading: false, visible: false }}
                      onRegenerate={() => handleGenImage(key)} 
                      onGeneratePrompt={() => handleGenVideoPrompt(key)} 
                      onGenerateImagePrompt={() => handleGenerateImagePromptForKey(key)}
                      onTranslate={() => {}} 
                      onDelete={() => setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], url: '', loading: false } } }))}
                      pose={imageData.pose} 
                      onPoseChange={(val) => setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], pose: val } } }))} 
                      format={imageData.format}
                      onFormatChange={(val) => setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], format: val } } }))}
                      onUpload={(file) => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setState((p: any) => ({
                          ...p,
                          images: {
                            ...p.images,
                            [key]: { ...p.images[key], url: ev.target?.result as string, loading: false }
                          }
                        }));
                      };
                      reader.readAsDataURL(file);
                    }}
                    customPrompt={imageData.customPrompt || ""} 
                    onCustomPromptChange={v => setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], customPrompt: v } } }))} 
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-12 py-12 border-t border-slate-200 mt-12">
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button 
                onClick={() => handleBulkAction('image')} 
                className="w-full md:w-auto px-6 py-3 bg-[#25496c] text-white font-black rounded-xl shadow-lg hover:opacity-90 transition-all text-xs flex items-center justify-center gap-3 uppercase tracking-tight"
              >
                VẼ TẤT CẢ ẢNH
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
              </button>
              <button 
                onClick={async () => { if (!state.script) return; const keys = Object.keys(state.script); const { imagePromptConcurrency } = getConcurrencySettings(); await runBatch(keys.map(key => ({ key, fn: () => handleGenerateImagePromptForKey(key) })), imagePromptConcurrency); }} 
                className="w-full md:w-auto px-6 py-3 bg-[#25496c] text-white font-black rounded-xl shadow-lg hover:opacity-90 transition-all text-xs flex items-center justify-center gap-3 uppercase tracking-tight"
              >
                TẠO TẤT CẢ PROMPT ẢNH
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
              <button 
                onClick={() => handleBulkAction('prompt')} 
                className="w-full md:w-auto px-6 py-3 bg-[#25496c] text-white font-black rounded-xl shadow-lg hover:opacity-90 transition-all text-xs flex items-center justify-center gap-3 uppercase tracking-tight"
              >
                TẠO TẤT CẢ PROMPT VIDEO
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
              </button>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                <button onClick={async () => { 
                    if (typeof JSZip === 'undefined') return alert("ZIP error"); 
                    const zip = new JSZip(); 
                    let count = 0; 
                    if (state.images) {
                      Object.keys(state.images).forEach((k, i) => { if (state.images[k].url) { zip.file(`${String(i + 1).padStart(2, '0')}.png`, state.images[k].url.split(',')[1], { base64: true }); count++; } }); 
                    }
                    if (count === 0) return alert("Không có ảnh"); 
                    const content = (await zip.generateAsync({ type: "blob" })) as any; 
                    const link = document.createElement('a'); 
                    link.href = URL.createObjectURL(content); 
                    link.download = `review_doithoai_images.zip`; 
                    link.click(); 
                }} className="w-full md:w-auto px-6 py-3 bg-[#25496c] text-white font-black rounded-xl shadow-lg hover:opacity-90 transition-all text-xs flex items-center justify-center gap-3 uppercase tracking-tight">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  TẢI ẢNH (ZIP)
                </button>
                <button onClick={() => { if (state.imagePrompts) { const text = Object.keys(state.imagePrompts).map(k => state.imagePrompts[k]?.text).filter(t => t).join('\n\n'); if (!text) return alert("Chưa có prompt ảnh nào."); const blob = new Blob([text], { type: 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'image_prompts_doithoai.txt'; link.click(); } }} className="w-full md:w-auto px-6 py-3 bg-[#25496c] text-white font-black rounded-xl shadow-lg hover:opacity-90 transition-all text-xs flex items-center justify-center gap-3 uppercase tracking-tight">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  TẢI PROMPT ẢNH (.TXT)
                </button>
                <button onClick={() => { if (state.videoPrompts) { const text = Object.keys(state.videoPrompts).map(k => state.videoPrompts[k].text).filter(t => t).join('\n'); if (!text) return alert("Chưa có prompt"); const blob = new Blob([text], { type: 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'prompts_doithoai.txt'; link.click(); } }} className="w-full md:w-auto px-6 py-3 bg-[#25496c] text-white font-black rounded-xl shadow-lg hover:opacity-90 transition-all text-xs flex items-center justify-center gap-3 uppercase tracking-tight">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  TẢI VIDEO PROMPT (.TXT)
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ); 
};

export default ReviewDoiThoaiModule;
