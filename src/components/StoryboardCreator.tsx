"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StoryboardPanel } from "./StoryboardPanel";
import { Button } from "@/components/ui/button";
import type { StoryboardPanel as StoryboardPanelType, Storyboard, StoryPage } from "@/types";
import type { ImageModel } from "@/lib/replicate";

interface StoryboardCreatorProps {
  childName: string;
  characterDescription: string;
  characterSheetUrl: string;
  photoPath: string;
  model: ImageModel;
  pageLimit?: number;
}

type GenerationStatus = "idle" | "generating" | "complete" | "error";

export function StoryboardCreator({
  childName,
  characterDescription,
  characterSheetUrl,
  photoPath,
  model,
  pageLimit,
}: StoryboardCreatorProps) {
  const router = useRouter();
  const [panels, setPanels] = useState<StoryboardPanelType[]>([]);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [regeneratingPage, setRegeneratingPage] = useState<number | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 12 });

  // Generate storyboard panels on mount
  useEffect(() => {
    generatePanels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatePanels = async () => {
    setStatus("generating");
    setError(null);

    try {
      const response = await fetch("/api/storyboard-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName,
          characterDescription,
          characterSheetUrl,
          model,
          pageLimit,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate storyboard panels");
      }

      const data = await response.json();
      setPanels(data.panels);
      setStoryboard(data.storyboard);
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

  const handleApprove = (pageNumber: number) => {
    setPanels((prev) =>
      prev.map((panel) =>
        panel.page === pageNumber
          ? { ...panel, approved: !panel.approved }
          : panel
      )
    );
  };

  const handleApproveAll = () => {
    setPanels((prev) =>
      prev.map((panel) => ({ ...panel, approved: true }))
    );
  };

  const handleRegenerate = async (pageNumber: number) => {
    if (!storyboard) return;

    const pageData = storyboard.pages.find((p) => p.page === pageNumber);
    if (!pageData) return;

    setRegeneratingPage(pageNumber);

    try {
      const response = await fetch("/api/storyboard-panels/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageNumber,
          pageData,
          characterDescription,
          characterSheetUrl,
          model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate panel");
      }

      const data = await response.json();

      // Update the panel with new sketch, reset approval
      setPanels((prev) =>
        prev.map((panel) =>
          panel.page === pageNumber
            ? { ...data.panel, approved: false }
            : panel
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to regenerate panel");
    } finally {
      setRegeneratingPage(null);
    }
  };

  const handleContinueToPreview = () => {
    if (!storyboard) return;

    // Store storyboard data in sessionStorage for preview page
    sessionStorage.setItem(
      "bookData",
      JSON.stringify({
        childName,
        characterDescription,
        characterSheetUrl,
        photoPath,
        model,
        pageLimit,
      })
    );

    // Store storyboard panels for img2img generation
    sessionStorage.setItem(
      "storyboardData",
      JSON.stringify({
        panels,
        storyboard,
      })
    );

    router.push("/preview");
  };

  const handleStartOver = () => {
    sessionStorage.removeItem("bookData");
    sessionStorage.removeItem("storyboardData");
    router.push("/");
  };

  const allApproved = panels.length > 0 && panels.every((p) => p.approved);
  const approvedCount = panels.filter((p) => p.approved).length;

  // Get page text for each panel
  const getPageText = (pageNumber: number): string => {
    if (!storyboard) return "";
    const page = storyboard.pages.find((p) => p.page === pageNumber);
    return page?.text || "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleStartOver}>
          Start Over
        </Button>
        <h2 className="text-xl font-semibold text-gray-800">
          Storyboard Review
        </h2>
        <div className="w-24" />
      </div>

      {/* Generating State */}
      {status === "generating" && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-6xl mb-6 animate-bounce">✏️</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Creating Storyboard Sketches...
          </h2>
          <p className="text-gray-600 mb-2">
            Generating {progress.total} B&W composition sketches.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            These rough sketches help plan the book layout.
          </p>
          <div className="w-64 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-600 rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(5, (progress.current / progress.total) * 100)}%`,
                animation: "pulse 2s infinite",
              }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-6xl mb-6">Something went wrong</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Storyboard Generation Failed
          </h2>
          <p className="text-gray-600 mb-6 text-center max-w-md">{error}</p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleStartOver}>
              Start Over
            </Button>
            <Button onClick={generatePanels}>Try Again</Button>
          </div>
        </div>
      )}

      {/* Complete State - Panel Grid */}
      {status === "complete" && (
        <>
          {/* Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">
              Review Your Storyboard
            </h3>
            <p className="text-sm text-gray-600">
              These black & white sketches show the composition for each page.
              Approve panels you&apos;re happy with, or regenerate any you&apos;d like
              to change. The approved compositions will guide the final colored
              illustrations.
            </p>
          </div>

          {/* Approval Status */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {approvedCount} of {panels.length} panels approved
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleApproveAll}
              disabled={allApproved}
            >
              Approve All
            </Button>
          </div>

          {/* Panel Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {panels.map((panel) => (
              <StoryboardPanel
                key={panel.page}
                panel={panel}
                pageText={getPageText(panel.page)}
                onApprove={handleApprove}
                onRegenerate={handleRegenerate}
                isRegenerating={regeneratingPage === panel.page}
              />
            ))}
          </div>

          {/* Continue Button */}
          <div className="flex justify-center pt-6">
            <Button
              size="lg"
              onClick={handleContinueToPreview}
              disabled={!allApproved || regeneratingPage !== null}
              className="px-8"
            >
              {allApproved
                ? "Continue to Final Book"
                : `Approve all ${panels.length} panels to continue`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
