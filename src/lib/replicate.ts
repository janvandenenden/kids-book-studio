import Replicate from "replicate";
import type { StoryPage, StoryboardPanel, PropBible, Phase5PanelBrief } from "@/types";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Available models for image generation
export type ImageModel = "nano-banana" | "nano-banana-pro";

export const IMAGE_MODELS = {
  "nano-banana": {
    id: "google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8" as const,
    name: "Google Nano Banana (Budget)",
    description: "Good quality, cheaper for testing ($0.039/image)",
    supportsNegativePrompt: false,
    tier: "budget" as const,
  },
  "nano-banana-pro": {
    id: "google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3" as const,
    name: "Google Nano Banana Pro (Best)",
    description: "Highest quality illustrations with image reference",
    supportsNegativePrompt: false,
    tier: "premium" as const,
  },
};

// Default model - nano-banana-pro recommended for quality
const DEFAULT_MODEL: ImageModel = "nano-banana-pro";

// Global style for all illustrations - ensures consistency
export const GLOBAL_STYLE_PROMPT = `Soft children's book illustration, pastel colors, gentle watercolor texture, rounded shapes, thick but soft outlines, warm lighting, playful and calm mood, storybook art style`;

// Negative prompt applied to ALL generations (for models that support it)
export const GLOBAL_NEGATIVE_PROMPT = `extra characters, multiple children, inconsistent face, realistic photo, harsh shadows, busy background, cropped face, distorted anatomy, text, words, letters, ugly, deformed, disfigured, blurry, bad anatomy, extra limbs, signature, watermark, scary, dark, violent`;

// Storyboard style for B&W sketch panels - composition focus
export const STORYBOARD_STYLE_PROMPT = `loose sketch, soft shapes, simplified forms, low detail, black and white only, no text, no border, minimal background`;

// Path to the child outline image used as img2img input for storyboard panels
export const STORYBOARD_OUTLINE_PATH = "/outline-2.png";

// Storyboard negative prompt - excludes color, text, borders
export const STORYBOARD_NEGATIVE_PROMPT = `color, vibrant, colorful, detailed, finished, polished, text, words, letters, border, frame, complex shading, realistic, photorealistic, saturated, border`;

