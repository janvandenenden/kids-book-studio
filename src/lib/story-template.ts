import storyData from "@/templates/adventure-story/story.json";
import promptsData from "@/templates/adventure-story/prompts.json";
import type { Storyboard, StoryPage, PromptsTemplate, StoryboardPanel } from "@/types";
import fs from "fs";
import path from "path";

/**
 * Download an image from URL and save it locally
 * Returns the local public URL path
 */
export async function downloadAndSaveImage(
  imageUrl: string,
  filename: string,
  subdir: string = "storyboard"
): Promise<string> {
  const publicDir = path.join(process.cwd(), "public", subdir);

  // Ensure directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const filePath = path.join(publicDir, filename);

  // Download the image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save to file
  fs.writeFileSync(filePath, buffer);

  // Return the public URL path
  return `/${subdir}/${filename}`;
}

// Re-export types for convenience
export type { Storyboard, StoryPage, PromptsTemplate };

// Legacy interface for backwards compatibility
export interface Story {
  title: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    hasIllustration: boolean;
    imageUrl?: string;
  }>;
}

export function loadStoryTemplate(): { story: typeof storyData; prompts: typeof promptsData } {
  return {
    story: storyData,
    prompts: promptsData,
  };
}

export function replacePlaceholders(text: string, name: string): string {
  return text.replace(/\{\{name\}\}/g, name);
}

/**
 * Generate a storyboard with the enhanced format
 */
export function generateStoryboard(name: string): Storyboard {
  const { story } = loadStoryTemplate();

  return {
    id: story.id,
    title: replacePlaceholders(story.title, name),
    ageRange: story.ageRange,
    pageCount: story.pageCount,
    pages: story.pages.map((page) => ({
      page: page.page,
      scene: page.scene,
      emotion: page.emotion,
      action: page.action,
      setting: page.setting,
      composition_hint: page.composition_hint as "wide" | "medium" | "close",
      text: replacePlaceholders(page.text, name),
      layout: page.layout as "left_text" | "right_text" | "bottom_text" | "full_bleed",
    })),
  };
}

/**
 * Legacy function for backwards compatibility
 */
export function generateStory(name: string): Story {
  const storyboard = generateStoryboard(name);

  return {
    title: storyboard.title,
    pages: storyboard.pages.map((page) => ({
      pageNumber: page.page,
      text: page.text,
      hasIllustration: true, // All pages have illustrations in enhanced format
    })),
  };
}

export function getPromptsTemplate(): PromptsTemplate {
  const { prompts } = loadStoryTemplate();
  return {
    storyId: prompts.storyId,
    stylePrompt: prompts.stylePrompt,
    negativePrompt: prompts.negativePrompt,
    pages: prompts.pages,
  };
}

/**
 * Get the prompt for a specific page
 */
export function getPagePrompt(pageNumber: number): string | null {
  const { prompts } = loadStoryTemplate();
  const pagePrompt = prompts.pages.find((p) => p.page === pageNumber);
  return pagePrompt?.prompt || null;
}

/**
 * Merge generated images into the storyboard
 */
export function mergeStoryboardWithImages(
  storyboard: Storyboard,
  generatedImages: { pageNumber: number; imageUrl: string }[]
): Storyboard {
  const imageMap = new Map(
    generatedImages.map((img) => [img.pageNumber, img.imageUrl])
  );

  return {
    ...storyboard,
    pages: storyboard.pages.map((page) => ({
      ...page,
      imageUrl: imageMap.get(page.page),
    })),
  };
}

/**
 * Legacy function - merge images into Story type
 */
export function mergeStoryWithImages(
  story: Story,
  generatedImages: { pageNumber: number; imageUrl: string }[]
): Story {
  const imageMap = new Map(
    generatedImages.map((img) => [img.pageNumber, img.imageUrl])
  );

  return {
    ...story,
    pages: story.pages.map((page) => ({
      ...page,
      imageUrl: imageMap.get(page.pageNumber),
    })),
  };
}

// Storyboard storage types
export interface StoredStoryboard {
  storyId: string;
  createdAt: string;
  updatedAt: string;
  panels: StoryboardPanel[];
}

/**
 * Get the path to the storyboard.json file for a story template
 * Server-side only (uses fs)
 */
function getStoryboardPath(storyId: string = "adventure-story"): string {
  // Handle both development and production paths
  const templatesDir = path.join(process.cwd(), "src", "templates", storyId);
  return path.join(templatesDir, "storyboard.json");
}

