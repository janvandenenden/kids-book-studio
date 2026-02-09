import { NextResponse } from "next/server";
import { listTemplateReadyStories } from "@/lib/story-template";

// GET — list template-ready stories (public, no auth)
export async function GET() {
  const stories = listTemplateReadyStories();
  return NextResponse.json({ stories });
}
