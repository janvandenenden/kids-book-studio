"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Phase4PropsBible, PhaseStatus } from "@/types";

interface Phase4EditorProps {
  storyId: string;
  output: Phase4PropsBible | null;
  status: PhaseStatus;
  onGenerate: (data: { revisionNotes?: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (notes: string) => Promise<void>;
}

export function Phase4Editor({ output, status, onGenerate, onApprove, onReject }: Phase4EditorProps) {
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
        <CardTitle className="text-lg">Phase 4: Props Bible</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {output && (
          <div className="space-y-4">
            {/* Supporting Characters */}
            {output.supportingCharacters.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Supporting Characters</p>
                <div className="space-y-2">
                  {output.supportingCharacters.map((char, i) => (
                    <div key={i} className="p-2 bg-gray-50 rounded border text-sm">
                      <strong>{char.name}</strong> (spreads: {char.appearsInSpreads.join(", ")})
                      <p className="text-gray-600 mt-1">{char.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Objects */}
            {output.keyObjects.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Key Objects</p>
                <div className="space-y-2">
                  {output.keyObjects.map((obj, i) => (
                    <div key={i} className="p-2 bg-gray-50 rounded border text-sm">
                      <strong>{obj.name}</strong> (spreads: {obj.appearsInSpreads.join(", ")})
                      <p className="text-gray-600 mt-1">{obj.description}</p>
                      {obj.stateChanges && (
                        <p className="text-xs text-orange-600 mt-1">State changes: {obj.stateChanges}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Environments */}
            {output.environments.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Environments</p>
                <div className="space-y-2">
                  {output.environments.map((env, i) => (
                    <div key={i} className="p-2 bg-gray-50 rounded border text-sm">
                      <strong>{env.name}</strong> (spreads: {env.usedInSpreads.join(", ")})
                      <p className="text-gray-600 mt-1">{env.description}</p>
                      <div className="flex gap-1 mt-1">
                        {env.colorPalette.map((color, j) => (
                          <span key={j} className="text-xs px-2 py-0.5 bg-white border rounded">
                            {color}
                          </span>
                        ))}
                      </div>
                      {env.lightSource && (
                        <p className="text-xs text-gray-500 mt-1">Light: {env.lightSource}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Motifs */}
            {output.visualMotifs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Visual Motifs</p>
                <div className="space-y-2">
                  {output.visualMotifs.map((motif, i) => (
                    <div key={i} className="p-2 bg-gray-50 rounded border text-sm">
                      <strong>{motif.motif}</strong> (spreads: {motif.appearsInSpreads.join(", ")})
                      <p className="text-gray-600 mt-1">{motif.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Style Notes */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-600 uppercase mb-1">Style Notes</p>
              <p className="text-sm">{output.styleNotes}</p>
            </div>
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
                : "Generate Props Bible"}
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
