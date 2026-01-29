"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StoryboardPanel as StoryboardPanelType } from "@/types";

interface StoryboardPanelProps {
  panel: StoryboardPanelType;
  pageText: string;
  onApprove: (pageNumber: number) => void;
  onRegenerate: (pageNumber: number) => void;
  isRegenerating: boolean;
}

export function StoryboardPanel({
  panel,
  pageText,
  onApprove,
  onRegenerate,
  isRegenerating,
}: StoryboardPanelProps) {
  const textPlacementLabels: Record<string, string> = {
    left: "Text: Left",
    right: "Text: Right",
    bottom: "Text: Bottom",
    top: "Text: Top",
  };

  return (
    <Card className={`overflow-hidden transition-all ${panel.approved ? "ring-2 ring-green-500" : ""}`}>
      <CardContent className="p-0">
        {/* Panel Image */}
        <div className="relative aspect-[3/2] bg-gray-100">
          {isRegenerating ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="text-4xl mb-2 animate-bounce">✏️</div>
                <p className="text-sm text-gray-500">Sketching...</p>
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

          {/* Approved badge */}
          {panel.approved && !isRegenerating && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Approved
            </div>
          )}

          {/* Text placement indicator */}
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {textPlacementLabels[panel.textPlacement] || "Text placement"}
          </div>
        </div>

        {/* Panel Info */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Page {panel.page}</span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">
            {panel.scene}
          </p>

          <p className="text-xs text-gray-600 italic line-clamp-2 border-l-2 border-gray-200 pl-2">
            &ldquo;{pageText}&rdquo;
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant={panel.approved ? "outline" : "default"}
              size="sm"
              className="flex-1"
              onClick={() => onApprove(panel.page)}
              disabled={isRegenerating}
            >
              {panel.approved ? "Unapprove" : "Approve"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRegenerate(panel.page)}
              disabled={isRegenerating}
            >
              {isRegenerating ? "..." : "Regenerate"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
