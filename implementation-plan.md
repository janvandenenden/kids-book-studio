# Implementation Plan - Kids Book Studio

## Overview
This plan implements a personalized children's book generator with **strict character consistency** using IP-Adapter for face preservation across all illustrations.

---

## Phase 1: Character Grounding (Image → Canonical Spec)

### 1.1 Ingest Reference Image
**API:** `POST /api/upload`

**Input:** One character image (photo)

**Implementation:**
```typescript
// src/app/api/upload/route.ts
- Accept multipart form data
- Validate image (type: jpg/png/webp, size < 10MB)
- Save to public/uploads/{uuid}.{ext}
- Return { filePath, sessionId }
```

### 1.2 Extract Structured Character Profile
**API:** `POST /api/analyze`

Use Claude vision to convert image into canonical character spec.

**Output Schema:**
```typescript
// src/lib/character-profile.ts
interface CharacterProfile {
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
  do_not_change: string[];  // identity anchors
}
```

**Implementation:**
```typescript
// src/app/api/analyze/route.ts
- Load image from filePath
- Send to Claude with vision prompt
- Parse structured JSON response
- Return { profile, description }
```

**Claude Prompt for Analysis:**
```
Analyze this child's photo and extract a detailed character description for creating consistent children's book illustrations.

Return a JSON object with these exact fields:
- character_name: (use provided name)
- approx_age: "toddler" | "young_child" | "older_child"
- gender_presentation: "boy" | "girl" | "neutral"
- hair: { color, length, texture, style }
- face: { shape, expression_default }
- eyes: { color, shape }
- skin_tone: descriptive term
- distinctive_features: array of notable features (freckles, dimples, glasses)
- clothing: what they're wearing
- color_palette: dominant colors associated with character
- do_not_change: list of identity anchors that must remain constant

Focus only on recognizable visual traits. Ignore background details.
```

---

## Phase 2: Story System

### 2.1 Story Template Format (Enhanced)
**Files:**
- `src/templates/adventure-story/story.json`
- `src/templates/adventure-story/prompts.json`

**story.json structure:**
```json
{
  "id": "adventure-story",
  "title": "{{name}}'s Big Adventure",
  "ageRange": "4-6",
  "pageCount": 12,
  "pages": [
    {
      "page": 1,
      "scene": "Child standing in backyard garden looking at tiny door",
      "emotion": "curious, excited",
      "action": "discovering the door",
      "setting": "sunny backyard garden with flowers",
      "composition_hint": "wide",
      "text": "Once upon a time, there was a curious child named {{name}} who loved to explore.",
      "layout": "bottom_text"
    }
  ]
}
```

**prompts.json structure:**
```json
{
  "storyId": "adventure-story",
  "stylePrompt": "Soft children's book illustration, pastel colors, gentle watercolor texture, rounded shapes, thick but soft outlines, warm lighting, playful and calm mood",
  "negativePrompt": "extra characters, inconsistent face, realistic photo, harsh shadows, busy background, cropped face, distorted anatomy, text, words, letters, ugly, deformed",
  "pages": [
    {
      "page": 1,
      "prompt": "exploring backyard garden on sunny day, flowers and butterflies, discovering tiny magical door behind shed"
    }
  ]
}
```

### 2.2 Template Loader
```typescript
// src/lib/story-template.ts
- loadStoryTemplate(): { story, prompts }
- replacePlaceholders(text: string, name: string): string
- generateStory(name: string): Story
- getImagePrompts(): PromptsTemplate
- buildPagePrompt(page, characterProfile, stylePrompt): string
```

---

## Phase 3: Character Sheet Generation

### 3.1 Generate Character Reference Illustration
**API:** `POST /api/character-sheet`

Creates a single illustration of the character for user approval before generating the full book.

**Implementation:**
```typescript
// src/app/api/character-sheet/route.ts
- Input: { characterDescription, childName }
- Build prompt: "children's book character portrait, [description], friendly smile, soft watercolor style"
- Call Replicate IP-Adapter with original photo as reference
- Return { characterSheetUrl }
```

---

## Phase 3.5: Storyboard Panels

### 3.5.1 Storyboard Panel Generation
**API:** `POST /api/storyboard-panels`

Generates B&W composition sketches for user approval before final colored pages.

**Implementation:**
```typescript
// src/app/api/storyboard-panels/route.ts
- Input: { childName, characterDescription, characterSheetUrl, model, pageLimit }
- Generate B&W sketch for each page
- Return { panels: StoryboardPanel[], storyboard }
```

**Storyboard Style Prompt:**
```
Rough pencil sketch, loose lines, simplified shapes,
BLACK AND WHITE ONLY, no color, children's book storyboard style,
simple character outline, minimal background detail
```

**Storyboard Negative Prompt:**
```
color, vibrant, colorful, detailed, finished, polished,
text, words, letters, border, frame, complex shading
```

### 3.5.2 Single Panel Regeneration
**API:** `POST /api/storyboard-panels/regenerate`

