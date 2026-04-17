import React, { useState, useEffect } from 'react';

interface Props {
  language?: string;
}

const CoverLinkModule: React.FC<Props> = ({ language = 'vi' }) => {
  const storageKey = "coverlink_project";
  const [state, setState] = useState({
    coverLinkInput: '',
    coverLinkNames: '',
    coverLinkUrls: '',
    coverLinkOutput: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setState(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const handleSplit = () => {
    const lines = state.coverLinkInput.split(/\r?\n/);
    let names = ""; let urls = "";
    lines.forEach(line => {
      const httpIndex = line.lastIndexOf("http");
      if (httpIndex !== -1) {
          names += line.substring(0, httpIndex).trim().replace(/:$/, '') + "\n";
          urls += line.substring(httpIndex).trim() + "\n";
      } else {
          names += line.trim() + "\n";
          urls += "\n";
      }
    });
    setState(p => ({ ...p, coverLinkNames: names.trimEnd(), coverLinkUrls: urls.trimEnd() }));
  };

  const handleMerge = () => {
      const names = state.coverLinkNames.split(/\r?\n/);
      const urls = state.coverLinkUrls.split(/\r?\n/);
      let out = "";
      for (let i = 0; i < Math.max(names.length, urls.length); i++) {
          const n = names[i]?.trim(); const u = urls[i]?.trim();
          if (n && u) out += `${n}: ${u}\n`;
          else if (n || u) out += `${n || u}\n`;
      }
      setState(p => ({ ...p, coverLinkOutput: out.trimEnd() }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
            <textarea value={state.coverLinkInput} onChange={e=>setState(p=>({...p, coverLinkInput: e.target.value}))} placeholder="Nhập text gốc (Tên: Link)" className="w-full h-48 p-4 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
            <button onClick={handleSplit} style={{ backgroundColor: 'var(--primary-color)' }} className="w-full py-4 text-white font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all">1. Tách Link</button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-1">Danh sách tên</label>
                  <textarea value={state.coverLinkNames} onChange={e=>setState(p=>({...p, coverLinkNames: e.target.value}))} className="w-full h-64 border border-slate-200 rounded-xl p-3 font-mono text-sm focus:ring-2 focus:ring-slate-100 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-1">Danh sách link</label>
                  <textarea value={state.coverLinkUrls} onChange={e=>setState(p=>({...p, coverLinkUrls: e.target.value}))} className="w-full h-64 border border-slate-200 rounded-xl p-3 font-mono text-sm focus:ring-2 focus:ring-slate-100 outline-none transition-all" />
                </div>
            </div>
            <button onClick={handleMerge} style={{ backgroundColor: 'var(--primary-color)' }} className="w-full py-4 text-white font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all">2. Ghép Link</button>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase px-1">Kết quả gộp</label>
              <textarea readOnly value={state.coverLinkOutput} className="w-full h-48 border border-slate-200 rounded-xl p-4 bg-slate-50 font-mono text-sm outline-none" />
            </div>
        </div>
    </div>
  );
};

export default CoverLinkModule;