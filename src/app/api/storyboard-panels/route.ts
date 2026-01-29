import { NextRequest, NextResponse } from "next/server";
import { generateAllStoryboardPanels, ImageModel } from "@/lib/replicate";
import { generateStoryboard } from "@/lib/story-template";

export const maxDuration = 300; // 5 minutes for storyboard generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      characterType = "child", // "boy" | "girl" | "child"
      model,
      pageLimit,
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
    console.log(`Generating ${storyboard.pages.length} B&W panels...`);

    // Generate all B&W storyboard panels (no reference image needed)
    const panels = await generateAllStoryboardPanels(
      storyboard.pages,
      (model as ImageModel) || "nano-banana-pro",
    );

    console.log(`Generated ${panels.length} storyboard panels`);

    return NextResponse.json({
      success: true,
      panels,
      storyboard,
      panelsGenerated: panels.length,
      totalPanels: storyboard.pages.length,
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
