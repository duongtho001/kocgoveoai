
import React, { useRef, useState } from 'react';
import { GeneratedImage, VideoPromptState } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { theme } from '../constants/colors';

export const KOC_POSES = [
  { "value": "", "label": "-- Chọn tư thế nhân vật --" },
  { "value": "hold_two_hands_front", "label": "Cầm sản phẩm bằng hai tay trước ngực" },
  { "value": "hold_one_hand_front", "label": "Cầm sản phẩm một tay ngang ngực" },
  { "value": "hold_and_point", "label": "Cầm sản phẩm và chỉ tay vào sản phẩm" },
  { "value": "stand_next_to_product", "label": "Đứng bên cạnh sản phẩm" },
  { "value": "product_on_table", "label": "Sản phẩm đặt trên bàn, nhân vật đứng phía sau" },
  { "value": "offer_to_camera", "label": "Đưa sản phẩm về phía camera" },
  { "value": "explain_with_hand", "label": "Cầm sản phẩm và giải thích bằng tay còn lại" },
  { "value": "inspect_product", "label": "Cúi nhìn, soi kỹ sản phẩm" },
  { "value": "rotate_product", "label": "Xoay sản phẩm để review các góc" },
  { "value": "compare_two_products", "label": "So sánh hai sản phẩm trên hai tay" },
  { "value": "product_near_face", "label": "Đặt sản phẩm gần mặt để so kích thước" },
  { "value": "using_product", "label": "Đang sử dụng sản phẩm thực tế" },
  { "value": "setup_product", "label": "Đang setup / lắp đặt sản phẩm" },
  { "value": "desk_usage", "label": "Sử dụng sản phẩm trên bàn làm việc" },
  { "value": "pov_thinking", "label": "Nhìn sản phẩm với vẻ suy tư (POV)" },
  { "value": "product_aside_story", "label": "Sản phẩm đặt bên cạnh – kể chuyện đời sống" },
  { "value": "realization_face", "label": "Nhìn sản phẩm với vẻ tỉnh ngộ / bất ngờ" },
  { "value": "cta_raise_product", "label": "Giơ sản phẩm lên cao (CTA)" },
  { "value": "cta_point_camera", "label": "Chỉ vào sản phẩm và nhìn thẳng camera" },
  { "value": "cta_thumb_up", "label": "Cầm sản phẩm và giơ ngón cái" },
  { "value": "cta_close_camera", "label": "Đưa sản phẩm sát camera (cận cảnh)" }
];

export const NONFACE_POSES = [
  { "value": "", "label": "-- Cách sản phẩm xuất hiện --" },
  { "value": "using_product", "label": "Đang sử dụng sản phẩm thực tế" },
  { "value": "on_table", "label": "Sản phẩm đặt trên bàn" },
  { "value": "hanging", "label": "Sản phẩm treo trên giá/kệ" },
  { "value": "holding_2_hands", "label": "Cầm sản phẩm 2 tay" },
  { "value": "holding_1_hand_pointing", "label": "Cầm sản phẩm 1 tay 1 tay chỉ vào sản phẩm" },
  { "value": "setting_up", "label": "Đang setup lắp đặt sản phẩm" },
  { "value": "raising_high", "label": "Giơ sản phẩm lên cao" }
];

export const CAMERA_ANGLES = [
  { value: "", label: "-- GÓC CHỤP SẢN PHẨM --" },
  { value: "front view", label: "CHÍNH DIỆN (0°)" },
  { value: "front-right quarter view", label: "NGHIÊNG 45° (FRONT-RIGHT)" },
  { value: "right side view", label: "GÓC NGANG 90° (RIGHT SIDE)" },
  { value: "left side view", label: "GÓC NGANG 270° (LEFT SIDE)" },
  { value: "front-left quarter view", label: "NGHIÊNG 315° (FRONT-LEFT)" }
];

export const CAMERA_SHOTS = [
  { value: "", label: "-- GÓC QUAY (SHOT TYPE) --" },
  { value: "Wide Angle Shot", label: "1. Góc quay đại cảnh (Wide Angle)" },
  { value: "Medium Shot", label: "2. Góc quay trung cảnh (Medium Shot)" },
  { value: "Close-up Shot", label: "3. Góc quay cận cảnh (Close-up)" }
];

