import { NextRequest, NextResponse } from "next/server";
import {
  generateStoryboardPanel,
  generateStoryboardPanelWithProps,
  generateStoryboardPanelFromBrief,
  ImageModel,
} from "@/lib/replicate";
import { downloadAndSaveImage } from "@/lib/server-utils";
import { loadPropBible, loadPropBibleForStory, loadStoryProject } from "@/lib/story-template";
import type { StoryPage, StoryboardPanel, Phase5PanelBriefs } from "@/types";

export const maxDuration = 120; // 2 minutes for single panel regeneration

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pageNumber,
      pageData,
      model,
      usePropBible = true, // Use prop bible by default
      storyId,
    } = body;

    if (!pageNumber) {
      return NextResponse.json(
        { error: "Missing pageNumber" },
        { status: 400 },
      );
    }

    console.log(`Regenerating storyboard panel ${pageNumber}`);

    let sketchUrl: string;

    // Check if the story has Phase 5 panel briefs
    if (storyId && storyId !== "adventure-story") {
      const project = loadStoryProject(storyId);
      if (project?.phase5?.output) {
        const panelBriefs = project.phase5.output as Phase5PanelBriefs;
        const brief = panelBriefs.panels.find((p) => p.spreadNumber === pageNumber);

        if (brief) {
          console.log(`  Using Phase 5 panel brief for panel ${pageNumber}`);
          sketchUrl = await generateStoryboardPanelFromBrief(
            brief,
            (model as ImageModel) || "nano-banana-pro",
          );

          const localSketchUrl = await downloadAndSaveImage(
            sketchUrl,
            `panel-${pageNumber}.png`,
            "storyboard",
          );

          const panel: StoryboardPanel = {
            page: pageNumber,
            scene: brief.composition,
            textPlacement: "bottom",
            sketchUrl: localSketchUrl,
            approved: false,
          };

          return NextResponse.json({
            success: true,
            panel,
            usedPhase5: true,
          });
        }
      }
    }

    // Legacy path
    if (!pageData) {
      return NextResponse.json({ error: "Missing pageData" }, { status: 400 });
    }

    console.log(`  Use prop bible: ${usePropBible}`);

    if (usePropBible) {
      const propBible = storyId
        ? loadPropBibleForStory(storyId)
        : loadPropBible();

      if (propBible) {
        sketchUrl = await generateStoryboardPanelWithProps(
          pageData as StoryPage,
          propBible,
          (model as ImageModel) || "nano-banana-pro",
        );
      } else {
        sketchUrl = await generateStoryboardPanel(
          pageData as StoryPage,
          (model as ImageModel) || "nano-banana-pro",
        );
      }
    } else {
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
