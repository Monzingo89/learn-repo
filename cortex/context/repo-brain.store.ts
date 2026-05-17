import { ModelId } from "../enums/model.enum.js";
import { WorkUnit } from "../enums/work-unit.enum.js";
import { ContainerPlatform } from "../enums/container-platform.enum.js";
import { RepoTask, RepoTaskStatus } from "../enums/repo-task.enum.js";
import { RepoAuthorshipModel } from "../enums/repo-authorship-model.enum.js";
import { DbParadigm } from "../enums/db-paradigm.enum.js";
import { IdentityProvider } from "../enums/identity-provider.enum.js";
import { RepoEvent } from "./repo-event.types.js";

export type RepoTaskProgress = {
  status: RepoTaskStatus;
  totalItems: number;
  completedItems: number;
  remainingItems: number;
  percentComplete: number;
  updatedAt: string;
  note?: string;
};

export type ContainerObservation = {
  platform: ContainerPlatform;
  evidencePaths: string[];
  firstDetectedAt: string;
  lastDetectedAt: string;
};

export type SubRepoFinding = {
  name: string;
  relativePath: string;
  kind: "git_submodule" | "nested_git" | "workspace_package" | "monorepo_root";
  evidence: string[];
};

export type SymbolInventory = {
  models: { count: number; samplePaths: string[] };
  interfaces: { count: number; samplePaths: string[] };
  classes: { count: number; samplePaths: string[] };
  enums: { count: number; samplePaths: string[] };
  types: { count: number; samplePaths: string[] };
};

export type DependencyHealthEntry = {
  name: string;
  versionRange: string;
  used: boolean;
  importedFrom: string[];
  category: "runtime" | "dev" | "peer" | "optional";
};

export type DependencyAuditFindings = {
  manifestPath: string;
  totalDependencies: number;
  usedDependencies: number;
  unusedDependencies: string[];
  heavyDependencies: string[];
  healthScore: number;
  entries: DependencyHealthEntry[];
};

export type ArchitecturePatternFindings = {
  domainDrivenDesign: {
    detected: boolean;
    confidence: "low" | "medium" | "high";
    evidence: string[];
  };
  multiTenant: {
    detected: boolean;
    confidence: "low" | "medium" | "high";
    evidence: string[];
  };
  identity: {
    provider: IdentityProvider;
    rolesUsed: boolean;
    claimsUsed: boolean;
    evidence: string[];
  };
  database: {
    paradigm: DbParadigm;
    technologies: string[];
    evidence: string[];
  };
};

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
    remainingFiles: number;
    lastCompletedFile?: string;
    containers: Partial<Record<ContainerPlatform, ContainerObservation>>;
    repoAuthoringModels: RepoAuthorshipModel[];
    fileAuthorshipCounts: Partial<Record<RepoAuthorshipModel, number>>;
    tasks: Record<RepoTask, RepoTaskProgress>;
    lastHandoff?: {
      fromModel: ModelId;
      toModel: ModelId;
      at: string;
    };
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
    subRepos: SubRepoFinding[];
    deadCodeCandidates: string[];
    symbolInventory?: SymbolInventory;
    dependencyAudit?: DependencyAuditFindings;
    architecturePatterns?: ArchitecturePatternFindings;
    lastSavedAt?: string;
  };
};

function createInitialTaskProgress(status: RepoTaskStatus): RepoTaskProgress {
  return {
    status,
    totalItems: 0,
    completedItems: 0,
    remainingItems: 0,
    percentComplete: 0,
    updatedAt: new Date().toISOString()
  };
}

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
      remainingFiles: 0,
      containers: {},
      repoAuthoringModels: [RepoAuthorshipModel.MANUAL],
      fileAuthorshipCounts: {
        [RepoAuthorshipModel.MANUAL]: 0
      },
      tasks: {
        [RepoTask.LEARN_REPO]: createInitialTaskProgress("not_started"),
        [RepoTask.CLEAN_REPO]: createInitialTaskProgress("not_started"),
        [RepoTask.SIMPLIFY_REPO]: createInitialTaskProgress("not_started")
      },
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
      simplifications: [],
      subRepos: [],
      deadCodeCandidates: []
    }
  };
}

export function hydrateRepoBrainState(input: unknown, repoPath: string): RepoBrainState {
  const initial = createInitialRepoBrainState(repoPath);

  if (!input || typeof input !== "object") {
    return initial;
  }

  const state = input as Partial<RepoBrainState>;
  const activeContext = state.activeContext || initial.activeContext;

  const tasks = {
    [RepoTask.LEARN_REPO]: {
      ...initial.activeContext.tasks[RepoTask.LEARN_REPO],
      ...(activeContext.tasks?.[RepoTask.LEARN_REPO] || {})
    },
    [RepoTask.CLEAN_REPO]: {
      ...initial.activeContext.tasks[RepoTask.CLEAN_REPO],
      ...(activeContext.tasks?.[RepoTask.CLEAN_REPO] || {})
    },
    [RepoTask.SIMPLIFY_REPO]: {
      ...initial.activeContext.tasks[RepoTask.SIMPLIFY_REPO],
      ...(activeContext.tasks?.[RepoTask.SIMPLIFY_REPO] || {})
    }
  };

  return {
    ...initial,
    ...state,
    repoPath: typeof state.repoPath === "string" && state.repoPath ? state.repoPath : repoPath,
    eyes: Array.isArray(state.eyes) ? state.eyes : initial.eyes,
    nose: Array.isArray(state.nose) ? state.nose : initial.nose,
    ears: Array.isArray(state.ears) ? state.ears : initial.ears,
    hands: Array.isArray(state.hands) ? state.hands : initial.hands,
    brain: Array.isArray(state.brain) ? state.brain : initial.brain,
    activeContext: {
      ...initial.activeContext,
      ...activeContext,
      tokenBudget: {
        ...initial.activeContext.tokenBudget,
        ...(activeContext.tokenBudget || {})
      },
      progress: {
        ...initial.activeContext.progress,
        ...(activeContext.progress || {})
      },
      containers: {
        ...initial.activeContext.containers,
        ...(activeContext.containers || {})
      },
      repoAuthoringModels: Array.isArray(activeContext.repoAuthoringModels)
        ? activeContext.repoAuthoringModels
        : initial.activeContext.repoAuthoringModels,
      fileAuthorshipCounts: {
        ...initial.activeContext.fileAuthorshipCounts,
        ...(activeContext.fileAuthorshipCounts || {})
      },
      tasks
    },
    learned: {
      ...initial.learned,
      ...(state.learned || {}),
      subRepos: Array.isArray(state.learned?.subRepos) ? state.learned!.subRepos : [],
      deadCodeCandidates: Array.isArray(state.learned?.deadCodeCandidates)
        ? state.learned!.deadCodeCandidates
        : []
    }
  };
}
