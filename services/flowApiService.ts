/**
 * Flow API Service
 * Tích hợp tạo ảnh AI (T2I, R2I) và video AI (I2V, T2V, R2V)
 * Docs: https://sneer-enviable-evaluate.ngrok-free.dev/docs/integration
 */

const FLOW_API_URL = ((import.meta as any).env?.VITE_FLOW_API_URL || '').trim().replace(/\/+$/, '');
const FLOW_API_KEY = ((import.meta as any).env?.VITE_FLOW_API_KEY || '').trim();

// ============================================================
// Types
// ============================================================

export interface FlowJob {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  type: string;
  videos: string[];
  images: string[];
  logs: string[];
  error: string | null;
}

export interface FlowProgressCallback {
  (job: FlowJob): void;
}

// ============================================================
// Helpers
// ============================================================

const getApiUrl = (): string => {
  if (!FLOW_API_URL) {
    throw new Error('VITE_FLOW_API_URL chưa được cấu hình trong .env');
  }
  return FLOW_API_URL;
};

/**
 * Detect if we're running on Vercel (production) and need proxy
 */
const isProduction = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
};

/**
 * Universal fetch wrapper: uses proxy on production, direct on localhost
 */
const flowFetch = async (path: string, options: { method?: string; body?: any; json?: boolean } = {}): Promise<Response> => {
  const { method = 'GET', body, json = true } = options;
  
  if (isProduction()) {
    // Route through Vercel proxy to bypass CORS
    const proxyBody: any = { method, path };
    if (body) proxyBody.body = body;
    
    const resp = await fetch('/api/flow-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody),
    });
    return resp;
  } else {
    // Direct fetch on localhost
    const API = getApiUrl();
    const headers: Record<string, string> = {};
    if (json && body) headers['Content-Type'] = 'application/json';
    if (FLOW_API_KEY) headers['X-API-Key'] = FLOW_API_KEY;
    
    const fetchOptions: RequestInit = { method, headers };
    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    return fetch(`${API}${path}`, fetchOptions);
  }
};

const getHeaders = (json: boolean = true): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (FLOW_API_KEY) headers['X-API-Key'] = FLOW_API_KEY;
  return headers;
};

/**
 * Compress image to fit within Vercel's 4.5MB body limit
 * Resizes to max 1920px and converts to JPEG at 85% quality
 */
const compressImageForUpload = async (dataUrl: string, maxSize: number = 1920): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      // Only resize if larger than maxSize
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try JPEG first (much smaller), fallback to PNG
      let compressed = canvas.toDataURL('image/jpeg', 0.85);
      
      // If still too large (>3MB base64 ≈ 2.25MB binary), reduce quality further
      if (compressed.length > 3_000_000) {
        compressed = canvas.toDataURL('image/jpeg', 0.65);
      }
      if (compressed.length > 3_000_000) {
        compressed = canvas.toDataURL('image/jpeg', 0.45);
      }
      
      console.log(`[compress] ${img.naturalWidth}x${img.naturalHeight} → ${width}x${height}, ${(compressed.length / 1024).toFixed(0)}KB`);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl); // Fallback to original on error
    img.src = dataUrl;
  });
};

/**
 * Convert File to dataUrl for compression
 */
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Upload ảnh lên Flow API server
 */
