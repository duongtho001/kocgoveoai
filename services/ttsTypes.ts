export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export enum VoiceGender {
  Male = 'Male',
  Female = 'Female'
}

export interface VoicePersona {
  id: string;
  apiVoice: VoiceName;
  name: string;
  gender: VoiceGender;
  description: string;
  accentInstruction: string;
}

export enum Emotion {
  Neutral = 'Neutral',
  Cheerful = 'Cheerful',
  Serious = 'Serious',
  Excited = 'Excited',
  Empathetic = 'Empathetic',
  Professional = 'Professional'
}

export enum Style {
  General = 'General',
  Sharing = 'Sharing',
  Podcast = 'Podcast',
  Presentation = 'Presentation',
  Storytelling = 'Storytelling',
  SalesReview = 'SalesReview'
}

export enum Language {
  Vietnamese = 'Vietnamese',
  EnglishUS = 'EnglishUS',
  EnglishUK = 'EnglishUK',
  Japanese = 'Japanese',
  Korean = 'Korean',
  Chinese = 'Chinese',
  French = 'French',
  German = 'German',
  Spanish = 'Spanish',
  Italian = 'Italian',
  Russian = 'Russian',
  Portuguese = 'Portuguese',
  Hindi = 'Hindi',
  Arabic = 'Arabic',
  Turkish = 'Turkish',
  Dutch = 'Dutch'
}
