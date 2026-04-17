
import { supabase } from './lib/supabase';
import React, { useState, useEffect, useRef } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import KocReviewModule from './modules/KocReviewModule';
import KocReviewModule2 from './modules/KocReviewModule2';
import Shopee8sModule from './modules/Shopee8sModule';
import CoverLinkModule from './modules/CoverLinkModule';
import CarouselModule from './modules/CarouselModule';
import VideoPovModule from './modules/VideoPovModule';
import PersonificationModule from './modules/PersonificationModule';
import Personification2Module from './modules/Personification2Module';
import FashionTrackingModule from './modules/FashionTrackingModule';
import VuaTvModule from './modules/VuaTvModule';
import DhbcModule from './modules/DhbcModule';
import TimelapseModule from './modules/TimelapseModule';
import FeatureIntroModule from './modules/FeatureIntroModule';
import ChatbotStudioModule from './modules/ChatbotStudioModule';
import ReviewDoiThoaiModule from './modules/ReviewDoiThoaiModule';
import TextToAudioModule from './modules/TextToAudioModule';
import Camera360Module from './modules/Camera360Module';
import { theme } from './constants/colors';
import logoImage from './components/logo.jpeg';

type ModuleTab = 'intro' | 'koc' | 'koc2' | 'shopee8s' | 'videopov' | 'carousel' | 'fashiontracking' | 'personification' | 'personification2' | 'coverlink' | 'dhbc' | 'vuatv' | 'timelapse' | 'chatbot' | 'doithoai' | 'texttoaudio' | 'camera360';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('koc_goveoai_auth') === 'true';
  });
  const [loggedInUser, setLoggedInUser] = useState<string | null>(() => {
    return sessionStorage.getItem('koc_goveoai_user');
  });
  const [allowedModules, setAllowedModules] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('koc_goveoai_modules');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentTab, setCurrentTab] = useState<ModuleTab>('chatbot');

  const [themeConfig, setThemeConfig] = useState(() => {
    const saved = localStorage.getItem('koc_goveoai_theme');
    return saved ? JSON.parse(saved) : {
      primaryColor: '#1A3C5F',
      secondaryColor: '#CCCCCC',
      fontColor: '#000000',
      logoColor: '#1A3C5F',
      customLogo: logoImage,
      logoSize: 100,
      appName: 'KOC STUDIO',
      appSubtitle: 'AI FOR AFFILIATE & SELLER'
    };
  });
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('vi');
  
  useEffect(() => {
    // Read Google Translate cookie on load
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };
    
    const googtrans = getCookie('googtrans');
    if (googtrans) {
      const lang = googtrans.split('/').pop();
      if (lang) setCurrentLanguage(lang);
    }
  }, []);

  const changeLanguage = (lng: string) => {
    setCurrentLanguage(lng);
    
    // Set Google Translate cookie
    const domain = window.location.hostname;
    
    if (lng === 'vi') {
      // Clear Google Translate cookies to restore original language (Vietnamese)
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}`;
      
      // Reload to completely remove Google Translate modifications
      window.location.reload();
      return;
    }

    document.cookie = `googtrans=/vi/${lng}; path=/; domain=${domain}`;
    document.cookie = `googtrans=/vi/${lng}; path=/`;
    
    const tryChange = (retryCount = 0) => {
      const selectEl = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectEl) {
        selectEl.value = lng;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (retryCount < 20) {
        // Retry more times and more frequently
        setTimeout(() => tryChange(retryCount + 1), 300);
      }
    };
    
    tryChange();
  };


  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(sessionStorage.getItem('koc_studio_session_id') || Math.random().toString(36).substring(2, 15));

  useEffect(() => {
    if (!sessionStorage.getItem('koc_studio_session_id')) {
      sessionStorage.setItem('koc_studio_session_id', sessionId.current);
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('koc_goveoai_auth');
    sessionStorage.removeItem('koc_goveoai_user');
    sessionStorage.removeItem('koc_goveoai_modules');
    sessionStorage.removeItem('koc_studio_session_id');
    setIsAuthenticated(false);
    setLoggedInUser(null);
    setAllowedModules([]);
    window.location.reload();
  };


  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', themeConfig.primaryColor);
    root.style.setProperty('--secondary-color', themeConfig.secondaryColor);
    root.style.setProperty('--font-color', themeConfig.fontColor);
    root.style.setProperty('--logo-color', themeConfig.logoColor);
    
    // Calculate hover colors (simple darken)
    const darken = (hex: string, amount: number) => {
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);
      r = Math.max(0, r - amount);
      g = Math.max(0, g - amount);
      b = Math.max(0, b - amount);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    
    root.style.setProperty('--primary-hover-color', darken(themeConfig.primaryColor, 20));
    root.style.setProperty('--accent-hover-color', darken(themeConfig.primaryColor, 10));
    root.style.setProperty('--danger-hover-color', darken(themeConfig.primaryColor, 10));
    
    localStorage.setItem('koc_goveoai_theme', JSON.stringify(themeConfig));
  }, [themeConfig]);

  useEffect(() => {
    const handleExportReady = (e: any) => {
      const { data, moduleName } = e.detail;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${moduleName}_export_${new Date().getTime()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    };

    const handleImportProgress = (e: any) => {
      const { percent, complete } = e.detail;
      setImportProgress(percent);
      if (percent > 0 && !complete) {
        setIsImporting(true);
      }
      if (complete) {
        setTimeout(() => {
          setIsImporting(false);
          setImportProgress(0);
        }, 800);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };

    window.addEventListener('EXPORT_DATA_READY', handleExportReady);
    window.addEventListener('IMPORT_DATA_PROGRESS', handleImportProgress);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('EXPORT_DATA_READY', handleExportReady);
      window.removeEventListener('IMPORT_DATA_PROGRESS', handleImportProgress);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const triggerExport = () => {
    window.dispatchEvent(new CustomEvent('REQUEST_EXPORT_DATA'));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        setIsImporting(true);
        setImportProgress(0);
        window.dispatchEvent(new CustomEvent('REQUEST_IMPORT_DATA', { detail: jsonData }));
      } catch (err) {
        alert("File JSON không đúng định dạng!");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      // Authenticate via Supabase
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.trim())
        .eq('password', password.trim())
        .single();

      if (error || !userData) {
        setLoginError('Sai thông tin tên hoặc mật khẩu\nVui lòng liên hệ Admin');
        return;
      }

      if (userData.status === 'suspended') {
        setLoginError('Tài khoản đã bị khóa. Liên hệ Admin.');
        return;
      }

      // Đăng nhập thành công
      // Admin gets full access, others check role
      let allowed: string[] = [];
      if (userData.role === 'admin' || username.trim() === 'admin') {
        allowed = tabs.map(t => String(t.moduleId));
      } else {
        // All active users get full access by default
        allowed = tabs.map(t => String(t.moduleId));
      }

      setAllowedModules(allowed);
      sessionStorage.setItem('koc_goveoai_modules', JSON.stringify(allowed));

      setIsAuthenticated(true);
      setLoggedInUser(username.trim());
      sessionStorage.setItem('koc_goveoai_auth', 'true');
      sessionStorage.setItem('koc_goveoai_user', username.trim());
      sessionStorage.setItem('koc_goveoai_api_key', userData.api_key || '');
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError('Có lỗi xảy ra khi đăng nhập: ' + (error.message || 'Vui lòng thử lại sau.'));
    } finally {
      setIsLoggingIn(false);
    }
  };



  const getLanguageLabel = (code: string) => {
    try {
      const displayNames = new Intl.DisplayNames([currentLanguage], { type: 'language' });
      let label = displayNames.of(code) || code;
      // Special case for zh-CN to keep it simple
      if (code === 'zh-CN' && currentLanguage === 'zh-CN') return '中文';
      if (code === 'zh-CN' && currentLanguage === 'vi') return 'Tiếng Trung';
      
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch (e) {
      const fallbacks: Record<string, string> = {
        'vi': 'Tiếng Việt',
        'en': 'English',
        'ja': '日本語',
        'ko': '한국어',
        'zh-CN': '中文',
        'th': 'ไทย',
        'id': 'Indonesia',
        'ms': 'Malaysia',
        'tl': 'Philippines',
        'km': 'Campuchia',
        'lo': 'Lào',
        'my': 'Myanmar',
        'fr': 'Pháp',
        'de': 'Đức'
      };
      return fallbacks[code] || code;
    }
  };

  const renderActiveModule = () => {
    switch(currentTab) {
      case 'intro': return <FeatureIntroModule />;
      case 'koc': return <KocReviewModule language={currentLanguage} />;
      case 'koc2': return <KocReviewModule2 language={currentLanguage} />;
      case 'shopee8s': return <Shopee8sModule language={currentLanguage} />;
      case 'videopov': return <VideoPovModule language={currentLanguage} />;
      case 'carousel': return <CarouselModule language={currentLanguage} />;
      case 'fashiontracking': return <FashionTrackingModule language={currentLanguage} />;
      case 'personification': return <PersonificationModule language={currentLanguage} />;
      case 'personification2': return <Personification2Module language={currentLanguage} />;
      case 'coverlink': return <CoverLinkModule language={currentLanguage} />;
      case 'dhbc': return <DhbcModule language={currentLanguage} />;
      case 'vuatv': return <VuaTvModule language={currentLanguage} />;
      case 'timelapse': return <TimelapseModule language={currentLanguage} />;
      case 'chatbot': return <ChatbotStudioModule onTabChange={setCurrentTab} language={currentLanguage} />;
      case 'doithoai': return <ReviewDoiThoaiModule language={currentLanguage} />;
      case 'texttoaudio': return <TextToAudioModule loggedInUser={loggedInUser} />;
      case 'camera360': return <Camera360Module language={currentLanguage} />;
      default: return <KocReviewModule2 language={currentLanguage} />;
    }
  };

  const tabs: { id: ModuleTab; label: string; icon: React.ReactNode; moduleId: number }[] = [
    { id: 'intro', moduleId: 0, label: 'Giới thiệu tính năng', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'chatbot', moduleId: 1, label: 'Chatbot Studio', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
    { id: 'koc2', moduleId: 2, label: 'KOC Review', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'doithoai', moduleId: 3, label: 'Review đối thoại', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg> },
    { id: 'videopov', moduleId: 4, label: 'Kiến Thức - Dịch Vụ', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: 'carousel', moduleId: 5, label: 'Ảnh Cuộn Tiktok', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: 'shopee8s', moduleId: 6, label: 'Shopee Video', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66-1.34-3-3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H9c0 1.66 1.34 3 3 3s3-1.34 3-3h-2c0 1.66-1.34-3-3 3z"/></svg> },
    { id: 'personification', moduleId: 7, label: 'Nhân Hóa Review', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { id: 'personification2', moduleId: 8, label: 'Nhân Hóa (Kiến thức)', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'fashiontracking', moduleId: 9, label: 'Fashion Tracking', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 4L9 7" /></svg> },
    { id: 'timelapse', moduleId: 10, label: 'Timelapse (Tua nhanh)', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'coverlink', moduleId: 11, label: 'Cover Link Shopee', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 00-5.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
    { id: 'texttoaudio', moduleId: 12, label: 'Text to Audio', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> },
    { id: 'camera360', moduleId: 13, label: 'Camera 360', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { id: 'dhbc', moduleId: 14, label: 'Đuổi Hình Bắt Chữ', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a2 2 0 002 2h1a2 2 0 110 4h-1a2 2 0 00-2 2v1a2 2 0 11-4 0V11a2 2 0 11-4 0V11a2 2 0 00-2-2H7a2 2 0 110-4h1a2 2 0 110-4h1a2 2 0 002-2V4z" /></svg> },
    { id: 'vuatv', moduleId: 15, label: 'Vua Tiếng Việt', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
  ];

  const visibleTabs = tabs.filter(t => allowedModules.includes(String(t.moduleId)));
  const leftTabs = visibleTabs.filter((_, i) => i < Math.ceil(visibleTabs.length / 2));
  const rightTabs = visibleTabs.filter((_, i) => i >= Math.ceil(visibleTabs.length / 2));
  
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${theme.colors.background} flex flex-col items-center justify-start p-6 relative overflow-hidden`}>
        <div className={`absolute top-[-10%] left-[-10%] w-80 h-80 ${theme.colors.primaryBg}/10 rounded-full blur-[120px] animate-pulse`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-80 h-80 ${theme.colors.accentBg}/5 rounded-full blur-[120px] animate-pulse delay-700`}></div>
        <div className={`w-full max-w-md ${theme.colors.cardBackground} rounded-[2.5rem] p-10 !mt-[50px] shadow-2xl relative z-10 border ${theme.colors.border} transform transition-all`}>
          <div className="flex flex-col items-center mb-10 notranslate" translate="no">
            {themeConfig.customLogo ? (
              <div className="mb-6 flex items-center justify-center" style={{ width: `${themeConfig.logoSize || 80}px`, height: `${themeConfig.logoSize || 80}px` }}>
                <img src={themeConfig.customLogo} alt="Custom Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="relative w-20 h-16 flex items-center justify-center mb-6">
                  <div className={`absolute left-0 top-1 w-12 h-12 ${theme.colors.logoBg} rounded-2xl flex items-center justify-center shadow-lg transform -rotate-12 border border-brand-primary/20`}>
                      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66-1.34-3-3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H9c0 1.66 1.34 3 3 3s3-1.34 3-3h-2c0 1.66-1.34-3-3 3z"/></svg>
                  </div>
                  <div className={`absolute left-6 top-0 w-12 h-12 bg-brand-secondary rounded-2xl flex items-center justify-center shadow-xl border border-brand-secondary/30 transform rotate-12 z-10`}>
                      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1.01V14c0 1.39-.24 2.77-.92 4-1.14 2.1-3.41 3.52-5.76 3.75-2.29.23-4.73-.61-6.22-2.39-1.48-1.78-1.89-4.38-1.04-6.52.85-2.14 2.92-3.71 5.21-3.95v4c-.81.14-1.61.64-2 1.38-.4.75-.41 1.7-.1 2.47.33.82 1.05 1.48 1.93 1.66 1.01.21 2.15-.12 2.8-.93.38-.47.56-1.07.56-1.67V.02z"/></svg>
                  </div>
              </div>
            )}
            <h1 className={`text-3xl font-black ${theme.colors.textPrimary} uppercase tracking-[2px] leading-none`}>
              {themeConfig.appName || 'KOC STUDIO'}
            </h1>
            <p className={`text-[10px] font-bold ${theme.colors.textMuted} uppercase tracking-[0.3em] mt-1`}>
              {themeConfig.appSubtitle || 'AI FOR AFFILIATE & SELLER'}
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black ${theme.colors.textMuted} uppercase tracking-widest px-1`}>Tên đăng nhập</label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.colors.textMuted}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></span>
                <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setLoginError(null); }} placeholder="Nhập tên người dùng..." className={`w-full pl-12 pr-4 py-4 ${theme.colors.inputBg} border ${theme.colors.border} rounded-2xl text-sm font-bold outline-none ${theme.colors.inputFocus} transition-all placeholder:text-slate-500 ${theme.colors.textPrimary}`} required autoFocus />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black ${theme.colors.textMuted} uppercase tracking-widest px-1`}>Mật khẩu</label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.colors.textMuted}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></span>
                <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(null); }} placeholder="Nhập mật khẩu..." className={`w-full pl-12 pr-4 py-4 ${theme.colors.inputBg} border ${theme.colors.border} rounded-2xl text-sm font-bold outline-none ${theme.colors.inputFocus} transition-all placeholder:text-slate-500 ${theme.colors.textPrimary}`} required />
              </div>
            </div>
            <button type="submit" disabled={isLoggingIn} className={`w-full py-5 ${theme.colors.buttonPrimary} font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest mt-4 disabled:opacity-50 disabled:cursor-not-allowed`}>
              {isLoggingIn ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
            </button>
            {loginError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl animate-fadeIn">
                <p className="text-[12px] font-bold text-red-600 text-center whitespace-pre-line leading-relaxed">
                  {loginError}
                </p>
              </div>
            )}
          </form>
          <div className="mt-10 text-center"><p className={`text-[10px] font-bold ${theme.colors.textMuted} uppercase tracking-widest leading-relaxed`}>Công cụ tối thiểu - Hiệu suất tối đa</p></div>
          <div className="mt-4 text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-[11px] font-bold text-blue-700 leading-relaxed">
              📱 Liên hệ Zalo <a href="https://zalo.me/0934415387" target="_blank" rel="noopener noreferrer" className="font-black text-blue-800 underline hover:text-blue-600 transition-colors">Đường Thọ - 0934415387</a> để tạo tài khoản
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${theme.colors.background} flex flex-col relative font-['Inter']`}>
        {/* === NAVBAR === */}
        <nav className={`${theme.colors.cardBackground} border-b ${theme.colors.borderLight} sticky top-0 z-[100] h-16 md:h-20 flex items-center shadow-sm`}>
          <div className="max-w-7xl mx-auto w-full px-3 md:px-6 flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2 md:gap-4 shrink-0 notranslate" translate="no">
                  {themeConfig.customLogo ? (
                    <div className="flex items-center justify-center" style={{ width: `${Math.min((themeConfig.logoSize || 80) * 0.5, 40)}px`, height: `${Math.min((themeConfig.logoSize || 80) * 0.5, 40)}px` }}>
                      <img src={themeConfig.customLogo} alt="Custom Logo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="relative w-10 md:w-14 h-10 md:h-12 flex items-center">
                        <div className={`absolute left-0 top-1 w-7 md:w-9 h-7 md:h-9 ${theme.colors.logoBg} rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transform -rotate-12 border border-brand-primary/20`}>
                            <svg className="w-4 md:w-6 h-4 md:h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66-1.34-3-3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H9c0 1.66 1.34 3 3 3s3-1.34 3-3h-2c0 1.66-1.34-3-3 3z"/></svg>
                        </div>
                        <div className={`absolute left-4 md:left-5 top-0 w-7 md:w-9 h-7 md:h-9 bg-brand-secondary rounded-lg md:rounded-xl flex items-center justify-center shadow-xl border border-brand-secondary/30 transform rotate-12 z-10 transition-transform hover:rotate-0 duration-500`}>
                            <svg className="w-4 md:w-6 h-4 md:h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1.01V14c0 1.39-.24 2.77-.92 4-1.14 2.1-3.41 3.52-5.76 3.75-2.29.23-4.73-.61-6.22-2.39-1.48-1.78-1.89-4.38-1.04-6.52.85-2.14 2.92-3.71 5.21-3.95v4c-.81.14-1.61.64-2 1.38-.4.75-.41 1.7-.1 2.47.33.82 1.05 1.48 1.93 1.66 1.01.21 2.15-.12 2.8-.93.38-.47.56-1.07.56-1.67V.02z"/></svg>
                        </div>
                    </div>
                  )}
                  <div className="flex flex-col leading-none">
                      <span className={`${theme.colors.textPrimary} font-black text-lg md:text-2xl tracking-[1px] md:tracking-[2px] uppercase whitespace-nowrap`}>
                        {themeConfig.appName || 'KOC STUDIO'}
                      </span>
                      <span className={`${theme.colors.textMuted} font-bold text-[8px] md:text-[10px] tracking-[0.15em] md:tracking-[0.25em] uppercase mt-0.5 whitespace-nowrap`}>
                        {themeConfig.appSubtitle || 'AI FOR AFFILIATE & SELLER'}
                      </span>
                  </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-1 md:gap-4">
                {/* Menu Button */}
                <div className="relative" ref={categoryMenuRef}>
                    <button 
                      onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                      className={`h-10 md:h-12 px-3 md:px-6 rounded-full border ${theme.colors.border} ${theme.colors.cardBackground} hover:${theme.colors.inputBg} transition-all flex items-center gap-2 md:gap-3 shadow-sm group active:scale-95`}
                    >
                      <svg className={`w-5 h-5 ${theme.colors.textPrimary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span className={`${theme.colors.textPrimary} font-black text-xs uppercase tracking-wider hidden md:inline`}>MENU DANH MỤC</span>
                    </button>

                    {/* Category Menu - Responsive: full-screen on mobile, dropdown on desktop */}
                    {isCategoryMenuOpen && (
                      <>
                        {/* Mobile overlay backdrop */}
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[109] md:hidden" onClick={() => setIsCategoryMenuOpen(false)} />
                        <div className={`fixed inset-x-0 bottom-0 top-auto max-h-[80vh] md:absolute md:right-0 md:left-auto md:bottom-auto md:top-full md:mt-3 md:w-[640px] md:max-h-none ${theme.colors.cardBackground} rounded-t-3xl md:rounded-2xl shadow-2xl border ${theme.colors.borderLight} overflow-hidden z-[110] animate-fadeIn`}>
                          {/* Mobile drag handle */}
                          <div className="flex justify-center pt-3 pb-1 md:hidden">
                            <div className="w-10 h-1 bg-slate-300 rounded-full" />
                          </div>
                          <div className="p-4 overflow-y-auto max-h-[70vh] md:max-h-none">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1">
                                <div className={`text-[10px] font-black ${theme.colors.textMuted} uppercase tracking-widest mb-2 px-2`}>Kênh Review & Story</div>
                                {leftTabs.map((t) => (
                                  <button 
                                    key={t.id} 
                                    onClick={() => {
                                      setCurrentTab(t.id);
                                      setIsCategoryMenuOpen(false);
                                    }} 
                                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-3 ${currentTab === t.id ? `${theme.colors.buttonPrimary} shadow-md` : `${theme.colors.textSecondary} hover:${theme.colors.inputBg}`}`}
                                  >
                                    <span className={`${currentTab === t.id ? 'text-white' : theme.colors.textMuted} notranslate`} translate="no">
                                      {t.icon}
                                    </span>
                                    <span className="notranslate" translate="no">{t.label}</span>
                                  </button>
                                ))}
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className={`text-[10px] font-black ${theme.colors.textMuted} uppercase tracking-widest mb-2 px-2`}>Sáng tạo & Công cụ</div>
                                {rightTabs.map((t) => (
                                  <button 
                                    key={t.id} 
                                    onClick={() => {
                                      setCurrentTab(t.id);
                                      setIsCategoryMenuOpen(false);
                                    }} 
                                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-3 ${currentTab === t.id ? `${theme.colors.buttonPrimary} shadow-md` : `${theme.colors.textSecondary} hover:${theme.colors.inputBg}`}`}
                                  >
                                    <span className={`${currentTab === t.id ? 'text-white' : theme.colors.textMuted} notranslate`} translate="no">
                                      {t.icon}
                                    </span>
                                    <span className="notranslate" translate="no">{t.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                </div>

                {/* Language Button */}
                <div className="relative" ref={languageMenuRef}>
                  <button 
                    onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                    className={`h-10 md:h-12 px-3 md:px-6 rounded-full border ${theme.colors.border} ${theme.colors.cardBackground} hover:${theme.colors.inputBg} transition-all flex items-center gap-2 md:gap-3 shadow-sm group active:scale-95 notranslate`}
                    translate="no"
                  >
                    <svg className={`w-5 h-5 ${theme.colors.textPrimary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.198 15.53 6 18.512" />
                    </svg>
                    <span className={`${theme.colors.textPrimary} font-black text-xs uppercase tracking-wider hidden md:inline`}>LANGUAGE</span>
                  </button>

                  {isLanguageMenuOpen && (
                    <div className={`absolute right-0 mt-3 w-48 ${theme.colors.cardBackground} rounded-2xl shadow-2xl border ${theme.colors.borderLight} overflow-hidden z-[110] animate-fadeIn p-2 notranslate`} translate="no">
                      <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
                        {[
                          'vi', 'en', 'ja', 'ko', 'zh-CN', 'th', 'id', 'ms', 'tl', 'km', 'lo', 'my', 'fr', 'de'
                        ].map((code) => (
                          <button
                            key={code}
                            onClick={() => {
                              changeLanguage(code);
                              setIsLanguageMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center justify-between ${currentLanguage === code ? `${theme.colors.buttonPrimary} text-white shadow-md` : `${theme.colors.textSecondary} hover:${theme.colors.inputBg}`}`}
                          >
                            {getLanguageLabel(code)}
                            {currentLanguage === code && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Logout Button */}
                <button 
                  onClick={handleLogout} 
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border ${theme.colors.border} ${theme.colors.cardBackground} hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm active:scale-95 group`}
                  title="Đăng xuất"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-black text-xs uppercase tracking-wider hidden md:inline">Đăng xuất</span>
                </button>
              </div>
          </div>
        </nav>

        {currentTab !== 'intro' && currentTab !== 'chatbot' && (
          <div className="max-w-7xl mx-auto w-full px-3 md:px-6 pt-4 md:pt-6">
            <div className={`${theme.colors.cardBackground} rounded-2xl border ${theme.colors.borderLight} py-3 px-4 md:px-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${theme.colors.inputBg} rounded-lg flex items-center justify-center ${theme.colors.textMuted} border ${theme.colors.borderLight}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                </div>
                <div className="leading-tight">
                  <h4 className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-widest`}>Quản lý Dữ liệu</h4>
                  <p className={`text-[9px] ${theme.colors.textMuted} font-bold uppercase tracking-tighter`}>Import / Export JSON</p>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-white text-[9px] font-black rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  Tải Data (Import)
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="application/json" />
                
                <button 
                  onClick={triggerExport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-white text-[9px] font-black rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  Xuất file JSON
                </button>
              </div>
            </div>
          </div>
        )}
        
        <main className="flex-1 pb-20 md:pb-32 text-[14px]">
          {renderActiveModule()}
        </main>

        <footer className={`${theme.colors.cardBackground} border-t ${theme.colors.borderLight} py-2 md:py-4 fixed bottom-0 left-0 right-0 z-[60]`}>
          <div className="max-w-7xl mx-auto px-3 md:px-6 flex items-center justify-center">
            <div className={`${theme.colors.textMuted} font-bold text-[10px] md:text-[12px] tracking-tight uppercase`}>{theme.branding.copyright}</div>
          </div>
        </footer>

        {isImporting && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md notranslate" translate="no">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border border-slate-100 animate-fadeIn">
              <div className={`w-20 h-20 ${theme.colors.primaryBg}/10 rounded-full flex items-center justify-center mx-auto mb-6`}>
                <svg className={`w-10 h-10 ${theme.colors.primaryText} animate-bounce`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <h3 className={`text-xl font-black ${theme.colors.textPrimary} uppercase tracking-tighter mb-2`}>
                <span>Đang nạp dữ liệu...</span>
              </h3>
              <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-200">
                <div className={`absolute top-0 left-0 h-full ${theme.colors.primaryBg} transition-all duration-300 ease-out shadow-[0_0_15px_rgba(249,115,22,0.3)]`} style={{ width: `${importProgress}%` }} />
              </div>
              <span className={`text-3xl font-black ${theme.colors.primaryText} tabular-nums`}>
                <span>{importProgress}%</span>
              </span>
            </div>
          </div>
        )}

      </div>
    </ErrorBoundary>
  );
};

export default App;

