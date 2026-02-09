import type { Phase5PanelBrief, Phase4PropsBible } from "@/types";

// Storyboard style for B&W sketch panels
export const STORYBOARD_STYLE_PROMPT =
  "loose sketch, soft shapes, simplified forms, low detail, black and white only, no text, no border, minimal background";

// The placeholder instruction — repeated for emphasis
const PLACEHOLDER_INSTRUCTION =
  "The protagonist is the WHITE BLANK OUTLINE from the input image. " +
  "Keep it as a featureless white silhouette — NO face, NO eyes, NO hair, NO skin color, NO clothing detail. " +
  "It is a plain white placeholder shape to be filled in later.";

export interface PromptBuildOptions {
  /**
   * When true (default): builds prompt for B&W storyboard panel generation.
   *   - Leads with PLACEHOLDER FIGURE instruction
   *   - Strips facial expressions from character staging
   *   - Uses "the white outline placeholder" language
   *   - Appends storyboard sketch style
   *
   * When false: builds prompt for final colored page (stored in prompts.json).
   *   - No placeholder section
   *   - Keeps full expression/gaze/pose details in CHARACTER_DIRECTION
   *   - Uses "the character" language
   *   - Only includes props bible styleNotes (no storyboard sketch style)
   */
  forStoryboard?: boolean;
}

/**
 * Strip references to specific child/protagonist names and descriptions.
 * For storyboard: replaces with "the white outline placeholder"
 * For final page: replaces with "the character"
 */
function sanitizeChildReferences(text: string, forStoryboard: boolean): string {
  const replacement = forStoryboard
    ? "the white outline placeholder"
    : "the character";

  return text.replace(
    /\b(the child|the boy|the girl|the kid|the little one|the young child|the protagonist|the main character|the child figure)\b/gi,
    replacement,
  );
}

/**
 * Strip facial expression and gaze descriptions from character staging.
 * Only used for storyboard panels — the placeholder outline has no face.
 */
function stripFacialDetails(text: string): string {
  let cleaned = text;

  // Remove sentences about expression, eyes, mouth, gaze, face
  cleaned = cleaned.replace(
    /[^.;]*\b(expression|eyes|mouth|gaze|gazing|facial|face|smil(e|es|ing)|grin(s|ning)?|frown(s|ing)?|look(s|ing) (at|toward|up|down)|wide[- ]?eyed)\b[^.;]*[.;]\s*/gi,
    "",
  );

  return cleaned.trim();
}

/**
 * Build a rich, structured prompt from Phase 5 panel brief + Phase 4 props bible.
 *
 * Two modes controlled by `options.forStoryboard`:
 * - Storyboard (default): featureless white outline, no expressions, B&W sketch style
 * - Final page (forStoryboard=false): full character direction with expression/gaze,
 *   stored in prompts.json for use during colored page generation
 */
