
import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/timelapseService';
import { TimelapseSegment, TimelapseContext } from '../types';
import { copyToClipboard } from '../utils/clipboard';

declare var JSZip: any;

const DURATION_OPTIONS = [
  { scenes: 3, label: '3 cảnh - 24s' },
  { scenes: 4, label: '4 cảnh - 32s' },
  { scenes: 5, label: '5 cảnh - 40s' },
  { scenes: 6, label: '6 cảnh - 48s' },
  { scenes: 7, label: '7 cảnh - 56s' },
  { scenes: 8, label: '8 cảnh - 64s' },
];

const getProgressArray = (count: number): number[] => {
  if (count <= 1) return [0];
  if (count === 2) return [0, 100];
  const result = [0, 20];
  const remainingScenes = count - 2;
  const totalRemainingProgress = 80;
  const stepSize = totalRemainingProgress / remainingScenes;
  for (let i = 1; i < remainingScenes; i++) {
    result.push(Math.round(20 + i * stepSize));
  }
  result.push(100);
  return result;
};

const getLoadingMessage = (progress: number): string => {
  if (progress <= 20) return "Đang hoàn thiện bề mặt trống...";
  if (progress <= 60) return "Đang bọc nilon và chuyển đồ...";
  if (progress <= 90) return "Đang tháo dỡ nilon và bài trí...";
  return "Đang dọn dẹp và đánh bóng...";
};

interface TimelapseModuleProps {
  language?: string;
}

