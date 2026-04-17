import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ozuiiacjwzqyspalsvma.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function isAdmin(telegramId) {
  const { data: setting } = await supabase
    .from('app_settings').select('value').eq('key', 'admin_telegram_ids').single();
  if (setting?.value) {
    const adminIds = setting.value.split(',').map(id => parseInt(id.trim()));
    if (adminIds.includes(telegramId)) return true;
  }
  const { data: user } = await supabase
    .from('users').select('role').eq('telegram_id', telegramId).single();
  return user?.role === 'admin';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const update = req.body;
    const message = update.message;
    if (!message?.text) return res.json({ ok: true });

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const text = message.text.trim();

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
        `/ban &lt;username&gt; | /unban &lt;username&gt;\n` +
        `/deleteuser &lt;username&gt;\n` +
        `/setgemini &lt;key&gt;`
      );
      return res.json({ ok: true });
    }

    if (text.startsWith('/register ')) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) { await sendMessage(chatId, '❌ Sử dụng: /register &lt;username&gt; &lt;password&gt;'); return res.json({ ok: true }); }
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
      else { await sendMessage(chatId, `📋 <b>Thông tin tài khoản</b>\n\n👤 Username: <code>${user.username}</code>\n🔑 API Key: <code>${user.api_key}</code>\n💰 Credits: ${user.credits}\n📊 Status: ${user.status === 'active' ? '✅ Active' : '🚫 Suspended'}\n👑 Role: ${user.role}\n📅 Ngày tạo: ${new Date(user.created_at).toLocaleDateString('vi-VN')}`); }
      return res.json({ ok: true });
    }

    // Admin commands
    if (text.startsWith('/adduser ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const parts = text.split(/\s+/);
      if (parts.length < 3) { await sendMessage(chatId, '❌ /adduser &lt;username&gt; &lt;password&gt;'); return res.json({ ok: true }); }
      const { data: creditsSetting } = await supabase.from('app_settings').select('value').eq('key', 'default_credits').single();
      const { data: newUser, error } = await supabase.from('users').insert({ username: parts[1], password: parts[2], credits: creditsSetting ? parseInt(creditsSetting.value) : 100 }).select().single();
      if (error) { await sendMessage(chatId, `❌ ${error.message}`); }
      else { await sendMessage(chatId, `✅ Đã tạo: ${newUser.username}\n🔑 <code>${newUser.api_key}</code>\n💰 ${newUser.credits} credits`); }
      return res.json({ ok: true });
    }

    if (text === '/users') {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const { data: users } = await supabase.from('users').select('username, status, credits, role').order('created_at', { ascending: false }).limit(50);
      if (!users?.length) { await sendMessage(chatId, '📋 Chưa có user nào.'); }
      else {
        let msg = `📋 <b>Users (${users.length})</b>\n\n`;
        users.forEach((u, i) => { msg += `${i+1}. ${u.status === 'active' ? '✅' : '🚫'}${u.role === 'admin' ? '👑' : '👤'} <b>${u.username}</b> — 💰${u.credits}\n`; });
        await sendMessage(chatId, msg);
      }
      return res.json({ ok: true });
    }

    if (text.startsWith('/setcredits ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      const parts = text.split(/\s+/);
      if (parts.length < 3) { await sendMessage(chatId, '❌ /setcredits &lt;username&gt; &lt;amount&gt;'); return res.json({ ok: true }); }
      await supabase.from('users').update({ credits: parseInt(parts[2]) }).eq('username', parts[1]);
      await sendMessage(chatId, `✅ ${parts[1]} = ${parts[2]} credits.`);
      return res.json({ ok: true });
    }

    if (text.startsWith('/ban ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      await supabase.from('users').update({ status: 'suspended' }).eq('username', text.split(/\s+/)[1]);
      await sendMessage(chatId, `🚫 Đã khóa: ${text.split(/\s+/)[1]}`);
      return res.json({ ok: true });
    }

    if (text.startsWith('/unban ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      await supabase.from('users').update({ status: 'active' }).eq('username', text.split(/\s+/)[1]);
      await sendMessage(chatId, `✅ Đã mở khóa: ${text.split(/\s+/)[1]}`);
      return res.json({ ok: true });
    }

    if (text.startsWith('/deleteuser ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      await supabase.from('users').delete().eq('username', text.split(/\s+/)[1]);
      await sendMessage(chatId, `🗑️ Đã xóa: ${text.split(/\s+/)[1]}`);
      return res.json({ ok: true });
    }

    if (text.startsWith('/setgemini ')) {
      if (!(await isAdmin(telegramId))) { await sendMessage(chatId, '🚫 Chỉ Admin.'); return res.json({ ok: true }); }
      await supabase.from('app_settings').upsert({ key: 'gemini_api_key', value: text.split(/\s+/)[1], description: 'Gemini API Key' });
      await sendMessage(chatId, `✅ Gemini API Key đã cập nhật.`);
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
