import { NextRequest, NextResponse } from "next/server";
import { loadStoriesIndex, createStoryProject } from "@/lib/story-template";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isAuthorized(_request: NextRequest): boolean {
  return true;
}

// GET — list all stories
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const index = loadStoriesIndex();
  return NextResponse.json({ stories: index.stories });
}

// POST — create a new story project
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Missing story name" },
        { status: 400 },
      );
    }

    const project = createStoryProject(name.trim());

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("Failed to create story:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create story",
      },
      { status: 500 },
    );
  }
}
