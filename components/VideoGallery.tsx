import React, { useState, useRef, useEffect } from 'react';
import { theme } from '../constants/colors';

interface VideoItem {
  key: string;
  label: string;
  videoUrl: string;
  thumbnailUrl?: string; // ảnh của scene
  scriptText?: string;
  videoPrompt?: string;
}

interface VideoGalleryProps {
  videos: VideoItem[];
  onMergeAll?: () => void;
  isMerging?: boolean;
  mergedVideoUrl?: string;
}

const VideoGallery: React.FC<VideoGalleryProps> = ({ videos, onMergeAll, isMerging, mergedVideoUrl }) => {
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Khi click play trên 1 video, pause tất cả video khác
  const handlePlay = (key: string) => {
    Object.entries(videoRefs.current).forEach(([k, ref]) => {
      if (k !== key && ref) {
        ref.pause();
      }
    });
    setPlayingKey(key);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      await handleDownload(v.videoUrl, `scene_${i + 1}_${v.key}.mp4`);
      // Delay giữa mỗi download
      if (i < videos.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };

  if (videos.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl overflow-hidden border border-violet-200/60 shadow-lg bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-violet-900/80 to-indigo-900/80 hover:from-violet-800/80 hover:to-indigo-800/80 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-white font-black text-sm tracking-wide">🎬 VIDEO GALLERY</h3>
            <p className="text-violet-300/80 text-[10px] font-bold">{videos.length} video đã tạo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-violet-500/30 rounded-full text-violet-200 text-[10px] font-black uppercase">
            {videos.length} videos
          </span>
          <svg className={`w-5 h-5 text-violet-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Tải tất cả ({videos.length})
            </button>
            {onMergeAll && (
              <button
                onClick={onMergeAll}
                disabled={isMerging}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5 ${
                  isMerging 
                    ? 'bg-slate-600 text-slate-300 cursor-wait' 
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                }`}
              >
                {isMerging ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    Đang ghép...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    Ghép thành 1 Video
                  </>
                )}
              </button>
            )}
          </div>

          {/* Merged video result */}
          {mergedVideoUrl && (
            <div className="p-3 bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl border border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-300 text-[11px] font-black uppercase">✅ Video đã ghép</span>
                <button
                  onClick={() => handleDownload(mergedVideoUrl, 'merged_video.mp4')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                >
                  ⬇️ Download
                </button>
              </div>
              <video 
                src={mergedVideoUrl} 
                controls 
                className="w-full rounded-lg max-h-[300px] bg-black"
                preload="metadata"
              />
            </div>
          )}

          {/* Video Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {videos.map((video, idx) => (
              <div 
                key={video.key}
                className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedVideo?.key === video.key
                    ? 'border-violet-400 shadow-lg shadow-violet-500/20 scale-[1.02]'
                    : 'border-slate-700/50 hover:border-violet-500/50 hover:shadow-md'
                }`}
                onClick={() => setSelectedVideo(selectedVideo?.key === video.key ? null : video)}
              >
                {/* Video Player */}
                <div className="aspect-[9/16] bg-black relative">
                  <video
                    ref={el => { videoRefs.current[video.key] = el; }}
                    src={video.videoUrl}
                    className="w-full h-full object-contain"
                    preload="metadata"
                    muted
                    loop
                    playsInline
                    onPlay={() => handlePlay(video.key)}
                    onPause={() => { if (playingKey === video.key) setPlayingKey(null); }}
                  />
                  
                  {/* Overlay play button */}
                  {playingKey !== video.key && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const ref = videoRefs.current[video.key];
                        if (ref) {
                          ref.muted = false;
                          ref.play();
                        }
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/40 transition-all group-hover:scale-110">
                        <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  )}

                  {/* Scene label */}
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-md text-white text-[9px] font-black uppercase">
                      {video.label}
                    </span>
                  </div>

                  {/* Video index badge */}
                  <div className="absolute top-2 right-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600/80 backdrop-blur-sm flex items-center justify-center text-white text-[10px] font-black">
                      {idx + 1}
                    </span>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="p-2 bg-slate-800/90 backdrop-blur-sm flex items-center justify-between">
                  <span className="text-slate-300 text-[9px] font-bold truncate flex-1">{video.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ref = videoRefs.current[video.key];
                        if (ref) {
                          if (ref.paused) {
                            ref.muted = false;
                            ref.play();
                          } else {
                            ref.pause();
                          }
                        }
                      }}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                      title={playingKey === video.key ? 'Pause' : 'Play'}
                    >
                      {playingKey === video.key ? (
                        <svg className="w-3.5 h-3.5 text-violet-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(video.videoUrl, `${video.label.replace(/\s/g, '_')}.mp4`);
                      }}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                      title="Download"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected video detail panel */}
          {selectedVideo && (
            <div className="p-4 bg-slate-800/60 rounded-xl border border-violet-500/20 backdrop-blur-sm animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Large video player */}
                <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                  <video
                    src={selectedVideo.videoUrl}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Info panel */}
                <div className="space-y-3">
                  <h4 className="text-white font-black text-lg">{selectedVideo.label}</h4>
                  {selectedVideo.scriptText && (
                    <div>
                      <p className="text-violet-300 text-[10px] font-black uppercase mb-1">📝 Kịch bản</p>
                      <p className="text-slate-300 text-xs leading-relaxed line-clamp-4">{selectedVideo.scriptText}</p>
                    </div>
                  )}
                  {selectedVideo.videoPrompt && (
                    <div>
                      <p className="text-cyan-300 text-[10px] font-black uppercase mb-1">🎥 Video Prompt</p>
                      <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3">{selectedVideo.videoPrompt}</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleDownload(selectedVideo.videoUrl, `${selectedVideo.label.replace(/\s/g, '_')}.mp4`)}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Video
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoGallery;
