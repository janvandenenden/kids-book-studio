import storyData from "@/templates/adventure-story/story.json";
import promptsData from "@/templates/adventure-story/prompts.json";
import propBibleData from "@/templates/adventure-story/prop-bible.json";
import type {
  Storyboard, StoryPage, PromptsTemplate, StoryboardPanel, PropBible,
  StoryProject, StoryIndexEntry, PhaseState,
  Phase0Concept, Phase1Storyboard, Phase2Manuscript, Phase4PropsBible, Phase5PanelBriefs,
} from "@/types";
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
export type { Storyboard, StoryPage, PromptsTemplate, PropBible };

export function loadStoryTemplate(): { story: typeof storyData; prompts: typeof promptsData } {
  return {
    story: storyData,
    prompts: promptsData,
  };
}

/**
 * Load the prop bible for a story template
 * Contains reusable descriptions for props, environments, and scene groups
 */
export function loadPropBible(): PropBible {
  return propBibleData as PropBible;
}

/**
 * Get the path to the prop bible file for a story template
 * Server-side only (uses fs)
 */
function getPropBiblePath(storyId: string = "adventure-story"): string {
  const templatesDir = path.join(process.cwd(), "src", "templates", storyId);
  return path.join(templatesDir, "prop-bible.json");
}

/**
 * Load prop bible from filesystem (allows for runtime modifications)
 * Server-side only (uses fs)
 */
export function loadPropBibleFromFile(storyId: string = "adventure-story"): PropBible | null {
  try {
    const propBiblePath = getPropBiblePath(storyId);

    if (!fs.existsSync(propBiblePath)) {
      console.log(`No prop bible found at ${propBiblePath}`);
      return null;
    }

    const data = fs.readFileSync(propBiblePath, "utf-8");
    const propBible = JSON.parse(data) as PropBible;
    console.log(`Loaded prop bible for ${storyId}`);
    return propBible;
  } catch (error) {
    console.error(`Failed to load prop bible for ${storyId}:`, error);
    return null;
  }
}

/**
 * Save prop bible to the templates folder
 * Server-side only (uses fs)
 */
export function savePropBible(
  propBible: PropBible,
  storyId: string = "adventure-story"
): boolean {
  try {
    const propBiblePath = getPropBiblePath(storyId);
    fs.writeFileSync(propBiblePath, JSON.stringify(propBible, null, 2));
    console.log(`Saved prop bible for ${storyId} to ${propBiblePath}`);
    return true;
  } catch (error) {
    console.error(`Failed to save prop bible for ${storyId}:`, error);
    return false;
  }
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
      props: (page as { props?: string[] }).props,
      environment: (page as { environment?: string }).environment,
      emotion: page.emotion,
      action: page.action,
      setting: page.setting,
      composition_hint: page.composition_hint as "wide" | "medium" | "close",
      text: replacePlaceholders(page.text, name),
      layout: page.layout as "left_text" | "right_text" | "bottom_text" | "full_bleed",
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

// ============================================
// Story Generation Pipeline — Storage & CRUD
// ============================================

function getTemplatesDir(): string {
  return path.join(process.cwd(), "src", "templates");
}

function getStoriesIndexPath(): string {
  return path.join(getTemplatesDir(), "stories-index.json");
}

function getStoryDir(storyId: string): string {
  return path.join(getTemplatesDir(), storyId);
}

function getProjectPath(storyId: string): string {
  return path.join(getStoryDir(storyId), "project.json");
}

function getPhaseOutputPath(storyId: string, phaseNum: number): string {
  return path.join(getStoryDir(storyId), `phase${phaseNum}.json`);
}

// --- Stories Index ---

export interface StoriesIndex {
  stories: StoryIndexEntry[];
}

export function loadStoriesIndex(): StoriesIndex {
  try {
    const indexPath = getStoriesIndexPath();
    if (!fs.existsSync(indexPath)) {
      // Build index from existing templates
      const defaultIndex: StoriesIndex = {
        stories: [
          {
            id: "adventure-story",
            name: "Big Adventure",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentPhase: 5,
            templateReady: true,
            isLegacy: true,
          },
        ],
      };
      return defaultIndex;
    }
    const data = fs.readFileSync(indexPath, "utf-8");
    return JSON.parse(data) as StoriesIndex;
  } catch (error) {
    console.error("Failed to load stories index:", error);
    return { stories: [] };
  }
}

export function saveStoriesIndex(index: StoriesIndex): void {
  const indexPath = getStoriesIndexPath();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

export function addStoryToIndex(entry: StoryIndexEntry): void {
  const index = loadStoriesIndex();
  const existing = index.stories.findIndex((s) => s.id === entry.id);
  if (existing >= 0) {
    index.stories[existing] = entry;
  } else {
    index.stories.push(entry);
  }
  saveStoriesIndex(index);
}

export function removeStoryFromIndex(storyId: string): void {
  const index = loadStoriesIndex();
  index.stories = index.stories.filter((s) => s.id !== storyId);
  saveStoriesIndex(index);
}

// --- Story Project CRUD ---

function createEmptyPhaseState<T>(): PhaseState<T> {
  return { status: "pending", output: null };
}

export function createStoryProject(name: string): StoryProject {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const storyDir = getStoryDir(id);
  if (!fs.existsSync(storyDir)) {
    fs.mkdirSync(storyDir, { recursive: true });
  }

  const now = new Date().toISOString();
  const project: StoryProject = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    phase0: createEmptyPhaseState<Phase0Concept>(),
    phase1: createEmptyPhaseState<Phase1Storyboard>(),
    phase2: createEmptyPhaseState<Phase2Manuscript>(),
    phase4: createEmptyPhaseState<Phase4PropsBible>(),
    phase5: createEmptyPhaseState<Phase5PanelBriefs>(),
    currentPhase: 0,
    templateReady: false,
  };

  saveStoryProject(project);

  addStoryToIndex({
    id,
    name,
    createdAt: now,
    updatedAt: now,
    currentPhase: 0,
    templateReady: false,
    isLegacy: false,
  });

  return project;
}

export function loadStoryProject(storyId: string): StoryProject | null {
  try {
    const projectPath = getProjectPath(storyId);
    if (!fs.existsSync(projectPath)) {
      return null;
    }
    const data = fs.readFileSync(projectPath, "utf-8");
    return JSON.parse(data) as StoryProject;
  } catch (error) {
    console.error(`Failed to load story project ${storyId}:`, error);
    return null;
  }
}

export function saveStoryProject(project: StoryProject): void {
  const projectPath = getProjectPath(project.id);
  project.updatedAt = new Date().toISOString();
  fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));

  // Update index entry
  const index = loadStoriesIndex();
  const entry = index.stories.find((s) => s.id === project.id);
  if (entry) {
    entry.updatedAt = project.updatedAt;
    entry.currentPhase = project.currentPhase;
    entry.templateReady = project.templateReady;
    saveStoriesIndex(index);
  }
}