```typescript
// src/app/api/storyboard-panels/regenerate/route.ts
- Input: { pageNumber, pageData, characterDescription, characterSheetUrl, model }
- Regenerate single B&W panel
- Return { panel: StoryboardPanel }
```

### 3.5.3 Storyboard UI Components
**Files:**
- `src/components/StoryboardPanel.tsx` - Individual panel card
- `src/components/StoryboardCreator.tsx` - Grid view with approval workflow

### 3.5.4 Storyboard Page
**File:** `src/app/create-storyboard/page.tsx`

User reviews B&W panels, approves/regenerates each one, then continues to final generation.

---

## Phase 4: Page-by-Page Illustration Generation

### 4.1 IP-Adapter Setup
**File:** `src/lib/replicate.ts`

**Model:** `tencentarc/ip-adapter-face_sdxl` or `lucataco/ip-adapter-faceid-sdxl`

**Locked Parameters (same for ALL pages):**
- `ip_adapter_scale`: 0.6-0.7
- Resolution: 1024×768 (3:2 landscape)
- Same negative prompt
- Same reference image (original photo)

### 4.2 Build Image Prompt
**Prompt Structure:**
```
[Character summary from profile]
In this scene: [scene + action]
Emotion: [emotion]
Setting: [setting]

Illustration style:
[global style prompt]

Composition:
[composition_hint] shot
Leave clear empty space for text on [layout position].
```

### 4.3 Generate All Pages
**API:** `POST /api/generate`

```typescript
// src/app/api/generate/route.ts
- Input: { childName, photoPath, characterDescription, storyboardPanels? }
- Load story template
- For each page:
  - If storyboard panel exists: use img2img with sketch as init_image
  - Otherwise: generate from scratch with IP-Adapter
  - Store result URL
- Return { story with imageUrls, status }
```

**img2img Parameters (when using storyboard):**
```typescript
{
  prompt: finalColoredPrompt,
  initImageUrl: storyboardPanel.sketchUrl,  // B&W sketch as base
  strength: 0.75,  // Preserve composition while adding color
  referenceImageUrl: characterSheetUrl,  // Face reference
}
```

### 4.4 Regenerate Single Page
**API:** `POST /api/generate/page`

```typescript
// src/app/api/generate/page/route.ts
- Input: { pageNumber, photoPath, characterDescription, pageData }
- Build same prompt structure
- Call Replicate with same parameters
- Return { pageNumber, newImageUrl }
```

---

## Phase 5: Book Assembly & PDF

### 5.1 PDF Generator with Layout Support
**File:** `src/lib/pdf-generator.tsx`

**Layouts to support:**
- `left_text` - Text on left (40%), illustration on right (60%)
- `right_text` - Illustration on left (60%), text on right (40%)
- `bottom_text` - Full-width illustration (70%), text below (30%)
- `full_bleed` - Full-page illustration with text overlay

**Implementation:**
```typescript
export function BookPDF({ story }: BookPDFProps) {
  return (
    <Document>
      <Page size={[612, 612]} style={styles.coverPage}>
        <Text style={styles.coverTitle}>{story.title}</Text>
      </Page>

      {story.pages.map((page) => (
        <Page key={page.pageNumber} size={[612, 612]} style={styles.page}>
          {renderLayout(page)}
        </Page>
      ))}

      <Page size={[612, 612]} style={styles.endPage}>
        <Text>The End</Text>
      </Page>
    </Document>
  );
}

function renderLayout(page: StoryPage) {
  switch (page.layout) {
    case 'bottom_text':
      return <BottomTextLayout page={page} />;
    case 'left_text':
      return <LeftTextLayout page={page} />;
    case 'right_text':
      return <RightTextLayout page={page} />;
    case 'full_bleed':
      return <FullBleedLayout page={page} />;
  }
}
```

### 5.2 PDF Download Endpoint
**API:** `POST /api/pdf`

```typescript
// src/app/api/pdf/route.ts
- Input: { story with imageUrls }
- Render BookPDF component
- Return PDF as blob download
```

---

## Phase 6: UI Components

### 6.1 Multi-Step Book Form
**File:** `src/components/BookForm.tsx`

**Steps:**
1. Upload - Name + photo input
2. Description - Review/edit character description
3. Character - Approve character illustration

**State:**
```typescript
type Step = "upload" | "description" | "character";
const [step, setStep] = useState<Step>("upload");
const [childName, setChildName] = useState("");
const [photo, setPhoto] = useState<File | null>(null);
const [characterDescription, setCharacterDescription] = useState("");
const [characterSheetUrl, setCharacterSheetUrl] = useState<string | null>(null);
```

### 6.2 Book Preview with Per-Page Regeneration
**File:** `src/components/BookPreview.tsx`

**Features:**
- Page navigation (prev/next + thumbnails)
- Display page with correct layout
- Regenerate button per page
- Loading state per page
- Download PDF button

