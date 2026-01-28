"use client";

import { useState } from "react";
import { PageSpread } from "./PageSpread";
import { Button } from "@/components/ui/button";
import type { Storyboard } from "@/types";

interface BookPreviewProps {
  story: Storyboard;
  onDownload: () => void;
  onRegeneratePage?: (pageNumber: number) => Promise<string>;
  isDownloading: boolean;
}

export function BookPreview({
  story,
  onDownload,
  onRegeneratePage,
  isDownloading,
}: BookPreviewProps) {
  const [currentPage, setCurrentPage] = useState(-1); // -1 for cover
  const [regeneratingPage, setRegeneratingPage] = useState<number | null>(null);
  const totalPages = story.pages.length;

  const goToPrevious = () => {
    setCurrentPage((prev) => Math.max(-1, prev - 1));
  };

  const goToNext = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const handleRegenerate = async () => {
    if (!onRegeneratePage || currentPage < 0) return;

    const pageNumber = story.pages[currentPage].page;
    setRegeneratingPage(pageNumber);

    try {
      await onRegeneratePage(pageNumber);
    } catch (error) {
      console.error("Regeneration failed:", error);
      alert(error instanceof Error ? error.message : "Failed to regenerate");
    } finally {
      setRegeneratingPage(null);
    }
  };

  const currentPageData = currentPage >= 0 ? story.pages[currentPage] : null;
  const isRegenerating = currentPageData
    ? regeneratingPage === currentPageData.page
    : false;

  return (
    <div className="space-y-6">
      {/* Book Display */}
      <div className="relative">
        {currentPage === -1 ? (
          // Cover Page
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl shadow-lg aspect-square max-w-2xl mx-auto flex flex-col items-center justify-center p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-4">
              {story.title}
            </h1>
            <p className="text-lg text-gray-600">A Personalized Adventure</p>
          </div>
        ) : (
          // Story Pages
          <div className="relative">
            <PageSpread
              page={story.pages[currentPage]}
              pageIndex={currentPage}
              isRegenerating={isRegenerating}
            />

            {/* Regenerate button overlay */}
            {onRegeneratePage && (
              <div className="absolute top-4 right-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="bg-white/90 hover:bg-white shadow-md"
                >
                  {isRegenerating ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Regenerating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      🔄 Regenerate
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          onClick={goToPrevious}
          disabled={currentPage === -1 || isRegenerating}
        >
          ← Previous
        </Button>

        <span className="text-sm text-muted-foreground min-w-[120px] text-center">
          {currentPage === -1
            ? "Cover"
            : `Page ${currentPage + 1} of ${totalPages}`}
        </span>

        <Button
          variant="outline"
          onClick={goToNext}
          disabled={currentPage === totalPages - 1 || isRegenerating}
        >
          Next →
        </Button>
      </div>

      {/* Page Thumbnails */}
      <div className="flex gap-2 justify-center flex-wrap">
        <button
          onClick={() => setCurrentPage(-1)}
          disabled={isRegenerating}
          className={`w-10 h-10 rounded border-2 flex items-center justify-center text-xs transition-colors ${
            currentPage === -1
              ? "border-primary bg-primary/10"
              : "border-muted hover:border-primary/50"
          } ${isRegenerating ? "opacity-50" : ""}`}
        >
          C
        </button>
        {story.pages.map((page, index) => (
          <button
            key={page.page}
            onClick={() => setCurrentPage(index)}
            disabled={isRegenerating}
            className={`w-10 h-10 rounded border-2 flex items-center justify-center text-xs transition-colors ${
              currentPage === index
                ? "border-primary bg-primary/10"
                : "border-muted hover:border-primary/50"
            } ${regeneratingPage === page.page ? "animate-pulse bg-yellow-100" : ""} ${isRegenerating && regeneratingPage !== page.page ? "opacity-50" : ""}`}
          >
            {!page.imageUrl ? "!" : index + 1}
          </button>
        ))}
      </div>

      {/* Download Button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={onDownload}
          disabled={isDownloading || isRegenerating}
          className="px-8"
        >
          {isDownloading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Generating PDF...
            </span>
          ) : (
            "Download PDF"
          )}
        </Button>
      </div>
    </div>
  );
}
