-- ============================================================
-- KOC GOVEOAI - Supabase Database Setup
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  telegram_id BIGINT UNIQUE,
  api_key TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  credits INTEGER DEFAULT 100,
  max_daily_generations INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. App settings table (admin configurable)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Generation history
CREATE TABLE IF NOT EXISTS generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prompt', 'image', 'video')),
  prompt TEXT,
  model TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  job_id TEXT,
  result_url TEXT,
  error TEXT,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Insert default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('flow_api_url', 'https://sneer-enviable-evaluate.ngrok-free.dev', 'Flow API server URL'),
  ('image_model', 'GEM_PIX_2', 'Default image model (Nano Banana 2)'),
  ('video_model', 'VEO_3_1_LITE_FREE', 'Default video model (Veo 3.1 Lite Free - 0 credit)'),
  ('default_credits', '100', 'Default credits for new users'),
  ('image_credit_cost', '1', 'Credits per image generation'),
  ('video_credit_cost', '0', 'Credits per video generation (0 for free model)'),
  ('admin_telegram_ids', '', 'Comma-separated Telegram IDs of admins')
ON CONFLICT (key) DO NOTHING;

-- 5. Create default admin user
INSERT INTO users (username, password, role, credits) VALUES
  ('admin', 'admin123', 'admin', 99999)
ON CONFLICT (username) DO NOTHING;

-- 6. Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - Allow service role full access
CREATE POLICY "Service role full access to users" ON users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to settings" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to generations" ON generations
  FOR ALL USING (true) WITH CHECK (true);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_job_id ON generations(job_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);

-- 9. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