export const IMAGE_FORMATS = [
  { value: "", label: "-- ĐỊNH DẠNG HÌNH ẢNH --" },
  { value: "with_koc", label: "Có KOC (Tham chiếu nhân vật)" },
  { value: "no_character", label: "Không xuất hiện nhân vật (Chỉ sản phẩm)" },
  { value: "hands_only", label: "Có xuất hiện tay (Chỉ bàn tay)" },
  { value: "legs_only", label: "Đang đi sử dụng sản phẩm (cận chân)" }
];

interface ImageCardProps {
  label: string;
  imageData: GeneratedImage;
  videoPrompt: VideoPromptState;
  imagePrompt?: VideoPromptState;
  onGeneratePrompt: () => void;
  onGenerateImagePrompt?: () => void;
  onRegenerate: () => void;
  onGenerateVideo?: () => void;
  onTranslate: (type: 'image' | 'video') => void;
  onUpload?: (file: File) => void;
  onDelete?: () => void;
  customPrompt: string;
  onCustomPromptChange: (text: string) => void;
  onPoseChange?: (pose: string) => void;
  pose?: string;
  onAngleChange?: (angle: string) => void;
  angle?: string;
  onFormatChange?: (format: string) => void;
  format?: string;
  onShotChange?: (shot: string) => void;
  shot?: string;
  onSpeakerChange?: (speaker: string) => void;
  speaker?: string;
  speakerOptions?: { value: string, label: string }[];
  poseOptions?: { value: string, label: string }[];
  outfitImage?: { url: string; loading: boolean };
  onOutfitUpload?: (file: File) => void;
  onOutfitDelete?: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ 
  label, 
  imageData, 
  videoPrompt, 
  imagePrompt,
  onGeneratePrompt, 
  onGenerateImagePrompt,
  onRegenerate, 
  onGenerateVideo,
  onTranslate,
  onUpload,
  onDelete,
  customPrompt,
  onCustomPromptChange,
  onPoseChange,
  pose,
  onAngleChange,
  angle,
  onFormatChange,
  format,
  onShotChange,
  shot,
  onSpeakerChange,
  speaker,
  speakerOptions,
  poseOptions = KOC_POSES,
  outfitImage,
  onOutfitUpload,
  onOutfitDelete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<{[key: string]: boolean}>({});