export const uploadImage = async (file: File): Promise<string> => {
  if (isProduction()) {
    // Convert file to base64, compress, then send through proxy
    const dataUrl = await fileToDataUrl(file);
    const compressedDataUrl = await compressImageForUpload(dataUrl);
    const resp = await fetch('/api/flow-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'POST',
        path: '/api/upload-image',
        body: { dataUrl: compressedDataUrl, filename: file.name },
        isFormData: true
      }),
    });
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    const data = await resp.json();
    return data.path;
  } else {
    const API = getApiUrl();
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${API}/api/upload-image`, {
      method: 'POST',
      headers: getHeaders(false),
      body: fd
    });
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    const data = await resp.json();
    return data.path;
  }
};

/**
 * Upload ảnh từ base64 data URL
 */
export const uploadBase64Image = async (dataUrl: string, filename: string = 'image.png'): Promise<string> => {
  if (isProduction()) {
    // Compress before sending through proxy (Vercel 4.5MB body limit)
    const compressed = await compressImageForUpload(dataUrl);
    const resp = await fetch('/api/flow-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'POST',
        path: '/api/upload-image',
        body: { dataUrl: compressed, filename },
        isFormData: true
      }),
    });
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    const data = await resp.json();
    return data.path;
  } else {
    const blob = await fetch(dataUrl).then(r => r.blob());
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    return uploadImage(file);
  }
};

/**
 * Poll job status cho đến khi hoàn thành hoặc thất bại
 */
export const waitForJob = async (
  jobId: string,
  onProgress?: FlowProgressCallback,
  timeoutMs: number = 600000 // 10 phút
): Promise<FlowJob> => {
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Job ${jobId} timeout sau ${timeoutMs / 1000}s`);
    }

    const resp = await flowFetch(`/api/jobs/${jobId}`);
    if (!resp.ok) throw new Error(`Poll failed: ${resp.status}`);
    const job: FlowJob = await resp.json();

    if (onProgress) onProgress(job);

    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(job.error || 'Job failed');

    // Wait 3s before next poll
    await new Promise(r => setTimeout(r, 3000));
  }
};

/**
 * Lấy URL download ảnh từ job
 * On production: fetches via proxy and returns blob URL
 * On localhost: returns direct API URL
 */
export const getImageUrl = (jobId: string, index: number = 0): string => {
  if (isProduction()) {
    // On production, we can't use direct URLs — return a placeholder,
    // caller should use fetchImageBlob instead
    return `__proxy__image__${jobId}__${index}`;
  }
  const API = getApiUrl();
  return `${API}/api/jobs/${jobId}/image?index=${index}`;
};

/**
 * Lấy URL download video từ job
 */
export const getVideoUrl = (jobId: string): string => {
  if (isProduction()) {
    return `__proxy__video__${jobId}`;
  }
  const API = getApiUrl();
  return `${API}/api/jobs/${jobId}/video`;
};

/**
 * Fetch binary content (image/video) via proxy and return blob URL
 */
