"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Phase5PanelBriefs, PhaseStatus } from "@/types";

interface Phase5EditorProps {
  storyId: string;
  output: Phase5PanelBriefs | null;
  status: PhaseStatus;
  templateReady: boolean;
  onGenerate: (data: { revisionNotes?: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (notes: string) => Promise<void>;
  onConvert: () => Promise<void>;
}

export function Phase5Editor({
  output,
  status,
  templateReady,
  onGenerate,
  onApprove,
  onReject,
  onConvert,
}: Phase5EditorProps) {
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await onGenerate({ revisionNotes: revisionNotes || undefined });
      setRevisionNotes("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!revisionNotes.trim()) return;
    await onReject(revisionNotes);
  };

  const handleConvert = async () => {
    setIsConverting(true);
    try {
      await onConvert();
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Phase 5: Panel Briefs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {output && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{output.panels.length} panel briefs</p>
            {output.panels.map((panel) => {
              const isExpanded = expandedPanel === panel.spreadNumber;
              return (
                <div
                  key={panel.spreadNumber}
                  className="rounded-lg border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedPanel(isExpanded ? null : panel.spreadNumber)}
                    className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-sm">
                      Spread {panel.spreadNumber}
                    </span>
                    <span className="text-xs text-gray-400">
                      {isExpanded ? "Collapse" : "Expand"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="p-3 pt-0 space-y-2 text-sm border-t border-gray-100">
                      <div>
                        <p className="text-xs font-medium text-gray-500">Text</p>
                        <p className="italic">{panel.manuscriptText}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Composition</p>
                        <p>{panel.composition}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Characters</p>
                        <p>{panel.charactersInFrame}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Environment</p>
                        <p>{panel.environment}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Objects</p>
                        <p>{panel.objectsInFrame}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Emotional Direction</p>
                        <p>{panel.emotionalDirection}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Continuity Notes</p>
                        <p>{panel.continuityNotes}</p>
                      </div>
                      <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-xs font-medium text-yellow-700">Image Prompt</p>
                        <p className="text-xs mt-1">{panel.imagePrompt}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(status === "review" || status === "pending") && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Revision Notes</label>
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder="Feedback for regeneration..."
            />
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleGenerate}
            disabled={isLoading || status === "generating"}
          >
            {isLoading || status === "generating"
              ? "Generating..."
              : output
                ? "Regenerate"
                : "Generate Panel Briefs"}
          </Button>

          {output && status === "review" && (
            <>
              <Button variant="default" onClick={onApprove}>
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={!revisionNotes.trim()}
              >
                Reject with Notes
              </Button>
            </>
          )}

          {status === "approved" && (
            <span className="flex items-center text-sm text-green-600 font-medium">
              Approved
            </span>
          )}

          {status === "approved" && !templateReady && (
            <Button
              variant="default"
              onClick={handleConvert}
              disabled={isConverting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isConverting ? "Converting..." : "Convert to Template"}
            </Button>
          )}

          {templateReady && (
            <span className="flex items-center text-sm text-green-600 font-medium px-3 py-1 bg-green-50 rounded-full border border-green-200">
              Template Ready
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
