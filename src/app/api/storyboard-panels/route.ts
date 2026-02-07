import { NextRequest, NextResponse } from "next/server";
import {
  generateAllStoryboardPanels,
  generateAllStoryboardPanelsWithProps,
  generateStoryboardPanelFromBrief,
  ImageModel,
  RATE_LIMIT_DELAY_MS,
  delay,
} from "@/lib/replicate";
import { downloadAndSaveImage } from "@/lib/server-utils";
import {
  generateStoryboard,
  generateStoryboardForStory,
  loadPropBible,
  loadPropBibleForStory,
  loadStoryProject,
} from "@/lib/story-template";
import type { StoryboardPanel, Phase5PanelBriefs } from "@/types";

export const maxDuration = 300; // 5 minutes for storyboard generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      characterType = "child", // "boy" | "girl" | "child"
      model,
      pageLimit,
      usePropBible = true, // Use prop bible by default
      storyId,
    } = body;

    // Check if the story has Phase 5 panel briefs (generated pipeline stories)
    if (storyId && storyId !== "adventure-story") {
      const project = loadStoryProject(storyId);
      if (project?.phase5?.output) {
        console.log(`Using Phase 5 panel briefs for story: ${storyId}`);
        const panelBriefs = project.phase5.output as Phase5PanelBriefs;
        let briefs = panelBriefs.panels;

        if (pageLimit && typeof pageLimit === "number" && pageLimit > 0) {
          briefs = briefs.slice(0, pageLimit);
        }

        const panels: StoryboardPanel[] = [];
        for (let i = 0; i < briefs.length; i++) {
          if (i > 0) {
            await delay(RATE_LIMIT_DELAY_MS);
          }

          const brief = briefs[i];
          console.log(`Generating panel ${brief.spreadNumber} (${i + 1}/${briefs.length}) from Phase 5 brief...`);

          const sketchUrl = await generateStoryboardPanelFromBrief(
            brief,
            (model as ImageModel) || "nano-banana-pro",
          );

          const localUrl = await downloadAndSaveImage(
            sketchUrl,
            `panel-${brief.spreadNumber}.png`,
            "storyboard",
          );

          panels.push({
            page: brief.spreadNumber,
            scene: brief.composition,
            textPlacement: "bottom",
            sketchUrl: localUrl,
            approved: false,
          });
        }

        const storyboard = generateStoryboardForStory(storyId, "Child");

        return NextResponse.json({
          success: true,
          panels,
          storyboard,
          panelsGenerated: panels.length,
          totalPanels: briefs.length,
          usedPhase5: true,
        });
      }
    }

    // Legacy path: use adventure-story or prop bible
    let storyboard = storyId
      ? generateStoryboardForStory(storyId, "Child")
      : generateStoryboard("Child");

    if (!storyboard) {
      return NextResponse.json(
        { error: `Story ${storyId} not found` },
        { status: 404 },
      );
    }

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
      const propBible = storyId
        ? loadPropBibleForStory(storyId)
        : loadPropBible();

      if (propBible) {
        console.log(`Loaded prop bible with ${Object.keys(propBible.props).length} props and ${Object.keys(propBible.environments).length} environments`);

        // Generate all B&W storyboard panels with prop bible
        panels = await generateAllStoryboardPanelsWithProps(
          storyboard.pages,
          propBible,
          (model as ImageModel) || "nano-banana-pro",
        );
      } else {
        // No prop bible, generate without
        panels = await generateAllStoryboardPanels(
          storyboard.pages,
          (model as ImageModel) || "nano-banana-pro",
        );
      }
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
