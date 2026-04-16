import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { topic, type, language, style, apiKey: userApiKey } = await request.json();
    const supabase = getServiceSupabase();

    // Validate user
    if (userApiKey) {
      const { data: user } = await supabase
        .from('users')
        .select('id, status, credits')
        .eq('api_key', userApiKey)
        .single();

      if (!user || user.status === 'suspended') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Get Gemini API key from env or settings
    let geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'gemini_api_key')
        .single();
      geminiKey = setting?.value;
    }

    if (!geminiKey) {
      return NextResponse.json(
        { error: 'Gemini API key chưa được cấu hình. Admin cần set GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const promptType = type === 'video' ? 'video AI' : 'ảnh AI';
    const langNote = language === 'en' ? 'Write the prompt in English.' : 'Viết prompt bằng tiếng Anh (English).';

    const systemPrompt = `Bạn là chuyên gia tạo prompt cho ${promptType}. 
Hãy tạo 1 prompt chi tiết, chuyên nghiệp dựa trên chủ đề sau.
${langNote}

Chủ đề: ${topic}
${style ? `Phong cách: ${style}` : ''}
${type === 'video' ? 'Prompt cho video cần mô tả chuyển động camera, ánh sáng, không khí.' : 'Prompt cho ảnh cần mô tả chi tiết bố cục, ánh sáng, màu sắc, chất liệu.'}

Chỉ trả về prompt, không giải thích thêm.`;

    const result = await model.generateContent(systemPrompt);
    const generatedPrompt = result.response.text().trim();

    return NextResponse.json({ prompt: generatedPrompt });

  } catch (err: any) {
    console.error('Prompt generation error:', err);
    return NextResponse.json(
      { error: 'Lỗi tạo prompt: ' + err.message },
      { status: 500 }
    );
  }
}
