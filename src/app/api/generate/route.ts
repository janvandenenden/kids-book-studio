import { NextRequest, NextResponse } from "next/server";
import {
  generateBookIllustrations,
  GLOBAL_STYLE_PROMPT,
  ImageModel,
} from "@/lib/replicate";
import {
  generateStoryboard,
  getPromptsTemplate,
  mergeStoryboardWithImages,
} from "@/lib/story-template";
import { profileToPromptSummary } from "@/lib/character-profile";
import type { CharacterProfile } from "@/types";

export const maxDuration = 300; // 5 minutes for image generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { childName, characterDescription, characterProfile, characterSheetUrl, model, pageLimit } = body;

    if (!childName) {
      return NextResponse.json(
        { error: "Missing childName" },
        { status: 400 }
      );
    }

    if (!characterDescription) {
      return NextResponse.json(
        { error: "Missing characterDescription" },
        { status: 400 }
      );
    }

    if (!characterSheetUrl) {
      return NextResponse.json(
        { error: "Missing characterSheetUrl (illustrated character reference)" },
        { status: 400 }
      );
    }

    // Generate the storyboard with name placeholders filled in
    let storyboard = generateStoryboard(childName);

    // Dev mode: limit number of pages
    if (pageLimit && typeof pageLimit === "number" && pageLimit > 0) {
      storyboard = {
        ...storyboard,
        pages: storyboard.pages.slice(0, pageLimit),
      };
      console.log(`Dev mode: limiting to ${pageLimit} pages`);
    }

    // Get prompts template for style info
    const promptsTemplate = getPromptsTemplate();

    // Build character summary for prompts
    let characterSummary = characterDescription;
    if (characterProfile) {
      characterSummary = profileToPromptSummary(characterProfile as CharacterProfile);
    }

    // Use the illustrated character sheet as reference (already a URL from Replicate)
    const referenceImageUrl = characterSheetUrl;

    console.log(`Starting image generation for ${childName}`);
    console.log(`Character summary: ${characterSummary}`);
    console.log(`Reference image: ${characterSheetUrl}`);
    console.log(`Generating ${storyboard.pages.length} illustrations...`);

    // Generate all page illustrations
    // The SAME reference image is used for ALL pages
    const generatedImages = await generateBookIllustrations(
      storyboard.pages,
      characterSummary,
      referenceImageUrl,
      promptsTemplate.stylePrompt || GLOBAL_STYLE_PROMPT,
      (model as ImageModel) || "ip-adapter"
    );

    // Merge generated images into the storyboard
    const completeStoryboard = mergeStoryboardWithImages(storyboard, generatedImages);

    console.log(`Generated ${generatedImages.length} of ${storyboard.pages.length} illustrations`);

    return NextResponse.json({
      success: true,
      story: completeStoryboard,
      imagesGenerated: generatedImages.length,
      totalImages: storyboard.pages.length,
    });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate book" },
      { status: 500 }
    );
  }
}
