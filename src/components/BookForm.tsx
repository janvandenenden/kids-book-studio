"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IMAGE_MODELS, ImageModel } from "@/lib/replicate";

type Step = "upload" | "description" | "character" | "story";

// Check if dev mode is enabled
const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

interface SavedCharacter {
  id: string;
  name: string;
  description: string;
  profile: Record<string, unknown>;
  characterSheetUrl: string;
  updatedAt: string;
}

export function BookForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [childName, setChildName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterSheetUrl, setCharacterSheetUrl] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ImageModel>(
    isDevMode ? "nano-banana" : "nano-banana-pro"
  );
  const [pageLimit, setPageLimit] = useState<number>(isDevMode ? 3 : 12);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Story selection
  const [availableStories, setAvailableStories] = useState<Array<{ id: string; name: string; isLegacy: boolean }>>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>("adventure-story");

  // Saved characters for quick selection
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [selectedSavedCharacter, setSelectedSavedCharacter] = useState<SavedCharacter | null>(null);

  // Load saved characters and available stories on mount
  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await fetch("/api/characters");
        if (response.ok) {
          const data = await response.json();
          setSavedCharacters(data.characters || []);
        }
      } catch (error) {
        console.error("Failed to load saved characters:", error);
      }
    };
    const loadStories = async () => {
      try {
        const response = await fetch("/api/stories");
        if (response.ok) {
          const data = await response.json();
          setAvailableStories(data.stories || []);
        }
      } catch (error) {
        console.error("Failed to load stories:", error);
      }
    };
    loadCharacters();
    loadStories();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setSelectedSavedCharacter(null); // Clear saved character selection
      setError(null);
    }
  }, []);

  // Use a saved character (skip to create book)
  const handleUseSavedCharacter = (character: SavedCharacter) => {
    setSelectedSavedCharacter(character);
    setChildName(character.name);
    setCharacterDescription(character.description);
    setCharacterSheetUrl(character.characterSheetUrl);
    setPhotoPreview(character.characterSheetUrl); // Use character sheet as preview
    setError(null);
  };

  // Create book with saved character
  const handleCreateBookWithSavedCharacter = () => {
    if (!selectedSavedCharacter) return;

    // If multiple stories available, go to story selection
    if (availableStories.length > 1) {
      setChildName(selectedSavedCharacter.name);
      setCharacterDescription(selectedSavedCharacter.description);
      setCharacterSheetUrl(selectedSavedCharacter.characterSheetUrl);
      setStep("story");
      return;
    }

    sessionStorage.setItem(
      "bookData",
      JSON.stringify({
        childName: selectedSavedCharacter.name,
        characterDescription: selectedSavedCharacter.description,
        characterSheetUrl: selectedSavedCharacter.characterSheetUrl,
        characterProfile: selectedSavedCharacter.profile,
        photoPath: "",
        model: selectedModel,
        pageLimit: pageLimit,
        storyId: selectedStoryId,
      })
    );
    router.push("/preview");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // Step 1: Upload photo and analyze
  const handleUploadAndAnalyze = async () => {
    setError(null);

    if (!childName.trim()) {
      setError("Please enter your child's name");
      return;
    }

    if (!photo) {
      setError("Please upload a photo");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Uploading photo...");

    try {
      // Upload photo
      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("name", childName.trim());

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const data = await uploadResponse.json();
        throw new Error(data.error || "Upload failed");
      }

      const uploadData = await uploadResponse.json();
      setPhotoPath(uploadData.filePath);

      // Analyze photo
      setLoadingMessage("Analyzing photo...");
      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoPath: uploadData.filePath,
          childName: childName.trim(),
        }),
      });

      if (!analyzeResponse.ok) {
        const data = await analyzeResponse.json();
        throw new Error(data.error || "Analysis failed");
      }

      const analyzeData = await analyzeResponse.json();
      setCharacterDescription(analyzeData.description);
      setStep("description");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Step 2: Generate character sheet
  const handleGenerateCharacterSheet = async () => {
    if (!characterDescription.trim()) {
      setError("Please provide a character description");
      return;
    }

    if (!photoPath) {
      setError("Missing photo reference");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Creating character illustration...");
    setError(null);

    try {
      const response = await fetch("/api/character-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterDescription: characterDescription.trim(),
          photoPath: photoPath,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate character");
      }

      const data = await response.json();
      setCharacterSheetUrl(data.characterSheetUrl);
      setStep("character");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Step 3: Create book (goes to story selection if multiple stories, else directly to preview)
  const handleCreateBook = () => {
    if (availableStories.length > 1) {
      setStep("story");
      return;
    }

    sessionStorage.setItem(
      "bookData",
      JSON.stringify({
        childName: childName.trim(),
        characterDescription: characterDescription.trim(),
        characterSheetUrl,
        photoPath,
        model: selectedModel,
        pageLimit: isDevMode ? pageLimit : undefined,
        storyId: selectedStoryId,
      })
    );
    router.push("/preview");
  };

  // Step 4: Start book with selected story
  const handleStartWithStory = () => {
    sessionStorage.setItem(
      "bookData",
      JSON.stringify({
        childName: childName.trim(),
        characterDescription: characterDescription.trim(),
        characterSheetUrl,
        photoPath,
        model: selectedModel,
        pageLimit: isDevMode ? pageLimit : undefined,
        storyId: selectedStoryId,
      })
    );
    router.push("/preview");
  };

  // Regenerate character sheet with same description
  const handleRegenerateCharacter = () => {
    handleGenerateCharacterSheet();
  };

  // Save character locally for dev testing (skips going to /preview)
  const handleSaveCharacterLocally = async () => {
    if (!characterSheetUrl || !characterDescription) return;

    setIsLoading(true);
    setLoadingMessage("Saving character...");
    setError(null);

    try {
      const response = await fetch("/api/admin/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: childName.trim(),
          description: characterDescription.trim(),
          profile: {},
          characterSheetUrl,
          storyId: "adventure-story",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save character");
      }

      alert("Character saved! Go to /admin to load it for testing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === "description") {
      setStep("upload");
    } else if (step === "character") {
      setStep("description");
    } else if (step === "story") {
      setStep("character");
    }
  };

  const getStepIndicator = () => {
    const steps = availableStories.length > 1
      ? ["Photo", "Description", "Character", "Story"]
      : ["Photo", "Description", "Character"];
    const currentIndex = step === "upload" ? 0 : step === "description" ? 1 : step === "character" ? 2 : 3;

    return (
      <div className="flex justify-center gap-2 mb-4">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= currentIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  i < currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Create Your Book</CardTitle>
        {getStepIndicator()}
      </CardHeader>
      <CardContent>
        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            {/* Saved Characters Section */}
            {savedCharacters.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Saved Characters</label>
                <div className="grid grid-cols-2 gap-2">
                  {savedCharacters.map((character) => (
                    <button
                      key={character.id}
                      onClick={() => handleUseSavedCharacter(character)}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        selectedSavedCharacter?.id === character.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "border-input hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={character.characterSheetUrl}
                          alt={character.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{character.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {character.description.slice(0, 30)}...
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedSavedCharacter && (
                  <div className="p-3 bg-primary/5 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={selectedSavedCharacter.characterSheetUrl}
                        alt={selectedSavedCharacter.name}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{selectedSavedCharacter.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {selectedSavedCharacter.description}
                        </p>
                      </div>
                    </div>

                    {/* Page limit selector */}
                    <div className="flex items-center gap-3">
                      <label htmlFor="pageLimit" className="text-sm font-medium whitespace-nowrap">
                        Pages to generate:
                      </label>
                      <Input
                        id="pageLimit"
                        type="number"
                        min={1}
                        max={12}
                        value={pageLimit}
                        onChange={(e) => setPageLimit(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-20"
                      />
                      <span className="text-xs text-muted-foreground">of 12</span>
                    </div>

                    <Button
                      onClick={handleCreateBookWithSavedCharacter}
                      className="w-full"
                    >
                      Create Book with {selectedSavedCharacter.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSavedCharacter(null)}
                      className="w-full"
                    >
                      Or create new character below
                    </Button>
                  </div>
                )}

                {!selectedSavedCharacter && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or create new
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* New Character Form (hidden if saved character selected) */}
            {!selectedSavedCharacter && (
              <>
                <div className="space-y-2">
                  <label htmlFor="childName" className="text-sm font-medium">
                    Child&apos;s Name
                  </label>
                  <Input
                    id="childName"
                    type="text"
                    placeholder="Enter your child's name"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Photo</label>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <input {...getInputProps()} />
                    {photoPreview ? (
                      <div className="space-y-2">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="mx-auto max-h-40 rounded-lg object-cover"
                        />
                        <p className="text-sm text-muted-foreground">
                          Click or drag to replace
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-4xl">📷</div>
                        <p className="text-sm text-muted-foreground">
                          {isDragActive
                            ? "Drop the photo here..."
                            : "Drag & drop a photo, or click to select"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          A clear face photo works best
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button
                  onClick={handleUploadAndAnalyze}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      {loadingMessage}
                    </span>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Description */}
        {step === "description" && (
          <div className="space-y-6">
            <div className="flex justify-center gap-4">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Original"
                  className="h-24 rounded-lg object-cover"
                />
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Character Description
              </label>
              <p className="text-xs text-muted-foreground">
                We&apos;ll use this to create your child&apos;s illustrated character. Feel free to edit!
              </p>
              <textarea
                id="description"
                value={characterDescription}
                onChange={(e) => setCharacterDescription(e.target.value)}
                className="w-full min-h-[120px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., A 5-year-old girl with curly brown hair, big brown eyes, and light skin with rosy cheeks..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Image Model</label>
              <p className="text-xs text-muted-foreground">
                Choose the AI model for generating illustrations
              </p>
              <div className="grid gap-2">
                {(Object.keys(IMAGE_MODELS) as ImageModel[]).map((modelKey) => {
                  const model = IMAGE_MODELS[modelKey];
                  return (
                    <label
                      key={modelKey}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedModel === modelKey
                          ? "border-primary bg-primary/5"
                          : "border-input hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={modelKey}
                        checked={selectedModel === modelKey}
                        onChange={() => setSelectedModel(modelKey)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm">{model.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {model.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {isDevMode && (
              <div className="space-y-2 p-3 rounded-lg border border-yellow-300 bg-yellow-50">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600 text-sm font-medium">Dev Mode</span>
                </div>
                <div className="space-y-1">
                  <label htmlFor="pageLimit" className="text-sm font-medium">
                    Page Limit (for testing)
                  </label>
                  <Input
                    id="pageLimit"
                    type="number"
                    min={1}
                    max={12}
                    value={pageLimit}
                    onChange={(e) => setPageLimit(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Generate only {pageLimit} page{pageLimit !== 1 ? "s" : ""} to save costs
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1" disabled={isLoading}>
                ← Back
              </Button>
              <Button onClick={handleGenerateCharacterSheet} className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Creating...
                  </span>
                ) : (
                  "Create Character"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Character Review */}
        {step === "character" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Character</label>
              <p className="text-xs text-muted-foreground">
                This is how {childName} will appear in the story. You can regenerate if needed.
              </p>
            </div>

            <div className="flex justify-center gap-4">
              {photoPreview && (
                <div className="text-center">
                  <img
                    src={photoPreview}
                    alt="Original photo"
                    className="h-32 rounded-lg object-cover mx-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Original</p>
                </div>
              )}
              {characterSheetUrl && (
                <div className="text-center">
                  <img
                    src={characterSheetUrl}
                    alt="Character illustration"
                    className="h-32 rounded-lg object-cover mx-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Character</p>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1" disabled={isLoading}>
                ← Edit
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerateCharacter}
                disabled={isLoading}
              >
                {isLoading ? "..." : "🔄"}
              </Button>
              <Button onClick={handleCreateBook} className="flex-1" disabled={isLoading}>
                Create Book
              </Button>
            </div>

            {/* Dev: Save character for testing */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveCharacterLocally}
              disabled={isLoading}
              className="w-full text-muted-foreground"
            >
              {isLoading && loadingMessage.includes("Saving") ? "Saving..." : "Save character for testing"}
            </Button>
          </div>
        )}

        {/* Step 4: Story Selection */}
        {step === "story" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Choose a Story</label>
              <p className="text-xs text-muted-foreground">
                Select which story {childName} will star in.
              </p>
            </div>

            <div className="grid gap-3">
              {availableStories.map((story) => (
                <button
                  key={story.id}
                  onClick={() => setSelectedStoryId(story.id)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedStoryId === story.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium">{story.name}</p>
                  {story.isLegacy && (
                    <span className="text-xs text-muted-foreground">Original story</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button onClick={handleStartWithStory} className="flex-1">
                Create Book
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
