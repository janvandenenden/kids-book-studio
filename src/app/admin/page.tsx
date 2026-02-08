"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropBibleEditor } from "@/components/PropBibleEditor";
import type { StoryboardPanel, Storyboard, PropBible, StoryIndexEntry } from "@/types";
import type { ImageModel } from "@/lib/replicate";

interface StoredStoryboard {
  storyId: string;
  createdAt: string;
  updatedAt: string;
  panels: StoryboardPanel[];
}

interface StoredCharacter {
  id: string;
  name: string;
  description: string;
  profile: Record<string, unknown>;
  characterSheetUrl: string;
  createdAt: string;
  updatedAt: string;
}

type GenerationStatus = "idle" | "generating" | "complete" | "error";
type CharacterType = "boy" | "girl" | "child";
type AdminTab = "characters" | "props-bible" | "storyboard";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Tab navigation
  const [activeTab, setActiveTab] = useState<AdminTab>("storyboard");

  const [storyboard, setStoryboard] = useState<StoredStoryboard | null>(null);
  const [story, setStory] = useState<Storyboard | null>(null);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 12 });
  const [regeneratingPage, setRegeneratingPage] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Simple settings for storyboard generation
  const [characterType, setCharacterType] = useState<CharacterType>("child");
  const [selectedModel, setSelectedModel] = useState<ImageModel>("nano-banana");
  const [pageLimit, setPageLimit] = useState<number>(3); // Default to 3 for testing
  const [isDownloading, setIsDownloading] = useState(false);

  // Character management
  const [savedCharacters, setSavedCharacters] = useState<StoredCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<StoredCharacter | null>(null);
  const [sessionCharacter, setSessionCharacter] = useState<{
    name: string;
    description: string;
    characterSheetUrl: string;
    profile?: Record<string, unknown>;
  } | null>(null);
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);

  // Story selection for storyboard
  const [availableStories, setAvailableStories] = useState<StoryIndexEntry[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>("adventure-story");

  // Prop Bible
  const [propBible, setPropBible] = useState<PropBible | null>(null);
  const [usePropBible, setUsePropBible] = useState(true);

  // Auth header for API calls
  const getAuthHeader = () => ({
    Authorization: `Bearer ${password}`,
  });

  // Check if already authenticated (e.g., no password required)
  useEffect(() => {
    // Try to load storyboard without auth first
    loadStoryboard();
    loadSavedCharacters();
    loadSessionCharacter();
    loadPropBible();
    loadAvailableStories();
  }, []);

  // Reload storyboard when selected story changes
  useEffect(() => {
    if (isAuthenticated) {
      loadStoryboard();
    }
  }, [selectedStoryId]);

  const loadAvailableStories = async () => {
    try {
      const response = await fetch("/api/admin/stories", {
        headers: password ? getAuthHeader() : {},
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableStories(data.stories || []);
      }
    } catch (error) {
      console.error("Failed to load stories:", error);
    }
  };

  const loadPropBible = async () => {
    try {
      const response = await fetch("/api/admin/prop-bible", {
        headers: password ? getAuthHeader() : {},
      });

      if (response.ok) {
        const data = await response.json();
        setPropBible(data.propBible);
      }
    } catch (error) {
      console.error("Failed to load prop bible:", error);
    }
  };

  const handleSavePropBible = async (updatedPropBible: PropBible) => {
    const response = await fetch("/api/admin/prop-bible", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        propBible: updatedPropBible,
        storyId: selectedStoryId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save prop bible");
    }

    const data = await response.json();
    setPropBible(data.propBible);
  };

  const loadSessionCharacter = () => {
    // Load character from sessionStorage (from the normal user flow)
    const bookDataStr = sessionStorage.getItem("bookData");
    if (bookDataStr) {
      try {
        const data = JSON.parse(bookDataStr);
        if (data.childName && data.characterDescription && data.characterSheetUrl) {
          setSessionCharacter({
            name: data.childName,
            description: data.characterDescription,
            characterSheetUrl: data.characterSheetUrl,
            profile: data.characterProfile,
          });
        }
      } catch {
        console.error("Failed to parse session character");
      }
    }
  };

  const loadSavedCharacters = async () => {
    try {
      const response = await fetch("/api/admin/character", {
        headers: password ? getAuthHeader() : {},
      });

      if (response.ok) {
        const data = await response.json();
        setSavedCharacters(data.characters || []);
        // Auto-select first character if none selected
        if (data.characters?.length > 0 && !selectedCharacter) {
          setSelectedCharacter(data.characters[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load saved characters:", error);
    }
  };

  const handleSaveCharacter = async () => {
    if (!sessionCharacter) return;

    setIsSavingCharacter(true);
    try {
      const response = await fetch("/api/admin/character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          name: sessionCharacter.name,
          description: sessionCharacter.description,
          profile: sessionCharacter.profile || {},
          characterSheetUrl: sessionCharacter.characterSheetUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save character");
      }

      // Reload characters list
      await loadSavedCharacters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save character");
    } finally {
      setIsSavingCharacter(false);
    }
  };

  const handleLoadCharacterToSession = (character: StoredCharacter) => {
    // Load saved character into sessionStorage so it can be used in /preview
    const bookData = {
      childName: character.name,
      characterDescription: character.description,
      characterSheetUrl: character.characterSheetUrl,
      characterProfile: character.profile,
      photoPath: "", // Not needed when using saved character
      model: selectedModel,
      pageLimit: pageLimit,
    };

    sessionStorage.setItem("bookData", JSON.stringify(bookData));
    setSessionCharacter({
      name: character.name,
      description: character.description,
      characterSheetUrl: character.characterSheetUrl,
      profile: character.profile,
    });
    setSelectedCharacter(character);

    alert("Character loaded! You can now go to /preview to test generation.");
  };

  const handleDeleteCharacter = async (character: StoredCharacter) => {
    if (!confirm(`Delete "${character.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/character?id=${character.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete character");
      }

      // Clear selection if deleted character was selected
      if (selectedCharacter?.id === character.id) {
        setSelectedCharacter(null);
      }

      // Reload characters list
      await loadSavedCharacters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete character");
    }
  };

  const handleAuth = async () => {
    setAuthError("");
    try {
      const response = await fetch("/api/admin/storyboard", {
        headers: getAuthHeader(),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        const data = await response.json();
        setStoryboard(data.storyboard);
        setStory(data.story);
      } else if (response.status === 401) {
        setAuthError("Invalid password");
      } else {
        setAuthError("Authentication failed");
      }
    } catch {
      setAuthError("Connection error");
    }
  };

  const loadStoryboard = async () => {
    try {
      const response = await fetch(`/api/admin/storyboard?storyId=${selectedStoryId}`, {
        headers: password ? getAuthHeader() : {},
      });

      if (response.ok) {
        setIsAuthenticated(true);
        const data = await response.json();
        setStoryboard(data.storyboard);
        setStory(data.story);
      } else if (response.status === 401) {
        // Need password
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Failed to load storyboard:", error);
    }
  };

  const generateStoryboard = async () => {
    setStatus("generating");
    setError(null);
    const totalPanels = pageLimit || story?.pages.length || 12;
    setProgress({ current: 0, total: totalPanels });

    try {
      const response = await fetch("/api/storyboard-panels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          characterType,
          model: selectedModel,
          pageLimit: pageLimit || undefined,
          usePropBible,
          storyId: selectedStoryId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate storyboard");
      }

      const data = await response.json();

      // Save the generated storyboard
      await saveStoryboard(data.panels);

      // Reload to refresh both storyboard and story data
      await loadStoryboard();

      setProgress({
        current: data.panelsGenerated,
        total: data.totalPanels,
      });
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const saveStoryboard = async (panels: StoryboardPanel[], downloadImages: boolean = false) => {
    if (downloadImages) {
      setIsDownloading(true);
    } else {
      setIsSaving(true);
    }

    try {
      const response = await fetch("/api/admin/storyboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          panels,
          storyId: selectedStoryId,
          downloadImages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save storyboard");
      }

      const data = await response.json();
      setStoryboard(data.storyboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
      setIsDownloading(false);
    }
  };

  const handleDownloadImages = async () => {
    if (!storyboard) return;
    await saveStoryboard(storyboard.panels, true);
  };

  const handleApprove = async (pageNumber: number) => {
    if (!storyboard) return;

    const panel = storyboard.panels.find((p) => p.page === pageNumber);
    if (!panel) return;

    try {
      const response = await fetch("/api/admin/storyboard", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          pageNumber,
          updates: { approved: !panel.approved },
          storyId: selectedStoryId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update panel");
      }

      const data = await response.json();
      setStoryboard(data.storyboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleRegenerate = async (pageNumber: number) => {
    if (!story) {
      setError("No story loaded");
      return;
    }

    const pageData = story.pages.find((p) => p.page === pageNumber);
    if (!pageData) return;

    setRegeneratingPage(pageNumber);

    try {
      const response = await fetch("/api/storyboard-panels/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          pageNumber,
          pageData,
          characterType,
          model: selectedModel,
          usePropBible,
          storyId: selectedStoryId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate panel");
      }

      const data = await response.json();

      // Update the stored storyboard with the new panel
      if (storyboard) {
        const updatedPanels = storyboard.panels.map((p) =>
          p.page === pageNumber ? { ...data.panel, approved: false } : p
        );
        await saveStoryboard(updatedPanels);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setRegeneratingPage(null);
    }
  };

  const handleApproveAll = async () => {
    if (!storyboard) return;

    const updatedPanels = storyboard.panels.map((p) => ({
      ...p,
      approved: true,
    }));

    await saveStoryboard(updatedPanels);
  };

  // Auth screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                placeholder="Enter admin password"
              />
            </div>
            {authError && (
              <p className="text-sm text-red-500">{authError}</p>
            )}
            <Button onClick={handleAuth} className="w-full">
              Login
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Set ADMIN_PASSWORD in .env.local to enable auth.
              <br />
              Leave empty for dev mode (no auth).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allApproved =
    storyboard &&
    storyboard.panels.length > 0 &&
    storyboard.panels.every((p) => p.approved);

  const approvedCount = storyboard?.panels.filter((p) => p.approved).length || 0;

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: "characters", label: "Characters", icon: "👤" },
    { id: "props-bible", label: "Props Bible", icon: "📖" },
    { id: "storyboard", label: "Storyboard", icon: "🎬" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Manage characters, props, and storyboard panels
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Error Display (shown on all tabs) */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Characters Tab */}
        {activeTab === "characters" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Characters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Saved Characters Grid */}
                {savedCharacters.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      {savedCharacters.length} saved character{savedCharacters.length !== 1 ? "s" : ""}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {savedCharacters.map((character) => (
                        <div
                          key={character.id}
                          className={`p-4 rounded-lg border space-y-3 ${
                            selectedCharacter?.id === character.id
                              ? "border-primary bg-primary/5"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {character.characterSheetUrl && (
                              <img
                                src={character.characterSheetUrl}
                                alt={character.name}
                                className="w-20 h-20 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{character.name}</p>
                              <p className="text-xs text-gray-500 line-clamp-3">
                                {character.description}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Created: {new Date(character.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={selectedCharacter?.id === character.id ? "default" : "outline"}
                              onClick={() => handleLoadCharacterToSession(character)}
                              className="flex-1"
                            >
                              {selectedCharacter?.id === character.id ? "✓ Loaded" : "Load"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCharacter(character)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <div className="text-4xl mb-3">👤</div>
                    <p className="text-gray-600 font-medium">No saved characters yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Complete the user flow first, then save the character for reuse.
                    </p>
                  </div>
                )}

                {/* Session Character (from user flow) */}
                {sessionCharacter && !savedCharacters.some(c => c.name === sessionCharacter.name) && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <div className="flex items-start gap-4">
                      {sessionCharacter.characterSheetUrl && (
                        <img
                          src={sessionCharacter.characterSheetUrl}
                          alt={sessionCharacter.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-blue-800">New in Session: {sessionCharacter.name}</p>
                        <p className="text-sm text-blue-700 line-clamp-2">{sessionCharacter.description}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveCharacter}
                      disabled={isSavingCharacter}
                      className="w-full"
                    >
                      {isSavingCharacter ? "Saving..." : "Save Character Locally"}
                    </Button>
                  </div>
                )}

                {savedCharacters.length === 0 && !sessionCharacter && (
                  <p className="text-sm text-gray-500">
                    Go through the user flow (upload photo → analyze → approve character) first,
                    then come back here to save the character for repeated testing.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Props Bible Tab */}
        {activeTab === "props-bible" && (
          <div className="space-y-6">
            {propBible ? (
              <PropBibleEditor
                propBible={propBible}
                onSave={handleSavePropBible}
                getAuthHeader={getAuthHeader}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-4xl mb-4">📖</div>
                  <p className="text-gray-600 mb-4">
                    No prop bible loaded yet.
                  </p>
                  <Button onClick={loadPropBible}>
                    Load Prop Bible
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Storyboard Tab */}
        {activeTab === "storyboard" && (
          <div className="space-y-6">
            {/* Generation Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Generation Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Story</label>
                  <select
                    value={selectedStoryId}
                    onChange={(e) => setSelectedStoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    disabled={status === "generating"}
                  >
                    <option value="adventure-story">Adventure Story (default)</option>
                    {availableStories
                      .filter((s) => !s.isLegacy)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Phase {s.currentPhase}{s.templateReady ? " - template ready" : ""})
                        </option>
                      ))}
                  </select>
                  {selectedStoryId !== "adventure-story" && (
                    <p className="text-xs text-blue-600">
                      Pipeline story selected — will use Phase 5 panel briefs for generation
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Character Type</label>
                  <select
                    value={characterType}
                    onChange={(e) => setCharacterType(e.target.value as CharacterType)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    disabled={status === "generating"}
                  >
                    <option value="child">Child (neutral)</option>
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    Generic outline shown in storyboard sketches
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Model</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value as ImageModel)}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                      disabled={status === "generating"}
                    >
                      <option value="nano-banana">Nano Banana (Budget)</option>
                      <option value="nano-banana-pro">Nano Banana Pro (Best)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Page Limit (for testing)</label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={pageLimit}
                      onChange={(e) => setPageLimit(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                      disabled={status === "generating"}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="usePropBible"
                    checked={usePropBible}
                    onChange={(e) => setUsePropBible(e.target.checked)}
                    disabled={status === "generating"}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="usePropBible" className="text-sm font-medium">
                    Use Prop Bible
                  </label>
                  <span className="text-xs text-gray-500">
                    (Inject consistent prop & environment descriptions)
                  </span>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={generateStoryboard}
                    disabled={status === "generating"}
                  >
                    {status === "generating"
                      ? `Generating (${progress.current}/${progress.total})...`
                      : storyboard
                      ? "Regenerate All Panels"
                      : `Generate ${pageLimit} Panels`}
                  </Button>
                  <Button variant="outline" onClick={loadStoryboard}>
                    Reload
                  </Button>
                </div>

                {status === "generating" && (
                  <div className="space-y-2">
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.max(5, (progress.current / progress.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                      Rate-limited: ~12 seconds between each panel
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Storyboard Status */}
            {storyboard && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Current Storyboard</CardTitle>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {approvedCount} of {storyboard.panels.length} approved
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApproveAll}
                        disabled={allApproved || isSaving || isDownloading}
                      >
                        Approve All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Story: {storyboard.storyId}</p>
                    <p>Created: {new Date(storyboard.createdAt).toLocaleString()}</p>
                    <p>Updated: {new Date(storyboard.updatedAt).toLocaleString()}</p>
                  </div>

                  {/* Check if images are still remote URLs */}
                  {storyboard.panels.some(p => p.sketchUrl?.startsWith("http")) && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 mb-2">
                        Images are stored as Replicate URLs which expire in ~1 hour.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleDownloadImages}
                        disabled={isDownloading || isSaving}
                      >
                        {isDownloading ? "Downloading..." : "Download Images Locally"}
                      </Button>
                    </div>
                  )}

                  {/* Show success if all images are local */}
                  {storyboard.panels.length > 0 &&
                   storyboard.panels.every(p => p.sketchUrl?.startsWith("/")) && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        All images saved locally in /public/storyboard/{selectedStoryId}/
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Panels Grid */}
            {storyboard && storyboard.panels.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {storyboard.panels.map((panel) => {
                  const pageData = story?.pages.find((p) => p.page === panel.page);
                  const isRegenerating = regeneratingPage === panel.page;

                  return (
                    <Card
                      key={panel.page}
                      className={`overflow-hidden ${
                        panel.approved ? "ring-2 ring-green-500" : ""
                      }`}
                    >
                      <CardContent className="p-0">
                        {/* Panel Image */}
                        <div className="relative aspect-[3/2] bg-gray-100">
                          {isRegenerating ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-3xl mb-2 animate-bounce">
                                  Sketching...
                                </div>
                              </div>
                            </div>
                          ) : panel.sketchUrl ? (
                            <img
                              src={panel.sketchUrl}
                              alt={`Panel ${panel.page}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <p className="text-gray-400">No sketch</p>
                            </div>
                          )}

                          {panel.approved && !isRegenerating && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                              Approved
                            </div>
                          )}

                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            Text: {panel.textPlacement}
                          </div>
                        </div>

                        {/* Panel Info */}
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              Page {panel.page}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 line-clamp-2">
                            {panel.scene}
                          </p>

                          {pageData && (
                            <p className="text-xs text-gray-600 italic line-clamp-2 border-l-2 border-gray-200 pl-2">
                              &ldquo;{pageData.text}&rdquo;
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              variant={panel.approved ? "outline" : "default"}
                              size="sm"
                              className="flex-1"
                              onClick={() => handleApprove(panel.page)}
                              disabled={isRegenerating || isSaving}
                            >
                              {panel.approved ? "Unapprove" : "Approve"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRegenerate(panel.page)}
                              disabled={isRegenerating}
                            >
                              {isRegenerating ? "..." : "Regen"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {(!storyboard || storyboard.panels.length === 0) && status !== "generating" && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-4xl mb-4">🎬</div>
                  <p className="text-gray-600 mb-4">
                    Click &ldquo;Generate Storyboard&rdquo; to create B&W composition sketch panels
                    for the adventure story.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
