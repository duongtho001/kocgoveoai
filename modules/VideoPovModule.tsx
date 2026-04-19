
import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/videoPovService';
import { runBatch, getConcurrencySettings } from '../services/concurrencyService';
import { PovScriptSegment } from '../types';
import { copyToClipboard } from '../utils/clipboard';
import { theme } from '../constants/colors';

declare var JSZip: any;

const STYLES = [
    { id: 'tâm sự trải lòng', label: 'Tâm sự trải lòng (Deep/Emotional)' },
    { id: 'vui vẻ hài hước', label: 'Vui vẻ hài hước (Funny/Humorous)' },
    { id: 'kịch tính & cảm xúc', label: 'Kịch tính & cảm xúc (Dramatic)' },
    { id: 'chuyên gia phân tích', label: 'Chuyên gia phân tích (Analytical)' },
    { id: 'kể chuyện drama', label: 'Kể chuyện Drama (Storytelling)' },
    { id: 'vlog đời thường', label: 'Vlog đời thường (Daily Vlog)' },
    { id: 'hào hứng bắt trend', label: 'Hào hứng - Bắt trend (Excited/Trendy)' },
    { id: 'thư giãn healing', label: 'Thư giãn - Healing (Chill)' },
    { id: 'châm biếm sarki', label: 'Châm biếm - Sarky (Sarcastic)' },
    { id: 'thực chiến hậu trường', label: 'Thực chiến - Hậu trường (Real/BTS)' },
    { id: 'phản biện góc nhìn ngược', label: 'Phản biện - Góc nhìn ngược (Contrarian)' },
    { id: 'thẳng thắn gắt', label: 'Thẳng thắn - Gắt (Brutal Honesty)' },
    { id: 'truyền cảm hứng', label: 'Truyền cảm hứng (Motivational)' },
    { id: 'điện ảnh nghệ thuật', label: 'Điện ảnh - Nghệ thuật (Cinematic)' },
    { id: 'so sánh đối chiếu', label: 'So sánh & Đối chiếu (Comparison/Versus)' },
    { id: 'giải mã bóc trần', label: 'Giải mã & Bóc trần (Myth-Busting)' },
    { id: 'tổng hợp top list', label: 'Tổng hợp & Top List (Curator/Listicle)' },
    { id: 'thử thách trải nghiệm', label: 'Thử thách & Trải nghiệm (Challenge)' }
];

