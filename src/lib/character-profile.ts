import { z } from "zod";
import type { CharacterProfile } from "@/types";

// Zod schema for validation
export const CharacterProfileSchema = z.object({
  character_name: z.string(),
  approx_age: z.enum(["toddler", "young_child", "older_child"]),
  gender_presentation: z.enum(["boy", "girl", "neutral"]),
  hair: z.object({
    color: z.string(),
    length: z.string(),
    texture: z.enum(["straight", "wavy", "curly", "coily"]),
    style: z.string(),
  }),
  face: z.object({
    shape: z.enum(["round", "oval", "heart"]),
    expression_default: z.string(),
  }),
  eyes: z.object({
    color: z.string(),
    shape: z.string(),
  }),
  skin_tone: z.string(),
  distinctive_features: z.array(z.string()),
  clothing: z.string(),
  color_palette: z.array(z.string()),
  personality_traits: z.array(z.string()),
  do_not_change: z.array(z.string()),
});

export function validateCharacterProfile(data: unknown): CharacterProfile {
  return CharacterProfileSchema.parse(data);
}

export function profileToDescription(profile: CharacterProfile): string {
  const parts: string[] = [];

  // Age and gender
  const ageMap = {
    toddler: "toddler (2-3 years old)",
    young_child: "young child (4-6 years old)",
    older_child: "child (7-10 years old)",
  };
  parts.push(`A ${ageMap[profile.approx_age]} ${profile.gender_presentation}`);

  // Hair
  parts.push(
    `with ${profile.hair.length} ${profile.hair.color} ${profile.hair.texture} hair${profile.hair.style ? ` styled ${profile.hair.style}` : ""}`
  );

  // Eyes
  parts.push(`${profile.eyes.color} ${profile.eyes.shape} eyes`);

  // Skin
  parts.push(`${profile.skin_tone} skin tone`);

  // Face
  parts.push(`${profile.face.shape} face shape`);

  // Distinctive features
  if (profile.distinctive_features.length > 0) {
    parts.push(`Notable features: ${profile.distinctive_features.join(", ")}`);
  }

  // Clothing
  if (profile.clothing) {
    parts.push(`Wearing: ${profile.clothing}`);
  }

  return parts.join(". ") + ".";
}

export function profileToPromptSummary(profile: CharacterProfile): string {
  // Shorter version for image prompts - includes clothing for consistency
  const features = [
    `${profile.approx_age.replace("_", " ")} ${profile.gender_presentation}`,
    `${profile.hair.color} ${profile.hair.texture} hair`,
    `${profile.eyes.color} eyes`,
    `${profile.skin_tone} skin`,
  ];

  if (profile.distinctive_features.length > 0) {
    features.push(profile.distinctive_features.slice(0, 2).join(", "));
  }

  // Include clothing for consistency across pages
  if (profile.clothing) {
    features.push(`wearing ${profile.clothing}`);
  }

  return features.join(", ");
}

export function getIdentityAnchors(profile: CharacterProfile): string[] {
  // These are the features that MUST remain consistent across all illustrations
  return [
    `${profile.hair.color} ${profile.hair.texture} hair`,
    `${profile.eyes.color} eyes`,
    `${profile.skin_tone} skin tone`,
    ...profile.distinctive_features,
    ...profile.do_not_change,
  ];
}
