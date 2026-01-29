import { NextRequest, NextResponse } from "next/server";
import {
  generateAllStoryboardPanels,
  generateAllStoryboardPanelsWithProps,
  ImageModel,
} from "@/lib/replicate";
import { downloadAndSaveImage } from "@/lib/server-utils";
import { generateStoryboard, loadPropBible } from "@/lib/story-template";
import type { StoryboardPanel } from "@/types";

export const maxDuration = 300; // 5 minutes for storyboard generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      characterType = "child", // "boy" | "girl" | "child"
      model,
      pageLimit,
      usePropBible = true, // Use prop bible by default
    } = body;

    // Generate the storyboard with placeholder name (admin flow)
    let storyboard = generateStoryboard("Child");

    // Dev mode: limit number of pages
    if (pageLimit && typeof pageLimit === "number" && pageLimit > 0) {
      storyboard = {
        ...storyboard,
        pages: storyboard.pages.slice(0, pageLimit),
      };
      console.log(`Dev mode: limiting storyboard to ${pageLimit} panels`);
    }

    console.log(`Starting storyboard panel generation`);
    console.log(`Character type: ${characterType}`);
    console.log(`Use prop bible: ${usePropBible}`);
    console.log(`Generating ${storyboard.pages.length} B&W panels using outline.png...`);

    let panels;

    if (usePropBible) {
      // Load prop bible for consistent object/environment descriptions
      const propBible = loadPropBible();
      console.log(`Loaded prop bible with ${Object.keys(propBible.props).length} props and ${Object.keys(propBible.environments).length} environments`);

      // Generate all B&W storyboard panels with prop bible
      panels = await generateAllStoryboardPanelsWithProps(
        storyboard.pages,
        propBible,
        (model as ImageModel) || "nano-banana-pro",
      );
    } else {
      // Generate without prop bible (legacy behavior)
      panels = await generateAllStoryboardPanels(
        storyboard.pages,
        (model as ImageModel) || "nano-banana-pro",
      );
    }

    console.log(`Generated ${panels.length} storyboard panels`);

    // Download and save all panels locally to prevent URL expiration
    console.log("Saving panels locally to prevent URL expiration...");
    const savedPanels: StoryboardPanel[] = await Promise.all(
      panels.map(async (panel: StoryboardPanel) => {
        if (panel.sketchUrl) {
          const localUrl = await downloadAndSaveImage(
            panel.sketchUrl,
            `panel-${panel.page}.png`,
            "storyboard"
          );
          return { ...panel, sketchUrl: localUrl };
        }
        return panel;
      })
    );

    return NextResponse.json({
      success: true,
      panels: savedPanels,
      storyboard,
      panelsGenerated: savedPanels.length,
      totalPanels: storyboard.pages.length,
      usedPropBible: usePropBible,
    });
  } catch (error) {
    console.error("Storyboard generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate storyboard panels",
      },
      { status: 500 },
    );
  }
}
