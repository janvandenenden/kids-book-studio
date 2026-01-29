import { NextRequest, NextResponse } from "next/server";
import {
  loadPropBible,
  loadPropBibleFromFile,
  savePropBible,
} from "@/lib/story-template";
import type { PropBible } from "@/types";

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

// GET - Load prop bible
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId") || "adventure-story";

  // Try to load from filesystem first (allows for runtime edits)
  let propBible = loadPropBibleFromFile(storyId);

  // Fall back to bundled version if file not found
  if (!propBible) {
    propBible = loadPropBible();
  }

  return NextResponse.json({
    propBible,
    storyId,
  });
}

// POST - Save prop bible
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { propBible, storyId = "adventure-story" } = body;

    if (!propBible) {
      return NextResponse.json(
        { error: "Missing propBible data" },
        { status: 400 }
      );
    }

    // Validate required fields (compositions is optional)
    if (!propBible.storyId || !propBible.props || !propBible.environments) {
      return NextResponse.json(
        { error: "Invalid propBible structure - missing required fields" },
        { status: 400 }
      );
    }

    const success = savePropBible(propBible as PropBible, storyId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to save prop bible" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      propBible,
    });
  } catch (error) {
    console.error("Failed to save prop bible:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save prop bible" },
      { status: 500 }
    );
  }
}

// PATCH - Update specific prop/environment/composition
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      storyId = "adventure-story",
      type, // "prop" | "environment" | "composition"
      key,
      data,
      action = "update", // "update" | "delete"
    } = body;

    // Load existing prop bible
    let propBible = loadPropBibleFromFile(storyId);
    if (!propBible) {
      propBible = loadPropBible();
    }

    if (!type || !key) {
      return NextResponse.json(
        { error: "Missing type or key" },
        { status: 400 }
      );
    }

    // Update or delete based on action
    if (action === "delete") {
      switch (type) {
        case "prop":
          delete propBible.props[key];
          break;
        case "environment":
          delete propBible.environments[key];
          break;
        case "composition":
          if (propBible.compositions) {
            delete propBible.compositions[Number(key)];
          }
          break;
        default:
          return NextResponse.json(
            { error: "Invalid type - must be prop, environment, or composition" },
            { status: 400 }
          );
      }
    } else {
      if (!data) {
        return NextResponse.json(
          { error: "Missing data for update" },
          { status: 400 }
        );
      }

      switch (type) {
        case "prop":
          propBible.props[key] = data;
          break;
        case "environment":
          propBible.environments[key] = data;
          break;
        case "composition":
          if (!propBible.compositions) {
            propBible.compositions = {};
          }
          propBible.compositions[Number(key)] = data;
          break;
        default:
          return NextResponse.json(
            { error: "Invalid type - must be prop, environment, or composition" },
            { status: 400 }
          );
      }
    }

    // Save updated prop bible
    const success = savePropBible(propBible, storyId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to save prop bible" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      propBible,
    });
  } catch (error) {
    console.error("Failed to update prop bible:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update prop bible" },
      { status: 500 }
    );
  }
}
