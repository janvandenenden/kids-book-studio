import { NextRequest, NextResponse } from "next/server";
import { convertToTemplateFiles, loadStoryProject } from "@/lib/story-template";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return true;
  if (!authHeader) return false;
  const [type, password] = authHeader.split(" ");
  return type === "Bearer" && password === adminPassword;
}

// POST — convert phase outputs to template files
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyId } = await params;

  const project = loadStoryProject(storyId);
  if (!project) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  try {
    convertToTemplateFiles(storyId);

    const updated = loadStoryProject(storyId);
    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error(`Conversion error for ${storyId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to convert to template files" },
      { status: 500 },
    );
  }
}
