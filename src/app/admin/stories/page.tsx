"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhaseProgress } from "@/components/story-pipeline/PhaseProgress";
import { Phase0Editor } from "@/components/story-pipeline/Phase0Editor";
import { Phase1Editor } from "@/components/story-pipeline/Phase1Editor";
import { Phase2Editor } from "@/components/story-pipeline/Phase2Editor";
import { Phase4Editor } from "@/components/story-pipeline/Phase4Editor";
import { Phase5Editor } from "@/components/story-pipeline/Phase5Editor";
import type { StoryProject, StoryIndexEntry, PhaseStatus } from "@/types";

export default function AdminStoriesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [stories, setStories] = useState<StoryIndexEntry[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [project, setProject] = useState<StoryProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New story dialog
  const [showNewStory, setShowNewStory] = useState(false);
  const [newStoryName, setNewStoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const getAuthHeader = useCallback(() => ({
    Authorization: `Bearer ${password}`,
  }), [password]);

  // Auth check
  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const response = await fetch("/api/admin/stories", {
        headers: password ? getAuthHeader() : {},
      });

      if (response.ok) {
        setIsAuthenticated(true);
        const data = await response.json();
        setStories(data.stories || []);
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Failed to load stories:", err);
    }
  };

  const handleAuth = async () => {
    setAuthError("");
    try {
      const response = await fetch("/api/admin/stories", {
        headers: { Authorization: `Bearer ${password}` },
      });

      if (response.ok) {
        setIsAuthenticated(true);
        const data = await response.json();
        setStories(data.stories || []);
      } else if (response.status === 401) {
        setAuthError("Invalid password");
      }
    } catch {
      setAuthError("Connection error");
    }
  };

  const handleCreateStory = async () => {
    if (!newStoryName.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ name: newStoryName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create story");
      }

      const data = await response.json();
      setNewStoryName("");
      setShowNewStory(false);
      await loadStories();
      setSelectedStoryId(data.project.id);
      setProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create story");
    } finally {
      setIsCreating(false);
    }
  };

  const loadProject = async (storyId: string) => {
    try {
      const response = await fetch(`/api/admin/stories/${storyId}`, {
        headers: getAuthHeader(),
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setSelectedStoryId(storyId);
      } else {
        setError("Failed to load story");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load story");
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm("Delete this story? This cannot be undone.")) return;

    try {
      const response = await fetch(`/api/admin/stories/${storyId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      if (selectedStoryId === storyId) {
        setSelectedStoryId(null);
        setProject(null);
      }
      await loadStories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete story");
    }
  };

  // Phase operations
  const handlePhaseGenerate = async (phaseNum: number, data: Record<string, unknown> = {}) => {
    if (!selectedStoryId) return;
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/stories/${selectedStoryId}/phase/${phaseNum}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to generate phase ${phaseNum}`);
      }

      // Reload project to get updated state
      await loadProject(selectedStoryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  };

  const handlePhaseApprove = async (phaseNum: number) => {
    if (!selectedStoryId) return;
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/stories/${selectedStoryId}/phase/${phaseNum}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({ action: "approve" }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to approve");
      }

      const data = await response.json();
      setProject(data.project);
      await loadStories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const handlePhaseReject = async (phaseNum: number, notes: string) => {
    if (!selectedStoryId) return;
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/stories/${selectedStoryId}/phase/${phaseNum}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({ action: "reject", revisionNotes: notes }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to reject");
      }

      const data = await response.json();
      setProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  const handleConvert = async () => {
    if (!selectedStoryId) return;
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/stories/${selectedStoryId}/convert`,
        {
          method: "POST",
          headers: getAuthHeader(),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Conversion failed");
      }

      const data = await response.json();
      setProject(data.project);
      await loadStories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    }
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
            {authError && <p className="text-sm text-red-500">{authError}</p>}
            <Button onClick={handleAuth} className="w-full">Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const phaseStatuses: Record<number, PhaseStatus> = project
    ? {
        0: project.phase0.status,
        1: project.phase1.status,
        2: project.phase2.status,
        4: project.phase4.status,
        5: project.phase5.status,
      }
    : {};

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Story Pipeline</h1>
            <p className="text-gray-600">Create stories through guided phases</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin">
              <Button variant="outline">Back to Admin</Button>
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setError(null)} className="mt-2">
              Dismiss
            </Button>
          </div>
        )}

        {/* Story List + Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Story List */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Stories</CardTitle>
                  <Button size="sm" onClick={() => setShowNewStory(true)}>
                    + New
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {showNewStory && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                    <Input
                      value={newStoryName}
                      onChange={(e) => setNewStoryName(e.target.value)}
                      placeholder="Story name..."
                      onKeyDown={(e) => e.key === "Enter" && handleCreateStory()}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateStory} disabled={isCreating || !newStoryName.trim()}>
                        {isCreating ? "Creating..." : "Create"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewStory(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => {
                      if (story.isLegacy) return;
                      loadProject(story.id);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedStoryId === story.id
                        ? "border-primary bg-primary/5"
                        : story.isLegacy
                          ? "border-gray-100 bg-gray-50 cursor-default"
                          : "border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{story.name}</p>
                      {story.isLegacy && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                          Legacy
                        </span>
                      )}
                      {story.templateReady && !story.isLegacy && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                          Ready
                        </span>
                      )}
                    </div>
                    {!story.isLegacy && (
                      <p className="text-xs text-gray-500 mt-1">
                        Phase {story.currentPhase}
                      </p>
                    )}
                  </button>
                ))}

                {stories.length === 0 && !showNewStory && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No stories yet. Click &quot;+ New&quot; to start.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main: Story Detail */}
          <div className="lg:col-span-3 space-y-6">
            {!selectedStoryId && (
              <Card>
                <CardContent className="py-16 text-center">
                  <p className="text-gray-500">Select a story or create a new one</p>
                </CardContent>
              </Card>
            )}

            {project && (
              <>
                {/* Story header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{project.name}</h2>
                    <p className="text-sm text-gray-500">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <PhaseProgress
                      currentPhase={project.currentPhase}
                      phaseStatuses={phaseStatuses}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStory(project.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Phase Editors */}
                {(project.currentPhase === 0 || project.phase0.output) && (
                  <Phase0Editor
                    storyId={project.id}
                    storyName={project.name}
                    output={project.phase0.output}
                    status={project.phase0.status}
                    onGenerate={(data) => handlePhaseGenerate(0, data)}
                    onApprove={() => handlePhaseApprove(0)}
                    onReject={(notes) => handlePhaseReject(0, notes)}
                  />
                )}

                {(project.currentPhase >= 1 || project.phase1.output) && project.phase0.status === "approved" && (
                  <Phase1Editor
                    storyId={project.id}
                    output={project.phase1.output}
                    status={project.phase1.status}
                    onGenerate={(data) => handlePhaseGenerate(1, data)}
                    onApprove={() => handlePhaseApprove(1)}
                    onReject={(notes) => handlePhaseReject(1, notes)}
                  />
                )}

                {(project.currentPhase >= 2 || project.phase2.output) && project.phase1.status === "approved" && (
                  <Phase2Editor
                    storyId={project.id}
                    output={project.phase2.output}
                    status={project.phase2.status}
                    onGenerate={(data) => handlePhaseGenerate(2, data)}
                    onApprove={() => handlePhaseApprove(2)}
                    onReject={(notes) => handlePhaseReject(2, notes)}
                  />
                )}

                {(project.currentPhase >= 4 || project.phase4.output) && project.phase2.status === "approved" && (
                  <Phase4Editor
                    storyId={project.id}
                    output={project.phase4.output}
                    status={project.phase4.status}
                    onGenerate={(data) => handlePhaseGenerate(4, data)}
                    onApprove={() => handlePhaseApprove(4)}
                    onReject={(notes) => handlePhaseReject(4, notes)}
                  />
                )}

                {(project.currentPhase >= 5 || project.phase5.output) && project.phase4.status === "approved" && (
                  <Phase5Editor
                    storyId={project.id}
                    output={project.phase5.output}
                    propsBible={project.phase4.output}
                    status={project.phase5.status}
                    templateReady={project.templateReady}
                    onGenerate={(data) => handlePhaseGenerate(5, data)}
                    onApprove={() => handlePhaseApprove(5)}
                    onReject={(notes) => handlePhaseReject(5, notes)}
                    onConvert={handleConvert}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
