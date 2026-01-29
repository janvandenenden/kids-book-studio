# Prop Bible Implementation Plan

## Problem
Storyboard panels are visually inconsistent because each panel's prompt describes props freshly, causing the AI model to reinvent them per page (different door designs, different garden styles, different owl appearances).

Current prompt structure:
```
Place the child outline from the input image into this scene: Child discovering a tiny magical door hidden behind garden shed...
```

## Solution
Create a "prop bible" - a reusable catalog of specific descriptions for objects, creatures, and environments that get injected into prompts consistently.

---

## Proposed Architecture

### 1. New File: `src/templates/adventure-story/prop-bible.json`

```json
{
  "storyId": "adventure-story",
  "props": {
    "magical_door": {
      "description": "a tiny arched wooden door about knee-height, with ornate golden swirling patterns carved into dark oak, small round golden doorknob, warm golden light glowing from crack beneath",
      "appearances": [2, 3, 11]
    },
    "garden_shed": {
      "description": "weathered wooden garden shed with peeling green paint, covered in climbing ivy and small white flowers, rustic planks, slightly crooked roof",
      "appearances": [2]
    },
    "wise_owl": {
      "description": "large friendly owl with soft brown and cream feathers, big round amber eyes, small curved beak, tufted ears",
      "appearances": [5, 6, 11]
    },
    "baby_dragon": {
      "description": "small cute baby dragon about cat-sized, soft mint-green scales, big round purple eyes with sparkles, tiny stubby wings, rounded snout, chubby legs",
      "appearances": [7, 8, 9, 10, 11]
    },
    "thornbush": {
      "description": "tangled bush with dark twisted branches and small sharp thorns, some dried leaves",
      "appearances": [7, 8]
    }
  },
  "environments": {
    "backyard_garden": {
      "description": "sunny suburban backyard with green lawn, colorful flowers (red tulips, yellow daisies, purple lavender), wooden fence, blue sky with fluffy clouds",
      "appearances": [1, 2, 12]
    },
    "magical_forest": {
      "description": "enchanted forest with tall ancient trees with gnarled trunks, soft dappled golden lighting through leaves, glowing blue and pink flowers on forest floor, small fireflies floating, moss-covered ground",
      "appearances": [4, 5, 6, 7, 8, 9, 10, 11]
    }
  },
  "sceneGroups": {
    "door_discovery": {
      "pages": [2, 3],
      "note": "Same angle on door, progressively closer"
    },
    "dragon_rescue": {
      "pages": [7, 8, 9],
      "note": "Same clearing, thornbush consistent"
    }
  }
}
```

### 2. Update: `src/templates/adventure-story/story.json`

Add prop/environment references to each page:

```json
{
  "page": 2,
  "scene": "Child discovering the magical door hidden behind the garden shed",
  "props": ["magical_door", "garden_shed"],
  "environment": "backyard_garden",
  "sceneGroup": "door_discovery",
  // ... existing fields
}
```

### 3. Update: `src/types/index.ts`

Add PropBible types and update StoryPage interface:

```typescript
// Prop Bible types
export interface Prop {
  description: string;
  appearances: number[];
}

export interface Environment {
  description: string;
  appearances: number[];
}

export interface SceneGroup {
  pages: number[];
  note: string;
}

export interface PropBible {
  storyId: string;
  props: Record<string, Prop>;
  environments: Record<string, Environment>;
  sceneGroups: Record<string, SceneGroup>;
}

// Update StoryPage interface
export interface StoryPage {
  page: number;
  scene: string;
  props?: string[];           // NEW: prop keys
  environment?: string;       // NEW: environment key
  sceneGroup?: string;        // NEW: scene group key
  emotion: string;
  action: string;
  setting: string;
  composition_hint: "wide" | "medium" | "close";
  text: string;
  layout: "left_text" | "right_text" | "bottom_text" | "full_bleed";
  imageUrl?: string;
}
```

### 4. Update: `src/lib/replicate.ts`

New function `buildStoryboardPanelPromptWithProps()` that:
- Loads prop bible
- Injects prop descriptions into prompt
- Injects environment descriptions
- Returns reference URL for scene continuity

**Enhanced prompt output:**
```
Place the child outline from the input image into this scene: Child discovering the magical door hidden behind the garden shed.
Key objects: a tiny arched wooden door about knee-height, with ornate golden swirling patterns...; weathered wooden garden shed with peeling green paint...
Environment: sunny suburban backyard with green lawn, colorful flowers...
medium shot. main subject on the left side, empty space on right.
Style: loose sketch, soft shapes...
```

### 5. Scene Group Reference Chaining

For sequential shots in same sceneGroup:
- Use previous panel's image as additional reference input
- Maintains environment consistency (zoom in, change angle, keep props)

### 6. API Updates

- `/api/storyboard-panels/route.ts` - Use prop bible in generation
- `/api/storyboard-panels/regenerate/route.ts` - Use prop bible for single panel

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/templates/adventure-story/prop-bible.json` | CREATE |
| `src/templates/adventure-story/story.json` | MODIFY - add prop/env/sceneGroup refs |
| `src/types/index.ts` | MODIFY - add PropBible types |
| `src/lib/replicate.ts` | MODIFY - add prop-aware prompt builder |
| `src/lib/story-template.ts` | MODIFY - add prop bible loader |
| `src/app/api/storyboard-panels/route.ts` | MODIFY - integrate prop bible |
| `src/app/api/storyboard-panels/regenerate/route.ts` | MODIFY - integrate prop bible |

---

## Verification

1. Generate storyboard panels with prop bible enabled
2. Verify prompts contain injected prop descriptions (check console logs)
3. Compare visual consistency of door/owl/dragon across panels
4. Test scene group reference chaining for pages 2-3 and 7-8-9

---

## Decisions (from user input)

1. **Prop definitions**: Pre-populate with sensible defaults (door, owl, dragon, environments, etc.)
   - Note: Future story generation flow will auto-generate prop bibles per story

2. **Scene group chaining**: Both automatic AND manual
   - Auto-chain panels in same sceneGroup by default
   - Add manual toggle in admin UI to override/enable for individual panels

3. **Admin UI**: Yes, add prop bible editor to /admin page

---

## Implementation Order

### Phase 1: Core Data Structures
1. Create `src/templates/adventure-story/prop-bible.json` with pre-populated props
2. Add PropBible types to `src/types/index.ts`
3. Update `src/templates/adventure-story/story.json` with prop/environment/sceneGroup references

### Phase 2: Prompt Builder
4. Add prop bible loader to `src/lib/story-template.ts`
5. Create `buildStoryboardPanelPromptWithProps()` in `src/lib/replicate.ts`
6. Add scene group continuity detection logic

### Phase 3: API Integration
7. Update `src/app/api/storyboard-panels/route.ts` to use prop bible
8. Update `src/app/api/storyboard-panels/regenerate/route.ts` to use prop bible
9. Add manual "use previous panel" option to regenerate endpoint

### Phase 4: Admin UI
10. Create `src/app/api/admin/prop-bible/route.ts` for CRUD operations
11. Add PropBibleEditor component to `src/app/admin/page.tsx`
    - View/edit props with descriptions
    - View/edit environments
    - View/edit scene groups
    - Preview how props inject into prompts

---

## Additional Files to Create

| File | Action |
|------|--------|
| `src/app/api/admin/prop-bible/route.ts` | CREATE - API for prop bible CRUD |
| `src/components/PropBibleEditor.tsx` | CREATE - Admin UI component |