export const fetchBlobUrl = async (jobId: string, type: 'image' | 'video', index: number = 0): Promise<string> => {
  const path = type === 'image' ? `/api/jobs/${jobId}/image?index=${index}` : `/api/jobs/${jobId}/video`;
  
  if (isProduction()) {
    const resp = await fetch('/api/flow-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'GET', path }),
    });
    if (!resp.ok) throw new Error(`Fetch ${type} failed: ${resp.status}`);
    const data = await resp.json();
    if (data.data && data.mimeType) {
      // Convert base64 to blob URL
      const binary = atob(data.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType });
      return URL.createObjectURL(blob);
    }
    throw new Error(`Invalid proxy response for ${type}`);
  } else {
    const API = getApiUrl();
    const resp = await fetch(`${API}${path}`);
    if (!resp.ok) throw new Error(`Fetch ${type} failed: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }
};

// ============================================================
// Text to Image (T2I)
// ============================================================

export const textToImage = async (
  prompts: string[],
  options: {
    aspect_ratio?: string;
    model_name?: string;
    num_images?: number;
    upscale_quality?: string;
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; imageUrls: string[] }> => {
  const resp = await flowFetch('/api/text-to-image', {
    method: 'POST',
    body: {
      prompts,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_name: options.model_name,
      num_images: options.num_images || 1,
      ...(options.upscale_quality ? { upscale_quality: options.upscale_quality } : {}),
    },
  });

  if (!resp.ok) throw new Error(`T2I failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  
  // On production, fetch blob URLs via proxy; on localhost, use direct URLs
  const imageUrls = isProduction()
    ? await Promise.all(job.images.map((_, i) => fetchBlobUrl(job_id, 'image', i)))
    : job.images.map((_, i) => getImageUrl(job_id, i));

  return { jobId: job_id, imageUrls };
};

// ============================================================
// Reference to Image (R2I)
// ============================================================

export const referenceToImage = async (
  prompts: string[],
  referenceImages: string[], // paths from uploadImage
  options: {
    aspect_ratio?: string;
    model_name?: string;
    upscale_quality?: string;
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; imageUrls: string[] }> => {
  const resp = await flowFetch('/api/reference-to-image', {
    method: 'POST',
    body: {
      prompts,
      reference_images: referenceImages,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_name: options.model_name,
      ...(options.upscale_quality ? { upscale_quality: options.upscale_quality } : {}),
    },
  });

  if (!resp.ok) throw new Error(`R2I failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  
  const imageUrls = isProduction()
    ? await Promise.all(job.images.map((_, i) => fetchBlobUrl(job_id, 'image', i)))
    : job.images.map((_, i) => getImageUrl(job_id, i));

  return { jobId: job_id, imageUrls };
};

// ============================================================
// Text to Video (T2V)
// ============================================================

export const textToVideo = async (
  prompts: string[],
  options: {
    aspect_ratio?: string;
    model_tier?: string;
    video_length_seconds?: number;
    voice?: string;
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  const body: any = {
    prompts,
    aspect_ratio: options.aspect_ratio || '9:16',
    model_tier: options.model_tier || 'VEO_FLOW',
    video_length_seconds: options.video_length_seconds || 8,
  };
  if (options.voice) body.voice = options.voice;

  const resp = await flowFetch('/api/text-to-video', {
    method: 'POST',
    body,
  });

  if (!resp.ok) throw new Error(`T2V failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  const videoUrl = isProduction() ? await fetchBlobUrl(job_id, 'video') : getVideoUrl(job_id);
  return { jobId: job_id, videoUrl };
};

// ============================================================
// Image to Video (I2V)
// ============================================================

export const imageToVideo = async (
  items: { image_path: string; prompt: string }[],
  options: {
    aspect_ratio?: string;
    model_tier?: string;
    video_length_seconds?: number;
    voice?: string;
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  const body: any = {
    items,
    aspect_ratio: options.aspect_ratio || '9:16',
    model_tier: options.model_tier || 'VEO_FLOW',
    video_length_seconds: options.video_length_seconds || 8,
  };
  if (options.voice) body.voice = options.voice;

  const resp = await flowFetch('/api/image-to-video', {
    method: 'POST',
    body,
  });

  if (!resp.ok) throw new Error(`I2V failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  const videoUrl = isProduction() ? await fetchBlobUrl(job_id, 'video') : getVideoUrl(job_id);
  return { jobId: job_id, videoUrl };
};

// ============================================================
// Multi-Reference Video (R2V)
// ============================================================

export const multiRefVideo = async (
  items: { image_paths: string[]; prompt: string }[],
  options: {
    aspect_ratio?: string;
    model_tier?: string;
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  const resp = await flowFetch('/api/multi-ref-video', {
    method: 'POST',
    body: {
      items,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_tier: options.model_tier || 'VEO_FLOW',
    },
  });

  if (!resp.ok) throw new Error(`R2V failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  const videoUrl = isProduction() ? await fetchBlobUrl(job_id, 'video') : getVideoUrl(job_id);
  return { jobId: job_id, videoUrl };
};

// ============================================================
// Pipeline Helpers (end-to-end)
// ============================================================

/**
 * Pipeline: Prompt → Ảnh 4K
 */
export const generateFlowImage = async (
  prompt: string,
  aspectRatio: string = '9:16',
  onProgress?: FlowProgressCallback
): Promise<string> => {
  const result = await textToImage([prompt], {
    aspect_ratio: aspectRatio,
    upscale_quality: '4K'
  }, onProgress);
  return result.imageUrls[0];
};

/**
 * Pipeline: File → Upload → Video
 */
export const fileToVideo = async (
  file: File,
  prompt: string,
  aspectRatio: string = '9:16',
  onProgress?: FlowProgressCallback
): Promise<string> => {
  const path = await uploadImage(file);
  const result = await imageToVideo(
    [{ image_path: path, prompt }],
    { aspect_ratio: aspectRatio },
    onProgress
  );
  return result.videoUrl;
};

/**
 * Pipeline: Base64 Image → Upload → Video
 */
export const base64ImageToVideo = async (
  dataUrl: string,
  prompt: string,
  aspectRatio: string = '9:16',
  onProgress?: FlowProgressCallback,
  voice?: string
): Promise<string> => {
  const path = await uploadBase64Image(dataUrl);
  const result = await imageToVideo(
    [{ image_path: path, prompt }],
    { aspect_ratio: aspectRatio, voice },
    onProgress
  );
  return result.videoUrl;
};

/**
 * Pipeline: Prompt → Ảnh → Video (end-to-end)
 */
export const promptToVideo = async (
  imagePrompt: string,
  videoPrompt: string,
  aspectRatio: string = '9:16',
  onProgress?: FlowProgressCallback
): Promise<{ imageUrl: string; videoUrl: string }> => {
  // Step 1: Generate image
  const imgResult = await textToImage([imagePrompt], {
    aspect_ratio: aspectRatio,
    upscale_quality: '4K'
  }, onProgress);

  // Step 2: Download image and upload for video
  const imgResp = await fetch(imgResult.imageUrls[0]);
  const blob = await imgResp.blob();
  const file = new File([blob], 'generated.png', { type: 'image/png' });
  const path = await uploadImage(file);

  // Step 3: Create video from image
  const vidResult = await imageToVideo(
    [{ image_path: path, prompt: videoPrompt }],
    { aspect_ratio: aspectRatio },
    onProgress
  );

  return {
    imageUrl: imgResult.imageUrls[0],
    videoUrl: vidResult.videoUrl
  };
};

// ============================================================
// Merge Videos (nối nhiều video thành 1)
// ============================================================

/**
 * Upload video lên Flow API server để lấy path cho merge
 */
export const uploadVideo = async (file: File): Promise<string> => {
  // Reuse uploadImage — same endpoint, works with proxy on production
  return uploadImage(file);
};

/**
 * Nối (merge) nhiều video thành 1 video duy nhất
 * @param videoPaths - Danh sách đường dẫn video trên server (≥2)
 * @param outputName - Tên file output (không cần .mp4)
 */
export const mergeVideos = async (
  videoPaths: string[],
  outputName: string = 'merged_video',
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  if (videoPaths.length < 2) {
    throw new Error('Cần ít nhất 2 video để nối');
  }

  const resp = await flowFetch('/api/merge-videos', {
    method: 'POST',
    body: {
      video_paths: videoPaths,
      output_name: outputName,
    },
  });

  if (!resp.ok) throw new Error(`Merge failed: ${resp.status}`);
  const data = await resp.json();

  // If it returns a job_id, wait for it
  if (data.job_id) {
    const job = await waitForJob(data.job_id, onProgress);
    const videoUrl = isProduction() ? await fetchBlobUrl(data.job_id, 'video') : getVideoUrl(data.job_id);
    return { jobId: data.job_id, videoUrl };
  }

  // If it returns directly (synchronous merge)
  const API = getApiUrl();
  return {
    jobId: data.job_id || 'direct',
    videoUrl: data.output_path ? `${API}/api/storage/video?path=${encodeURIComponent(data.output_path)}` : data.url || ''
  };
};

/**
 * Download video từ URL và upload lên Flow server
 * (Dùng khi video ở dạng URL cần convert sang server path)
 */
export const videoUrlToPath = async (videoUrl: string): Promise<string> => {
  // Nếu đã là server path (bắt đầu bằng /api/ hoặc output/)
  if (videoUrl.startsWith('/api/') || videoUrl.startsWith('output/') || videoUrl.includes('/api/jobs/')) {
    // Extract path nếu là full URL
    const url = new URL(videoUrl, getApiUrl());
    // For job video URLs, we need the actual file path
    if (url.pathname.includes('/api/jobs/') && url.pathname.includes('/video')) {
      // Download video and re-upload to get a file path
      const resp = await fetch(videoUrl);
      const blob = await resp.blob();
      const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
      return uploadVideo(file);
    }
    return url.pathname;
  }

  // Download and upload
  const resp = await fetch(videoUrl);
  const blob = await resp.blob();
  const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
  return uploadVideo(file);
};

/**
 * Check if Flow API is configured and available
 */
export const isFlowApiAvailable = (): boolean => {
  return !!FLOW_API_URL;
};

/**
 * Convenience helper: Generate a single image from a text prompt.
 * Used by all services as replacement for Gemini image generation.
 * Always returns 9:16 aspect ratio.
 */
export const generateImage = async (prompt: string, aspectRatio: string = '9:16'): Promise<string> => {
  const result = await textToImage([prompt], { aspect_ratio: aspectRatio });
  if (result.imageUrls && result.imageUrls.length > 0) {
    return result.imageUrls[0];
  }
  throw new Error('Flow API T2I: không tạo được ảnh');
};
