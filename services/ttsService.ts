import { GoogleGenAI, Modality } from "@google/genai";
import { getAiClient } from "./keyService";
import { VoiceName, VoiceGender, VoicePersona, Emotion, Style, Language } from './ttsTypes';

export interface TTSOptions {
  text: string;
  voiceName: string; // This will be the apiVoice (e.g., 'Puck')
  language: Language;
  personaId: string;
  emotion?: Emotion;
  style?: Style;
  speed?: number;
  pitch?: number;
}

const createVoice = (id: string, apiVoice: VoiceName, name: string, gender: VoiceGender, desc: string, instruction: string): VoicePersona => ({
  id, apiVoice, name, gender, description: desc, accentInstruction: instruction
});

export const VOICE_PERSONAS: Record<Language, VoicePersona[]> = {
  [Language.Vietnamese]: [
    createVoice('vn_male_north', VoiceName.Charon, 'Tùng', VoiceGender.Male, 'Nam Bắc Bộ, trầm ấm', 'Giọng Hà Nội nam, đĩnh đạc.'),
    createVoice('vn_female_north', VoiceName.Kore, 'Mai', VoiceGender.Female, 'Nữ Bắc Bộ, trẻ trung', 'Giọng Hà Nội nữ, trong trẻo.'),
    createVoice('vn_satirical_north', VoiceName.Puck, 'Anh Mỉa', VoiceGender.Male, 'Nam Bắc, mỉa mai, sắc sảo', 'Giọng nam Hà Nội sắc sảo, phong cách châm biếm, mỉa mai. Ngắt nghỉ nhịp nhàng, nhấn mạnh các từ mang tính giễu cợt, tông giọng có phần khinh khỉnh.'),
    createVoice('vn_funny_north', VoiceName.Puck, 'Anh Tếu', VoiceGender.Male, 'Nam Bắc, hài hước, tếu táo', 'Giọng nam Hà Nội, tếu táo, hài hước, châm biếm, nhấn nhá hóm hỉnh.'),
    createVoice('vn_male_south', VoiceName.Fenrir, 'Khoa', VoiceGender.Male, 'Nam Nam Bộ, gần gũi', 'Giọng Sài Gòn nam, thân thiện.'),
    createVoice('vn_female_south', VoiceName.Zephyr, 'Lan', VoiceGender.Female, 'Nữ Nam Bộ, ngọt ngào', 'Giọng Sài Gòn nữ, ngọt ngào.'),
    createVoice('vn_old_male', VoiceName.Charon, 'Bác Bảy', VoiceGender.Male, 'Ông lão Miền Tây', 'Giọng cụ già Miền Tây, chậm rãi.'),
    createVoice('vn_story', VoiceName.Puck, 'Hùng', VoiceGender.Male, 'Giọng đọc kịch tính', 'Giọng nam trầm, kịch tính.'),
  ],
  [Language.EnglishUS]: [
    createVoice('us_fem_sarah', VoiceName.Zephyr, 'Sarah', VoiceGender.Female, 'US Natural', 'US female, friendly.'),
    createVoice('us_male_mike', VoiceName.Fenrir, 'Mike', VoiceGender.Male, 'US Casual', 'US male, professional.'),
  ],
  [Language.EnglishUK]: [
    createVoice('uk_posh', VoiceName.Puck, 'Arthur', VoiceGender.Male, 'UK Formal', 'British male, formal.'),
  ],
  [Language.Japanese]: [createVoice('jp_std', VoiceName.Zephyr, 'Hina', VoiceGender.Female, 'Standard', 'Japanese female, polite.')],
  [Language.Korean]: [createVoice('kr_std', VoiceName.Zephyr, 'Min-ji', VoiceGender.Female, 'Standard', 'Korean female, soft.')],
  [Language.Chinese]: [createVoice('cn_std', VoiceName.Charon, 'Zhang', VoiceGender.Male, 'Standard', 'Mandarin male, clear.')],
  [Language.French]: [createVoice('fr_std', VoiceName.Zephyr, 'Amélie', VoiceGender.Female, 'Standard', 'French female, soft.')],
  [Language.German]: [createVoice('de_std', VoiceName.Puck, 'Hans', VoiceGender.Male, 'Standard', 'German male, direct.')],
  [Language.Spanish]: [createVoice('es_std', VoiceName.Fenrir, 'Mateo', VoiceGender.Male, 'Standard', 'Spanish male, warm.')],
  [Language.Italian]: [createVoice('it_std', VoiceName.Kore, 'Giulia', VoiceGender.Female, 'Standard', 'Italian female, dynamic.')],
  [Language.Russian]: [createVoice('ru_std', VoiceName.Charon, 'Dimitri', VoiceGender.Male, 'Standard', 'Russian male, deep.')],
  [Language.Portuguese]: [createVoice('pt_std', VoiceName.Fenrir, 'João', VoiceGender.Male, 'Standard', 'Portuguese male.')],
  [Language.Hindi]: [createVoice('hi_std', VoiceName.Zephyr, 'Priya', VoiceGender.Female, 'Standard', 'Hindi female.')],
  [Language.Arabic]: [createVoice('ar_std', VoiceName.Puck, 'Ahmed', VoiceGender.Male, 'Standard', 'Arabic male.')],
  [Language.Turkish]: [createVoice('tr_std', VoiceName.Kore, 'Elif', VoiceGender.Female, 'Standard', 'Turkish female.')],
  [Language.Dutch]: [createVoice('nl_std', VoiceName.Fenrir, 'Daan', VoiceGender.Male, 'Standard', 'Dutch male.')],
};

