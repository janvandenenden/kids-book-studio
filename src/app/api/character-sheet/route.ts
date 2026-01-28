import { NextRequest, NextResponse } from "next/server";
import { generateCharacterSheet, ImageModel } from "@/lib/replicate";
import { readFile } from "fs/promises";
import path from "path";

export const maxDuration = 120; // 2 minutes for image generation

// Convert local file to base64 data URL
async function getBase64DataUrl(photoPath: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", photoPath);
  const fileBuffer = await readFile(filePath);
  const base64 = fileBuffer.toString("base64");

  // Determine mime type from extension
  const ext = path.extname(photoPath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  const mimeType = mimeTypes[ext] || "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterDescription, photoPath, model } = body;

    if (!characterDescription) {
      return NextResponse.json(
        { error: "Missing characterDescription" },
        { status: 400 }
      );
    }

    if (!photoPath) {
      return NextResponse.json(
        { error: "Missing photoPath (reference image)" },
        { status: 400 }
      );
    }

    console.log("Generating character sheet...");
    console.log("Character description:", characterDescription);
    console.log("Reference photo:", photoPath);

    // Convert local file to base64 data URL for Replicate
    const referenceImageUrl = await getBase64DataUrl(photoPath);

    // Generate character sheet using selected model
    const characterSheetUrl = await generateCharacterSheet(
      characterDescription,
      referenceImageUrl,
      (model as ImageModel) || "ip-adapter"
    );

    console.log("Character sheet generated:", characterSheetUrl);

    return NextResponse.json({
      success: true,
      characterSheetUrl,
    });
  } catch (error) {
    console.error("Character sheet generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate character sheet" },
      { status: 500 }
    );
  }
}
