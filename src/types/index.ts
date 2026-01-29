// Prop Bible types - for consistent object/environment descriptions
export interface Prop {
  description: string;
  appearances: number[];
}

export interface Environment {
  description: string;
  appearances: number[];
}

export interface PropBible {
  storyId: string;
  globalStyle?: string;           // Style prompt always included
  globalInstructions?: string;    // Additional instructions for every panel
  compositions?: Record<number, string>;  // Per-page camera angle/composition hints
  props: Record<string, Prop>;
  environments: Record<string, Environment>;
}

// Character Profile - extracted from reference photo
export interface CharacterProfile {
  character_name: string;
  approx_age: "toddler" | "young_child" | "older_child";
  gender_presentation: "boy" | "girl" | "neutral";
  hair: {
    color: string;
    length: string;
    texture: "straight" | "wavy" | "curly" | "coily";
    style: string;
  };
  face: {
    shape: "round" | "oval" | "heart";
    expression_default: string;
  };
  eyes: {
    color: string;
    shape: string;
  };
  skin_tone: string;
  distinctive_features: string[];
  clothing: string;
  color_palette: string[];
  personality_traits: string[];
  do_not_change: string[]; // identity anchors that must remain constant
}

// Story page with enhanced metadata for illustration
export interface StoryPage {
  page: number;
  scene: string;
  props?: string[];           // Prop keys from prop bible
  environment?: string;       // Environment key from prop bible
  emotion: string;
  action: string;
  setting: string;
  composition_hint: "wide" | "medium" | "close";
  text: string;
  layout: "left_text" | "right_text" | "bottom_text" | "full_bleed";
  imageUrl?: string;
}

// Complete story/storyboard
export interface Storyboard {
  id: string;
  title: string;
  ageRange?: string;
  pageCount?: number;
  pages: StoryPage[];
}

// Storyboard panel for B&W sketch composition approval
export interface StoryboardPanel {
  page: number;
  scene: string;
  textPlacement: "left" | "right" | "bottom" | "top";
  sketchUrl?: string;
  approved: boolean;
}

// Image prompts template
export interface PagePrompt {
  page: number;
  prompt: string;
}

export interface PromptsTemplate {
  storyId: string;
  stylePrompt: string;
  negativePrompt: string;
  pages: PagePrompt[];
}

// Book session - tracks the full creation process
export interface BookSession {
  id: string;
  childName: string;
  referenceImage: {
    path: string;
    publicUrl: string;
  };
  characterProfile?: CharacterProfile;
  characterDescription?: string;
  characterSheetUrl?: string;
  stylePrompt: string;
  storyboard?: Storyboard;
  storyboardPanels?: StoryboardPanel[];
  panelsApproved?: boolean;
  generatedImages: Record<number, string>;
  status: "upload" | "profile" | "character" | "storyboard" | "story" | "generating" | "complete";
}

// API response types
export interface UploadResponse {
  filePath: string;
  publicUrl: string;
  sessionId: string;
}

export interface AnalyzeResponse {
  profile: CharacterProfile;
  description: string;
}

export interface GenerateResponse {
  story: Storyboard;
  status: "processing" | "complete" | "error";
}

export interface RegeneratePageResponse {
  pageNumber: number;
  imageUrl: string;
}
