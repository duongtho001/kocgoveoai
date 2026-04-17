
import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/vuaTvService';
import { VuaTvState } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { theme } from '../constants/colors';

const SUGGESTED_PUZZLES = [
  { p: 'T/Ì/N/H/Á/I/B/H', a: 'THÁI BÌNH' },
  { p: 'C/H/Ị/C/H/T/Ủ', a: 'CHỦ TỊCH' },
  { p: 'R/Ă/M/N/O/I', a: 'NĂM ROI' },
  { p: 'M/Ắ/C/Ổ', a: 'Ổ CẮM' },
  { p: 'R/A/T/Ù/C', a: 'CA TRÙ' },
  { p: 'X/Ồ/G/À', a: 'XÀ GỒ' },
  { p: 'S/O/A/C/U', a: 'CAO SU' },
  { p: 'H/O/N/A/L/A', a: 'HOA LAN' }
];

interface VuaTvModuleProps {
  language?: string;
}

const VuaTvModule: React.FC<VuaTvModuleProps> = ({ language = 'vi' }) => {
  const [state, setState] = useState<VuaTvState>({
    puzzle: '',
    answer: '',
    headerTitle: 'VUA TIẾNG VIỆT',
    headerColor: '#ea580c', // Orange-600
    titleFontSize: 60,
    puzzleFontSize: 80,
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

  const generatePuzzleFromAnswer = (ans: string): string => {
    if (!ans) return '';
    const chars = ans.replace(/\s/g, '').toUpperCase().split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('/');
  };

  const handleSelectSuggestion = (p: string, a: string) => {
    setState(prev => ({ ...prev, puzzle: p, answer: a }));
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
    if (!state.answer.trim()) {
      alert("Vui lòng nhập đáp án để AI có cơ sở tạo hình ảnh ẩn dụ.");
      return;
    }
    setState(prev => ({ ...prev, isLoading: true, generatedImageUrl: '', videoPrompt: '', isVideoPromptVisible: false }));

    try {
      const facePart = state.faceFile ? await service.fileToGenerativePart(state.faceFile) : null;
      const imageUrl = await service.generateVuaTvImage(
        state.answer,
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
      const prompt = await service.generateVuaTvImagePrompt(
        state.answer,
        state.faceDescription,
        state.regenNote,
        state.imageStyle,
        undefined,
        "",
        language
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
      const prompt = await service.generateVuaTvVideoPrompt(
        state.answer,
        state.puzzle,
        state.headerTitle,
        state.generatedImageUrl,
        state.imageStyle,
        language
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

      // Scaling scale factor between UI preview (~384px) and Canvas (1080px)
      const SCALE = 1080 / 384; 

      const headerHeight = canvas.height * 0.2;
      const contentHeight = canvas.height * 0.8;

      // 1. Draw Header Background
      ctx.fillStyle = state.headerColor;
      ctx.fillRect(0, 0, canvas.width, headerHeight);

      // 2. Draw Title
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const titleY = headerHeight * 0.4;
      // Exact Proportional scaling from UI: (fontSize / 5) * SCALE
      const canvasTitleSize = (state.titleFontSize / 5) * SCALE;
      ctx.font = `900 ${canvasTitleSize}px 'Inter', sans-serif`;
      
      // Scaled letter-spacing: 3px * SCALE
      const canvasLetterSpacing = 3 * SCALE;
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = `${canvasLetterSpacing}px`;
      }
      
      ctx.fillText(state.headerTitle.toUpperCase(), canvas.width / 2, titleY);
      
      // 3. Draw Scrambled Puzzle
      const puzzleY = headerHeight * 0.75;
      const canvasPuzzleSize = (state.puzzleFontSize / 5) * SCALE;
      ctx.font = `700 ${canvasPuzzleSize}px 'Montserrat', sans-serif`;
      
      // tracking-[0.2em] proportional to font size
      const puzzleLetterSpacing = canvasPuzzleSize * 0.2;
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = `${puzzleLetterSpacing}px`;
      }
      
      ctx.fillText(state.puzzle.toUpperCase() || '---', canvas.width / 2, puzzleY);
      
      // Reset letter spacing for image drawing
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = "0px";
      }

      // 4. Draw Content Image (Object-fit: cover)
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

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `VuaTV-${state.answer.replace(/\s+/g, '_')}-${Date.now()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png', 1.0);
    };
    img.src = state.generatedImageUrl;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-black text-slate-800 uppercase mb-4 tracking-wider flex items-center gap-2">
              <svg className={`w-4 h-4 ${theme.colors.primaryText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              1. Cấu hình tiêu đề & câu đố
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

              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">TIÊU ĐỀ (Header):</label>
                    <input 
                      type="text" 
                      value={state.headerTitle}
                      onChange={e => setState(p => ({ ...p, headerTitle: e.target.value }))}
                      placeholder="VUA TIẾNG VIỆT"
                      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${theme.colors.secondaryBg} focus:border-slate-400 outline-none font-bold text-xs`}
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">SIZE:</label>
                    <input 
                      type="number" 
                      value={state.titleFontSize}
                      onChange={e => setState(p => ({ ...p, titleFontSize: parseInt(e.target.value) || 10 }))}
                      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${theme.colors.secondaryBg} outline-none font-bold text-xs`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">ĐÁP ÁN (Answer):</label>
                    <input 
                    type="text" 
                    value={state.answer}
                    onChange={e => {
                      const val = e.target.value;
                      setState(p => ({ 
                        ...p, 
                        answer: val, 
                        puzzle: generatePuzzleFromAnswer(val) 
                      }));
                    }}
                    placeholder="VD: CON LĂN"
                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${theme.colors.secondaryBg} focus:border-slate-400 outline-none font-bold text-xs`}
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">CÂU ĐỐ (Scrambled Puzzle):</label>
                    <input 
                      type="text" 
                      value={state.puzzle}
                      onChange={e => setState(p => ({ ...p, puzzle: e.target.value }))}
                      placeholder="T/Ự/Đ/Ộ/N/G"
                      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${theme.colors.secondaryBg} focus:border-slate-400 outline-none font-bold text-xs`}
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">SIZE:</label>
                    <input 
                      type="number" 
                      value={state.puzzleFontSize}
                      onChange={e => setState(p => ({ ...p, puzzleFontSize: parseInt(e.target.value) || 10 }))}
                      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 ${theme.colors.secondaryBg} outline-none font-bold text-xs`}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Gợi ý câu đố nhanh:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PUZZLES.map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => handleSelectSuggestion(s.p, s.a)}
                      className={`px-3 py-1.5 bg-slate-100 hover:${theme.colors.secondaryBg} hover:${theme.colors.primaryText} rounded-lg text-[10px] font-bold transition-all border border-transparent hover:${theme.colors.secondaryBorder}`}
                    >
                      {s.a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-black text-slate-800 uppercase mb-4 tracking-wider flex items-center gap-2">
               <svg className={`w-4 h-4 ${theme.colors.primaryText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               2. Nhân vật & Ghi chú
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Ảnh nhân vật:</label>
                <div 
                  onClick={() => faceInputRef.current?.click()}
                  className={`w-full h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer hover:${theme.colors.secondaryBorder} transition-all overflow-hidden`}
                >
                  {state.facePreview ? (
                    <img src={state.facePreview} className="h-full object-cover" alt="face" />
                  ) : (
                    <div className="text-center">
                      <svg className="w-5 h-5 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tải ảnh mặt</span>
                    </div>
                  )}
                  <input type="file" ref={faceInputRef} onChange={handleFaceUpload} className="hidden" accept="image/*" />
                </div>
                <input 
                  type="text" 
                  value={state.faceDescription}
                  onChange={e => setState(p => ({ ...p, faceDescription: e.target.value }))}
                  placeholder="Mô tả bối cảnh..."
                  className={`w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 ${theme.colors.primaryBorder} outline-none`}
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Màu nền tiêu đề:</label>
                <input 
                  type="color" 
                  value={state.headerColor}
                  onChange={e => setState(p => ({ ...p, headerColor: e.target.value }))}
                  className="w-full h-10 p-1 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Ghi chú sửa ảnh:</label>
                <textarea 
                  value={state.regenNote}
                  onChange={e => setState(p => ({ ...p, regenNote: e.target.value }))}
                  placeholder="Làng quê, trời nắng..."
                  className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 ${theme.colors.primaryBorder} outline-none h-32 resize-none font-medium`}
                />
              </div>
            </div>
            <button 
              onClick={handleGenerate}
              disabled={state.isLoading}
              style={!state.isLoading ? { backgroundColor: 'var(--primary-color)' } : {}}
              className={`w-full mt-6 py-4 text-white font-black rounded-2xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-sm`}
            >
              {state.isLoading ? "ĐANG TẠO..." : "TẠO CHIẾN DỊCH VUA TV"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col items-center">
              <div className={`relative aspect-[9/16] ${theme.colors.buttonSecondary} rounded-[32px] overflow-hidden shadow-2xl flex flex-col w-full max-w-sm border-8 border-slate-800`}>
            <div 
              className="h-[20%] flex flex-col items-center justify-center text-white px-4 z-10"
              style={{ backgroundColor: state.headerColor }}
            >
              <h1 
                className="font-black uppercase text-center"
                style={{ 
                  fontSize: `${state.titleFontSize / 5}px`,
                  letterSpacing: '3px' 
                }}
              >
                {state.headerTitle}
              </h1>
              <p 
                className="font-bold mt-2 tracking-[0.2em] text-center"
                style={{ fontSize: `${state.puzzleFontSize / 5}px` }}
              >
                {state.puzzle.toUpperCase() || '---'}
              </p>
            </div>

            <div className="h-[80%] relative bg-slate-50 overflow-hidden">
              {state.generatedImageUrl ? (
                <img src={state.generatedImageUrl} className="w-full h-full object-cover" alt="metaphor" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center text-slate-300">
                  <p className="text-xs font-black uppercase tracking-widest">Minh họa sẽ ở đây</p>
                </div>
              )}
              
              {state.isLoading && (
                <div className={`absolute inset-0 ${theme.colors.buttonSecondary} opacity-40 backdrop-blur-sm flex items-center justify-center z-20`}>
                  <div className="text-center">
                    <div className={`w-12 h-12 border-4 ${theme.colors.primaryBorder} border-t-transparent rounded-full animate-spin mx-auto mb-4`}></div>
                    <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">Đang vẽ hình...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex gap-4 w-full max-w-sm">
            <button 
              onClick={downloadCompositeImage}
              disabled={!state.generatedImageUrl}
              className={`flex-1 py-4 ${theme.colors.buttonSecondary} text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-xl`}
            >
              Tải ảnh
            </button>
            <button 
              onClick={handleGenerateImagePrompt}
              disabled={state.isImagePromptLoading}
              style={!state.isImagePromptLoading ? { backgroundColor: 'var(--primary-color)' } : {}}
              className={`flex-1 py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-xl`}
            >
              Prompt Ảnh
            </button>
            <button 
              onClick={handleGeneratePrompt}
              disabled={!state.generatedImageUrl || state.isVideoPromptLoading}
              style={!(!state.generatedImageUrl || state.isVideoPromptLoading) ? { backgroundColor: 'var(--primary-color)' } : {}}
              className={`flex-1 py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-30 uppercase text-xs tracking-widest shadow-xl`}
            >
              Video Prompt
            </button>
          </div>

          {state.isImagePromptVisible && (
            <div className={`mt-8 w-full max-w-2xl ${theme.colors.buttonSecondary} rounded-3xl p-6 border border-slate-800 animate-slideUp`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Prompt Ảnh (IMAGEN 3)</span>
                <button 
                  onClick={() => handleCopy(state.imagePrompt)}
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
            <div className={`mt-8 w-full max-w-2xl ${theme.colors.buttonSecondary} rounded-3xl p-6 border border-slate-800 animate-slideUp`}>
              <div className="flex justify-between items-center mb-4">
                <span className={`text-[10px] font-black ${theme.colors.primaryText} uppercase tracking-widest`}>Kịch bản Video VEO-3</span>
                <button 
                  onClick={() => handleCopy(state.videoPrompt)}
                  className={`text-[10px] font-black underline transition-colors w-16 text-right ${copyStatus ? 'text-green-400' : `text-white hover:${theme.colors.primaryText}`}`}
                >
                  {copyStatus ? 'COPIED!' : 'COPY'}
                </button>
              </div>
              {state.isVideoPromptLoading ? (
                <div className="h-20 flex items-center justify-center">
                  <div className={`w-6 h-6 border-2 ${theme.colors.primaryBorder} border-t-transparent rounded-full animate-spin`}></div>
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

export default VuaTvModule;
