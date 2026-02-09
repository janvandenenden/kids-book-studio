import { NextRequest, NextResponse } from "next/server";
import {
  loadStoryProject,
  deleteStoryProject,
} from "@/lib/story-template";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return true;
  if (!authHeader) return false;
  const [type, password] = authHeader.split(" ");
  return type === "Bearer" && password === adminPassword;
}

// GET — load story project
export async function GET(
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

  return NextResponse.json({ project });
}

// DELETE — delete story project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyId } = await params;

  if (storyId === "adventure-story") {
    return NextResponse.json({ error: "Cannot delete legacy story" }, { status: 400 });
  }

  deleteStoryProject(storyId);
  return NextResponse.json({ success: true });
}
