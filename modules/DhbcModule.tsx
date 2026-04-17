import React, { useState, useRef } from 'react';
import * as service from '../services/dhbcService';
import { DhbcState, DhbcPhrase } from '../types';
import { copyToClipboard } from '../utils/clipboard';

interface DhbcModuleProps {
  language?: string;
}

const DhbcModule: React.FC<DhbcModuleProps> = ({ language = 'vi' }) => {
  const [state, setState] = useState<DhbcState>({
    phrase: '',
    hint: '',
    headerTitle: 'ĐUỔI HÌNH BẮT CHỮ SIÊU KHÓ',
    headerColor: '#ea580c',
    headerFontSize: 60,
    footerColor: '#0f172a',
    faceFile: null,
    facePreview: null,
    faceDescription: '',
    imageStyle: 'Realistic',
    regenNote: '',
    generatedImageUrl: '',
    isLoading: false,
    videoPrompt: '',
    isVideoPromptLoading: false,
    isVideoPromptVisible: false,
    suggestedPhrases: [],
    isSuggesting: false,
    imagePrompt: '',
    isImagePromptLoading: false,
    isImagePromptVisible: false
  });

  const faceInputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState(false);

  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    }
  };

  const generateLocalHint = (phrase: string): string => {
    const letters = phrase.split('').map((char, index) => ({ char, index, isSpace: char === ' ' }));
    const nonSpaceIndices = letters.filter(l => !l.isSpace).map(l => l.index);
    const shuffled = [...nonSpaceIndices].sort(() => 0.5 - Math.random());
    const keepIndices = shuffled.slice(0, Math.min(2, shuffled.length));

    return letters.map(l => {
      if (l.isSpace) return ' ';
      return keepIndices.includes(l.index) ? l.char : '_';
    }).join('');
  };

  const handleSuggest = async () => {
    setState(prev => ({ ...prev, isSuggesting: true }));
    const suggestions = await service.suggestDhbcPhrases(language);
    setState(prev => ({ ...prev, suggestedPhrases: suggestions, isSuggesting: false }));
  };

  const handleSelectSuggestion = (s: DhbcPhrase) => {
    setState(prev => ({ ...prev, phrase: s.phrase, hint: s.hint }));
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setState(prev => ({ 
        ...prev, 
        faceFile: file, 
        facePreview: URL.createObjectURL(file) 
      }));
    }
  };

  const handleGenerate = async () => {
    if (!state.phrase.trim()) {
      alert("Vui lòng nhập hoặc chọn câu đuổi hình bắt chữ.");
      return;
    }

    const finalHint = state.hint || generateLocalHint(state.phrase);

    setState(prev => ({ 
      ...prev, 
      hint: finalHint,
      isLoading: true, 
      generatedImageUrl: '', 
      videoPrompt: '', 
      isVideoPromptVisible: false 
    }));

    try {
      const facePart = state.faceFile ? { 
        mimeType: state.faceFile.type, 
        data: (await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(state.faceFile!);
        }))
      } : null;

      const imageUrl = await service.generateDhbcIllustration(
        state.phrase,
        facePart,
        state.faceDescription,
        state.regenNote,
        state.imageStyle
      );
      setState(prev => ({ ...prev, generatedImageUrl: imageUrl, isLoading: false }));
    } catch (error) {
      alert("Lỗi khi tạo hình ảnh. Vui lòng thử lại.");
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleGenerateImagePrompt = async () => {
    setState(prev => ({ ...prev, isImagePromptLoading: true, isImagePromptVisible: true }));
    try {
      const prompt = await service.generateDhbcImagePrompt(
        state.phrase,
        state.faceDescription,
        state.regenNote,
        state.imageStyle
      );
      setState(prev => ({ ...prev, imagePrompt: prompt, isImagePromptLoading: false }));
    } catch (error) {
      console.error("Image Prompt error:", error);
      alert("Lỗi tạo prompt ảnh: " + (error as Error).message);
      setState(prev => ({ ...prev, isImagePromptLoading: false }));
    }
  };

  const handleGeneratePrompt = async () => {
    if (!state.generatedImageUrl) return;
    setState(prev => ({ ...prev, isVideoPromptLoading: true, isVideoPromptVisible: true }));
    try {
      const prompt = await service.generateDhbcVideoPrompt(
        state.phrase,
        state.hint,
        state.generatedImageUrl,
        state.imageStyle
      );
      setState(prev => ({ ...prev, videoPrompt: prompt, isVideoPromptLoading: false }));
    } catch (error) {
      setState(prev => ({ ...prev, isVideoPromptLoading: false }));
    }
  };

  const downloadCompositeImage = async () => {
    if (!state.generatedImageUrl) return;

    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = 1080;
      canvas.height = 1920;

      const SCALE = 1080 / 384; 

      const headerHeight = canvas.height * 0.20;
      const contentHeight = canvas.height * 0.50;
      const footerHeight = canvas.height * 0.30;

      // 1. Header background
      ctx.fillStyle = state.headerColor;
      ctx.fillRect(0, 0, canvas.width, headerHeight);

      // 2. Header Text
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Scaled font size to match UI (Size / 5) * SCALE
      const canvasFontSize = (state.headerFontSize / 5) * SCALE;
      ctx.font = `900 ${canvasFontSize}px 'Inter', sans-serif`;
      
      // tracking-widest proportional scaling (0.1em)
      const letterSpacing = canvasFontSize * 0.1;
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = `${letterSpacing}px`;
      }
      
      ctx.fillText(state.headerTitle.toUpperCase(), canvas.width / 2, headerHeight / 2);

      // Reset letter spacing
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = "0px";
      }

      // 3. Content Illustration (Object-fit: cover)
      const targetW = canvas.width;
      const targetH = contentHeight;
      const imgRatio = img.width / img.height;
      const targetRatio = targetW / targetH;
      
      let sourceW, sourceH, sourceX, sourceY;
      if (imgRatio > targetRatio) {
          sourceH = img.height;
          sourceW = img.height * targetRatio;
          sourceX = (img.width - sourceW) / 2;
          sourceY = 0;
      } else {
          sourceW = img.width;
          sourceH = img.width / targetRatio;
          sourceX = 0;
          sourceY = (img.height - sourceH) / 2;
      }
      ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, headerHeight, targetW, targetH);

      // 4. Footer background
      ctx.fillStyle = state.footerColor;
      ctx.fillRect(0, canvas.height - footerHeight, canvas.width, footerHeight);

      // 5. Puzzle boxes in Footer
      const cleanHint = (state.hint || state.phrase).replace(/\s/g, '');
      const chars = cleanHint.split('');
      
      // Proportional box size (w-8 UI = 32px. 32 * SCALE ≈ 90)
      const boxSize = 32 * SCALE;
      const spacing = 4 * SCALE; 
      const maxBoxesPerRow = Math.floor((canvas.width - 80) / (boxSize + spacing));
      
      const rows: string[][] = [];
      for (let i = 0; i < chars.length; i += maxBoxesPerRow) {
          rows.push(chars.slice(i, i + maxBoxesPerRow));
      }

      const totalContentHeight = rows.length * (boxSize + spacing) - spacing;
      let startY = (canvas.height - footerHeight) + (footerHeight - totalContentHeight) / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${18 * SCALE}px 'Inter', sans-serif`;

      rows.forEach(rowChars => {
          const rowWidth = rowChars.length * (boxSize + spacing) - spacing;
          let startX = (canvas.width - rowWidth) / 2;
          
          rowChars.forEach(char => {
              ctx.fillStyle = 'white';
              ctx.beginPath();
              ctx.roundRect(startX, startY, boxSize, boxSize, 4 * SCALE);
              ctx.fill();
              
              ctx.strokeStyle = '#cbd5e1';
              ctx.lineWidth = 1 * SCALE;
              ctx.stroke();

              if (char !== '_') {
                  ctx.fillStyle = '#0f172a';
                  ctx.fillText(char.toUpperCase(), startX + boxSize / 2, startY + boxSize / 2 + (2 * SCALE));
              }
              startX += boxSize + spacing;
          });
          startY += boxSize + spacing;
      });

      canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `DHBC-${state.phrase.substring(0, 10).replace(/\s+/g, '_')}-${Date.now()}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
      }, 'image/png', 1.0);
    };
    img.src = state.generatedImageUrl;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pt-[10px] leading-[1.2]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-black text-slate-800 uppercase mb-4 tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              1. Câu đố ĐHBC
            </h3>
            <div className="space-y-4">
              <button 
                onClick={handleSuggest}
                disabled={state.isSuggesting}
                style={!state.isSuggesting ? { backgroundColor: 'var(--primary-color)' } : {}}
                className={`w-full py-2.5 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 uppercase tracking-widest ${state.isSuggesting ? 'opacity-50' : 'hover:opacity-90 shadow-sm'}`}
              >
                {state.isSuggesting ? '...' : '✨ Gợi ý câu Hot Trends'}
              </button>

              {state.suggestedPhrases.length > 0 && (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100 custom-scrollbar">
                  {state.suggestedPhrases.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSelectSuggestion(s)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-orange-400 hover:text-orange-600 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                    >
                      {s.phrase}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">CÂU ĐỐ:</label>
                <textarea 
                  value={state.phrase}
                  onChange={e => {
                    const val = e.target.value;
                    setState(p => ({ ...p, phrase: val, hint: generateLocalHint(val) }));
                  }}
                  placeholder="Nhập câu đố ẩn dụ..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-100 focus:border-orange-500 outline-none font-bold text-sm h-24 resize-none leading-[1.2]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-black text-slate-800 uppercase mb-4 tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              2. Sáng tạo hình ảnh
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block px-1 mb-1">Phong cách ảnh</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setState(p => ({ ...p, imageStyle: 'Realistic' }))}
                    style={state.imageStyle === 'Realistic' ? { backgroundColor: 'var(--primary-color)' } : {}}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === 'Realistic' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Chân thực
                  </button>
                  <button 
                    onClick={() => setState(p => ({ ...p, imageStyle: '3D' }))}
                    style={state.imageStyle === '3D' ? { backgroundColor: 'var(--primary-color)' } : {}}
                    className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === '3D' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    3D Animation
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tiêu đề Header:</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={state.headerTitle}
                    onChange={e => setState(p => ({ ...p, headerTitle: e.target.value }))}
                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-500 leading-[1.2]"
                  />
                  <input 
                    type="number" 
                    value={state.headerFontSize}
                    onChange={e => setState(p => ({ ...p, headerFontSize: parseInt(e.target.value) || 10 }))}
                    className="w-16 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-500"
                    min="10"
                    max="100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Ảnh mặt mẫu (Tùy chọn):</label>
                <div 
                  onClick={() => faceInputRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer hover:border-orange-400 transition-all overflow-hidden"
                >
                  {state.facePreview ? (
                    <img src={state.facePreview} className="h-full object-cover" alt="face" />
                  ) : (
                    <div className="text-center">
                      <svg className="w-5 h-5 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tải ảnh</span>
                    </div>
                  )}
                  <input type="file" ref={faceInputRef} onChange={handleFaceUpload} className="hidden" accept="image/*" />
                </div>
                <input 
                  type="text" 
                  value={state.faceDescription}
                  onChange={e => setState(p => ({ ...p, faceDescription: e.target.value }))}
                  placeholder="Mô tả nhân vật..."
                  className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-orange-500 outline-none leading-[1.2]"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Màu Header:</label>
                  <input 
                    type="color" 
                    value={state.headerColor}
                    onChange={e => setState(p => ({ ...p, headerColor: e.target.value }))}
                    className="w-full h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Màu Ô chữ:</label>
                  <input 
                    type="color" 
                    value={state.footerColor}
                    onChange={e => setState(p => ({ ...p, footerColor: e.target.value }))}
                    className="w-full h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Ghi chú sửa ảnh:</label>
                <textarea 
                  value={state.regenNote}
                  onChange={e => setState(p => ({ ...p, regenNote: e.target.value }))}
                  placeholder="Ghi chú thêm..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-orange-500 outline-none h-32 resize-none font-medium leading-[1.2]"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={state.isLoading}
            style={!state.isLoading ? { backgroundColor: 'var(--primary-color)' } : {}}
            className="w-full py-4 text-white font-black rounded-xl shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
          >
            {state.isLoading ? "ĐANG TẠO ẢNH..." : "🚀 BẮT ĐẦU TẠO KỊCH BẢN"}
          </button>
        </div>

        <div className="lg:col-span-8 flex flex-col items-center pt-[10px]">
          <div className="relative aspect-[9/16] bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col w-full max-w-sm border-8 border-slate-800">
            <div 
              className="h-[20%] flex flex-col items-center justify-center text-white px-4 z-10 shadow-sm"
              style={{ backgroundColor: state.headerColor }}
            >
              <h1 
                className="font-black tracking-widest uppercase text-center"
                style={{ fontSize: `${state.headerFontSize / 5}px` }}
              >
                {state.headerTitle}
              </h1>
            </div>

            <div className="h-[50%] relative bg-slate-50 overflow-hidden">
              {state.generatedImageUrl ? (
                <img src={state.generatedImageUrl} className="w-full h-full object-cover" alt="illustration" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center text-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-widest">Minh họa (5/10) sẽ ở đây</p>
                </div>
              )}
              
              {state.isLoading && (
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Đang vẽ ẩn dụ...</p>
                  </div>
                </div>
              )}
            </div>

            <div 
              className="h-[30%] flex flex-wrap items-center justify-center gap-1 px-4 py-6 z-10"
              style={{ backgroundColor: state.footerColor }}
            >
              {(state.hint || state.phrase).replace(/\s/g, '').split('').map((char, i) => (
                <div key={i} className="w-8 h-8 bg-white flex items-center justify-center shadow-sm border border-slate-200 rounded-sm">
                  <span className="text-sm font-black text-slate-800">{char !== '_' ? char.toUpperCase() : ''}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex gap-4 w-full max-w-sm">
            <button 
              onClick={downloadCompositeImage}
              disabled={!state.generatedImageUrl}
              className="flex-1 py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-lg"
            >
              Tải ảnh
            </button>
            <button 
              onClick={handleGenerateImagePrompt}
              disabled={state.isImagePromptLoading}
              style={!state.isImagePromptLoading ? { backgroundColor: 'var(--primary-color)' } : {}}
              className="flex-1 py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-lg"
            >
              Prompt Ảnh
            </button>
            <button 
              onClick={handleGeneratePrompt}
              disabled={!state.generatedImageUrl || state.isVideoPromptLoading}
              style={!(!state.generatedImageUrl || state.isVideoPromptLoading) ? { backgroundColor: 'var(--primary-color)' } : {}}
              className="flex-1 py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-lg"
            >
              Video Prompt
            </button>
          </div>

          {state.isImagePromptVisible && (
            <div className="mt-8 w-full max-w-2xl bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-sm animate-slideUp">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Prompt Ảnh (IMAGEN 3)</span>
                <button 
                  onClick={() => handleCopy(state.imagePrompt || '')}
                  className={`text-[10px] font-black underline transition-colors w-16 text-right ${copyStatus ? 'text-green-400' : 'text-white hover:text-orange-400'}`}
                >
                  {copyStatus ? 'COPIED!' : 'COPY'}
                </button>
              </div>
              {state.isImagePromptLoading ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <textarea 
                  readOnly 
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full h-24 bg-slate-950 text-slate-300 text-xs p-3 rounded-xl border border-slate-800 focus:outline-none resize-none font-mono italic opacity-90 leading-relaxed"
                  value={state.imagePrompt}
                />
              )}
            </div>
          )}

          {state.isVideoPromptVisible && (
            <div className="mt-8 w-full max-w-2xl bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-sm animate-slideUp">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Prompt Video (Tiếng Việt)</span>
                <button 
                  onClick={() => handleCopy(state.videoPrompt)}
                  className={`text-[10px] font-black underline transition-colors w-16 text-right ${copyStatus ? 'text-green-400' : 'text-white hover:text-orange-500'}`}
                >
                  {copyStatus ? 'COPIED!' : 'COPY'}
                </button>
              </div>
              {state.isVideoPromptLoading ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <textarea 
                  readOnly 
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full h-24 bg-slate-950 text-slate-300 text-xs p-3 rounded-xl border border-slate-800 focus:outline-none resize-none font-mono italic opacity-90 leading-relaxed"
                  value={state.videoPrompt}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DhbcModule;