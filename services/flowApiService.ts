/**
 * Flow API Service
 * Tích hợp tạo ảnh AI (T2I, R2I) và video AI (I2V, T2V, R2V)
 * Docs: https://sneer-enviable-evaluate.ngrok-free.dev/docs/integration
 */

const FLOW_API_URL = ((import.meta as any).env?.VITE_FLOW_API_URL || '').trim();
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

const getHeaders = (json: boolean = true): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (FLOW_API_KEY) headers['X-API-Key'] = FLOW_API_KEY;
  return headers;
};

/**
 * Upload ảnh lên Flow API server
 */
export const uploadImage = async (file: File): Promise<string> => {
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
};

/**
 * Upload ảnh từ base64 data URL
 */
export const uploadBase64Image = async (dataUrl: string, filename: string = 'image.png'): Promise<string> => {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  return uploadImage(file);
};

/**
 * Poll job status cho đến khi hoàn thành hoặc thất bại
 */
export const waitForJob = async (
  jobId: string,
  onProgress?: FlowProgressCallback,
  timeoutMs: number = 600000 // 10 phút
): Promise<FlowJob> => {
  const API = getApiUrl();
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Job ${jobId} timeout sau ${timeoutMs / 1000}s`);
    }

    const resp = await fetch(`${API}/api/jobs/${jobId}`, { headers: getHeaders(false) });
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
 */
export const getImageUrl = (jobId: string, index: number = 0): string => {
  const API = getApiUrl();
  return `${API}/api/jobs/${jobId}/image?index=${index}`;
};

/**
 * Lấy URL download video từ job
 */
export const getVideoUrl = (jobId: string): string => {
  const API = getApiUrl();
  return `${API}/api/jobs/${jobId}/video`;
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
  const API = getApiUrl();

  const resp = await fetch(`${API}/api/text-to-image`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      prompts,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_name: options.model_name,
      num_images: options.num_images || 1,
      upscale_quality: options.upscale_quality || '4K',
    }),
  });

  if (!resp.ok) throw new Error(`T2I failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  const imageUrls = job.images.map((_, i) => getImageUrl(job_id, i));

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
  const API = getApiUrl();

  const resp = await fetch(`${API}/api/reference-to-image`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      prompts,
      reference_images: referenceImages,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_name: options.model_name,
      upscale_quality: options.upscale_quality || '4K',
    }),
  });

  if (!resp.ok) throw new Error(`R2I failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  const imageUrls = job.images.map((_, i) => getImageUrl(job_id, i));

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
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  const API = getApiUrl();

  const resp = await fetch(`${API}/api/text-to-video`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      prompts,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_tier: options.model_tier || 'VEO_FLOW',
      video_length_seconds: options.video_length_seconds || 8,
    }),
  });

  if (!resp.ok) throw new Error(`T2V failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  return { jobId: job_id, videoUrl: getVideoUrl(job_id) };
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
  } = {},
  onProgress?: FlowProgressCallback
): Promise<{ jobId: string; videoUrl: string }> => {
  const API = getApiUrl();

  const resp = await fetch(`${API}/api/image-to-video`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      items,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_tier: options.model_tier || 'VEO_FLOW',
      video_length_seconds: options.video_length_seconds || 8,
    }),
  });

  if (!resp.ok) throw new Error(`I2V failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  return { jobId: job_id, videoUrl: getVideoUrl(job_id) };
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
  const API = getApiUrl();

  const resp = await fetch(`${API}/api/multi-ref-video`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      items,
      aspect_ratio: options.aspect_ratio || '9:16',
      model_tier: options.model_tier || 'VEO_FLOW',
    }),
  });

  if (!resp.ok) throw new Error(`R2V failed: ${resp.status}`);
  const { job_id } = await resp.json();

  const job = await waitForJob(job_id, onProgress);
  return { jobId: job_id, videoUrl: getVideoUrl(job_id) };
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
  onProgress?: FlowProgressCallback
): Promise<string> => {
  const path = await uploadBase64Image(dataUrl);
  const result = await imageToVideo(
    [{ image_path: path, prompt }],
    { aspect_ratio: aspectRatio },
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
  const API = getApiUrl();
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch(`${API}/api/upload-image`, {
    method: 'POST',
    headers: getHeaders(false),
    body: fd
  });
  if (!resp.ok) throw new Error(`Upload video failed: ${resp.status}`);
  const data = await resp.json();
  return data.path;
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
  const API = getApiUrl();

  if (videoPaths.length < 2) {
    throw new Error('Cần ít nhất 2 video để nối');
  }

  const resp = await fetch(`${API}/api/merge-videos`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      video_paths: videoPaths,
      output_name: outputName,
    }),
  });

  if (!resp.ok) throw new Error(`Merge failed: ${resp.status}`);
  const data = await resp.json();

  // If it returns a job_id, wait for it
  if (data.job_id) {
    const job = await waitForJob(data.job_id, onProgress);
    return { jobId: data.job_id, videoUrl: getVideoUrl(data.job_id) };
  }

  // If it returns directly (synchronous merge)
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
