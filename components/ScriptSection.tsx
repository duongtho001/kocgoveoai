
import React from 'react';

import { theme } from '../constants/colors';

interface ScriptSectionProps {
  title: string;
  content: string;
  color: string;
  onChange: (newText: string) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  minChars?: number;
  maxChars?: number;
  heightClass?: string;
}

const ScriptSection: React.FC<ScriptSectionProps> = ({ 
  title, 
  content, 
  color, 
  onChange, 
  onRegenerate,
  isRegenerating,
  minChars = 140,
  maxChars = 180,
  heightClass = "min-h-[180px]"
}) => {
  const charCount = content ? content.length : 0;
  
  // Logic kiểm tra độ dài theo yêu cầu động
  const isValid = charCount >= minChars && charCount <= maxChars;
  const isTooShort = charCount > 0 && charCount < minChars;
  const isTooLong = charCount > maxChars;

  return (
    <div className={`p-4 rounded-xl border ${theme.colors.borderLight} border-l-4 ${color} ${theme.colors.cardBackground} shadow-sm mb-4 group transition-all ${isValid ? 'ring-1 ring-green-100 bg-green-50/10' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className={`text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis`}>{title}</h3>
      </div>
      
      <div className="relative">
        <textarea
          className={`w-full ${theme.colors.textPrimary} text-sm leading-relaxed font-semibold resize-y ${heightClass} focus:outline-none focus:${theme.colors.secondaryBg} rounded p-2 -ml-2 bg-transparent border ${theme.colors.borderLight} transition-all ${isRegenerating ? 'opacity-30 pointer-events-none' : ''}`}
          value={content || ""}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Đang chờ kịch bản..."
        />
        {isRegenerating && (
          <div className={`absolute inset-0 flex items-center justify-center ${theme.colors.cardBackground}/50`}>
            <div className={`w-6 h-6 border-2 ${theme.colors.primaryBorder} border-t-transparent rounded-full animate-spin`}></div>
          </div>
        )}
      </div>

      <div className={`mt-2 flex justify-between items-center border-t ${theme.colors.borderLight} pt-2 notranslate`} translate="no">
        {onRegenerate ? (
          <button 
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm ${
              isValid 
              ? `${theme.colors.secondaryBg} ${theme.colors.textSecondary} hover:bg-brand-primary-hover hover:text-white` 
              : `${theme.colors.buttonPrimary} animate-pulse`
            } disabled:opacity-50`}
          >
            <svg className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Tạo lại</span>
          </button>
        ) : (
          <div className={`text-[10px] font-bold ${theme.colors.textSecondary} opacity-60 uppercase tracking-tighter italic`}>
            <span>{isValid ? 'Đạt mục tiêu ✓' : `Cần ${minChars}-${maxChars} ký tự`}</span>
          </div>
        )}
        
        <span className={`text-xs px-2 py-1 rounded-full font-black tabular-nums transition-all ${
            isValid 
            ? 'bg-green-100 text-green-700' 
            : isTooLong || isTooShort 
                ? `${theme.colors.primaryBg}/10 ${theme.colors.primaryText} animate-pulse` 
                : `${theme.colors.secondaryBg} ${theme.colors.textSecondary}`
        }`}>
          <span>{charCount} / {maxChars}</span>
        </span>
      </div>
    </div>
  );
};

export default ScriptSection;
