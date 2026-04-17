import { supabase } from '../lib/supabase';

export interface UserQuota {
  image_quota: number;
  video_quota: number;
  images_used: number;
  videos_used: number;
  imagesRemaining: number;
  videosRemaining: number;
}

/**
 * Lấy quota hiện tại của user
 */
export const getUserQuota = async (username: string): Promise<UserQuota | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('image_quota, video_quota, images_used, videos_used, role')
    .eq('username', username)
    .single();

  if (error || !data) return null;

  // Admin có quota vô hạn
  if (data.role === 'admin') {
    return {
      image_quota: 999999,
      video_quota: 999999,
      images_used: data.images_used || 0,
      videos_used: data.videos_used || 0,
      imagesRemaining: 999999,
      videosRemaining: 999999,
    };
  }

  const imageQuota = data.image_quota || 50;
  const videoQuota = data.video_quota || 20;
  const imagesUsed = data.images_used || 0;
  const videosUsed = data.videos_used || 0;

  return {
    image_quota: imageQuota,
    video_quota: videoQuota,
    images_used: imagesUsed,
    videos_used: videosUsed,
    imagesRemaining: Math.max(0, imageQuota - imagesUsed),
    videosRemaining: Math.max(0, videoQuota - videosUsed),
  };
};

/**
 * Kiểm tra user có thể tạo ảnh không
 */
export const canGenerateImage = async (username: string): Promise<boolean> => {
  const quota = await getUserQuota(username);
  if (!quota) return false;
  return quota.imagesRemaining > 0;
};

/**
 * Kiểm tra user có thể tạo video không
 */
export const canGenerateVideo = async (username: string): Promise<boolean> => {
  const quota = await getUserQuota(username);
  if (!quota) return false;
  return quota.videosRemaining > 0;
};

/**
 * Tăng số ảnh đã dùng
 */
export const incrementImageUsage = async (username: string, count: number = 1): Promise<void> => {
  const { data } = await supabase
    .from('users')
    .select('images_used')
    .eq('username', username)
    .single();
  
  if (data) {
    await supabase
      .from('users')
      .update({ images_used: (data.images_used || 0) + count })
      .eq('username', username);
  }
};

/**
 * Tăng số video đã dùng
 */
export const incrementVideoUsage = async (username: string, count: number = 1): Promise<void> => {
  const { data } = await supabase
    .from('users')
    .select('videos_used')
    .eq('username', username)
    .single();
  
  if (data) {
    await supabase
      .from('users')
      .update({ videos_used: (data.videos_used || 0) + count })
      .eq('username', username);
  }
};

/**
 * Reset quota (dùng cho admin)
 */
export const resetUserQuota = async (username: string): Promise<void> => {
  await supabase
    .from('users')
    .update({ images_used: 0, videos_used: 0, quota_reset_date: new Date().toISOString() })
    .eq('username', username);
};

/**
 * Set quota mới cho user (admin only)
 */
export const setUserQuota = async (
  username: string,
  imageQuota: number,
  videoQuota: number
): Promise<void> => {
  await supabase
    .from('users')
    .update({ image_quota: imageQuota, video_quota: videoQuota })
    .eq('username', username);
};