const TimelapseModule: React.FC<TimelapseModuleProps> = ({ language = 'vi' }) => {
  const storageKey = "timelapse_project_v17_fix_delete";
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [basePreview, setBasePreview] = useState<string | null>(null);
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [finalPreview, setFinalPreview] = useState<string | null>(null);
  const [sceneCount, setSceneCount] = useState(4);
  const [isProcessing, setIsProcessing] = useState(false);
  const [context, setContext] = useState<TimelapseContext | null>(null);
  const [segments, setSegments] = useState<TimelapseSegment[]>([]);
  const [isBulkImageLoading, setIsBulkImageLoading] = useState(false);
  const [isBulkPromptLoading, setIsBulkPromptLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const finalInputRef = useRef<HTMLInputElement>(null);
  const segmentUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingSegmentId, setUploadingSegmentId] = useState<number | null>(null);
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSceneCount(parsed.sceneCount || 4);
        setBasePreview(parsed.basePreview || null);
        setFinalPreview(parsed.finalPreview || null);
        setContext(parsed.context || null);
        setSegments((parsed.segments || []).map((s: any) => ({
          ...s,
          image: { ...s.image, url: s.image.url || '', loading: false },
          videoPrompt: { ...s.videoPrompt, loading: false }
        })));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      const toSave = {
        sceneCount,
        context,
        basePreview: basePreview?.startsWith('data:') ? basePreview : '',
        finalPreview: finalPreview?.startsWith('data:') ? finalPreview : '',
        segments: segments.map(s => ({
          ...s,
          image: { ...s.image, url: s.image.url?.startsWith('data:') ? s.image.url : '' },
          videoPrompt: { ...s.videoPrompt, loading: false }
        }))
      };
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (e) {}
  }, [sceneCount, basePreview, finalPreview, segments, context]);

  const processImportData = async (importedData: any) => {
    if (!Array.isArray(importedData) || importedData.length === 0) return;
    window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 5, complete: false } }));
    try {
      const first = importedData[0].inputs || {};
      setSceneCount(first.sceneCount || importedData.length);
      setBasePreview(first.basePreview || "");
      setFinalPreview(first.finalPreview || "");
      setContext(first.context || null);
      
      const newSegments: TimelapseSegment[] = [];
      const total = importedData.length;
      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        newSegments.push({
          id: i + 1,
          content: item.script || '',
          image: { url: item.outputImage || '', loading: false, regenNote: '' },
          videoPrompt: { text: item.videoPrompt || '', loading: false, visible: !!item.videoPrompt }
        });
        const percent = Math.round(((i + 1) / total) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: Math.min(percent, 95), complete: false } }));
        await new Promise(r => setTimeout(r, 30));
      }
      setSegments(newSegments);
      window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 100, complete: true } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 100, complete: true } }));
    }
  };

  useEffect(() => {
    const handleGlobalExport = () => {
        if (segments.length === 0) return;
        const exportData = segments.map((seg, index) => ({
          stt: index + 1,
          inputs: { sceneCount, basePreview, finalPreview, context },
          script: seg.content,
          outputImage: seg.image.url || '',
          videoPrompt: seg.videoPrompt.text || ''
        }));
        window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
          detail: { data: exportData, moduleName: 'Timelapse_Full' } 
        }));
    };
    const handleGlobalImport = (e: any) => processImportData(e.detail);
    window.addEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    };
  }, [segments, sceneCount, basePreview, finalPreview, context]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBaseFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setBasePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFinalFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setFinalPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, type: 'base' | 'final') => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        const file = files[0];
        if (type === 'base') handleFileUpload({ target: { files: [file] } } as any);
        else if (type === 'final') handleFinalUpload({ target: { files: [file] } } as any);
    }
  };

  const handleStart = async () => {
    if (!basePreview || !finalPreview) {
      alert("Cần ảnh HIỆN TRẠNG và ảnh KẾT QUẢ.");
      return;
    }
    setIsProcessing(true);
    try {
      const basePart = service.base64ToGenerativePart(basePreview);
      const finalPart = service.base64ToGenerativePart(finalPreview);
      const progressSteps = getProgressArray(sceneCount);
      
      const { script, context: analyzedContext } = await service.generateTimelapseScript(basePart, finalPart, sceneCount, progressSteps, language);
      
      setContext(analyzedContext);
      const newSegments: TimelapseSegment[] = script.map((desc, i) => ({
        id: i + 1,
        content: desc,
        image: { 
          url: i === 0 ? basePreview : (i === sceneCount - 1 ? finalPreview : ''), 
          loading: false,
          regenNote: ''
        },
        videoPrompt: { text: '', loading: false, visible: false }
      }));
      setSegments(newSegments);
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleGenImage = async (id: number) => {
    if (!context || !basePreview || !finalPreview) return;
    const idx = id - 1;
    
    setSegments(prev => prev.map(s => s.id === id ? { ...s, image: { ...s.image, loading: true } } : s));
    
    try {
      const basePart = service.base64ToGenerativePart(basePreview);
      const finalPart = service.base64ToGenerativePart(finalPreview);
      
      let previousImagePart = null;
      if (idx > 0) {
          const prevImgUrl = segments[idx - 1].image.url;
          if (prevImgUrl) {
              previousImagePart = service.base64ToGenerativePart(prevImgUrl);
          }
      }

      const progressSteps = getProgressArray(segments.length);
      const url = await service.generateTimelapseImage(
          context, 
          segments[idx].content, 
          basePart, 
          finalPart, 
          progressSteps[idx],
          previousImagePart
      );
      setSegments(prev => prev.map(s => s.id === id ? { ...s, image: { ...s.image, url, loading: false } } : s));
    } catch (e) {
      setSegments(prev => prev.map(s => s.id === id ? { ...s, image: { ...s.image, loading: false, error: 'Lỗi' } } : s));
    }
  };

  const handleDeleteImage = (id: number) => {
    setSegments(prev => {
      const updated = prev.map(s => {
        if (s.id === id) {
          return { ...s, image: { ...s.image, url: '', loading: false } };
        }
        return s;
      });
      return updated;
    });
  };

  const handleBulkImage = async () => {
    for (const seg of segments) {
      if (!seg.image.url) await handleGenImage(seg.id);
    }
  };

  const handleGenPrompt = async (id: number) => {
    if (!context) return;
    const idx = id - 1;
    const seg = segments[idx];
    if (!seg.image.url) return;
    setSegments(prev => prev.map(s => s.id === id ? { ...s, videoPrompt: { ...s.videoPrompt, loading: true, visible: true } } : s));
    try {
      const progressSteps = getProgressArray(segments.length);
      
      let previousImagePart = null;
      if (idx > 0 && segments[idx - 1].image.url) {
          previousImagePart = service.base64ToGenerativePart(segments[idx - 1].image.url);
      }

      const prompt = await service.generateTimelapseVideoPrompt(
          context, 
          seg.content, 
          seg.image.url, 
          progressSteps[idx],
          previousImagePart
      );
      setSegments(prev => prev.map(s => s.id === id ? { ...s, videoPrompt: { text: prompt, loading: false, visible: true } } : s));
    } catch (e) {
      setSegments(prev => prev.map(s => s.id === id ? { ...s, videoPrompt: { ...s.videoPrompt, loading: false } } : s));
    }
  };

  const handleBulkPrompt = async () => {
    for (const seg of segments) {
      if (seg.image.url && !seg.videoPrompt.text) await handleGenPrompt(seg.id);
    }
  };

  const downloadAllImages = async () => {
    if (typeof JSZip === 'undefined') return alert("ZIP Lib error");
    const zip = new JSZip();
    let count = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.image?.url) {
        const base64Data = seg.image.url.split(',')[1];
        if (base64Data) { zip.file(`${String(i + 1).padStart(2, '0')}.png`, base64Data, { base64: true }); count++; }
      }
    }
    if (count === 0) return alert("Không có ảnh.");
    const content = (await zip.generateAsync({ type: "blob" })) as any;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `timelapse_images_${Date.now()}.zip`;
    link.click();
  };

  const progressSteps = getProgressArray(segments.length || sceneCount);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <input type="file" ref={segmentUploadRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && uploadingSegmentId !== null) {
          const reader = new FileReader();
          reader.onload = (event) => setSegments(prev => prev.map(s => s.id === uploadingSegmentId ? { ...s, image: { ...s.image, url: event.target?.result as string, loading: false } } : s));
          reader.readAsDataURL(file);
        }
        e.target.value = "";
      }} className="hidden" accept="image/*" />

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 space-y-6">
            <div className="flex justify-between items-center px-1">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">1. Ảnh tham chiếu</label>
                {context && (
                   <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full uppercase">Loại dự án: {context.processType}</span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div 
                    onClick={() => fileInputRef.current?.click()} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'base')}
                    className="aspect-[3/4] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:border-orange-400 transition-all overflow-hidden relative group"
                >
                    {basePreview ? <img src={basePreview} className="w-full h-full object-cover" /> : <div className="text-center opacity-40"><svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-[10px] font-black uppercase">Ảnh Hiện Trạng</span></div>}
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                </div>
                <div 
                    onClick={() => finalInputRef.current?.click()} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'final')}
                    className="aspect-[3/4] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:border-orange-400 transition-all overflow-hidden relative group"
                >
                    {finalPreview ? <img src={finalPreview} className="w-full h-full object-cover" /> : <div className="text-center opacity-40"><svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-[10px] font-black uppercase">Ảnh Kết Quả</span></div>}
                    <input type="file" ref={finalInputRef} onChange={handleFinalUpload} className="hidden" accept="image/*" />
                </div>
            </div>
          </div>

          <div className="flex-1 space-y-8">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-4 tracking-widest px-1">2. Số lượng cảnh quay</label>
              <div className="grid grid-cols-3 gap-3">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.scenes} onClick={() => setSceneCount(opt.scenes)} className={`p-4 rounded-xl text-[10px] font-black transition-all border-2 ${sceneCount === opt.scenes ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>{opt.label}</button>
                ))}
              </div>
            </div>
            <button 
              onClick={handleStart} 
              disabled={isProcessing || !basePreview || !finalPreview} 
              style={{ backgroundColor: 'var(--primary-color)' }}
              className="w-full py-6 text-white font-black rounded-2xl shadow-xl transition-all disabled:opacity-50 uppercase tracking-[0.2em] flex items-center justify-center gap-4"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>ĐANG PHÂN TÍCH...</span>
                </>
              ) : "🚀 TẠO LỘ TRÌNH TIMELAPSE"}
            </button>
            {context && (
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl animate-fadeIn">
                 <h4 className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-2">Phân tích dự án:</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] text-orange-400 font-bold uppercase">Chủ thể</p>
                      <p className="text-[10px] font-bold text-orange-900">{context.subject}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-orange-400 font-bold uppercase">Vật liệu thô</p>
                      <p className="text-[10px] font-bold text-orange-900">{context.rawMaterial}</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="space-y-12 pb-32">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6">
            <div>
                <h3 className="text-white font-black text-xl uppercase tracking-tight">Timeline Progress</h3>
                <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest mt-1">Sử dụng AI Phân tích ngữ cảnh (Visual Continuity Lock)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {segments.map((seg, idx) => {
              const progress = progressSteps[idx];
              return (
                <div key={seg.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full group hover:shadow-xl transition-all relative">
                  <div className="relative aspect-[9/16] bg-slate-100 overflow-hidden">
                    {seg.image.url ? (
                      <div className="relative w-full h-full">
                        <img src={seg.image.url} className={`w-full h-full object-cover ${seg.image.loading ? 'blur-sm grayscale opacity-50' : ''}`} />
                        {!seg.image.loading && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteImage(seg.id); }}
                             className="absolute top-4 right-4 w-10 h-10 bg-orange-600/90 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-orange-700 transition-all z-10 opacity-0 group-hover:opacity-100 scale-90 hover:scale-100"
                             title="Xóa ảnh cảnh này"
                           >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                           </button>
                        )}
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <button 
                          onClick={() => handleGenImage(seg.id)} 
                          style={{ backgroundColor: 'var(--primary-color)' }}
                          className="w-40 py-3 text-white rounded-xl text-xs font-black shadow-lg uppercase active:scale-95 transition-all"
                        >
                          Vẽ ảnh {progress}%
                        </button>
                      </div>
                    )}

                    {seg.image.loading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md z-20 transition-all duration-300">
                        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="mt-6 text-[11px] font-black text-orange-600 uppercase tracking-widest animate-pulse px-6 text-center leading-relaxed">
                          {getLoadingMessage(progress)}
                        </span>
                        <p className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ: {progress}%</p>
                      </div>
                    )}
                    
                    <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-4 py-2 rounded-full shadow-lg border border-white/10">#{seg.id} • {progress}%</div>
                  </div>

                  <div className="p-6 space-y-4 flex flex-col flex-1">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả giai đoạn {progress}%:</label>
                        <span className={`text-[10px] font-black ${seg.content.length > 180 ? 'text-orange-600' : 'text-slate-400'}`}>
                          {seg.content.length}/180
                        </span>
                      </div>
                      <textarea 
                        value={seg.content} 
                        onChange={e => setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, content: e.target.value } : s))} 
                        className={`w-full h-24 p-4 bg-slate-50 border ${seg.content.length > 180 ? 'border-orange-600' : 'border-slate-200'} rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white resize-none shadow-inner leading-relaxed`} 
                      />
                      {seg.content.length > 180 && (
                        <p className="text-[9px] font-bold text-orange-600 uppercase px-1">Tối đa 180 ký tự</p>
                      )}
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleGenImage(seg.id)} 
                        disabled={seg.image.loading} 
                        style={{ backgroundColor: 'var(--primary-color)' }}
                        className="py-4 text-white text-[10px] font-black rounded-xl uppercase transition-all hover:bg-black active:scale-95 shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {seg.image.loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Vẽ ảnh AI
                      </button>
                      <button 
                        onClick={() => handleGenPrompt(seg.id)} 
                        disabled={seg.videoPrompt.loading || !seg.image.url} 
                        style={{ backgroundColor: 'var(--primary-color)' }}
                        className="py-4 text-white text-[10px] font-black rounded-xl uppercase transition-all border border-orange-100 hover:bg-orange-100 active:scale-95 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {seg.videoPrompt.loading && <div className="w-3 h-3 border-2 border-orange-700/30 border-t-orange-700 rounded-full animate-spin" />}
                        VEO Prompt
                      </button>
                    </div>
                  </div>

                  {seg.videoPrompt.visible && (
                    <div className="p-5 bg-slate-900 border-t border-slate-800 animate-slideUp">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">VEO-3 Prompt</span>
                        <button 
                          onClick={() => handleCopy(seg.videoPrompt.text, `seg-${idx}`)} 
                          className={`text-[9px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`seg-${idx}`] ? 'text-green-400' : 'text-white underline'}`}
                        >
                          {copyStatus[`seg-${idx}`] ? 'COPIED!' : 'COPY'}
                        </button>
                      </div>
                      <textarea 
                        readOnly 
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        className="w-full h-24 bg-slate-950 text-slate-300 text-[10px] p-2 rounded border border-slate-800 focus:outline-none resize-none font-mono italic opacity-80 leading-relaxed"
                        value={seg.videoPrompt.text}
                      />
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
                disabled={isBulkImageLoading}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
              >
                Vẽ tất cả ảnh
                {isBulkImageLoading ? (
                  <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
                )}
              </button>
              <button
                onClick={handleBulkPrompt}
                disabled={isBulkPromptLoading}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
              >
                Tạo tất cả Prompt video
                {isBulkPromptLoading ? (
                  <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
                )}
              </button>
            </div>

            {segments.some(s => s.image.url || s.videoPrompt.text) && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                <button
                  onClick={downloadAllImages}
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải Ảnh (ZIP)
                </button>
                  <button
                    onClick={() => {
                      const text = segments.map(seg => seg.videoPrompt?.text || "").filter(t => t.trim().length > 0).join('\n');
                      if (!text) return alert("Chưa có prompt nào!");
                      const blob = new Blob([text], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `timelapse_prompts_${Date.now()}.txt`;
                      link.click();
                    }}
                    style={{ backgroundColor: 'var(--primary-color)' }}
                    className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
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

export default TimelapseModule;
