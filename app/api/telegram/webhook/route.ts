import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function sendMessage(chatId: number, text: string, parseMode = 'HTML') {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
}

async function isAdmin(telegramId: number): Promise<boolean> {
  const supabase = getServiceSupabase();
  
  // Check admin_telegram_ids in settings
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'admin_telegram_ids')
    .single();

  if (setting?.value) {
    const adminIds = setting.value.split(',').map((id: string) => parseInt(id.trim()));
    if (adminIds.includes(telegramId)) return true;
  }

  // Check if user has admin role
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('telegram_id', telegramId)
    .single();

  return user?.role === 'admin';
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const message = update.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const text = message.text.trim();
    const supabase = getServiceSupabase();

    // ═══════════════════════════════════════════
    // /start - Welcome
    // ═══════════════════════════════════════════
    if (text === '/start') {
      await sendMessage(chatId,
        `🚀 <b>KOC Goveoai Bot</b>\n\n` +
        `Chào mừng bạn đến với hệ thống quản lý người dùng KOC Goveoai!\n\n` +
        `<b>📋 Lệnh người dùng:</b>\n` +
        `/register &lt;username&gt; &lt;password&gt; — Đăng ký tài khoản\n` +
        `/mykey — Xem API key của bạn\n` +
        `/newkey — Tạo API key mới\n` +
        `/myinfo — Xem thông tin tài khoản\n\n` +
        `<b>🔧 Lệnh Admin:</b>\n` +
        `/adduser &lt;username&gt; &lt;password&gt; — Thêm user\n` +
        `/users — Danh sách users\n` +
        `/setcredits &lt;username&gt; &lt;amount&gt; — Set credit\n` +
        `/ban &lt;username&gt; — Khóa user\n` +
        `/unban &lt;username&gt; — Mở khóa user\n` +
        `/setapi &lt;url&gt; — Đổi Flow API URL\n` +
        `/setgemini &lt;key&gt; — Đổi Gemini API key\n` +
        `/deleteuser &lt;username&gt; — Xóa user\n`
      );
      return NextResponse.json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // /register <username> <password>
    // ═══════════════════════════════════════════
    if (text.startsWith('/register ')) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendMessage(chatId, '❌ Sử dụng: /register &lt;username&gt; &lt;password&gt;');
        return NextResponse.json({ ok: true });
      }
      const username = parts[1];
      const password = parts[2];

      // Check existing
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existing) {
        await sendMessage(chatId, '❌ Username đã tồn tại!');
        return NextResponse.json({ ok: true });
      }

      // Get default credits
      const { data: creditsSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_credits')
        .single();
      const defaultCredits = creditsSetting ? parseInt(creditsSetting.value) : 100;

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          username,
          password,
          telegram_id: telegramId,
          credits: defaultCredits,
        })
        .select()
        .single();

      if (error) {
        await sendMessage(chatId, `❌ Lỗi: ${error.message}`);
      } else {
        await sendMessage(chatId,
          `✅ <b>Đăng ký thành công!</b>\n\n` +
          `👤 Username: <code>${newUser.username}</code>\n` +
          `🔑 API Key: <code>${newUser.api_key}</code>\n` +
          `💰 Credits: ${newUser.credits}\n\n` +
          `Sử dụng API key này để đăng nhập vào web.`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // /mykey - Show API key
    // ═══════════════════════════════════════════
    if (text === '/mykey') {
      const { data: user } = await supabase
        .from('users')
        .select('api_key, username')
        .eq('telegram_id', telegramId)
        .single();

      if (!user) {
        await sendMessage(chatId, '❌ Bạn chưa đăng ký. Sử dụng /register');
      } else {
        await sendMessage(chatId,
          `🔑 <b>API Key của ${user.username}:</b>\n\n<code>${user.api_key}</code>`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // /newkey - Generate new API key
    // ═══════════════════════════════════════════
    if (text === '/newkey') {
      const newKey = crypto.randomUUID();
      const { data: user, error } = await supabase
        .from('users')
        .update({ api_key: newKey })
        .eq('telegram_id', telegramId)
        .select('username, api_key')
        .single();

      if (!user) {
        await sendMessage(chatId, '❌ Bạn chưa đăng ký. Sử dụng /register');
      } else {
        await sendMessage(chatId,
          `✅ <b>API Key mới:</b>\n\n<code>${user.api_key}</code>\n\n⚠️ Key cũ đã bị vô hiệu hóa.`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // /myinfo - User info
    // ═══════════════════════════════════════════
    if (text === '/myinfo') {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (!user) {
        await sendMessage(chatId, '❌ Bạn chưa đăng ký.');
      } else {
        await sendMessage(chatId,
          `📋 <b>Thông tin tài khoản</b>\n\n` +
          `👤 Username: <code>${user.username}</code>\n` +
          `🔑 API Key: <code>${user.api_key}</code>\n` +
          `💰 Credits: ${user.credits}\n` +
          `📊 Status: ${user.status === 'active' ? '✅ Active' : '🚫 Suspended'}\n` +
          `👑 Role: ${user.role}\n` +
          `📅 Ngày tạo: ${new Date(user.created_at).toLocaleDateString('vi-VN')}`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ═══════════════════════════════════════════
    // ADMIN COMMANDS
    // ═══════════════════════════════════════════

    // /adduser <username> <password>
    if (text.startsWith('/adduser ')) {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin mới có quyền sử dụng lệnh này.');
        return NextResponse.json({ ok: true });
      }

      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendMessage(chatId, '❌ Sử dụng: /adduser &lt;username&gt; &lt;password&gt;');
        return NextResponse.json({ ok: true });
      }

      const { data: creditsSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_credits')
        .single();
      const defaultCredits = creditsSetting ? parseInt(creditsSetting.value) : 100;

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ username: parts[1], password: parts[2], credits: defaultCredits })
        .select()
        .single();

      if (error) {
        await sendMessage(chatId, `❌ Lỗi: ${error.message}`);
      } else {
        await sendMessage(chatId,
          `✅ <b>Đã tạo user:</b>\n` +
          `👤 ${newUser.username}\n` +
          `🔑 <code>${newUser.api_key}</code>\n` +
          `💰 Credits: ${newUser.credits}`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // /users - List all users
    if (text === '/users') {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin.');
        return NextResponse.json({ ok: true });
      }

      const { data: users } = await supabase
        .from('users')
        .select('username, status, credits, role, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!users?.length) {
        await sendMessage(chatId, '📋 Chưa có user nào.');
      } else {
        let msg = `📋 <b>Danh sách Users (${users.length})</b>\n\n`;
        users.forEach((u, i) => {
          const icon = u.status === 'active' ? '✅' : '🚫';
          const role = u.role === 'admin' ? '👑' : '👤';
          msg += `${i + 1}. ${icon}${role} <b>${u.username}</b> — 💰${u.credits}\n`;
        });
        await sendMessage(chatId, msg);
      }
      return NextResponse.json({ ok: true });
    }

    // /setcredits <username> <amount>
    if (text.startsWith('/setcredits ')) {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin.');
        return NextResponse.json({ ok: true });
      }

      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendMessage(chatId, '❌ Sử dụng: /setcredits &lt;username&gt; &lt;amount&gt;');
        return NextResponse.json({ ok: true });
      }

      const { error } = await supabase
        .from('users')
        .update({ credits: parseInt(parts[2]) })
        .eq('username', parts[1]);

      if (error) {
        await sendMessage(chatId, `❌ Lỗi: ${error.message}`);
      } else {
        await sendMessage(chatId, `✅ Đã set ${parts[1]} = ${parts[2]} credits.`);
      }
      return NextResponse.json({ ok: true });
    }

    // /ban <username>
    if (text.startsWith('/ban ')) {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin.');
        return NextResponse.json({ ok: true });
      }
      const username = text.split(/\s+/)[1];
      await supabase.from('users').update({ status: 'suspended' }).eq('username', username);
      await sendMessage(chatId, `🚫 Đã khóa user: ${username}`);
      return NextResponse.json({ ok: true });
    }

    // /unban <username>
    if (text.startsWith('/unban ')) {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin.');
        return NextResponse.json({ ok: true });
      }
      const username = text.split(/\s+/)[1];
      await supabase.from('users').update({ status: 'active' }).eq('username', username);
      await sendMessage(chatId, `✅ Đã mở khóa user: ${username}`);
      return NextResponse.json({ ok: true });
    }

    // /deleteuser <username>
    if (text.startsWith('/deleteuser ')) {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin.');
        return NextResponse.json({ ok: true });
      }
      const username = text.split(/\s+/)[1];
      const { error } = await supabase.from('users').delete().eq('username', username);
      if (error) {
        await sendMessage(chatId, `❌ Lỗi: ${error.message}`);
      } else {
        await sendMessage(chatId, `🗑️ Đã xóa user: ${username}`);
      }
      return NextResponse.json({ ok: true });
    }

    // /setapi <url> - Change Flow API URL
    if (text.startsWith('/setapi ')) {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin.');
        return NextResponse.json({ ok: true });
      }
      const url = text.split(/\s+/)[1];
      await supabase
        .from('app_settings')
        .upsert({ key: 'flow_api_url', value: url, description: 'Flow API server URL' });
      await sendMessage(chatId, `✅ Flow API URL đã được cập nhật:\n<code>${url}</code>`);
      return NextResponse.json({ ok: true });
    }

    // /setgemini <key> - Change Gemini API key
    if (text.startsWith('/setgemini ')) {
      if (!(await isAdmin(telegramId))) {
        await sendMessage(chatId, '🚫 Chỉ Admin.');
        return NextResponse.json({ ok: true });
      }
      const key = text.split(/\s+/)[1];
      await supabase
        .from('app_settings')
        .upsert({ key: 'gemini_api_key', value: key, description: 'Gemini API Key' });
      await sendMessage(chatId, `✅ Gemini API Key đã được cập nhật.`);
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    if (text.startsWith('/')) {
      await sendMessage(chatId, '❓ Lệnh không hợp lệ. Gõ /start để xem danh sách lệnh.');
    }

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
