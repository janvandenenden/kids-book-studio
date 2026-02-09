"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Phase1Storyboard, PhaseStatus } from "@/types";

interface Phase1EditorProps {
  storyId: string;
  output: Phase1Storyboard | null;
  status: PhaseStatus;
  onGenerate: (data: { revisionNotes?: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (notes: string) => Promise<void>;
}

export function Phase1Editor({ output, status, onGenerate, onApprove, onReject }: Phase1EditorProps) {
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
        <CardTitle className="text-lg">Phase 1: Visual Storyboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Output display */}
        {output && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{output.spreadCount} spreads</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {output.spreads.map((spread) => (
                <div
                  key={spread.spreadNumber}
                  className={`p-3 rounded-lg border ${
                    spread.energy === "Dynamic" ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      Spread {spread.spreadNumber}
                    </span>
                    <span className="text-xs text-gray-500">{spread.pageRange}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        spread.energy === "Dynamic"
                          ? "bg-orange-200 text-orange-800"
                          : "bg-blue-200 text-blue-800"
                      }`}
                    >
                      {spread.energy}
                    </span>
                  </div>
                  <p className="text-sm italic mb-2">&ldquo;{spread.draftText}&rdquo;</p>
                  <div className="text-xs space-y-1 text-gray-600">
                    <p><strong>Visual:</strong> {spread.visualFocus}</p>
                    <p><strong>Beat:</strong> {spread.emotionalBeat}</p>
                    <p><strong>Page turn:</strong> {spread.pageTurnPull}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revision notes */}
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

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isLoading || status === "generating"}
          >
            {isLoading || status === "generating"
              ? "Generating..."
              : output
                ? "Regenerate"
                : "Generate Storyboard"}
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
