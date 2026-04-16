import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspect_ratio, video_length_seconds, apiKey } = await request.json();
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
    }

    // Get Flow API URL
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

    // Call Flow API - Text to Video (Veo 3.1 Lite Free - 0 credit)
    const flowResponse = await fetch(`${flowUrl}/api/text-to-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        prompts: [prompt],
        aspect_ratio: aspect_ratio || '16:9',
        model_tier: 'VEO_3_1_LITE_FREE', // 0 credit model
        video_length_seconds: video_length_seconds || 8,
        max_concurrency: 1,
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
        type: 'video',
        prompt,
        model: 'VEO_3_1_LITE_FREE',
        status: 'processing',
        job_id: jobData.job_id,
        credits_used: 0, // Free model
      });
    }

    return NextResponse.json({
      job_id: jobData.job_id,
      status: jobData.status,
      flow_api_url: flowUrl,
    });

  } catch (err: any) {
    console.error('Video generation error:', err);
    return NextResponse.json(
      { error: 'Lỗi tạo video: ' + err.message },
      { status: 500 }
    );
  }
}
