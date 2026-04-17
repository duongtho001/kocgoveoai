import React, { useState, useRef } from 'react';

export interface ProductTab {
  id: string;
  name: string;
  keyword: string;
  scriptTone: string;
  productSize: string;
  scriptNote: string;
  productPreviewUrls: string[];
  status: 'draft' | 'scripted' | 'images' | 'videos' | 'done';
}

interface MultiProductBarProps {
  products: ProductTab[];
  activeProductId: string;
  onSwitch: (id: string) => void;
  onAdd: (product: Partial<ProductTab>) => void;
  onRemove: (id: string) => void;
  onImportCSV: (products: Partial<ProductTab>[]) => void;
  onRename: (id: string, name: string) => void;
}

const STATUS_ICONS: Record<string, string> = {
  draft: '📝',
  scripted: '✍️',
  images: '🖼️',
  videos: '🎬',
  done: '✅',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500',
  scripted: 'bg-amber-500',
  images: 'bg-emerald-500',
  videos: 'bg-violet-500',
  done: 'bg-green-500',
};

const MultiProductBar: React.FC<MultiProductBarProps> = ({
  products, activeProductId, onSwitch, onAdd, onRemove, onImportCSV, onRename
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
  };

  // Download CSV template
  const downloadTemplate = () => {
    const header = 'Tên sản phẩm,Từ khóa,Tone giọng,Kích thước/Dung tích,Ghi chú kịch bản';
    const example1 = 'Kem chống nắng UV Shield,SPF50 chống nắng da dầu,Hài hước dí dỏm,50ml,Da nhạy cảm dùng được';
    const example2 = 'Son môi Cherry Velvet,Son lì đỏ cherry bền màu,Tự tin sành điệu,3.5g,Không chì không paraben';
    const example3 = 'Serum HA Plus,Serum cấp ẩm hyaluronic,Chuyên gia phân tích,30ml,Dùng sáng tối';
    const csv = [header, example1, example2, example3].join('\n');
    
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_san_pham_koc.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse CSV upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        alert('File CSV cần có ít nhất 1 dòng dữ liệu (dòng 1 là header)');
        return;
      }

      const products: Partial<ProductTab>[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Simple CSV parse (handle quoted values)
        const cols = parseCSVLine(lines[i]);
        if (cols.length >= 1 && cols[0].trim()) {
          products.push({
            name: cols[0]?.trim() || `Sản phẩm ${i}`,
            keyword: cols[1]?.trim() || '',
            scriptTone: cols[2]?.trim() || '',
            productSize: cols[3]?.trim() || '',
            scriptNote: cols[4]?.trim() || '',
            status: 'draft',
          });
        }
      }

      if (products.length === 0) {
        alert('Không tìm thấy sản phẩm hợp lệ trong file CSV');
        return;
      }

      onImportCSV(products);
      alert(`✅ Đã import ${products.length} sản phẩm!`);
    };
    reader.readAsText(file, 'UTF-8');
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">📦 Sản phẩm</span>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black">{products.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={downloadTemplate}
            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
            title="Tải file CSV mẫu"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Tải mẫu CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
            title="Import sản phẩm từ CSV"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSVUpload} className="hidden" />
          <button
            onClick={() => onAdd({ name: `SP ${products.length + 1}`, status: 'draft' })}
            className="px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-lg text-[8px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            Thêm SP
          </button>
        </div>
      </div>

      {/* Product tabs */}
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-thin">
        {products.map((p, idx) => (
          <div
            key={p.id}
            className={`group relative flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-all min-w-0 shrink-0 ${
              p.id === activeProductId
                ? 'bg-white shadow-md border-2 border-indigo-400 scale-[1.02]'
                : 'bg-white/60 border border-slate-200 hover:bg-white hover:shadow-sm hover:border-indigo-200'
            }`}
            onClick={() => onSwitch(p.id)}
          >
            {/* Status dot */}
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[p.status] || 'bg-slate-400'} shrink-0`} />
            
            {/* Name */}
            {editingId === p.id ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => handleSaveEdit(p.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(p.id); if (e.key === 'Escape') setEditingId(null); }}
                className="text-[10px] font-bold w-24 px-1 py-0.5 border border-indigo-300 rounded outline-none focus:ring-1 focus:ring-indigo-400"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className={`text-[10px] font-bold truncate max-w-[100px] ${
                  p.id === activeProductId ? 'text-indigo-700' : 'text-slate-600'
                }`}
                onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(p.id, p.name); }}
                title={`${p.name} — Double-click để đổi tên`}
              >
                {p.name}
              </span>
            )}

            {/* Remove button (hidden on active, shown on hover) */}
            {products.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(p.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded-full shrink-0"
                title="Xóa sản phẩm"
              >
                <svg className="w-3 h-3 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Simple CSV line parser (handles quoted fields with commas)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export default MultiProductBar;
