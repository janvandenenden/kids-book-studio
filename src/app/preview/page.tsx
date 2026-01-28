"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookPreview } from "@/components/BookPreview";
import { Button } from "@/components/ui/button";
import type { Storyboard } from "@/types";
import type { ImageModel } from "@/lib/replicate";

type GenerationStatus = "idle" | "generating" | "complete" | "error";

interface BookData {
  childName: string;
  characterDescription: string;
  characterSheetUrl: string; // The illustrated character - used as reference for all pages
  photoPath: string; // Original photo (kept for reference)
  model?: ImageModel;
  pageLimit?: number; // Dev mode: limit number of pages to generate
}

export default function PreviewPage() {
  const router = useRouter();
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [story, setStory] = useState<Storyboard | null>(null);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 12 });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const bookDataStr = sessionStorage.getItem("bookData");
    if (!bookDataStr) {
      router.push("/");
      return;
    }

    try {
      const data = JSON.parse(bookDataStr) as BookData;
      if (!data.childName || !data.characterDescription || !data.characterSheetUrl) {
        throw new Error("Incomplete book data - character illustration required");
      }
      setBookData(data);
      generateBook(data);
    } catch {
      console.error("Invalid book data");
      router.push("/");
    }
  }, [router]);

  const generateBook = async (data: BookData) => {
    setStatus("generating");
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: data.childName,
          characterDescription: data.characterDescription,
          characterSheetUrl: data.characterSheetUrl, // Use illustrated character as reference
          model: data.model || "nano-banana-pro",
          pageLimit: data.pageLimit, // Dev mode: limit pages
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate book");
      }

      const responseData = await response.json();
      setProgress({
        current: responseData.imagesGenerated,
        total: responseData.totalImages,
      });
      setStory(responseData.story);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const handleRegeneratePage = async (pageNumber: number): Promise<string> => {
    if (!bookData || !story) {
      throw new Error("Missing book data");
    }

    const pageData = story.pages.find((p) => p.page === pageNumber);
    if (!pageData) {
      throw new Error("Page not found");
    }

    const response = await fetch("/api/generate/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageNumber,
        pageData,
        characterDescription: bookData.characterDescription,
        characterSheetUrl: bookData.characterSheetUrl, // Use illustrated character as reference
        model: bookData.model || "nano-banana-pro",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Regeneration failed");
    }

    const data = await response.json();

    // Update the story with the new image
    setStory((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p) =>
          p.page === pageNumber ? { ...p, imageUrl: data.imageUrl } : p
        ),
      };
    });

    return data.imageUrl;
  };

  const handleDownload = async () => {
    if (!story) return;

    setIsDownloading(true);

    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      // Download the PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${story.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartOver = () => {
    sessionStorage.removeItem("bookData");
    router.push("/");
  };

  const handleRetry = () => {
    if (bookData) {
      generateBook(bookData);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="outline" onClick={handleStartOver}>
            ← Start Over
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            {story?.title || "Book Preview"}
          </h1>
          <div className="w-24" />
        </div>

        {/* Generating State */}
        {status === "generating" && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-6 animate-bounce">📚</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Creating Your Book...
            </h2>
            <p className="text-gray-600 mb-2">
              Generating {progress.total} beautiful illustrations with AI.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              This may take a few minutes...
            </p>
            <div className="w-64 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.max(5, (progress.current / progress.total) * 100)}%`,
                  animation: "pulse 2s infinite",
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Using {bookData?.model === "nano-banana-pro" ? "Google Nano Banana Pro" : "IP-Adapter"} for image generation
            </p>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-6">😔</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Oops! Something went wrong
            </h2>
            <p className="text-gray-600 mb-6 text-center max-w-md">{error}</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={handleStartOver}>
                Start Over
              </Button>
              <Button onClick={handleRetry}>Try Again</Button>
            </div>
          </div>
        )}

        {/* Complete State - Show Book Preview */}
        {status === "complete" && story && (
          <div>
            {/* Warning if some images failed */}
            {progress.total > 0 && progress.current < progress.total && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                <p className="text-yellow-800">
                  Note: {progress.current} of {progress.total} illustrations
                  were generated. You can regenerate missing images using the
                  refresh button on each page.
                </p>
              </div>
            )}

            <BookPreview
              story={story}
              onDownload={handleDownload}
              onRegeneratePage={handleRegeneratePage}
              isDownloading={isDownloading}
            />
          </div>
        )}
      </main>
    </div>
  );
}
