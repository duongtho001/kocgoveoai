import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/carouselService';
import CarouselCard from '../components/CarouselCard';

import { theme } from '../constants/colors';

declare var JSZip: any;

const CAROUSEL_CATEGORIES: Record<string, string[]> = {
  "Giữ nguyên văn phong kịch bản": [],
  "Kể chuyện cá nhân": [
    "Thành công nhiều người ngưỡng mộ",
    "Thất bại để tạo sự đồng cảm/ngưỡng mộ/nể phục cho đám đông",
    "Khoảnh khắc đời thường với góc nhìn độc đáo",
    "Bài học từ trải nghiệm nào đó",
    "Kể chuyện trải nghiệm"
  ],
  "Tổng hợp": [
    "Lần đầu làm 1 việc gì đấy",
    "Những điều hay nhất/tệ nhất",
    "Cảnh báo về 1 vấn đề nào đấy",
    "Xu hướng",
    "Hướng dẫn",
    "Tài liệu để giải quyết 1 vấn đề gì đấy",
    "Công cụ hữu ích"
  ],
  "So sánh": [
    "Sản phẩm cùng loại",
    "Thế hệ",
    "Các thương hiệu/các hãng/các công ty",
    "Hiệu quả/Công dụng/Lợi ích/Tính năng"
  ],
  "Check var (Kiểm chứng)": [
    "Phát biểu của người nổi tiếng/người bất kỳ",
    "Một hiện tượng lạ",
    "Các vấn đề, chủ đề có nhiều luồng ý kiến"
  ],
  "Hướng dẫn chi tiết": [
    "Những thứ cần thiết để phát triển trong 1 lĩnh vực/ngành nghề/công việc",
    "Những thứ giúp người khác tăng thu nhập",
    "Bảo vệ mọi người, giúp người khác an toàn",
    "Rút ngắn thời gian hoàn thành 1 thứ gì đó",
    "Công cụ, công nghệ hiện đại"
  ],
  "Kể chuyện sản phẩm/dịch vụ": [
    "Quá trình ra đời của 1 sản phẩm",
    "Một sản phẩm thất bại và bài học từ đó",
    "Câu chuyện về những khách hàng đầu tiên/ấn tượng nhất/đặc biệt nhất",
    "1 sản phẩm độc đáo và các tình huống khác nhau xoay quanh nó",
    "Tình huống oái oăm, dở khóc, dở cười khi bán sản phẩm",
    "Chuyện về nhà sáng lập/hội đồng sáng lập"
  ]
};

