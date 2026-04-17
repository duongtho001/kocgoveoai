
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatbotScene, ChatbotStudioState } from '../types';
import { sendMessage } from '../services/chatbotStudioService';
import { theme } from '../constants/colors';

import { safeSaveToLocalStorage } from '../utils/storage';

interface ChatbotStudioModuleProps {
  onTabChange: (tab: any) => void;
  language?: string;
}

const MODULE_OPTIONS = [
  { id: 'koc2', label: 'KOC Review (Viral Hook)' },
  { id: 'nonface', label: 'Review (Non-face)' },
  { id: 'nonface2', label: 'Review Cận Chân' },
  { id: 'personification', label: 'Nhân Hóa Review' },
  { id: 'personification2', label: 'Nhân Hóa (Kiến thức)' },
  { id: 'videopov', label: 'Kiến Thức - Dịch Vụ' },
  { id: 'carousel', label: 'Ảnh Cuộn Tiktok' },
  { id: 'doithoai', label: 'Review Đối Thoại' },
];

const ChatbotStudioModule: React.FC<ChatbotStudioModuleProps> = ({ onTabChange, language = 'vi' }) => {
  const [state, setState] = useState<ChatbotStudioState>(() => {
    const saved = localStorage.getItem('chatbot_studio_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, isProcessing: false, attachedImage: null, attachedImages: [], attachedVideo: null, attachedVideoType: null, videoPreviewUrl: null };
      } catch (e) {
        console.error("Error parsing saved state", e);
      }
    }
    return {
      messages: [],
      scenes: [],
      isProcessing: false,
      attachedImage: null,
      attachedImages: [],
      attachedVideo: null,
      attachedVideoType: null,
      videoPreviewUrl: null,
      mode: 'script'
    };
  });

  const [input, setInput] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('koc2');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { videoPreviewUrl, attachedImage, attachedImages, attachedVideo, attachedVideoType, ...toSave } = state;
    safeSaveToLocalStorage('chatbot_studio_state', toSave);
  }, [state]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const clearChat = () => {
    if (state.videoPreviewUrl) {
      URL.revokeObjectURL(state.videoPreviewUrl);
    }
    setState(prev => ({ 
      ...prev, 
      messages: [], 
      scenes: [], 
      attachedImage: null, 
      attachedImages: [],
      attachedVideo: null, 
      attachedVideoType: null, 
      videoPreviewUrl: null 
    }));
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!input.trim() || state.isProcessing) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    const updatedMessages = [...state.messages, userMessage];

    setState(prev => ({ ...prev, messages: updatedMessages, isProcessing: true }));
    setInput('');

    try {
      let imageParts = undefined;
      if (state.attachedImages && state.attachedImages.length > 0) {
        imageParts = state.attachedImages.map(img => ({
          mimeType: 'image/png',
          data: img.split(',')[1]
        }));
      } else if (state.attachedImage) {
        imageParts = [{
          mimeType: 'image/png',
          data: state.attachedImage.split(',')[1]
        }];
      }

      let videoPart = undefined;
      if (state.attachedVideo) {
        videoPart = {
          mimeType: state.attachedVideoType || 'video/mp4',
          data: state.attachedVideo.split(',')[1]
        };
      }

      const result = await sendMessage(state.messages, input, state.mode, imageParts, videoPart, language);
      const modelMessage: ChatMessage = { 
        role: 'model', 
        text: result.text,
        image: result.generatedImage 
      };
      setState(prev => ({
        ...prev,
        messages: [...updatedMessages, modelMessage],
        scenes: result.scenes.length > 0 ? result.scenes : prev.scenes,
        isProcessing: false,
        attachedImage: null,
        attachedImages: [],
        attachedVideo: null,
        attachedVideoType: null,
        videoPreviewUrl: null
      }));
    } catch (error) {
      console.error("Error sending message", error);
      setState(prev => ({
        ...prev,
        messages: [...updatedMessages, { role: 'model', text: "Đã có lỗi xảy ra khi gửi tin nhắn." }],
        isProcessing: false
      }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    let processedCount = 0;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push(reader.result as string);
        processedCount++;
        if (processedCount === files.length) {
          setState(prev => ({ 
            ...prev, 
            attachedImages: [...prev.attachedImages, ...newImages].slice(0, 10) // Limit to 10 images
          }));
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || state.isProcessing) {
      e.target.value = '';
      return;
    }

    if (state.videoPreviewUrl) {
      URL.revokeObjectURL(state.videoPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      setState(prev => ({ 
        ...prev, 
        attachedVideo: reader.result as string,
        attachedVideoType: file.type,
        videoPreviewUrl: previewUrl
      }));
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Đã sao chép vào bộ nhớ tạm!");
  };

  const handleTransfer = () => {
    if (state.scenes.length === 0) {
      alert("Chưa có kịch bản để chuyển!");
      return;
    }

    const importData = state.scenes.map((scene, index) => {
      let script: any = scene.content;
      let sceneChar = (index % 2 === 0 ? 'A' : 'B');

      if (selectedModule === 'doithoai') {
        // Tách lời thoại cho module Đối Thoại
        const lines = scene.content.split('\n');
        let charA = '';
        let charB = '';
        let currentSpeaker = '';

        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;

          // Kiểm tra các pattern phổ biến của nhân vật
          const matchA = trimmed.match(/^(Nhân vật A|Mẫu A|NV A|A|Character A|Speaker A)\s*:\s*(.*)/i);
          const matchB = trimmed.match(/^(Nhân vật B|Mẫu B|NV B|B|Character B|Speaker B)\s*:\s*(.*)/i);

          if (matchA) {
            currentSpeaker = 'A';
            charA += (charA ? '\n' : '') + matchA[2].trim();
          } else if (matchB) {
            currentSpeaker = 'B';
            charB += (charB ? '\n' : '') + matchB[2].trim();
          } else if (currentSpeaker === 'A') {
            charA += (charA ? '\n' : '') + trimmed;
          } else if (currentSpeaker === 'B') {
            charB += (charB ? '\n' : '') + trimmed;
          } else {
            // Nếu chưa xác định được ai nói ở dòng đầu, mặc định theo index
            if (index % 2 === 0) {
              charA += (charA ? '\n' : '') + trimmed;
              currentSpeaker = 'A';
            } else {
              charB += (charB ? '\n' : '') + trimmed;
              currentSpeaker = 'B';
            }
          }
        });

        script = { charA, charB };
        if (charA && charB) sceneChar = 'Both';
        else if (charA) sceneChar = 'A';
        else if (charB) sceneChar = 'B';
      }

      return {
        script: script,
        inputs: {
          sceneChar: sceneChar,
          segmentData: {
            characterIdea: scene.action
          },
          settings: {
            customPrompt: scene.action
          }
        }
      };
    });

    // Switch tab
    onTabChange(selectedModule);

    // Wait for the module to mount and listen for the event
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('REQUEST_IMPORT_DATA', { detail: importData }));
    }, 500);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fadeIn">
     

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Column: Chat Interface */}
        <div className={`flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-xl border ${theme.colors.secondaryBorder} overflow-hidden h-[600px]`}>
          <div className={`p-6 ${theme.colors.secondaryBg} border-b ${theme.colors.secondaryBorder} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${theme.colors.primaryBg} rounded-2xl flex items-center justify-center shadow-lg`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Chatbot Studio</h2>
                <p className={`text-xs font-bold ${theme.colors.secondaryText} uppercase tracking-widest`}>AI Script Assistant</p>
              </div>
            </div>
            <button 
              onClick={clearChat}
              className={`p-2 ${theme.colors.secondaryText} hover:${theme.colors.primaryText} transition-colors`}
              title="Xóa lịch sử chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${theme.colors.secondaryBg}/30`}>
            {state.messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-10">
                <div className={`w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-4 border ${theme.colors.secondaryBorder}`}>
                  <svg className={`w-8 h-8 ${theme.colors.secondaryText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className={`text-sm font-bold ${theme.colors.secondaryText} uppercase tracking-widest notranslate`} translate="no">
                  <span>Bắt đầu trò chuyện để tạo kịch bản</span>
                </p>
              </div>
            )}
            {state.messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium shadow-sm whitespace-pre-wrap relative group/msg ${
                  msg.role === 'user' 
                    ? `${theme.colors.primaryBg} text-white rounded-tr-none` 
                    : `bg-white text-slate-800 border ${theme.colors.secondaryBorder} rounded-tl-none`
                }`}>
                  <span className="notranslate" translate="no">{msg.text}</span>
                  {msg.role === 'model' && (
                    <button 
                      onClick={() => copyToClipboard(msg.text)}
                      className={`absolute -right-10 top-0 p-2 ${theme.colors.secondaryText} hover:${theme.colors.primaryText} transition-opacity opacity-0 group-hover/msg:opacity-100`}
                      title="Sao chép"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                  )}
                  {msg.image && (
                    <div className="mt-3 space-y-2">
                      <img 
                        src={msg.image} 
                        alt="Generated" 
                        className={`w-full rounded-xl border ${theme.colors.secondaryBorder} shadow-sm`} 
                      />
                      <div className="flex justify-end">
                        <a 
                          href={msg.image} 
                          download={`ai-image-${idx}.png`}
                          className={`flex items-center gap-1 px-3 py-1.5 ${theme.colors.secondaryBg} ${theme.colors.secondaryText} text-xs font-black rounded-lg hover:bg-slate-200 transition-all uppercase tracking-widest`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Tải về
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {state.isProcessing && (
              <div className="flex justify-start">
                <div className={`bg-white p-4 rounded-2xl rounded-tl-none border ${theme.colors.secondaryBorder} shadow-sm`}>
                  <div className="flex gap-1">
                    <div className={`w-2 h-2 ${theme.colors.secondaryText} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                    <div className={`w-2 h-2 ${theme.colors.secondaryText} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                    <div className={`w-2 h-2 ${theme.colors.secondaryText} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className={`p-4 bg-white border-t ${theme.colors.secondaryBorder}`}>
            <div className="flex gap-4 mb-4 overflow-x-auto pb-2">
              {state.attachedImages && state.attachedImages.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img src={img} alt={`Attached ${idx}`} className={`h-20 w-20 object-cover rounded-2xl border-2 ${theme.colors.secondaryBorder} shadow-sm`} />
                  <button 
                    onClick={() => {
                      setState(prev => ({ 
                        ...prev, 
                        attachedImages: prev.attachedImages.filter((_, i) => i !== idx) 
                      }));
                    }}
                    className={`absolute -top-2 -right-2 ${theme.colors.primaryBg} text-white rounded-full p-1.5 shadow-lg ${theme.colors.primaryHover} active:scale-90 transition-all`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {state.attachedImage && !state.attachedImages.length && (
                <div className="relative flex-shrink-0">
                  <img src={state.attachedImage} alt="Attached" className={`h-20 w-20 object-cover rounded-2xl border-2 ${theme.colors.secondaryBorder} shadow-sm`} />
                  <button 
                    onClick={() => {
                      setState(prev => ({ ...prev, attachedImage: null }));
                      if (imageInputRef.current) imageInputRef.current.value = '';
                    }}
                    className={`absolute -top-2 -right-2 ${theme.colors.primaryBg} text-white rounded-full p-1.5 shadow-lg ${theme.colors.primaryHover} active:scale-90 transition-all`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {state.videoPreviewUrl && (
                <div className="relative flex-shrink-0">
                  <video src={state.videoPreviewUrl} className={`h-20 w-32 object-cover rounded-2xl border-2 ${theme.colors.secondaryBorder} shadow-sm bg-black`} />
                  <button 
                    onClick={() => {
                      if (state.videoPreviewUrl) URL.revokeObjectURL(state.videoPreviewUrl);
                      setState(prev => ({ ...prev, attachedVideo: null, attachedVideoType: null, videoPreviewUrl: null }));
                      if (videoInputRef.current) videoInputRef.current.value = '';
                    }}
                    className={`absolute -top-2 -right-2 ${theme.colors.primaryBg} text-white rounded-full p-1.5 shadow-lg ${theme.colors.primaryHover} active:scale-90 transition-all`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded font-bold uppercase">Video</div>
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={state.mode}
                onChange={(e) => setState(prev => ({ ...prev, mode: e.target.value as 'script' | 'image' | 'translate' }))}
                className={`px-3 py-3 ${theme.colors.secondaryBg} border ${theme.colors.secondaryBorder} rounded-xl text-xs font-bold outline-none focus:ring-2 ${theme.colors.secondaryBg} ${theme.colors.inputFocus} transition-all cursor-pointer`}
              >
                <option value="script">Tạo kịch bản</option>
                <option value="image">Tạo hình ảnh</option>
                <option value="translate">Dịch thuật</option>
              </select>

              <div className="flex-1 relative">
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    state.mode === 'script' 
                      ? "Nhập yêu cầu kịch bản..." 
                      : state.mode === 'image' 
                        ? "Mô tả hình ảnh muốn tạo..." 
                        : "Nhập văn bản cần dịch..."
                  }
                  className={`w-full px-4 py-3 ${theme.colors.secondaryBg} border ${theme.colors.secondaryBorder} rounded-xl text-sm font-bold outline-none focus:ring-2 ${theme.colors.secondaryBg} ${theme.colors.inputFocus} transition-all resize-none min-h-[46px] max-h-32`}
                  disabled={state.isProcessing}
                  rows={1}
                />
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className={`p-3 ${theme.colors.secondaryText} hover:${theme.colors.primaryText} hover:${theme.colors.secondaryBg} rounded-xl transition-all`}
                  title="Tải nhiều ảnh tham chiếu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoUpload}
                  accept="video/*"
                  className="hidden"
                />
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className={`p-3 ${theme.colors.secondaryText} hover:${theme.colors.primaryText} hover:${theme.colors.secondaryBg} rounded-xl transition-all`}
                  title="Tải video đính kèm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              <button 
                onClick={handleSend}
                disabled={state.isProcessing || !input.trim()}
                className={`p-3 ${theme.colors.primaryBg} text-white rounded-xl shadow-lg ${theme.colors.primaryHover} active:scale-95 transition-all disabled:opacity-50`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Scenes */}
        <div className="flex-1 space-y-6">
          <div className={`bg-white rounded-[2.5rem] p-8 shadow-xl border ${theme.colors.secondaryBorder} h-full flex flex-col`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Kịch bản chi tiết</h3>
              <span className={`px-3 py-1 ${theme.colors.secondaryBg} ${theme.colors.secondaryText} text-xs font-black rounded-full uppercase tracking-widest`}>
                {state.scenes.length} Cảnh
              </span>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {state.scenes.length === 0 ? (
                <div className="text-center py-10">
                  <p className={`text-sm font-bold ${theme.colors.secondaryText} uppercase tracking-widest`}>Chưa có kịch bản nào được tạo</p>
                </div>
              ) : (
                state.scenes.map((scene) => (
                  <div key={scene.id} className={`group relative ${theme.colors.secondaryBg} rounded-2xl p-5 border ${theme.colors.secondaryBorder} hover:${theme.colors.primaryBorder} transition-all`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-6 h-6 ${theme.colors.secondaryBg} ${theme.colors.primaryText} text-xs font-black rounded-lg flex items-center justify-center uppercase`}>
                            {scene.id}
                          </span>
                          <span className={`text-xs font-bold ${theme.colors.secondaryText} uppercase tracking-widest`}>Cảnh {scene.id}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed notranslate" translate="no">
                          <span>{scene.content}</span>
                        </p>
                        <div className={`mt-3 p-3 bg-white/50 rounded-xl border ${theme.colors.secondaryBorder} notranslate`} translate="no">
                          <p className={`text-xs font-black ${theme.colors.secondaryText} uppercase tracking-widest mb-1`}>Hành động:</p>
                          <p className="text-xs text-slate-600 italic">
                            <span>{scene.action}</span>
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`text-xs font-black uppercase tracking-tighter ${theme.colors.primaryText}`}>
                            {scene.content.length} / 180 ký tự
                          </span>
                          <button 
                            onClick={() => copyToClipboard(`Lời thoại: ${scene.content}\nHành động: ${scene.action}`)}
                            className={`p-2 ${theme.colors.secondaryText} hover:${theme.colors.primaryText} transition-colors opacity-0 group-hover:opacity-100`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {state.scenes.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex gap-2">
                  <select 
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    className={`flex-1 px-4 py-3 ${theme.colors.secondaryBg} border ${theme.colors.secondaryBorder} rounded-xl text-xs font-bold outline-none focus:ring-2 ${theme.colors.secondaryBg} ${theme.colors.inputFocus} transition-all`}
                  >
                    {MODULE_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleTransfer}
                    className={`px-6 py-3 ${theme.colors.primaryBg} text-white text-xs font-black uppercase tracking-widest rounded-xl ${theme.colors.primaryHover} transition-all shadow-lg active:scale-95 whitespace-nowrap`}
                  >
                    Chuyển sang Module
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotStudioModule;
