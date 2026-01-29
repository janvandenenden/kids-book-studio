import { NextRequest, NextResponse } from "next/server";
import {
  generateBookIllustrations,
  generatePageFromStoryboard,
  GLOBAL_STYLE_PROMPT,
  ImageModel,
  GenerationResult,
} from "@/lib/replicate";
import {
  generateStoryboard,
  getPromptsTemplate,
  mergeStoryboardWithImages,
} from "@/lib/story-template";
import { profileToPromptSummary } from "@/lib/character-profile";
import type { CharacterProfile, StoryboardPanel } from "@/types";

export const maxDuration = 300; // 5 minutes for image generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      childName,
      characterDescription,
      characterProfile,
      characterSheetUrl,
      model,
      pageLimit,
      storyboardPanels,
    } = body;

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

    let generatedImages: GenerationResult[];

    // Check if we have storyboard panels to use as composition guides
    if (storyboardPanels && Array.isArray(storyboardPanels) && storyboardPanels.length > 0) {
      console.log(`Using ${storyboardPanels.length} storyboard panels for img2img generation`);

      // Create a map of page number to sketch URL
      const panelMap = new Map<number, string>();
      for (const panel of storyboardPanels as StoryboardPanel[]) {
        if (panel.sketchUrl && panel.approved) {
          panelMap.set(panel.page, panel.sketchUrl);
        }
      }

      // Generate images using img2img approach with storyboard sketches
      generatedImages = [];
      for (const page of storyboard.pages) {
        try {
          const sketchUrl = panelMap.get(page.page);
          let imageUrl: string;

          if (sketchUrl) {
            // Use img2img with storyboard sketch as init image
            console.log(`Generating page ${page.page} from storyboard sketch (img2img)...`);
            imageUrl = await generatePageFromStoryboard(
              page,
              sketchUrl,
              characterSummary,
              referenceImageUrl,
              promptsTemplate.stylePrompt || GLOBAL_STYLE_PROMPT,
              (model as ImageModel) || "nano-banana-pro"
            );
          } else {
            // Fallback to regular generation if no sketch available
            console.log(`Generating page ${page.page} without storyboard (no approved sketch)...`);
            const { generateImage, buildPagePrompt } = await import("@/lib/replicate");
            const prompt = buildPagePrompt(page, characterSummary, promptsTemplate.stylePrompt || GLOBAL_STYLE_PROMPT);
            imageUrl = await generateImage({
              prompt,
              referenceImageUrl,
              model: (model as ImageModel) || "nano-banana-pro",
            });
          }

          generatedImages.push({ pageNumber: page.page, imageUrl });
        } catch (error) {
          console.error(`Failed to generate page ${page.page}:`, error);
          throw error;
        }
      }
    } else {
      // Generate all page illustrations without storyboard guidance
      // The SAME reference image is used for ALL pages
      generatedImages = await generateBookIllustrations(
        storyboard.pages,
        characterSummary,
        referenceImageUrl,
        promptsTemplate.stylePrompt || GLOBAL_STYLE_PROMPT,
        (model as ImageModel) || "nano-banana-pro"
      );
    }

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
