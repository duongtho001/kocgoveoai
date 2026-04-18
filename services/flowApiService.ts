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
 * Query server để biết số profiles (accounts) và cấu hình concurrency.
 * Dùng cho batch image/video generation — biết cần split bao nhiêu requests.
 */
export const getFlowServerConcurrency = async (): Promise<{
  accounts: { profile: string; max_slots: number; running: number; available: boolean }[];
  max_workers: number;
}> => {
  const resp = await flowFetch('/api/health');
  if (!resp.ok) throw new Error(`Health check failed: ${resp.status}`);
  const data = await resp.json();
  return {
    accounts: data.accounts || [],
    max_workers: data.max_workers || 1,
  };
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
 * For video: retries up to 3 times with delay (video file may not be ready immediately)
 */
export const fetchBlobUrl = async (jobId: string, type: 'image' | 'video', index: number = 0): Promise<string> => {
  const path = type === 'image' ? `/api/jobs/${jobId}/image?index=${index}` : `/api/jobs/${jobId}/video`;
  const API = getApiUrl();
  const directUrl = `${API}${path}`;
  const maxRetries = type === 'video' ? 3 : 1;
  const retryDelay = 3000; // 3 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try direct fetch from Flow API server (works when CORS is enabled / Cloudflare tunnel)
      const resp = await fetch(directUrl);
      if (!resp.ok) {
        if (resp.status === 404 && attempt < maxRetries) {
          console.warn(`[fetchBlobUrl] ${type} not ready (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay/1000}s...`);
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }
        throw new Error(`Direct fetch failed: ${resp.status}`);
      }
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch (directErr: any) {
      // If it's a retry-able 404 and we haven't exhausted attempts, the continue above handles it
      // For other errors or last attempt, try proxy
      if (attempt < maxRetries && directErr.message?.includes('404')) {
        console.warn(`[fetchBlobUrl] Retry ${attempt}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }
      
      console.warn(`[fetchBlobUrl] Direct fetch failed, trying proxy...`, directErr);
      try {
        // Fallback: proxy through Vercel (may hit size limits for large files)
        const resp = await fetch('/api/flow-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'GET', path }),
        });
        if (!resp.ok) {
          if (resp.status === 404 && attempt < maxRetries) {
            console.warn(`[fetchBlobUrl] Proxy also 404 (attempt ${attempt}/${maxRetries}), retrying...`);
            await new Promise(r => setTimeout(r, retryDelay));
            continue;
          }
          throw new Error(`Fetch ${type} failed: ${resp.status}`);
        }
        const data = await resp.json();
        if (data.data && data.mimeType) {
          const binary = atob(data.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: data.mimeType });
          return URL.createObjectURL(blob);
        }
        throw new Error(`Invalid proxy response for ${type}`);
      } catch (proxyErr: any) {
        if (attempt < maxRetries && proxyErr.message?.includes('404')) {
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }
        throw proxyErr;
      }
    }
  }
  throw new Error(`Failed to fetch ${type} after ${maxRetries} attempts`);
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
    max_concurrency?: number;
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
      max_concurrency: options.max_concurrency || 2,
      ...(options.upscale_quality ? { upscale_quality: options.upscale_quality } : {}),
    },
  });

  if (!resp.ok) throw new Error(`T2I failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  
  // On production, fetch blob URLs via proxy; on localhost, use direct URLs
  const images = job.images || [];
  if (images.length === 0) {
    console.warn(`[T2I] Job ${job_id} completed but no images returned`);
    return { jobId: job_id, imageUrls: [] };
  }
  const imageUrls = isProduction()
    ? await Promise.all(images.map((_, i) => fetchBlobUrl(job_id, 'image', i)))
    : images.map((_, i) => getImageUrl(job_id, i));

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
    max_concurrency?: number;
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
      max_concurrency: options.max_concurrency || 2,
      ...(options.upscale_quality ? { upscale_quality: options.upscale_quality } : {}),
    },
  });

  if (!resp.ok) throw new Error(`R2I failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  
  const images = job.images || [];
  if (images.length === 0) {
    console.warn(`[R2I] Job ${job_id} completed but no images returned`);
    return { jobId: job_id, imageUrls: [] };
  }
  const imageUrls = isProduction()
    ? await Promise.all(images.map((_, i) => fetchBlobUrl(job_id, 'image', i)))
    : images.map((_, i) => getImageUrl(job_id, i));

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
    max_concurrency: options.max_concurrency || 2,
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
    max_concurrency: options.max_concurrency || 2,
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
    video_length_seconds?: number;
    voice?: string;
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  const body: any = {
    items,
    aspect_ratio: options.aspect_ratio || '9:16',
    model_tier: options.model_tier || 'VEO_FLOW',
    video_length_seconds: options.video_length_seconds || 10,
    max_concurrency: options.max_concurrency || 2,
  };
  if (options.voice) body.voice = options.voice;

  const resp = await flowFetch('/api/multi-ref-video', {
    method: 'POST',
    body,
  });

  if (!resp.ok) throw new Error(`R2V failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  const videoUrl = isProduction() ? await fetchBlobUrl(job_id, 'video') : getVideoUrl(job_id);
  return { jobId: job_id, videoUrl };
};

// ============================================================
// Extend Video (mở rộng video tuần tự)
// ============================================================

export const extendVideo = async (
  mode: 't2v' | 'i2v' | 'r2v',
  prompts: string[],
  options: {
    aspect_ratio?: string;
    model_tier?: string;
    auto_merge?: boolean;
    image_path?: string;      // I2V mode
    image_paths?: string[];   // R2V mode
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  const body: any = {
    mode,
    prompts,
    aspect_ratio: options.aspect_ratio || '9:16',
    model_tier: options.model_tier || 'VEO_FLOW',
    auto_merge: options.auto_merge ?? true,
  };
  if (mode === 'i2v' && options.image_path) body.image_path = options.image_path;
  if (mode === 'r2v' && options.image_paths) body.image_paths = options.image_paths;

  const resp = await flowFetch('/api/extend-video', {
    method: 'POST',
    body,
  });

  if (!resp.ok) throw new Error(`Extend failed: ${resp.status}`);
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
// Smart Video Generator (auto-route ITV / RTV)
// ============================================================

/**
 * Tạo video thông minh từ ảnh base64:
 * - Có voice → R2V (Reference-to-Video với giọng nói)
 * - Không voice → I2V (Image-to-Video thông thường)
 *
 * @param imageDataUrl - Base64 data URL của ảnh
 * @param prompt - Video prompt
 * @param options - aspect_ratio, model_tier, video_length_seconds, voice
 * @param onProgress - Callback theo dõi tiến trình
 * @returns videoUrl
 */
export const generateVideoFromImage = async (
  imageDataUrl: string,
  prompt: string,
  options: {
    aspect_ratio?: string;
    model_tier?: string;
    video_length_seconds?: number;
    voice?: string;
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ videoUrl: string; jobId: string }> => {
  // Upload ảnh lên server
  const imagePath = await uploadBase64Image(imageDataUrl);

  if (options.voice) {
    // ── R2V: Reference-to-Video (hỗ trợ voice + ảnh tham chiếu) ──
    console.log(`[generateVideo] R2V mode — voice: ${options.voice}`);
    try {
      const result = await multiRefVideo(
        [{ image_paths: [imagePath], prompt }],
        {
          aspect_ratio: options.aspect_ratio || '9:16',
          model_tier: options.model_tier || 'VEO_FLOW',
          video_length_seconds: options.video_length_seconds || 10,
          voice: options.voice,
        },
        onProgress
      );
      return { videoUrl: result.videoUrl, jobId: result.jobId };
    } catch (r2vErr: any) {
      // R2V+voice failed (Google 500) → fallback to I2V without voice
      console.warn(`[generateVideo] R2V+voice failed: ${r2vErr.message}. Falling back to I2V (no voice)...`);
      const fallback = await imageToVideo(
        [{ image_path: imagePath, prompt }],
        {
          aspect_ratio: options.aspect_ratio || '9:16',
          model_tier: options.model_tier || 'VEO_FLOW',
          video_length_seconds: options.video_length_seconds || 8,
        },
        onProgress
      );
      return { videoUrl: fallback.videoUrl, jobId: fallback.jobId };
    }
  } else {
    // ── I2V: Image-to-Video (không voice) ──
    console.log('[generateVideo] I2V mode — no voice');
    const result = await imageToVideo(
      [{ image_path: imagePath, prompt }],
      {
        aspect_ratio: options.aspect_ratio || '9:16',
        model_tier: options.model_tier || 'VEO_FLOW',
        video_length_seconds: options.video_length_seconds || 8,
      },
      onProgress
    );
    return { videoUrl: result.videoUrl, jobId: result.jobId };
  }
};

// ============================================================
// Video Path Resolution (for merge)
// ============================================================

/**
 * Get the video file path on the server from a job_id.
 * This queries the job status to get the actual file path, avoiding re-upload.
 */
export const getVideoPathFromJob = async (jobId: string): Promise<string | null> => {
  try {
    const resp = await flowFetch(`/api/jobs/${jobId}`);
    if (!resp.ok) {
      console.warn(`[getVideoPathFromJob] Job ${jobId} not found: ${resp.status}`);
      return null;
    }
    const job = await resp.json();
    const videos = job.videos || [];
    if (videos.length > 0) {
      return videos[0]; // Return the first video path
    }
    console.warn(`[getVideoPathFromJob] Job ${jobId} has no video files`);
    return null;
  } catch (e) {
    console.error(`[getVideoPathFromJob] Error:`, e);
    return null;
  }
};

// ============================================================
// Merge Videos (nối nhiều video thành 1)
// ============================================================

/**
 * Upload video lên Flow API server để lấy path cho merge
 */
export const uploadVideo = async (file: File): Promise<string> => {
  const API = getApiUrl();
  if (!API) throw new Error('Flow API URL not configured');
  
  try {
    // Try direct upload to Flow API server (works when CORS is enabled)
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${API}/api/upload-video`, {
      method: 'POST',
      headers: getHeaders(false),
      body: fd
    });
    if (!resp.ok) throw new Error(`Direct upload failed: ${resp.status}`);
    const data = await resp.json();
    return data.path;
  } catch (directErr) {
    console.warn('[uploadVideo] Direct upload failed, trying base64 proxy...', directErr);
    // Fallback: convert to base64 and send through proxy
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    const resp = await fetch('/api/flow-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'POST',
        path: '/api/upload-video',
        body: { data: base64, filename: file.name, mimeType: 'video/mp4' },
      }),
    });
    if (!resp.ok) throw new Error(`Proxy upload failed: ${resp.status}`);
    const data = await resp.json();
    return data.path;
  }
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
  console.log('[mergeVideos] Server response:', JSON.stringify(data).substring(0, 200));

  // If it returns a job_id, wait for it
  if (data.job_id) {
    const job = await waitForJob(data.job_id, onProgress);
    const videoUrl = isProduction() ? await fetchBlobUrl(data.job_id, 'video') : getVideoUrl(data.job_id);
    return { jobId: data.job_id, videoUrl };
  }

  // Synchronous merge: server returns { merged_path, stream_url, ... }
  const API = getApiUrl();
  const mergedPath = data.merged_path || data.output_path || '';
  const streamUrl = data.stream_url || '';

  let videoUrl = '';
  if (streamUrl) {
    // Use stream_url from server
    videoUrl = streamUrl.startsWith('http') ? streamUrl : `${API}${streamUrl}`;
  } else if (mergedPath) {
    videoUrl = `${API}/api/storage/video?path=${encodeURIComponent(mergedPath)}`;
  }

  // On production, fetch the video through proxy to get a blob URL
  if (isProduction() && videoUrl) {
    try {
      const proxyResp = await fetch('/api/flow-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'GET', path: streamUrl || `/api/storage/video?path=${encodeURIComponent(mergedPath)}` }),
      });
      if (proxyResp.ok) {
        const proxyData = await proxyResp.json();
        if (proxyData.data && proxyData.mimeType) {
          const binary = atob(proxyData.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: proxyData.mimeType });
          videoUrl = URL.createObjectURL(blob);
        }
      }
    } catch (e) {
      console.warn('[mergeVideos] Proxy fetch failed, using direct URL:', e);
    }
  }

  return {
    jobId: 'direct',
    videoUrl
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
    // For job video URLs like /api/jobs/{id}/video → extract job_id and use video path
    if (url.pathname.includes('/api/jobs/') && url.pathname.includes('/video')) {
      const match = url.pathname.match(/\/api\/jobs\/([^/]+)\/video/);
      if (match) {
        // Return the job's video path directly — server knows where it is
        return `job_video:${match[1]}`;
      }
    }
    return url.pathname;
  }

  // For blob URLs or remote URLs: fetch → upload to server
  try {
    const resp = await fetch(videoUrl);
    if (!resp.ok) throw new Error(`Fetch video failed: ${resp.status}`);
    const blob = await resp.blob();
    const file = new File([blob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
    return uploadVideo(file);
  } catch (e: any) {
    console.error('[videoUrlToPath] Failed:', e);
    throw new Error(`Upload failed: ${e.message}`);
  }
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

// ============================================================
// Server Concurrency Management
// ============================================================

export interface FlowServerConcurrency {
  default_video_concurrency: number;
  default_image_concurrency: number;
  public_video_concurrency: number;
  public_image_concurrency: number;
  accounts: { profile: string; max_slots: number; running: number; available: boolean }[];
}

/**
 * Get server-side concurrency settings from Flow API
 */
export const getFlowConcurrencySettings = async (): Promise<FlowServerConcurrency | null> => {
  try {
    const resp = await flowFetch('/admin/api/concurrency');
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
};

/**
 * Update server-side concurrency settings on Flow API
 */
export const updateFlowServerConcurrency = async (settings: {
  default_video_concurrency?: number;
  default_image_concurrency?: number;
  public_video_concurrency?: number;
  public_image_concurrency?: number;
  account_slots?: { profile: string; max_slots: number }[];
}): Promise<FlowServerConcurrency | null> => {
  try {
    const resp = await flowFetch('/admin/api/concurrency', {
      method: 'PUT',
      body: settings,
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
};
