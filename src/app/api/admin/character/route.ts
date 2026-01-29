import { NextRequest, NextResponse } from "next/server";
import {
  loadStoredCharacter,
  saveCharacter,
  listStoredCharacters,
  deleteStoredCharacter,
} from "@/lib/story-template";

export const maxDuration = 60;

// Simple admin auth check
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return true; // Dev mode
  }

  if (!authHeader) {
    return false;
  }

  const [type, password] = authHeader.split(" ");
  return type === "Bearer" && password === adminPassword;
}

// GET - List all characters or load specific character
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const characterId = searchParams.get("id");

  if (characterId) {
    // Load specific character
    const character = loadStoredCharacter(characterId);
    return NextResponse.json({
      exists: !!character,
      character,
    });
  }

  // List all characters
  const characters = listStoredCharacters();
  return NextResponse.json({
    characters,
  });
}

// POST - Save character
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      profile,
      characterSheetUrl,
    } = body;

    if (!name || !description || !characterSheetUrl) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, characterSheetUrl" },
        { status: 400 }
      );
    }

    const character = await saveCharacter(
      name,
      description,
      profile || {},
      characterSheetUrl,
    );

    return NextResponse.json({
      success: true,
      character,
    });
  } catch (error) {
    console.error("Failed to save character:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save character" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a character
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("id");

    if (!characterId) {
      return NextResponse.json(
        { error: "Missing character id" },
        { status: 400 }
      );
    }

    const deleted = deleteStoredCharacter(characterId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to delete character:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete character" },
      { status: 500 }
    );
  }
}
