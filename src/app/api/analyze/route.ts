import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { analyzeCharacterFromImage } from "@/lib/llm";

async function getImageBase64(photoPath: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", photoPath);
  const fileBuffer = await readFile(filePath);
  return fileBuffer.toString("base64");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photoPath, childName } = body;

    if (!photoPath) {
      return NextResponse.json(
        { error: "Missing photoPath" },
        { status: 400 }
      );
    }

    if (!childName) {
      return NextResponse.json(
        { error: "Missing childName" },
        { status: 400 }
      );
    }

    console.log(`Analyzing photo for ${childName}...`);

    // Get image as base64
    const imageBase64 = await getImageBase64(photoPath);

    // Analyze with OpenAI GPT-4o vision
    const { profile, description } = await analyzeCharacterFromImage(
      imageBase64,
      childName
    );

    console.log("Character profile extracted:", profile);
    console.log("Description:", description);

    return NextResponse.json({
      success: true,
      profile,
      description,
      childName,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze photo" },
      { status: 500 }
    );
  }
}
