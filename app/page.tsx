'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ===============================================================
// Types
// ===============================================================
interface UserData {
  id: string;
  username: string;
  api_key: string;
  role: string;
  status: string;
  credits: number;
  created_at: string;
}

interface JobState {
  job_id: string;
  status: string;
  progress: number;
  image_url?: string | null;
  video_url?: string | null;
  error?: string;
  flow_api_url?: string;
}

type ActiveTab = 'prompt' | 'image' | 'video' | 'history' | 'admin';

// ===============================================================
// Main App Component
// ===============================================================
export default function Home() {
  // Auth state
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<ActiveTab>('image');
  
  // Prompt generation
  const [promptTopic, setPromptTopic] = useState('');
  const [promptType, setPromptType] = useState<'image' | 'video'>('image');
  const [promptStyle, setPromptStyle] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);

  // Image generation
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageAspect, setImageAspect] = useState('1:1');
  const [imageUpscale, setImageUpscale] = useState('4K');
  const [imageJob, setImageJob] = useState<JobState | null>(null);
  const [imageGenerating, setImageGenerating] = useState(false);

  // Video generation
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspect, setVideoAspect] = useState('16:9');
  const [videoLength, setVideoLength] = useState(8);
  const [videoJob, setVideoJob] = useState<JobState | null>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);

  // History
  const [history, setHistory] = useState<any[]>([]);

  // Polling refs
  const imagePollingRef = useRef<NodeJS.Timeout | null>(null);
  const videoPollingRef = useRef<NodeJS.Timeout | null>(null);

  // ===============================================================
  // Auth: Check session on load
  // ===============================================================
  useEffect(() => {
    const savedUser = localStorage.getItem('kocgoveoai_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }
    setIsLoading(false);
  }, []);

  // ===============================================================
  // Auth: Login / Register
  // ===============================================================
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: loginMode,
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Có lỗi xảy ra');
        return;
      }

      setUser(data.user);
      localStorage.setItem('kocgoveoai_user', JSON.stringify(data.user));
    } catch (err: any) {
      setAuthError('Không thể kết nối server: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('kocgoveoai_user');
  };

  // ===============================================================
  // Generate Prompt (Gemini)
  // ===============================================================
  const generatePrompt = async () => {
    if (!promptTopic.trim()) return;
    setPromptLoading(true);
    setGeneratedPrompt('');

    try {
      const res = await fetch('/api/generate/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: promptTopic,
          type: promptType,
          style: promptStyle,
          apiKey: user?.api_key,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedPrompt(data.prompt);
    } catch (err: any) {
      setGeneratedPrompt('❌ Lỗi: ' + err.message);
    } finally {
      setPromptLoading(false);
    }
  };

  // ===============================================================
  // Poll Job Status
  // ===============================================================
  const pollJob = useCallback(async (jobId: string, type: 'image' | 'video') => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();

      const jobState: JobState = {
        job_id: jobId,
        status: data.status,
        progress: data.progress || 0,
        image_url: data.image_url,
        video_url: data.video_url,
        error: data.error,
      };

      if (type === 'image') {
        setImageJob(jobState);
        if (data.status === 'completed' || data.status === 'failed') {
          setImageGenerating(false);
          if (imagePollingRef.current) clearInterval(imagePollingRef.current);
        }
      } else {
        setVideoJob(jobState);
        if (data.status === 'completed' || data.status === 'failed') {
          setVideoGenerating(false);
          if (videoPollingRef.current) clearInterval(videoPollingRef.current);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, []);

  // ===============================================================
  // Generate Image
  // ===============================================================
  const generateImage = async () => {
    if (!imagePrompt.trim()) return;
    setImageGenerating(true);
    setImageJob(null);

    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspect_ratio: imageAspect,
          upscale_quality: imageUpscale,
          apiKey: user?.api_key,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setImageJob({
        job_id: data.job_id,
        status: 'queued',
        progress: 0,
        flow_api_url: data.flow_api_url,
      });

      // Start polling
      imagePollingRef.current = setInterval(() => {
        pollJob(data.job_id, 'image');
      }, 4000);

    } catch (err: any) {
      setImageGenerating(false);
      setImageJob({ job_id: '', status: 'failed', progress: 0, error: err.message });
    }
  };

  // ===============================================================
  // Generate Video
  // ===============================================================
  const generateVideo = async () => {
    if (!videoPrompt.trim()) return;
    setVideoGenerating(true);
    setVideoJob(null);

    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspect_ratio: videoAspect,
          video_length_seconds: videoLength,
          apiKey: user?.api_key,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVideoJob({
        job_id: data.job_id,
        status: 'queued',
        progress: 0,
        flow_api_url: data.flow_api_url,
      });

      // Start polling
      videoPollingRef.current = setInterval(() => {
        pollJob(data.job_id, 'video');
      }, 5000);

    } catch (err: any) {
      setVideoGenerating(false);
      setVideoJob({ job_id: '', status: 'failed', progress: 0, error: err.message });
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (imagePollingRef.current) clearInterval(imagePollingRef.current);
      if (videoPollingRef.current) clearInterval(videoPollingRef.current);
    };
  }, []);

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Use generated prompt
  const usePromptFor = (type: 'image' | 'video') => {
    if (type === 'image') {
      setImagePrompt(generatedPrompt);
      setActiveTab('image');
    } else {
      setVideoPrompt(generatedPrompt);
      setActiveTab('video');
    }
  };

  // ===============================================================
  // Loading screen
  // ===============================================================
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner-lg" />
      </div>
    );
  }

  // ===============================================================
  // LOGIN SCREEN
  // ===============================================================
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        zIndex: 10,
      }}>
        <div className="glass-card animate-slideUp" style={{ width: '100%', maxWidth: '420px', padding: '48px 40px' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: 64,
              height: 64,
              background: 'var(--accent-gradient)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '1.8rem',
              boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
            }}>
              ⚡
            </div>
            <h1 className="heading-xl" style={{ fontSize: '2rem', marginBottom: '8px' }}>KOC Goveoai</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
              AI Image & Video Generator
            </p>
          </div>

          {/* Tab Toggle */}
          <div className="tabs" style={{ marginBottom: '24px' }}>
            <button
              className={`tab ${loginMode === 'login' ? 'active' : ''}`}
              onClick={() => { setLoginMode('login'); setAuthError(''); }}
            >
              Đăng nhập
            </button>
            <button
              className={`tab ${loginMode === 'register' ? 'active' : ''}`}
              onClick={() => { setLoginMode('register'); setAuthError(''); }}
            >
              Đăng ký
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth}>
            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Tên đăng nhập</label>
              <input
                className="input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập username..."
                required
                autoFocus
              />
            </div>

            <div className="input-group" style={{ marginBottom: '24px' }}>
              <label>Mật khẩu</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                required
              />
            </div>

            {authError && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={authLoading}
            >
              {authLoading ? (
                <><div className="spinner" style={{ borderTopColor: 'white' }} /> Đang xử lý...</>
              ) : (
                loginMode === 'login' ? '🚀 Đăng nhập' : '✨ Đăng ký tài khoản'
              )}
            </button>
          </form>

          {/* Telegram hint */}
          <div style={{
            textAlign: 'center',
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(99, 102, 241, 0.05)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              💡 Bạn cũng có thể đăng ký qua Telegram Bot:<br />
              <a
                href="https://t.me/KOCgoveoai_bot"
                target="_blank"
                rel="noopener"
                style={{ color: 'var(--text-accent)', fontWeight: 700, textDecoration: 'none' }}
              >
                @KOCgoveoai_bot
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===============================================================
  // DASHBOARD
  // ===============================================================
  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 10 }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <div className="navbar-logo">⚡</div>
            <div>
              <div className="navbar-title">KOC Goveoai</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                AI Studio
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Credits badge */}
            <div className="badge badge-info">
              💰 {user.credits} credits
            </div>

            {/* User info */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              👤 {user.username}
              {user.role === 'admin' && <span style={{ color: 'var(--warning)', marginLeft: 4 }}>👑</span>}
            </div>

            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container" style={{ paddingTop: '24px', paddingBottom: '80px' }}>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }} className="animate-fadeIn">
          <div className="stat-card">
            <div className="stat-value text-gradient">💰 {user.credits}</div>
            <div className="stat-label">Credits còn lại</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>🎨 GEM_PIX_2</div>
            <div className="stat-label">Model ảnh (Nano Banana 2)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--info)' }}>🎬 VEO 3.1</div>
            <div className="stat-label">Model video (Lite Free - 0 credit)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--text-accent)' }}>🔑</div>
            <div className="stat-label" style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(user.api_key)} title="Click to copy">
              API Key: {user.api_key.substring(0, 8)}... 📋
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: '24px' }}>
          <button className={`tab ${activeTab === 'prompt' ? 'active' : ''}`} onClick={() => setActiveTab('prompt')}>
            ✨ Tạo Prompt
          </button>
          <button className={`tab ${activeTab === 'image' ? 'active' : ''}`} onClick={() => setActiveTab('image')}>
            🎨 Tạo Ảnh
          </button>
          <button className={`tab ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>
            🎬 Tạo Video
          </button>
        </div>

        {/* ═══ TAB: PROMPT GENERATOR ═══ */}
        {activeTab === 'prompt' && (
          <div className="glass-card-static animate-fadeIn" style={{ padding: '32px' }}>
            <h2 className="heading-lg" style={{ marginBottom: '6px' }}>✨ Tạo Prompt bằng AI</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Sử dụng Gemini AI để tạo prompt chuyên nghiệp cho ảnh hoặc video
            </p>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="input-group">
                <label>Chủ đề / Ý tưởng</label>
                <textarea
                  className="input"
                  value={promptTopic}
                  onChange={(e) => setPromptTopic(e.target.value)}
                  placeholder="VD: Một cô gái Việt Nam mặc áo dài trắng đi dưới hàng phượng vĩ..."
                  style={{ minHeight: '100px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Loại prompt</label>
                  <select className="input" value={promptType} onChange={(e) => setPromptType(e.target.value as 'image' | 'video')}>
                    <option value="image">🎨 Ảnh</option>
                    <option value="video">🎬 Video</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Phong cách (tuỳ chọn)</label>
                  <input
                    className="input"
                    value={promptStyle}
                    onChange={(e) => setPromptStyle(e.target.value)}
                    placeholder="VD: Cinematic, Anime, Realistic..."
                  />
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                onClick={generatePrompt}
                disabled={promptLoading || !promptTopic.trim()}
              >
                {promptLoading ? (
                  <><div className="spinner" style={{ borderTopColor: 'white' }} /> Đang tạo prompt...</>
                ) : (
                  '✨ Tạo Prompt với Gemini AI'
                )}
              </button>
            </div>

            {/* Generated Result */}
            {generatedPrompt && (
              <div className="result-container animate-fadeIn" style={{ marginTop: '24px' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="label">Prompt đã tạo</span>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(generatedPrompt)}>
                      📋 Copy
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => usePromptFor('image')}>
                      🎨 Dùng cho Ảnh
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => usePromptFor('video')}>
                      🎬 Dùng cho Video
                    </button>
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {generatedPrompt}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: IMAGE GENERATOR ═══ */}
        {activeTab === 'image' && (
          <div className="glass-card-static animate-fadeIn" style={{ padding: '32px' }}>
            <h2 className="heading-lg" style={{ marginBottom: '6px' }}>🎨 Tạo Ảnh AI</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Model: <strong style={{ color: 'var(--text-accent)' }}>Nano Banana 2 (GEM_PIX_2)</strong> — Upscale miễn phí lên 4K
            </p>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="input-group">
                <label>Prompt mô tả ảnh</label>
                <textarea
                  className="input"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="VD: A beautiful Vietnamese girl in white ao dai walking under flamboyant trees, golden hour, cinematic lighting, 8K..."
                  style={{ minHeight: '120px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Tỉ lệ khung hình</label>
                  <select className="input" value={imageAspect} onChange={(e) => setImageAspect(e.target.value)}>
                    <option value="1:1">1:1 (Vuông)</option>
                    <option value="16:9">16:9 (Ngang)</option>
                    <option value="9:16">9:16 (Dọc)</option>
                    <option value="4:3">4:3 (Ngang nhẹ)</option>
                    <option value="3:4">3:4 (Dọc nhẹ)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Upscale chất lượng</label>
                  <select className="input" value={imageUpscale} onChange={(e) => setImageUpscale(e.target.value)}>
                    <option value="Không">Không upscale</option>
                    <option value="2K">2K (miễn phí)</option>
                    <option value="4K">4K (miễn phí)</option>
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                onClick={generateImage}
                disabled={imageGenerating || !imagePrompt.trim()}
              >
                {imageGenerating ? (
                  <><div className="spinner" style={{ borderTopColor: 'white' }} /> Đang tạo ảnh...</>
                ) : (
                  '🎨 Tạo Ảnh AI'
                )}
              </button>
            </div>

            {/* Image Job Status */}
            {imageJob && (
              <div className="result-container animate-fadeIn">
                <div className="flex items-center justify-between mb-2">
                  <span className="label">
                    {imageJob.status === 'completed' ? '✅ Hoàn thành' :
                     imageJob.status === 'failed' ? '❌ Thất bại' :
                     '⏳ Đang xử lý...'}
                  </span>
                  {imageJob.status === 'completed' && imageJob.image_url && (
                    <a
                      href={imageJob.image_url}
                      target="_blank"
                      rel="noopener"
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      📥 Tải ảnh
                    </a>
                  )}
                </div>

                {(imageJob.status === 'queued' || imageJob.status === 'running') && (
                  <div style={{ marginBottom: '12px' }}>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${imageJob.progress}%` }} />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {imageJob.progress}% — Polling mỗi 4 giây...
                    </div>
                  </div>
                )}

                {imageJob.status === 'completed' && imageJob.image_url && (
                  <img
                    src={imageJob.image_url}
                    alt="Generated"
                    className="result-image"
                    style={{ maxWidth: '100%' }}
                  />
                )}

                {imageJob.status === 'failed' && (
                  <div className="alert alert-error">⚠️ {imageJob.error}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: VIDEO GENERATOR ═══ */}
        {activeTab === 'video' && (
          <div className="glass-card-static animate-fadeIn" style={{ padding: '32px' }}>
            <h2 className="heading-lg" style={{ marginBottom: '6px' }}>🎬 Tạo Video AI</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Model: <strong style={{ color: 'var(--success)' }}>Veo 3.1 Lite Free (0 credit)</strong> — Video 8 giây miễn phí
            </p>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="input-group">
                <label>Prompt mô tả video</label>
                <textarea
                  className="input"
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="VD: Cinematic aerial shot over Halong Bay at sunset, drone flying slowly through limestone karsts, golden light reflecting on emerald water, 4K..."
                  style={{ minHeight: '120px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Tỉ lệ khung hình</label>
                  <select className="input" value={videoAspect} onChange={(e) => setVideoAspect(e.target.value)}>
                    <option value="16:9">16:9 (Ngang - YouTube)</option>
                    <option value="9:16">9:16 (Dọc - TikTok/Reels)</option>
                    <option value="1:1">1:1 (Vuông)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Thời lượng video</label>
                  <select className="input" value={videoLength} onChange={(e) => setVideoLength(parseInt(e.target.value))}>
                    <option value="6">6 giây</option>
                    <option value="8">8 giây</option>
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                onClick={generateVideo}
                disabled={videoGenerating || !videoPrompt.trim()}
              >
                {videoGenerating ? (
                  <><div className="spinner" style={{ borderTopColor: 'white' }} /> Đang tạo video (~60-120s)...</>
                ) : (
                  '🎬 Tạo Video AI (Miễn phí)'
                )}
              </button>
            </div>

            {/* Video Job Status */}
            {videoJob && (
              <div className="result-container animate-fadeIn">
                <div className="flex items-center justify-between mb-2">
                  <span className="label">
                    {videoJob.status === 'completed' ? '✅ Hoàn thành' :
                     videoJob.status === 'failed' ? '❌ Thất bại' :
                     '⏳ Đang xử lý...'}
                  </span>
                  {videoJob.status === 'completed' && videoJob.video_url && (
                    <a
                      href={videoJob.video_url}
                      target="_blank"
                      rel="noopener"
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      📥 Tải video
                    </a>
                  )}
                </div>

                {(videoJob.status === 'queued' || videoJob.status === 'running') && (
                  <div style={{ marginBottom: '12px' }}>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${videoJob.progress}%` }} />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {videoJob.progress}% — Video cần 60-120s để hoàn thành...
                    </div>
                  </div>
                )}

                {videoJob.status === 'completed' && videoJob.video_url && (
                  <video
                    src={videoJob.video_url}
                    controls
                    autoPlay
                    loop
                    className="result-video"
                    style={{ maxWidth: '100%' }}
                  />
                )}

                {videoJob.status === 'failed' && (
                  <div className="alert alert-error">⚠️ {videoJob.error}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 24px',
        background: 'rgba(10, 10, 15, 0.9)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'center',
        zIndex: 50,
      }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
          © 2026 KOC Goveoai — Powered by Gemini AI, Nano Banana 2 & Veo 3.1
        </p>
      </footer>
    </div>
  );
}
