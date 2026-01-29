import { NextRequest, NextResponse } from "next/server";
import {
  generateStoryboardPanel,
  generateStoryboardPanelWithProps,
  ImageModel,
} from "@/lib/replicate";
import { downloadAndSaveImage } from "@/lib/server-utils";
import { loadPropBible } from "@/lib/story-template";
import type { StoryPage, StoryboardPanel } from "@/types";

export const maxDuration = 120; // 2 minutes for single panel regeneration

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pageNumber,
      pageData,
      model,
      usePropBible = true, // Use prop bible by default
    } = body;

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
    console.log(`  Use prop bible: ${usePropBible}`);

    let sketchUrl: string;

    if (usePropBible) {
      // Load prop bible for consistent object/environment descriptions
      const propBible = loadPropBible();

      // Generate with prop bible (text-based consistency only)
      sketchUrl = await generateStoryboardPanelWithProps(
        pageData as StoryPage,
        propBible,
        (model as ImageModel) || "nano-banana-pro",
      );
    } else {
      // Generate without prop bible (legacy behavior)
      sketchUrl = await generateStoryboardPanel(
        pageData as StoryPage,
        (model as ImageModel) || "nano-banana-pro",
      );
    }

    // Download and save image locally to prevent URL expiration
    const localSketchUrl = await downloadAndSaveImage(
      sketchUrl,
      `panel-${pageNumber}.png`,
      "storyboard"
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
      sketchUrl: localSketchUrl,
      approved: false,
    };

    console.log(`Regenerated panel ${pageNumber}: ${localSketchUrl}`);

    return NextResponse.json({
      success: true,
      panel,
      usedPropBible: usePropBible,
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
