import { NextRequest, NextResponse } from "next/server";
import {
  loadStoryProject,
  saveStoryProject,
  savePhaseOutput,
} from "@/lib/story-template";
import {
  generatePhase0,
  generatePhase1,
  generatePhase2,
  generatePhase4,
  generatePhase5,
} from "@/lib/story-llm";
import type {
  AgeRange,
  Phase0Concept,
  Phase1Storyboard,
  Phase2Manuscript,
  Phase4PropsBible,
} from "@/types";

export const maxDuration = 120;

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return true;
  if (!authHeader) return false;
  const [type, password] = authHeader.split(" ");
  return type === "Bearer" && password === adminPassword;
}

const PHASE_ORDER: (0 | 1 | 2 | 4 | 5)[] = [0, 1, 2, 4, 5];

function nextPhase(current: 0 | 1 | 2 | 4 | 5): 0 | 1 | 2 | 4 | 5 {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < PHASE_ORDER.length - 1) return PHASE_ORDER[idx + 1];
  return current;
}

function phaseKey(phaseNum: number): "phase0" | "phase1" | "phase2" | "phase4" | "phase5" {
  const map: Record<number, "phase0" | "phase1" | "phase2" | "phase4" | "phase5"> = {
    0: "phase0",
    1: "phase1",
    2: "phase2",
    4: "phase4",
    5: "phase5",
  };
  return map[phaseNum];
}

// POST — generate a phase
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string; phaseNum: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyId, phaseNum: phaseNumStr } = await params;
  const phaseNum = parseInt(phaseNumStr, 10);

  if (![0, 1, 2, 4, 5].includes(phaseNum)) {
    return NextResponse.json({ error: "Invalid phase number" }, { status: 400 });
  }

  const project = loadStoryProject(storyId);
  if (!project) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { revisionNotes, model, ageRange, theme } = body;

    // Update phase status to generating
    const key = phaseKey(phaseNum);
    project[key].status = "generating";
    saveStoryProject(project);

    let output: unknown;

    switch (phaseNum) {
      case 0: {
        output = await generatePhase0({
          ageRange: (ageRange as AgeRange) || "3-5",
          theme,
          revisionNotes,
          model,
        });
        break;
      }
      case 1: {
        const concept = project.phase0.output as Phase0Concept;
        if (!concept) {
          return NextResponse.json({ error: "Phase 0 must be completed first" }, { status: 400 });
        }
        output = await generatePhase1({ concept, revisionNotes, model });
        break;
      }
      case 2: {
        const concept = project.phase0.output as Phase0Concept;
        const storyboard = project.phase1.output as Phase1Storyboard;
        if (!concept || !storyboard) {
          return NextResponse.json({ error: "Phase 0 and 1 must be completed first" }, { status: 400 });
        }
        output = await generatePhase2({ concept, storyboard, revisionNotes, model });
        break;
      }
      case 4: {
        const concept = project.phase0.output as Phase0Concept;
        const manuscript = project.phase2.output as Phase2Manuscript;
        if (!concept || !manuscript) {
          return NextResponse.json({ error: "Phase 0 and 2 must be completed first" }, { status: 400 });
        }
        output = await generatePhase4({ concept, manuscript, revisionNotes, model });
        break;
      }
      case 5: {
        const manuscript = project.phase2.output as Phase2Manuscript;
        const propsBible = project.phase4.output as Phase4PropsBible;
        if (!manuscript || !propsBible) {
          return NextResponse.json({ error: "Phase 2 and 4 must be completed first" }, { status: 400 });
        }
        output = await generatePhase5({ manuscript, propsBible, revisionNotes, model });
        break;
      }
    }

    // Save phase output
    savePhaseOutput(storyId, phaseNum, output);

    // Update project
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (project[key] as any).output = output;
    project[key].status = "review";
    project[key].generatedAt = new Date().toISOString();
    project[key].revisionNotes = revisionNotes;
    saveStoryProject(project);

    return NextResponse.json({ success: true, output });
  } catch (error) {
    // Reset status on error
    const key = phaseKey(phaseNum);
    project[key].status = project[key].output ? "review" : "pending";
    saveStoryProject(project);

    console.error(`Phase ${phaseNum} generation error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Failed to generate phase ${phaseNum}` },
      { status: 500 },
    );
  }
}

// PATCH — approve or reject a phase
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string; phaseNum: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyId, phaseNum: phaseNumStr } = await params;
  const phaseNum = parseInt(phaseNumStr, 10);

  if (![0, 1, 2, 4, 5].includes(phaseNum)) {
    return NextResponse.json({ error: "Invalid phase number" }, { status: 400 });
  }

  const project = loadStoryProject(storyId);
  if (!project) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { action, revisionNotes } = body;

    const key = phaseKey(phaseNum);

    if (action === "approve") {
      project[key].status = "approved";
      project[key].approvedAt = new Date().toISOString();
      project.currentPhase = nextPhase(phaseNum as 0 | 1 | 2 | 4 | 5);
      saveStoryProject(project);
      return NextResponse.json({ success: true, project });
    }

    if (action === "reject") {
      project[key].status = "review";
      project[key].revisionNotes = revisionNotes;
      saveStoryProject(project);
      return NextResponse.json({ success: true, project });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error(`Phase ${phaseNum} action error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update phase" },
      { status: 500 },
    );
  }
}