export function buildStoryboardPanelPromptFromPhase5(
  panelBrief: Phase5PanelBrief,
  propsBible?: Phase4PropsBible,
  options?: PromptBuildOptions,
): string {
  const forStoryboard = options?.forStoryboard !== false; // default true
  const spreadNum = panelBrief.spreadNumber;
  const parts: string[] = [];

  // 0. Placeholder instruction — only for storyboard panels
  if (forStoryboard) {
    parts.push(`PLACEHOLDER FIGURE: ${PLACEHOLDER_INSTRUCTION}`);
  }

  // 1. Scene & Composition
  parts.push(`SCENE: ${sanitizeChildReferences(panelBrief.composition, forStoryboard)}`);

  // 2. Environment — use props bible description if available
  if (propsBible) {
    const env = propsBible.environments.find((e) =>
      e.usedInSpreads.includes(spreadNum),
    );
    if (env) {
      const palette = env.colorPalette.join(", ");
      const light = env.lightSource ? ` Lighting: ${env.lightSource}.` : "";
      parts.push(
        `ENVIRONMENT: ${env.name} — ${sanitizeChildReferences(env.description, forStoryboard)}. Color palette: ${palette}.${light}`,
      );
    } else {
      parts.push(
        `ENVIRONMENT: ${sanitizeChildReferences(panelBrief.environment, forStoryboard)}`,
      );
    }
  } else {
    parts.push(
      `ENVIRONMENT: ${sanitizeChildReferences(panelBrief.environment, forStoryboard)}`,
    );
  }

  // 3. Characters
  if (forStoryboard) {
    // Storyboard: only body position/pose, no face/expression
    const characterParts: string[] = [];
    const rawStaging = sanitizeChildReferences(panelBrief.charactersInFrame, true);
    const cleanStaging = stripFacialDetails(rawStaging);
    characterParts.push(
      `The white outline placeholder (featureless white silhouette, NO face, NO features)${cleanStaging ? `: ${cleanStaging}` : ""}`,
    );

    if (propsBible) {
      const supportingInSpread = propsBible.supportingCharacters.filter((c) =>
        c.appearsInSpreads.includes(spreadNum),
      );
      for (const char of supportingInSpread) {
        characterParts.push(`${char.name}: ${char.description}`);
      }
    }

    parts.push(`CHARACTERS: ${characterParts.join("; ")}`);
  } else {
    // Final page: full expression, gaze, pose — this is the real character
    const staging = sanitizeChildReferences(panelBrief.charactersInFrame, false);
    const characterParts: string[] = [staging];

    if (propsBible) {
      const supportingInSpread = propsBible.supportingCharacters.filter((c) =>
        c.appearsInSpreads.includes(spreadNum),
      );
      for (const char of supportingInSpread) {
        characterParts.push(`${char.name}: ${char.description}`);
      }
    }

    parts.push(`CHARACTER_DIRECTION: ${characterParts.join("; ")}`);
  }

  // 4. Objects — inject exact props bible descriptions
  if (propsBible) {
    const objectsInSpread = propsBible.keyObjects.filter((o) =>
      o.appearsInSpreads.includes(spreadNum),
    );
    if (objectsInSpread.length > 0) {
      const objDescs = objectsInSpread.map((o) => {
        let desc = `${o.name}: ${o.description}`;
        if (o.stateChanges) {
          desc += ` (${o.stateChanges})`;
        }
        return desc;
      });
      parts.push(`OBJECTS: ${objDescs.join("; ")}`);
    } else if (panelBrief.objectsInFrame) {
      parts.push(
        `OBJECTS: ${sanitizeChildReferences(panelBrief.objectsInFrame, forStoryboard)}`,
      );
    }
  } else if (panelBrief.objectsInFrame) {
    parts.push(
      `OBJECTS: ${sanitizeChildReferences(panelBrief.objectsInFrame, forStoryboard)}`,
    );
  }

  // 5. Visual motifs
  if (propsBible) {
    const motifsInSpread = propsBible.visualMotifs.filter((m) =>
      m.appearsInSpreads.includes(spreadNum),
    );
    if (motifsInSpread.length > 0) {
      const motifDescs = motifsInSpread.map(
        (m) => `${m.motif} (${m.purpose})`,
      );
      parts.push(`VISUAL MOTIFS: ${motifDescs.join("; ")}`);
    }
  }

  // 6. Emotional direction
  parts.push(
    `MOOD: ${sanitizeChildReferences(panelBrief.emotionalDirection, forStoryboard)}`,
  );

  // 7. Style
  const styleNotes = propsBible?.styleNotes
    ? sanitizeChildReferences(propsBible.styleNotes, forStoryboard)
    : "";

  if (forStoryboard) {
    const styleBase = styleNotes ? `${styleNotes}. ` : "";
    parts.push(`STYLE: ${styleBase}${STORYBOARD_STYLE_PROMPT}`);
  } else if (styleNotes) {
    parts.push(`STYLE: ${styleNotes}`);
  }

  return parts.join(". \n") + ".";
}
