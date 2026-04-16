import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action, username, password } = await request.json();
    const supabase = getServiceSupabase();

    if (action === 'login') {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !user) {
        return NextResponse.json(
          { error: 'Sai tên đăng nhập hoặc mật khẩu' },
          { status: 401 }
        );
      }

      if (user.status === 'suspended') {
        return NextResponse.json(
          { error: 'Tài khoản đã bị khóa. Liên hệ Admin.' },
          { status: 403 }
        );
      }

      // Return user info (exclude password)
      const { password: _, ...safeUser } = user;
      return NextResponse.json({ user: safeUser });

    } else if (action === 'register') {
      // Check if username exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Tên đăng nhập đã tồn tại' },
          { status: 400 }
        );
      }

      // Get default credits from settings
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
          credits: defaultCredits,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Không thể tạo tài khoản: ' + error.message },
          { status: 500 }
        );
      }

      const { password: _, ...safeUser } = newUser;
      return NextResponse.json({ user: safeUser });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Server error: ' + err.message },
      { status: 500 }
    );
  }
}

// GET: Fetch user by API key (for session validation)
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('api_key', apiKey)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { password: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}
