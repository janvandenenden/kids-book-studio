"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropBible, Prop, Environment } from "@/types";
import storyData from "@/templates/adventure-story/story.json";

interface PropBibleEditorProps {
  propBible: PropBible;
  onSave: (propBible: PropBible) => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

type TabType = "global" | "compositions" | "props" | "environments" | "preview";

export function PropBibleEditor({
  propBible: initialPropBible,
  onSave,
}: PropBibleEditorProps) {
  const [propBible, setPropBible] = useState<PropBible>(initialPropBible);
  const [activeTab, setActiveTab] = useState<TabType>("global");
  const [isSaving, setIsSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newItemKey, setNewItemKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(propBible);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePropUpdate = (
    key: string,
    field: keyof Prop,
    value: string | number[],
  ) => {
    setPropBible({
      ...propBible,
      props: {
        ...propBible.props,
        [key]: {
          ...propBible.props[key],
          [field]: value,
        },
      },
    });
  };

  const handleEnvironmentUpdate = (
    key: string,
    field: keyof Environment,
    value: string | number[],
  ) => {
    setPropBible({
      ...propBible,
      environments: {
        ...propBible.environments,
        [key]: {
          ...propBible.environments[key],
          [field]: value,
        },
      },
    });
  };

  const handleDeleteProp = (key: string) => {
    const newProps = { ...propBible.props };
    delete newProps[key];
    setPropBible({ ...propBible, props: newProps });
  };

  const handleDeleteEnvironment = (key: string) => {
    const newEnvironments = { ...propBible.environments };
    delete newEnvironments[key];
    setPropBible({ ...propBible, environments: newEnvironments });
  };

  const handleAddProp = () => {
    if (!newItemKey.trim()) return;
    const key = newItemKey.trim().toLowerCase().replace(/\s+/g, "_");
    setPropBible({
      ...propBible,
      props: {
        ...propBible.props,
        [key]: {
          description: "",
          appearances: [],
        },
      },
    });
    setNewItemKey("");
    setEditingKey(key);
  };

  const handleAddEnvironment = () => {
    if (!newItemKey.trim()) return;
    const key = newItemKey.trim().toLowerCase().replace(/\s+/g, "_");
    setPropBible({
      ...propBible,
      environments: {
        ...propBible.environments,
        [key]: {
          description: "",
          appearances: [],
        },
      },
    });
    setNewItemKey("");
    setEditingKey(key);
  };

  const parseAppearances = (value: string): number[] => {
    return value
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  };

  // Build complete prompt preview for a page (mirrors server-side logic)
  const buildPromptPreview = (pageNum: number) => {
    // Get scene from story.json
    const storyPage = storyData.pages.find((p) => p.page === pageNum);
    const scene = storyPage?.scene || `[Scene ${pageNum}]`;

    const defaultCompositionHints: Record<string, string> = {
      wide: "wide shot showing full scene and environment",
      medium: "medium shot showing character and surroundings",
      close: "close-up shot focusing on character",
    };

    // Find props for this page
    const pageProps = Object.entries(propBible.props)
      .filter(([, prop]) => prop.appearances.includes(pageNum))
      .map(([, prop]) => prop.description);

    // Find environment for this page
    const pageEnv = Object.entries(propBible.environments).find(([, env]) =>
      env.appearances.includes(pageNum),
    );

    // Get composition from prop bible or use default
    const compositionHint =
      propBible.compositions?.[pageNum] || defaultCompositionHints["medium"];

    // Build prompt parts with line breaks for readability
    const parts: string[] = [];

    parts.push(`Scene: ${scene}`);

    parts.push(`\nComposition: ${compositionHint}`);

    if (pageEnv) {
      parts.push(`\nEnvironment: ${pageEnv[1].description}`);
    }

    if (pageProps.length > 0) {
      parts.push(`\nKey objects:\n${pageProps.map((p) => `  • ${p}`).join("\n")}`);
    }

    // Add global instructions if present
    if (propBible.globalInstructions) {
      parts.push(`\nInstructions: ${propBible.globalInstructions}`);
    }

    // Add style
    const stylePrompt =
      propBible.globalStyle ||
      "loose sketch, soft shapes, simplified forms, low detail, black and white only, no text, no border, minimal background";
    parts.push(`\nStyle: ${stylePrompt}`);

    return parts.join("");
  };

  // Get story text for a page
  const getStoryText = (pageNum: number): string | null => {
    const storyPage = storyData.pages.find((p) => p.page === pageNum);
    return storyPage?.text || null;
  };

  const compositionCount = propBible.compositions ? Object.keys(propBible.compositions).length : 0;

  const tabs: { id: TabType; label: string }[] = [
    { id: "global", label: "Global" },
    { id: "compositions", label: `Compositions (${compositionCount}/12)` },
    { id: "props", label: `Props (${Object.keys(propBible.props).length})` },
    {
      id: "environments",
      label: `Environments (${Object.keys(propBible.environments).length})`,
    },
    { id: "preview", label: "Prompts" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Prop Bible Editor</CardTitle>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 text-sm rounded-t ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Tab */}
        {activeTab === "global" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Global settings that apply to all panels. Style and instructions
              are always included in prompts.
            </p>

            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-4">
                <div>
                  <label className="text-sm font-medium">Global Style</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Art style applied to every panel (e.g., sketch style,
                    colors, detail level)
                  </p>
                  <textarea
                    value={propBible.globalStyle || ""}
                    onChange={(e) =>
                      setPropBible({
                        ...propBible,
                        globalStyle: e.target.value || undefined,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-md"
                    rows={3}
                    placeholder="loose sketch, soft shapes, simplified forms, low detail, black and white only..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Global Instructions
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Additional instructions included in every prompt (e.g.,
                    character constraints)
                  </p>
                  <textarea
                    value={propBible.globalInstructions || ""}
                    onChange={(e) =>
                      setPropBible({
                        ...propBible,
                        globalInstructions: e.target.value || undefined,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-md"
                    rows={2}
                    placeholder="Single child character only. Keep consistent proportions..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Props Tab */}
        {activeTab === "props" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New prop key (e.g., magic_wand)"
                value={newItemKey}
                onChange={(e) => setNewItemKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddProp()}
              />
              <Button onClick={handleAddProp} variant="outline">
                Add Prop
              </Button>
            </div>

            <div className="space-y-3">
              {Object.entries(propBible.props).map(([key, prop]) => (
                <div
                  key={key}
                  className={`p-3 border rounded-lg space-y-2 ${
                    editingKey === key ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{key}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteProp(key)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">
                        Description
                      </label>
                      <textarea
                        value={prop.description}
                        onChange={(e) =>
                          handlePropUpdate(key, "description", e.target.value)
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md"
                        rows={2}
                        placeholder="Describe this prop in detail for consistent generation..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">
                        Appears on pages (comma-separated)
                      </label>
                      <Input
                        value={prop.appearances.join(", ")}
                        onChange={(e) =>
                          handlePropUpdate(
                            key,
                            "appearances",
                            parseAppearances(e.target.value),
                          )
                        }
                        placeholder="1, 2, 3"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Environments Tab */}
        {activeTab === "environments" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New environment key (e.g., forest_clearing)"
                value={newItemKey}
                onChange={(e) => setNewItemKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEnvironment()}
              />
              <Button onClick={handleAddEnvironment} variant="outline">
                Add Environment
              </Button>
            </div>

            <div className="space-y-3">
              {Object.entries(propBible.environments).map(([key, env]) => (
                <div
                  key={key}
                  className={`p-3 border rounded-lg space-y-2 ${
                    editingKey === key ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{key}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteEnvironment(key)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">
                        Description
                      </label>
                      <textarea
                        value={env.description}
                        onChange={(e) =>
                          handleEnvironmentUpdate(
                            key,
                            "description",
                            e.target.value,
                          )
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md"
                        rows={2}
                        placeholder="Describe this environment in detail..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">
                        Appears on pages (comma-separated)
                      </label>
                      <Input
                        value={env.appearances.join(", ")}
                        onChange={(e) =>
                          handleEnvironmentUpdate(
                            key,
                            "appearances",
                            parseAppearances(e.target.value),
                          )
                        }
                        placeholder="1, 2, 3"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compositions Tab */}
        {activeTab === "compositions" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Camera angle and framing for each panel. These override the default composition hints from story.json.
            </p>

            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((pageNum) => (
                <div key={pageNum} className="flex items-start gap-3 p-2 border rounded-lg">
                  <span className="text-sm font-medium w-16 pt-2">Page {pageNum}</span>
                  <textarea
                    value={propBible.compositions?.[pageNum] || ""}
                    onChange={(e) => {
                      const newCompositions = {
                        ...(propBible.compositions || {}),
                        [pageNum]: e.target.value,
                      };
                      // Remove empty compositions
                      if (!e.target.value) {
                        delete newCompositions[pageNum];
                      }
                      setPropBible({
                        ...propBible,
                        compositions:
                          Object.keys(newCompositions).length > 0
                            ? newCompositions
                            : undefined,
                      });
                    }}
                    className="flex-1 px-3 py-2 text-sm border rounded-md"
                    rows={1}
                    placeholder="e.g., wide shot, medium shot from low angle, close-up on hands..."
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompts Tab */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Complete prompts for each page with story text from story.json.
            </p>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((pageNum) => {
                // Find props for this page
                const pageProps = Object.entries(propBible.props)
                  .filter(([, prop]) => prop.appearances.includes(pageNum))
                  .map(([key]) => key);

                // Find environment for this page
                const pageEnv = Object.entries(propBible.environments).find(
                  ([, env]) => env.appearances.includes(pageNum),
                );

                // Check if composition is defined for this page
                const hasComposition = !!propBible.compositions?.[pageNum];

                const fullPrompt = buildPromptPreview(pageNum);
                const storyText = getStoryText(pageNum);

                return (
                  <div
                    key={pageNum}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-lg">Page {pageNum}</span>
                      {hasComposition && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          custom composition
                        </span>
                      )}
                      {pageProps.length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                          {pageProps.join(", ")}
                        </span>
                      )}
                      {pageEnv && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                          {pageEnv[0]}
                        </span>
                      )}
                    </div>

                    {/* Story Text */}
                    {storyText && (
                      <div className="bg-amber-50 p-3 rounded border border-amber-200">
                        <div className="text-xs font-medium text-amber-700 mb-1">Story Text:</div>
                        <div className="text-sm text-amber-900 italic">{storyText}</div>
                      </div>
                    )}

                    {/* Prompt Preview */}
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono whitespace-pre-wrap text-gray-700 border">
                      {fullPrompt}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