const SCENE_COUNT_OPTIONS = Array.from({ length: 20 }, (_, i) => {
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

const CHARACTER_POSES = [
  { "value": "", "label": "-- Chọn tư thế nhân vật --" },
  { "value": "pov_eye_contact_subtle", "label": "Ngồi yên, ánh mắt di chuyển nhẹ" },
  { "value": "pov_look_down_hands", "label": "Nhìn xuống tay khi tự sự" },
  { "value": "pov_cover_mouth_chin", "label": "Tay che cằm/miệng, nói chậm" },
  { "value": "pov_edge_frame_space", "label": "Ngồi lệch khung, nhiều khoảng trống" },
  { "value": "pov_lean_back_look_up", "label": "Tựa ghế, nhìn trần nhà hồi tưởng" },
  { "value": "pov_nod_acceptance", "label": "Cúi đầu, gật nhẹ xác nhận" },
  { "value": "pov_45_angle_away", "label": "Nghiêng 45°, không nhìn camera" },
  { "value": "pov_hands_clasped_table", "label": "Hai tay đan trên bàn, căng thẳng" },
  { "value": "pov_still_standing", "label": "Đứng yên, tay buông, ánh mắt nói" },
  { "value": "pov_look_then_turn_away", "label": "Nhìn camera rồi quay đi" },
  { "value": "pov_exhale_before_speak", "label": "Thở ra nhẹ trước khi nói" },
  { "value": "pov_rub_face_fatigue", "label": "Xoa mặt, mệt mỏi" },
  { "value": "pov_pause_silence", "label": "Im lặng vài giây nhìn xuống" },
  { "value": "pov_hold_object_idle", "label": "Cầm đồ vật, xoay nhẹ khi nói" },
  { "value": "pov_half_smile_realization", "label": "Cười nhạt khi tỉnh ngộ" }
];

const IMAGE_FORMATS = [
  { id: 'with_koc', label: 'CÓ KOC (Tham chiếu nhân vật)' },
  { id: 'no_character', label: 'Không xuất hiện nhân vật (chỉ bối cảnh)' },
  { id: 'hand_only', label: 'Có xuất hiện tay (chỉ bàn tay)' }
];

interface VideoPovModuleProps {
  language?: string;
}

const VideoPovModule: React.FC<VideoPovModuleProps> = ({ language = 'vi' }) => {
  const storageKey = "videopov_project_v18_poses";
  const [state, setState] = useState<any>({
    videoFile: null,
    videoPreviewUrl: null,
    originalScriptInput: '',
    analysis: '',
    isAnalyzing: false,
    style: 'châm biếm sarki',
    gender: 'Nữ',
    voice: 'Giọng miền Bắc 20-30 tuổi',
    addressing: '',
    imageStyle: 'Realistic',
    characterDescription: '',
    outfitFile: null,
    outfitPreviewUrl: null,
    processedOutfitUrl: null,
    isExtractingOutfit: false,
    backgroundFile: null,
    backgroundPreviewUrl: null,
    isAnalyzingBackground: false,
    contextNote: '',
    segmentCount: 5,
    faceFile: null,
    facePreviewUrl: null,
    isGeneratingScript: false,
    isRegeneratingPart: {},
    segments: []
  });
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

  const videoInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);
  const [isBulkImageLoading, setIsBulkImageLoading] = useState(false);
  const [isBulkPromptLoading, setIsBulkPromptLoading] = useState(false);
  const [isBulkImagePromptLoading, setIsBulkImagePromptLoading] = useState(false);

  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setState((p:any)=>({
                ...p, 
                ...parsed, 
                videoFile: null, 
                videoPreviewUrl: null, 
                faceFile: null, 
                facePreviewUrl: null,
                outfitFile: null,
                backgroundFile: null,
                backgroundPreviewUrl: null,
                isRegeneratingPart: {},
                segments: (parsed.segments || []).map((seg: any) => ({
                    ...seg,
                    pose: seg.pose || '',
                    imageFormat: seg.imageFormat || 'with_koc',
                    image: seg.image || { url: '', loading: false, regenNote: '' },
                    imagePrompt: seg.imagePrompt || { text: '', loading: false, visible: false },
                    videoPrompt: seg.videoPrompt || { text: '', loading: false, visible: false }
                }))
            }));
          }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      const { videoFile, videoPreviewUrl, faceFile, facePreviewUrl, outfitFile, backgroundFile, segments, isAnalyzing, isGeneratingScript, isExtractingOutfit, isAnalyzingBackground, isRegeneratingPart, ...persistent } = state;
      const safeSegments = (segments || []).map((seg: any) => ({
        ...seg,
        image: { ...(seg.image || {}), url: '' }
      }));
      localStorage.setItem(storageKey, JSON.stringify({ ...persistent, segments: safeSegments }));
    } catch (e) {}
  }, [state]);

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
    const handleExport = async () => {
      const faceBase64 = await toBase64(state.facePreviewUrl);
      const outfitBase64 = await toBase64(state.processedOutfitUrl || state.outfitPreviewUrl);
      const backgroundBase64 = await toBase64(state.backgroundPreviewUrl);

      const exportData = await Promise.all(state.segments.map(async (seg: any, index: number) => {
        const segBgBase64 = await toBase64(seg.background?.url);
        return {
          stt: index + 1,
          inputs: {
            originalAnalysis: state.analysis,
            characterDescription: state.characterDescription,
            contextNote: state.contextNote,
            faceImage: faceBase64,
            outfitImage: outfitBase64,
            backgroundImage: backgroundBase64,
            segmentBackground: segBgBase64,
            settings: {
              style: state.style,
              gender: state.gender,
              voice: state.voice,
              addressing: state.addressing,
              imageStyle: state.imageStyle,
              pose: seg.pose || '',
              customPrompt: seg.image?.regenNote || ''
            }
          },
          script: seg.content,
          outputImage: seg.image?.url || '',
          videoPrompt: seg.videoPrompt?.text || '',
          imagePrompt: seg.imagePrompt?.text || ''
        };
      }));
      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { detail: { data: exportData, moduleName: 'Video_POV' } }));
    };

    const handleImport = async (e: any) => {
      const importedData = e.detail;
      if (!Array.isArray(importedData)) return;
      
      const firstItem = importedData[0];
      const inputs = firstItem.inputs || {};
      const settings = inputs.settings || {};

      const newState = { 
        ...state, 
        analysis: inputs.originalAnalysis || state.analysis,
        characterDescription: inputs.characterDescription || state.characterDescription,
        contextNote: inputs.contextNote || state.contextNote,
        facePreviewUrl: inputs.faceImage || state.facePreviewUrl,
        processedOutfitUrl: inputs.outfitImage || state.processedOutfitUrl,
        backgroundPreviewUrl: inputs.backgroundImage || state.backgroundPreviewUrl,
        style: settings.style || state.style,
        gender: settings.gender || state.gender,
        voice: settings.voice || state.voice,
        addressing: settings.addressing || state.addressing,
        imageStyle: settings.imageStyle || state.imageStyle,
        segments: [] 
      };

      const total = importedData.length;
      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const itemInputs = item.inputs || {};
        const itemSettings = itemInputs.settings || {};
        const itemSegmentData = itemInputs.segmentData || {};

        newState.segments.push({
          id: i + 1,
          content: item.script || '',
          pose: itemSettings.pose || '',
          imageFormat: itemSettings.imageFormat || 'with_koc',
          background: { url: itemInputs.segmentBackground || '', loading: false, file: null },
          image: { 
            url: item.outputImage || '', 
            loading: false, 
            regenNote: itemSettings.customPrompt || itemSegmentData.characterIdea || '' 
          },
          videoPrompt: { text: item.videoPrompt || '', loading: false, visible: true },
          imagePrompt: { text: item.imagePrompt || '', loading: false, visible: true }
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

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setState((p:any)=>({...p, videoFile: file, videoPreviewUrl: URL.createObjectURL(file), originalScriptInput: ''}));
    }
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setState((p:any)=>({...p, faceFile: file, facePreviewUrl: URL.createObjectURL(file)}));
    }
  };

  const handleOutfitUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setState((p:any)=>({...p, outfitFile: file, outfitPreviewUrl: URL.createObjectURL(file)}));
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setState((p:any)=>({...p, backgroundFile: file, backgroundPreviewUrl: URL.createObjectURL(file)}));
    }
  };

  const handleRemoveFace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((p:any)=>({...p, faceFile: null, facePreviewUrl: null}));
  };

  const handleRemoveOutfit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((p:any)=>({...p, outfitFile: null, outfitPreviewUrl: null, processedOutfitUrl: null}));
  };

  const handleRemoveBackground = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((p:any)=>({...p, backgroundFile: null, backgroundPreviewUrl: null}));
  };

  const handleExtractOutfit = async () => {
    let part = null;
    if (state.outfitFile) part = await service.fileToGenerativePart(state.outfitFile);
    else if (state.outfitPreviewUrl?.startsWith('data:')) part = { mimeType: 'image/png', data: state.outfitPreviewUrl.split(',')[1] };
    if (!part) return;
    setState((p:any) => ({ ...p, isExtractingOutfit: true }));
    try {
      const imgUrl = await service.extractOutfitImage(part);
      setState((p:any) => ({ ...p, processedOutfitUrl: imgUrl, isExtractingOutfit: false }));
    } catch (e) { setState((p:any) => ({ ...p, isExtractingOutfit: false })); }
  };

  const handleAnalyzeBackground = async () => {
    if (!state.contextNote && !state.backgroundPreviewUrl) return;
    setState((p:any) => ({ ...p, isAnalyzingBackground: true }));
    try {
      let bgPart = null;
      if (state.backgroundFile) bgPart = await service.fileToGenerativePart(state.backgroundFile);
      else if (state.backgroundPreviewUrl?.startsWith('data:')) bgPart = { mimeType: 'image/png', data: state.backgroundPreviewUrl.split(',')[1] };
      
      const detailedBg = await service.analyzeDetailedBackground(state.contextNote, bgPart);
      setState((p:any) => ({ ...p, contextNote: detailedBg, isAnalyzingBackground: false }));
    } catch (e) { setState((p:any) => ({ ...p, isAnalyzingBackground: false })); }
  };

  const handleAnalyze = async () => {
    if (!state.videoFile && !state.originalScriptInput.trim()) return;
    setState((p:any)=>({...p, isAnalyzing: true}));
    try {
        let res = state.videoFile ? await service.analyzeVideoContent(state.videoFile) : await service.analyzeTextContent(state.originalScriptInput);
        setState((p:any)=>({...p, analysis: res, isAnalyzing: false}));
    } catch(e) { setState((p:any)=>({...p, isAnalyzing: false})); }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, type: 'face' | 'outfit' | 'background') => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        const file = files[0];
        const previewUrl = URL.createObjectURL(file);
        if (type === 'face') setState((p:any)=>({...p, faceFile: file, facePreviewUrl: previewUrl}));
        else if (type === 'outfit') setState((p:any)=>({...p, outfitFile: file, outfitPreviewUrl: previewUrl}));
        else if (type === 'background') setState((p:any)=>({...p, backgroundFile: file, backgroundPreviewUrl: previewUrl}));
    }
  };

  const handleSegmentBackgroundUpload = (id: number, file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setState((p: any) => ({
      ...p,
      segments: p.segments.map((s: any) => s.id === id ? { ...s, background: { url, loading: false, file } } : s)
    }));
  };

  const handleRemoveSegmentBackground = (id: number) => {
    setState((p: any) => ({
      ...p,
      segments: p.segments.map((s: any) => s.id === id ? { ...s, background: { url: '', loading: false, file: null } } : s)
    }));
  };

  const handleSegmentDrop = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      handleSegmentBackgroundUpload(id, files[0]);
    }
  };

  const handleDeleteImage = (id: number) => {
    setState((p: any) => ({
      ...p,
      segments: p.segments.map((s: any) => s.id === id ? { ...s, image: { ...s.image, url: '' } } : s)
    }));
  };

  const handleUploadImage = async (id: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setState((p: any) => ({
        ...p,
        segments: p.segments.map((s: any) => s.id === id ? { ...s, image: { ...s.image, url, loading: false } } : s)
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleGenScript = async () => {
      const input = state.analysis || state.contextNote || state.characterDescription;
      if (!input) return;
      setState((p:any)=>({...p, isGeneratingScript: true}));
      try {
          const scripts = await service.generatePovSegments(input, state.style, state.segmentCount, state.gender, state.voice, state.addressing, state.characterDescription, state.contextNote, language);
          const newSegments: any[] = scripts.map((content: string, i: number) => ({
              id: i + 1,
              content: content,
              pose: '',
              imageFormat: 'with_koc',
              image: { url: '', loading: false, regenNote: '' },
              background: { url: '', loading: false, file: null },
              videoPrompt: { text: '', loading: false, visible: false }
          }));
          setState((p:any)=>({...p, segments: newSegments, isGeneratingScript: false}));
      } catch(e) { setState((p:any)=>({...p, isGeneratingScript: false})); }
  };

  const handleRegenSegmentScript = async (id: number) => {
    const seg = state.segments.find((s:any)=>s.id === id);
    const input = state.analysis || state.contextNote || state.characterDescription;
    if (!seg || !input) return;
    setState((p:any)=>({...p, isRegeneratingPart: { ...p.isRegeneratingPart, [id]: true }}));
    try {
      const allText = state.segments.map((s:any)=>s.content);
      const newText = await service.regeneratePovSegment(input, state.style, state.gender, state.voice, state.addressing, state.characterDescription, state.contextNote, seg.content, allText, language);
      setState((p:any)=>({
        ...p,
        isRegeneratingPart: { ...p.isRegeneratingPart, [id]: false },
        segments: p.segments.map((s:any)=>s.id === id ? { ...s, content: newText } : s)
      }));
    } catch(e) { setState((p:any)=>({...p, isRegeneratingPart: { ...p.isRegeneratingPart, [id]: false }})); }
  };

  const handleGenImage = async (id: number) => {
      const seg = state.segments.find((s:any)=>s.id === id);
      if (!seg) return;
      setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, image:{...s.image, loading:true}}:s)}));
      try {
          const facePart = state.faceFile ? await service.fileToGenerativePart(state.faceFile) : null;
          
          const outfitPart = state.processedOutfitUrl 
            ? { mimeType: 'image/png', data: state.processedOutfitUrl.split(',')[1] }
            : (state.outfitFile ? await service.fileToGenerativePart(state.outfitFile) : null);
          
          let bgPart = null;
          let finalContextNote = state.contextNote;

          if (seg.background?.file) {
            bgPart = await service.fileToGenerativePart(seg.background.file);
            finalContextNote = ""; // Ignore global context if segment background is provided
          } else if (state.backgroundFile) {
            bgPart = await service.fileToGenerativePart(state.backgroundFile);
          }
          
          const poseLabel = CHARACTER_POSES.find(opt => opt.value === seg.pose)?.label || "";

          const url = await service.generatePovImage(seg.content, facePart, state.gender, state.characterDescription, seg.image.regenNote, state.imageStyle, finalContextNote, outfitPart, poseLabel, bgPart, seg.imageFormat);
          setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, image:{...s.image, url, loading:false}}:s)}));
      } catch(e) { setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, image:{...s.image, loading:false}}:s)})); }
  };

  const handleGenPrompt = async (id: number) => {
      const seg = state.segments.find((s:any)=>s.id === id);
      if (!seg) return;
      setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, videoPrompt:{...s.videoPrompt, loading:true, visible:true}}:s)}));
      try {
          const poseLabel = CHARACTER_POSES.find(opt => opt.value === seg.pose)?.label || "";
          const finalContextNote = seg.background?.file ? "" : state.contextNote;
          const prompt = await service.formatVideoPrompt(seg.content, state.gender, state.voice, state.characterDescription, finalContextNote, state.imageStyle, seg.image?.url, poseLabel, seg.image?.regenNote, seg.imageFormat);
          setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, videoPrompt:{text: prompt, loading:false, visible:true}}:s)}));
      } catch(e) { setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, videoPrompt:{...s.videoPrompt, loading:false}}:s)})); }
  };

  const handleGenImagePrompt = async (id: number) => {
    const seg = state.segments.find((s:any)=>s.id === id);
    if (!seg) return;
    setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, imagePrompt:{...s.imagePrompt, loading:true, visible:true}}:s)}));
    try {
        const poseLabel = CHARACTER_POSES.find(opt => opt.value === seg.pose)?.label || "";
        const finalContextNote = seg.background?.file ? "" : state.contextNote;
        const prompt = await service.generatePovImagePromptAI(seg.content, state.gender, state.characterDescription, seg.image?.regenNote, state.imageStyle, finalContextNote, poseLabel, seg.imageFormat);
        setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, imagePrompt:{text: prompt, loading:false, visible:true}}:s)}));
    } catch(e) { setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===id?{...s, imagePrompt:{...s.imagePrompt, loading:false}}:s)})); }
  };

  const handleBulkImage = async () => {
    if (state.segments.length === 0) return;
    setIsBulkImageLoading(true);
    const { imageConcurrency } = getConcurrencySettings();
    await runBatch(
      state.segments.map((seg: any) => ({ key: String(seg.id), fn: () => handleGenImage(seg.id) })),
      imageConcurrency
    );
    setIsBulkImageLoading(false);
  };

  const handleBulkImagePrompt = async () => {
    if (state.segments.length === 0) return;
    setIsBulkImagePromptLoading(true);
    const { imagePromptConcurrency } = getConcurrencySettings();
    await runBatch(
      state.segments.map((seg: any) => ({ key: String(seg.id), fn: () => handleGenImagePrompt(seg.id) })),
      imagePromptConcurrency
    );
    setIsBulkImagePromptLoading(false);
  };

  const handleBulkPrompt = async () => {
    if (state.segments.length === 0) return;
    setIsBulkPromptLoading(true);
    const { videoPromptConcurrency } = getConcurrencySettings();
    await runBatch(
      state.segments.map((seg: any) => ({ key: String(seg.id), fn: () => handleGenPrompt(seg.id) })),
      videoPromptConcurrency
    );
    setIsBulkPromptLoading(false);
  };

  const downloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') return alert("Đang tải...");
    const zip = new JSZip();
    let count = 0;
    state.segments.forEach((seg: any, i: number) => {
      if (seg.image?.url) { zip.file(`${String(i + 1).padStart(2, '0')}.png`, seg.image.url.split(',')[1], { base64: true }); count++; }
    });
    if (count === 0) return alert("Không có ảnh.");
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `pov_images_${Date.now()}.zip`; link.click();
  };

  const downloadAllVideoPromptsTxt = () => {
    const text = state.segments.map((s: any) => s.videoPrompt?.text || "").filter((t: string) => t).join('\n');
    if (!text) return alert("Vui lòng tạo Video Prompt.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `video_prompts_pov_${Date.now()}.txt`; link.click();
  };

  const downloadAllImagePromptsTxt = () => {
    const text = state.segments.map((s: any) => s.imagePrompt?.text || "").filter((t: string) => t).join('\n');
    if (!text) return alert("Vui lòng tạo Image Prompt.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `image_prompts_pov_${Date.now()}.txt`; link.click();
  };

  const hasAnyMedia = state.segments.some((seg: any) => seg.image?.url || seg.videoPrompt?.text);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-[24px] p-8 border border-slate-200 shadow-sm mb-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-2">1. Ảnh khuôn mặt mẫu (Tùy chọn):</label>
                    <div 
                        onClick={() => faceInputRef.current?.click()} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'face')}
                        className={`h-28 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer hover:border-brand-primary transition-all overflow-hidden relative group`}
                    >
                        {state.facePreviewUrl ? <><img src={state.facePreviewUrl} className="h-full object-contain" /><button onClick={handleRemoveFace} className={`absolute top-2 right-2 bg-black/60 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-brand-primary transition-colors z-10`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button></> : <div className="text-center opacity-30"><svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><span>Mặt mẫu</span></div>}
                    </div>
                    <input type="file" ref={faceInputRef} onChange={handleFaceUpload} className="hidden" accept="image/*" />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Mô tả thêm về nhân vật:</label>
                    <textarea value={state.characterDescription} onClick={(e) => (e.target as HTMLTextAreaElement).select()} onChange={e => setState((p:any)=>({...p, characterDescription: e.target.value}))} placeholder="Tuổi tác, ngoại hình..." className={`w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-brand-primary outline-none transition-all resize-none`} />
                </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-3 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Giới tính</label><select value={state.gender} onChange={e => setState((p:any)=>({...p, gender: e.target.value}))} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold outline-none"><option value="Nữ">Nữ</option><option value="Nam">Nam</option></select></div>
                    <div className="md:col-span-4 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Vùng miền</label><select value={state.voice} onChange={e => setState((p:any)=>({...p, voice: e.target.value}))} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold outline-none">{VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                    <div className="md:col-span-4 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Cảnh (Scenes)</label><select value={state.segmentCount} onChange={e => setState((p:any)=>({...p, segmentCount: parseInt(e.target.value)}))} className={`w-full p-3 border border-slate-200 rounded-xl bg-white font-bold text-brand-primary`}>{SCENE_COUNT_OPTIONS.map(opt => <option key={opt.count} value={opt.count}>{opt.label}</option>)}</select></div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase px-1">Cách xưng hô (Người nói - Người nghe)</label>
                          <div className="relative">
                            <input 
                              list="pov-addressing-list"
                              value={state.addressing} 
                              onChange={e => setState((p:any)=>({...p, addressing: e.target.value}))}
                              placeholder="Chọn hoặc tự nhập (VD: em - các bác)"
                              className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold outline-none focus:bg-white"
                            />
                            <datalist id="pov-addressing-list">
                              {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                            </datalist>
                          </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase px-1">Phong cách ảnh</label>
                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 h-[46px]">
                              <button onClick={() => setState((p:any)=>({...p, imageStyle: 'Realistic'}))} style={{ backgroundColor: state.imageStyle === 'Realistic' ? 'var(--primary-color)' : '' }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === 'Realistic' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Chân thực</button>
                              <button onClick={() => setState((p:any)=>({...p, imageStyle: '3D'}))} style={{ backgroundColor: state.imageStyle === '3D' ? 'var(--primary-color)' : '' }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${state.imageStyle === '3D' ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>3D</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Column 1: Trang phục */}
                        <div className="md:col-span-3 space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase px-1">4. Trang phục:</label>
                            <div 
                                onClick={() => outfitInputRef.current?.click()} 
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, 'outfit')}
                                className={`aspect-[3/4] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-slate-50 cursor-pointer hover:border-brand-primary transition-all overflow-hidden relative group`}
                            >
                                {state.processedOutfitUrl || state.outfitPreviewUrl ? (
                                    <>
                                        <img src={state.processedOutfitUrl || state.outfitPreviewUrl} className="w-full h-full object-cover" />
                                        <button onClick={handleRemoveOutfit} className={`absolute top-2 right-2 bg-black/60 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-brand-primary transition-colors z-10`}>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-center opacity-30">
                                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Trang phục</span>
                                    </div>
                                )}
                                <input type="file" ref={outfitInputRef} onChange={handleOutfitUpload} className="hidden" accept="image/*" />
                            </div>
                            {(state.outfitFile || state.outfitPreviewUrl?.startsWith('data:')) && (
                                <button onClick={handleExtractOutfit} disabled={state.isExtractingOutfit} style={{ backgroundColor: 'var(--primary-color)' }} className={`w-full py-2 text-white text-[9px] font-black rounded-lg hover:bg-brand-primary-hover uppercase disabled:opacity-50 tracking-tighter`}>
                                    {state.isExtractingOutfit ? "Đang tách..." : "Tách nền trang phục"}
                                </button>
                            )}
                        </div>

                        {/* Column 2: Bối cảnh */}
                        <div className="md:col-span-3 space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase px-1">Bối cảnh:</label>
                            <div 
                                onClick={() => backgroundInputRef.current?.click()} 
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, 'background')}
                                className={`aspect-[3/4] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-slate-50 cursor-pointer hover:border-brand-primary transition-all overflow-hidden relative group`}
                            >
                                {state.backgroundPreviewUrl ? (
                                    <>
                                        <img src={state.backgroundPreviewUrl} className="w-full h-full object-cover" />
                                        <button onClick={handleRemoveBackground} className={`absolute top-2 right-2 bg-black/60 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-brand-primary transition-colors z-10`}>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-center opacity-30">
                                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Bối cảnh</span>
                                    </div>
                                )}
                                <input type="file" ref={backgroundInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
                            </div>
                        </div>

                        {/* Column 3: Không gian */}
                        <div className="md:col-span-6 space-y-2 flex flex-col">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Không gian:</label>
                                <button 
                                    onClick={handleAnalyzeBackground} 
                                    disabled={state.isAnalyzingBackground || (!state.contextNote && !state.backgroundPreviewUrl)} 
                                    style={{ backgroundColor: 'var(--primary-color)' }}
                                    className="text-[9px] font-black px-3 py-1.5 text-white rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 transition-all uppercase shadow-md"
                                >
                                    {state.isAnalyzingBackground ? "Đang phân tích..." : "Phân tích bối cảnh"}
                                </button>
                            </div>
                            <textarea 
                                value={state.contextNote} 
                                onClick={(e) => (e.target as HTMLTextAreaElement).select()} 
                                onChange={e => setState((p:any)=>({...p, contextNote: e.target.value}))} 
                                placeholder="Mô tả bối cảnh, không gian (VD: phòng khách hiện đại, quán cafe cổ điển...)" 
                                className={`w-full flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:border-brand-primary outline-none transition-all resize-none leading-relaxed min-h-[180px]`} 
                            />
                        </div>
                    </div>
                </div>

                <button onClick={handleGenScript} disabled={state.isGeneratingScript || (!state.analysis && !state.contextNote && !state.characterDescription)} style={{ backgroundColor: 'var(--primary-color)' }} className={`w-full py-5 text-white font-black rounded-xl shadow-lg hover:bg-brand-primary-hover transition-all flex items-center justify-center gap-3 uppercase text-sm tracking-widest disabled:opacity-50`}> {state.isGeneratingScript ? "Đang xử lý..." : "Tạo kịch bản ngay"} </button>
            </div>
        </div>

        {(state.segments && state.segments.length > 0) && (
            <div className="space-y-10 pb-32">
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm flex justify-between items-center"><h3 className="text-sm font-black text-white uppercase tracking-tight">KẾT QUẢ POV ({state.segments.length} cảnh)</h3><span className={`text-[10px] font-bold text-brand-primary uppercase`}>Style: {state.imageStyle} • Giọng: {state.voice}</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {state.segments.map((seg: any) => {
                        const charCount = seg.content?.length || 0;
                        const isRegenScript = state.isRegeneratingPart[seg.id];
                        return (
                            <div key={seg.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-xl transition-all group">
                                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cảnh {seg.id}</span>{seg.image?.loading && <div className={`w-3 h-3 border-2 border-brand-primary border-t-transparent rounded-full animate-spin`}></div>}</div>
                                <div className="relative aspect-[9/16] bg-slate-100 group-hover:brightness-105 transition-all">
                                    {seg.image?.url ? (
                                        <>
                                            <img src={seg.image.url} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleDeleteImage(seg.id)}
                                                style={{ backgroundColor: 'var(--primary-color)' }}
                                                className={`absolute top-2 right-2 w-8 h-8 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-brand-primary-hover transition-all z-10`}
                                                title="Xóa hình ảnh"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                                            {seg.image?.loading ? (
                                                <div className={`w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2`}></div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-4">
                                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest px-4">Sẵn sàng</span>
                                                    <button 
                                                        onClick={() => document.getElementById(`seg-image-upload-${seg.id}`)?.click()}
                                                        style={{ backgroundColor: 'var(--primary-color)' }}
                                                        className="w-32 py-2 text-white rounded-xl text-[9px] font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 uppercase"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                        Tải ảnh
                                                    </button>
                                                    <input 
                                                        id={`seg-image-upload-${seg.id}`}
                                                        type="file" 
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleUploadImage(seg.id, file);
                                                        }} 
                                                        className="hidden" 
                                                        accept="image/*" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 flex flex-col flex-1 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bối cảnh tham chiếu (Ưu tiên):</label>
                                        </div>
                                        <div 
                                            onClick={() => document.getElementById(`seg-bg-input-${seg.id}`)?.click()}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleSegmentDrop(e, seg.id)}
                                            className={`h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer hover:border-brand-primary transition-all overflow-hidden relative group`}
                                        >
                                            {seg.background?.url ? (
                                                <>
                                                    <img src={seg.background.url} className="w-full h-full object-cover" />
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveSegmentBackground(seg.id); }} 
                                                        className={`absolute top-1 right-1 bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center hover:bg-brand-primary transition-colors z-10`}
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="text-center opacity-30">
                                                    <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    <span className="text-[8px] font-black uppercase">Tải bối cảnh</span>
                                                </div>
                                            )}
                                            <input 
                                                id={`seg-bg-input-${seg.id}`}
                                                type="file" 
                                                onChange={(e) => handleSegmentBackgroundUpload(seg.id, e.target.files?.[0] || null)} 
                                                className="hidden" 
                                                accept="image/*" 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center mb-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kịch bản POV:</label><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${charCount > 180 ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-400'}`}>{charCount} / 180</span></div>
                                        <textarea value={seg.content} onClick={(e) => (e.target as HTMLTextAreaElement).select()} onChange={e => setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===seg.id?{...s, content: e.target.value}:s)}))} className={`w-full h-40 p-3 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl outline-none resize-none leading-relaxed focus:bg-white focus:border-brand-primary transition-all`} />
                                        <button onClick={() => handleRegenSegmentScript(seg.id)} disabled={isRegenScript} style={{ backgroundColor: 'var(--primary-color)' }} className={`w-full py-1.5 text-white text-[8px] font-black rounded-lg hover:bg-brand-primary-hover transition-all uppercase tracking-tighter disabled:opacity-50 shadow-sm active:scale-95`}>{isRegenScript ? "Đang viết..." : "Tạo lại lời thoại"}</button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase block px-1">Tư thế nhân vật:</label>
                                            <select 
                                              value={seg.pose || ""} 
                                              onChange={e => setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===seg.id?{...s, pose: e.target.value}:s)}))}
                                              className={`w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-bold outline-none focus:border-brand-primary transition-all`}
                                            >
                                              {CHARACTER_POSES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase block px-1">Định dạng hình ảnh:</label>
                                            <select 
                                              value={seg.imageFormat || "with_koc"} 
                                              onChange={e => setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===seg.id?{...s, imageFormat: e.target.value}:s)}))}
                                              className={`w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-bold outline-none focus:border-brand-primary transition-all`}
                                            >
                                              {IMAGE_FORMATS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Ghi chú sửa ảnh:</label><textarea value={seg.image?.regenNote || ''} onClick={(e) => (e.target as HTMLTextAreaElement).select()} onChange={e => setState((p:any)=>({...p, segments: p.segments.map((s:any)=>s.id===seg.id?{...s, image:{...s.image, regenNote: e.target.value}}:s)}))} placeholder="Góc quay, ánh sáng..." className="w-full h-24 p-3 text-[9px] border border-dashed border-slate-200 rounded-xl outline-none resize-none focus:bg-white" /></div>
                                    <div className="mt-auto flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <button onClick={() => handleGenImage(seg.id)} disabled={seg.image?.loading} style={{ backgroundColor: 'var(--primary-color)' }} className={`flex-1 py-3 text-white text-[9px] font-black rounded-xl shadow-md hover:bg-brand-primary-hover transition-all uppercase tracking-tighter flex items-center justify-center gap-2 active:scale-95`}>
                                                {seg.image?.loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                                {(seg.image && seg.image.url) ? "Vẽ lại" : "Tạo Ảnh"}
                                            </button>
                                            <button onClick={() => handleGenImagePrompt(seg.id)} disabled={seg.imagePrompt?.loading} style={{ backgroundColor: 'var(--primary-color)' }} className={`flex-1 py-3 text-white text-[9px] font-black rounded-xl shadow-md hover:bg-brand-primary-hover transition-all uppercase tracking-tighter flex items-center justify-center gap-2 active:scale-95`}>
                                                {seg.imagePrompt?.loading && <div className={`w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin`}></div>}
                                                Prompt Ảnh
                                            </button>
                                        </div>
                                        <button onClick={() => handleGenPrompt(seg.id)} disabled={seg.videoPrompt?.loading} style={{ backgroundColor: 'var(--primary-color)' }} className={`w-full py-3 text-white text-[9px] font-black rounded-xl shadow-md hover:bg-brand-primary-hover transition-all uppercase tracking-tighter flex items-center justify-center gap-2 active:scale-95`}>
                                            {seg.videoPrompt?.loading && <div className={`w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin`}></div>}
                                            VEO-3 Prompt
                                        </button>
                                    </div>
                                </div>
                                {seg.imagePrompt?.visible && (
                                    <div className="p-4 bg-brand-primary/90 border-t border-brand-primary/80 animate-slideUp">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-[8px] text-white font-bold uppercase tracking-widest">Image Prompt Ready</span>
                                          <button 
                                            onClick={() => handleCopy(seg.imagePrompt.text, `img-seg-${seg.id}`)} 
                                            className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`img-seg-${seg.id}`] ? 'text-green-400' : 'text-white underline'}`}
                                          >
                                            {copyStatus[`img-seg-${seg.id}`] ? 'COPIED!' : 'Copy'}
                                          </button>
                                        </div>
                                        <textarea 
                                          readOnly 
                                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                          className="w-full h-24 bg-white/10 text-white text-[9px] p-2 rounded border border-white/20 focus:outline-none resize-none font-mono italic opacity-80 leading-snug"
                                          value={seg.imagePrompt.text}
                                        />
                                    </div>
                                )}
                                {(seg.videoPrompt && seg.videoPrompt.visible) && (
                                    <div className="p-4 bg-slate-900 border-t border-slate-800 animate-slideUp">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-[8px] text-brand-primary font-bold uppercase tracking-widest">VEO-3 Prompt</span>
                                          <button 
                                            onClick={() => handleCopy(seg.videoPrompt.text, `seg-${seg.id}`)} 
                                            className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`seg-${seg.id}`] ? 'text-green-400' : 'text-white underline'}`}
                                          >
                                            {copyStatus[`seg-${seg.id}`] ? 'COPIED!' : 'Copy'}
                                          </button>
                                        </div>
                                        <textarea 
                                          readOnly 
                                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                          className="w-full h-24 bg-slate-950 text-slate-300 text-[9px] p-2 rounded border border-slate-800 focus:outline-none resize-none font-mono italic opacity-80 leading-snug"
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
                            onClick={handleBulkImagePrompt}
                            disabled={isBulkImagePromptLoading}
                            style={{ backgroundColor: 'var(--primary-color)' }}
                            className="w-full md:w-auto px-8 py-4 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
                        >
                            Tạo tất cả Prompt ảnh
                            {isBulkImagePromptLoading ? (
                              <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
                    {hasAnyMedia && (
                        <div className="flex flex-col md:flex-row items-center justify-center gap-4 border-t border-slate-200 w-full pt-12">
                            <button onClick={downloadAllImagesZip} style={{ backgroundColor: 'var(--primary-color)' }} className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Tải Ảnh (ZIP)
                            </button>
                            <button onClick={downloadAllImagePromptsTxt} style={{ backgroundColor: 'var(--primary-color)' }} className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Tải Prompt Ảnh (.txt)
                            </button>
                            <button onClick={downloadAllVideoPromptsTxt} style={{ backgroundColor: 'var(--primary-color)' }} className="w-full md:w-auto px-8 py-5 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-sm">
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

export default VideoPovModule;
