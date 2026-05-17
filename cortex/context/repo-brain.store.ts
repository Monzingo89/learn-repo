import { ModelId } from "../enums/model.enum.js";
import { WorkUnit } from "../enums/work-unit.enum.js";
import { RepoEvent } from "./repo-event.types.js";

export type RepoBrainState = {
  repoPath: string;
  eyes: RepoEvent[];
  nose: RepoEvent[];
  ears: RepoEvent[];
  hands: RepoEvent[];
  brain: RepoEvent[];
  activeContext: {
    activeGoal: string;
    activeWorkflow: string;
    activeDirectory?: string;
    activeFile?: string;
    activeModel?: ModelId;
    activeStep?: WorkUnit;
    tokenBudget: {
      maxTokens: number;
      handoffAtPercent: number;
      totalUsed: number;
      percentUsed: number;
    };
    tokenUsageByModel: Record<string, unknown>;
    progress: {
      totalDirectories: number;
      scannedDirectories: number;
      totalFiles: number;
      scannedFiles: number;
      percentComplete: number;
    };
  };
  learned: {
    technologies: string[];
    routes: string[];
    integrations: string[];
    risks: string[];
    smells: string[];
    noise: string[];
    simplifications: string[];
  };
};

export function createInitialRepoBrainState(repoPath: string): RepoBrainState {
  return {
    repoPath,
    eyes: [],
    nose: [],
    ears: [],
    hands: [],
    brain: [],
    activeContext: {
      activeGoal: "understand_repo",
      activeWorkflow: "first_pass",
      tokenBudget: {
        maxTokens: 120000,
        handoffAtPercent: 80,
        totalUsed: 0,
        percentUsed: 0
      },
      tokenUsageByModel: {},
      progress: {
        totalDirectories: 0,
        scannedDirectories: 0,
        totalFiles: 0,
        scannedFiles: 0,
        percentComplete: 0
      }
    },
    learned: {
      technologies: [],
      routes: [],
      integrations: [],
      risks: [],
      smells: [],
      noise: [],
      simplifications: []
    }
  };
}