const FONTS = [
  // Sans-serif / Modern
  { id: 'Montserrat', label: 'Montserrat (Đậm chất GenZ)' },
  { id: 'Roboto', label: 'Roboto (Hiện đại / Phổ biến)' },
  { id: 'Open Sans', label: 'Open Sans (Sạch sẽ / Dễ đọc)' },
  { id: 'Oswald', label: 'Oswald (Mạnh mẽ / Narrow)' },
  { id: 'Noto Sans', label: 'Noto Sans (Cơ bản / Chuẩn)' },
  { id: 'Josefin Sans', label: 'Josefin Sans (Hình học / Sang)' },
  { id: 'Archivo Black', label: 'Archivo Black (Siêu dày / Nổi)' },
  
  // Serif / Classic
  { id: 'Playfair Display', label: 'Playfair Display (Cổ điển / Qúy phái)' },
  { id: 'Lora', label: 'Lora (Văn chương / Thanh lịch)' },
  { id: 'Merriweather', label: 'Merriweather (Tin cậy / Serif)' },
  { id: 'Raleway', label: 'Raleway (Tinh tế / Fashion)' },

  // Script / Handwriting
  { id: 'Pacifico', label: 'Pacifico (Viết tay / Phóng khoáng)' },
  { id: 'Dancing Script', label: 'Dancing Script (Bay bổng)' },
  { id: 'Lobster', label: 'Lobster (Cổ điển / Retro)' },
  { id: 'Charm', label: 'Charm (Thư pháp nhẹ nhàng)' },
  { id: 'Mali', label: 'Mali (Vui tươi / Cute)' },
  { id: 'Patrick Hand', label: 'Patrick Hand (Viết bút bi)' },

  // Rounded / Others
  { id: 'Baloo 2', label: 'Baloo 2 (Tròn trịa / Thân thiện)' },
  { id: 'Comfortaa', label: 'Comfortaa (Bo tròn / Công nghệ)' },
  { id: 'Quicksand', label: 'Quicksand (Nhẹ nhàng / Trẻ)' },
  { id: 'Saira Stencil One', label: 'Saira Stencil (Phá cách / Bụi)' }
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

interface CarouselModuleProps {
  language?: string;
}

const CarouselModule: React.FC<CarouselModuleProps> = ({ language = 'vi' }) => {
  const storageKey = "carousel_project_v19_full_sync";
  const [state, setState] = useState<any>({
    category: 'Kể chuyện cá nhân',
    subCategory: 'Thành công nhiều người ngưỡng mộ',
    topic: '',
    storyIdea: '',
    imageCount: 4,
    fontFamily: 'Montserrat',
    gender: 'Nữ',
    addressing: '',
    imageStyle: 'Realistic',
    items: [],
    productFiles: [],
    productPreviews: [],
    faceFile: null,
    facePreview: null,
    extraNote: '',
    characterNote: '',
    isGeneratingScript: false
  });

  const productInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState((p: any) => ({ 
          ...p, 
          ...parsed, 
          productFiles: [], 
          productPreviews: [], 
          faceFile: null, 
          facePreview: null,
          items: (parsed.items || []).map((i: any) => ({ 
            ...i, 
            loading: false,
            textPosition: i.textPosition || 'Bottom',
            alignment: i.alignment || 'center',
            textColor: i.textColor || '#FFFFFF',
            overlayColor: i.overlayColor || '#000000',
            overlayOpacity: i.overlayOpacity !== undefined ? i.overlayOpacity : 60,
            showOverlay: i.showOverlay !== undefined ? i.showOverlay : true,
            fontSize: i.fontSize || 60
          }))
        }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const toSave = { 
      category: state.category,
      subCategory: state.subCategory,
      topic: state.topic,
      storyIdea: state.storyIdea,
      imageCount: state.imageCount,
      fontFamily: state.fontFamily,
      gender: state.gender,
      addressing: state.addressing,
      imageStyle: state.imageStyle,
      extraNote: state.extraNote,
      characterNote: state.characterNote,
      items: state.items.map((i: any) => ({
        id: i.id,
        content: i.content,
        regenerateNote: i.regenerateNote,
        textPosition: i.textPosition,
        alignment: i.alignment || 'center',
        textColor: i.textColor,
        overlayColor: i.overlayColor,
        overlayOpacity: i.overlayOpacity !== undefined ? i.overlayOpacity : 60,
        showOverlay: i.showOverlay !== undefined ? i.showOverlay : true,
        fontSize: i.fontSize,
        imageUrl: ''
      }))
    };
    try { localStorage.setItem(storageKey, JSON.stringify(toSave)); } catch (e) {}
  }, [state]);

  useEffect(() => {
    const handleExport = () => {
      const exportData = state.items.map((item: any, index: number) => ({
        stt: index + 1,
        inputs: {
          category: state.category,
          subCategory: state.subCategory,
          topic: state.topic,
          storyIdea: state.storyIdea,
          characterNote: state.characterNote,
          extraNote: state.extraNote,
          settings: {
            fontFamily: state.fontFamily,
            gender: state.gender,
            addressing: state.addressing,
            imageStyle: state.imageStyle,
            textPosition: item.textPosition,
            alignment: item.alignment,
            textColor: item.textColor,
            overlayColor: item.overlayColor,
            overlayOpacity: item.overlayOpacity !== undefined ? item.overlayOpacity : 60,
            showOverlay: item.showOverlay !== undefined ? item.showOverlay : true,
            fontSize: item.fontSize,
            customPrompt: item.regenerateNote || ''
          }
        },
        script: item.content,
        outputImage: item.imageUrl || ''
      }));

      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
        detail: { data: exportData, moduleName: 'Anh_Cuon_Carousel' } 
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
      if (!Array.isArray(importedData)) return;

      const firstItem = importedData[0];
      const inputs = smartFind(firstItem, ['inputs', 'input', 'data']) || {};
      const settings = smartFind(inputs, ['settings', 'config']) || {};

      const newState = {
        ...state,
        category: smartFind(inputs, ['category', 'danh mục']) || state.category,
        subCategory: smartFind(inputs, ['subCategory', 'chi tiết']) || state.subCategory,
        topic: smartFind(inputs, ['topic', 'chủ đề']) || state.topic,
        storyIdea: smartFind(inputs, ['storyIdea', 'ý tưởng']) || state.storyIdea,
        characterNote: smartFind(inputs, ['characterNote', 'character', 'nhân vật']) || state.characterNote,
        extraNote: smartFind(inputs, ['extraNote', 'extra', 'bối cảnh']) || state.extraNote,
        fontFamily: smartFind(settings, ['fontFamily', 'font']) || state.fontFamily,
        gender: smartFind(settings, ['gender', 'giới tính']) || state.gender,
        addressing: smartFind(settings, ['addressing', 'xưng hô']) || state.addressing,
        imageStyle: smartFind(settings, ['imageStyle']) || state.imageStyle,
        imageCount: importedData.length,
        items: []
      };

      const total = importedData.length;
      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const itemInputs = smartFind(item, ['inputs', 'input']) || {};
        const itemSettings = smartFind(itemInputs, ['settings', 'config']) || smartFind(item, ['settings', 'config']) || {};
        const itemSegmentData = smartFind(itemInputs, ['segmentData']) || {};
        
        newState.items.push({
          id: i + 1,
          content: smartFind(item, ['script', 'content', 'text']) || '',
          imageUrl: smartFind(item, ['outputImage', 'image', 'base64']) || '',
          loading: false,
          regenerateNote: smartFind(itemSettings, ['customPrompt']) || smartFind(itemSegmentData, ['characterIdea']) || '',
          textPosition: smartFind(itemSettings, ['textPosition', 'vị trí']) || 'Bottom',
          alignment: smartFind(itemSettings, ['alignment', 'căn lề']) || 'center',
          textColor: smartFind(itemSettings, ['textColor', 'màu']) || '#FFFFFF',
          overlayColor: smartFind(itemSettings, ['overlayColor', 'màu nền']) || '#000000',
          overlayOpacity: smartFind(itemSettings, ['overlayOpacity', 'độ mờ']) !== undefined ? smartFind(itemSettings, ['overlayOpacity', 'độ mờ']) : 60,
          showOverlay: smartFind(itemSettings, ['showOverlay', 'hiện lớp phủ']) !== undefined ? smartFind(itemSettings, ['showOverlay', 'hiện lớp phủ']) : true,
          fontSize: smartFind(itemSettings, ['fontSize', 'kích cỡ']) || 60
        });

        const percent = Math.round(((i + 1) / total) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent, complete: i === total - 1 } }));
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, type: 'product' | 'face') => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        const file = files[0];
        const previewUrl = URL.createObjectURL(file);
        if (type === 'product') {
            setState((p: any) => ({ ...p, productFiles: [file], productPreviews: [previewUrl] }));
        } else if (type === 'face') {
            setState((p: any) => ({ ...p, faceFile: file, facePreview: previewUrl }));
        }
    }
  };

  const handleProductFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = (Array.from(e.target.files) as File[]).slice(0, 5);
      const urls = files.map(f => URL.createObjectURL(f));
      setState((p: any) => ({ ...p, productFiles: files, productPreviews: urls }));
    }
  };

  const handleFaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setState((p: any) => ({ ...p, faceFile: file, facePreview: URL.createObjectURL(file) }));
    }
  };

  const handleGenerateScript = async () => {
    if (!state.storyIdea && !state.topic) return;
    setState((p: any) => ({ ...p, isGeneratingScript: true }));
    try {
      const res = await service.generateCarouselScript(
        state.topic || state.storyIdea, 
        state.imageCount, 
        state.extraNote, 
        state.topic, 
        state.category, 
        state.subCategory,
        state.storyIdea,
        state.gender,
        state.addressing,
        language
      );
      setState((p: any) => ({ 
        ...p, 
        items: res.map((t, i) => ({ 
          id: i + 1, 
          content: t, 
          imageUrl: '', 
          loading: false, 
          regenerateNote: '',
          textPosition: 'Bottom',
          alignment: 'center',
          textColor: '#FFFFFF',
          overlayColor: '#000000',
          overlayOpacity: 60,
          showOverlay: true,
          fontSize: 60
        })) 
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setState((p: any) => ({ ...p, isGeneratingScript: false }));
    }
  };

  const handleGenerateImage = async (id: number) => {
    const item = state.items.find((i: any) => i.id === id);
    if (!item) return;

    updateItem(id, { loading: true, error: undefined });

    try {
      const productParts = await Promise.all(state.productFiles.map((f: File) => service.fileToGenerativePart(f)));
      const facePart = state.faceFile ? await service.fileToGenerativePart(state.faceFile) : null;
      
      const url = await service.generateCarouselImage(
        productParts,
        facePart,
        item.content,
        state.characterNote,
        state.extraNote,
        item.regenerateNote,
        state.fontFamily,
        item.textPosition,
        state.gender,
        item.textColor,
        item.overlayColor,
        item.fontSize,
        state.imageStyle,
        item.alignment || 'center',
        item.showOverlay !== false,
        item.overlayOpacity !== undefined ? item.overlayOpacity : 60
      );

      updateItem(id, { loading: false, imageUrl: url });
    } catch (error) {
      updateItem(id, { loading: false, error: 'Lỗi' });
    }
  };

  const handleGenerateImagePrompt = async (id: number) => {
    const item = state.items.find((i: any) => i.id === id);
    if (!item) return;

    updateItem(id, { 
      imagePrompt: { 
        text: 'Đang tạo prompt...', 
        loading: true, 
        visible: true 
      } 
    });

    try {
      const prompt = await service.generateCarouselImagePrompt(
        item.content,
        state.characterNote,
        state.extraNote,
        item.regenerateNote,
        state.gender,
        state.imageStyle,
        item.customPrompt,
        item.textPosition,
        item.alignment,
        item.textColor,
        item.overlayColor,
        item.overlayOpacity,
        item.showOverlay,
        language
      );
      updateItem(id, { 
        imagePrompt: { 
          text: prompt, 
          loading: false, 
          visible: true 
        } 
      });
    } catch (error) {
      updateItem(id, { 
        imagePrompt: { 
          text: 'Lỗi khi tạo prompt. Vui lòng thử lại.', 
          loading: false, 
          visible: true 
        } 
      });
    }
  };

  const handleBulkImage = async () => {
    for (const item of state.items) {
      await handleGenerateImage(item.id);
    }
  };

  const handleBulkPrompt = async () => {
    for (const item of state.items) {
      await handleGenerateImagePrompt(item.id);
    }
  };

  const downloadAllPromptsTxt = () => {
    const text = state.items.map((s: any) => s.imagePrompt?.text || "").filter((t: string) => t).join('\n');
    if (!text) return alert("Vui lòng tạo Prompt Ảnh.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prompts_carousel_${Date.now()}.txt`;
    link.click();
  };

  const handleApplyStyleToAll = (style: any) => {
    setState((p: any) => ({
      ...p,
      items: p.items.map((i: any) => ({ 
        ...i, 
        textPosition: style.textPosition,
        alignment: style.alignment,
        textColor: style.textColor,
        fontSize: style.fontSize,
        overlayColor: style.overlayColor,
        overlayOpacity: style.overlayOpacity !== undefined ? style.overlayOpacity : i.overlayOpacity,
        showOverlay: style.showOverlay !== undefined ? style.showOverlay : i.showOverlay
      }))
    }));
  };

  const handleDownloadAllImages = async () => {
    if (typeof JSZip === 'undefined') {
      alert("Đang tải thư viện nén, vui lòng thử lại sau giây lát.");
      return;
    }

    const zip = new JSZip();
    let count = 0;

    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      if (item.imageUrl) {
        const base64Data = item.imageUrl.split(',')[1];
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
    link.href = URL.createObjectURL(content);
    link.download = `carousel_images_${Date.now()}.zip`;
    link.click();
  };

  const updateItem = (id: number, updates: any) => {
    setState((p:any) => ({
      ...p,
      items: p.items.map((i:any) => i.id === id ? { ...i, ...updates } : i)
    }));
  };

  const hasAnyImages = state.items.some((item: any) => item.imageUrl);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-[10px] border border-slate-200 p-8 shadow-sm mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-6">
          
          {/* CỘT TRÁI: DANH MỤC, Ý TƯỞNG, NHÂN VẬT */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">1. Danh mục (Category):</label>
                <select 
                  value={state.category} 
                  onChange={e => setState((p:any)=>({...p, category: e.target.value, subCategory: CAROUSEL_CATEGORIES[e.target.value][0] || ''}))}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-[10px] text-sm font-medium outline-none focus:border-blue-500 transition-all shadow-sm"
                >
                  {Object.keys(CAROUSEL_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={`space-y-1.5 ${CAROUSEL_CATEGORIES[state.category].length === 0 ? 'invisible' : ''}`}>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">2. Nội dung (Details):</label>
                <select 
                  value={state.subCategory} 
                  onChange={e => setState((p:any)=>({...p, subCategory: e.target.value}))}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-[10px] text-sm font-medium outline-none focus:border-blue-500 transition-all shadow-sm"
                >
                  {CAROUSEL_CATEGORIES[state.category].map(sc => <option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">3. Ý tưởng câu chuyện / Chủ đề:</label>
              <textarea 
                value={state.storyIdea} 
                onChange={e => setState((p:any)=>({...p, storyIdea: e.target.value}))}
                placeholder="Ví dụ: 100 lần thử thách bán hàng nhưng thất bại..."
                className="w-full h-32 p-4 border border-slate-200 rounded-[10px] text-sm font-medium focus:border-blue-500 outline-none transition-all resize-none bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">4. Ảnh khuôn mặt (Face Ref):</label>
              <div 
                onClick={() => faceInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'face')}
                className="w-full h-32 border-2 border-dashed border-slate-200 rounded-[10px] flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all bg-slate-50/30 group"
              >
                {state.facePreview ? (
                  <img src={state.facePreview} className="h-full object-contain p-2" />
                ) : (
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-slate-400">Tải Ảnh Khuôn Mặt</span>
                )}
                <input type="file" ref={faceInputRef} onChange={handleFaceFile} className="hidden" accept="image/*" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1 text-blue-600">5. Mô tả nhân vật:</label>
              <textarea 
                value={state.characterNote} 
                onChange={e => setState((p:any)=>({...p, characterNote: e.target.value}))}
                placeholder="Ví dụ: Nữ, 25 tuổi, phong cách năng động, mặc áo phông trắng..."
                className="w-full h-24 p-3.5 border border-slate-200 rounded-[10px] text-sm font-medium focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* CỘT PHẢI: SẢN PHẨM, CẤU HÌNH, VỊ TRÍ CHỮ */}
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">6. Ảnh sản phẩm:</label>
              <div 
                onClick={() => productInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'product')}
                className="w-full h-32 border-2 border-dashed border-slate-200 rounded-[10px] flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all bg-slate-50/30 group"
              >
                {state.productPreviews.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2 p-3 w-full h-full">
                    {state.productPreviews.map((url: string, i: number) => (
                      <img key={i} src={url} className="w-full h-full object-cover rounded-[5px]" />
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-slate-400">Tải Ảnh Sản Phẩm</span>
                )}
                <input type="file" ref={productInputRef} multiple onChange={handleProductFiles} className="hidden" accept="image/*" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">7. Giới tính:</label>
                  <select 
                    value={state.gender} 
                    onChange={e => setState((p:any)=>({...p, gender: e.target.value}))}
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-[10px] text-sm font-bold outline-none focus:border-blue-500 shadow-sm"
                  >
                    <option value="Nữ">Nữ</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">8. Cách xưng hô:</label>
                <div className="relative group">
                  <input 
                    list="carousel-addressing-list"
                    value={state.addressing} 
                    onChange={e => setState((p:any)=>({...p, addressing: e.target.value}))}
                    placeholder="Chọn hoặc tự nhập"
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-[10px] text-sm font-bold outline-none focus:border-blue-500 shadow-sm"
                  />
                  <datalist id="carousel-addressing-list">
                    {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">9. Số Slide:</label>
                <select 
                  value={state.imageCount} 
                  onChange={e => setState((p:any)=>({...p, imageCount: parseInt(e.target.value)}))}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-[10px] text-sm font-medium outline-none focus:border-blue-500 transition-all shadow-sm"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} Slides</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">10. Phong cách ảnh:</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setState((p:any)=>({...p, imageStyle: 'Realistic'}))}
                    style={state.imageStyle === 'Realistic' ? { backgroundColor: 'var(--primary-color)' } : {}}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === 'Realistic' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Chân thực
                  </button>
                  <button 
                    onClick={() => setState((p:any)=>({...p, imageStyle: '3D'}))}
                    style={state.imageStyle === '3D' ? { backgroundColor: 'var(--primary-color)' } : {}}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === '3D' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    3D Animation
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">11. Ghi chú bối cảnh:</label>
                <input 
                  type="text" 
                  value={state.extraNote} 
                  onChange={e => setState((p:any)=>({...p, extraNote: e.target.value}))}
                  placeholder="Quán cafe, ngoài trời..."
                  className="w-full p-3.5 border border-slate-200 rounded-[10px] text-sm font-medium focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">12. Font chữ nghệ thuật (Dự án):</label>
                <select 
                  value={state.fontFamily} 
                  onChange={e => setState((p:any)=>({...p, fontFamily: e.target.value}))}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-[10px] text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm focus:ring-1 focus:ring-blue-200"
                  style={{ fontFamily: state.fontFamily }}
                >
                  {FONTS.map(f => (
                    <option key={f.id} value={f.id} style={{ fontFamily: f.id }}>
                      {f.label}
                    </option>
                  ))}
                </select>
                
                <div className="mt-2 p-4 bg-slate-50 border border-slate-100 rounded-[12px] flex items-center justify-center min-h-[60px] overflow-hidden">
                  <span className="text-lg font-black text-center text-slate-800 transition-all duration-300" style={{ fontFamily: state.fontFamily }}>
                    AaBbCc — Cộng đồng Affiliate AI: Kịch bản & Hình ảnh đỉnh cao
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 pt-4">
              <button 
                onClick={handleGenerateScript} 
                disabled={state.isGeneratingScript || (!state.topic && !state.storyIdea)}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full py-5 text-white font-black rounded-[10px] text-base shadow-xl transition-all disabled:opacity-50 uppercase tracking-widest active:scale-[0.98]"
              >
                {state.isGeneratingScript ? "Đang xử lý kịch bản..." : "Tạo Kịch Bản Nội Dung"}
              </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {state.items.map((item: any) => (
          <CarouselCard 
            key={item.id} 
            item={item} 
            language={language}
            onTextChange={(id, text) => updateItem(id, { content: text })}
            onGenerate={(id) => handleGenerateImage(id)}
            onRegenerate={(id) => handleGenerateImage(id)}
            onNoteChange={(id, text) => updateItem(id, { regenerateNote: text })}
            onPositionChange={(id, pos) => updateItem(id, { textPosition: pos })}
            onAlignmentChange={(id, align) => updateItem(id, { alignment: align })}
            onColorChange={(id, color) => updateItem(id, { textColor: color })}
            onOverlayColorChange={(id, color) => updateItem(id, { overlayColor: color })}
            onOverlayOpacityChange={(id, opacity) => updateItem(id, { overlayOpacity: opacity })}
            onToggleOverlay={(id, show) => updateItem(id, { showOverlay: show })}
            onApplyStyleToAll={(style) => handleApplyStyleToAll(style)}
            onFontSizeChange={(id, size) => updateItem(id, { fontSize: size })}
            onGenerateImagePrompt={(id) => handleGenerateImagePrompt(id)}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-12 py-12 border-t border-slate-200 mt-12">
          <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button
                  onClick={handleBulkImage}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className={`w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest`}
              >
                  Vẽ tất cả ảnh
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
              </button>
              <button
                  onClick={handleBulkPrompt}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className={`w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest`}
              >
                  Tạo tất cả Prompt ảnh
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
              {hasAnyImages && (
                <button
                  onClick={handleDownloadAllImages}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className={`w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Tải Ảnh (ZIP)
                </button>
              )}
              {state.items.some((i: any) => i.imagePrompt?.text) && (
                <button
                  onClick={downloadAllPromptsTxt}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className={`w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Tải Prompt Ảnh (.txt)
                </button>
              )}
          </div>
      </div>
    </div>
  );
};

export default CarouselModule;