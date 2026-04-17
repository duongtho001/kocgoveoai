
import React, { useState, useEffect, useRef } from 'react';
import * as service from '../services/personification2Service';
import { Personification2Segment, AnalyzedCharacter } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { safeSaveToLocalStorage } from '../utils/storage';
import { theme } from '../constants/colors';

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

const SCENE_COUNT_OPTIONS = Array.from({ length: 21 }, (_, i) => {
    const count = i + 3;
    const seconds = count * 8;
    return { count, label: `${count} cảnh - ${seconds}s` };
});

interface Props {
  language?: string;
}

const Personification2Module: React.FC<Props> = ({ language = 'vi' }) => {
  const storageKey = "personification2_v22_final_limits";
  const [originalScript, setOriginalScript] = useState('');
  const [gender, setGender] = useState('Nữ');
  const [voice, setVoice] = useState(VOICE_OPTIONS[0]);
  const [addressing, setAddressing] = useState('');
  const [imageStyle, setImageStyle] = useState<'Realistic' | '3D'>('Realistic');
  const [personDescription, setPersonDescription] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [sceneCount, setSceneCount] = useState(5);
  const [analyzedCharacters, setAnalyzedCharacters] = useState<AnalyzedCharacter[]>([]);
  const [personPreviews, setPersonPreviews] = useState<string[]>([]);
  const [productPreviews, setProductPreviews] = useState<string[]>([]);
  const [isAnalyzingPerson, setIsAnalyzingPerson] = useState(false);
  const [isPersonified, setIsPersonified] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<Personification2Segment[]>([]);

  const localJsonRef = useRef<HTMLInputElement>(null);
  const segmentFileInputRef = useRef<HTMLInputElement>(null);
  const personInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const [activeSegmentForUpload, setActiveSegmentForUpload] = useState<number | null>(null);
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

  // Khôi phục dữ liệu từ LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOriginalScript(parsed.originalScript || '');
        setGender(parsed.gender || 'Nữ');
        setVoice(parsed.voice || VOICE_OPTIONS[0]);
        setAddressing(parsed.addressing || '');
        setImageStyle(parsed.imageStyle || 'Realistic');
        setPersonDescription(parsed.personDescription || '');
        setContextNote(parsed.contextNote || '');
        setSceneCount(parsed.sceneCount || 5);
        setAnalyzedCharacters(parsed.analyzedCharacters || []);
        setPersonPreviews(parsed.personPreviews || []);
        setProductPreviews(parsed.productPreviews || []);
        setIsPersonified(parsed.isPersonified !== undefined ? parsed.isPersonified : true);
        setSegments((parsed.segments || []).map((s: any) => ({
          ...s,
          speaker: s.speaker || 'Object',
          image: { ...s.image, url: s.image?.url || '', loading: false },
          imagePrompt: { ...s.imagePrompt, loading: false },
          videoPrompt: { ...s.videoPrompt, loading: false }
        })));
      } catch (e) {}
    }
  }, []);

  // Đồng bộ dữ liệu vào LocalStorage
  useEffect(() => {
    const toSave = { 
      originalScript, 
      gender, 
      voice, 
      addressing, 
      imageStyle,
      personDescription,
      contextNote,
      sceneCount,
      analyzedCharacters,
      personPreviews,
      productPreviews,
      isPersonified,
      segments: segments.map(s => ({ 
        ...s, 
        image: { ...s.image, loading: false },
        videoPrompt: { ...s.videoPrompt, loading: false }
      })) 
    };
    safeSaveToLocalStorage(storageKey, toSave);
  }, [originalScript, gender, voice, addressing, imageStyle, personDescription, contextNote, sceneCount, analyzedCharacters, personPreviews, productPreviews, isPersonified, segments]);

  const processImportData = async (importedData: any) => {
    try {
      if (!Array.isArray(importedData) || importedData.length === 0) {
        throw new Error("Dữ liệu JSON không hợp lệ.");
      }
      
      window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 10, complete: false } }));

      const firstItem = importedData[0] || {};
      const inputs = firstItem.inputs || {};
      const settings = inputs.settings || {};

      setOriginalScript(inputs.originalScript || '');
      setPersonDescription(inputs.personDescription || '');
      setContextNote(inputs.contextNote || '');
      setSceneCount(inputs.sceneCount || importedData.length);
      setAnalyzedCharacters(inputs.analyzedCharacters || []);
      setPersonPreviews(inputs.personPreviews || []);
      setProductPreviews(inputs.productPreviews || []);
      setGender(settings.gender || 'Nữ');
      setVoice(settings.voice || VOICE_OPTIONS[0]);
      setAddressing(settings.addressing || '');
      setImageStyle(settings.imageStyle || 'Realistic');
      setIsPersonified(settings.isPersonified !== undefined ? settings.isPersonified : true);

      const newSegments: Personification2Segment[] = [];
      for (let i = 0; i < importedData.length; i++) {
        const item = importedData[i];
        if (!item) continue;
        const itemInputs = item.inputs || {};
        const segData = itemInputs.segmentData || {};
        
        newSegments.push({
          id: i + 1,
          content: item.script || '',
          characterIdea: segData.characterIdea || '',
          speaker: segData.speaker || 'Object',
          image: { url: item.outputImage || '', loading: false },
          imagePrompt: { text: item.imagePrompt || '', loading: false, visible: !!item.imagePrompt },
          videoPrompt: { text: item.videoPrompt || '', loading: false, visible: !!item.videoPrompt }
        });

        const percent = Math.round(((i + 1) / importedData.length) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent, complete: i === importedData.length - 1 } }));
        await new Promise(r => setTimeout(r, 20));
      }
      setSegments(newSegments);
    } catch (error: any) {
      alert("Lỗi khi nạp dự án!");
      window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 100, complete: true } }));
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

  useEffect(() => {
    const handleGlobalExport = async () => {
      const personBase64 = await Promise.all(personPreviews.map(url => toBase64(url)));
      const productBase64 = await Promise.all(productPreviews.map(url => toBase64(url)));

      const exportData = await Promise.all(segments.map(async (seg, index) => {
        const outputImageBase64 = await toBase64(seg.image?.url);
        return {
          stt: index + 1,
          inputs: {
            originalScript,
            personDescription,
            contextNote,
            sceneCount,
            analyzedCharacters,
            personPreviews: personBase64,
            productPreviews: productBase64,
            settings: { gender, voice, addressing, imageStyle, isPersonified },
            segmentData: { characterIdea: seg.characterIdea, speaker: seg.speaker }
          },
          script: seg.content,
          outputImage: outputImageBase64,
          imagePrompt: seg.imagePrompt?.text || '',
          videoPrompt: seg.videoPrompt?.text || ''
        };
      }));
      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { detail: { data: exportData, moduleName: 'Nhan_Hoa_2_Project' } }));
    };
    const handleGlobalImport = (e: any) => processImportData(e.detail);
    window.addEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    };
  }, [segments, originalScript, gender, voice, addressing, imageStyle, personDescription, contextNote, sceneCount, analyzedCharacters, personPreviews, productPreviews, isPersonified]);

  const handleLocalExportJson = async () => {
    const personBase64 = await Promise.all(personPreviews.map(url => toBase64(url)));
    const productBase64 = await Promise.all(productPreviews.map(url => toBase64(url)));

    const exportData = await Promise.all(segments.map(async (seg, index) => {
      const outputImageBase64 = await toBase64(seg.image?.url);
      return {
        stt: index + 1,
        inputs: {
          originalScript,
          personDescription,
          contextNote,
          sceneCount,
          analyzedCharacters,
          personPreviews: personBase64,
          productPreviews: productBase64,
          settings: { gender, voice, addressing, imageStyle, isPersonified },
          segmentData: { characterIdea: seg.characterIdea, speaker: seg.speaker }
        },
        script: seg.content,
        outputImage: outputImageBase64,
        imagePrompt: seg.imagePrompt?.text || '',
        videoPrompt: seg.videoPrompt?.text || ''
      };
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nhan_Hoa_BETA_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSplitScript = async () => {
    if (!originalScript.trim()) return;
    setIsProcessing(true);
    try {
      const splitTexts = await service.splitScriptIntoSegments(originalScript, voice, addressing, sceneCount, language);
      setSegments(splitTexts.map((text, i) => ({
        id: i + 1,
        content: text,
        characterIdea: '',
        speaker: 'Object',
        image: { url: '', loading: false },
        imagePrompt: { text: '', loading: false, visible: false },
        videoPrompt: { text: '', loading: false, visible: false }
      })));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzePerson = async () => {
    if (!personDescription.trim()) return;
    setIsAnalyzingPerson(true);
    try {
      const characters = await service.analyzePersonDescription(personDescription, language);
      setAnalyzedCharacters(characters);
    } finally {
      setIsAnalyzingPerson(false);
    }
  };

  const handleDeleteCharacter = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setAnalyzedCharacters(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePersonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const readers = Array.from(files as FileList).slice(0, 2).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
      });
      Promise.all(readers).then(urls => {
        setPersonPreviews(prev => [...prev, ...urls].slice(0, 2));
      });
    }
    e.target.value = "";
  };

  const removePersonPreview = (idx: number) => {
    setPersonPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const readers = Array.from(files as FileList).slice(0, 3).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
      });
      Promise.all(readers).then(urls => {
        setProductPreviews(prev => [...prev, ...urls].slice(0, 3));
      });
    }
    e.target.value = "";
  };

  const removeProductPreview = (idx: number) => {
    setProductPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenImage = async (id: number) => {
    const seg = segments.find(s => s.id === id);
    if (!seg) return;
    setSegments(prev => prev.map(s => s.id === id ? { ...s, image: { ...s.image, loading: true } } : s));
    try {
      const personParts = personPreviews.map(url => ({
        mimeType: 'image/png',
        data: url.split(',')[1]
      }));

      const productParts = productPreviews.map(url => ({
        mimeType: 'image/png',
        data: url.split(',')[1]
      }));

      const url = await service.generatePersonifiedImage(
        seg.content, 
        seg.characterIdea, 
        gender, 
        imageStyle, 
        personDescription, 
        isPersonified, 
        seg.speaker, 
        personParts,
        contextNote,
        productParts,
        language
      );
      setSegments(prev => prev.map(s => s.id === id ? { ...s, image: { ...s.image, url, loading: false } } : s));
    } catch (e) {
      setSegments(prev => prev.map(s => s.id === id ? { ...s, image: { ...s.image, loading: false, error: 'Lỗi' } } : s));
    }
  };

  const handleGenImagePrompt = async (id: number) => {
    const seg = segments.find(s => s.id === id);
    if (!seg) return;
    setSegments(prev => prev.map(s => s.id === id ? { ...s, imagePrompt: { ...s.imagePrompt, loading: true, visible: true } } : s));
    try {
      const prompt = await service.generatePersonification2ImagePromptAI(
        seg.content,
        seg.characterIdea,
        gender,
        imageStyle,
        personDescription,
        isPersonified,
        seg.speaker,
        contextNote,
        "",
        language
      );
      setSegments(prev => prev.map(s => s.id === id ? { ...s, imagePrompt: { text: prompt, loading: false, visible: true } } : s));
    } catch (e) {
      setSegments(prev => prev.map(s => s.id === id ? { ...s, imagePrompt: { ...s.imagePrompt, loading: false } } : s));
    }
  };

  const handleGenPrompt = async (id: number) => {
    const seg = segments.find(s => s.id === id);
    if (!seg) return;
    setSegments(prev => prev.map(s => s.id === id ? { ...s, videoPrompt: { ...s.videoPrompt, loading: true, visible: true } } : s));
    try {
      const prompt = await service.generateVideoPromptV2(
        seg.content, 
        seg.characterIdea, 
        gender, 
        voice, 
        imageStyle, 
        personDescription, 
        isPersonified, 
        seg.speaker,
        seg.image.url,
        language
      );
      setSegments(prev => prev.map(s => s.id === id ? { ...s, videoPrompt: { text: prompt, loading: false, visible: true } } : s));
    } catch (e) {
      setSegments(prev => prev.map(s => s.id === id ? { ...s, videoPrompt: { ...s.videoPrompt, loading: false } } : s));
    }
  };

  const handleDeleteImage = (id: number) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, image: { ...s.image, url: '', loading: false } } : s));
  };

  const handleBulkImage = async () => {
    for (const s of segments) await handleGenImage(s.id);
  };

  const handleBulkImagePrompt = async () => {
    for (const s of segments) {
      await handleGenImagePrompt(s.id);
    }
  };

  const handleBulkVideoPrompt = async () => {
    for (const s of segments) {
      await handleGenPrompt(s.id);
    }
  };

  const downloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') return alert("ZIP Lib error");
    const zip = new JSZip();
    let count = 0;
    segments.forEach((s, i) => {
      if (s.image.url) {
        zip.file(`${String(i + 1).padStart(2, '0')}.png`, s.image.url.split(',')[1], { base64: true });
        count++;
      }
    });
    if (count === 0) return alert("Không có ảnh để tải");
    // Comment: Explicitly cast zip output to any to handle unknown type error from JSZip.generateAsync
    const content = (await zip.generateAsync({ type: "blob" })) as any; 
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `nhan_hoa_2_images.zip`;
    link.click();
  };

  const downloadAllVideoPromptsTxt = () => {
    const text = segments.map((s: any) => s.videoPrompt?.text || "").filter((t: string) => t).join('\n');
    if (!text) return alert("Vui lòng tạo Video Prompt.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `video_prompts_nhan_hoa_2_${Date.now()}.txt`; link.click();
  };

  const downloadAllImagePromptsTxt = () => {
    const text = segments.map((s: any) => s.imagePrompt?.text || "").filter((t: string) => t).join('\n');
    if (!text) return alert("Vui lòng tạo Image Prompt.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `image_prompts_nhan_hoa_2_${Date.now()}.txt`; link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <input type="file" ref={segmentFileInputRef} className="hidden" accept="image/*" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && activeSegmentForUpload !== null) {
          const reader = new FileReader();
          reader.onload = (event) => setSegments(prev => prev.map(s => s.id === activeSegmentForUpload ? { ...s, image: { ...s.image, url: event.target?.result as string, loading: false } } : s));
          reader.readAsDataURL(file);
        }
        e.target.value = "";
      }} />

      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm mb-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center px-1">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Kịch bản văn bản gốc</label>
             <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Nhân hóa 2.0 (Hybrid Mode)</span>
          </div>
          <textarea 
            value={originalScript}
            onChange={e => setOriginalScript(e.target.value)}
            placeholder="Dán kịch bản của bạn vào đây..."
            className="w-full h-32 p-5 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-2 focus:ring-orange-100 outline-none transition-all font-medium text-sm leading-relaxed resize-none"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1">Giới tính</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-orange-500">
                <option value="Nữ">Nữ</option>
                <option value="Nam">Nam</option>
              </select>
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1">Vùng miền</label>
              <select value={voice} onChange={e => setVoice(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-orange-500">
                {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1">Xưng hô</label>
              <input 
                list="nhanhoa2-addr-list"
                value={addressing} 
                onChange={e => setAddressing(e.target.value)}
                placeholder="VD: em - anh chị"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-orange-500 text-sm"
              />
              <datalist id="nhanhoa2-addr-list">
                {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
              </datalist>
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1">Số cảnh & Thời lượng</label>
              <select 
                value={sceneCount} 
                onChange={e => setSceneCount(parseInt(e.target.value))} 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-orange-600 outline-none focus:border-orange-500"
              >
                {SCENE_COUNT_OPTIONS.map(opt => <option key={opt.count} value={opt.count}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-9 space-y-1.5">
                    <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest px-1">Những người xuất hiện (Chỉ lấy tên để gán lời thoại)</label>
                    <input 
                        type="text"
                        value={personDescription}
                        onChange={e => setPersonDescription(e.target.value)}
                        placeholder="VD: Một cô Vy và một anh shipper..."
                        className="w-full p-4 bg-orange-50/30 border border-orange-100 rounded-2xl focus:ring-2 focus:ring-orange-100 outline-none transition-all font-bold text-sm"
                    />
                </div>
                <div className="md:col-span-3">
                    <button 
                        onClick={handleAnalyzePerson}
                        disabled={isAnalyzingPerson || !personDescription.trim()}
                        style={{ backgroundColor: 'var(--primary-color)' }}
                        className="w-full py-4 text-white font-black rounded-2xl shadow-lg transition-all uppercase text-[10px] tracking-widest disabled:opacity-50 hover:opacity-90"
                    >
                        {isAnalyzingPerson ? "ĐANG LẤY TÊN..." : "XÁC NHẬN NHÂN VẬT"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 px-1">Phong cách bối cảnh</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 h-[46px]">
                        <button onClick={() => setImageStyle('Realistic')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${imageStyle === 'Realistic' ? `${theme.colors.buttonPrimary} text-white shadow-md` : 'text-slate-400 hover:text-slate-600'}`}>Chân thực</button>
                        <button onClick={() => setImageStyle('3D')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${imageStyle === '3D' ? `${theme.colors.buttonPrimary} text-white shadow-md` : 'text-slate-400 hover:text-slate-600'}`}>3D</button>
                    </div>
                </div>
                <div className="space-y-1.5">
                    {analyzedCharacters.length > 0 && (
                        <div className="w-full p-3 bg-orange-50 border border-orange-100 rounded-xl animate-fadeIn">
                            <span className="text-[9px] font-black text-orange-700 uppercase px-1">Danh sách nhân vật:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {analyzedCharacters.map((c, idx) => (
                                    <div key={`${c.name}-${idx}`} className="group relative flex items-center bg-white border border-orange-200 px-3 py-1.5 rounded-full shadow-sm hover:border-orange-300 transition-all">
                                        <span className="text-[10px] text-orange-800 font-bold uppercase">{c.name}</span>
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCharacter(e, idx); }}
                                            className="ml-2 w-5 h-5 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all text-[10px] cursor-pointer"
                                            title="Xóa nhân vật"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ảnh nhân vật mẫu (BẮT BUỘC)</label>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Tải lên 1-2 ảnh mẫu</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {personPreviews.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group">
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button onClick={() => removePersonPreview(i)} className={`absolute top-2 right-2 ${theme.colors.buttonDanger} p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {personPreviews.length < 2 && (
                                <div 
                                    onClick={() => personInputRef.current?.click()}
                                    className="aspect-square border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-white cursor-pointer hover:border-orange-400 transition-all group"
                                >
                                    <svg className="w-6 h-6 text-slate-300 group-hover:text-orange-400" fill="none" stroke="currentColor" viewBox="0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                                    <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">THÊM ẢNH</span>
                                </div>
                            )}
                        </div>
                        <input type="file" multiple ref={personInputRef} className="hidden" accept="image/*" onChange={handlePersonFileChange} />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-[#ff5722] uppercase tracking-widest">Ảnh sản phẩm tham chiếu</label>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Tải lên tối đa 3 ảnh</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {productPreviews.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group">
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button onClick={() => removeProductPreview(i)} className={`absolute top-2 right-2 ${theme.colors.buttonDanger} p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {productPreviews.length < 3 && (
                                <div 
                                    onClick={() => productInputRef.current?.click()}
                                    className="aspect-square border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-white cursor-pointer hover:border-[#ff5722]/40 transition-all group"
                                >
                                    <svg className="w-6 h-6 text-slate-300 group-hover:text-[#ff5722]" fill="none" stroke="currentColor" viewBox="0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                                    <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">THÊM ẢNH</span>
                                </div>
                            )}
                        </div>
                        <input type="file" multiple ref={productInputRef} className="hidden" accept="image/*" onChange={handleProductFileChange} />
                    </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-200 pt-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Ghi chú bối cảnh chung (Cho tất cả các cảnh)</label>
                    <textarea 
                        value={contextNote}
                        onChange={e => setContextNote(e.target.value)}
                        placeholder="VD: Trong quán cà phê hiện đại, ánh sáng ấm, phong cách vintage..."
                        className="w-full h-20 p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-100 outline-none transition-all text-xs font-medium resize-none leading-relaxed shadow-sm"
                    />
                </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-100 mt-4">
            <button 
              onClick={handleSplitScript}
              disabled={isProcessing || !originalScript.trim()}
              style={{ backgroundColor: 'var(--primary-color)' }}
              className="w-full sm:w-auto px-12 py-4 text-white font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest disabled:opacity-50 text-sm"
            >
              {isProcessing ? "ĐANG TRIỂN KHAI..." : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}
            </button>

            <div className="flex items-center gap-3 px-1">
                 <div className="text-right">
                    <span className={`text-[10px] font-black uppercase block leading-tight transition-colors ${isPersonified ? 'text-orange-600' : 'text-slate-400'}`}>Nhân hóa vật thể</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Tắt = Xóa vật thể</span>
                 </div>
                 <button onClick={() => setIsPersonified(!isPersonified)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${isPersonified ? 'bg-orange-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${isPersonified ? 'translate-x-7' : 'translate-x-0'}`}></div>
                 </button>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 italic px-1">* Ngoại hình nhân vật sẽ được khóa theo ảnh mẫu sếp tải lên.</p>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="space-y-12 pb-32">
          <div className={`${theme.colors.buttonSecondary} p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6`}>
              <div className="text-center md:text-left">
                  <h3 className="text-white font-black text-lg uppercase tracking-tight">Kịch bản chi tiết ({segments.length} cảnh)</h3>
                  <p className="text-[10px] text-orange-500 font-bold uppercase mt-1">Cài đặt: {isPersonified ? 'Có nhân hóa' : 'Ẩn vật thể'}</p>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {segments.map((seg) => {
              const charCount = seg.content.length;
              const isValid = charCount >= 140 && charCount <= 180;
              const isTooLong = charCount > 180;
              const isTooShort = charCount > 0 && charCount < 140;

              return (
                <div key={seg.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full group hover:shadow-xl transition-all">
                  <div className="relative aspect-[9/16] bg-slate-100">
                    {seg.image.url ? (
                      <>
                        <img src={seg.image.url} className="w-full h-full object-cover" />
                        <button onClick={() => handleDeleteImage(seg.id)} className={`absolute top-4 right-4 w-8 h-8 ${theme.colors.buttonDanger} rounded-full flex items-center justify-center shadow-lg transition-all z-10`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <button onClick={() => { setActiveSegmentForUpload(seg.id); segmentFileInputRef.current?.click(); }} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-300 transition-all uppercase">Tải ảnh lên</button>
                      </div>
                    )}
                    {seg.image.loading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 backdrop-blur-sm z-20">
                        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="mt-4 text-[10px] font-black text-orange-600 uppercase">Đang vẽ...</span>
                      </div>
                    )}
                    <div className={`absolute top-4 left-4 ${theme.colors.buttonSecondary} opacity-80 backdrop-blur-md text-white text-[10px] font-black px-4 py-2 rounded-full`}>#{seg.id}</div>
                  </div>

                  <div className="p-6 space-y-4 flex flex-col flex-1">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center px-1">
                         <label className={`text-[9px] font-black ${theme.colors.primaryText} uppercase`}>Lời thoại {seg.id}:</label>
                         <span className={`text-[10px] px-2 py-0.5 rounded-full font-black tabular-nums transition-all ${
                            isValid 
                            ? 'bg-green-100 text-green-700' 
                            : isTooLong || isTooShort 
                                ? 'bg-orange-100 text-orange-600 animate-pulse' 
                                : 'bg-slate-100 text-slate-500'
                          }`}>
                            {charCount}/180
                         </span>
                      </div>
                      <textarea value={seg.content} onChange={e => setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, content: e.target.value } : s))} className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white resize-none" />
                      {!isValid && charCount > 0 && (
                        <p className="text-[8px] font-bold text-orange-500 uppercase px-1 mt-1">trên 180 những dưới 190 ký tự vẫn OK</p>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-orange-600 uppercase px-1">Ghi chú để tạo ảnh:</label>
                          <textarea 
                          value={seg.characterIdea} 
                          onChange={e => setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, characterIdea: e.target.value } : s))} 
                          placeholder="Miếng sườn có tay chân, bối cảnh..." 
                          className="w-full h-16 p-3 border border-orange-100 bg-orange-50/50 rounded-2xl text-[11px] font-medium outline-none focus:bg-white resize-none" 
                          />
                      </div>

                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-orange-600 uppercase px-1">Ai đang nói?</label>
                          <select 
                              value={seg.speaker} 
                              onChange={e => setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, speaker: e.target.value } : s))}
                              className="w-full p-2.5 bg-orange-50 border border-orange-100 rounded-xl text-[10px] font-black outline-none uppercase text-orange-700"
                          >
                              <option value="Object">Vật thể nhân hóa</option>
                              {analyzedCharacters.map((char, idx) => (
                                <option key={`${char.name}-${idx}`} value={char.name}>{char.name}</option>
                              ))}
                          </select>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleGenImage(seg.id)} 
                          disabled={seg.image.loading} 
                          style={{ backgroundColor: 'var(--primary-color)' }}
                          className="py-3 text-white text-[10px] font-black rounded-xl uppercase transition-all flex items-center justify-center gap-2"
                        >
                          {seg.image.loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                          Vẽ ảnh
                        </button>
                        <button 
                          onClick={() => handleGenImagePrompt(seg.id)} 
                          disabled={seg.imagePrompt.loading} 
                          style={{ backgroundColor: 'var(--primary-color)' }}
                          className="py-3 text-white text-[10px] font-black rounded-xl uppercase border border-orange-100 flex items-center justify-center gap-2"
                        >
                          {seg.imagePrompt.loading && <div className="w-3 h-3 border-orange-700/30 border-t-orange-700 rounded-full animate-spin" />}
                          Prompt Ảnh
                        </button>
                      </div>
                      <button 
                        onClick={() => handleGenPrompt(seg.id)} 
                        disabled={seg.videoPrompt.loading} 
                        style={{ backgroundColor: 'var(--primary-color)' }}
                        className="w-full py-3 text-white text-[10px] font-black rounded-xl uppercase border border-slate-700 flex items-center justify-center gap-2"
                      >
                        {seg.videoPrompt.loading && <div className="w-3 h-3 border-orange-700/30 border-t-orange-700 rounded-full animate-spin" />}
                        Prompt Video
                      </button>
                    </div>
                  </div>

                  {seg.imagePrompt.visible && (
                    <div className="p-4 bg-orange-900 border-t border-orange-800 animate-slideUp">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[8px] font-black text-orange-300 uppercase">Image Prompt Ready</span>
                        <button 
                          onClick={() => handleCopy(seg.imagePrompt.text, `img-seg-${seg.id}`)} 
                          className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`img-seg-${seg.id}`] ? 'text-green-400' : 'text-white underline'}`}
                        >
                          {copyStatus[`img-seg-${seg.id}`] ? 'COPIED!' : 'Copy'}
                        </button>
                      </div>
                      {seg.imagePrompt.loading ? (
                        <div className="h-24 flex items-center justify-center bg-orange-950 rounded border border-orange-800">
                          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        <textarea 
                          readOnly 
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                          className="w-full h-24 bg-orange-950 text-orange-100 text-[9px] p-2 rounded border border-orange-800 focus:outline-none resize-none font-mono italic opacity-80 leading-snug"
                          value={seg.imagePrompt.text}
                        />
                      )}
                    </div>
                  )}

                  {seg.videoPrompt.visible && (
                    <div className={`p-4 ${theme.colors.buttonSecondary} border-t border-slate-800 animate-slideUp`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[8px] font-black text-orange-500 uppercase">Prompt Ready</span>
                        <button 
                          onClick={() => handleCopy(seg.videoPrompt.text, `seg-${seg.id}`)} 
                          className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`seg-${seg.id}`] ? 'text-green-400' : 'text-white underline'}`}
                        >
                          {copyStatus[`seg-${seg.id}`] ? 'COPIED!' : 'Copy'}
                        </button>
                      </div>
                      {seg.videoPrompt.loading ? (
                        <div className="h-24 flex items-center justify-center bg-slate-950 rounded border border-slate-800">
                          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
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
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-12 py-12 border-t border-slate-200 mt-12">
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center px-4">
              <button
                onClick={handleBulkImage}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest text-white"
              >
                Vẽ tất cả ảnh
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
              </button>
              <button
                onClick={handleBulkImagePrompt}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                Tạo tất cả Prompt ảnh
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
              <button
                onClick={handleBulkVideoPrompt}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                Tạo tất cả Prompt video
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
              </button>
            </div>

            {segments.some(s => s.image.url || s.videoPrompt.text) && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                <button
                  onClick={downloadAllImagesZip}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải Ảnh (ZIP)
                </button>
                <button
                  onClick={() => { const text = segments.map(s => s.imagePrompt.text).filter(t => t).join('\n'); const blob = new Blob([text], { type: 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'image_prompts.txt'; link.click(); }}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Tải Prompt Ảnh (.txt)
                </button>
              <button
                onClick={() => { const text = segments.map(s => s.videoPrompt.text).filter(t => t).join('\n'); const blob = new Blob([text], { type: 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'video_prompts.txt'; link.click(); }}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-5 font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Tải Video Prompt (.txt)
              </button>
              </div>
            )}
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full pt-12 border-t border-slate-100">
               <button onClick={() => localJsonRef.current?.click()} className="w-full md:w-auto px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl border border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest shadow-sm">Tải Dự Án (JSON)</button>
               <input type="file" ref={localJsonRef} onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => processImportData(JSON.parse(event.target?.result as string)); reader.readAsText(file); } e.target.value = ""; }} className="hidden" accept="application/json" />
               <button onClick={handleLocalExportJson} style={{ backgroundColor: 'var(--primary-color)' }} className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl border border-orange-100 hover:bg-orange-100 transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest shadow-sm">Lưu Dự Án (JSON)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Personification2Module;