  const handleCopy = async (text: string, type: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopyStatus(prev => ({ ...prev, [type]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [type]: false }));
      }, 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onUpload) {
      onUpload(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!onUpload) return;
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Try items first
    const items = clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            onUpload(file);
            return;
          }
        }
      }
    }

    // Fallback to files
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        if (clipboardData.files[i].type.startsWith('image/')) {
          onUpload(clipboardData.files[i]);
          return;
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpload) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      onUpload(files[0]);
    }
  };

  return (
    <div className={`flex flex-col ${theme.colors.cardBackground} rounded-xl shadow-sm border ${theme.colors.borderLight} overflow-hidden relative`}>
      {/* Header */}
      <div className={`px-4 py-3 ${theme.colors.secondaryBg} border-b ${theme.colors.borderLight} flex justify-between items-center notranslate`} translate="no">
        <div className="flex items-center gap-2">
           <span className={`font-semibold text-sm ${theme.colors.textPrimary}`}>{label} Visual</span>
           {onOutfitUpload && (
              <div className="flex items-center gap-1 ml-2">
                 <div 
                    onClick={() => outfitInputRef.current?.click()}
                    className={`w-8 h-8 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative ${
                       outfitImage?.url ? 'border-brand-primary' : `${theme.colors.borderLight} hover:border-brand-primary/80`
                    }`}
                    title="Tải ảnh trang phục tham chiếu"
                 >
                    {outfitImage?.url ? (
                       <>
                          <img src={outfitImage.url} className="w-full h-full object-cover" alt="Outfit" />
                          <button 
                             onClick={(e) => { e.stopPropagation(); onOutfitDelete?.(); }}
                             className="absolute -top-1 -right-1 w-4 h-4 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-sm hover:bg-brand-primary-hover z-10"
                          >
                             <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                       </>
                    ) : (
                       <svg className={`w-4 h-4 ${theme.colors.textSecondary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    )}
                    <input 
                       type="file" 
                       ref={outfitInputRef} 
                       onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onOutfitUpload(file);
                          if (outfitInputRef.current) outfitInputRef.current.value = '';
                       }} 
                       className="hidden" 
                       accept="image/*" 
                    />
                 </div>
                 <span className={`text-xs font-bold ${theme.colors.textSecondary} uppercase tracking-tighter`}>Outfit</span>
              </div>
           )}
        </div>
        {(imageData.loading || imagePrompt?.loading) && <span className="text-xs text-brand-primary animate-pulse">Generating...</span>}
      </div>

      {/* Image Display Area */}
      <div 
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={(e) => e.currentTarget.focus()}
        tabIndex={0}
        className={`aspect-[9/16] relative ${theme.colors.secondaryBg} w-full group focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer`}
      >
        {imageData.url ? (
          <>
            <img 
              src={imageData.url} 
              alt={`${label} generated`} 
              className="w-full h-full object-cover"
            />
            {onDelete && (
              <button 
                onClick={onDelete}
                className="absolute top-2 right-2 w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-lg hover:bg-brand-primary-hover transition-all z-10"
                title="Xóa hình ảnh"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            {imageData.loading ? (
              <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2"></div>
            ) : imageData.error ? (
              <div className="flex flex-col items-center gap-2">
                 <span className="text-brand-primary text-xs">{imageData.error}</span>
                 <button onClick={onRegenerate} className="px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold shadow-md">Thử lại</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <span className={`text-xs uppercase font-bold tracking-widest px-4 ${theme.colors.textSecondary}`}>Kịch bản đã sẵn sàng</span>
                
                <button 
                    onClick={onRegenerate} 
                    className={`w-48 py-3 ${theme.colors.buttonPrimary} text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 uppercase`}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" clipRule="evenodd" /></svg>
                    TẠO ẢNH AI
                </button>

                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`w-48 py-3 ${theme.colors.secondaryBg} hover:${theme.colors.borderLight} ${theme.colors.textPrimary} rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 uppercase`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    TẢI ẢNH LÊN
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Select Pose, Angle, Shot & Custom Prompt Input */}
      <div className={`px-3 py-2 ${theme.colors.secondaryBg} border-t ${theme.colors.borderLight} space-y-2`}>
        {onPoseChange && (
          <select 
            value={pose || ""} 
            onChange={(e) => onPoseChange(e.target.value)}
            className={`w-full text-xs font-bold p-2 rounded border ${theme.colors.borderLight} focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none ${theme.colors.cardBackground} ${theme.colors.textPrimary} uppercase shadow-sm`}
          >
            {poseOptions.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        )}

        {onFormatChange && (
          <select 
            value={format || ""} 
            onChange={(e) => onFormatChange(e.target.value)}
            className={`w-full text-xs font-black p-2 rounded border outline-none transition-all shadow-sm uppercase ${
              format 
              ? 'bg-brand-primary text-white border-brand-primary-hover' 
              : `${theme.colors.cardBackground} ${theme.colors.textSecondary} ${theme.colors.borderLight}`
            }`}
          >
            {IMAGE_FORMATS.map(opt => (
              <option 
                key={opt.value} 
                value={opt.value} 
                className={`${theme.colors.cardBackground} ${theme.colors.textPrimary} font-bold`}
              >
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {onAngleChange && (
          <select 
            value={angle || ""} 
            onChange={(e) => onAngleChange(e.target.value)}
            className={`w-full text-xs font-black p-2 rounded border outline-none transition-all shadow-sm uppercase ${
              angle 
              ? 'bg-brand-primary text-white border-brand-primary-hover' 
              : `${theme.colors.cardBackground} ${theme.colors.textSecondary} ${theme.colors.borderLight}`
            }`}
          >
            {CAMERA_ANGLES.map(opt => (
              <option 
                key={opt.value} 
                value={opt.value} 
                className={`${theme.colors.cardBackground} ${theme.colors.textPrimary} font-bold`}
              >
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {onSpeakerChange && speakerOptions && (
          <select 
            value={speaker || ""} 
            onChange={(e) => onSpeakerChange(e.target.value)}
            className={`w-full text-xs font-black p-2 rounded border outline-none transition-all shadow-sm uppercase ${
              speaker 
              ? 'bg-brand-primary text-white border-brand-primary-hover' 
              : `${theme.colors.cardBackground} ${theme.colors.textSecondary} ${theme.colors.borderLight}`
            }`}
          >
            <option value="">-- CHỌN NGƯỜI NÓI --</option>
            {speakerOptions.map(opt => (
              <option 
                key={opt.value} 
                value={opt.value} 
                className={`${theme.colors.cardBackground} ${theme.colors.textPrimary} font-bold`}
              >
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {onShotChange && (
          <select 
            value={shot || ""} 
            onChange={(e) => onShotChange(e.target.value)}
            className={`w-full text-xs font-black p-2 rounded border outline-none transition-all shadow-sm uppercase ${
              shot 
              ? 'bg-brand-primary text-white border-brand-primary-hover' 
              : `${theme.colors.cardBackground} ${theme.colors.textSecondary} ${theme.colors.borderLight}`
            }`}
          >
            {CAMERA_SHOTS.map(opt => (
              <option 
                key={opt.value} 
                value={opt.value} 
                className={`${theme.colors.cardBackground} ${theme.colors.textPrimary} font-bold`}
              >
                {opt.label}
              </option>
            ))}
          </select>
        )}

        <textarea
          value={customPrompt || ''}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="Ghi chú thêm (VD: bối cảnh quán cafe, xóa sản phẩm...)"
          className={`w-full text-xs p-2 rounded border ${theme.colors.borderLight} focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none resize-none ${theme.colors.cardBackground} ${theme.colors.textPrimary} placeholder:${theme.colors.textSecondary} font-medium`}
          rows={2}
        />
      </div>

      {/* Action Footer */}
      <div className={`p-3 border-t ${theme.colors.borderLight} ${theme.colors.cardBackground} flex flex-wrap gap-2`}>
        <button
          onClick={onRegenerate}
          disabled={imageData.loading}
          className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg text-xs font-bold transition-all border ${theme.colors.borderLight} ${theme.colors.textPrimary} hover:${theme.colors.secondaryBg} flex items-center justify-center gap-2 notranslate ${
            imageData.loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          translate="no"
        >
          {imageData.loading && <div className={`w-3 h-3 border-2 ${theme.colors.textSecondary} border-t-${theme.colors.textPrimary} rounded-full animate-spin`} />}
          <span>{imageData.url ? "Tạo lại AI" : "Tạo ảnh AI"}</span>
        </button>
        
        {onGenerateImagePrompt && (
          <button
            onClick={onGenerateImagePrompt}
            disabled={imagePrompt?.loading}
            className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 notranslate ${imagePrompt?.loading ? 'cursor-wait opacity-70' : ''}`}
            style={{ backgroundColor: 'var(--primary-color)' }}
            translate="no"
          >
            {imagePrompt?.loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>{imagePrompt?.loading ? 'Thinking...' : 'Prompt Ảnh'}</span>
          </button>
        )}

        <button
          onClick={onGeneratePrompt}
          disabled={!imageData.url || videoPrompt.loading || imageData.loading}
          className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 notranslate ${
            !imageData.url || imageData.loading
              ? `${theme.colors.secondaryBg} ${theme.colors.textSecondary} cursor-not-allowed`
              : videoPrompt.loading
                ? 'bg-brand-primary/10 text-brand-primary cursor-wait'
                : 'text-white shadow-md'
          }`}
          style={(!imageData.url || imageData.loading || videoPrompt.loading) ? {} : { backgroundColor: 'var(--primary-color)' }}
          translate="no"
        >
          {videoPrompt.loading && <div className={`w-3 h-3 border-2 rounded-full animate-spin ${videoPrompt.loading ? 'border-brand-primary/30 border-t-brand-primary' : 'border-white/30 border-t-white'}`} />}
          <span>{videoPrompt.loading ? 'Writing...' : 'Video Prompt'}</span>
        </button>
      </div>

      {/* Video Generation Button */}
      {onGenerateVideo && videoPrompt.text && (
        <div className={`px-3 pb-3 ${theme.colors.cardBackground}`}>
          <button
            onClick={onGenerateVideo}
            disabled={imageData.videoLoading || !videoPrompt.text}
            className={`w-full py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider active:scale-95 ${
              imageData.videoLoading
                ? 'bg-violet-500/20 text-violet-400 cursor-wait'
                : imageData.videoUrl
                  ? 'bg-emerald-600 text-white shadow-lg hover:bg-emerald-700'
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:scale-[1.02]'
            }`}
          >
            {imageData.videoLoading ? (
              <><div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> Đang tạo video...</>
            ) : imageData.videoUrl ? (
              <><span>🎥</span> Tạo lại Video</>
            ) : (
              <><span>🎥</span> Tạo Video</>
            )}
          </button>
        </div>
      )}

      {/* Video Preview */}
      {imageData.videoUrl && (
        <div className={`border-t ${theme.colors.borderLight}`}>
          <video
            src={imageData.videoUrl}
            controls
            className="w-full aspect-[9/16] bg-black"
            playsInline
          />
        </div>
      )}

      {/* Image Prompt Result Overlay */}
      {imagePrompt?.visible && (
        <div className="p-3 bg-brand-primary/90 border-t border-brand-primary/80">
           <div className="flex justify-between items-center mb-2">
             <h4 className="text-white text-xs uppercase font-bold tracking-wider">Technical Image Prompt</h4>
             <div className="flex gap-2">
               <button 
                 onClick={() => handleCopy(imagePrompt.text, 'image')}
                 className={`text-xs underline font-bold transition-colors w-16 text-right ${copyStatus['image'] ? 'text-green-400' : 'text-white/80 hover:text-white'}`}
               >
                 {copyStatus['image'] ? 'Copied!' : 'Copy'}
               </button>
             </div>
           </div>
           {imagePrompt.loading ? (
             <div className="h-24 flex items-center justify-center bg-white/10 rounded border border-white/20">
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
             </div>
           ) : (
             <textarea 
               readOnly 
               onClick={(e) => (e.target as HTMLTextAreaElement).select()}
               className="w-full h-24 bg-white/10 text-white text-[10px] p-2 rounded border border-white/20 focus:outline-none resize-none font-mono"
               value={imagePrompt.text}
             />
           )}
        </div>
      )}

      {/* Video Prompt Result Overlay */}
      {videoPrompt.visible && (
        <div className={`p-3 bg-slate-900 border-t border-slate-800`}>
           <div className="flex justify-between items-center mb-2">
             <h4 className="text-brand-primary text-xs uppercase font-bold tracking-wider">VEO-3 Prompt</h4>
             <div className="flex gap-2">
               <button 
                  onClick={() => onTranslate('video')}
                 disabled={videoPrompt.translating}
                 className="text-xs text-brand-primary hover:text-brand-primary-hover font-bold"
               >
                 {videoPrompt.translating ? '...' : 'Dịch'}
               </button>
               <button 
                 onClick={() => handleCopy(videoPrompt.text, 'video')}
                 className={`text-xs underline font-bold transition-colors w-16 text-right ${copyStatus['video'] ? 'text-green-400' : 'text-slate-400 hover:text-white'}`}
               >
                 {copyStatus['video'] ? 'Copied!' : 'Copy'}
               </button>
             </div>
           </div>
           {videoPrompt.loading ? (
             <div className="h-24 flex items-center justify-center bg-slate-950 rounded border border-slate-800">
                <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
             </div>
           ) : (
             <textarea 
               readOnly 
               onClick={(e) => (e.target as HTMLTextAreaElement).select()}
               className="w-full h-24 bg-slate-950 text-slate-300 text-xs p-2 rounded border border-slate-800 focus:outline-none resize-none font-mono"
               value={videoPrompt.text}
             />
           )}
        </div>
      )}
    </div>
  );
};

export default ImageCard;
