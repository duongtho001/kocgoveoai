import React, { useState } from 'react';
import { CarouselItem } from '../types';
import { theme } from '../constants/colors';
import { LANGUAGE_CONSTRAINTS } from '../utils/languageUtils';

interface CarouselCardProps {
  item: CarouselItem;
  language?: string;
  onTextChange: (id: number, text: string) => void;
  onGenerate: (id: number) => void;
  onRegenerate: (id: number) => void;
  onNoteChange: (id: number, text: string) => void;
  onPositionChange: (id: number, pos: 'Top' | 'Bottom' | 'Center') => void;
  onAlignmentChange: (id: number, align: 'left' | 'center') => void;
  onColorChange: (id: number, color: string) => void;
  onOverlayColorChange: (id: number, color: string) => void;
  onOverlayOpacityChange: (id: number, opacity: number) => void;
  onToggleOverlay: (id: number, show: boolean) => void;
  onApplyStyleToAll: (style: Partial<CarouselItem>) => void;
  onFontSizeChange: (id: number, size: number) => void;
  onGenerateImagePrompt: (id: number) => void;
}

const CarouselCard: React.FC<CarouselCardProps> = ({ 
  item, 
  language,
  onTextChange, 
  onGenerate, 
  onRegenerate,
  onNoteChange,
  onPositionChange,
  onAlignmentChange,
  onColorChange,
  onOverlayColorChange,
  onOverlayOpacityChange,
  onToggleOverlay,
  onApplyStyleToAll,
  onFontSizeChange,
  onGenerateImagePrompt
}) => {
  const [copyStatus, setCopyStatus] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const positions: ('Top' | 'Bottom' | 'Center')[] = ['Top', 'Bottom', 'Center'];
  const alignments: { value: 'left' | 'center', label: string }[] = [
    { value: 'center', label: 'Giữa' },
    { value: 'left', label: 'Trái' }
  ];
  
  const constraint = LANGUAGE_CONSTRAINTS[language || 'vi'] || LANGUAGE_CONSTRAINTS['vi'];
  const [minChars, maxChars] = constraint.charRange;
  const charCount = item.content.length;
  const isValid = charCount >= minChars && charCount <= maxChars;

  const handleApplyAll = () => {
    onApplyStyleToAll({
      textPosition: item.textPosition,
      alignment: item.alignment,
      textColor: item.textColor,
      fontSize: item.fontSize,
      overlayColor: item.overlayColor,
      overlayOpacity: item.overlayOpacity,
      showOverlay: item.showOverlay
    });
  };

  return (
    <div className={`${theme.colors.cardBackground} rounded-[32px] shadow-sm border ${theme.colors.border} overflow-hidden flex flex-col h-full group transition-all hover:shadow-md`}>
      {/* Header */}
      <div className={`px-5 py-4 ${theme.colors.secondaryBg} border-b ${theme.colors.borderLight} flex justify-between items-center`}>
         <span className={`font-black text-[10px] ${theme.colors.textSecondary} uppercase tracking-tighter`}>Slide #{item.id}</span>
         {item.loading && (
           <div className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"></div>
             <span className="text-[10px] text-orange-600 font-black animate-pulse uppercase">Đang xử lý...</span>
           </div>
         )}
      </div>

      <div className="p-5 flex flex-col gap-5 flex-1">
         {/* Text Content Input */}
         <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-widest`}>Nội dung chữ trên ảnh</label>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-all ${
                  isValid 
                  ? 'bg-green-100 text-green-700' 
                  : charCount > maxChars || (charCount > 0 && charCount < minChars)
                    ? 'bg-orange-100 text-orange-600'
                    : `${theme.colors.secondaryBg} ${theme.colors.textSecondary}`
                }`}>
                  {charCount}/{maxChars}
                </span>
              </div>
            </div>
            <textarea
               className={`w-full p-4 ${theme.colors.secondaryBg} border ${theme.colors.border} rounded-2xl text-sm font-bold ${theme.colors.textPrimary} focus:ring-4 focus:ring-orange-50 focus:border-orange-400 outline-none resize-none transition-all leading-relaxed`}
               rows={3}
               value={item.content}
               onChange={(e) => onTextChange(item.id, e.target.value)}
               placeholder={`Nhập nội dung slide (Bắt buộc ${minChars}-${maxChars} ký tự)...`}
            />
         </div>

         {/* Image Area */}
         <div className={`relative aspect-[3/4] ${theme.colors.secondaryBg} rounded-[24px] overflow-hidden border ${theme.colors.borderLight} group`}>
            {item.imageUrl ? (
               <img src={item.imageUrl} alt={`Slide ${item.id}`} className="w-full h-full object-cover" />
            ) : (
               <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center ${theme.colors.textSecondary}`}>
                  {item.loading ? (
                     <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                     <div className="flex flex-col items-center gap-3">
                        <div className={`${theme.colors.cardBackground} w-14 h-14 rounded-full flex items-center justify-center shadow-sm`}>
                           <svg className="w-7 h-7 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Ready to Gen</span>
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* Per-Slide Config */}
         <div className="space-y-4 pt-2">
            {/* --- NÚT ÁP DỤNG TẤT CẢ TỔNG HỢP --- */}
            <button 
                onClick={handleApplyAll}
                style={{ backgroundColor: 'var(--primary-color)' }}
                className="w-full py-2.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                title="Áp dụng Vị trí, Căn lề, Màu chữ, Kích cỡ và Lớp phủ này cho tất cả slide"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Áp dụng cho tất cả
            </button>

            <div className={`space-y-1.5 px-1 pt-2 border-t ${theme.colors.borderLight}`}>
              <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest block">Mô tả hình ảnh & Chỉnh sửa</label>
              <textarea
                  value={item.regenerateNote}
                  onChange={(e) => onNoteChange(item.id, e.target.value)}
                  placeholder="VD: Đổi bối cảnh, nhân vật đang cười, thêm sản phẩm..."
                  className={`w-full px-4 py-3 text-sm border ${theme.colors.border} rounded-2xl focus:ring-4 focus:ring-orange-50 outline-none resize-none font-bold ${theme.colors.secondaryBg} focus:${theme.colors.cardBackground} transition-all shadow-inner ${theme.colors.textPrimary}`}
                  rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 px-1">
                <label className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-widest block`}>Vị trí (Pos)</label>
                <div className="grid grid-cols-1 gap-1">
                  {positions.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => onPositionChange(item.id, pos)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${
                        item.textPosition === pos 
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : `${theme.colors.borderLight} ${theme.colors.cardBackground} ${theme.colors.textSecondary} hover:${theme.colors.border}`
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2 px-1">
                <label className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-widest block`}>Căn lề (Align)</label>
                <div className="grid grid-cols-1 gap-1">
                  {alignments.map((align) => (
                    <button
                      key={align.value}
                      onClick={() => onAlignmentChange(item.id, align.value)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${
                        (item.alignment || 'center') === align.value 
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : `${theme.colors.borderLight} ${theme.colors.cardBackground} ${theme.colors.textSecondary} hover:${theme.colors.border}`
                      }`}
                    >
                      {align.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 px-1">
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-widest block`}>Màu chữ</label>
                  <div className={`w-3 h-3 rounded-full border ${theme.colors.borderLight}`} style={{ backgroundColor: item.textColor }}></div>
                </div>
                <div className={`relative h-10 w-full rounded-xl overflow-hidden border-2 ${theme.colors.borderLight} hover:${theme.colors.border} transition-all`}>
                  <input 
                    type="color" 
                    value={item.textColor}
                    onChange={(e) => onColorChange(item.id, e.target.value)}
                    className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer scale-[2]"
                  />
                </div>
              </div>

              <div className="space-y-2 px-1">
                <label className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-widest block`}>Kích cỡ (px)</label>
                <input 
                  type="number" 
                  value={item.fontSize}
                  min={20}
                  max={200}
                  onChange={(e) => onFontSizeChange(item.id, parseInt(e.target.value) || 60)}
                  className={`w-full h-10 px-3 ${theme.colors.secondaryBg} border-2 ${theme.colors.borderLight} rounded-xl text-xs font-bold ${theme.colors.textPrimary} focus:border-orange-400 outline-none transition-all`}
                />
              </div>
            </div>

            <div className="space-y-2 px-1">
              <div className="flex justify-between items-center">
                <label className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-widest block`}>Lớp phủ ({item.overlayOpacity || 60}%)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={item.showOverlay !== false} 
                    onChange={(e) => onToggleOverlay(item.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <div className={`w-3 h-3 rounded-full border ${theme.colors.borderLight}`} style={{ backgroundColor: item.overlayColor }}></div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className={`relative h-10 flex-1 rounded-xl overflow-hidden border-2 transition-all ${item.showOverlay === false ? 'opacity-50 grayscale border-slate-100' : `${theme.colors.borderLight} hover:${theme.colors.border}`}`}>
                  <input 
                    type="color" 
                    value={item.overlayColor}
                    disabled={item.showOverlay === false}
                    onChange={(e) => onOverlayColorChange(item.id, e.target.value)}
                    className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer scale-[2] disabled:cursor-not-allowed"
                  />
                </div>
                <div className={`relative h-10 w-20 rounded-xl overflow-hidden border-2 transition-all ${item.showOverlay === false ? 'opacity-50 grayscale border-slate-100' : `${theme.colors.borderLight} hover:${theme.colors.border}`}`}>
                  <input 
                    type="number" 
                    min={0}
                    max={100}
                    value={item.overlayOpacity || 60}
                    disabled={item.showOverlay === false}
                    onChange={(e) => onOverlayOpacityChange(item.id, parseInt(e.target.value) || 0)}
                    className={`w-full h-full px-2 text-center text-xs font-bold ${theme.colors.textPrimary} outline-none disabled:cursor-not-allowed ${theme.colors.cardBackground}`}
                  />
                </div>
              </div>
            </div>
         </div>

          {/* Actions */}
          <div className="mt-auto pt-2 flex flex-col gap-2">
             <div className="flex gap-2">
                <button
                   onClick={() => onGenerate(item.id)}
                   disabled={item.loading || !item.content.trim()}
                   style={{ backgroundColor: item.loading || !item.content.trim() ? undefined : 'var(--primary-color)' }}
                   className={`flex-1 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest shadow-xl ${
                      item.loading || !item.content.trim()
                      ? `${theme.colors.secondaryBg} ${theme.colors.textSecondary} cursor-not-allowed border ${theme.colors.borderLight} shadow-none`
                      : 'text-white'
                   }`}
                >
                   {item.imageUrl ? "VẼ LẠI ẢNH" : "TẠO ẢNH"}
                </button>
                <button
                   onClick={() => onGenerateImagePrompt(item.id)}
                   disabled={item.imagePrompt?.loading}
                   style={{ backgroundColor: 'var(--primary-color)' }}
                   className="flex-1 py-4 text-white hover:opacity-90 font-black rounded-2xl text-[10px] transition-all uppercase tracking-widest shadow-lg disabled:opacity-50"
                >
                   {item.imagePrompt?.loading ? "ĐANG TẠO..." : "PROMPT ẢNH"}
                </button>
             </div>

             {item.imagePrompt?.visible && (
                <div className={`mt-4 p-4 ${theme.colors.buttonSecondary} rounded-2xl border border-orange-800 animate-slideUp`}>
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[8px] font-black text-orange-300 uppercase tracking-widest">Image Prompt Ready</span>
                      <button 
                         onClick={() => handleCopy(item.imagePrompt?.text || '')} 
                         className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus ? 'text-green-400' : 'text-white underline'}`}
                      >
                         {copyStatus ? 'COPIED!' : 'Copy'}
                      </button>
                   </div>
                   {item.imagePrompt?.loading ? (
                      <div className="h-20 flex items-center justify-center bg-orange-950 rounded-xl border border-orange-800">
                         <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                   ) : (
                      <textarea 
                         readOnly 
                         onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                         className="w-full h-20 bg-orange-950 text-orange-100 text-[9px] p-3 rounded-xl border border-orange-800 focus:outline-none resize-none font-mono italic opacity-80 leading-snug"
                         value={item.imagePrompt?.text}
                      />
                   )}
                </div>
             )}
          </div>
          
          {item.error && <p className="text-[10px] text-orange-500 font-black text-center bg-orange-50 py-2 rounded-xl border border-orange-100 px-3">{item.error}</p>}
      </div>
    </div>
  );
};

export default CarouselCard;
