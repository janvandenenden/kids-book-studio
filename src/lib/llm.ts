import OpenAI from "openai";
import { CharacterProfile } from "@/types";
import { validateCharacterProfile } from "./character-profile";

// Lazy initialization to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

const CHARACTER_ANALYSIS_PROMPT = `Analyze this child's photo and extract a detailed character description for creating consistent children's book illustrations.

Return ONLY a valid JSON object (no markdown, no code blocks) with these exact fields:
{
  "character_name": "(use the provided name)",
  "approx_age": "toddler" | "young_child" | "older_child",
  "gender_presentation": "boy" | "girl" | "neutral",
  "hair": {
    "color": "specific color like 'light brown', 'blonde', 'black'",
    "length": "short/medium/long",
    "texture": "straight" | "wavy" | "curly" | "coily",
    "style": "description of style like 'ponytail', 'loose', 'braids'"
  },
  "face": {
    "shape": "round" | "oval" | "heart",
    "expression_default": "description like 'cheerful smile', 'curious look'"
  },
  "eyes": {
    "color": "specific color like 'brown', 'blue', 'green'",
    "shape": "description like 'large and round', 'almond-shaped'"
  },
  "skin_tone": "descriptive term like 'fair', 'light', 'medium', 'tan', 'brown', 'dark'",
  "distinctive_features": ["array of notable features like 'freckles', 'dimples', 'glasses', 'gap in teeth'"],
  "clothing": "FULL outfit description - top, bottom, and shoes. If any part is not visible in the photo, choose neutral child-appropriate options (e.g., 'blue jeans' for pants, 'white sneakers' for shoes). Always describe a complete outfit.",
  "color_palette": ["2-3 colors that suit this character"],
  "personality_traits": ["inferred traits like 'curious', 'playful', 'shy'"],
  "do_not_change": ["list of identity anchors that must stay constant - hair color, eye color, distinctive features"]
}

IMPORTANT for clothing: Always provide a COMPLETE outfit (top + bottom + shoes). If the photo only shows the upper body, invent appropriate neutral clothing for the lower body (like "blue jeans and white sneakers" or "khaki shorts and sandals").

Focus only on recognizable visual traits. Ignore background details. Be specific with colors and descriptions.`;

export async function analyzeCharacterFromImage(
  imageBase64: string,
  childName: string
): Promise<{ profile: CharacterProfile; description: string }> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${CHARACTER_ANALYSIS_PROMPT}\n\nThe child's name is: ${childName}`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Parse JSON response (handle potential markdown code blocks)
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
  }

  let profileData: unknown;
  try {
    profileData = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse character profile JSON: ${content}`);
  }

  // Ensure the name is set correctly
  if (typeof profileData === "object" && profileData !== null) {
    (profileData as Record<string, unknown>).character_name = childName;
  }

  const profile = validateCharacterProfile(profileData);

  // Generate human-readable description
  const description = generateDescription(profile);

  return { profile, description };
}

function generateDescription(profile: CharacterProfile): string {
  const lines: string[] = [];

  // Opening
  const ageDesc =
    profile.approx_age === "toddler"
      ? "a toddler"
      : profile.approx_age === "young_child"
        ? "a young child"
        : "a child";
  lines.push(
    `${profile.character_name} is ${ageDesc} with a ${profile.face.expression_default}.`
  );

  // Hair
  lines.push(
    `${profile.character_name} has ${profile.hair.length}, ${profile.hair.color} ${profile.hair.texture} hair${profile.hair.style ? `, worn ${profile.hair.style}` : ""}.`
  );

  // Eyes and face
  lines.push(
    `${profile.character_name} has ${profile.eyes.shape} ${profile.eyes.color} eyes and a ${profile.face.shape} face.`
  );

  // Skin
  lines.push(`Skin tone: ${profile.skin_tone}.`);

  // Distinctive features
  if (profile.distinctive_features.length > 0) {
    lines.push(`Notable features: ${profile.distinctive_features.join(", ")}.`);
  }

  // Clothing - important for consistency across pages
  if (profile.clothing) {
    lines.push(`Clothing: ${profile.clothing}.`);
  }

  // Personality (for story context)
  if (profile.personality_traits.length > 0) {
    lines.push(
      `${profile.character_name} appears ${profile.personality_traits.join(", ")}.`
    );
  }

  return lines.join(" ");
}
