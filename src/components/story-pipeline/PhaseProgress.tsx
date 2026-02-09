"use client";

import type { PhaseStatus } from "@/types";

interface PhaseProgressProps {
  currentPhase: number;
  phaseStatuses: Record<number, PhaseStatus>;
}

const PHASES = [
  { num: 0, label: "Concept" },
  { num: 1, label: "Storyboard" },
  { num: 2, label: "Manuscript" },
  { num: 4, label: "Props Bible" },
  { num: 5, label: "Panel Briefs" },
];

function statusColor(status: PhaseStatus): string {
  switch (status) {
    case "approved":
      return "bg-green-500 text-white";
    case "review":
      return "bg-yellow-500 text-white";
    case "generating":
      return "bg-blue-500 text-white animate-pulse";
    default:
      return "bg-gray-200 text-gray-500";
  }
}

function statusBadge(status: PhaseStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "review":
      return "Review";
    case "generating":
      return "Generating...";
    default:
      return "Pending";
  }
}

export function PhaseProgress({ currentPhase, phaseStatuses }: PhaseProgressProps) {
  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const status = phaseStatuses[phase.num] || "pending";
        const isCurrent = phase.num === currentPhase;

        return (
          <div key={phase.num} className="flex items-center">
            <div
              className={`flex flex-col items-center ${isCurrent ? "scale-110" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${statusColor(status)} ${
                  isCurrent ? "ring-2 ring-offset-1 ring-primary" : ""
                }`}
              >
                {phase.num}
              </div>
              <span className="text-[10px] mt-1 text-gray-600 whitespace-nowrap">
                {phase.label}
              </span>
              <span className={`text-[9px] ${status === "approved" ? "text-green-600" : status === "review" ? "text-yellow-600" : "text-gray-400"}`}>
                {statusBadge(status)}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 ${
                  phaseStatuses[phase.num] === "approved"
                    ? "bg-green-400"
                    : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
