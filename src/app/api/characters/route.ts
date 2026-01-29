import { NextResponse } from "next/server";
import { listStoredCharacters } from "@/lib/story-template";

// GET - List all saved characters (public, no auth needed)
export async function GET() {
  const characters = listStoredCharacters();

  return NextResponse.json({
    characters,
  });
}
