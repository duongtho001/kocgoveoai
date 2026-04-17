import React, { useState } from 'react';
import Camera3D from '../components/Camera3D';
import { CameraState, AdvancedSettings } from '../types';
import { 
  AZIMUTH_STEPS, 
  ELEVATION_STEPS, 
  DISTANCE_STEPS, 
  MAX_SEED 
} from '../constants/camera360';
import { buildCameraPrompt, fileToBase64 } from '../utils/camera360';
import { editImageCamera } from '../services/camera360Service';

const Camera360Module: React.FC<{ language?: string }> = ({ language = 'vi' }) => {
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [camera, setCamera] = useState<CameraState>({
    azimuth: 0,
    elevation: 0,
    distance: 1.0
  });

  const [settings, setSettings] = useState<AdvancedSettings>({
    seed: 0,
    randomizeSeed: true,
    guidanceScale: 1.0,
    inferenceSteps: 4,
    height: 1024,
    width: 1024
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await fileToBase64(file);
      setInputImage(b64);
      
      // Auto-compute dimensions
      const img = new Image();
      img.onload = () => {
        let newWidth = 1024;
        let newHeight = 1024;
        const aspect = img.width / img.height;
        if (img.width > img.height) {
          newHeight = Math.floor(1024 / aspect / 8) * 8;
        } else {
          newWidth = Math.floor(1024 * aspect / 8) * 8;
        }
        setSettings(prev => ({ ...prev, width: newWidth, height: newHeight }));
      };
      img.src = b64;
    }
  };

  const handleGenerate = async () => {
    if (!inputImage) {
      setError(language === 'vi' ? "Vui lòng tải lên một hình ảnh trước." : "Please upload an image first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await editImageCamera(inputImage, camera, settings);
      setOutputImage(result);
    } catch (err: any) {
      setError(err.message || (language === 'vi' ? "Đã xảy ra lỗi trong quá trình tạo ảnh." : "An error occurred during image generation."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-700 bg-clip-text text-transparent">
          🎬 Camera 360
        </h1>
        <p className="text-slate-600 mt-2">
          {language === 'vi' 
            ? 'Điều khiển góc máy ảnh tương tác để chỉnh sửa phối cảnh hình ảnh chính xác.' 
            : 'Interactive camera angle control for precise image perspective editing.'}
        </p>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cột trái: Đầu vào & Điều khiển */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {language === 'vi' ? 'Ảnh đầu vào' : 'Input Image'}
            </h2>
            <div className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border-2 border-dashed border-slate-200 hover:border-emerald-500 transition-colors">
              {inputImage ? (
                <>
                  <img src={inputImage} alt="Input" className="w-full h-full object-contain" />
                  <button 
                    onClick={() => setInputImage(null)}
                    className="absolute top-2 right-2 bg-red-500/90 p-2 rounded-full hover:bg-red-600 transition-colors text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </>
              ) : (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                  <svg className="w-12 h-12 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-sm text-slate-500 font-medium">{language === 'vi' ? 'Nhấp để tải lên hoặc kéo thả' : 'Click to upload or drag and drop'}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                🎮 {language === 'vi' ? 'Điều khiển Camera 3D' : '3D Camera Controls'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 italic">
                {language === 'vi' 
                  ? '*Kéo các điểm: 🟢 Góc ngang, 🩷 Góc dọc, 🟠 Khoảng cách*' 
                  : '*Drag points: 🟢 Azimuth, 🩷 Elevation, 🟠 Distance*'}
              </p>
            </div>
            
            <Camera3D 
              value={camera} 
              onChange={setCamera} 
              imageUrl={inputImage || undefined} 
            />

            <button 
              onClick={handleGenerate}
              disabled={isLoading || !inputImage}
              className={`w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                isLoading || !inputImage 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 shadow-lg shadow-emerald-500/10 active:scale-[0.98] text-white'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {language === 'vi' ? 'Đang xử lý...' : 'Processing...'}
                </>
              ) : (
                <>🚀 {language === 'vi' ? 'Tạo ảnh' : 'Generate Image'}</>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}
          </section>

          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
              🎚️ {language === 'vi' ? 'Thanh trượt điều khiển' : 'Control Sliders'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {language === 'vi' ? 'Góc xoay ngang (Azimuth)' : 'Azimuth Angle'}: {camera.azimuth}°
                </label>
                <input 
                  type="range" 
                  min="0" max="359" step="1" 
                  value={camera.azimuth} 
                  onChange={(e) => setCamera(prev => ({ ...prev, azimuth: Number(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{language === 'vi' ? 'Trước' : 'Front'} (0°)</span>
                  <span>{language === 'vi' ? 'Phải' : 'Right'} (90°)</span>
                  <span>{language === 'vi' ? 'Sau' : 'Back'} (180°)</span>
                  <span>{language === 'vi' ? 'Trái' : 'Left'} (270°)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {language === 'vi' ? 'Góc nâng dọc (Elevation)' : 'Elevation Angle'}: {camera.elevation}°
                </label>
                <input 
                  type="range" 
                  min="0" max="180" step="1" 
                  value={camera.elevation} 
                  onChange={(e) => setCamera(prev => ({ ...prev, elevation: Number(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{language === 'vi' ? 'Dưới đất' : 'Bottom'} (0°)</span>
                  <span>{language === 'vi' ? 'Góc thấp' : 'Low'} (45°)</span>
                  <span>{language === 'vi' ? 'Ngang mắt' : 'Eye-level'} (90°)</span>
                  <span>{language === 'vi' ? 'Góc cao' : 'High'} (135°)</span>
                  <span>{language === 'vi' ? 'Đỉnh cao' : 'Overhead'} (180°)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {language === 'vi' ? 'Khoảng cách' : 'Distance'}: {camera.distance}
                </label>
                <input 
                  type="range" 
                  min="0.6" max="2.5" step="0.01" 
                  value={camera.distance} 
                  onChange={(e) => setCamera(prev => ({ ...prev, distance: Number(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{language === 'vi' ? 'Gần' : 'Close'} (0.6)</span>
                  <span>{language === 'vi' ? 'Vừa' : 'Medium'} (1.0)</span>
                  <span>{language === 'vi' ? 'Rộng' : 'Wide'} (1.8)</span>
                  <span>{language === 'vi' ? 'Rất rộng' : 'Extreme Wide'} (2.5)</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-bold">
                  {language === 'vi' ? 'Prompt được tạo' : 'Generated Prompt'}
                </label>
                <div className="p-3 bg-slate-50 rounded-lg font-mono text-xs text-emerald-700 border border-slate-200">
                  {buildCameraPrompt(camera.azimuth, camera.elevation, camera.distance)}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Cột phải: Kết quả & Nâng cao */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              {language === 'vi' ? 'Ảnh kết quả' : 'Result Image'}
            </h2>
            <div className="flex-1 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 relative">
              {outputImage ? (
                <img src={outputImage} alt="Output" className="w-full h-full object-contain" />
              ) : (
                <div className="text-slate-400 flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-sm font-medium">{language === 'vi' ? 'Ảnh kết quả sẽ hiển thị ở đây' : 'Result image will appear here'}</span>
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                   <svg className="animate-spin h-10 w-10 text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   <p className="text-emerald-700 font-bold">{language === 'vi' ? 'Đang tính toán phối cảnh mới...' : 'Calculating new perspective...'}</p>
                   <p className="text-xs text-slate-500 mt-2 font-medium">{language === 'vi' ? 'Điều chỉnh ma trận camera và dựng lại cảnh' : 'Adjusting camera matrix and re-rendering scene'}</p>
                </div>
              )}
            </div>
            {outputImage && (
              <a 
                href={outputImage} 
                download="camera-360-result.png"
                className="mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors text-center"
              >
                {language === 'vi' ? 'Tải kết quả về' : 'Download Result'}
              </a>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <details className="group">
              <summary className="p-6 cursor-pointer flex items-center justify-between list-none hover:bg-slate-50 transition-colors">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  ⚙️ {language === 'vi' ? 'Cài đặt nâng cao' : 'Advanced Settings'}
                </h2>
                <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="p-6 pt-0 space-y-6 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2 font-medium">{language === 'vi' ? 'Hạt giống (Seed)' : 'Seed'}</label>
                    <input 
                      type="number" 
                      value={settings.seed} 
                      disabled={settings.randomizeSeed}
                      onChange={(e) => setSettings(prev => ({ ...prev, seed: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 text-slate-900"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={settings.randomizeSeed} 
                        onChange={(e) => setSettings(prev => ({ ...prev, randomizeSeed: e.target.checked }))}
                        className="w-5 h-5 bg-white border-slate-300 rounded accent-emerald-500"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors font-medium">{language === 'vi' ? 'Ngẫu nhiên hóa Seed' : 'Randomize Seed'}</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2 font-medium">{language === 'vi' ? 'Chiều rộng' : 'Width'}: {settings.width}px</label>
                    <input 
                      type="range" min="256" max="2048" step="8"
                      value={settings.width} 
                      onChange={(e) => setSettings(prev => ({ ...prev, width: Number(e.target.value) }))}
                      className="w-full accent-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-2 font-medium">{language === 'vi' ? 'Chiều cao' : 'Height'}: {settings.height}px</label>
                    <input 
                      type="range" min="256" max="2048" step="8"
                      value={settings.height} 
                      onChange={(e) => setSettings(prev => ({ ...prev, height: Number(e.target.value) }))}
                      className="w-full accent-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2 font-medium">{language === 'vi' ? 'Mức độ hướng dẫn' : 'Guidance Scale'}: {settings.guidanceScale}</label>
                    <input 
                      type="range" min="1.0" max="10.0" step="0.1"
                      value={settings.guidanceScale} 
                      onChange={(e) => setSettings(prev => ({ ...prev, guidanceScale: Number(e.target.value) }))}
                      className="w-full accent-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-2 font-medium">{language === 'vi' ? 'Số bước suy luận' : 'Inference Steps'}: {settings.inferenceSteps}</label>
                    <input 
                      type="range" min="1" max="20" step="1"
                      value={settings.inferenceSteps} 
                      onChange={(e) => setSettings(prev => ({ ...prev, inferenceSteps: Number(e.target.value) }))}
                      className="w-full accent-slate-400"
                    />
                  </div>
                </div>
              </div>
            </details>
          </section>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
        <p>{language === 'vi' ? 'Xây dựng bằng React, Three.js và Google Gemini.' : 'Built with React, Three.js and Google Gemini.'}</p>
      </footer>
    </div>
  );
};

export default Camera360Module;
