import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspect_ratio, upscale_quality, apiKey } = await request.json();
    const supabase = getServiceSupabase();

    // Validate user
    let userId: string | null = null;
    if (apiKey) {
      const { data: user } = await supabase
        .from('users')
        .select('id, status, credits')
        .eq('api_key', apiKey)
        .single();

      if (!user || user.status === 'suspended') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;

      // Check credits
      const { data: costSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'image_credit_cost')
        .single();
      const cost = costSetting ? parseInt(costSetting.value) : 1;

      if (user.credits < cost) {
        return NextResponse.json({ error: 'Hết credit. Liên hệ admin để nạp thêm.' }, { status: 403 });
      }
    }

    // Get Flow API URL from env or settings
    let flowUrl = process.env.FLOW_API_URL;
    if (!flowUrl) {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'flow_api_url')
        .single();
      flowUrl = setting?.value;
    }

    if (!flowUrl) {
      return NextResponse.json({ error: 'Flow API URL chưa được cấu hình' }, { status: 500 });
    }

    // Call Flow API - Text to Image
    const flowResponse = await fetch(`${flowUrl}/api/text-to-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        prompts: [prompt],
        aspect_ratio: aspect_ratio || '1:1',
        model_name: 'GEM_PIX_2', // Nano Banana 2
        num_images: 1,
        upscale_quality: upscale_quality || '4K',
      }),
    });

    if (!flowResponse.ok) {
      const errorText = await flowResponse.text();
      return NextResponse.json(
        { error: `Flow API error: ${errorText}` },
        { status: flowResponse.status }
      );
    }

    const jobData = await flowResponse.json();

    // Save generation record
    if (userId) {
      await supabase.from('generations').insert({
        user_id: userId,
        type: 'image',
        prompt,
        model: 'GEM_PIX_2',
        status: 'processing',
        job_id: jobData.job_id,
      });

      // Deduct credits
      const { data: currentUser } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();

      const { data: costSetting2 } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'image_credit_cost')
        .single();
      const creditCost = costSetting2 ? parseInt(costSetting2.value) : 1;
      
      if (currentUser) {
        await supabase
          .from('users')
          .update({ credits: Math.max(0, currentUser.credits - creditCost) })
          .eq('id', userId);
      }
    }

    return NextResponse.json({
      job_id: jobData.job_id,
      status: jobData.status,
      flow_api_url: flowUrl,
    });

  } catch (err: any) {
    console.error('Image generation error:', err);
    return NextResponse.json(
      { error: 'Lỗi tạo ảnh: ' + err.message },
      { status: 500 }
    );
  }
}
