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
│   ├── admin/page.tsx              # Admin panel for storyboard management
│   ├── preview/page.tsx            # Book preview with per-page regeneration
│   └── api/
│       ├── upload/route.ts         # Photo upload
│       ├── analyze/route.ts        # Character profile extraction (Claude vision)
│       ├── character-sheet/route.ts # Generate character reference illustration
│       ├── admin/storyboard/route.ts # Admin: save/load storyboard JSON
│       ├── storyboard-panels/
│       │   ├── route.ts            # Generate all B&W storyboard panels
│       │   └── regenerate/route.ts # Regenerate single panel
│       ├── generate/route.ts       # Generate all page illustrations (with img2img)
│       ├── generate/page/route.ts  # Regenerate single page
│       └── pdf/route.ts            # PDF generation
├── components/
│   ├── BookForm.tsx                # Multi-step wizard (upload → description → character)
│   ├── StoryboardPanel.tsx         # Individual storyboard panel card (admin)
│   ├── StoryboardCreator.tsx       # Storyboard grid with approval (admin)
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
ADMIN_PASSWORD=your_admin_password  # Optional: protects /admin, leave empty for dev mode
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
   - Uses approved storyboard sketches as init_image (img2img)
   - strength: 0.75 (preserves composition while adding color)
   - Same reference image for face consistency
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

## Storyboard Feature

### Purpose
Create rough B&W composition sketches before generating full-color illustrations. Allows cheaper iteration and composition approval.

### Admin Flow (Storyboard Creation)
```
/admin
    → Select character type (boy/girl/child) and model
    → Generate B&W sketch panels (rate-limited: 12s between requests)
    → Review/approve each panel composition
    → Regenerate individual panels as needed
    → Save storyboard to templates/adventure-story/storyboard.json
```

### User Flow (Uses Pre-made Storyboard)
```
Home (/) → Upload → Analyze → Character Approval
    ↓
/preview
    → Loads pre-made storyboard from templates folder
    → Generate final colored pages (using approved sketches as guides)
    → Download PDF
```

### Panel Characteristics
- Black & white only (grayscale pencil sketch)
- Loose sketch, soft shapes, simplified forms, low detail
- Generic character outline (boy/girl/child)
- No reference image needed - just composition sketches

### Storyboard Prompt Structure
```
Create an image for a minimal video storyboard-style panel for the following scene:
[scene description]. Outline of a young [boy/girl/child].
Style: loose sketch, soft shapes, simplified forms, low detail, black and white
```

### img2img Generation
When storyboard panels are approved, final pages use img2img:
```typescript
{
  initImageUrl: storyboardPanel.sketchUrl,  // B&W sketch
  strength: 0.75,  // Preserve composition, add color/detail
  referenceImageUrl: characterSheetUrl,  // Face consistency
}
```

### Admin Authentication
Set `ADMIN_PASSWORD` in `.env.local` to enable password protection for /admin.
If not set, admin access is open (dev mode).
