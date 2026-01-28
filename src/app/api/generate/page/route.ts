import { NextRequest, NextResponse } from "next/server";
import { regeneratePage, GLOBAL_STYLE_PROMPT, ImageModel } from "@/lib/replicate";
import { getPromptsTemplate } from "@/lib/story-template";
import type { StoryPage } from "@/types";

export const maxDuration = 120; // 2 minutes for single page

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageNumber, pageData, characterDescription, characterSheetUrl, model } = body;

    if (typeof pageNumber !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid pageNumber" },
        { status: 400 }
      );
    }

    if (!pageData) {
      return NextResponse.json(
        { error: "Missing pageData" },
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

    // Get prompts template for style info
    const promptsTemplate = getPromptsTemplate();

    // Use the illustrated character sheet as reference (already a URL from Replicate)
    const referenceImageUrl = characterSheetUrl;

    console.log(`Regenerating page ${pageNumber}...`);
    console.log(`Character description: ${characterDescription}`);
    console.log(`Reference image: ${characterSheetUrl}`);

    // Regenerate the single page
    // Uses the SAME reference image for consistency
    const imageUrl = await regeneratePage(
      pageData as StoryPage,
      characterDescription,
      referenceImageUrl,
      promptsTemplate.stylePrompt || GLOBAL_STYLE_PROMPT,
      (model as ImageModel) || "ip-adapter"
    );

    console.log(`Page ${pageNumber} regenerated: ${imageUrl}`);

    return NextResponse.json({
      success: true,
      pageNumber,
      imageUrl,
    });
  } catch (error) {
    console.error("Page regeneration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate page" },
      { status: 500 }
    );
  }
}
