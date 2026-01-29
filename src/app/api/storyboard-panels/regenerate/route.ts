import { NextRequest, NextResponse } from "next/server";
import { generateStoryboardPanel, ImageModel } from "@/lib/replicate";
import type { StoryPage, StoryboardPanel } from "@/types";

export const maxDuration = 120; // 2 minutes for single panel regeneration

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageNumber, pageData, model } = body;

    if (!pageNumber) {
      return NextResponse.json(
        { error: "Missing pageNumber" },
        { status: 400 },
      );
    }

    if (!pageData) {
      return NextResponse.json({ error: "Missing pageData" }, { status: 400 });
    }

    console.log(`Regenerating storyboard panel ${pageNumber}`);

    // Generate single B&W storyboard panel (uses outline.png as input)
    const sketchUrl = await generateStoryboardPanel(
      pageData as StoryPage,
      (model as ImageModel) || "nano-banana-pro",
    );

    // Determine text placement from layout
    const textPlacementMap: Record<
      string,
      "left" | "right" | "bottom" | "top"
    > = {
      left_text: "left",
      right_text: "right",
      bottom_text: "bottom",
      full_bleed: "bottom",
    };

    const panel: StoryboardPanel = {
      page: pageNumber,
      scene: (pageData as StoryPage).scene,
      textPlacement:
        textPlacementMap[(pageData as StoryPage).layout] || "bottom",
      sketchUrl,
      approved: false,
    };

    console.log(`Regenerated panel ${pageNumber}: ${sketchUrl}`);

    return NextResponse.json({
      success: true,
      panel,
    });
  } catch (error) {
    console.error("Panel regeneration error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to regenerate panel",
      },
      { status: 500 },
    );
  }
}
