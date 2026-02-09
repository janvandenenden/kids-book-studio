import { NextRequest, NextResponse } from "next/server";
import {
  loadStoredStoryboard,
  saveStoryboard,
  saveStoryboardWithImages,
  updateStoredPanel,
  hasStoredStoryboard,
  generateStoryboard,
  generateStoryboardForStory,
} from "@/lib/story-template";
import type { StoryboardPanel } from "@/types";

export const maxDuration = 120; // Allow time for image downloads

// Simple admin auth check (use env variable)
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    // If no password set, allow access (dev mode)
    return true;
  }

  if (!authHeader) {
    return false;
  }

  // Expect "Bearer <password>"
  const [type, password] = authHeader.split(" ");
  return type === "Bearer" && password === adminPassword;
}

// GET - Load existing storyboard
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId") || "adventure-story";

  const storyboard = loadStoredStoryboard(storyId);
  const story = generateStoryboardForStory(storyId, "Child") || generateStoryboard("Child");

  return NextResponse.json({
    exists: hasStoredStoryboard(storyId),
    storyboard,
    story,
  });
}

// POST - Save entire storyboard
// Set downloadImages=true to download remote images locally (prevents Replicate URL expiry)
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { panels, storyId = "adventure-story", downloadImages = false } = body;

    if (!panels || !Array.isArray(panels)) {
      return NextResponse.json(
        { error: "Missing or invalid panels array" },
        { status: 400 }
      );
    }

    let storyboard;
    if (downloadImages) {
      // Download images locally to prevent Replicate URL expiry
      console.log("Downloading images locally...");
      storyboard = await saveStoryboardWithImages(panels as StoryboardPanel[], storyId);
    } else {
      // Quick save without downloading (for approval toggles, etc.)
      storyboard = saveStoryboard(panels as StoryboardPanel[], storyId);
    }

    return NextResponse.json({
      success: true,
      storyboard,
    });
  } catch (error) {
    console.error("Failed to save storyboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save storyboard" },
      { status: 500 }
    );
  }
}

// PATCH - Update single panel
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pageNumber, updates, storyId = "adventure-story" } = body;

    if (typeof pageNumber !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid pageNumber" },
        { status: 400 }
      );
    }

    const storyboard = updateStoredPanel(
      pageNumber,
      updates as Partial<StoryboardPanel>,
      storyId
    );

    if (!storyboard) {
      return NextResponse.json(
        { error: "Failed to update panel - storyboard or panel not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      storyboard,
    });
  } catch (error) {
    console.error("Failed to update panel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update panel" },
      { status: 500 }
    );
  }
}
