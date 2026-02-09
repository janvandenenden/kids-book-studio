"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Phase2Manuscript, PhaseStatus } from "@/types";

interface Phase2EditorProps {
  storyId: string;
  output: Phase2Manuscript | null;
  status: PhaseStatus;
  onGenerate: (data: { revisionNotes?: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (notes: string) => Promise<void>;
}

export function Phase2Editor({ output, status, onGenerate, onApprove, onReject }: Phase2EditorProps) {
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Phase 2+3: Manuscript</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {output && (
          <div className="space-y-3">
            {output.spreads.map((spread) => (
              <div
                key={spread.spreadNumber}
                className="p-3 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">
                    Spread {spread.spreadNumber}
                  </span>
                </div>
                <p className="text-sm mb-2">{spread.finalText}</p>
                <div className="text-xs space-y-1 text-gray-500">
                  <p><strong>Illustration:</strong> {spread.illustrationNote}</p>
                  {spread.readAloudNote && (
                    <p><strong>Read-aloud:</strong> {spread.readAloudNote}</p>
                  )}
                </div>
              </div>
            ))}
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

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isLoading || status === "generating"}
          >
            {isLoading || status === "generating"
              ? "Generating..."
              : output
                ? "Regenerate"
                : "Generate Manuscript"}
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
        </div>
      </CardContent>
    </Card>
  );
}
