export interface User {
  id: string;
  username: string;
  password: string;
  telegram_id: number | null;
  api_key: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  credits: number;
  max_daily_generations: number;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  type: 'prompt' | 'image' | 'video';
  prompt: string;
  model: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  job_id: string | null;
  result_url: string | null;
  error: string | null;
  credits_used: number;
  created_at: string;
}

export interface FlowJobResponse {
  job_id: string;
  status: string;
  type: string;
  progress: number;
  videos: string[];
  images: string[];
  logs: string[];
  error?: string;
}

export interface AuthSession {
  user: User;
  token: string;
}
