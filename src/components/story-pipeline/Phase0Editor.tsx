"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Phase0Concept, PhaseStatus, AgeRange } from "@/types";

interface Phase0EditorProps {
  storyId: string;
  storyName: string;
  output: Phase0Concept | null;
  status: PhaseStatus;
  onGenerate: (data: { ageRange: AgeRange; theme?: string; revisionNotes?: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (notes: string) => Promise<void>;
}

export function Phase0Editor({ output, status, onGenerate, onApprove, onReject }: Phase0EditorProps) {
  const [ageRange, setAgeRange] = useState<AgeRange>(output?.ageRange || "3-4");
  const [theme, setTheme] = useState(output?.theme || "");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await onGenerate({
        ageRange,
        theme: theme || undefined,
        revisionNotes: revisionNotes || undefined,
      });
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
        <CardTitle className="text-lg">Phase 0: Concept</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input controls */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Target Age Range</label>
          <select
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value as AgeRange)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            disabled={isLoading || status === "generating"}
          >
            <option value="0-2">0-2 years (board book)</option>
            <option value="2-3">2-3 years (toddler)</option>
            <option value="3-4">3-4 years (preschool)</option>
            <option value="4-5">4-5 years (pre-K)</option>
            <option value="5-6">5-6 years (kindergarten)</option>
            <option value="6-7">6-7 years (early reader)</option>
            <option value="7-8">7-8 years (independent reader)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Theme / Seed (optional)</label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
            placeholder="e.g., overcoming fear of the dark, friendship with a robot, ocean adventure..."
            disabled={isLoading || status === "generating"}
          />
        </div>

        {/* Output display */}
        {output && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Emotional Core</p>
              <p className="text-sm">{output.emotionalCore}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Visual Hook</p>
              <p className="text-sm">{output.visualHook}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Tone & Texture</p>
              <p className="text-sm">{output.toneTexture}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Comparable Books</p>
              <p className="text-sm">{output.comparableBooks}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">What It&apos;s Not</p>
              <p className="text-sm">{output.whatItsNot}</p>
            </div>
          </div>
        )}

        {/* Revision notes */}
        {output && status === "review" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Revision Notes</label>
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder="What should change in the next version?"
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
                : "Generate Concept"}
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