/**
 * Load a pre-made storyboard from the templates folder
 * Server-side only (uses fs)
 * Returns null if no storyboard exists
 */
export function loadStoredStoryboard(storyId: string = "adventure-story"): StoredStoryboard | null {
  try {
    const storyboardPath = getStoryboardPath(storyId);

    if (!fs.existsSync(storyboardPath)) {
      console.log(`No storyboard found at ${storyboardPath}`);
      return null;
    }

    const data = fs.readFileSync(storyboardPath, "utf-8");
    const storyboard = JSON.parse(data) as StoredStoryboard;
    console.log(`Loaded storyboard for ${storyId} with ${storyboard.panels.length} panels`);
    return storyboard;
  } catch (error) {
    console.error(`Failed to load storyboard for ${storyId}:`, error);
    return null;
  }
}

/**
 * Save a storyboard to the templates folder
 * Server-side only (uses fs)
 */
export function saveStoryboard(
  panels: StoryboardPanel[],
  storyId: string = "adventure-story"
): StoredStoryboard {
  const storyboardPath = getStoryboardPath(storyId);

  // Check if storyboard already exists
  let existingStoryboard: StoredStoryboard | null = null;
  try {
    if (fs.existsSync(storyboardPath)) {
      const data = fs.readFileSync(storyboardPath, "utf-8");
      existingStoryboard = JSON.parse(data) as StoredStoryboard;
    }
  } catch {
    // Ignore errors, create new
  }

  const storyboard: StoredStoryboard = {
    storyId,
    createdAt: existingStoryboard?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    panels,
  };

  fs.writeFileSync(storyboardPath, JSON.stringify(storyboard, null, 2));
  console.log(`Saved storyboard for ${storyId} with ${panels.length} panels to ${storyboardPath}`);

  return storyboard;
}

/**
 * Save a storyboard and download all panel images locally
 * This ensures images persist beyond Replicate's 1-hour expiry
 * Server-side only (uses fs)
 */
export async function saveStoryboardWithImages(
  panels: StoryboardPanel[],
  storyId: string = "adventure-story"
): Promise<StoredStoryboard> {
  // Download each panel's image and update the URL to local path
  const updatedPanels: StoryboardPanel[] = [];

  for (const panel of panels) {
    let localSketchUrl = panel.sketchUrl;

    // Only download if it's a remote URL (not already local)
    if (panel.sketchUrl && panel.sketchUrl.startsWith("http")) {
      try {
        const filename = `panel-${panel.page}.png`;
        localSketchUrl = await downloadAndSaveImage(
          panel.sketchUrl,
          filename,
          "storyboard"
        );
        console.log(`Downloaded panel ${panel.page} to ${localSketchUrl}`);
      } catch (error) {
        console.error(`Failed to download panel ${panel.page}:`, error);
        // Keep the original URL if download fails
      }
    }

    updatedPanels.push({
      ...panel,
      sketchUrl: localSketchUrl,
    });
  }

  return saveStoryboard(updatedPanels, storyId);
}

/**
 * Update a single panel in the stored storyboard
 * Server-side only (uses fs)
 */
export function updateStoredPanel(
  pageNumber: number,
  updates: Partial<StoryboardPanel>,
  storyId: string = "adventure-story"
): StoredStoryboard | null {
  const storyboard = loadStoredStoryboard(storyId);
  if (!storyboard) {
    console.error(`No storyboard found for ${storyId}`);
    return null;
  }

  const panelIndex = storyboard.panels.findIndex((p) => p.page === pageNumber);
  if (panelIndex === -1) {
    console.error(`Panel ${pageNumber} not found in storyboard`);
    return null;
  }

  storyboard.panels[panelIndex] = {
    ...storyboard.panels[panelIndex],
    ...updates,
  };

  return saveStoryboard(storyboard.panels, storyId);
}

/**
 * Check if a storyboard exists for a story
 * Server-side only (uses fs)
 */
export function hasStoredStoryboard(storyId: string = "adventure-story"): boolean {
  const storyboardPath = getStoryboardPath(storyId);
  return fs.existsSync(storyboardPath);
}

// ============================================
// Character storage (for development)
// ============================================

