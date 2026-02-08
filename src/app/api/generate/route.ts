import { NextRequest, NextResponse } from "next/server";
import {
  generateBookIllustrations,
  generatePageFromStoryboard,
  GLOBAL_STYLE_PROMPT,
  ImageModel,
  GenerationResult,
  RATE_LIMIT_DELAY_MS,
  delay,
} from "@/lib/replicate";
import {
  generateStoryboard,
  generateStoryboardForStory,
  getPromptsTemplate,
  mergeStoryboardWithImages,
  loadStoryTemplateForStory,
} from "@/lib/story-template";
import { profileToPromptSummary } from "@/lib/character-profile";
import type { CharacterProfile, StoryboardPanel, PromptsTemplate } from "@/types";

/**
 * Check if a URL is accessible (not expired)
 */
async function isUrlAccessible(url: string): Promise<boolean> {
  // Local paths are always accessible
  if (!url.startsWith("http")) {
    return true;
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

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
      storyId = "adventure-story",
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
    let storyboard = storyId !== "adventure-story"
      ? generateStoryboardForStory(storyId, childName)
      : generateStoryboard(childName);

    if (!storyboard) {
      return NextResponse.json(
        { error: `Story template ${storyId} not found` },
        { status: 404 },
      );
    }

    // Dev mode: limit number of pages
    if (pageLimit && typeof pageLimit === "number" && pageLimit > 0) {
      storyboard = {
        ...storyboard,
        pages: storyboard.pages.slice(0, pageLimit),
      };
      console.log(`Dev mode: limiting to ${pageLimit} pages`);
    }

    // Get prompts template for style info
    let promptsTemplate: PromptsTemplate;
    if (storyId !== "adventure-story") {
      const template = loadStoryTemplateForStory(storyId);
      promptsTemplate = template?.prompts || getPromptsTemplate();
    } else {
      promptsTemplate = getPromptsTemplate();
    }

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

      // Create a map of page number to sketch URL (only for accessible URLs)
      const panelMap = new Map<number, string>();
      for (const panel of storyboardPanels as StoryboardPanel[]) {
        if (panel.sketchUrl && panel.approved) {
          // Check if the URL is still accessible (Replicate URLs expire)
          const isAccessible = await isUrlAccessible(panel.sketchUrl);
          if (isAccessible) {
            panelMap.set(panel.page, panel.sketchUrl);
          } else {
            console.warn(`Panel ${panel.page} URL expired or inaccessible, will generate without storyboard`);
          }
        }
      }
      console.log(`${panelMap.size} of ${storyboardPanels.length} panel URLs are accessible`);

      // Generate images using img2img approach with storyboard sketches
      generatedImages = [];
      for (let i = 0; i < storyboard.pages.length; i++) {
        const page = storyboard.pages[i];

        // Rate limiting: wait between requests (skip for first request)
        if (i > 0) {
          console.log(`Rate limiting: waiting ${RATE_LIMIT_DELAY_MS / 1000}s before next request...`);
          await delay(RATE_LIMIT_DELAY_MS);
        }

        try {
          const sketchUrl = panelMap.get(page.page);
          let imageUrl: string;

          if (sketchUrl) {
            // Look up the per-page prompt from prompts.json (rich composed prompt for pipeline stories)
            const pagePromptEntry = promptsTemplate.pages?.find((p) => p.page === page.page);
            const pagePrompt = pagePromptEntry?.prompt;

            // Use img2img with storyboard sketch as init image
            console.log(`Generating page ${page.page} (${i + 1}/${storyboard.pages.length}) from storyboard sketch (img2img)...`);
            imageUrl = await generatePageFromStoryboard(
              page,
              sketchUrl,
              characterSummary,
              referenceImageUrl,
              promptsTemplate.stylePrompt || GLOBAL_STYLE_PROMPT,
              (model as ImageModel) || "nano-banana-pro",
              pagePrompt,
            );
          } else {
            // Fallback to regular generation if no sketch available
            console.log(`Generating page ${page.page} (${i + 1}/${storyboard.pages.length}) without storyboard (no approved sketch)...`);
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