export function deleteStoryProject(storyId: string): void {
  const storyDir = getStoryDir(storyId);
  if (fs.existsSync(storyDir)) {
    fs.rmSync(storyDir, { recursive: true, force: true });
  }
  removeStoryFromIndex(storyId);
}

// --- Phase Output CRUD ---

export function savePhaseOutput(storyId: string, phaseNum: number, output: unknown): void {
  const outputPath = getPhaseOutputPath(storyId, phaseNum);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

export function loadPhaseOutput<T>(storyId: string, phaseNum: number): T | null {
  try {
    const outputPath = getPhaseOutputPath(storyId, phaseNum);
    if (!fs.existsSync(outputPath)) {
      return null;
    }
    const data = fs.readFileSync(outputPath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Failed to load phase ${phaseNum} for ${storyId}:`, error);
    return null;
  }
}

// --- Conversion: Phase outputs → standard template files ---

export function convertToTemplateFiles(storyId: string): void {
  const project = loadStoryProject(storyId);
  if (!project) throw new Error(`Story project ${storyId} not found`);

  const concept = project.phase0.output;
  const manuscript = project.phase2.output;
  const propsBible = project.phase4.output;
  const panelBriefs = project.phase5.output;

  if (!concept || !manuscript) throw new Error("Phase 0 and Phase 2 required for conversion");

  // Convert Phase 2 → story.json
  const storyJson = convertPhase2ToStoryJson(manuscript, concept, storyId);
  const storyJsonPath = path.join(getStoryDir(storyId), "story.json");
  fs.writeFileSync(storyJsonPath, JSON.stringify(storyJson, null, 2));

  // Convert Phase 4 → prop-bible.json
  if (propsBible) {
    const propBibleJson = convertPhase4ToPropBible(propsBible, storyId);
    const propBiblePath = path.join(getStoryDir(storyId), "prop-bible.json");
    fs.writeFileSync(propBiblePath, JSON.stringify(propBibleJson, null, 2));
  }

  // Convert Phase 5 → prompts.json
  if (panelBriefs && propsBible) {
    const promptsJson = convertPhase5ToPromptsJson(panelBriefs, propsBible, storyId);
    const promptsPath = path.join(getStoryDir(storyId), "prompts.json");
    fs.writeFileSync(promptsPath, JSON.stringify(promptsJson, null, 2));
  }

  // Mark project as template-ready
  project.templateReady = true;
  saveStoryProject(project);

  console.log(`Converted story ${storyId} to template files`);
}

function convertPhase2ToStoryJson(
  manuscript: Phase2Manuscript,
  concept: Phase0Concept,
  storyId: string,
): Record<string, unknown> {
  const pages = manuscript.spreads.map((spread) => {
    // Parse illustration note for structured fields
    const note = spread.illustrationNote || "";

    // Try to extract structured fields from the illustration note
    const sceneMatch = note.match(/scene:\s*(.+?)(?:\.|$)/i);
    const emotionMatch = note.match(/emotion:\s*(.+?)(?:\.|$)/i);
    const actionMatch = note.match(/action:\s*(.+?)(?:\.|$)/i);
    const settingMatch = note.match(/setting:\s*(.+?)(?:\.|$)/i);
    const compositionMatch = note.match(/composition:\s*(wide|medium|close)/i);
    const layoutMatch = note.match(/layout:\s*(left_text|right_text|bottom_text|full_bleed)/i);

    return {
      page: spread.spreadNumber,
      scene: sceneMatch?.[1]?.trim() || note.slice(0, 100),
      emotion: emotionMatch?.[1]?.trim() || "engaged",
      action: actionMatch?.[1]?.trim() || "in the scene",
      setting: settingMatch?.[1]?.trim() || "story setting",
      composition_hint: compositionMatch?.[1]?.trim() || "medium",
      text: spread.finalText,
      layout: layoutMatch?.[1]?.trim() || "bottom_text",
    };
  });

  return {
    id: storyId,
    title: `{{name}}'s ${concept.visualHook || "Story"}`,
    ageRange: concept.ageRange,
    pageCount: pages.length,
    pages,
  };
}

function convertPhase4ToPropBible(
  phase4: Phase4PropsBible,
  storyId: string,
): PropBible {
  const props: Record<string, { description: string; appearances: number[] }> = {};
  for (const obj of phase4.keyObjects) {
    const key = obj.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    props[key] = {
      description: obj.description,
      appearances: obj.appearsInSpreads,
    };
  }

  const environments: Record<string, { description: string; appearances: number[] }> = {};
  for (const env of phase4.environments) {
    const key = env.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    environments[key] = {
      description: env.description,
      appearances: env.usedInSpreads,
    };
  }

  return {
    storyId,
    globalStyle: phase4.styleNotes,
    props,
    environments,
  };
}

function convertPhase5ToPromptsJson(
  panelBriefs: Phase5PanelBriefs,
  propsBible: Phase4PropsBible,
  storyId: string,
): PromptsTemplate {
  return {
    storyId,
    stylePrompt: propsBible.styleNotes || "Soft children's book illustration, pastel colors, gentle watercolor texture",
    negativePrompt: "extra characters, multiple children, inconsistent face, realistic photo, harsh shadows, text, words, letters",
    pages: panelBriefs.panels.map((panel) => ({
      page: panel.spreadNumber,
      prompt: panel.imagePrompt,
    })),
  };
}

// --- Multi-story template loading ---

export function loadStoryTemplateForStory(storyId: string): { story: Record<string, unknown>; prompts: PromptsTemplate } | null {
  try {
    const storyDir = getStoryDir(storyId);
    const storyPath = path.join(storyDir, "story.json");
    const promptsPath = path.join(storyDir, "prompts.json");

    if (!fs.existsSync(storyPath) || !fs.existsSync(promptsPath)) {
      return null;
    }

    const story = JSON.parse(fs.readFileSync(storyPath, "utf-8"));
    const prompts = JSON.parse(fs.readFileSync(promptsPath, "utf-8")) as PromptsTemplate;

    return { story, prompts };
  } catch (error) {
    console.error(`Failed to load template for ${storyId}:`, error);
    return null;
  }
}

export function loadPropBibleForStory(storyId: string): PropBible | null {
  return loadPropBibleFromFile(storyId);
}

export function generateStoryboardForStory(storyId: string, name: string): Storyboard | null {
  if (storyId === "adventure-story") {
    return generateStoryboard(name);
  }

  const template = loadStoryTemplateForStory(storyId);
  if (!template) return null;

  const story = template.story as { id: string; title: string; ageRange?: string; pageCount?: number; pages: StoryPage[] };

  return {
    id: story.id,
    title: replacePlaceholders(story.title, name),
    ageRange: story.ageRange,
    pageCount: story.pageCount,
    pages: story.pages.map((page) => ({
      ...page,
      text: replacePlaceholders(page.text, name),
    })),
  };
}

/**
 * List all stories that are template-ready (for user-facing story selection)
 */
export function listTemplateReadyStories(): StoryIndexEntry[] {
  const index = loadStoriesIndex();
  return index.stories.filter((s) => s.templateReady);
}