```typescript
interface BookPreviewProps {
  story: Story;
  photoPath: string;
  characterDescription: string;
  onDownload: () => void;
  isDownloading: boolean;
}

// Per-page regeneration
const handleRegeneratePage = async (pageNumber: number) => {
  setRegeneratingPage(pageNumber);
  const response = await fetch('/api/generate/page', {
    method: 'POST',
    body: JSON.stringify({ pageNumber, photoPath, characterDescription, pageData: story.pages[pageNumber] })
  });
  // Update story with new image
};
```

### 6.3 Page Spread Component
**File:** `src/components/PageSpread.tsx`

Renders a single page with the correct layout based on `page.layout` field.

---

## File Structure

```
kids-book-studio/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing + BookForm
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── create-storyboard/
│   │   │   └── page.tsx                # Storyboard review page
│   │   ├── preview/
│   │   │   └── page.tsx                # Book preview page
│   │   └── api/
│   │       ├── upload/route.ts         # Photo upload
│   │       ├── analyze/route.ts        # Character profile extraction
│   │       ├── character-sheet/route.ts # Character illustration
│   │       ├── storyboard-panels/
│   │       │   ├── route.ts            # Generate all B&W panels
│   │       │   └── regenerate/route.ts # Regenerate single panel
│   │       ├── generate/route.ts       # Generate all pages (with img2img)
│   │       ├── generate/
│   │       │   └── page/route.ts       # Regenerate single page
│   │       └── pdf/route.ts            # PDF generation
│   ├── components/
│   │   ├── ui/                         # shadcn components
│   │   ├── BookForm.tsx                # Multi-step wizard
│   │   ├── BookPreview.tsx             # Preview with regeneration
│   │   ├── PageSpread.tsx              # Single page layout
│   │   ├── StoryboardPanel.tsx         # Individual storyboard panel card
│   │   ├── StoryboardCreator.tsx       # Storyboard grid with approval
│   │   └── CharacterProfileEditor.tsx  # (future) Profile editing
│   ├── lib/
│   │   ├── replicate.ts                # IP-Adapter image generation
│   │   ├── llm.ts                      # Claude API for analysis
│   │   ├── pdf-generator.tsx           # PDF with layouts
│   │   ├── story-template.ts           # Template loader
│   │   ├── character-profile.ts        # Profile schema + validation
│   │   └── utils.ts
│   ├── templates/
│   │   └── adventure-story/
│   │       ├── story.json              # Enhanced story format
│   │       └── prompts.json            # Image prompts
│   └── types/
│       └── index.ts                    # TypeScript types
├── public/
│   └── uploads/                        # Uploaded photos
├── .env.local
├── CLAUDE.md
├── prd.md
├── implementation-plan.md
└── package.json
```

---

## Environment Variables

```bash
# .env.local
REPLICATE_API_TOKEN=your_replicate_token
ANTHROPIC_API_KEY=your_claude_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Task Checklist

### Phase 1: Character Grounding
- [x] Project setup (Next.js, shadcn, dependencies)
- [ ] POST /api/upload - Photo upload
- [ ] POST /api/analyze - Character profile extraction with Claude
- [ ] src/lib/character-profile.ts - Schema + validation

### Phase 2: Story System
- [ ] Create story.json with enhanced format
- [ ] Create prompts.json with style + page prompts
- [ ] Update story-template.ts for new format

### Phase 3: Character Sheet
- [ ] POST /api/character-sheet - Generate character illustration
- [ ] Update BookForm step 3 for character approval

### Phase 3.5: Storyboard Panels
- [x] Add StoryboardPanel type to types/index.ts
- [x] Add storyboard generation functions to replicate.ts
- [x] POST /api/storyboard-panels - Generate all B&W panels
- [x] POST /api/storyboard-panels/regenerate - Regenerate single panel
- [x] StoryboardPanel.tsx component
- [x] StoryboardCreator.tsx component
- [x] /create-storyboard page

### Phase 4: Image Generation
- [x] Update replicate.ts for IP-Adapter SDXL + img2img
- [x] POST /api/generate - Generate all pages (with storyboard support)
- [ ] POST /api/generate/page - Regenerate single page

### Phase 5: PDF
- [ ] Update pdf-generator.tsx with layout support
- [ ] POST /api/pdf - PDF download

### Phase 6: UI
- [ ] Update BookForm multi-step wizard
- [ ] Update BookPreview with per-page regeneration
- [ ] Update PageSpread for different layouts
- [ ] Preview page at /preview

### Testing
- [ ] End-to-end flow: upload → analyze → character → generate → PDF
- [ ] Character consistency across pages
- [ ] Per-page regeneration
- [ ] All layout types in PDF

---

## Verification Steps

1. **Upload photo** → verify saved to public/uploads
2. **Analyze** → verify structured CharacterProfile returned
3. **Character sheet** → verify illustration matches description
4. **Generate all pages** → verify character consistency (same face features)
5. **Check each page** → layout matches specification
6. **Regenerate page** → verify consistency maintained
7. **Download PDF** → verify text placement per layout type
