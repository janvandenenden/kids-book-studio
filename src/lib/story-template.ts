import storyData from "@/templates/adventure-story/story.json";
import promptsData from "@/templates/adventure-story/prompts.json";
import type { Storyboard, StoryPage, PromptsTemplate } from "@/types";

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
