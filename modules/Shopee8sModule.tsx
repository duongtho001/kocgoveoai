import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/shopee8sService';
import { translateText } from '../services/geminiService';
import { runBatch, getConcurrencySettings } from '../services/concurrencyService';
import { theme } from '../constants/colors';
import { Shopee8sProduct, ScriptParts, VideoPromptState, GeneratedImage } from '../types';
import ScriptSection from '../components/ScriptSection';
import ImageCard from '../components/ImageCard';

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

interface Shopee8sModuleProps {
  language?: string;
}

const Shopee8sModule: React.FC<Shopee8sModuleProps> = ({ language = 'vi' }) => {
  const storageKey = "shopee8s_project_v8_voice_addressing";
  const [products, setProducts] = useState<Shopee8sProduct[]>(
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: '',
      usp: '',
      background: '',
      action: '',
      file: null,
      previewUrl: null,
      script: null,
      images: {},
      visualFormat: {
        v1: 'Có KOC (Tham chiếu nhân vật)',
        v2: 'Có xuât hiện tay (chỉ bàn tay)',
        v3: 'Có KOC (Tham chiếu nhân vật)',
        v4: 'Có xuât hiện tay (chỉ bàn tay)'
      },
      videoPrompts: {},
      imagePrompts: {},
      outfitImages: {},
      isLoading: false,
      isBulkImageLoading: false,
      isBulkPromptLoading: false
    }))
  );
  
  const [activeProductId, setActiveProductId] = useState<number>(1);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [outfitFile, setOutfitFile] = useState<File | null>(null);
  const [outfitPreviewUrl, setOutfitPreviewUrl] = useState<string | null>(null);
  const [processedOutfitUrl, setProcessedOutfitUrl] = useState<string | null>(null);
  const [isExtractingOutfit, setIsExtractingOutfit] = useState(false);
  const [gender, setGender] = useState<string>('Nữ');
  const [voice, setVoice] = useState<string>(VOICE_OPTIONS[0]);
  const [addressing, setAddressing] = useState<string>('');
  const [imageStyle, setImageStyle] = useState<'Realistic' | '3D'>('Realistic');
  const [commonNote, setCommonNote] = useState('');
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

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

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.products) {
          setProducts(prev => prev.map(p => {
            const savedP = parsed.products.find((sp: any) => sp.id === p.id);
            return savedP ? { 
              ...p, 
              ...savedP, 
              file: null, 
              previewUrl: null, 
              isLoading: false,
              images: savedP.images || {},
              videoPrompts: savedP.videoPrompts || {}
            } : p;
          }));
        }
        if (parsed.commonNote) setCommonNote(parsed.commonNote);
        if (parsed.gender) setGender(parsed.gender);
        if (parsed.voice) setVoice(parsed.voice);
        if (parsed.addressing) setAddressing(parsed.addressing);
        if (parsed.imageStyle) setImageStyle(parsed.imageStyle);
      }
    } catch (e) { console.error("Restore fail", e); }
  }, []);

  useEffect(() => {
    try {
      const persistentProducts = products.map(({ file, previewUrl, isLoading, images, videoPrompts, ...rest }) => {
        const safeImages = Object.keys(images || {}).reduce((acc: any, key) => {
           acc[key] = { ...images[key], url: '' }; 
           return acc;
        }, {});
        return { 
          ...rest, 
          images: safeImages, 
          videoPrompts: videoPrompts || {} 
        };
      });
      localStorage.setItem(storageKey, JSON.stringify({ products: persistentProducts, commonNote, gender, voice, addressing, imageStyle }));
    } catch (e) { }
  }, [products, commonNote, gender, voice, addressing, imageStyle]);

  // Handle Import/Export
  useEffect(() => {
    const handleExport = async () => {
      const exportData: any[] = [];
      let stt = 1;

      const faceBase64 = await toBase64(facePreview);
      const outfitBase64 = await toBase64(processedOutfitUrl || outfitPreviewUrl);

      for (const p of products) {
        if (!p.script) continue;
        const productBase64 = await toBase64(p.previewUrl);
        
        ['v1', 'v2', 'v3', 'v4'].forEach(key => {
          exportData.push({
            stt: stt++,
            inputs: {
              productName: p.name,
              usp: p.usp,
              background: p.background,
              action: p.action,
              productImage: productBase64,
              faceImage: faceBase64,
              outfitImage: outfitBase64,
              settings: {
                gender,
                voice,
                addressing,
                imageStyle,
                commonNote
              }
            },
            script: (p.script as any)[key],
            outputImage: p.images[key]?.url || '',
            videoPrompt: p.videoPrompts[key]?.text || '',
            imagePrompt: p.imagePrompts[key]?.text || '',
            customPrompt: p.images[key]?.customPrompt || '',
            visualFormat: p.visualFormat?.[key] || ''
          });
        });
      }

      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
        detail: { data: exportData, moduleName: 'Shopee_Video_8s' } 
      }));
    };

    const handleImport = async (e: any) => {
      const importedData = e.detail;
      if (!Array.isArray(importedData)) return;

      const smartFind = (obj: any, keys: string[]) => {
        const lowerKeys = keys.map(k => k.toLowerCase());
        const foundKey = Object.keys(obj).find(k => lowerKeys.includes(k.toLowerCase()));
        return foundKey ? obj[foundKey] : undefined;
      };

      const firstItem = importedData[0];
      const globalInputs = smartFind(firstItem, ['inputs', 'data']) || {};
      const globalSettings = smartFind(globalInputs, ['settings']) || {};

      const newProducts = [...products];
      const total = importedData.length;
      
      setGender(smartFind(globalSettings, ['gender']) || gender);
      setVoice(smartFind(globalSettings, ['voice']) || voice);
      setAddressing(smartFind(globalSettings, ['addressing', 'xưng hô']) || addressing);
      setImageStyle(smartFind(globalSettings, ['imageStyle']) || imageStyle);
      setCommonNote(smartFind(globalSettings, ['commonNote']) || commonNote);

      const importedFace = smartFind(globalInputs, ['faceImage', 'face_image']);
      if (importedFace) setFacePreview(importedFace);
      
      const importedOutfit = smartFind(globalInputs, ['outfitImage', 'outfit_image']);
      if (importedOutfit) {
        setOutfitPreviewUrl(importedOutfit);
        setProcessedOutfitUrl(importedOutfit);
      }

      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const inputs = smartFind(item, ['inputs', 'data']) || {};
        
        const prodIndex = Math.floor(i / 4);
        if (prodIndex >= newProducts.length) break;

        const prod = newProducts[prodIndex];
        prod.name = smartFind(inputs, ['productName', 'name']) || prod.name;
        prod.usp = smartFind(inputs, ['usp', 'keyword']) || prod.usp;
        prod.background = smartFind(inputs, ['background', 'bối cảnh']) || prod.background;
        prod.action = smartFind(inputs, ['action', 'hành động']) || prod.action;

        const importedProdImg = smartFind(inputs, ['productImage', 'product_image']);
        if (importedProdImg) prod.previewUrl = importedProdImg;

        if (!prod.script) prod.script = { v1: '', v2: '', v3: '', v4: '' };
        
        const sceneIdx = (i % 4) + 1;
        const key = `v${sceneIdx}`;
        
        prod.script[key] = smartFind(item, ['script', 'content', 'text']) || '';
        prod.images[key] = { 
          url: smartFind(item, ['outputImage', 'image', 'base64']) || '', 
          loading: false 
        };
        prod.videoPrompts[key] = { 
          text: smartFind(item, ['videoPrompt', 'prompt']) || '', 
          loading: false, 
          visible: true 
        };
        prod.imagePrompts[key] = {
          text: smartFind(item, ['imagePrompt']) || '',
          loading: false,
          visible: true
        };
        if (!prod.images[key]) prod.images[key] = { url: '', loading: false };
        prod.images[key].customPrompt = smartFind(item, ['customPrompt']) || '';
        
        if (!prod.visualFormat) prod.visualFormat = { v1: '', v2: '', v3: '', v4: '' };
        prod.visualFormat[key] = smartFind(item, ['visualFormat']) || prod.visualFormat[key];

        const percent = Math.round(((i + 1) / total) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { 
          detail: { percent, complete: i === total - 1 } 
        }));
        await new Promise(r => setTimeout(r, 50));
      }
      setProducts(newProducts);
    };

    window.addEventListener('REQUEST_EXPORT_DATA', handleExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleImport);
    };
  }, [products, gender, voice, addressing, imageStyle, commonNote]);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is in a textarea or input (except our specific ones)
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'file')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob && activeProductId) {
            handleFileChange(activeProductId, blob);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeProductId, products]);

  const updateProduct = (id: number, updates: Partial<Shopee8sProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateProductImage = (productId: number, imageKey: string, imgUpdates: Partial<GeneratedImage>) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newImages = { ...p.images };
      newImages[imageKey] = { ...(newImages[imageKey] || { url: '', loading: false }), ...imgUpdates };
      return { ...p, images: newImages };
    }));
  };

  const updateProductVisualFormat = (productId: number, key: string, format: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      return {
        ...p,
        visualFormat: { ...(p.visualFormat || {}), [key]: format }
      };
    }));
  };

  const updateProductVideoPrompt = (productId: number, promptKey: string, promptUpdates: Partial<VideoPromptState>) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newPrompts = { ...p.videoPrompts };
      newPrompts[promptKey] = { ...(newPrompts[promptKey] || { text: '', loading: false, visible: false }), ...promptUpdates };
      return { ...p, videoPrompts: newPrompts };
    }));
  };

  const updateProductImagePrompt = (productId: number, promptKey: string, promptUpdates: Partial<VideoPromptState>) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newPrompts = { ...p.imagePrompts };
      newPrompts[promptKey] = { ...(newPrompts[promptKey] || { text: '', loading: false, visible: false }), ...promptUpdates };
      return { ...p, imagePrompts: newPrompts };
    }));
  };

  const handleFileChange = (id: number, file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateProduct(id, { file, previewUrl: url });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      handleFileChange(productId, files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent, id: number) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          handleFileChange(id, blob);
        }
      }
    }
  };

  const removeProductImage = (id: number) => {
    updateProduct(id, { file: null, previewUrl: null });
  };

  const handleGenerateAll = async () => {
    const productsToGen = products.filter(p => (p.file || p.previewUrl) && p.name);
    if (productsToGen.length === 0) {
      alert("Vui lòng tải ảnh và nhập tên cho ít nhất một sản phẩm.");
      return;
    }

    setIsGlobalLoading(true);
    
    try {
      // Use bulk generation for better performance
      const bulkResults = await service.generateShopee8sScriptsBulk(
        productsToGen.map(p => ({ id: p.id, name: p.name, usp: p.usp })),
        voice,
        addressing,
        gender,
        language
      );

      setProducts(prev => prev.map(p => {
        const res = bulkResults.find(r => r.id === p.id);
        if (res) {
          const initialImages: any = {};
          const initialPrompts: any = {};
          const initialImagePrompts: any = {};
          ['v1', 'v2', 'v3', 'v4'].forEach(k => {
            initialImages[k] = { url: '', loading: false, customPrompt: '' };
            initialPrompts[k] = { text: '', loading: false, visible: false };
            initialImagePrompts[k] = { text: '', loading: false, visible: false };
          });
          return {
            ...p,
            script: res.script,
            images: initialImages,
            videoPrompts: initialPrompts,
            imagePrompts: initialImagePrompts,
            isLoading: false
          };
        }
        return { ...p, isLoading: false };
      }));

    } catch (error) {
      console.error("Global generation error:", error);
      alert("Có lỗi xảy ra khi tạo kịch bản hàng loạt.");
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleGenerateScriptForProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.name) {
      alert("Vui lòng nhập tên sản phẩm.");
      return;
    }

    updateProduct(productId, { isLoading: true });
    try {
      const script = await service.generateShopee8sScript(product.name, product.usp, voice, addressing, gender, language);
      const initialImages: any = {};
      const initialPrompts: any = {};
      const initialImagePrompts: any = {};
      ['v1', 'v2', 'v3', 'v4'].forEach(k => {
        initialImages[k] = { url: '', loading: false, customPrompt: '' };
        initialPrompts[k] = { text: '', loading: false, visible: false };
        initialImagePrompts[k] = { text: '', loading: false, visible: false };
      });
      updateProduct(productId, { 
        script, 
        images: initialImages, 
        videoPrompts: initialPrompts,
        imagePrompts: initialImagePrompts,
        isLoading: false 
      });
    } catch (error) {
      console.error("Single script error:", error);
      updateProduct(productId, { isLoading: false });
      alert("Lỗi khi tạo kịch bản.");
    }
  };

  const handleExtractOutfit = async () => {
    if (!outfitFile) return;
    setIsExtractingOutfit(true);
    try {
      const outfitPart = await service.fileToGenerativePart(outfitFile);
      const result = await service.extractOutfitImage(outfitPart);
      setProcessedOutfitUrl(result);
    } catch (error) {
      console.error("Lỗi trích xuất trang phục:", error);
    } finally {
      setIsExtractingOutfit(false);
    }
  };

  const handleGenImageForKey = async (productId: number, key: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.script) return;
    if (!product.file && !product.previewUrl) {
      alert("Vui lòng tải lên ảnh sản phẩm trước khi tạo ảnh AI.");
      return;
    }

    updateProductImage(productId, key, { loading: true, error: undefined });

    try {
      const imagePart = product.file 
        ? await service.fileToGenerativePart(product.file) 
        : (product.previewUrl && product.previewUrl.startsWith('data:') 
            ? { mimeType: product.previewUrl.split(';')[0].split(':')[1], data: product.previewUrl.split(',')[1] } 
            : null);
      
      const facePart = faceFile 
        ? await service.fileToGenerativePart(faceFile) 
        : (facePreview && facePreview.startsWith('data:') 
            ? { mimeType: facePreview.split(';')[0].split(':')[1], data: facePreview.split(',')[1] } 
            : null);

      const outfitPart = processedOutfitUrl && processedOutfitUrl.startsWith('data:') 
        ? { mimeType: processedOutfitUrl.split(';')[0].split(':')[1], data: processedOutfitUrl.split(',')[1] } 
        : null;
      
      const isFollowUp = key === 'v2' || key === 'v4';
      const customP = product.images[key]?.customPrompt || "";

      const charDesc = [
        product.action ? `Action: ${product.action}` : "",
        product.background ? `Background: ${product.background}` : "",
        commonNote, 
        customP
      ].filter(Boolean).join(". ");

      const imgUrl = await service.generateShopee8sImage(
        imagePart ? [imagePart] : [], 
        product.name, 
        (product.script as any)[key], 
        charDesc,
        facePart,
        outfitPart,
        isFollowUp,
        imageStyle,
        gender,
        language,
        product.visualFormat?.[key] || ''
      );

      if (!imgUrl) throw new Error("Không nhận được phản hồi từ AI");

      updateProductImage(productId, key, { url: imgUrl, loading: false });
    } catch (error) {
      console.error("Image generation error:", error);
      updateProductImage(productId, key, { loading: false, error: 'Lỗi tạo ảnh' });
    }
  };

  const handleGenVideoPrompt = async (productId: number, key: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.script) return;

    updateProductVideoPrompt(productId, key, { text: '', loading: true, visible: true });

    try {
      const productImagePart = product.file 
        ? await service.fileToGenerativePart(product.file) 
        : (product.previewUrl && product.previewUrl.startsWith('data:') 
            ? { mimeType: product.previewUrl.split(';')[0].split(':')[1], data: product.previewUrl.split(',')[1] } 
            : null);
      
      const customP = product.images[key]?.customPrompt || "";
      const noProductKeywords = ["không có sản phẩm", "xóa sản phẩm", "không xuất hiện sản phẩm", "bỏ sản phẩm", "không thấy sản phẩm", "no product", "remove product", "without product"];
      const isNoProduct = noProductKeywords.some(kw => customP.toLowerCase().includes(kw));

      const enhancedScript = product.action 
        ? `${(product.script as any)[key]} (Action hint: ${product.action})`
        : (product.script as any)[key];

      const prompt = await service.generateShopee8sVeoPrompt(
        product.name,
        enhancedScript,
        gender,
        voice,
        productImagePart?.data,
        product.images[key]?.url,
        isNoProduct,
        imageStyle,
        language
      );

      updateProductVideoPrompt(productId, key, { text: prompt, loading: false, visible: true });
    } catch (error) {
      updateProductVideoPrompt(productId, key, { text: 'Lỗi tạo prompt.', loading: false, visible: true });
    }
  };

  const handleGenerateImagePromptForKey = async (productId: number, key: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.script) return;

    updateProductImagePrompt(productId, key, { text: '', loading: true, visible: true });

    try {
      const customP = product.images[key]?.customPrompt || "";
      const noProductKeywords = ["không có sản phẩm", "xóa sản phẩm", "không xuất hiện sản phẩm", "bỏ sản phẩm", "không thấy sản phẩm", "no product", "remove product", "without product"];
      const isNoProduct = noProductKeywords.some(kw => customP.toLowerCase().includes(kw));

      const enhancedScript = product.action 
        ? `${(product.script as any)[key]} (Action hint: ${product.action})`
        : (product.script as any)[key];

      const prompt = await service.generateShopee8sImagePrompt(
        product.name,
        enhancedScript,
        imageStyle,
        gender,
        voice,
        product.background || commonNote,
        "", // visualNote
        customP,
        product.images[key]?.pose || "",
        isNoProduct,
        language,
        product.visualFormat?.[key] || ''
      );

      updateProductImagePrompt(productId, key, { text: prompt, loading: false, visible: true });
    } catch (error) {
      updateProductImagePrompt(productId, key, { text: 'Lỗi tạo prompt ảnh.', loading: false, visible: true });
    }
  };

  const handleBulkPromptForProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.script) return;

    updateProduct(productId, { isBulkPromptLoading: true });
    try {
      const keys = ['v1', 'v2', 'v3', 'v4'];
      const { videoPromptConcurrency } = getConcurrencySettings();
      await runBatch(
        keys.map(key => ({ key, fn: () => handleGenVideoPrompt(productId, key) })),
        videoPromptConcurrency
      );
    } finally {
      updateProduct(productId, { isBulkPromptLoading: false });
    }
  };

  const handleTranslateForKey = async (productId: number, key: string, type: 'image' | 'video') => {
    const p = products.find(prod => prod.id === productId);
    if (!p) return;

    const promptState = type === 'image' ? p.imagePrompts[key] : p.videoPrompts[key];
    if (!promptState || !promptState.text || promptState.loading) return;

    const stateKey = type === 'image' ? 'imagePrompts' : 'videoPrompts';

    setProducts(prev => prev.map(prod => {
      if (prod.id === productId) {
        return {
          ...prod,
          [stateKey]: {
            ...prod[stateKey],
            [key]: { ...prod[stateKey][key], loading: true }
          }
        };
      }
      return prod;
    }));

    try {
      const translated = await translateText(promptState.text);
      setProducts(prev => prev.map(prod => {
        if (prod.id === productId) {
          return {
            ...prod,
            [stateKey]: {
              ...prod[stateKey],
              [key]: { ...prod[stateKey][key], text: translated, loading: false }
            }
          };
        }
        return prod;
      }));
    } catch (error) {
      console.error("Translation failed", error);
      setProducts(prev => prev.map(prod => {
        if (prod.id === productId) {
          return {
            ...prod,
            [stateKey]: {
              ...prod[stateKey],
              [key]: { ...prod[stateKey][key], loading: false }
            }
          };
        }
        return prod;
      }));
    }
  };

  const handleBulkImagePromptForProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.script) return;

    updateProduct(productId, { isBulkPromptLoading: true });
    try {
      const keys = ['v1', 'v2', 'v3', 'v4'];
      const { imagePromptConcurrency } = getConcurrencySettings();
      await runBatch(
        keys.map(key => ({ key, fn: () => handleGenerateImagePromptForKey(productId, key) })),
        imagePromptConcurrency
      );
    } finally {
      updateProduct(productId, { isBulkPromptLoading: false });
    }
  };

  const handleBulkImageForProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    updateProduct(productId, { isBulkImageLoading: true });
    try {
      const keys = ['v1', 'v2', 'v3', 'v4'];
      const { imageConcurrency } = getConcurrencySettings();
      await runBatch(
        keys.map(key => ({ key, fn: () => handleGenImageForKey(productId, key) })),
        imageConcurrency
      );
    } finally {
      updateProduct(productId, { isBulkImageLoading: false });
    }
  };

  const handleBulkImagePromptAll = async () => {
    setIsGlobalLoading(true);
    try {
      for (const p of products) {
        if (p.script) {
          await handleBulkImagePromptForProduct(p.id);
        }
      }
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleBulkVideoPromptAll = async () => {
    setIsGlobalLoading(true);
    try {
      for (const p of products) {
        if (p.script) {
          await handleBulkPromptForProduct(p.id);
        }
      }
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleBulkImageAll = async () => {
    setIsGlobalLoading(true);
    try {
      for (const p of products) {
        if (p.script) {
          await handleBulkImageForProduct(p.id);
        }
      }
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleDownloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') return;
    const zip = new JSZip();
    let sequenceIndex = 1;
    for (const product of products) {
      for (const key of ['v1', 'v2', 'v3', 'v4']) {
        const img = product.images[key];
        if (img?.url) {
          zip.file(`${String(sequenceIndex).padStart(2, '0')}.png`, img.url.split(',')[1], { base64: true });
          sequenceIndex++;
        }
      }
    }
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "shopee8s_images.zip";
    link.click();
  };

  const handleDownloadAllImagePromptsTxt = () => {
    let allPrompts = "";
    for (const product of products) {
      for (const key of ['v1', 'v2', 'v3', 'v4']) {
        const p = product.imagePrompts?.[key];
        if (p?.text) allPrompts += p.text.replace(/\n/g, ' ') + "\n\n";
      }
    }
    if (!allPrompts.trim()) return alert("Chưa có prompt ảnh nào.");
    const blob = new Blob([allPrompts], { type: 'text/plain' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "shopee8s_image_prompts.txt";
    link.click();
  };

  const handleDownloadAllPromptsTxt = () => {
    let allPrompts = "";
    for (const product of products) {
      for (const key of ['v1', 'v2', 'v3', 'v4']) {
        const p = product.videoPrompts[key];
        if (p?.text) allPrompts += p.text.replace(/\n/g, ' ') + "\n";
      }
    }
    const blob = new Blob([allPrompts], { type: 'text/plain' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "shopee8s_prompts.txt";
    link.click();
  };

  const productsWithResults = products.filter(p => p.script);
  const hasResults = productsWithResults.length > 0;
  const hasAnyMedia = products.some(p => 
    (Object.values(p.images) as GeneratedImage[]).some(img => img.url) || 
    (Object.values(p.videoPrompts) as VideoPromptState[]).some(pr => pr.text)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Input Grid */}
      <div className={`${theme.colors.cardBg} rounded-[1.5rem] ${theme.colors.cardBorder} p-8 ${theme.colors.cardShadow} space-y-8`}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {products.map((p) => (
              <div 
                key={p.id}
                tabIndex={0}
                onClick={() => setActiveProductId(p.id)}
                onPaste={(e) => handlePaste(e, p.id)}
                className={`flex flex-col rounded-[1rem] border-2 p-3 transition-all cursor-pointer group relative focus:ring-2 ${theme.colors.secondaryBg} focus:outline-none ${
                  activeProductId === p.id 
                    ? `${theme.colors.primaryBorder} ring-1 ${theme.colors.secondaryBg} bg-white` 
                    : 'border-[#f1f5f9] bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    activeProductId === p.id ? `${theme.colors.primaryBorder} ${theme.colors.primaryBg}` : 'border-slate-300 bg-white'
                  }`}>
                    {activeProductId === p.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span className={`text-[11px] font-bold ${activeProductId === p.id ? theme.colors.primaryText : 'text-slate-500'}`}>
                    Sản phẩm {p.id}
                  </span>
                </div>

                <div 
                  onClick={(e) => { e.stopPropagation(); fileInputRefs.current[p.id]?.click(); }}
                  onPaste={(e) => handlePaste(e, p.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, p.id)}
                  className="aspect-[4/5] bg-[#f8fafc] rounded-lg border border-dashed border-slate-200 mb-3 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:bg-[#f1f5f9] relative"
                >
                {p.previewUrl ? (
                  <>
                    <img src={p.previewUrl} className="w-full h-full object-cover" alt={`p${p.id}`} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeProductImage(p.id); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors z-10"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-2 opacity-40">
                    <svg className="w-8 h-8 mx-auto text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">TẢI / PASTE ẢNH</span>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={el => { fileInputRefs.current[p.id] = el; }}
                  onChange={(e) => handleFileChange(p.id, e.target.files?.[0] || null)}
                  className="hidden" 
                  accept="image/*"
                />
              </div>

              <div className="space-y-2">
                <input 
                  type="text" 
                  value={p.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                  placeholder="Tên sản phẩm..."
                  className={`w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none ${theme.colors.inputFocus} font-medium placeholder:text-slate-300`}
                />
                <input 
                  type="text" 
                  value={p.usp}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { usp: e.target.value })}
                  placeholder="USP (Keyword)..."
                  className={`w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none ${theme.colors.inputFocus} font-medium placeholder:text-slate-300`}
                />
                <input 
                  type="text" 
                  value={p.background}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { background: e.target.value })}
                  placeholder="Bối cảnh (background)..."
                  className={`w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none ${theme.colors.inputFocus} font-medium placeholder:text-slate-300`}
                />
                <input 
                  type="text" 
                  value={p.action}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { action: e.target.value })}
                  placeholder="Hành động với sp..."
                  className={`w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none ${theme.colors.inputFocus} font-medium placeholder:text-slate-300`}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleGenerateScriptForProduct(p.id); }}
                  disabled={p.isLoading || isGlobalLoading}
                  className={`w-full py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    p.isLoading 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : `${theme.colors.buttonPrimary} shadow-sm active:scale-95`
                  }`}
                >
                  {p.isLoading ? (
                    <span className="flex items-center gap-2 notranslate" translate="no">
                      <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      <span>ĐANG TẠO...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 notranslate" translate="no">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14H11V21L20 10H13Z" />
                      </svg>
                      <span>TẠO KỊCH BẢN</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Giới tính nhân vật</label>
                    <select 
                      value={gender} 
                      onChange={e => setGender(e.target.value)} 
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all appearance-none"
                    >
                        <option value="Nữ">Nữ</option>
                        <option value="Nam">Nam</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Phong cách ảnh</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 h-[46px]">
                      <button 
                        onClick={() => setImageStyle('Realistic')}
                        className={`flex-1 text-[10px] font-black uppercase rounded-lg transition-all ${imageStyle === 'Realistic' ? theme.colors.buttonActiveSolid : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Chân thực
                      </button>
                      <button 
                        onClick={() => setImageStyle('3D')}
                        className={`flex-1 text-[10px] font-black uppercase rounded-lg transition-all ${imageStyle === '3D' ? theme.colors.buttonActiveSolid : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        3D
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Giọng điệu vùng miền</label>
                  <select 
                    value={voice} 
                    onChange={e => setVoice(e.target.value)} 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                  >
                      {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Cách xưng hô (Người nói - Người nghe)</label>
                  <div className="relative">
                    <input 
                      list="shopee-addressing-list"
                      value={addressing} 
                      onChange={e => setAddressing(e.target.value)}
                      placeholder="VD: em - các bác"
                      className={`w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none ${theme.colors.inputFocus} transition-all`}
                    />
                    <datalist id="shopee-addressing-list">
                      {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>
                </div>
             </div>

             <div className="space-y-4">
               <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">0. Ảnh khuôn mặt mẫu (Dùng chung)</label>
                  <div className="flex gap-4">
                    <div 
                      tabIndex={0}
                      onClick={() => faceInputRef.current?.click()}
                      onPaste={(e) => {
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf("image") !== -1) {
                            const blob = items[i].getAsFile();
                            if (blob) {
                              setFaceFile(blob);
                              setFacePreview(URL.createObjectURL(blob));
                            }
                          }
                        }
                      }}
                      className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden flex-shrink-0 group relative focus:ring-2 focus:ring-slate-200 focus:outline-none"
                    >
                      {facePreview ? (
                        <>
                          <img src={facePreview} className="w-full h-full object-cover" alt="Face preview" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFaceFile(null); setFacePreview(null); }}
                            className={`absolute top-1 right-1 w-5 h-5 ${theme.colors.primaryBg} text-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity z-10`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <div className="text-slate-300 group-hover:text-slate-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                        </div>
                      )}
                      <input type="file" ref={faceInputRef} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setFaceFile(f); setFacePreview(URL.createObjectURL(f)); }
                        }} className="hidden" accept="image/*" />
                    </div>
                    <div className="flex-1">
                      <textarea 
                        value={commonNote}
                        onChange={(e) => setCommonNote(e.target.value)}
                        placeholder="Ghi chú thêm về trang phục hoặc bối cảnh cho nhân vật..."
                        className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-100 outline-none resize-none transition-all placeholder:text-slate-400 font-medium"
                      />
                    </div>
                  </div>
               </div>

               <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">0. Ảnh trang phục (Dùng chung)</label>
                  <div className="flex gap-4">
                    <div 
                      tabIndex={0}
                      onClick={() => outfitInputRef.current?.click()}
                      onPaste={(e) => {
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf("image") !== -1) {
                            const blob = items[i].getAsFile();
                            if (blob) {
                              setOutfitFile(blob);
                              setOutfitPreviewUrl(URL.createObjectURL(blob));
                            }
                          }
                        }
                      }}
                      className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden flex-shrink-0 group relative focus:ring-2 focus:ring-slate-200 focus:outline-none"
                    >
                      {outfitPreviewUrl ? (
                        <>
                          <img src={outfitPreviewUrl} className="w-full h-full object-cover" alt="Outfit preview" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOutfitFile(null); setOutfitPreviewUrl(null); setProcessedOutfitUrl(null); }}
                            className={`absolute top-1 right-1 w-5 h-5 ${theme.colors.primaryBg} text-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity z-10`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <div className="text-slate-300 group-hover:text-slate-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                        </div>
                      )}
                      <input type="file" ref={outfitInputRef} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setOutfitFile(f); setOutfitPreviewUrl(URL.createObjectURL(f)); }
                        }} className="hidden" accept="image/*" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <button 
                        onClick={handleExtractOutfit}
                        disabled={!outfitFile || isExtractingOutfit}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${!outfitFile || isExtractingOutfit ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
                      >
                        {isExtractingOutfit ? (
                          <span className="flex items-center gap-2 notranslate" translate="no">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Đang tách nền...</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 notranslate" translate="no">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            <span>Tách nền trang phục</span>
                          </span>
                        )}
                      </button>
                      {processedOutfitUrl && (
                        <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-200 bg-white flex-shrink-0">
                            <img src={processedOutfitUrl} className="w-full h-full object-contain" alt="Processed" />
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Đã tách nền thành công</span>
                        </div>
                      )}
                    </div>
                  </div>
               </div>
             </div>
          </div>
        </div>

        <button 
          onClick={handleGenerateAll}
          disabled={isGlobalLoading || !products.some(p => (p.file || p.previewUrl) && p.name)}
          className={`w-full py-5 font-black rounded-xl text-lg flex items-center justify-center gap-3 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.99] uppercase ${isGlobalLoading || !products.some(p => (p.file || p.previewUrl) && p.name) ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
        >
          {isGlobalLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>ĐANG TẠO KỊCH BẢN BỘ...</span>
            </div>
          ) : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}
        </button>
      </div>

      {/* Results Section */}
      {hasResults && (
        <div className="mt-12 space-y-12 pb-12">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm flex justify-between items-center">
             <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">KẾT QUẢ KỊCH BẢN BỘ</h3>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                  {productsWithResults.length} sản phẩm • {voice} • {addressing}
                </p>
             </div>
          </div>

          {productsWithResults.map((product) => (
            <div key={product.id} className="animate-fadeIn">
              <div className="flex items-center gap-3 mb-6 px-4">
                <div className={`w-8 h-8 ${theme.colors.primaryBg} text-white rounded-full flex items-center justify-center font-black text-sm`}>
                  {product.id}
                </div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                   {product.name}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* VIDEO 1 (16S) */}
                <div className={`rounded-[2rem] border-2 ${theme.colors.secondaryBorder} p-8 shadow-sm relative overflow-hidden`}>
                   <h3 className={`text-lg font-black ${theme.colors.primaryText} uppercase tracking-tighter mb-6 flex items-center gap-2`}>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     VIDEO 1 & 2
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                      {['v1', 'v2'].map(key => (
                         <ScriptSection 
                           key={key}
                           title={key === 'v1' ? "Video 1" : "Video 2"} 
                           content={(product.script as any)[key]} 
                           color={theme.colors.primaryBorder} 
                           onChange={(val) => {
                             const newScript = { ...product.script, [key]: val } as ScriptParts;
                             updateProduct(product.id, { script: newScript });
                           }} 
                           maxChars={180}
                         />
                      ))}
                   </div>
                   <div className="pt-6 border-t border-slate-100">
                     <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Hình ảnh Visual</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {['v1', 'v2'].map(key => (
                           <div key={key} className="space-y-3">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Định dạng hình ảnh</label>
                                 <select 
                                   value={product.visualFormat?.[key] || ''} 
                                   onChange={e => updateProductVisualFormat(product.id, key, e.target.value)}
                                   className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                                 >
                                   <option value="Có KOC (Tham chiếu nhân vật)">Có KOC (Tham chiếu nhân vật)</option>
                                   <option value="Có xuât hiện tay (chỉ bàn tay)">Có xuât hiện tay (chỉ bàn tay)</option>
                                 </select>
                              </div>
                              <ImageCard 
                                key={key}
                                label={`Hình ảnh ${key.toUpperCase()}`} 
                                imageData={product.images[key] || { url: '', loading: false }} 
                                videoPrompt={(product.videoPrompts as any)?.[key] || { text: '', loading: false, visible: false }} 
                                imagePrompt={(product.imagePrompts as any)?.[key] || { text: '', loading: false, visible: false }}
                                onGeneratePrompt={() => handleGenVideoPrompt(product.id, key)} 
                                onGenerateImagePrompt={() => handleGenerateImagePromptForKey(product.id, key)}
                                onRegenerate={() => handleGenImageForKey(product.id, key)} 
                                onTranslate={() => {}} 
                                onUpload={(file) => {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const url = ev.target?.result as string;
                                    updateProductImage(product.id, key, { url, loading: false });
                                  };
                                  reader.readAsDataURL(file);
                                }}
                                onDelete={() => {
                                  updateProductImage(product.id, key, { url: '', loading: false });
                                }}
                                customPrompt={product.images[key]?.customPrompt || ""} 
                                onCustomPromptChange={(val) => {
                                   updateProductImage(product.id, key, { customPrompt: val });
                                }} 
                              />
                           </div>
                        ))}
                     </div>
                   </div>
                </div>

                {/* VIDEO 3 & 4 */}
                <div className={`rounded-[2rem] border-2 ${theme.colors.secondaryBorder} p-8 shadow-sm relative overflow-hidden`}>
                   <h3 className={`text-lg font-black ${theme.colors.primaryText} uppercase tracking-tighter mb-6 flex items-center gap-2`}>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16l2.828-2.828M8 16L5.172 13.172M8 16L11 19M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     VIDEO 3 & 4
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                      {['v3', 'v4'].map(key => (
                         <ScriptSection 
                           key={key}
                           title={key === 'v3' ? "Video 3" : "Video 4"} 
                           content={(product.script as any)[key]} 
                           color={theme.colors.primaryBorder} 
                           onChange={(val) => {
                             const newScript = { ...product.script, [key]: val } as ScriptParts;
                             updateProduct(product.id, { script: newScript });
                           }} 
                           maxChars={180}
                         />
                      ))}
                   </div>
                   <div className="pt-6 border-t border-slate-100">
                     <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Hình ảnh Visual</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {['v3', 'v4'].map(key => (
                           <div key={key} className="space-y-3">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Định dạng hình ảnh</label>
                                 <select 
                                   value={product.visualFormat?.[key] || ''} 
                                   onChange={e => updateProductVisualFormat(product.id, key, e.target.value)}
                                   className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                                 >
                                   <option value="Có KOC (Tham chiếu nhân vật)">Có KOC (Tham chiếu nhân vật)</option>
                                   <option value="Có xuât hiện tay (chỉ bàn tay)">Có xuât hiện tay (chỉ bàn tay)</option>
                                 </select>
                              </div>
                              <ImageCard 
                                key={key}
                                label={`Hình ảnh ${key.toUpperCase()}`} 
                                imageData={product.images[key] || { url: '', loading: false }} 
                                videoPrompt={(product.videoPrompts as any)?.[key] || { text: '', loading: false, visible: false }} 
                                imagePrompt={(product.imagePrompts as any)?.[key] || { text: '', loading: false, visible: false }}
                                onGeneratePrompt={() => handleGenVideoPrompt(product.id, key)} 
                                onGenerateImagePrompt={() => handleGenerateImagePromptForKey(product.id, key)}
                                onRegenerate={() => handleGenImageForKey(product.id, key)} 
                                onTranslate={() => {}} 
                                onUpload={(file) => {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const url = ev.target?.result as string;
                                    updateProductImage(product.id, key, { url, loading: false });
                                  };
                                  reader.readAsDataURL(file);
                                }}
                                onDelete={() => {
                                  updateProductImage(product.id, key, { url: '', loading: false });
                                }}
                                customPrompt={product.images[key]?.customPrompt || ""} 
                                onCustomPromptChange={(val) => {
                                   updateProductImage(product.id, key, { customPrompt: val });
                                 }} 
                              />
                           </div>
                        ))}
                     </div>
                   </div>
                </div>
              </div>

              {/* Bulk Actions for Product */}
              <div className="flex flex-col md:flex-row justify-center mt-10 gap-4">
                <button
                    onClick={() => handleBulkImageForProduct(product.id)}
                    disabled={product.isBulkImageLoading}
                    className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl shadow-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 ${product.isBulkImageLoading ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
                >
                    Vẽ tất cả ảnh
                    {product.isBulkImageLoading ? (
                      <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
                    )}
                </button>
                <button
                    onClick={() => handleBulkImagePromptForProduct(product.id)}
                    disabled={product.isBulkPromptLoading}
                    className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 ${product.isBulkPromptLoading ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
                >
                    Tạo tất cả Prompt ảnh
                    {product.isBulkPromptLoading ? (
                      <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    )}
                </button>
                <button
                    onClick={() => handleBulkPromptForProduct(product.id)}
                    disabled={product.isBulkPromptLoading}
                    className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 ${product.isBulkPromptLoading ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
                >
                    Tạo tất cả Prompt video
                    {product.isBulkPromptLoading ? (
                      <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
                    )}
                </button>
              </div>
            </div>
          ))}

          {/* Bulk Action Footer */}
          {hasAnyMedia && (
            <div className="flex flex-col items-center gap-12 py-12 border-t border-slate-200 mt-12">
                <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
                    <button
                        onClick={handleBulkImageAll}
                        disabled={isGlobalLoading}
                        className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl shadow-2xl active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 ${isGlobalLoading ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
                    >
                        Vẽ tất cả ảnh
                        {isGlobalLoading ? (
                          <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
                        )}
                    </button>
                    <button
                        onClick={handleBulkImagePromptAll}
                        disabled={isGlobalLoading}
                        className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 ${isGlobalLoading ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
                    >
                        Tạo tất cả Prompt ảnh
                        {isGlobalLoading ? (
                          <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        )}
                    </button>
                    <button
                        onClick={handleBulkVideoPromptAll}
                        disabled={isGlobalLoading}
                        className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 ${isGlobalLoading ? 'bg-slate-200 text-slate-400' : theme.colors.buttonPrimary}`}
                    >
                        Tạo tất cả Prompt video
                        {isGlobalLoading ? (
                          <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
                        )}
                    </button>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                    <button onClick={handleDownloadAllImagesZip} className={`w-full md:w-auto px-8 py-5 font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${theme.colors.buttonPrimary}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Tải Ảnh (ZIP)
                    </button>
                    <button onClick={handleDownloadAllImagePromptsTxt} className={`w-full md:w-auto px-8 py-5 font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${theme.colors.buttonPrimary}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Tải Prompt Ảnh (.txt)
                    </button>
                    <button onClick={handleDownloadAllPromptsTxt} className={`w-full md:w-auto px-8 py-5 font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${theme.colors.buttonPrimary}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Tải Video Prompt (.txt)
                    </button>
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Shopee8sModule;