export const LANGUAGES = [
  { value: Language.Vietnamese, label: 'Tiếng Việt' },
  { value: Language.EnglishUS, label: 'English (US)' },
  { value: Language.EnglishUK, label: 'English (UK)' },
  { value: Language.Japanese, label: 'Japanese' },
  { value: Language.Korean, label: 'Korean' },
  { value: Language.Chinese, label: 'Chinese' },
  { value: Language.French, label: 'French' },
  { value: Language.German, label: 'German' },
  { value: Language.Spanish, label: 'Spanish' },
  { value: Language.Italian, label: 'Italian' },
  { value: Language.Russian, label: 'Russian' },
  { value: Language.Portuguese, label: 'Portuguese' },
  { value: Language.Hindi, label: 'Hindi' },
  { value: Language.Arabic, label: 'Arabic' },
  { value: Language.Turkish, label: 'Turkish' },
  { value: Language.Dutch, label: 'Dutch' },
];

export const EMOTIONS = [
  { value: Emotion.Neutral, label: 'Bình thường' },
  { value: Emotion.Cheerful, label: 'Vui vẻ' },
  { value: Emotion.Serious, label: 'Nghiêm túc' },
  { value: Emotion.Excited, label: 'Hào hứng' },
  { value: Emotion.Empathetic, label: 'Đồng cảm' },
  { value: Emotion.Professional, label: 'Chuyên nghiệp' },
];

export const STYLES = [
  { value: Style.General, label: 'Tiêu chuẩn' },
  { value: Style.Sharing, label: 'Tâm sự' },
  { value: Style.Podcast, label: 'Podcast' },
  { value: Style.Presentation, label: 'Thuyết trình' },
  { value: Style.Storytelling, label: 'Kể chuyện' },
  { value: Style.SalesReview, label: 'Review bán hàng' },
];

export const SAMPLE_TEXT = `Chào mừng bạn đến với kỷ nguyên số. Trí tuệ nhân tạo không chỉ là công cụ, mà đang thay đổi cách chúng ta tư duy và sáng tạo... Hãy cùng khám phá những tiềm năng vô hạn ngay hôm nay!`;

export const generateAudio = async (options: TTSOptions): Promise<{ data: string, mimeType: string }> => {
  const ai = getAiClient('text');

  // Find the persona to get the accent instruction
  const personasInLang = VOICE_PERSONAS[options.language] || [];
  const persona = personasInLang.find(p => p.id === options.personaId);

  // Constructing the prompt to include emotion and style instructions if provided
  let prompt = options.text;
  const context = [];
  
  if (persona?.accentInstruction) {
    context.push(`voice style: ${persona.accentInstruction}`);
  }
  if (options.emotion) {
    context.push(`emotion: ${options.emotion}`);
  }
  if (options.style) {
    context.push(`style: ${options.style}`);
  }
  if (options.speed) {
    context.push(`speed: ${options.speed}x`);
  }
  if (options.pitch) {
    context.push(`pitch: ${options.pitch}x`);
  }

  if (context.length > 0) {
    prompt = `[${context.join(', ')}] ${options.text}`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { 
            voiceName: options.voiceName as any 
          },
        },
      },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioPart?.data) {
    throw new Error("Không thể tạo âm thanh từ AI.");
  }

  const pcmData = base64ToUint8Array(audioPart.data);
  const wavData = encodeWAV(pcmData, 24000);
  const wavBase64 = uint8ArrayToBase64(wavData);

  return {
    data: wavBase64,
    mimeType: "audio/wav"
  };
};

// Helper functions for PCM to WAV conversion
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeWAV(samples: Uint8Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length, true);

  // Write the PCM samples
  const samplesUint8 = new Uint8Array(buffer, 44);
  samplesUint8.set(samples);

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