// Rate limiting: wait between API calls to avoid 429 errors
// Replicate limits to 6 requests/minute with low credit balance
export const RATE_LIMIT_DELAY_MS = 12000; // 12 seconds between requests (safe for 6/min limit)

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a local path to a format Replicate can access
 * - Remote URLs (http/https): pass through unchanged
 * - Local paths: convert to base64 data URI (since Replicate can't access localhost)
 *
 * Note: This only works server-side (API routes). Client code should not call this.
 */
function toAccessibleUrl(urlOrPath: string): string {
  if (urlOrPath.startsWith("http") || urlOrPath.startsWith("data:")) {
    return urlOrPath; // Already a remote URL or data URI
  }

  // Server-side only: convert local path to base64 data URI
  // Using require() to avoid bundling fs/path for client
  if (typeof window !== "undefined") {
    // Client-side: just return the path (shouldn't reach here in normal use)
    console.warn("toAccessibleUrl called on client - returning path as-is");
    return urlOrPath;
  }

  try {
    // Dynamic require for server-side only
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");

    const publicDir = path.join(process.cwd(), "public");
    const filePath = path.join(publicDir, urlOrPath);

    if (!fs.existsSync(filePath)) {
      console.error(`Local file not found: ${filePath}`);
      throw new Error(`Local file not found: ${urlOrPath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");

    // Determine mime type from extension
    const ext = path.extname(urlOrPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };
    const mimeType = mimeTypes[ext] || "image/png";

    console.log(
      `Converted local file to base64: ${urlOrPath} (${Math.round(base64.length / 1024)}KB)`,
    );
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(
      `Failed to convert local file to base64: ${urlOrPath}`,
      error,
    );
    throw error;
  }
}

export interface GenerateImageParams {
  prompt: string;
  referenceImageUrl?: string; // Original photo for face reference
  negativePrompt?: string;
  model?: ImageModel;
}

export interface GenerationResult {
  pageNumber: number;
  imageUrl: string;
}

/**
 * Extract URL from Replicate output (handles strings, FileOutput, streams)
 */
async function extractImageUrl(output: unknown): Promise<string> {
  // If it's an array, get first element
  if (Array.isArray(output)) {
    output = output[0];
  }

  // If it's already a string URL, return it
  if (typeof output === "string") {
    return output;
  }

  // Handle FileOutput objects (they have a url() method or can be converted to string)
  if (output && typeof output === "object") {
    // Check for url() method (FileOutput)
    if (
      "url" in output &&
      typeof (output as { url: () => string }).url === "function"
    ) {
      return (output as { url: () => string }).url();
    }

    // Check for href property
    if (
      "href" in output &&
      typeof (output as { href: string }).href === "string"
    ) {
      return (output as { href: string }).href;
    }

    // Try toString() which FileOutput supports
    const str = output.toString();
    if (str && str.startsWith("http")) {
      return str;
    }
  }

  console.error("Invalid output type:", typeof output, output);
  throw new Error("No valid image URL in output");
}

/**
 * Generate illustration using selected model
 */
export async function generateImage({
  prompt,
  referenceImageUrl,
  model = DEFAULT_MODEL,
}: GenerateImageParams): Promise<string> {
  console.log(`Generating with ${model}:`, {
    prompt: prompt.slice(0, 100) + "...",
  });

  let output: unknown;

  if (model === "nano-banana-pro" || model === "nano-banana") {
    // Google Nano Banana models: with image reference support
    const input: Record<string, unknown> = {
      prompt: prompt,
      aspect_ratio: "3:2",
      output_format: "png",
    };

    // Pro version supports higher resolution and safety settings
    if (model === "nano-banana-pro") {
      input.resolution = "2K";
      input.safety_filter_level = "block_only_high";
    }

    // Add reference image if provided (convert local paths to full URLs)
    if (referenceImageUrl) {
      input.image_input = [toAccessibleUrl(referenceImageUrl)];
    }

    output = await replicate.run(IMAGE_MODELS[model].id, {
      input,
    });
  } else {
    // Fallback: Nano Banana Pro without reference
    output = await replicate.run(IMAGE_MODELS["nano-banana-pro"].id, {
      input: {
        prompt: prompt,
        aspect_ratio: "3:2",
        resolution: "2K",
        output_format: "png",
        safety_filter_level: "block_only_high",
      },
    });
  }

  const imageUrl = await extractImageUrl(output);
  console.log("Generated image:", imageUrl);
  return imageUrl;
}

/**
 * Build the full prompt for a page illustration
 */
export function buildPagePrompt(
  page: StoryPage,
  characterSummary: string,
  stylePrompt: string = GLOBAL_STYLE_PROMPT,
): string {
  const layoutHints: Record<string, string> = {
    left_text:
      "composition with main subject on the right side, empty space on left for text",
    right_text:
      "composition with main subject on the left side, empty space on right for text",
    bottom_text:
      "composition with main action in upper two-thirds, clear lower area for text",
    full_bleed: "full scene composition, evenly distributed",
  };

  const compositionHints: Record<string, string> = {
    wide: "wide shot showing full scene and environment",
    medium: "medium shot showing character and immediate surroundings",
    close: "close-up shot focusing on character's face and expression",
  };

  const parts = [
    // Character identity (from profile)
    `A ${characterSummary}`,
    // Scene and action
    `In this scene: ${page.scene}`,
    `Action: ${page.action}`,
    `Emotion: ${page.emotion}`,
    `Setting: ${page.setting}`,
    // Style
    `Style: ${stylePrompt}`,
    // Composition
    `Composition: ${compositionHints[page.composition_hint] || "medium shot"}`,
    layoutHints[page.layout] || "",
  ];

  return parts.filter(Boolean).join(". ") + ".";
}

/**
 * Generate character sheet / reference illustration
 * Transforms the photo into an illustrated children's book character
 */
export async function generateCharacterSheet(
  characterDescription: string,
  referenceImageUrl: string,
  model: ImageModel = DEFAULT_MODEL,
): Promise<string> {
  const prompt = `Full body portrait of a children's book illustration character, standing pose, head to toe visible. ${characterDescription}. Soft watercolor style, pastel colors, gentle rounded features, warm friendly expression, simple clean white background, storybook illustration style, suitable for a children's picture book. Keep the character recognizable but stylized as a hand-drawn illustration. Show complete outfit from head to shoes.`;

  return generateCharacterSheetImage({
    prompt,
    referenceImageUrl,
    model,
  });
}

/**
 * Generate character sheet with portrait aspect ratio (2:3)
 */
async function generateCharacterSheetImage({
  prompt,
  referenceImageUrl,
  model = DEFAULT_MODEL,
}: GenerateImageParams): Promise<string> {
  console.log(`Generating character sheet with ${model}:`, {
    prompt: prompt.slice(0, 100) + "...",
  });

  let output: unknown;

  if (model === "nano-banana-pro" || model === "nano-banana") {
    const input: Record<string, unknown> = {
      prompt: prompt,
      aspect_ratio: "2:3", // Portrait for full body
      output_format: "png",
    };

    if (model === "nano-banana-pro") {
      input.resolution = "2K";
      input.safety_filter_level = "block_only_high";
    }

    if (referenceImageUrl) {
      input.image_input = [toAccessibleUrl(referenceImageUrl)];
    }

    output = await replicate.run(IMAGE_MODELS[model].id, { input });
  } else {
    output = await replicate.run(IMAGE_MODELS["nano-banana-pro"].id, {
      input: {
        prompt: prompt,
        aspect_ratio: "2:3", // Portrait for full body
        resolution: "2K",
        output_format: "png",
        safety_filter_level: "block_only_high",
      },
    });
  }

  const imageUrl = await extractImageUrl(output);
  console.log("Generated character sheet:", imageUrl);
  return imageUrl;
}

/**
 * Generate all page illustrations for a book
 * Uses the SAME reference image for ALL pages to ensure character consistency
 * Includes rate limiting to avoid 429 errors
 */
export async function generateBookIllustrations(
  pages: StoryPage[],
  characterSummary: string,
  referenceImageUrl: string,
  stylePrompt: string = GLOBAL_STYLE_PROMPT,
  model: ImageModel = DEFAULT_MODEL,
  onProgress?: (current: number, total: number) => void,
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Rate limiting: wait between requests (skip for first request)
    if (i > 0) {
      console.log(
        `Rate limiting: waiting ${RATE_LIMIT_DELAY_MS / 1000}s before next request...`,
      );
      await delay(RATE_LIMIT_DELAY_MS);
    }

    try {
      console.log(
        `Generating page ${page.page} (${i + 1}/${pages.length}) with ${model}...`,
      );

      const prompt = buildPagePrompt(page, characterSummary, stylePrompt);

      const imageUrl = await generateImage({
        prompt,
        referenceImageUrl, // SAME reference for ALL pages
        model,
      });

      results.push({ pageNumber: page.page, imageUrl });

      // Report progress if callback provided
      if (onProgress) {
        onProgress(i + 1, pages.length);
      }
    } catch (error) {
      console.error(`Failed to generate page ${page.page}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Regenerate a single page (for quality control)
 * Still uses the SAME reference image
 */
export async function regeneratePage(
  page: StoryPage,
  characterSummary: string,
  referenceImageUrl: string,
  stylePrompt: string = GLOBAL_STYLE_PROMPT,
  model: ImageModel = DEFAULT_MODEL,
): Promise<string> {
  const prompt = buildPagePrompt(page, characterSummary, stylePrompt);

  return generateImage({
    prompt,
    referenceImageUrl,
    model,
  });
}

/**
 * Build prompt for B&W storyboard panel
 * Uses outline image as input - prompt focuses on scene and composition
 */
export function buildStoryboardPanelPrompt(page: StoryPage): string {
  const compositionHints: Record<string, string> = {
    wide: "wide shot showing full scene and environment",
    medium: "medium shot showing character and surroundings",
    close: "close-up shot focusing on character",
  };

  const layoutHints: Record<string, string> = {
    left_text: "main subject on the right side, empty space on left",
    right_text: "main subject on the left side, empty space on right",
    bottom_text: "main action in upper two-thirds, clear lower area",
    full_bleed: "balanced full scene composition",
  };

  const composition = compositionHints[page.composition_hint] || "medium shot";
  const layout = layoutHints[page.layout] || "";

  // Prompt focuses on placing the outline figure in the scene
  const prompt = `Place the outline from the input image into this scene: ${page.scene}. ${composition}. ${layout}. Style: ${STORYBOARD_STYLE_PROMPT}`;

  return prompt;
}

/**
 * Build prompt for B&W storyboard panel with prop bible descriptions
 * Injects consistent prop and environment descriptions for visual continuity
 */
export function buildStoryboardPanelPromptWithProps(
  page: StoryPage,
  propBible: PropBible,
): string {
  const defaultCompositionHints: Record<string, string> = {
    wide: "wide shot showing full scene and environment",
    medium: "medium shot showing character and surroundings",
    close: "close-up shot focusing on character",
  };

  const layoutHints: Record<string, string> = {
    left_text: "main subject on the right side, empty space on left",
    right_text: "main subject on the left side, empty space on right",
    bottom_text: "main action in upper two-thirds, clear lower area",
    full_bleed: "balanced full scene composition",
  };

  // Check for per-page composition from prop bible
  let compositionHint = "";
  if (propBible.compositions && propBible.compositions[page.page]) {
    compositionHint = propBible.compositions[page.page];
  }

  // Fall back to default composition hint if no prop bible override
  if (!compositionHint) {
    compositionHint =
      defaultCompositionHints[page.composition_hint] || "medium shot";
  }

  const layout = layoutHints[page.layout] || "";

  // Build prop descriptions from prop bible
  const propDescriptions: string[] = [];
  if (page.props && page.props.length > 0) {
    for (const propKey of page.props) {
      const prop = propBible.props[propKey];
      if (prop) {
        propDescriptions.push(prop.description);
      }
    }
  }

  // Get environment description from prop bible
  let environmentDescription = "";
  if (page.environment && propBible.environments[page.environment]) {
    environmentDescription =
      propBible.environments[page.environment].description;
  }

  // Build the enhanced prompt
  const parts: string[] = [
    `Place the outline from the input image into this scene: ${page.scene}`,
  ];

  // Add key objects if we have prop descriptions
  if (propDescriptions.length > 0) {
    parts.push(`Key objects: ${propDescriptions.join("; ")}`);
  }

  // Add environment description
  if (environmentDescription) {
    parts.push(`Environment: ${environmentDescription}`);
  }

  // Add composition hint (from scene group or default)
  parts.push(`Composition: ${compositionHint}`);

  // Add layout hint for text placement
  if (layout) {
    parts.push(layout);
  }

  // Add global instructions if present
  if (propBible.globalInstructions) {
    parts.push(propBible.globalInstructions);
  }

  // Add style from prop bible or fall back to default
  const stylePrompt = propBible.globalStyle || STORYBOARD_STYLE_PROMPT;
  parts.push(`Style: ${stylePrompt}`);

  return parts.join(". ") + ".";
}

/**
 * Generate a single B&W storyboard panel
 * Uses outline.png as input image for consistent character placement
 */
export async function generateStoryboardPanel(
  page: StoryPage,
  model: ImageModel = DEFAULT_MODEL,
): Promise<string> {
  const prompt = buildStoryboardPanelPrompt(page);

  console.log(
    `Generating storyboard panel ${page.page} with outline image:`,
    prompt.slice(0, 100) + "...",
  );

  // Use outline image as init_image for consistent character across panels
  return generateStoryboardPanelWithOutline({
    prompt,
    outlineImagePath: STORYBOARD_OUTLINE_PATH,
    model,
  });
}

/**
 * Generate a single B&W storyboard panel with prop bible
 * Uses consistent prop/environment descriptions for visual continuity
 * Note: Reference image chaining was removed as it caused panels to look too similar
 */
export async function generateStoryboardPanelWithProps(
  page: StoryPage,
  propBible: PropBible,
  model: ImageModel = DEFAULT_MODEL,
): Promise<string> {
  const prompt = buildStoryboardPanelPromptWithProps(page, propBible);

  console.log(
    `Generating storyboard panel ${page.page} with prop bible:`,
    prompt.slice(0, 150) + "...",
  );

  // Use outline image only - prop bible text descriptions handle consistency
  return generateStoryboardPanelWithOutline({
    prompt,
    outlineImagePath: STORYBOARD_OUTLINE_PATH,
    model,
  });
}

interface StoryboardPanelParams {
  prompt: string;
  outlineImagePath: string;
  model?: ImageModel;
}

/**
 * Generate storyboard panel using outline image as reference
 * The outline provides consistent character positioning across all panels
 */
async function generateStoryboardPanelWithOutline({
  prompt,
  outlineImagePath,
  model = DEFAULT_MODEL,
}: StoryboardPanelParams): Promise<string> {
  console.log(`Using outline image: ${outlineImagePath}`);

  let output: unknown;

  if (model === "nano-banana-pro" || model === "nano-banana") {
    // Convert local outline path to accessible URL (base64)
    const outlineUrl = toAccessibleUrl(outlineImagePath);

    const input: Record<string, unknown> = {
      prompt: prompt,
      aspect_ratio: "3:2",
      output_format: "png",
      // Use outline image as input reference
      image_input: [outlineUrl],
    };

    if (model === "nano-banana-pro") {
      input.resolution = "2K";
      input.safety_filter_level = "block_only_high";
    }

    console.log("Replicate storyboard input:", {
      model,
      prompt: prompt.slice(0, 100) + "...",
      outline_image: outlineImagePath,
    });

    output = await replicate.run(IMAGE_MODELS[model].id, { input });
  } else {
    // Fallback without outline
    output = await replicate.run(IMAGE_MODELS["nano-banana-pro"].id, {
      input: {
        prompt: prompt,
        aspect_ratio: "3:2",
        resolution: "2K",
        output_format: "png",
        safety_filter_level: "block_only_high",
      },
    });
  }

  const imageUrl = await extractImageUrl(output);
  console.log("Generated storyboard panel:", imageUrl);
  return imageUrl;
}

/**
 * Generate all storyboard panels for composition approval
 * Returns panels with sketchUrl populated
 * Includes rate limiting to avoid 429 errors
 * Uses outline.png as input for consistent character placement across all panels
 */
export async function generateAllStoryboardPanels(
  pages: StoryPage[],
  model: ImageModel = DEFAULT_MODEL,
  onProgress?: (current: number, total: number, panel: StoryboardPanel) => void,
): Promise<StoryboardPanel[]> {
  const panels: StoryboardPanel[] = [];

  const textPlacementMap: Record<string, "left" | "right" | "bottom" | "top"> =
    {
      left_text: "left",
      right_text: "right",
      bottom_text: "bottom",
      full_bleed: "bottom",
    };

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Rate limiting: wait between requests (skip for first request)
    if (i > 0) {
      console.log(
        `Rate limiting: waiting ${RATE_LIMIT_DELAY_MS / 1000}s before next request...`,
      );
      await delay(RATE_LIMIT_DELAY_MS);
    }

    try {
      console.log(
        `Generating storyboard panel ${page.page} (${i + 1}/${pages.length})...`,
      );

      const sketchUrl = await generateStoryboardPanel(page, model);

      const panel: StoryboardPanel = {
        page: page.page,
        scene: page.scene,
        textPlacement: textPlacementMap[page.layout] || "bottom",
        sketchUrl,
        approved: false,
      };

      panels.push(panel);

      // Report progress if callback provided
      if (onProgress) {
        onProgress(i + 1, pages.length, panel);
      }
    } catch (error) {
      console.error(`Failed to generate storyboard panel ${page.page}:`, error);
      throw error;
    }
  }

  return panels;
}

/**
 * Generate all storyboard panels with prop bible for visual consistency
 * Uses text-based prop/environment descriptions for consistency (no image chaining)
 * Returns panels with sketchUrl populated
 */
export async function generateAllStoryboardPanelsWithProps(
  pages: StoryPage[],
  propBible: PropBible,
  model: ImageModel = DEFAULT_MODEL,
  onProgress?: (current: number, total: number, panel: StoryboardPanel) => void,
): Promise<StoryboardPanel[]> {
  const panels: StoryboardPanel[] = [];

  const textPlacementMap: Record<string, "left" | "right" | "bottom" | "top"> =
    {
      left_text: "left",
      right_text: "right",
      bottom_text: "bottom",
      full_bleed: "bottom",
    };

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Rate limiting: wait between requests (skip for first request)
    if (i > 0) {
      console.log(
        `Rate limiting: waiting ${RATE_LIMIT_DELAY_MS / 1000}s before next request...`,
      );
      await delay(RATE_LIMIT_DELAY_MS);
    }

    try {
      console.log(
        `Generating storyboard panel ${page.page} (${i + 1}/${pages.length}) with prop bible...`,
      );

      const sketchUrl = await generateStoryboardPanelWithProps(
        page,
        propBible,
        model,
      );

      const panel: StoryboardPanel = {
        page: page.page,
        scene: page.scene,
        textPlacement: textPlacementMap[page.layout] || "bottom",
        sketchUrl,
        approved: false,
      };

      panels.push(panel);

      // Report progress if callback provided
      if (onProgress) {
        onProgress(i + 1, pages.length, panel);
      }
    } catch (error) {
      console.error(`Failed to generate storyboard panel ${page.page}:`, error);
      throw error;
    }
  }

  return panels;
}

export interface Img2ImgParams {
  prompt: string;
  initImageUrl: string;
  referenceImageUrl?: string;
  strength?: number;
  negativePrompt?: string;
  model?: ImageModel;
}

/**
 * Generate image using img2img approach
 * Uses an init image as the starting point and transforms it
 */
export async function generateImg2Img({
  prompt,
  initImageUrl,
  referenceImageUrl,
  strength = 0.75,
  model = DEFAULT_MODEL,
}: Img2ImgParams): Promise<string> {
  console.log(
    `Generating img2img with ${model}, strength=${strength}:`,
    prompt.slice(0, 100) + "...",
  );

  let output: unknown;

  if (model === "nano-banana-pro" || model === "nano-banana") {
    // Google Nano Banana models with image reference
    // Convert local paths to full URLs that Replicate can access
    const initUrl = toAccessibleUrl(initImageUrl);
    const refUrl = referenceImageUrl
      ? toAccessibleUrl(referenceImageUrl)
      : null;

    const input: Record<string, unknown> = {
      prompt: prompt,
      aspect_ratio: "3:2",
      output_format: "png",
      // Use both the init image (storyboard) and reference image (character)
      image_input: refUrl ? [initUrl, refUrl] : [initUrl],
    };

    if (model === "nano-banana-pro") {
      input.resolution = "2K";
      input.safety_filter_level = "block_only_high";
    }

    // Debug: log what we're sending
    console.log("Replicate input:", {
      model,
      prompt: prompt.slice(0, 100) + "...",
      image_input_count: (input.image_input as string[]).length,
      image_input_types: (input.image_input as string[]).map((url) =>
        url.startsWith("data:")
          ? "base64"
          : url.startsWith("http")
            ? "url"
            : "unknown",
      ),
    });

    output = await replicate.run(IMAGE_MODELS[model].id, { input });
  } else {
    // Fallback
    output = await replicate.run(IMAGE_MODELS["nano-banana-pro"].id, {
      input: {
        prompt: prompt,
        aspect_ratio: "3:2",
        resolution: "2K",
        output_format: "png",
        safety_filter_level: "block_only_high",
        image_input: [initImageUrl],
      },
    });
  }

  const imageUrl = await extractImageUrl(output);
  console.log("Generated img2img image:", imageUrl);
  return imageUrl;
}

/**
 * Build storyboard panel prompt from a Phase 5 panel brief
 * The imagePrompt is already a complete, dense prompt for Nano Banana
 * We append the storyboard style to keep B&W sketch output
 */
export function buildStoryboardPanelPromptFromPhase5(
  panelBrief: Phase5PanelBrief,
): string {
  return `${panelBrief.imagePrompt}. Style: ${STORYBOARD_STYLE_PROMPT}`;
}

/**
 * Generate a B&W storyboard panel from a Phase 5 panel brief
 */
export async function generateStoryboardPanelFromBrief(
  panelBrief: Phase5PanelBrief,
  model: ImageModel = DEFAULT_MODEL,
): Promise<string> {
  const prompt = buildStoryboardPanelPromptFromPhase5(panelBrief);

  console.log(
    `Generating storyboard panel ${panelBrief.spreadNumber} from Phase 5 brief:`,
    prompt.slice(0, 150) + "...",
  );

  return generateStoryboardPanelWithOutline({
    prompt,
    outlineImagePath: STORYBOARD_OUTLINE_PATH,
    model,
  });
}

// Simple prompt for combining storyboard + character
export const SIMPLE_STYLE_PROMPT =
  "Soft watercolor children's book illustration, pastel colors, gentle and warm";

/**
 * Generate final colored page from storyboard sketch
 * Uses the storyboard as composition reference and character sheet for face consistency
 *
 * Image 1: Storyboard sketch (scene composition, pose, layout)
 * Image 2: Character sheet (face/appearance to use for the placeholder figure)
 */
export async function generatePageFromStoryboard(
  page: StoryPage,
  storyboardSketchUrl: string,
  characterSummary: string,
  referenceImageUrl: string,
  stylePrompt: string = SIMPLE_STYLE_PROMPT,
  model: ImageModel = DEFAULT_MODEL,
): Promise<string> {
  // Combine storyboard composition with character appearance (including clothing)
  // characterSummary includes: age, gender, hair, eyes, skin, distinctive features, clothing
  const prompt = `Replace the placeholder figure in image 1 with the character from image 2: ${characterSummary}. ${stylePrompt}.`;

  console.log(`Generating page ${page.page}:`);
  console.log(`  Storyboard: ${storyboardSketchUrl}`);
  console.log(`  Character: ${referenceImageUrl}`);
  console.log(`  Character summary: ${characterSummary}`);
  console.log(`  Prompt: ${prompt.slice(0, 150)}...`);

  return generateImg2Img({
    prompt,
    initImageUrl: storyboardSketchUrl,
    referenceImageUrl,
    strength: 0.75,
    model,
  });
}