export interface StoredCharacter {
  id: string; // Unique identifier (slug from name)
  name: string;
  description: string;
  profile: Record<string, unknown>;
  characterSheetUrl: string; // Local path to saved character sheet image
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a slug from a name for use as filename
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get the characters directory path
 */
function getCharactersDir(): string {
  return path.join(process.cwd(), "src", "templates", "characters");
}

/**
 * Get the path to a specific character.json file
 */
function getCharacterPath(characterId: string): string {
  return path.join(getCharactersDir(), `${characterId}.json`);
}

/**
 * List all saved characters
 */
export function listStoredCharacters(): StoredCharacter[] {
  try {
    const charactersDir = getCharactersDir();

    if (!fs.existsSync(charactersDir)) {
      return [];
    }

    const files = fs.readdirSync(charactersDir).filter(f => f.endsWith(".json"));
    const characters: StoredCharacter[] = [];

    for (const file of files) {
      try {
        const data = fs.readFileSync(path.join(charactersDir, file), "utf-8");
        const character = JSON.parse(data) as StoredCharacter;
        characters.push(character);
      } catch {
        console.error(`Failed to load character from ${file}`);
      }
    }

    // Sort by most recently updated
    characters.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return characters;
  } catch (error) {
    console.error("Failed to list characters:", error);
    return [];
  }
}

/**
 * Load a saved character by ID
 * Returns null if no character exists
 */
export function loadStoredCharacter(characterId: string): StoredCharacter | null {
  try {
    const characterPath = getCharacterPath(characterId);

    if (!fs.existsSync(characterPath)) {
      console.log(`No character found at ${characterPath}`);
      return null;
    }

    const data = fs.readFileSync(characterPath, "utf-8");
    const character = JSON.parse(data) as StoredCharacter;
    console.log(`Loaded character: ${character.name}`);
    return character;
  } catch (error) {
    console.error(`Failed to load character ${characterId}:`, error);
    return null;
  }
}

/**
 * Save a character
 * Also downloads the character sheet image locally
 */
export async function saveCharacter(
  name: string,
  description: string,
  profile: Record<string, unknown>,
  characterSheetUrl: string,
): Promise<StoredCharacter> {
  const charactersDir = getCharactersDir();

  // Ensure characters directory exists
  if (!fs.existsSync(charactersDir)) {
    fs.mkdirSync(charactersDir, { recursive: true });
  }

  const characterId = createSlug(name);
  const characterPath = getCharacterPath(characterId);

  // Download character sheet image locally if it's a remote URL
  let localCharacterSheetUrl = characterSheetUrl;
  if (characterSheetUrl.startsWith("http")) {
    try {
      const filename = `${characterId}.png`;
      localCharacterSheetUrl = await downloadAndSaveImage(
        characterSheetUrl,
        filename,
        "characters"
      );
      console.log(`Downloaded character sheet to ${localCharacterSheetUrl}`);
    } catch (error) {
      console.error("Failed to download character sheet:", error);
      // Keep remote URL if download fails
    }
  }

  // Check for existing character
  let existingCharacter: StoredCharacter | null = null;
  try {
    if (fs.existsSync(characterPath)) {
      const data = fs.readFileSync(characterPath, "utf-8");
      existingCharacter = JSON.parse(data) as StoredCharacter;
    }
  } catch {
    // Ignore errors, create new
  }

  const character: StoredCharacter = {
    id: characterId,
    name,
    description,
    profile,
    characterSheetUrl: localCharacterSheetUrl,
    createdAt: existingCharacter?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(characterPath, JSON.stringify(character, null, 2));
  console.log(`Saved character ${characterId} to ${characterPath}`);

  return character;
}

/**
 * Check if a character exists
 */
export function hasStoredCharacter(characterId: string): boolean {
  const characterPath = getCharacterPath(characterId);
  return fs.existsSync(characterPath);
}

/**
 * Delete a saved character and its image
 */
export function deleteStoredCharacter(characterId: string): boolean {
  try {
    const characterPath = getCharacterPath(characterId);

    if (!fs.existsSync(characterPath)) {
      return false;
    }

    // Load character to get image path
    const data = fs.readFileSync(characterPath, "utf-8");
    const character = JSON.parse(data) as StoredCharacter;

    // Delete the JSON file
    fs.unlinkSync(characterPath);
    console.log(`Deleted character JSON: ${characterPath}`);

    // Delete the character sheet image if it's local
    if (character.characterSheetUrl && character.characterSheetUrl.startsWith("/")) {
      const imagePath = path.join(process.cwd(), "public", character.characterSheetUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`Deleted character image: ${imagePath}`);
      }
    }

    return true;
  } catch (error) {
    console.error(`Failed to delete character ${characterId}:`, error);
    return false;
  }
}
