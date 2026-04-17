import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, Play, Pause, Download, Trash2, History, Settings, 
  Volume2, Sliders, Languages, User, Smile, Sparkles, 
  Clock, Type, Save, Send, AlertCircle, Loader2,
  Plus, Minus, Info
} from 'lucide-react';
import { 
  generateAudio, VOICE_PERSONAS, EMOTIONS, STYLES, LANGUAGES, SAMPLE_TEXT
} from '../services/ttsService';
import { Language, Emotion, Style } from '../services/ttsTypes';
import { theme } from '../constants/colors';

interface HistoryItem {
  id: string;
  text: string;
  audioData?: string;
  voiceName: string; // This is the apiVoice
  personaId: string;
  language: Language;
  emotion?: Emotion;
  style?: Style;
  speed?: number;
  pitch?: number;
  createdAt: any;
}

const TextToAudioModule: React.FC<{ loggedInUser: string | null }> = ({ loggedInUser }) => {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.Vietnamese);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_PERSONAS[Language.Vietnamese][0].id);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion>(Emotion.Neutral);
  const [selectedStyle, setSelectedStyle] = useState<Style>(Style.General);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [stability, setStability] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sync speed with playbackRate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Fetch history from LocalStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem(`tts_history_${loggedInUser || 'local'}`);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Error parsing local history:", e);
      }
    }
  }, [loggedInUser]);

  // Audio Visualizer setup
  useEffect(() => {
    if (!isPlaying || !audioRef.current || !canvasRef.current) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    
    // Resume context if suspended (common browser policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (!analyserRef.current && audioRef.current) {
      try {
        analyserRef.current = ctx.createAnalyser();
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
      } catch (e) {
        console.warn("Visualizer connection error:", e);
      }
    }

    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#f97316'); // Orange-500
        gradient.addColorStop(0.5, '#f43f5e'); // Rose-500
        gradient.addColorStop(1, '#8b5cf6'); // Violet-500

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Vui lòng nhập văn bản.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const personasInLang = VOICE_PERSONAS[selectedLanguage] || [];
      const persona = personasInLang.find(p => p.id === selectedVoice);
      
      if (!persona) throw new Error("Không tìm thấy cấu hình giọng nói.");

      const result = await generateAudio({
        text,
        voiceName: persona.apiVoice,
        language: selectedLanguage,
        personaId: selectedVoice,
        emotion: selectedEmotion,
        style: selectedStyle,
        speed,
        pitch
      });

      const audioUrl = `data:audio/wav;base64,${result.data}`;
      setCurrentAudio(audioUrl);
      
      // Save to history
      if (loggedInUser) {
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          text: text,
          voiceName: persona.apiVoice,
          personaId: selectedVoice,
          language: selectedLanguage,
          emotion: selectedEmotion,
          style: selectedStyle,
          speed,
          pitch,
          createdAt: { toDate: () => new Date() }
        };
        const updatedHistory = [newItem, ...history].slice(0, 50);
        setHistory(updatedHistory);
        localStorage.setItem(`tts_history_${loggedInUser || 'local'}`, JSON.stringify(updatedHistory));
      }

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(playErr => {
          console.error("Lỗi phát âm thanh:", playErr);
          setError("Không thể tự động phát âm thanh. Vui lòng nhấn nút Play.");
        });
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi tạo âm thanh.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!loggedInUser) return;
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem(`tts_history_${loggedInUser || 'local'}`, JSON.stringify(updatedHistory));
  };

  const handlePlayHistory = async (item: HistoryItem) => {
    let audioUrl = audioCache[item.id] || item.audioData;

    if (!audioUrl) {
      // Regenerate if not in cache and no legacy data
      setRegeneratingId(item.id);
      try {
        const result = await generateAudio({
          text: item.text,
          voiceName: item.voiceName,
          language: item.language || Language.Vietnamese,
          personaId: item.personaId || item.voiceName,
          emotion: item.emotion || Emotion.Neutral,
          style: item.style || Style.General,
          speed: item.speed || 1.0,
          pitch: item.pitch || 1.0
        });
        audioUrl = `data:audio/wav;base64,${result.data}`;
        setAudioCache(prev => ({ ...prev, [item.id]: audioUrl! }));
      } catch (err) {
        console.error("Lỗi tái tạo âm thanh:", err);
        setError("Không thể tái tạo âm thanh từ lịch sử.");
        setRegeneratingId(null);
        return;
      }
      setRegeneratingId(null);
    }

    if (audioUrl) {
      setCurrentAudio(audioUrl);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    }
  };

  const insertSSML = (tag: string) => {
    const textarea = document.getElementById('tts-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    let newText = '';

    if (tag === 'break') {
      newText = text.substring(0, start) + '<break time="1s"/>' + text.substring(end);
    } else if (tag === 'emphasis') {
      newText = text.substring(0, start) + `<emphasis>${selectedText || 'nhấn mạnh'}</emphasis>` + text.substring(end);
    }

    setText(newText);
    textarea.focus();
  };

  const downloadAudio = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen ${theme.colors.background} p-4 md:p-8 font-sans ${theme.colors.textPrimary}`}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Editor Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`bg-white border ${theme.colors.border} rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden`}>
              {/* Toolbar */}
              <div className={`${theme.colors.cardBackground}/50 border-b ${theme.colors.borderLight} p-4 flex flex-wrap items-center gap-2`}>
                <button 
                  onClick={() => insertSSML('break')}
                  className={`px-3 py-1.5 bg-white border ${theme.colors.border} rounded-xl text-xs font-bold ${theme.colors.textSecondary} hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-all flex items-center gap-1.5`}
                >
                  <Plus className="w-3 h-3" /> Ngắt nghỉ (1s)
                </button>
                <button 
                  onClick={() => insertSSML('emphasis')}
                  className={`px-3 py-1.5 bg-white border ${theme.colors.border} rounded-xl text-xs font-bold ${theme.colors.textSecondary} hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-all flex items-center gap-1.5`}
                >
                  <Sparkles className="w-3 h-3" /> Nhấn mạnh
                </button>
                <div className={`h-6 w-px ${theme.colors.border} mx-2`} />
                <span className={`text-[10px] uppercase tracking-widest font-black ${theme.colors.textMuted}`}>SSML Editor</span>
              </div>

              {/* Editor */}
              <div className="p-6">
                <textarea
                  id="tts-editor"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Nhập nội dung bạn muốn chuyển thành giọng nói tại đây..."
                  className={`w-full h-80 bg-transparent border-none focus:ring-0 text-lg leading-relaxed resize-none placeholder:${theme.colors.textMuted}`}
                  maxLength={10000}
                />
              </div>

              {/* Footer Info */}
              <div className={`${theme.colors.cardBackground}/30 p-4 border-t ${theme.colors.borderLight} flex items-center justify-between`}>
                <div className={`flex items-center gap-4 text-xs font-bold ${theme.colors.textMuted}`}>
                  <span className={text.length > 9000 ? 'text-rose-500' : ''}>
                    {text.length.toLocaleString()} / 10,000 ký tự
                  </span>
                  <span>~ {Math.ceil(text.length / 5).toLocaleString()} từ</span>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                    onClick={() => setText('')}
                    className={`p-2 ${theme.colors.textMuted} hover:text-rose-500 transition-colors`}
                    title="Xóa tất cả"
                   >
                    <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </div>

            {/* Audio Player & Visualizer */}
            <AnimatePresence>
              {currentAudio && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={`bg-white border ${theme.colors.border} rounded-3xl p-6 shadow-2xl shadow-slate-300/50 space-y-6`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl ${theme.colors.primaryBg} flex items-center justify-center text-white shadow-lg ${theme.colors.primaryShadow}`}>
                        <Volume2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className={`font-black ${theme.colors.textPrimary}`}>Bản thu hiện tại</h3>
                        <p className={`text-xs font-bold ${theme.colors.textMuted} uppercase tracking-tighter`}>Đang phát với giọng {selectedVoice}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => downloadAudio(currentAudio, `tts-${Date.now()}.wav`)}
                        className={`p-3 ${theme.colors.cardBackground} rounded-2xl ${theme.colors.textSecondary} hover:bg-slate-200 transition-all`}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="relative h-24 bg-slate-900 rounded-2xl overflow-hidden group">
                    <canvas ref={canvasRef} width={800} height={100} className="w-full h-full opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 group-hover:bg-slate-900/40 transition-all">
                      <button 
                        onClick={() => {
                          if (isPlaying) {
                            audioRef.current?.pause();
                            setIsPlaying(false);
                          } else {
                            audioRef.current?.play();
                            setIsPlaying(true);
                          }
                        }}
                        className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all backdrop-blur-sm"
                      >
                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                      </button>
                    </div>
                  </div>

                  <audio 
                    ref={audioRef} 
                    onPlay={() => setIsPlaying(true)} 
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* History List - Moved to left column */}
            <div className={`bg-white border ${theme.colors.border} rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-4`}>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 ${theme.colors.textMuted}`}>
                  <History className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Gần đây</span>
                </div>
                <div className={`bg-slate-50 border ${theme.colors.borderLight} px-2 py-1 rounded-full flex items-center gap-1.5`}>
                  <Clock className={`w-3 h-3 ${theme.colors.primaryText}`} />
                  <span className={`text-[9px] font-black ${theme.colors.textSecondary}`}>Lịch sử: {history.length}</span>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className={`w-12 h-12 ${theme.colors.cardBackground} rounded-full flex items-center justify-center mx-auto ${theme.colors.textMuted}`}>
                      <Mic className="w-6 h-6" />
                    </div>
                    <p className={`text-xs font-bold ${theme.colors.textMuted}`}>Chưa có bản thu nào</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      className={`group bg-white border ${theme.colors.borderLight} p-3 rounded-2xl hover:border-[var(--primary-color)] transition-all space-y-2`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium ${theme.colors.textSecondary} line-clamp-2 leading-relaxed`}>
                          {item.text}
                        </p>
                        <button 
                          onClick={() => handleDeleteHistory(item.id)}
                          className={`p-1.5 ${theme.colors.textMuted} hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 ${theme.colors.cardBackground} rounded-full text-[9px] font-black ${theme.colors.textMuted} uppercase`}>
                            {item.personaId || item.voiceName}
                          </span>
                          <span className={`px-2 py-0.5 ${theme.colors.cardBackground} rounded-full text-[9px] font-black ${theme.colors.textMuted} uppercase`}>
                            {item.language}
                          </span>
                          <span className={`text-[9px] font-bold ${theme.colors.textMuted}`}>
                            {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handlePlayHistory(item)}
                            disabled={regeneratingId === item.id}
                            className={`p-2 ${theme.colors.primaryBg}/10 ${theme.colors.primaryText} rounded-xl hover:${theme.colors.primaryBg}/20 transition-colors disabled:opacity-50`}
                          >
                            {regeneratingId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                          </button>
                          <button 
                            onClick={() => {
                              const url = audioCache[item.id] || item.audioData;
                              if (url) downloadAudio(url, `tts-${item.id}.wav`);
                              else setError("Vui lòng phát âm thanh trước khi tải xuống.");
                            }}
                            className={`p-2 ${theme.colors.cardBackground} ${theme.colors.textMuted} rounded-xl hover:${theme.colors.inputBg} transition-colors`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="space-y-6">
            <div className={`bg-white border ${theme.colors.border} rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-8`}>
              
              {/* Language Selection */}
              <div className="space-y-4">
                <div className={`flex items-center gap-2 ${theme.colors.textMuted}`}>
                  <Languages className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Ngôn ngữ</span>
                </div>
                <select 
                  value={selectedLanguage}
                  onChange={(e) => {
                    const newLang = e.target.value as Language;
                    setSelectedLanguage(newLang);
                    setSelectedVoice(VOICE_PERSONAS[newLang][0].id);
                  }}
                  className={`w-full ${theme.colors.inputBg} border-none rounded-xl text-xs font-bold p-3 focus:ring-2 ${theme.colors.inputFocus}`}
                >
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>

              {/* Voice Selection */}
              <div className="space-y-4">
                <div className={`flex items-center gap-2 ${theme.colors.textMuted}`}>
                  <User className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Người đọc</span>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {(VOICE_PERSONAS[selectedLanguage] || []).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedVoice(p.id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                        selectedVoice === p.id 
                        ? `${theme.colors.buttonActiveOutline}` 
                        : `bg-white ${theme.colors.border} hover:${theme.colors.border}`
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                        selectedVoice === p.id ? `${theme.colors.buttonPrimary}` : `bg-slate-100 ${theme.colors.textMuted}`
                      }`}>
                        {p.name[0]}
                      </div>
                      <div>
                        <div className={`font-bold text-sm ${theme.colors.textPrimary}`}>{p.name}</div>
                        <div className={`text-[10px] ${theme.colors.textMuted} font-medium`}>{p.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Emotion & Style */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${theme.colors.textMuted} flex items-center gap-1.5`}>
                    <Smile className="w-3 h-3" /> Cảm xúc
                  </label>
                  <select 
                    value={selectedEmotion}
                    onChange={(e) => setSelectedEmotion(e.target.value as Emotion)}
                    className={`w-full ${theme.colors.inputBg} border-none rounded-xl text-xs font-bold p-3 focus:ring-2 ${theme.colors.inputFocus}`}
                  >
                    {EMOTIONS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${theme.colors.textMuted} flex items-center gap-1.5`}>
                    <Sparkles className="w-3 h-3" /> Phong cách
                  </label>
                  <select 
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value as Style)}
                    className={`w-full ${theme.colors.inputBg} border-none rounded-xl text-xs font-bold p-3 focus:ring-2 ${theme.colors.inputFocus}`}
                  >
                    {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${theme.colors.textMuted}`}>Tốc độ</label>
                    <span className={`text-xs font-black ${theme.colors.primaryText}`}>{speed}x</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="2.0" step="0.1" 
                    value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className={`w-full h-1.5 ${theme.colors.inputBg} rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]`}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${theme.colors.textMuted}`}>Cao độ</label>
                    <span className="text-xs font-black text-rose-600">{pitch}x</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="1.5" step="0.1" 
                    value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className={`w-full h-1.5 ${theme.colors.inputBg} rounded-lg appearance-none cursor-pointer accent-rose-500`}
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim()}
                className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
                  isGenerating || !text.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : `${theme.colors.buttonPrimary} hover:scale-[1.02] active:scale-[0.98] ${theme.colors.primaryShadow}`
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    ĐANG TẠO...
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    TẠO GIỌNG NÓI
                  </>
                )}
              </button>

              {error && (
                <div className={`p-4 ${theme.colors.errorBg}/10 border ${theme.colors.errorBg}/20 rounded-2xl flex items-start gap-3 ${theme.colors.error}`}>
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-bold leading-tight">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default TextToAudioModule;
