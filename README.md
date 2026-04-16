# KOC Goveoai — AI Image & Video Generator

Ứng dụng web tạo ảnh AI (Nano Banana 2) và video AI (Veo 3.1 Lite Free) với quản lý người dùng qua Supabase + Telegram Bot.

## 🚀 Tính năng

- **Tạo Prompt AI**: Sử dụng Gemini AI để tạo prompt chuyên nghiệp
- **Tạo Ảnh AI**: Model Nano Banana 2 (GEM_PIX_2), upscale miễn phí 4K
- **Tạo Video AI**: Model Veo 3.1 Lite Free (0 credit), video 6-8 giây
- **Supabase**: Lưu trữ thông tin người dùng, API key, lịch sử tạo
- **Telegram Bot**: Đăng ký, quản lý user, đổi API key bằng lệnh
- **Credit System**: Hệ thống credit theo dõi sử dụng

## 📦 Deploy lên Vercel

### Bước 1: Setup Supabase
1. Vào [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Copy và chạy toàn bộ file `supabase-setup.sql`
3. Đặt admin_telegram_ids trong bảng app_settings = Telegram ID của bạn

### Bước 2: Push lên GitHub
```bash
cd kocgoveoai
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/duongtho001/kocgoveoai.git
git push -u origin main
```

### Bước 3: Deploy Vercel
1. Vào [vercel.com](https://vercel.com) → Import Git Repository
2. Chọn repo `kocgoveoai`
3. Thêm Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `FLOW_API_URL`
   - `GEMINI_API_KEY`
4. Deploy!

### Bước 4: Set Telegram Webhook
Sau khi deploy, chạy URL sau trong trình duyệt:
```
https://api.telegram.org/bot8605733415:AAEr5cC3iuFfTpDttu_3AaqP_EIxZr0usBY/setWebhook?url=https://YOUR-VERCEL-URL.vercel.app/api/telegram/webhook
```

## 🤖 Telegram Bot Commands

### Người dùng
- `/start` — Welcome + hướng dẫn
- `/register <username> <password>` — Đăng ký
- `/mykey` — Xem API key
- `/newkey` — Tạo API key mới
- `/myinfo` — Xem thông tin tài khoản

### Admin
- `/adduser <username> <password>` — Thêm user
- `/users` — Danh sách users
- `/setcredits <username> <amount>` — Set credit
- `/ban <username>` — Khóa user
- `/unban <username>` — Mở khóa user
- `/deleteuser <username>` — Xóa user
- `/setapi <url>` — Đổi Flow API URL
- `/setgemini <key>` — Đổi Gemini API key

## 🏗️ Tech Stack

- **Frontend**: Next.js 14, React 18, CSS (Custom Design System)
- **Backend**: Next.js API Routes (Serverless)
- **Database**: Supabase (PostgreSQL)
- **AI**: Gemini 2.0 Flash, Flow API (Nano Banana 2 + Veo 3.1)
- **Bot**: Telegram Bot API
- **Deploy**: Vercel
