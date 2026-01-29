# Kids Book Studio - Product Requirements Document

## Overview
A web application that generates personalized children's books with **strict character consistency**. Parents upload their child's photo, the system extracts a structured character profile, then generates an illustrated storybook featuring their child as the main character with the same appearance across all pages.

## Problem Statement
Personalized children's books (like Wonderbly) are expensive ($30-50) and take weeks to produce. By leveraging AI image generation with IP-Adapter for face consistency, we can offer faster, cheaper personalized books while maintaining quality and character recognition across all illustrations.

## Target Users
- Parents of children ages 2-8
- Gift buyers (grandparents, relatives)
- Initially: tech-savvy early adopters comfortable with AI-generated content

---

## Key Invariants (Must Enforce)
- **Same character reference image** for ALL pages (original photo as IP-Adapter reference)
- **Same character description** (immutable once approved by user)
- **Same global style prompt** for all illustrations
- **Fixed page count and layouts**
- **No per-page creative freedom** that alters character identity

---

## MVP Features

### Core Flow
1. **Upload**: Parent enters child's name + uploads reference photo
2. **Analyze**: AI extracts structured character profile from photo
3. **Approve**: User reviews/edits character description
4. **Storyboard**: Generate B&W sketch panels for composition approval
5. **Generate**: AI creates colored illustrations using approved sketches as guides
6. **Preview**: View complete book with per-page regeneration option
7. **Download**: Get print-ready PDF

### MVP Constraints
- 1 story template only ("{{name}}'s Big Adventure")
- 12 pages with illustrations
- PDF download only (no physical printing integration)
- No user accounts or payment
- Manual quality check only (user reviews each page)

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Image Gen | Replicate (IP-Adapter + SDXL) |
| Vision/LLM | Claude API (character analysis) |
| PDF | @react-pdf/renderer |
| Storage | Local filesystem (MVP) |
| Deployment | Vercel |

---

## Character Profile Schema

### Structured Character Description
```typescript
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
  distinctive_features: string[];  // freckles, dimples, glasses, etc.
  clothing: string;
  color_palette: string[];  // dominant colors for character
  personality_traits: string[];
  do_not_change: string[];  // identity anchors that must remain constant
}
```

### Rules for Profile Extraction
- Focus on recognizable traits only
- Avoid background details
- `do_not_change` list = identity anchors (hair color, eye color, distinctive features)

---

## Story Template Structure (Enhanced)

### Storyboard Schema
```typescript
interface Storyboard {
  title: string;
  pages: Array<{
    page: number;
    scene: string;           // Visual scene description
    emotion: string;         // Character's emotional state
    action: string;          // What character is doing
    setting: string;         // Environment/background
    composition_hint: "wide" | "medium" | "close";
    text: string;            // Story text (max ~30 words)
    layout: "left_text" | "right_text" | "bottom_text" | "full_bleed";
  }>;
}
```

