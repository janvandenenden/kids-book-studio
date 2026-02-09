import OpenAI from "openai";
import type {
  AgeRange,
  Phase0Concept,
  Phase1Storyboard,
  Phase1Spread,
  Phase2Manuscript,
  Phase2Spread,
  Phase4PropsBible,
  Phase5PanelBriefs,
  Phase5PanelBrief,
} from "@/types";

// Lazy initialization to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

const DEFAULT_STORY_MODEL = "gpt-4o";

// --- Role prompt prepended to all phases ---
const ROLE_PROMPT = `You are a veteran children's picture-book author and illustrator with 20+ years experience.
You write for ages 0–7. You understand pacing, page turns, read-aloud rhythm, and visual storytelling.
You think in spreads (double-page units) and always consider how text and illustration work together.
Your output must be precise, structured, and production-ready.`;

// --- Core generation function ---
async function generateStoryPhase(options: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    model = DEFAULT_STORY_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
  } = options;

  const response = await getOpenAI().chat.completions.create({
    model,
    messages: [
      { role: "system", content: `${ROLE_PROMPT}\n\n${systemPrompt}` },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  return content;
}

// --- JSON parsing helper ---
function parseJsonResponse<T>(content: string): T {
  let jsonStr = content.trim();
  // Strip markdown code fences
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
  }
  return JSON.parse(jsonStr) as T;
}

// ============================================
// Phase 0: Concept
// ============================================

export async function generatePhase0(input: {
  ageRange: AgeRange;
  theme?: string;
  revisionNotes?: string;
  model?: string;
}): Promise<Phase0Concept> {
  const systemPrompt = `You are generating a concept brief for a personalized children's picture book.

The protagonist will be personalized later (the child's name and appearance are added at book-creation time). Focus on the STORY concept — the world, the adventure, the emotional arc.

Given a target age range and optional theme/seed, produce a concept that includes:
- Emotional core: the central feeling or lesson
- Visual hook: the signature visual element that makes this story unique
- Tone & texture: the mood and style of the storytelling
- Comparable books: 2-3 existing picture books this is like
- What it's NOT: things to avoid

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "ageRange": "the age range",
  "theme": "the theme if provided",
  "emotionalCore": "1-2 sentences about the central emotional journey",
  "visualHook": "1-2 sentences about the signature visual element",
  "toneTexture": "1-2 sentences about mood and style",
  "comparableBooks": "2-3 comparable books with brief notes",
  "whatItsNot": "things this story avoids"
}`;

  let userPrompt = `Create a picture book concept for:
- Target age range: ${input.ageRange}`;

  if (input.theme) {
    userPrompt += `\n- Theme/seed: ${input.theme}`;
  }

  if (input.revisionNotes) {
    userPrompt += `\n\nREVISION NOTES (address these in your new version):\n${input.revisionNotes}`;
  }

  const raw = await generateStoryPhase({
    systemPrompt,
    userPrompt,
    model: input.model,
    temperature: 0.8,
  });

  const parsed = parseJsonResponse<Omit<Phase0Concept, "rawOutput">>(raw);

  return {
    ...parsed,
    ageRange: input.ageRange,
    theme: input.theme,
    rawOutput: raw,
  };
}

// ============================================
// Phase 1: Visual Storyboard
// ============================================

export async function generatePhase1(input: {
  concept: Phase0Concept;
  revisionNotes?: string;
  model?: string;
}): Promise<Phase1Storyboard> {
  const systemPrompt = `You are creating a visual storyboard for a children's picture book.

Given the concept brief, create a spread-by-spread storyboard with 10-14 spreads. Each spread is a double-page unit.

IMPORTANT: The protagonist is personalized later. Use the literal placeholder {{name}} (with double curly braces) wherever you refer to the protagonist by name in draftText. Do NOT invent a name.

For each spread, provide:
- spreadNumber: sequential number
- pageRange: e.g. "pp. 1-2", "pp. 3-4"
- draftText: the approximate text that will appear (keep under 40 words per spread for ages 0-3, under 60 for 3-5, under 80 for 5-7)
- visualFocus: what the reader's eye should land on
- emotionalBeat: the feeling at this moment
- pageTurnPull: what makes the reader want to turn the page
- energy: "Quiet" or "Dynamic"

Think carefully about pacing. The energy should rise and fall naturally. The emotional beats should build to a climax around spread 8-10 and then resolve.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "spreadCount": 12,
  "spreads": [
    {
      "spreadNumber": 1,
      "pageRange": "pp. 1-2",
      "draftText": "...",
      "visualFocus": "...",
      "emotionalBeat": "...",
      "pageTurnPull": "...",
      "energy": "Quiet"
    }
  ]
}`;

  let userPrompt = `Create a visual storyboard based on this concept:

${JSON.stringify(input.concept, null, 2)}`;

  if (input.revisionNotes) {
    userPrompt += `\n\nREVISION NOTES (address these in your new version):\n${input.revisionNotes}`;
  }

  const raw = await generateStoryPhase({
    systemPrompt,
    userPrompt,
    model: input.model,
    maxTokens: 4096,
  });

  const parsed = parseJsonResponse<{ spreadCount: number; spreads: Phase1Spread[] }>(raw);

  return {
    ...parsed,
    rawOutput: raw,
  };
}

// ============================================
// Phase 2+3: Manuscript (Phase 3 audit is embedded)
// ============================================

export async function generatePhase2(input: {
  concept: Phase0Concept;
  storyboard: Phase1Storyboard;
  revisionNotes?: string;
  model?: string;
}): Promise<Phase2Manuscript> {
  const systemPrompt = `You are writing the final manuscript for a children's picture book AND performing a quality audit.

Given the concept and storyboard, write polished final text for each spread.

CRITICAL — PROTAGONIST NAME:
The protagonist is personalized at book-creation time. You MUST use the literal placeholder {{name}} (exactly as written, with double curly braces) wherever the protagonist is referred to by name in finalText. Do NOT invent a name for the protagonist. For example: "{{name}} looked up at the stars" or "Come on!" said {{name}}."

WRITING RULES:
- Respect the word-count limits for the age range (0-3: max 40 words/spread, 3-5: max 60, 5-7: max 80)
- Read-aloud rhythm matters. Vary sentence length. Use repetition for young ages.
- Every spread must work as text + illustration together — don't describe what the picture shows
- Text drives emotion; illustration drives scene
- Always use {{name}} for the protagonist — never a real name

AUDIT (apply silently):
- Check pacing: energy should rise/fall naturally
- Check consistency: object references, {{name}} used for protagonist everywhere
- Check read-aloud quality: read each spread aloud mentally
- Fix any issues before outputting

For each spread, provide structured illustration guidance that the image generation system can parse.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "spreads": [
    {
      "spreadNumber": 1,
      "finalText": "The polished text for this spread",
      "illustrationNote": "scene: [brief scene]. emotion: [feeling]. action: [what's happening]. setting: [where]. composition: [wide|medium|close]. layout: [bottom_text|left_text|right_text|full_bleed].",
      "readAloudNote": "Optional note about rhythm or emphasis"
    }
  ]
}

IMPORTANT: The illustrationNote MUST follow the exact format above with labeled fields (scene:, emotion:, action:, setting:, composition:, layout:) so downstream systems can parse it.`;

  let userPrompt = `Write the final manuscript for this picture book.

CONCEPT:
${JSON.stringify(input.concept, null, 2)}

STORYBOARD:
${JSON.stringify(input.storyboard.spreads, null, 2)}`;

  if (input.revisionNotes) {
    userPrompt += `\n\nREVISION NOTES (address these in your new version):\n${input.revisionNotes}`;
  }

  const raw = await generateStoryPhase({
    systemPrompt,
    userPrompt,
    model: input.model,
    maxTokens: 4096,
  });

  const parsed = parseJsonResponse<{ spreads: Phase2Spread[] }>(raw);

  return {
    ...parsed,
    rawOutput: raw,
  };
}

// ============================================
// Phase 4: Props Bible
// ============================================

export async function generatePhase4(input: {
  concept: Phase0Concept;
  manuscript: Phase2Manuscript;
  revisionNotes?: string;
  model?: string;
}): Promise<Phase4PropsBible> {
  const systemPrompt = `You are creating a visual props bible for a children's picture book illustration pipeline.

This document ensures every object, character, and environment looks EXACTLY the same across all spreads.

IMPORTANT: Do NOT include the protagonist/main child character. The protagonist is personalized at book-creation time using a child's photo — they appear as an abstract outline in storyboard panels. Only describe supporting characters, objects, environments, and motifs.

CRITICAL: Do NOT use the protagonist's name anywhere in your output — not in descriptions, not in styleNotes, nowhere. The protagonist has no fixed name. Refer to them only as "the protagonist" or "the child" if you must reference them at all.

From the concept and manuscript, extract and describe:

1. SUPPORTING CHARACTERS: Any non-protagonist characters with full visual descriptions and which spreads they appear in
2. KEY OBJECTS: Every significant object with exact visual details, which spreads, and any state changes
3. ENVIRONMENTS: Every distinct location with color palette, lighting, and features
4. VISUAL MOTIFS: Recurring visual elements that tie the story together
5. STYLE NOTES: Overall illustration style guidance

Be extremely specific with colors (use descriptive terms like "soft mint-green" not just "green"), sizes, shapes, and textures. An illustrator should be able to draw any item from your description alone.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "supportingCharacters": [
    { "name": "...", "description": "detailed visual description", "appearsInSpreads": [1, 3, 5] }
  ],
  "keyObjects": [
    { "name": "...", "description": "exact visual details", "appearsInSpreads": [2, 4], "stateChanges": "optional: how it changes" }
  ],
  "environments": [
    { "name": "...", "description": "detailed setting", "usedInSpreads": [1, 2, 3], "colorPalette": ["soft blue", "warm cream"], "lightSource": "warm morning sun from the left" }
  ],
  "visualMotifs": [
    { "motif": "...", "purpose": "...", "appearsInSpreads": [1, 6, 12] }
  ],
  "styleNotes": "Overall style guidance paragraph"
}`;

  let userPrompt = `Create a visual props bible for this picture book.

CONCEPT:
${JSON.stringify(input.concept, null, 2)}

MANUSCRIPT (spreads with illustration notes):
${JSON.stringify(input.manuscript.spreads, null, 2)}`;

  if (input.revisionNotes) {
    userPrompt += `\n\nREVISION NOTES (address these in your new version):\n${input.revisionNotes}`;
  }

  const raw = await generateStoryPhase({
    systemPrompt,
    userPrompt,
    model: input.model,
    maxTokens: 4096,
    temperature: 0.5,
  });

  const parsed = parseJsonResponse<Omit<Phase4PropsBible, "rawOutput">>(raw);

  return {
    ...parsed,
    rawOutput: raw,
  };
}

// ============================================
// Phase 5: Panel Briefs
// ============================================

export async function generatePhase5(input: {
  manuscript: Phase2Manuscript;
  propsBible: Phase4PropsBible;
  revisionNotes?: string;
  model?: string;
}): Promise<Phase5PanelBriefs> {
  const systemPrompt = `You are creating detailed panel briefs for an AI image generation pipeline (Google Nano Banana).

For EACH spread, create a comprehensive panel brief that an image generation AI can use to produce a consistent illustration.

The brief must reference the props bible for exact visual descriptions — copy the relevant descriptions verbatim, don't paraphrase.

For each panel, provide:
- composition: Camera angle, shot type (wide/medium/close-up), focal point, depth of field, negative space for text
- charactersInFrame: Position, pose, expression, outfit state, gaze direction
- environment: Location name, lighting direction and color, palette, weather, key features
- objectsInFrame: Each object with position and visual state (reference props bible descriptions)
- emotionalDirection: The mood, what the art should communicate beyond the text
- continuityNotes: What changed from the previous panel, what carries to the next
- imagePrompt: A DENSE single paragraph prompt optimized for Nano Banana image generation. Include character description, scene, objects, lighting, style, composition, and mood. This should be self-contained — the image generator only sees this paragraph.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "panels": [
    {
      "spreadNumber": 1,
      "manuscriptText": "The text from the manuscript for this spread",
      "composition": "...",
      "charactersInFrame": "...",
      "environment": "...",
      "objectsInFrame": "...",
      "emotionalDirection": "...",
      "continuityNotes": "...",
      "imagePrompt": "Dense single-paragraph prompt for image generation..."
    }
  ]
}`;

  let userPrompt = `Create panel briefs for each spread of this picture book.

MANUSCRIPT:
${JSON.stringify(input.manuscript.spreads, null, 2)}

PROPS BIBLE:
${JSON.stringify({
    supportingCharacters: input.propsBible.supportingCharacters,
    keyObjects: input.propsBible.keyObjects,
    environments: input.propsBible.environments,
    visualMotifs: input.propsBible.visualMotifs,
    styleNotes: input.propsBible.styleNotes,
  }, null, 2)}

CRITICAL — PROTAGONIST PLACEHOLDER:
The protagonist is represented as a FEATURELESS WHITE OUTLINE SILHOUETTE in the storyboard panels. In all fields (composition, charactersInFrame, emotionalDirection, imagePrompt):
- Refer to the protagonist ONLY as "the white outline placeholder" or "the placeholder figure"
- Do NOT describe any facial features, expressions, eyes, hair, skin, or clothing for the protagonist
- Only describe the protagonist's BODY POSITION and POSE (standing, seated, reaching, running, etc.)
- Do NOT invent a name for the protagonist — the name is personalized later
- Supporting characters CAN have full visual descriptions`;

  if (input.revisionNotes) {
    userPrompt += `\n\nREVISION NOTES (address these in your new version):\n${input.revisionNotes}`;
  }

  const raw = await generateStoryPhase({
    systemPrompt,
    userPrompt,
    model: input.model,
    maxTokens: 8192,
    temperature: 0.5,
  });

  const parsed = parseJsonResponse<{ panels: Phase5PanelBrief[] }>(raw);

  // Carry manuscript text to each panel if not already present
  for (const panel of parsed.panels) {
    if (!panel.manuscriptText) {
      const spread = input.manuscript.spreads.find(
        (s) => s.spreadNumber === panel.spreadNumber,
      );
      if (spread) {
        panel.manuscriptText = spread.finalText;
      }
    }
  }

  return {
    ...parsed,
    rawOutput: raw,
  };
}
