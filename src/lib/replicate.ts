import Replicate from "replicate";
import type { StoryPage } from "@/types";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Available models for image generation
export type ImageModel = "ip-adapter" | "nano-banana" | "nano-banana-pro";

export const IMAGE_MODELS = {
  "ip-adapter": {
    id: "lucataco/ip_adapter-sdxl-face:226c6bf67a75a129b0f978e518fed33e1fb13956e15761c1ac53c9d2f898c9af" as const,
    name: "IP-Adapter (Face Reference)",
    description: "Uses face as reference, may look more photorealistic",
    supportsNegativePrompt: true,
    tier: "standard" as const,
  },
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
    if ("url" in output && typeof (output as { url: () => string }).url === "function") {
      return (output as { url: () => string }).url();
    }

    // Check for href property
    if ("href" in output && typeof (output as { href: string }).href === "string") {
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
  negativePrompt = GLOBAL_NEGATIVE_PROMPT,
  model = DEFAULT_MODEL,
}: GenerateImageParams): Promise<string> {
  console.log(`Generating with ${model}:`, { prompt: prompt.slice(0, 100) + "..." });

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

    // Add reference image if provided
    if (referenceImageUrl) {
      input.image_input = [referenceImageUrl];
    }

    output = await replicate.run(IMAGE_MODELS[model].id, {
      input,
    });
  } else if (model === "ip-adapter" && referenceImageUrl) {
    // IP-Adapter: Uses face reference for consistency
    // Lower scale = more stylized, less photorealistic
    output = await replicate.run(IMAGE_MODELS["ip-adapter"].id, {
      input: {
        image: referenceImageUrl,
        prompt: prompt,
        negative_prompt: negativePrompt,
        scale: 0.4, // Lower scale for more illustrated look
        num_outputs: 1,
        num_inference_steps: 30,
      },
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
  stylePrompt: string = GLOBAL_STYLE_PROMPT
): string {
  const layoutHints: Record<string, string> = {
    left_text: "composition with main subject on the right side, empty space on left for text",
    right_text: "composition with main subject on the left side, empty space on right for text",
    bottom_text: "composition with main action in upper two-thirds, clear lower area for text",
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
  model: ImageModel = DEFAULT_MODEL
): Promise<string> {
  const prompt = `Transform this child into a cute children's book illustration character. ${characterDescription}. Soft watercolor style, pastel colors, gentle rounded features, warm friendly expression, simple clean background, storybook illustration style, suitable for a children's picture book. Keep the character recognizable but stylized as a hand-drawn illustration.`;

  return generateImage({
    prompt,
    referenceImageUrl,
    negativePrompt: GLOBAL_NEGATIVE_PROMPT + ", photorealistic, photograph, profile view, looking away",
    model,
  });
}

/**
 * Generate all page illustrations for a book
 * Uses the SAME reference image for ALL pages to ensure character consistency
 */
export async function generateBookIllustrations(
  pages: StoryPage[],
  characterSummary: string,
  referenceImageUrl: string,
  stylePrompt: string = GLOBAL_STYLE_PROMPT,
  model: ImageModel = DEFAULT_MODEL
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (const page of pages) {
    try {
      console.log(`Generating page ${page.page} with ${model}...`);

      const prompt = buildPagePrompt(page, characterSummary, stylePrompt);

      const imageUrl = await generateImage({
        prompt,
        referenceImageUrl, // SAME reference for ALL pages
        model,
      });

      results.push({ pageNumber: page.page, imageUrl });
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
  model: ImageModel = DEFAULT_MODEL
): Promise<string> {
  const prompt = buildPagePrompt(page, characterSummary, stylePrompt);

  return generateImage({
    prompt,
    referenceImageUrl,
    model,
  });
}
