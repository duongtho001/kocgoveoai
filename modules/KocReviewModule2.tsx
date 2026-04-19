import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ScriptPartKey, ScriptParts } from '../types';
import { safeSaveToLocalStorage } from '../utils/storage';
import * as service from '../services/kocReviewService2';
import { runBatch, getConcurrencySettings, saveConcurrencySettings, ConcurrencySettings } from '../services/concurrencyService';
import * as flowApi from '../services/flowApiService';
import ScriptSection from '../components/ScriptSection';
import ImageCard, { KOC_POSES, CAMERA_ANGLES } from '../components/ImageCard';
import VideoGallery from '../components/VideoGallery';
import MultiProductBar, { ProductTab } from '../components/MultiProductBar';
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

// Flow API Voice options for video generation (R2V) — tên audioSpeaker chính thức
const FLOW_VOICE_OPTIONS = [
  { value: 'Achernar', label: '🎙️ Achernar', hasDemo: true },
  { value: 'Achird', label: '🎙️ Achird', hasDemo: true },
  { value: 'Algenib', label: '🎙️ Algenib', hasDemo: true },
  { value: 'Algieba', label: '🎙️ Algieba', hasDemo: true },
  { value: 'Alnilam', label: '🎙️ Alnilam', hasDemo: true },
  { value: 'Aoede', label: '🎙️ Aoede', hasDemo: true },
  { value: 'Autonoe', label: '🎙️ Autonoe', hasDemo: true },
  { value: 'Callirrhoe', label: '🎙️ Callirrhoe', hasDemo: true },
  { value: 'Charon', label: '🎙️ Charon', hasDemo: true },
  { value: 'Despina', label: '🎙️ Despina', hasDemo: true },
  { value: 'Enceladus', label: '🎙️ Enceladus', hasDemo: true },
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


// Helper: convert image URL (blob/http) → base64 dataUrl
const urlToBase64 = async (url: string): Promise<string> => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

interface KocReviewModule2Props {
  language?: string;
  loggedInUser?: string | null;
  userQuota?: any;
  onQuotaChange?: (quota: any) => void;
}

const KocReviewModule2: React.FC<KocReviewModule2Props> = ({ language = 'vi', loggedInUser, userQuota, onQuotaChange }) => {
  // ── Multi-Product Management ──
  const PRODUCTS_LIST_KEY = 'koc_multi_products_list';
  const GLOBAL_SETTINGS_KEY = 'koc_global_settings';
  
  const initProducts = (): ProductTab[] => {
    try {
      const saved = localStorage.getItem(PRODUCTS_LIST_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [{ id: 'default', name: 'SP 1', keyword: '', scriptTone: '', productSize: '', scriptNote: '', imageUrl: '', productPreviewUrls: [], status: 'draft' }];
  };
  
  const [products, setProducts] = useState<ProductTab[]>(initProducts);
  const [activeProductId, setActiveProductId] = useState<string>(() => {
    try { return localStorage.getItem('koc_active_product_id') || products[0]?.id || 'default'; } catch { return 'default'; }
  });
  
  const getStorageKeyForProduct = (productId: string) => `koc_project_product_${productId}`;
  const storageKey = getStorageKeyForProduct(activeProductId);
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
    imageQuality: 'fast', // 'fast' | '4k'
    flowVoice: 'Achernar', // Flow API voice for R2V — default to first voice
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
    customLayout: '',
    isGeneratingScript: false,
    isAnalyzingBackground: false,
    isRegeneratingPart: {},
    isFullWorkflowRunning: false,
    fullWorkflowStep: '',
    fullWorkflowProgress: 0,
    script: null,
    images: {},
    imagePrompts: {},
    videoPrompts: {}
  });
  
  // Concurrency settings state
  const [concurrencySettings, setConcurrencySettingsState] = useState<ConcurrencySettings>(getConcurrencySettings());
  const [showConcurrencyPanel, setShowConcurrencyPanel] = useState(false);
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
      // Migration: move old state to new product-specific key
      const OLD_KEY = 'koc_project_v23_clone_instance';
      const oldSaved = localStorage.getItem(OLD_KEY);
      if (oldSaved && !localStorage.getItem(getStorageKeyForProduct('default'))) {
        localStorage.setItem(getStorageKeyForProduct('default'), oldSaved);
        localStorage.removeItem(OLD_KEY);
        console.log('[KOC] Migrated old state → product default');
      }

      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const safeSceneCount = typeof parsed.sceneCount === 'object' ? (parsed.sceneCount.count || 5) : (parsed.sceneCount || 5);
          
          // Filter out stale blob: URLs that won't work after page reload
          const cleanPreviewUrls = (parsed.productPreviewUrls || []).filter(
            (url: string) => url && !url.startsWith('blob:') && url.startsWith('data:')
          );
          const cleanFaceUrl = (parsed.facePreviewUrl && parsed.facePreviewUrl.startsWith('data:')) ? parsed.facePreviewUrl : null;
          const cleanOutfitUrl = (parsed.outfitPreviewUrl && parsed.outfitPreviewUrl.startsWith('data:')) ? parsed.outfitPreviewUrl : null;
          const cleanBgUrl = (parsed.backgroundPreviewUrl && parsed.backgroundPreviewUrl.startsWith('data:')) ? parsed.backgroundPreviewUrl : null;
          
          setState((prev: any) => {
            // Clean up empty script: if script exists but all parts are empty, set to null
            let cleanScript = parsed.script;
            if (cleanScript && typeof cleanScript === 'object') {
              const hasContent = Object.values(cleanScript).some((v: any) => v && String(v).trim().length > 0);
              if (!hasContent) {
                cleanScript = null;
                console.log('[KOC] Cleared empty script state on restore');
              }
            }
            
            return {
              ...prev,
              ...parsed,
              sceneCount: safeSceneCount,
              script: cleanScript,
              productFiles: [],
              productPreviewUrls: cleanPreviewUrls,
              faceFile: null,
              facePreviewUrl: cleanFaceUrl,
              outfitFile: null,
              outfitPreviewUrl: cleanOutfitUrl,
              backgroundFile: null,
              backgroundPreviewUrl: cleanBgUrl,
              isGeneratingScript: false,
              isExtractingOutfit: false,
              isFullWorkflowRunning: false,
              isRegeneratingPart: {},
              imagePrompts: parsed.imagePrompts || {}
            };
          });
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

  // Save products list when it changes
  useEffect(() => {
    try { localStorage.setItem(PRODUCTS_LIST_KEY, JSON.stringify(products)); } catch {}
  }, [products]);
  
  useEffect(() => {
    try { localStorage.setItem('koc_active_product_id', activeProductId); } catch {}
  }, [activeProductId]);

  // ── Multi-product handlers ──
  const handleSwitchProduct = (newProductId: string) => {
    if (newProductId === activeProductId) return;
    // Save current state to current product key
    const { isGeneratingScript, isExtractingOutfit, isRegeneratingPart, productFiles, faceFile, outfitFile, backgroundFile, ...persistentData } = state;
    safeSaveToLocalStorage(getStorageKeyForProduct(activeProductId), persistentData);
    
    // Update product status in list
    setProducts(prev => prev.map(p => {
      if (p.id === activeProductId) {
        return { ...p, name: state.productName || p.name, keyword: state.keyword || p.keyword };
      }
      return p;
    }));
    
    setActiveProductId(newProductId);
    
    // Load new product state
    try {
      const saved = localStorage.getItem(getStorageKeyForProduct(newProductId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const safeSceneCount = typeof parsed.sceneCount === 'object' ? (parsed.sceneCount.count || 5) : (parsed.sceneCount || 5);
          const cleanPreviewUrls = (parsed.productPreviewUrls || []).filter(
            (url: string) => url && !url.startsWith('blob:') && url.startsWith('data:')
          );
          // Keep shared settings (face, voice, character) from current state
          setState((prev: any) => ({
            ...prev,
            ...parsed,
            sceneCount: safeSceneCount,
            productFiles: [],
            productPreviewUrls: cleanPreviewUrls,
            // KEEP global shared settings
            faceFile: prev.faceFile,
            facePreviewUrl: prev.facePreviewUrl,
            outfitFile: prev.outfitFile,
            outfitPreviewUrl: prev.outfitPreviewUrl,
            backgroundFile: prev.backgroundFile,
            backgroundPreviewUrl: prev.backgroundPreviewUrl,
            characterDescription: prev.characterDescription,
            gender: prev.gender,
            voice: prev.voice,
            addressing: prev.addressing,
            flowVoice: prev.flowVoice,
            imageStyle: prev.imageStyle,
            imageQuality: prev.imageQuality,
            // Reset loading states
            isGeneratingScript: false,
            isExtractingOutfit: false,
            isFullWorkflowRunning: false,
            isRegeneratingPart: {},
          }));
          return;
        }
      }
    } catch {}
    
    // New product — blank state but keep shared settings
    const newProduct = products.find(p => p.id === newProductId);
    setState((prev: any) => ({
      ...prev,
      productName: newProduct?.name || '',
      keyword: newProduct?.keyword || '',
      scriptTone: newProduct?.scriptTone || prev.scriptTone,
      productSize: newProduct?.productSize || '',
      scriptNote: newProduct?.scriptNote || '',
      productFiles: [],
      productPreviewUrls: [],
      script: null,
      images: {},
      imagePrompts: {},
      videoPrompts: {},
      isGeneratingScript: false,
      isFullWorkflowRunning: false,
    }));
  };

  const handleAddProduct = (partial: Partial<ProductTab>) => {
    const id = `product_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newProduct: ProductTab = {
      id,
      name: partial.name || `SP ${products.length + 1}`,
      keyword: partial.keyword || '',
      scriptTone: partial.scriptTone || '',
      productSize: partial.productSize || '',
      scriptNote: partial.scriptNote || '',
      imageUrl: partial.imageUrl || '',
      productPreviewUrls: partial.productPreviewUrls || [],
      status: 'draft',
    };
    setProducts(prev => [...prev, newProduct]);
    // Auto-switch to new product
    handleSwitchProduct(id);
  };

  const handleRemoveProduct = (id: string) => {
    if (products.length <= 1) {
      alert('Cần ít nhất 1 sản phẩm!');
      return;
    }
    if (!confirm('Xóa sản phẩm này?')) return;
    
    // If deleting the active product, switch to another one first
    if (id === activeProductId) {
      const remaining = products.filter(p => p.id !== id);
      if (remaining.length > 0) {
        // Save current state then switch
        const { isGeneratingScript, isExtractingOutfit, isRegeneratingPart, productFiles, faceFile, outfitFile, backgroundFile, ...persistentData } = state;
        safeSaveToLocalStorage(getStorageKeyForProduct(id), persistentData);
        setActiveProductId(remaining[0].id);
        
        // Load new product state
        try {
          const saved = localStorage.getItem(getStorageKeyForProduct(remaining[0].id));
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              const safeSceneCount = typeof parsed.sceneCount === 'object' ? (parsed.sceneCount.count || 5) : (parsed.sceneCount || 5);
              setState((prev: any) => ({
                ...prev,
                ...parsed,
                sceneCount: safeSceneCount,
                productFiles: [],
                faceFile: prev.faceFile,
                facePreviewUrl: prev.facePreviewUrl,
                outfitFile: prev.outfitFile,
                outfitPreviewUrl: prev.outfitPreviewUrl,
                characterDescription: prev.characterDescription,
                gender: prev.gender,
                voice: prev.voice,
                addressing: prev.addressing,
                flowVoice: prev.flowVoice,
                imageStyle: prev.imageStyle,
                imageQuality: prev.imageQuality,
                isGeneratingScript: false,
                isFullWorkflowRunning: false,
                isRegeneratingPart: {},
              }));
            }
          } else {
            // New blank product
            setState((prev: any) => ({
              ...prev,
              productName: remaining[0].name || '',
              keyword: remaining[0].keyword || '',
              productFiles: [],
              productPreviewUrls: [],
              script: null,
              images: {},
              imagePrompts: {},
              videoPrompts: {},
              isGeneratingScript: false,
              isFullWorkflowRunning: false,
            }));
          }
        } catch {}
      }
    }
    
    // Remove from list
    setProducts(prev => prev.filter(p => p.id !== id));
    try { localStorage.removeItem(getStorageKeyForProduct(id)); } catch {}
  };

  const handleImportCSV = (imported: Partial<ProductTab>[]) => {
    const newProducts: ProductTab[] = imported.map((p, i) => ({
      id: `csv_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: p.name || `SP Import ${i + 1}`,
      keyword: p.keyword || '',
      scriptTone: p.scriptTone || '',
      productSize: p.productSize || '',
      scriptNote: p.scriptNote || '',
      imageUrl: p.imageUrl || '',
      productPreviewUrls: [],
      status: 'draft' as const,
    }));
    setProducts(prev => [...prev, ...newProducts]);
    // Switch to first imported product
    if (newProducts.length > 0) {
      handleSwitchProduct(newProducts[0].id);
    }
  };

  const handleRenameProduct = (id: string, name: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    if (id === activeProductId) {
      setState((prev: any) => ({ ...prev, productName: name }));
    }
  };

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
    // Validate product images
    const hasFiles = state.productFiles?.length > 0;
    const hasPreviewUrls = state.productPreviewUrls?.filter(
      (url: string) => url && url.startsWith('data:') && url.includes(',') && url.length > 100
    ).length > 0;
    
    console.log(`[handleGenerate] productFiles: ${state.productFiles?.length || 0}, validPreviewUrls: ${
      state.productPreviewUrls?.filter((u: string) => u?.startsWith('data:') && u.length > 100).length || 0
    }/${state.productPreviewUrls?.length || 0}`);
    
    if (!hasFiles && !hasPreviewUrls) {
      alert("Vui lòng tải ảnh sản phẩm (ảnh có thể bị mất sau khi reload trang — hãy tải lại).");
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
      // Auto-sync concurrency settings to Flow API server (silent, non-blocking)
      try {
        if (flowApi.isFlowApiAvailable()) {
          const { imageConcurrency, videoConcurrency } = getConcurrencySettings();
          await flowApi.updateFlowServerConcurrency({
            default_image_concurrency: imageConcurrency,
            default_video_concurrency: videoConcurrency,
            public_image_concurrency: imageConcurrency,
            public_video_concurrency: videoConcurrency,
          });
          console.log(`[AutoSync] ✅ Server synced: image=${imageConcurrency}, video=${videoConcurrency}`);
        }
      } catch (syncErr) {
        console.warn('[AutoSync] Server sync failed (non-blocking):', syncErr);
      }

      let imageParts = [];
      if (hasFiles) {
        imageParts = await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)));
      } else {
        // Only use data: URLs, skip invalid/empty ones
        imageParts = state.productPreviewUrls
          .filter((url: string) => url && url.startsWith('data:') && url.includes(',') && url.length > 100)
          .map((url: string) => ({
            mimeType: url.match(/^data:(.*?);/)?.[1] || 'image/png',
            data: url.split(',')[1]
          }));
      }

      console.log(`[handleGenerate] imageParts count: ${imageParts.length}`);

      if (imageParts.length === 0) {
        alert('Ảnh sản phẩm không hợp lệ hoặc đã hết hạn. Vui lòng tải lại ảnh sản phẩm.');
        setState((prev: any) => ({ ...prev, isGeneratingScript: false }));
        return;
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
      
      // Validate script result
      if (!script || typeof script !== 'object' || Object.keys(script).length === 0) {
        throw new Error('Kịch bản trả về rỗng. Vui lòng thử lại.');
      }
      
      console.log(`[handleGenerate] ✅ Script keys: ${Object.keys(script).length}`);
      setState((prev: any) => ({ ...prev, script, scriptLayout: layoutToUse }));
    } catch (e: any) {
      console.error('Script generation error:', e);
      alert(`Lỗi tạo kịch bản: ${e?.message || 'Vui lòng thử lại'}`);
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

  const handleBulkImage = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const { imageConcurrency } = getConcurrencySettings();
    
    // Mark all images as loading
    setState((prev: any) => {
      const newImages = { ...prev.images };
      keys.forEach(k => { newImages[k] = { ...newImages[k], loading: true }; });
      return { ...prev, images: newImages };
    });

    try {
      // Step 1: Prepare shared reference parts (shared across all scenes)
      const getPart = async (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:')) return { mimeType: 'image/png', data: url.split(',')[1] };
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise<any>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ mimeType: blob.type, data: (reader.result as string).split(',')[1] });
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      };

      // Collect reference images ONCE
      const refDataUrls: string[] = [];
      
      // Product images
      const productParts = state.productFiles.length > 0
        ? await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)))
        : await Promise.all((state.productPreviewUrls || []).map((url: string) => getPart(url)));
      for (const part of productParts) {
        if (part?.data) refDataUrls.push(`data:${part.mimeType || 'image/png'};base64,${part.data}`);
      }
      
      // Face image
      const facePart = await getPart(state.facePreviewUrl);
      const imageFormat = state.images?.v1?.format || '';
      if (imageFormat !== 'no_character' && imageFormat !== 'hands_only' && imageFormat !== 'legs_only') {
        if (facePart?.data) refDataUrls.push(`data:${facePart.mimeType || 'image/png'};base64,${facePart.data}`);
      }
      
      // Outfit image
      const outfitPart = await getPart(state.processedOutfitUrl || state.outfitPreviewUrl);
      if (imageFormat !== 'no_character' && outfitPart?.data) {
        refDataUrls.push(`data:${outfitPart.mimeType || 'image/png'};base64,${outfitPart.data}`);
      }
      
      // Background
      const bgPart = await getPart(state.backgroundPreviewUrl);
      if (bgPart?.data) refDataUrls.push(`data:${bgPart.mimeType || 'image/png'};base64,${bgPart.data}`);

      console.log(`[BulkImage] Refs collected: ${refDataUrls.length}`);

      // Step 2: Generate all image prompts via Gemini AI (parallel)
      const promptResults = await Promise.allSettled(
        keys.map(async (key) => {
          const poseLabel = KOC_POSES.find(p => p.value === state.images[key]?.pose)?.label || '';
          const keyFormat = state.images[key]?.format || '';
          
          // Use existing image prompt if available, else generate new
          if (state.imagePrompts[key]?.text && state.imagePrompts[key].text.length > 20) {
            return { key, prompt: state.imagePrompts[key].text };
          }
          
          const prompt = service.constructKocImagePrompt(
            state.productName,
            state.script[key],
            state.characterDescription,
            state.images[key]?.customPrompt,
            state.gender,
            state.imageStyle,
            state.scriptNote,
            state.visualNote,
            poseLabel,
            keyFormat,
            !!facePart,
            !!outfitPart,
            !!bgPart,
            language
          );
          return { key, prompt };
        })
      );

      const batchItems: { key: string; prompt: string }[] = [];
      for (const r of promptResults) {
        if (r.status === 'fulfilled' && r.value) {
          batchItems.push(r.value);
        }
      }

      if (batchItems.length === 0) {
        throw new Error('Không tạo được prompt cho scene nào');
      }

      console.log(`[BulkImage] Generated ${batchItems.length} prompts, sending batch R2I/T2I...`);

      // Step 3: Send ALL prompts in 1 request with max_concurrency
      const results = await service.generateKocImageBatch(
        batchItems,
        refDataUrls,
        imageConcurrency,
        state.imageQuality || 'normal',
        undefined,
        // Callback: hiển thị ảnh ngay khi mỗi cảnh hoàn thành
        (key, url) => {
          setState((prev: any) => ({
            ...prev,
            images: {
              ...prev.images,
              [key]: { ...prev.images[key], url: url || '', loading: false, error: url ? undefined : 'No image returned' }
            }
          }));
          if (url) console.log(`[BulkImage] 🖼️ ${key} displayed`);
        }
      );

      // Safety net: clear any remaining loading states
      setState((prev: any) => {
        const newImages = { ...prev.images };
        keys.forEach(k => {
          if (newImages[k]?.loading) newImages[k] = { ...newImages[k], loading: false };
        });
        return { ...prev, images: newImages };
      });

      console.log(`[BulkImage] ✅ Batch complete: ${results.filter(r => r.url).length}/${batchItems.length} images`);

    } catch (e: any) {
      console.error('[BulkImage] Batch failed:', e);
      alert(`Lỗi tạo ảnh batch: ${e.message}`);
      // Reset loading states
      setState((prev: any) => {
        const newImages = { ...prev.images };
        keys.forEach(k => { newImages[k] = { ...newImages[k], loading: false }; });
        return { ...prev, images: newImages };
      });
    }
  };

  // ═══════════ Generate Video for single key (Flow API) ═══════════
  const handleGenerateVideoForKey = async (key: string) => {
    if (!state.images[key]?.url || !state.videoPrompts[key]?.text) return;
    setState((prev: any) => ({
      ...prev,
      images: { ...prev.images, [key]: { ...prev.images[key], videoLoading: true } }
    }));
    try {
      // Convert generated scene image → base64 for R2V reference
      const imgBase64 = await urlToBase64(state.images[key].url);
      if (!imgBase64) throw new Error('Cannot convert image to base64');
      
      const result = await flowApi.generateVideoFromImage(
        imgBase64,
        state.videoPrompts[key].text,
        { aspect_ratio: '9:16', voice: state.flowVoice || undefined },
        (job) => console.log(`[Video ${key}] ${job.status} ${job.progress}%`)
      );
      setState((prev: any) => ({
        ...prev,
        images: { ...prev.images, [key]: { ...prev.images[key], videoUrl: result.videoUrl, videoJobId: result.jobId, videoLoading: false } }
      }));
    } catch (e) {
      console.error(`Video gen failed for ${key}:`, e);
      setState((prev: any) => ({
        ...prev,
        images: { ...prev.images, [key]: { ...prev.images[key], videoLoading: false } }
      }));
    }
  };

  // ═══════════ Bulk Video Generation ═══════════
  const handleBulkVideo = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`)
      .filter(key => state.images[key]?.url && state.videoPrompts[key]?.text);
    if (keys.length === 0) {
      alert('Cần có ảnh và video prompt trước khi tạo video.');
      return;
    }
    const { videoConcurrency } = getConcurrencySettings();
    await runBatch(
      keys.map(key => ({ key, fn: () => handleGenerateVideoForKey(key) })),
      videoConcurrency
    );
  };

  // ═══════════ Merge Selected Videos ═══════════
  const handleMergeAllVideos = async (selectedKeys?: string[]) => {
    const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    // Use selected keys or auto-detect all available videos
    const videoKeys = (selectedKeys || activeKeys).filter(k => state.images?.[k]?.videoUrl);
    
    if (videoKeys.length < 2) {
      alert('Cần ít nhất 2 video để nối. Hãy tạo video trước.');
      return;
    }

    setState((p: any) => ({ ...p, isMergingVideos: true, mergeStep: 'Đang lấy đường dẫn video...' }));

    try {
      // Get video paths from server using job_ids
      const videoPaths: string[] = [];
      const failedKeys: string[] = [];
      
      for (let i = 0; i < videoKeys.length; i++) {
        const key = videoKeys[i];
        const jobId = state.images[key].videoJobId;
        setState((p: any) => ({ ...p, mergeStep: `Đang lấy path video ${key} (${i + 1}/${videoKeys.length})...` }));
        
        if (jobId) {
          // Try getting path from job first
          const path = await flowApi.getVideoPathFromJob(jobId);
          if (path) {
            videoPaths.push(path);
            console.log(`[MergeVideos] ${key}: got path from job ${jobId}`);
            continue;
          }
        }
        
        // Fallback: try videoUrlToPath if no jobId or job not found
        try {
          const videoUrl = state.images[key].videoUrl;
          if (videoUrl) {
            const path = await flowApi.videoUrlToPath(videoUrl);
            if (path) {
              videoPaths.push(path);
              console.log(`[MergeVideos] ${key}: got path via URL upload`);
              continue;
            }
          }
        } catch (e) {
          console.warn(`[MergeVideos] ${key}: URL upload also failed`);
        }
        
        failedKeys.push(key);
        console.warn(`[MergeVideos] ${key}: no video path available`);
      }

      if (failedKeys.length > 0) {
        console.warn(`[MergeVideos] Skipped ${failedKeys.length} video(s): ${failedKeys.join(', ')}`);
      }

      if (videoPaths.length < 2) {
        throw new Error(`Chỉ lấy được ${videoPaths.length} video path. Cần ít nhất 2. Bỏ qua: ${failedKeys.join(', ')}`);
      }

      setState((p: any) => ({ ...p, mergeStep: `Đang nối ${videoPaths.length} video...` }));
      
      const result = await flowApi.mergeVideos(
        videoPaths,
        `merged_${state.productName || 'koc'}_${Date.now()}`
      );

      if (result.videoUrl) {
        setState((p: any) => ({ 
          ...p, 
          mergedVideoUrl: result.videoUrl,
          isMergingVideos: false, 
          mergeStep: '' 
        }));
        alert(`✅ Đã nối ${videoPaths.length} video thành công!`);
      } else {
        // Try getting merged video URL from response
        const mergedPath = (result as any).merged_path || (result as any).mergedPath;
        if (mergedPath) {
          const API = import.meta.env.VITE_FLOW_API_URL || '';
          const videoUrl = `${API}/api/storage/video?path=${encodeURIComponent(mergedPath)}`;
          setState((p: any) => ({ 
            ...p, 
            mergedVideoUrl: videoUrl,
            isMergingVideos: false, 
            mergeStep: '' 
          }));
          alert(`✅ Đã nối ${videoPaths.length} video thành công!`);
        } else {
          throw new Error('Không nhận được video đã merge');
        }
      }
    } catch (e: any) {
      console.error('[MergeVideos] Failed:', e);
      alert(`Lỗi nối video: ${e.message}`);
      setState((p: any) => ({ ...p, isMergingVideos: false, mergeStep: '' }));
    }
  };

  // ═══════════ FULL WORKFLOW: Script → Image → Video Prompt → Video ═══════════
  const handleFullWorkflow = async () => {
    if (state.isFullWorkflowRunning) return;
    if (state.productFiles.length === 0 && state.productPreviewUrls.length === 0) {
      alert('Vui lòng tải ảnh sản phẩm.');
      return;
    }
    if (!state.productName) {
      alert('Vui lòng nhập tên sản phẩm.');
      return;
    }

    setState((p: any) => ({ ...p, isFullWorkflowRunning: true, fullWorkflowStep: 'Đang tạo kịch bản...', fullWorkflowProgress: 5 }));

    try {
      const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
      const initialImages: any = {};
      const initialPrompts: any = {};
      const initialImagePrompts: any = {};
      activeKeys.forEach(k => {
        initialImages[k] = { url: '', loading: false, customPrompt: '', pose: '', format: '' };
        initialPrompts[k] = { text: '', loading: false, visible: false };
        initialImagePrompts[k] = { text: '', loading: false, visible: false };
      });

      setState((p: any) => ({ ...p, script: null, images: initialImages, imagePrompts: initialImagePrompts, videoPrompts: initialPrompts }));

      // Auto-sync concurrency settings to Flow API server
      try {
        if (flowApi.isFlowApiAvailable()) {
          const { imageConcurrency, videoConcurrency } = getConcurrencySettings();
          await flowApi.updateFlowServerConcurrency({
            default_image_concurrency: imageConcurrency,
            default_video_concurrency: videoConcurrency,
            public_image_concurrency: imageConcurrency,
            public_video_concurrency: videoConcurrency,
          });
          console.log(`[FullPipeline AutoSync] ✅ Server synced: image=${imageConcurrency}, video=${videoConcurrency}`);
        }
      } catch (syncErr) {
        console.warn('[FullPipeline AutoSync] Server sync failed (non-blocking):', syncErr);
      }

      // ══════════════════════════════════════════════════════
      // STEP 1: Tạo Kịch Bản (Script)
      // ══════════════════════════════════════════════════════
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
        imageParts, state.productName, state.keyword, state.scriptTone, state.productSize, state.scriptNote,
        layoutToUse, state.gender, state.voice, state.addressing, state.sceneCount, state.targetAudience, language
      );
      setState((p: any) => ({ ...p, script, scriptLayout: layoutToUse, fullWorkflowStep: 'Đang tạo Prompt Ảnh...', fullWorkflowProgress: 15 }));
      console.log('[FullPipeline] ✅ Step 1: Script done');

      // ══════════════════════════════════════════════════════
      // STEP 2: Tạo tất cả Prompt Ảnh (Gemini AI)
      // ══════════════════════════════════════════════════════
      const getPart = async (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:')) return { mimeType: 'image/png', data: url.split(',')[1] };
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise<any>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ mimeType: blob.type, data: (reader.result as string).split(',')[1] });
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      };

      const facePart = await getPart(state.facePreviewUrl);
      const outfitPart = await getPart(state.processedOutfitUrl || state.outfitPreviewUrl);
      const bgPart = await getPart(state.backgroundPreviewUrl);

      // Collect reference data URLs once
      const refDataUrls: string[] = [];
      const productParts = state.productFiles.length > 0
        ? await Promise.all(state.productFiles.map((file: File) => service.fileToGenerativePart(file)))
        : (state.productPreviewUrls || []).map((url: string) => ({ mimeType: 'image/png', data: url.split(',')[1] }));
      for (const part of productParts) {
        if (part?.data) refDataUrls.push(`data:${part.mimeType || 'image/png'};base64,${part.data}`);
      }
      const imageFormat = state.images?.v1?.format || '';
      if (imageFormat !== 'no_character' && imageFormat !== 'hands_only' && imageFormat !== 'legs_only') {
        if (facePart?.data) refDataUrls.push(`data:${facePart.mimeType || 'image/png'};base64,${facePart.data}`);
      }
      if (imageFormat !== 'no_character' && outfitPart?.data) {
        refDataUrls.push(`data:${outfitPart.mimeType || 'image/png'};base64,${outfitPart.data}`);
      }
      if (bgPart?.data) refDataUrls.push(`data:${bgPart.mimeType || 'image/png'};base64,${bgPart.data}`);

      // Generate image prompts using constructKocImagePrompt (synchronous, fast)
      const batchItems: { key: string; prompt: string }[] = [];
      for (const key of activeKeys) {
        const poseLabel = KOC_POSES.find(p => p.value === state.images[key]?.pose)?.label || '';
        const keyFormat = state.images[key]?.format || '';
        
        const prompt = service.constructKocImagePrompt(
          state.productName,
          script[key],
          state.characterDescription,
          state.images[key]?.customPrompt,
          state.gender,
          state.imageStyle,
          state.scriptNote,
          state.visualNote,
          poseLabel,
          keyFormat,
          !!facePart,
          !!outfitPart,
          !!bgPart,
          language
        );
        batchItems.push({ key, prompt });

        // Save prompt to state for display
        setState((p: any) => ({
          ...p,
          imagePrompts: {
            ...p.imagePrompts,
            [key]: { text: prompt, loading: false, visible: true }
          }
        }));
      }

      setState((p: any) => ({ ...p, fullWorkflowStep: 'Đang vẽ ảnh AI (batch)...', fullWorkflowProgress: 30 }));
      console.log(`[FullPipeline] ✅ Step 2: ${batchItems.length} Image Prompts done`);

      // ══════════════════════════════════════════════════════
      // STEP 3: Tạo tất cả Ảnh (Flow API Batch R2I/T2I)
      // ══════════════════════════════════════════════════════
      const { imageConcurrency } = getConcurrencySettings();
      
      // Mark all as loading
      setState((prev: any) => {
        const newImages = { ...prev.images };
        activeKeys.forEach(k => { newImages[k] = { ...newImages[k], loading: true }; });
        return { ...prev, images: newImages };
      });

      const imageResults = await service.generateKocImageBatch(
        batchItems,
        refDataUrls,
        imageConcurrency,
        state.imageQuality || 'normal',
        undefined,
        // Callback: hiển thị ảnh ngay khi mỗi cảnh hoàn thành
        (key, url) => {
          setState((prev: any) => ({
            ...prev,
            images: {
              ...prev.images,
              [key]: { ...prev.images[key], url: url || '', loading: false }
            }
          }));
          if (url) {
            console.log(`[FullPipeline] Step 3: 🖼️ ${key} displayed`);
          }
        }
      );

      // Ensure all loading states are cleared (safety net)
      setState((prev: any) => {
        const newImages = { ...prev.images };
        activeKeys.forEach(k => {
          if (newImages[k]?.loading) newImages[k] = { ...newImages[k], loading: false };
        });
        return { ...prev, images: newImages };
      });

      setState((p: any) => ({ ...p, fullWorkflowStep: 'Đang tạo Video Prompt...', fullWorkflowProgress: 55 }));
      console.log(`[FullPipeline] ✅ Step 3: ${imageResults.filter(r => r.url).length}/${batchItems.length} Images done`);

      // ══════════════════════════════════════════════════════
      // STEP 4: Tạo tất cả Video Prompt (Gemini AI)
      // ══════════════════════════════════════════════════════
      const { videoPromptConcurrency } = getConcurrencySettings();

      const genVideoPrompt = async (key: string) => {
        setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: true, visible: true } } }));
        try {
          let productImageData = '';
          if (state.productFiles.length > 0) {
            const p2 = await service.fileToGenerativePart(state.productFiles[0]);
            productImageData = p2.data;
          } else if (state.productPreviewUrls.length > 0) {
            productImageData = state.productPreviewUrls[0].split(',')[1];
          }
          // Read the latest image URL from current state
          const latestState = await new Promise<any>(resolve => {
            setState((prev: any) => { resolve(prev); return prev; });
          });
          const imageUrl = latestState.images[key]?.url || '';
          if (!imageUrl) {
            setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } }));
            return;
          }
          // Convert image URL to base64 for Gemini AI (Flow API returns blob/http URLs, not base64)
          const imageBase64 = await urlToBase64(imageUrl);
          if (!imageBase64) {
            console.warn(`[FullPipeline] ⚠️ Cannot convert image to base64 for ${key}, skipping video prompt`);
            setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } }));
            return;
          }
          const prompt = await service.generateKocVeoPrompt(
            state.productName, script[key], state.gender, state.flowVoice,
            productImageData, imageBase64, false, state.imageStyle, '', language
          );
          setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { text: prompt, loading: false, visible: true } } }));
        } catch (e) {
          console.error(`[FullPipeline] Video prompt failed for ${key}:`, e);
          setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } }));
        }
      };

      await runBatch(
        activeKeys.map(key => ({ key, fn: () => genVideoPrompt(key) })),
        videoPromptConcurrency
      );
      setState((p: any) => ({ ...p, fullWorkflowStep: 'Đang tạo Video AI...', fullWorkflowProgress: 75 }));
      console.log('[FullPipeline] ✅ Step 4: Video Prompts done');

      // ══════════════════════════════════════════════════════
      // STEP 5: Tạo tất cả Video (Flow API — worker pool theo profiles)
      // ══════════════════════════════════════════════════════
      if (flowApi.isFlowApiAvailable()) {
        // Web controls total parallel video jobs; server distributes round-robin
        const { videoConcurrency } = getConcurrencySettings();
        const numVideoWorkers = Math.max(1, videoConcurrency);
        console.log(`[FullPipeline] Step 5: ${numVideoWorkers} video workers (web setting)`);

        // Get latest state to filter keys with images + prompts
        const latestStateForFilter = await new Promise<any>(resolve => {
          setState((prev: any) => { resolve(prev); return prev; });
        });
        const videoKeys = activeKeys.filter(key => {
          return latestStateForFilter.images[key]?.url && latestStateForFilter.videoPrompts[key]?.text;
        });

        const concurrency = Math.min(numVideoWorkers, videoKeys.length);
        let nextVideoIdx = 0;

        const videoWorker = async (workerIdx: number) => {
          // Stagger: worker 2 waits 3s to let server queue settle
          if (workerIdx > 0) {
            const staggerDelay = workerIdx * 3000;
            console.log(`[FullPipeline] Step 5: Worker ${workerIdx + 1} waiting ${staggerDelay/1000}s stagger...`);
            await new Promise(r => setTimeout(r, staggerDelay));
          }

          while (nextVideoIdx < videoKeys.length) {
            const idx = nextVideoIdx++;
            if (idx >= videoKeys.length) break;
            const key = videoKeys[idx];
            
            const latestState2 = await new Promise<any>(resolve => {
              setState((prev: any) => { resolve(prev); return prev; });
            });
            const imgUrl = latestState2.images[key]?.url;
            const vPrompt = latestState2.videoPrompts[key]?.text;
            if (!imgUrl || !vPrompt) continue;
            
            console.log(`[FullPipeline] Step 5: Worker ${workerIdx + 1} starting video ${key} (${idx + 1}/${videoKeys.length})`);
            setState((prev: any) => ({
              ...prev,
              images: { ...prev.images, [key]: { ...prev.images[key], videoLoading: true } }
            }));
            
            try {
              // Convert generated scene image URL → base64 (R2V needs base64 data URL as reference)
              const imgBase64 = await urlToBase64(imgUrl);
              if (!imgBase64) {
                console.warn(`[FullPipeline] Step 5: ⚠️ Cannot convert image to base64 for ${key}, skipping video`);
                setState((prev: any) => ({
                  ...prev,
                  images: { ...prev.images, [key]: { ...prev.images[key], videoLoading: false } }
                }));
                continue;
              }
              console.log(`[FullPipeline] Step 5: 🖼️ ${key} image converted to base64 (${Math.round(imgBase64.length/1024)}KB)`);
              
              const videoResult = await flowApi.generateVideoFromImage(
                imgBase64, vPrompt,
                { aspect_ratio: '9:16', voice: state.flowVoice || undefined }
              );
              setState((prev: any) => ({
                ...prev,
                images: { ...prev.images, [key]: { ...prev.images[key], videoUrl: videoResult.videoUrl, videoJobId: videoResult.jobId, videoLoading: false } }
              }));
              console.log(`[FullPipeline] Step 5: ✅ ${key} done (${idx + 1}/${videoKeys.length})`);
            } catch (e) {
              console.error(`[FullPipeline] Step 5: ❌ Video failed for ${key}:`, e);
              setState((prev: any) => ({
                ...prev,
                images: { ...prev.images, [key]: { ...prev.images[key], videoLoading: false } }
              }));
            }
          }
        };

        console.log(`[FullPipeline] Step 5: Launching ${concurrency} video workers for ${videoKeys.length} scenes`);
        const workers = Array.from({ length: concurrency }, (_, i) => videoWorker(i));
        await Promise.all(workers);
      }

      setState((p: any) => ({ ...p, fullWorkflowStep: 'Hoàn thành! ✅', fullWorkflowProgress: 100 }));
      console.log('[FullPipeline] ✅ All steps complete!');
      setTimeout(() => {
        setState((p: any) => ({ ...p, isFullWorkflowRunning: false, fullWorkflowStep: '', fullWorkflowProgress: 0 }));
      }, 3000);
    } catch (e) {
      console.error('Full workflow failed:', e);
      setState((p: any) => ({ ...p, isFullWorkflowRunning: false, fullWorkflowStep: 'Lỗi! ❌', fullWorkflowProgress: 0 }));
    }
  };

  // ═══════════ Update Concurrency Settings ═══════════
  const handleConcurrencyChange = (field: keyof ConcurrencySettings, value: number) => {
    const updated = saveConcurrencySettings({ [field]: value });
    setConcurrencySettingsState(updated);
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

      // Convert image URL to base64 for Gemini AI (Flow API returns blob/http URLs, not base64)
      let imageBase64 = state.images[key].url;
      if (imageBase64 && !imageBase64.startsWith('data:')) {
        try {
          const resp = await fetch(imageBase64);
          const blob = await resp.blob();
          imageBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
        } catch { imageBase64 = ''; }
      }

      const prompt = await service.generateKocVeoPrompt(
        state.productName,
        state.script[key],
        state.gender,
        state.flowVoice,
        productImageData,
        imageBase64,
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
    const { imagePromptConcurrency } = getConcurrencySettings();
    await runBatch(
      keys.map(key => ({ key, fn: () => handleGenerateImagePromptForKey(key) })),
      imagePromptConcurrency
    );
  };

  const handleBulkPrompt = async () => {
    const keys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
    const { videoPromptConcurrency } = getConcurrencySettings();
    await runBatch(
      keys.map(key => ({ key, fn: () => handleGeneratePromptForKey(key) })),
      videoPromptConcurrency
    );
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
        {/* ═══ Multi-Product Tab Bar ═══ */}
        <div className="mb-6">
          <MultiProductBar
            products={products}
            activeProductId={activeProductId}
            onSwitch={handleSwitchProduct}
            onAdd={handleAddProduct}
            onRemove={handleRemoveProduct}
            onImportCSV={handleImportCSV}
            onRename={handleRenameProduct}
          />
        </div>
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

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">Giới tính nhân vật</label>
              <select value={state.gender} onChange={e => setState(p => ({ ...p, gender: e.target.value }))} className={`w-full p-3 border rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold`}>
                <option value="Nữ">Nữ</option>
                <option value="Nam">Nam</option>
              </select>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* ═══ Chế độ tạo ảnh Nhanh / 4K ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">⚡ Chất lượng ảnh (Flow API)</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setState(p => ({ ...p, imageQuality: 'fast' }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageQuality === 'fast' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    style={state.imageQuality === 'fast' ? { backgroundColor: '#059669' } : {}}
                  >
                    ⚡ Nhanh
                  </button>
                  <button
                    onClick={() => setState(p => ({ ...p, imageQuality: '4k' }))}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageQuality === '4k' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    style={state.imageQuality === '4k' ? { backgroundColor: '#7c3aed' } : {}}
                  >
                    🔥 4K Ultra
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase px-1">🎙️ Voice mẫu (Tạo video R2V)</label>
                <div className="flex gap-2">
                  <select
                    value={state.flowVoice}
                    onChange={e => setState(p => ({ ...p, flowVoice: e.target.value }))}
                    className={`flex-1 p-3 border rounded-xl bg-white ${theme.colors.inputFocus} outline-none font-bold text-sm ${
                      state.flowVoice ? 'border-violet-400 bg-violet-50 text-violet-700' : ''
                    }`}
                  >
                    {FLOW_VOICE_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  {state.flowVoice && (
                    <button
                      onClick={() => {
                        const audio = new Audio(`/audio_demo/${state.flowVoice}.wav`);
                        audio.play().catch(() => alert('Không tìm thấy file audio mẫu'));
                      }}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                      title="Nghe thử voice mẫu"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      Nghe
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-violet-500 font-bold px-1 mt-1">Voice được chọn sẽ gắn vào video R2V (Reference-to-Video)</p>
              </div>
            </div>

            {/* ═══ Số luồng (Concurrency Settings) ═══ */}
            <div className="space-y-1">
              <button
                onClick={() => setShowConcurrencyPanel(!showConcurrencyPanel)}
                className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase px-1 hover:text-slate-700 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showConcurrencyPanel ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
                ⚙️ Cài đặt số luồng (Concurrency)
              </button>
              {showConcurrencyPanel && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fadeIn">
                  {/* Frontend concurrency */}
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">📱 Frontend (Gemini AI)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase">Ảnh AI</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={1} max={5} value={concurrencySettings.imageConcurrency}
                          onChange={e => handleConcurrencyChange('imageConcurrency', parseInt(e.target.value))}
                          className="flex-1 h-2 accent-emerald-600"
                        />
                        <span className="text-sm font-black text-emerald-600 w-6 text-center">{concurrencySettings.imageConcurrency}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase">Video</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={1} max={5} value={concurrencySettings.videoConcurrency}
                          onChange={e => handleConcurrencyChange('videoConcurrency', parseInt(e.target.value))}
                          className="flex-1 h-2 accent-violet-600"
                        />
                        <span className="text-sm font-black text-violet-600 w-6 text-center">{concurrencySettings.videoConcurrency}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase">Image Prompt</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={1} max={10} value={concurrencySettings.imagePromptConcurrency}
                          onChange={e => handleConcurrencyChange('imagePromptConcurrency', parseInt(e.target.value))}
                          className="flex-1 h-2 accent-blue-600"
                        />
                        <span className="text-sm font-black text-blue-600 w-6 text-center">{concurrencySettings.imagePromptConcurrency}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase">Video Prompt</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={1} max={10} value={concurrencySettings.videoPromptConcurrency}
                          onChange={e => handleConcurrencyChange('videoPromptConcurrency', parseInt(e.target.value))}
                          className="flex-1 h-2 accent-orange-600"
                        />
                        <span className="text-sm font-black text-orange-600 w-6 text-center">{concurrencySettings.videoPromptConcurrency}</span>
                      </div>
                    </div>
                  </div>
                  {/* Flow Server concurrency - auto sync info */}
                  <div className="border-t border-slate-200 pt-3 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">🖥️ Flow API Server</p>
                      <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Auto Sync</span>
                    </div>
                    <p className="text-[8px] text-slate-400 italic">Số luồng tự động đồng bộ lên Server khi bấm "Tạo kịch bản" hoặc "Full Pipeline"</p>
                  </div>
                </div>
              )}
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
                  onGenerateVideo={() => handleGenerateVideoForKey(key)}
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

          <div className="flex flex-col items-center gap-12 py-12">
            {/* ═══ WORKFLOW: Kịch bản → Video (Full Pipeline) ═══ */}
            <div className="w-full px-4">
              <button
                onClick={handleFullWorkflow}
                disabled={state.isFullWorkflowRunning}
                className={`w-full py-5 text-white font-black rounded-2xl shadow-2xl transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest active:scale-[0.98] ${
                  state.isFullWorkflowRunning
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 cursor-wait'
                    : 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:scale-[1.02] hover:shadow-violet-500/30'
                }`}
              >
                {state.isFullWorkflowRunning ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {state.fullWorkflowStep}
                  </>
                ) : (
                  <>
                    🚀 TẠO TỪ KỊCH BẢN → VIDEO (Full Pipeline)
                  </>
                )}
              </button>
              {state.isFullWorkflowRunning && (
                <div className="mt-3 relative h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-700 ease-out rounded-full"
                    style={{ width: `${state.fullWorkflowProgress}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white mix-blend-difference">
                    {state.fullWorkflowProgress}%
                  </span>
                </div>
              )}
            </div>

            {/* ═══ Batch Action Buttons ═══ */}
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button
                onClick={handleBulkImage}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Vẽ tất cả ảnh
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
              </button>
              <button
                onClick={handleBulkImagePrompt}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Tạo tất cả Prompt ảnh
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
              <button
                onClick={handleBulkPrompt}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Tạo tất cả Prompt video
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
              </button>
              <button
                onClick={handleBulkVideo}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest bg-gradient-to-r from-violet-600 to-fuchsia-600"
              >
                🎥 Tạo tất cả Video
              </button>
              {flowApi.isFlowApiAvailable() && (() => {
                const activeKeys2 = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
                const availableVideos = activeKeys2.filter(k => state.images?.[k]?.videoUrl);
                if (availableVideos.length < 2) return null;

                // Use state for selected videos, default all available
                const selected = state.mergeSelectedKeys || availableVideos;
                const selectedCount = selected.filter((k: string) => availableVideos.includes(k)).length;

                return (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {availableVideos.map((key: string) => {
                        const isSelected = selected.includes(key);
                        const sceneNum = key.replace('v', '');
                        return (
                          <label 
                            key={key}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-400' 
                                : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSelected = e.target.checked
                                  ? [...selected, key]
                                  : selected.filter((k: string) => k !== key);
                                setState((p: any) => ({ ...p, mergeSelectedKeys: newSelected }));
                              }}
                              className="w-3.5 h-3.5 accent-emerald-600"
                            />
                            Cảnh {sceneNum}
                          </label>
                        );
                      })}
                      <button
                        onClick={() => handleMergeAllVideos(selected.filter((k: string) => availableVideos.includes(k)))}
                        disabled={state.isMergingVideos || selectedCount < 2}
                        className={`px-6 py-3 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 uppercase tracking-widest ${
                          state.isMergingVideos 
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-400 cursor-wait' 
                            : selectedCount < 2
                              ? 'bg-gray-300 cursor-not-allowed'
                              : 'bg-gradient-to-r from-emerald-600 to-teal-600'
                        }`}
                      >
                        {state.isMergingVideos ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {state.mergeStep || 'Đang nối...'}
                          </>
                        ) : (
                          <>🎬 Nối {selectedCount} Video</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ═══ Merged Video Player ═══ */}
            {state.mergedVideoUrl && (
              <div className="w-full px-4">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                      🎬 Video đã nối hoàn chỉnh
                    </h3>
                    <a 
                      href={state.mergedVideoUrl} 
                      download={`merged_${state.productName || 'video'}.mp4`}
                      className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Tải xuống
                    </a>
                  </div>
                  <video 
                    src={state.mergedVideoUrl} 
                    controls 
                    className="w-full max-h-[500px] rounded-xl shadow-lg border border-emerald-100"
                  />
                </div>
              </div>
            )}

            {/* ═══ Video Gallery ═══ */}
            {(() => {
              const activeKeys = Array.from({ length: state.sceneCount }, (_, i) => `v${i + 1}`);
              const galleryVideos = activeKeys
                .filter(k => state.images?.[k]?.videoUrl)
                .map((k, idx) => ({
                  key: k,
                  label: `Cảnh ${parseInt(k.replace('v', ''))}`,
                  videoUrl: state.images[k].videoUrl!,
                  thumbnailUrl: state.images[k].url || undefined,
                  scriptText: state.script?.[k] || undefined,
                  videoPrompt: state.videoPrompts?.[k]?.text || undefined,
                }));
              return galleryVideos.length > 0 ? (
                <VideoGallery videos={galleryVideos} />
              ) : null;
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
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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