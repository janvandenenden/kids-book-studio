# Kids Book Studio

Personalized children's book generator with **strict character consistency**. Parents upload child's photo → AI extracts structured character profile → generates illustrated story with consistent character across all pages → downloadable PDF.

## Key Invariants
- Same reference image (original photo) for ALL page generations
- Same character description (immutable once approved)
- Same global style prompt for all illustrations
- Fixed page count and layouts per story template

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Image Generation**: Replicate (IP-Adapter + SDXL) - face consistency via ip_adapter_image
- **Character Analysis**: OpenAI API (GPT-4o vision for profile extraction)
- **PDF**: @react-pdf/renderer
- **Storage**: Local filesystem (public/uploads) for MVP

## Project Structure
```
src/
├── app/
│   ├── page.tsx                    # Landing + multi-step BookForm
│   ├── preview/page.tsx            # Book preview with per-page regeneration
│   └── api/
│       ├── upload/route.ts         # Photo upload
│       ├── analyze/route.ts        # Character profile extraction (Claude vision)
│       ├── character-sheet/route.ts # Generate character reference illustration
│       ├── generate/route.ts       # Generate all page illustrations
│       ├── generate/page/route.ts  # Regenerate single page
│       └── pdf/route.ts            # PDF generation
├── components/
│   ├── BookForm.tsx                # Multi-step wizard (upload → description → character)
│   ├── BookPreview.tsx             # Preview with per-page regeneration
│   └── PageSpread.tsx              # Single page layout renderer
├── lib/
│   ├── replicate.ts                # IP-Adapter SDXL image generation
│   ├── llm.ts                      # Claude API for character analysis
│   ├── pdf-generator.tsx           # PDF with multiple layout support
│   ├── story-template.ts           # Template loading + placeholder replacement
│   └── character-profile.ts        # CharacterProfile schema + validation
├── templates/
│   └── adventure-story/
│       ├── story.json              # Enhanced format with scene/emotion/layout
│       └── prompts.json            # Style prompt + per-page prompts
└── types/
    └── index.ts                    # TypeScript interfaces
```

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Environment Variables
Required in `.env.local`:
```
REPLICATE_API_TOKEN=your_replicate_token
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Key Flows

### 1. Character Grounding
1. User enters name + uploads photo
2. POST /api/upload → saves to public/uploads/{uuid}.{ext}
3. POST /api/analyze → Claude vision extracts CharacterProfile
4. User reviews/edits description

### 2. Character Approval
1. POST /api/character-sheet → generates character illustration with IP-Adapter
2. User approves or regenerates character
3. Character description becomes immutable

### 3. Book Generation
1. POST /api/generate → generates all page illustrations
   - Same reference image for ALL pages
   - Same IP-Adapter scale (0.6-0.7)
   - Same style prompt
2. User previews each page
3. POST /api/generate/page → regenerate any page if needed

### 4. PDF Download
1. POST /api/pdf → assembles PDF with @react-pdf/renderer
2. Supports layouts: left_text, right_text, bottom_text, full_bleed

## Story Template Format

### story.json (Enhanced)
```json
{
  "id": "adventure-story",
  "title": "{{name}}'s Big Adventure",
  "pages": [{
    "page": 1,
    "scene": "Child in backyard discovering tiny door",
    "emotion": "curious, excited",
    "action": "discovering the door",
    "setting": "sunny backyard garden",
    "composition_hint": "wide",
    "text": "Once upon a time...",
    "layout": "bottom_text"
  }]
}
```

### prompts.json
```json
{
  "stylePrompt": "Soft children's book illustration, pastel colors, gentle watercolor...",
  "negativePrompt": "extra characters, inconsistent face, realistic photo...",
  "pages": [{ "page": 1, "prompt": "exploring backyard garden..." }]
}
```

## Image Generation (IP-Adapter)

### Model
`tencentarc/ip-adapter-face_sdxl` on Replicate

### Locked Parameters (ALL pages)
- `ip_adapter_scale`: 0.6-0.7
- Resolution: 1024×768 (3:2)
- Same negative prompt
- Same reference image

### Prompt Structure
```
[Character profile summary]
In this scene: [scene + action]
Emotion: [emotion]
Setting: [setting]
Style: [global style prompt]
Composition: [composition_hint], leave space for text on [layout position]
```

## CharacterProfile Schema
```typescript
interface CharacterProfile {
  character_name: string;
  approx_age: "toddler" | "young_child" | "older_child";
  gender_presentation: "boy" | "girl" | "neutral";
  hair: { color, length, texture, style };
  face: { shape, expression_default };
  eyes: { color, shape };
  skin_tone: string;
  distinctive_features: string[];
  do_not_change: string[];  // identity anchors
}
```

## PDF Layouts
- `bottom_text` - Full illustration top, text below
- `left_text` - Text left (40%), illustration right (60%)
- `right_text` - Illustration left (60%), text right (40%)
- `full_bleed` - Full-page illustration with text overlay
