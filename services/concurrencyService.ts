/**
 * Concurrency Service - Quản lý số luồng chạy song song khi tạo ảnh/video.
 * 
 * Sử dụng Semaphore pattern để giới hạn số task chạy đồng thời,
 * tránh rate-limit từ Gemini API và tối ưu hiệu suất.
 */

// ═══════════════════ Default Settings ═══════════════════

const STORAGE_KEY = 'koc_goveoai_concurrency';

export interface ConcurrencySettings {
  /** Số ảnh tạo song song (1-5, mặc định 2) */
  imageConcurrency: number;
  /** Số video prompt tạo song song (1-5, mặc định 2) */
  videoConcurrency: number;
  /** Số image prompt (text) tạo song song (1-10, mặc định 3) */
  imagePromptConcurrency: number;
  /** Số video prompt (text) tạo song song (1-10, mặc định 3) */
  videoPromptConcurrency: number;
}

const DEFAULT_SETTINGS: ConcurrencySettings = {
  imageConcurrency: 2,
  videoConcurrency: 2,
  imagePromptConcurrency: 3,
  videoPromptConcurrency: 3,
};

// ═══════════════════ Settings Persistence ═══════════════════

/**
 * Lấy cài đặt concurrency từ localStorage.
 */
export const getConcurrencySettings = (): ConcurrencySettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        imageConcurrency: clamp(parsed.imageConcurrency ?? DEFAULT_SETTINGS.imageConcurrency, 1, 5),
        videoConcurrency: clamp(parsed.videoConcurrency ?? DEFAULT_SETTINGS.videoConcurrency, 1, 5),
        imagePromptConcurrency: clamp(parsed.imagePromptConcurrency ?? DEFAULT_SETTINGS.imagePromptConcurrency, 1, 10),
        videoPromptConcurrency: clamp(parsed.videoPromptConcurrency ?? DEFAULT_SETTINGS.videoPromptConcurrency, 1, 10),
      };
    }
  } catch (e) {
    console.warn('Failed to load concurrency settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
};

/**
 * Lưu cài đặt concurrency vào localStorage.
 */
export const saveConcurrencySettings = (settings: Partial<ConcurrencySettings>): ConcurrencySettings => {
  const current = getConcurrencySettings();
  const updated: ConcurrencySettings = {
    imageConcurrency: clamp(settings.imageConcurrency ?? current.imageConcurrency, 1, 5),
    videoConcurrency: clamp(settings.videoConcurrency ?? current.videoConcurrency, 1, 5),
    imagePromptConcurrency: clamp(settings.imagePromptConcurrency ?? current.imagePromptConcurrency, 1, 10),
    videoPromptConcurrency: clamp(settings.videoPromptConcurrency ?? current.videoPromptConcurrency, 1, 10),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

// ═══════════════════ Semaphore (Core) ═══════════════════

/**
 * Semaphore class: Giới hạn số task chạy đồng thời.
 * 
 * Ví dụ:
 *   const sem = new Semaphore(3); // tối đa 3 task cùng lúc
 *   await sem.acquire();
 *   try { await doWork(); } finally { sem.release(); }
 */
export class Semaphore {
  private running = 0;
  private queue: (() => void)[] = [];

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }

  get active(): number {
    return this.running;
  }

  get pending(): number {
    return this.queue.length;
  }
}

// ═══════════════════ Batch Runner ═══════════════════

export interface BatchResult<T> {
  key: string;
  result?: T;
  error?: Error;
}

/**
 * Chạy batch tasks với concurrency control.
 * 
 * @param tasks - Danh sách task {key, fn}
 * @param maxConcurrency - Số task chạy đồng thời
 * @param onProgress - Callback sau mỗi task hoàn thành (completed, total)
 * @returns Kết quả của tất cả tasks
 * 
 * Ví dụ:
 *   const results = await runBatch(
 *     keys.map(k => ({ key: k, fn: () => generateImage(k) })),
 *     getConcurrencySettings().imageConcurrency,
 *     (done, total) => console.log(`${done}/${total}`)
 *   );
 */
export const runBatch = async <T>(
  tasks: { key: string; fn: () => Promise<T> }[],
  maxConcurrency: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchResult<T>[]> => {
  const semaphore = new Semaphore(maxConcurrency);
  const total = tasks.length;
  let completed = 0;
  const results: BatchResult<T>[] = [];

  const runTask = async (task: { key: string; fn: () => Promise<T> }) => {
    await semaphore.acquire();
    try {
      const result = await task.fn();
      results.push({ key: task.key, result });
    } catch (error) {
      results.push({ key: task.key, error: error as Error });
    } finally {
      semaphore.release();
      completed++;
      onProgress?.(completed, total);
    }
  };

  // Khởi chạy tất cả tasks cùng lúc — semaphore sẽ tự giới hạn
  await Promise.all(tasks.map(runTask));
  return results;
};

/**
 * Chạy batch tasks tuần tự với concurrency control (giống runBatch nhưng có delay giữa các batch).
 * Hữu ích khi cần UI update mượt hơn.
 */
export const runBatchWithDelay = async <T>(
  tasks: { key: string; fn: () => Promise<T> }[],
  maxConcurrency: number,
  delayMs: number = 200,
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchResult<T>[]> => {
  const results: BatchResult<T>[] = [];
  const total = tasks.length;

  for (let i = 0; i < total; i += maxConcurrency) {
    const batch = tasks.slice(i, i + maxConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (task) => {
        try {
          const result = await task.fn();
          return { key: task.key, result };
        } catch (error) {
          return { key: task.key, error: error as Error };
        }
      })
    );

    for (const settled of batchResults) {
      if (settled.status === 'fulfilled') {
        results.push(settled.value);
      }
    }

    onProgress?.(Math.min(i + batch.length, total), total);

    // Delay between batches for API rate limiting
    if (i + maxConcurrency < total && delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
};

// ═══════════════════ Utilities ═══════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
