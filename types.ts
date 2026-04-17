
export interface ScriptParts {
  [key: string]: string;
}

export interface GeneratedImage {
  url: string;
  loading: boolean;
  error?: string;
  customPrompt?: string;
  regenNote?: string;
  pose?: string;
}

export interface VideoPromptState {
  text: string;
  loading: boolean;
  visible: boolean;
  translatedText?: string;
  translating?: boolean;
}

export interface TimelapseContext {
  subject: string;
  processType: string;
  rawMaterial: string;
  toolsVisible: string;
}

export interface TimelapseSegment {
  id: number;
  content: string;
  image: GeneratedImage;
  videoPrompt: VideoPromptState;
}

export interface AnalyzedCharacter {
  name: string;
  description: string;
}

export interface Personification2Segment {
  id: number;
  content: string;
  characterIdea: string;
  speaker: string; 
  image: GeneratedImage;
  imagePrompt: VideoPromptState;
  videoPrompt: VideoPromptState;
}

export interface FashionScenarioPart {
  id: number;
  outfitIndex: number;
  poseDescription: string;
  vibeDescription: string;
}

export interface FashionImageItem {
  id: string;
  outfitIndex: number;
  url: string;
  loading: boolean;
  error?: string;
  regenNote: string;
  videoPrompt: string;
  isPromptLoading: boolean;
  isPromptVisible: boolean;
  imagePrompt?: string;
  isImagePromptLoading?: boolean;
  isImagePromptVisible?: boolean;
  scenarioPart?: string;
}

export interface CarouselItem {
  id: number;
  content: string;
  imageUrl: string;
  loading: boolean;
  error?: string;
  regenerateNote: string;
  textPosition: 'Top' | 'Bottom' | 'Center';
  alignment: 'left' | 'center';
  textColor: string;
  fontSize: number;
  overlayColor: string;
  overlayOpacity: number;
  showOverlay: boolean;
  videoPrompt?: VideoPromptState;
  imagePrompt?: VideoPromptState;
}

export interface PovScriptSegment {
  id: number;
  content: string;
  image: GeneratedImage;
  videoPrompt: VideoPromptState;
}


export interface PersonificationSegment {
  id: number;
  content: string;
  image: GeneratedImage;
  imagePrompt: VideoPromptState;
  videoPrompt: VideoPromptState;
}

export interface VideoPovState {
  videoFile: File | null;
  videoPreviewUrl: string | null;
  originalScriptInput: string;
  analysis: string;
  isAnalyzing: boolean;
  style: string;
  gender: string;
  voice: string;
  characterDescription: string;
  contextNote: string;
  segmentCount: number;
  faceFile: File | null;
  facePreviewUrl: string | null;
  isGeneratingScript: boolean;
  segments: PovScriptSegment[];
}

export type ScriptPartKey = string;

export interface Shopee8sProduct {
  id: number;
  name: string;
  usp: string;
  background: string;
  action: string;
  file: File | null;
  previewUrl: string | null;
  script: ScriptParts | null;
  images: { [key: string]: GeneratedImage };
  visualFormat?: { [key: string]: string };
  videoPrompts: { [key: string]: VideoPromptState };
  imagePrompts?: { [key: string]: VideoPromptState };
  outfitImages: { [key: string]: { url: string; loading: boolean } };
  isLoading: boolean;
  isBulkImageLoading?: boolean;
  isBulkPromptLoading?: boolean;
}

export interface VuaTvState {
  puzzle: string;
  answer: string;
  headerTitle: string;
  headerColor: string;
  titleFontSize: number;
  puzzleFontSize: number;
  faceFile: File | null;
  facePreview: string | null;
  faceDescription: string;
  imageStyle: 'Realistic' | '3D';
  regenNote: string;
  generatedImageUrl: string;
  isLoading: boolean;
  videoPrompt: string;
  isVideoPromptLoading: boolean;
  isVideoPromptVisible: boolean;
  imagePrompt?: string;
  isImagePromptLoading?: boolean;
  isImagePromptVisible?: boolean;
}

export interface DhbcPhrase {
  phrase: string;
  hint: string;
}

export interface DhbcState {
  phrase: string;
  hint: string;
  headerTitle: string;
  headerColor: string;
  headerFontSize: number;
  footerColor: string;
  faceFile: File | null;
  facePreview: string | null;
  faceDescription: string;
  imageStyle: 'Realistic' | '3D';
  regenNote: string;
  generatedImageUrl: string;
  isLoading: boolean;
  videoPrompt: string;
  isVideoPromptLoading: boolean;
  isVideoPromptVisible: boolean;
  suggestedPhrases: DhbcPhrase[];
  isSuggesting: boolean;
  imagePrompt?: string;
  isImagePromptLoading?: boolean;
  isImagePromptVisible?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
}

export interface ChatbotScene {
  id: number;
  content: string;
  action: string;
}

export interface ChatbotStudioState {
  messages: ChatMessage[];
  scenes: ChatbotScene[];
  isProcessing: boolean;
  attachedImage: string | null;
  attachedImages: string[];
  attachedVideo: string | null;
  attachedVideoType: string | null;
  videoPreviewUrl: string | null;
  mode: 'script' | 'image' | 'translate';
  voice?: string;
  gender?: string;
  addressing?: string;
}

export interface CameraState {
  azimuth: number;
  elevation: number;
  distance: number;
}

export interface AdvancedSettings {
  seed: number;
  randomizeSeed: boolean;
  width: number;
  height: number;
  guidanceScale: number;
  inferenceSteps: number;
}

export interface Mapping {
  [key: string]: string;
}