### Example story.json
```json
{
  "id": "adventure-story",
  "title": "{{name}}'s Big Adventure",
  "pages": [
    {
      "page": 1,
      "scene": "Child standing in backyard garden, looking curiously at a tiny door",
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

### Image Prompts (prompts.json)
```json
{
  "storyId": "adventure-story",
  "stylePrompt": "Soft children's book illustration, pastel colors, gentle watercolor texture, rounded shapes, thick but soft outlines, warm lighting, playful and calm mood.",
  "negativePrompt": "extra characters, inconsistent face, realistic photo, harsh shadows, busy background, cropped face, distorted anatomy, text, words, letters",
  "pages": [
    {
      "page": 1,
      "prompt": "exploring their backyard garden on a sunny day, flowers and butterflies around, discovering a tiny magical door"
    }
  ]
}
```

---

## User Interface

### Page 1: Home / Multi-Step Wizard
**Step 1 - Upload:**
- Text input for child's name
- Photo upload dropzone (accepts JPG/PNG/WebP)
- "Continue" button

**Step 2 - Character Description:**
- Show original photo
- Editable text area with AI-generated character description
- "Create Character" button

**Step 3 - Character Approval:**
- Side-by-side: original photo + character illustration
- "Regenerate" button for character
- "Create Book" button

### Page 2: Book Preview
- Page-by-page navigation with thumbnails
- Each page shows illustration + text in specified layout
- **Regenerate button per page** for quality control
- Loading state per page during regeneration
- "Download PDF" button

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload reference image |
| `/api/analyze` | POST | Extract character profile from photo |
| `/api/character-sheet` | POST | Generate character reference illustration |
| `/api/storyboard-panels` | POST | Generate all B&W storyboard panels |
| `/api/storyboard-panels/regenerate` | POST | Regenerate single storyboard panel |
| `/api/generate` | POST | Generate all page illustrations (uses storyboard as guide) |
| `/api/generate/page` | POST | Regenerate single page |
| `/api/pdf` | POST | Assemble final PDF |

---

## Image Generation Details

### IP-Adapter Configuration
- **Model**: `tencentarc/ip-adapter-face_sdxl` on Replicate
- **Reference Image**: Original photo (same for ALL pages)
- **IP-Adapter Scale**: 0.6-0.7 (balance face vs style)
- **Resolution**: 1024×768 (3:2 landscape)
- **Same negative prompt** for all pages

### Prompt Structure
```
[Character summary from profile]
In this scene: [scene + action]
Emotion: [emotion]
Setting: [setting]

Illustration style:
[global style prompt]

Composition:
[layout + composition_hint]
Leave clear empty space for text on [layout position].
```

---

## PDF Generation

### Layout Support
- `left_text` - Text on left, illustration on right
- `right_text` - Illustration on left, text on right
- `bottom_text` - Full-width illustration with text below
- `full_bleed` - Full-page illustration with text overlay

### Format
- Square format: 8.5" × 8.5" (612pt × 612pt)
- Consistent typography throughout
- Cover page + story pages + end page

---

## Success Metrics (Future)
- Time from upload to PDF ready: < 5 minutes
- User completion rate (start → download): > 60%
- Image generation success rate: > 95%
- **Character consistency score**: Same character recognizable across all pages

---

---

## Storyboard Feature

### Purpose
Create rough B&W composition sketches before generating full-color illustrations. This allows users to approve panel layouts and compositions at a lower cost before committing to final colored pages.

### Panel Requirements
- Black & white pencil sketch style
- Loose lines, simplified shapes
- Character outline using reference image
- Empty space reserved for text placement
- No text or borders on images

### Storyboard Panel Schema
```typescript
interface StoryboardPanel {
  page: number;
  scene: string;
  textPlacement: "left" | "right" | "bottom" | "top";
  sketchUrl?: string;
  approved: boolean;
}
```

### Storyboard Prompts
**Style Prompt:**
```
Rough pencil sketch, loose lines, simplified shapes,
BLACK AND WHITE ONLY, no color, children's book storyboard style,
simple character outline, minimal background detail
```

**Negative Prompt:**
```
color, vibrant, detailed, finished, polished,
text, words, letters, border, frame, complex shading
```

### img2img Generation
Approved B&W sketches are used as init_image for final colored page generation:
- `strength`: 0.75 (preserves composition while adding color/detail)
- `ip_adapter_image`: Character reference for face consistency
- Benefits: Composition matches approved sketch, character placement stays consistent

---

## Future Roadmap
1. **Multiple story templates** - different themes (space, underwater, dinosaurs)
2. **LLM-generated stories** - Custom stories based on theme/moral selection
3. **Print integration** - Lulu Direct API for physical book ordering
4. **Payment** - Stripe integration ($15-20 per book)
5. **User accounts** - Save books, reorder, track orders
6. **Style selection** - Choose illustration style (watercolor, cartoon, anime)
