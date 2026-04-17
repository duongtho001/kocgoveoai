import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ozuiiacjwzqyspalsvma.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const data = await resp.json();
  if (!data.ok) console.error('[Telegram] sendMessage failed:', data);
}

async function isAdmin(telegramId) {
  // Bot chỉ admin sử dụng — luôn cho phép
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Debug: check env vars
    if (!BOT_TOKEN) {
      console.error('[Telegram] TELEGRAM_BOT_TOKEN is not set!');
      return res.status(500).json({ error: 'Bot token not configured' });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Telegram] SUPABASE_SERVICE_ROLE_KEY is not set!');
    }

    const update = req.body;
    const message = update.message;
    if (!message?.text) return res.json({ ok: true });

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    // Strip @botname suffix from commands (e.g., /register@koc_bot → /register)
    const text = message.text.trim().replace(/@\w+/, '');

    if (text === '/start') {
      await sendMessage(chatId,
        `🚀 <b>KOC Goveoai Bot</b>\n\n` +
        `Chào mừng bạn đến với hệ thống quản lý KOC Goveoai!\n\n` +
        `<b>📋 Lệnh người dùng:</b>\n` +
        `/register &lt;username&gt; &lt;password&gt; — Đăng ký\n` +
        `/mykey — Xem API key\n` +
        `/newkey — Tạo API key mới\n` +
        `/myinfo — Thông tin tài khoản\n\n` +
        `<b>🔧 Lệnh Admin:</b>\n` +
        `/adduser &lt;username&gt; &lt;password&gt;\n` +
        `/users — Danh sách users\n` +
        `/setcredits &lt;username&gt; &lt;amount&gt;\n` +
        `/setquota &lt;username&gt; &lt;images&gt; &lt;videos&gt;\n` +
        `/resetquota &lt;username&gt;\n` +
        `/ban &lt;username&gt; | /unban &lt;username&gt;\n` +
        `/deleteuser &lt;username&gt;\n` +
        `/setgemini &lt;key&gt;`
      );
      return res.json({ ok: true });
    }

    if (text === '/register' || text.startsWith('/register ')) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) { await sendMessage(chatId, '❌ Sử dụng: /register &lt;username&gt; &lt;password&gt;\n\nVD: /register nguyen123 matkhau456'); return res.json({ ok: true }); }
      const { data: existing } = await supabase.from('users').select('id').eq('username', parts[1]).single();
      if (existing) { await sendMessage(chatId, '❌ Username đã tồn tại!'); return res.json({ ok: true }); }
      const { data: creditsSetting } = await supabase.from('app_settings').select('value').eq('key', 'default_credits').single();
      const defaultCredits = creditsSetting ? parseInt(creditsSetting.value) : 100;
      const { data: newUser, error } = await supabase.from('users').insert({ username: parts[1], password: parts[2], telegram_id: telegramId, credits: defaultCredits }).select().single();
      if (error) { await sendMessage(chatId, `❌ Lỗi: ${error.message}`); }
      else { await sendMessage(chatId, `✅ <b>Đăng ký thành công!</b>\n👤 Username: <code>${newUser.username}</code>\n🔑 API Key: <code>${newUser.api_key}</code>\n💰 Credits: ${newUser.credits}`); }
      return res.json({ ok: true });
    }

    if (text === '/mykey') {
      const { data: user } = await supabase.from('users').select('api_key, username').eq('telegram_id', telegramId).single();
      if (!user) { await sendMessage(chatId, '❌ Bạn chưa đăng ký. Sử dụng /register'); }
      else { await sendMessage(chatId, `🔑 <b>API Key của ${user.username}:</b>\n\n<code>${user.api_key}</code>`); }
      return res.json({ ok: true });
    }

    if (text === '/newkey') {
      const newKey = crypto.randomUUID();
      const { data: user } = await supabase.from('users').update({ api_key: newKey }).eq('telegram_id', telegramId).select('username, api_key').single();
      if (!user) { await sendMessage(chatId, '❌ Bạn chưa đăng ký.'); }
      else { await sendMessage(chatId, `✅ <b>API Key mới:</b>\n\n<code>${user.api_key}</code>\n\n⚠️ Key cũ đã bị vô hiệu hóa.`); }
      return res.json({ ok: true });
    }

    if (text === '/myinfo') {
      const { data: user } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
      if (!user) { await sendMessage(chatId, '❌ Bạn chưa đăng ký.'); }
      else { await sendMessage(chatId, `📋 <b>Thông tin tài khoản</b>\n\n👤 Username: <code>${user.username}</code>\n🔑 API Key: <code>${user.api_key}</code>\n💰 Credits: ${user.credits}\n📷 Ảnh: ${user.images_used || 0}/${user.image_quota || 50}\n🎥 Video: ${user.videos_used || 0}/${user.video_quota || 20}\n📊 Status: ${user.status === 'active' ? '✅ Active' : '🚫 Suspended'}\n👑 Role: ${user.role}\n📅 Ngày tạo: ${new Date(user.created_at).toLocaleDateString('vi-VN')}`); }
      return res.json({ ok: true });
    }

    // Admin commands
    if (text === '/adduser' || text.startsWith('/adduser ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const parts = text.split(/\s+/);
      if (parts.length < 3) { await sendMessage(chatId, '❌ /adduser &lt;username&gt; &lt;password&gt;\n\nVD: /adduser nguyen123 matkhau456'); return res.json({ ok: true }); }
      const { data: creditsSetting } = await supabase.from('app_settings').select('value').eq('key', 'default_credits').single();
      const { data: newUser, error } = await supabase.from('users').insert({ username: parts[1], password: parts[2], credits: creditsSetting ? parseInt(creditsSetting.value) : 100 }).select().single();
      if (error) { await sendMessage(chatId, `❌ ${error.message}`); }
      else { await sendMessage(chatId, `✅ Đã tạo: ${newUser.username}\n🔑 <code>${newUser.api_key}</code>\n💰 ${newUser.credits} credits`); }
      return res.json({ ok: true });
    }

    if (text === '/users') {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const { data: users } = await supabase.from('users').select('username, status, credits, role, image_quota, video_quota, images_used, videos_used').order('created_at', { ascending: false }).limit(50);
      if (!users?.length) { await sendMessage(chatId, '📋 Chưa có user nào.'); }
      else {
        let msg = `📋 <b>Users (${users.length})</b>\n\n`;
        users.forEach((u, i) => { msg += `${i+1}. ${u.status === 'active' ? '✅' : '🚫'}${u.role === 'admin' ? '👑' : '👤'} <b>${u.username}</b> — 📷${u.images_used||0}/${u.image_quota||50} 🎥${u.videos_used||0}/${u.video_quota||20}\n`; });
        await sendMessage(chatId, msg);
      }
      return res.json({ ok: true });
    }

    if (text === '/setcredits' || text.startsWith('/setcredits ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const parts = text.split(/\s+/);
      if (parts.length < 3) { await sendMessage(chatId, '❌ /setcredits &lt;username&gt; &lt;amount&gt;\n\nVD: /setcredits nguyen123 200'); return res.json({ ok: true }); }
      await supabase.from('users').update({ credits: parseInt(parts[2]) }).eq('username', parts[1]);
      await sendMessage(chatId, `✅ ${parts[1]} = ${parts[2]} credits.`);
      return res.json({ ok: true });
    }

    if (text === '/ban' || text.startsWith('/ban ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const username = text.split(/\s+/)[1];
      if (!username) { await sendMessage(chatId, '❌ /ban &lt;username&gt;'); return res.json({ ok: true }); }
      await supabase.from('users').update({ status: 'suspended' }).eq('username', username);
      await sendMessage(chatId, `🚫 Đã khóa: ${username}`);
      return res.json({ ok: true });
    }

    if (text === '/unban' || text.startsWith('/unban ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const username = text.split(/\s+/)[1];
      if (!username) { await sendMessage(chatId, '❌ /unban &lt;username&gt;'); return res.json({ ok: true }); }
      await supabase.from('users').update({ status: 'active' }).eq('username', username);
      await sendMessage(chatId, `✅ Đã mở khóa: ${username}`);
      return res.json({ ok: true });
    }

    if (text === '/deleteuser' || text.startsWith('/deleteuser ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const username = text.split(/\s+/)[1];
      if (!username) { await sendMessage(chatId, '❌ /deleteuser &lt;username&gt;'); return res.json({ ok: true }); }
      await supabase.from('users').delete().eq('username', username);
      await sendMessage(chatId, `🗑️ Đã xóa: ${username}`);
      return res.json({ ok: true });
    }

    if (text === '/setgemini' || text.startsWith('/setgemini ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const key = text.split(/\s+/)[1];
      if (!key) { await sendMessage(chatId, '❌ /setgemini &lt;key&gt;'); return res.json({ ok: true }); }
      await supabase.from('app_settings').upsert({ key: 'gemini_api_key', value: key, description: 'Gemini API Key' });
      await sendMessage(chatId, `✅ Gemini API Key đã cập nhật.`);
      return res.json({ ok: true });
    }

    if (text === '/setquota' || text.startsWith('/setquota ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const parts = text.split(/\s+/);
      if (parts.length < 4) { await sendMessage(chatId, '❌ /setquota &lt;username&gt; &lt;images&gt; &lt;videos&gt;\n\nVD: /setquota nguyen123 100 50'); return res.json({ ok: true }); }
      const { error } = await supabase.from('users').update({ image_quota: parseInt(parts[2]), video_quota: parseInt(parts[3]) }).eq('username', parts[1]);
      if (error) { await sendMessage(chatId, `❌ ${error.message}`); }
      else { await sendMessage(chatId, `✅ Quota ${parts[1]}: 📷 ${parts[2]} ảnh, 🎥 ${parts[3]} video`); }
      return res.json({ ok: true });
    }

    if (text === '/resetquota' || text.startsWith('/resetquota ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const username = text.split(/\s+/)[1];
      if (!username) { await sendMessage(chatId, '❌ /resetquota &lt;username&gt;'); return res.json({ ok: true }); }
      const { error } = await supabase.from('users').update({ images_used: 0, videos_used: 0 }).eq('username', username);
      if (error) { await sendMessage(chatId, `❌ ${error.message}`); }
      else { await sendMessage(chatId, `✅ Đã reset quota cho ${username}`); }
      return res.json({ ok: true });
    }

    if (text.startsWith('/')) {
      await sendMessage(chatId, '❓ Lệnh không hợp lệ. Gõ /start để xem danh sách.');
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return res.json({ ok: true });
  }
}
