#!/usr/bin/env bash
set -e

mkdir -p src/{cli,context,default-brain,enums,events,models,observable,prompts/scan,prompts/brain,prompts/handoff,tokens,workflows,writers}
mkdir -p .cortex

cat > packages.txt <<'TXT'
commander
chalk
ora
zod
fast-glob
ignore
chokidar
TXT

cat > dev-packages.txt <<'TXT'
typescript
tsx
@types/node
TXT

cat > package.json <<'JSON'
{
  "name": "repo-cortex",
  "version": "0.1.0",
  "description": "Code-agnostic observable repo memory system that builds BRAIN, EYES, NOSE, EARS, and HANDS markdown files.",
  "type": "module",
  "bin": {
    "repo-cortex": "./dist/cli/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "install:deps": "npm install $(cat packages.txt) && npm install -D $(cat dev-packages.txt)",
    "dev": "tsx src/cli/index.ts",
    "build": "tsc",
    "start": "node dist/cli/index.js",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "repo",
    "codebase",
    "ai",
    "observability",
    "architecture",
    "refactoring",
    "technical-debt",
    "code-smells"
  ],
  "author": "",
  "license": "MIT"
}
JSON

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
JSON

cat > src/enums/repo-memory-file.enum.ts <<'TS'
export enum RepoMemoryFile {
  BRAIN = "BRAIN.md",
  EYES = "EYES.md",
  NOSE = "NOSE.md",
  EARS = "EARS.md",
  HANDS = "HANDS.md"
}
TS

cat > src/enums/repo-event-type.enum.ts <<'TS'
export enum RepoEventType {
  STRUCTURE_OBSERVED = "STRUCTURE_OBSERVED",
  FILE_OBSERVED = "FILE_OBSERVED",
  DIRECTORY_OBSERVED = "DIRECTORY_OBSERVED",
  ENTRYPOINT_OBSERVED = "ENTRYPOINT_OBSERVED",
  ROUTE_OBSERVED = "ROUTE_OBSERVED",
  API_ENDPOINT_OBSERVED = "API_ENDPOINT_OBSERVED",
  DATA_MODEL_OBSERVED = "DATA_MODEL_OBSERVED",
  INTEGRATION_OBSERVED = "INTEGRATION_OBSERVED",
  CONFIG_OBSERVED = "CONFIG_OBSERVED",
  TEST_OBSERVED = "TEST_OBSERVED",
  TECHNOLOGY_OBSERVED = "TECHNOLOGY_OBSERVED",

  CODE_SMELL_DETECTED = "CODE_SMELL_DETECTED",
  BREAKS_SINGLE_RESPONSIBILITY = "BREAKS_SINGLE_RESPONSIBILITY",
  POSSIBLE_SILENT_FAILURE = "POSSIBLE_SILENT_FAILURE",
  UNSAFE_TYPE_ESCAPE = "UNSAFE_TYPE_ESCAPE",
  DEAD_CODE_CANDIDATE = "DEAD_CODE_CANDIDATE",
  DEAD_ROUTE_CANDIDATE = "DEAD_ROUTE_CANDIDATE",
  MISSING_ERROR_HANDLING = "MISSING_ERROR_HANDLING",
  MISSING_TEST_COVERAGE = "MISSING_TEST_COVERAGE",
  FRAMEWORK_LEAK = "FRAMEWORK_LEAK",

  NOISE_DETECTED = "NOISE_DETECTED",
  OVERCOMPLICATED_LOGIC = "OVERCOMPLICATED_LOGIC",
  TOO_MANY_ABSTRACTIONS = "TOO_MANY_ABSTRACTIONS",
  PREMATURE_PATTERN = "PREMATURE_PATTERN",
  UNCLEAR_NAMING = "UNCLEAR_NAMING",
  VERBOSE_CONTROL_FLOW = "VERBOSE_CONTROL_FLOW",
  REPEATED_BOILERPLATE = "REPEATED_BOILERPLATE",
  UNNECESSARY_INDIRECTION = "UNNECESSARY_INDIRECTION",

  WORK_UNIT_STARTED = "WORK_UNIT_STARTED",
  WORK_UNIT_COMPLETED = "WORK_UNIT_COMPLETED",
  MODEL_TOKEN_USAGE_RECORDED = "MODEL_TOKEN_USAGE_RECORDED",
  MODEL_HANDOFF_RECORDED = "MODEL_HANDOFF_RECORDED",
  PROGRESS_UPDATED = "PROGRESS_UPDATED",

  DEFAULT_KNOWLEDGE_LOADED = "DEFAULT_KNOWLEDGE_LOADED",
  DOC_CONTEXT_ADDED = "DOC_CONTEXT_ADDED",
  ARCHITECTURE_INFERRED = "ARCHITECTURE_INFERRED",
  UNDERSTANDING_UPDATED = "UNDERSTANDING_UPDATED",
  NEXT_ACTION_RECOMMENDED = "NEXT_ACTION_RECOMMENDED"
}
TS

cat > src/enums/work-unit.enum.ts <<'TS'
export enum WorkUnit {
  INIT_BODY = "INIT_BODY",
  UNDERSTAND_REPO = "UNDERSTAND_REPO",
  SCAN_DIRECTORY = "SCAN_DIRECTORY",
  SCAN_FILE = "SCAN_FILE",
  CLASSIFY_FILE = "CLASSIFY_FILE",
  DETECT_STRUCTURE = "DETECT_STRUCTURE",
  DETECT_SMELLS = "DETECT_SMELLS",
  DETECT_NOISE = "DETECT_NOISE",
  UPDATE_BRAIN = "UPDATE_BRAIN",
  WRITE_ORGAN = "WRITE_ORGAN"
}
TS

cat > src/enums/model.enum.ts <<'TS'
export enum ModelId {
  DEFAULT_FAST = "DEFAULT_FAST",
  DEFAULT_REASONING = "DEFAULT_REASONING",
  DEFAULT_LONG_CONTEXT = "DEFAULT_LONG_CONTEXT",
  DEFAULT_LOCAL = "DEFAULT_LOCAL"
}
TS

cat > src/enums/model-role.enum.ts <<'TS'
export enum ModelRole {
  FAST_SCAN = "FAST_SCAN",
  DEEP_REASONING = "DEEP_REASONING",
  LONG_CONTEXT = "LONG_CONTEXT",
  LOCAL_SAFE = "LOCAL_SAFE"
}
TS

cat > src/enums/prompt.enum.ts <<'TS'
export enum PromptId {
  REPO_SCAN = "REPO_SCAN",
  FILE_SCAN = "FILE_SCAN",
  DIRECTORY_SUMMARY = "DIRECTORY_SUMMARY",
  BRAIN_UPDATE = "BRAIN_UPDATE",
  CONTEXT_HANDOFF = "CONTEXT_HANDOFF"
}
TS

cat > src/context/repo-event.types.ts <<'TS'
import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";

export type Confidence = "low" | "medium" | "high";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type RepoEvent = {
  id: string;
  type: RepoEventType;
  targetFile: RepoMemoryFile;
  title: string;
  summary: string;
  sourcePath?: string;
  directory?: string;
  line?: number;
  confidence: Confidence;
  severity: Severity;
  evidence: string[];
  suggestedAction?: string;
  createdAt: string;
};
TS

cat > src/context/repo-brain.store.ts <<'TS'
import { RepoEvent } from "./repo-event.types.js";
import { WorkUnit } from "../enums/work-unit.enum.js";
import { ModelId } from "../enums/model.enum.js";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  workUnitsCompleted: number;
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
    tokenBudget: {
      maxTokens: number;
      handoffAtPercent: number;
      totalUsed: number;
      percentUsed: number;
    };
    tokenUsageByModel: Partial<Record<ModelId, TokenUsage>>;
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

export const createInitialRepoBrainState = (repoPath = ""): RepoBrainState => ({
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
});
TS

cat > src/default-brain/default-brain.ts <<'TS'
export const DEFAULT_BRAIN = {
  identity:
    "Technology-agnostic senior full-stack developer focused on simplicity, maintainability, clean architecture, and practical design.",
  principles: [
    {
      id: "kiss",
      name: "KISS",
      rule: "Prefer the simplest design that solves the actual problem."
    },
    {
      id: "dry",
      name: "DRY",
      rule: "Avoid duplicated knowledge, not merely duplicated text."
    },
    {
      id: "single_responsibility",
      name: "Single Responsibility Principle",
      rule: "A file, class, function, or module should have one clear reason to change.",
      violationEnum: "BREAKS_SINGLE_RESPONSIBILITY"
    },
    {
      id: "clean_architecture",
      name: "Clean Architecture",
      rule: "Keep business logic independent from frameworks where practical."
    },
    {
      id: "visible_failures",
      name: "Failure Visibility",
      rule: "Failures should be visible unless intentionally suppressed with evidence."
    },
    {
      id: "type_safety",
      name: "Type Safety",
      rule: "Do not bypass safety systems unless at a clear boundary with validation."
    },
    {
      id: "low_noise",
      name: "Low Noise",
      rule: "Code should reduce understanding cost."
    }
  ],
  patterns: [
    {
      id: "factory",
      useWhen: ["creation varies by config", "provider differs", "task type differs"]
    },
    {
      id: "adapter",
      useWhen: ["external APIs differ", "technology-specific implementations need a common interface"]
    },
    {
      id: "strategy",
      useWhen: ["same task has multiple algorithms"]
    },
    {
      id: "observer",
      useWhen: ["state changes should notify other systems"]
    }
  ]
};
TS

cat > src/events/repo-event-router.ts <<'TS'
import { RepoEvent } from "../context/repo-event.types.js";
import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";

export class RepoEventRouter {
  route(event: RepoEvent): RepoMemoryFile {
    switch (event.type) {
      case RepoEventType.STRUCTURE_OBSERVED:
      case RepoEventType.FILE_OBSERVED:
      case RepoEventType.DIRECTORY_OBSERVED:
      case RepoEventType.ENTRYPOINT_OBSERVED:
      case RepoEventType.ROUTE_OBSERVED:
      case RepoEventType.API_ENDPOINT_OBSERVED:
      case RepoEventType.DATA_MODEL_OBSERVED:
      case RepoEventType.INTEGRATION_OBSERVED:
      case RepoEventType.CONFIG_OBSERVED:
      case RepoEventType.TEST_OBSERVED:
      case RepoEventType.TECHNOLOGY_OBSERVED:
        return RepoMemoryFile.EYES;

      case RepoEventType.CODE_SMELL_DETECTED:
      case RepoEventType.BREAKS_SINGLE_RESPONSIBILITY:
      case RepoEventType.POSSIBLE_SILENT_FAILURE:
      case RepoEventType.UNSAFE_TYPE_ESCAPE:
      case RepoEventType.DEAD_CODE_CANDIDATE:
      case RepoEventType.DEAD_ROUTE_CANDIDATE:
      case RepoEventType.MISSING_ERROR_HANDLING:
      case RepoEventType.MISSING_TEST_COVERAGE:
      case RepoEventType.FRAMEWORK_LEAK:
        return RepoMemoryFile.NOSE;

      case RepoEventType.NOISE_DETECTED:
      case RepoEventType.OVERCOMPLICATED_LOGIC:
      case RepoEventType.TOO_MANY_ABSTRACTIONS:
      case RepoEventType.PREMATURE_PATTERN:
      case RepoEventType.UNCLEAR_NAMING:
      case RepoEventType.VERBOSE_CONTROL_FLOW:
      case RepoEventType.REPEATED_BOILERPLATE:
      case RepoEventType.UNNECESSARY_INDIRECTION:
        return RepoMemoryFile.EARS;

      case RepoEventType.WORK_UNIT_STARTED:
      case RepoEventType.WORK_UNIT_COMPLETED:
      case RepoEventType.MODEL_TOKEN_USAGE_RECORDED:
      case RepoEventType.MODEL_HANDOFF_RECORDED:
      case RepoEventType.PROGRESS_UPDATED:
        return RepoMemoryFile.HANDS;

      default:
        return RepoMemoryFile.BRAIN;
    }
  }
}
TS

cat > src/events/event-factory.ts <<'TS'
import crypto from "crypto";
import { RepoEvent } from "../context/repo-event.types.js";
import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";

export function createRepoEvent(input: {
  type: RepoEventType;
  targetFile: RepoMemoryFile;
  title: string;
  summary: string;
  sourcePath?: string;
  directory?: string;
  evidence?: string[];
  suggestedAction?: string;
  confidence?: "low" | "medium" | "high";
  severity?: "info" | "low" | "medium" | "high" | "critical";
}): RepoEvent {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    targetFile: input.targetFile,
    title: input.title,
    summary: input.summary,
    sourcePath: input.sourcePath,
    directory: input.directory,
    confidence: input.confidence || "medium",
    severity: input.severity || "info",
    evidence: input.evidence || [],
    suggestedAction: input.suggestedAction,
    createdAt: new Date().toISOString()
  };
}
TS

cat > src/models/model-registry.ts <<'TS'
import { ModelId } from "../enums/model.enum.js";
import { ModelRole } from "../enums/model-role.enum.js";
import { WorkUnit } from "../enums/work-unit.enum.js";

export type ModelConfig = {
  id: ModelId;
  role: ModelRole;
  provider: string;
  maxTokens: number;
  handoffAtPercent: number;
};

export const MODEL_REGISTRY: Record<ModelId, ModelConfig> = {
  [ModelId.DEFAULT_FAST]: {
    id: ModelId.DEFAULT_FAST,
    role: ModelRole.FAST_SCAN,
    provider: "mock",
    maxTokens: 120000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_REASONING]: {
    id: ModelId.DEFAULT_REASONING,
    role: ModelRole.DEEP_REASONING,
    provider: "mock",
    maxTokens: 120000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_LONG_CONTEXT]: {
    id: ModelId.DEFAULT_LONG_CONTEXT,
    role: ModelRole.LONG_CONTEXT,
    provider: "mock",
    maxTokens: 500000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_LOCAL]: {
    id: ModelId.DEFAULT_LOCAL,
    role: ModelRole.LOCAL_SAFE,
    provider: "mock",
    maxTokens: 32000,
    handoffAtPercent: 80
  }
};

export function selectModelForWorkUnit(workUnit: WorkUnit): ModelId {
  switch (workUnit) {
    case WorkUnit.SCAN_FILE:
    case WorkUnit.CLASSIFY_FILE:
    case WorkUnit.DETECT_STRUCTURE:
      return ModelId.DEFAULT_FAST;

    case WorkUnit.DETECT_SMELLS:
    case WorkUnit.DETECT_NOISE:
    case WorkUnit.UPDATE_BRAIN:
      return ModelId.DEFAULT_REASONING;

    case WorkUnit.UNDERSTAND_REPO:
      return ModelId.DEFAULT_LONG_CONTEXT;

    default:
      return ModelId.DEFAULT_FAST;
  }
}
TS

cat > src/models/mock-model-runner.ts <<'TS'
import { ModelId } from "../enums/model.enum.js";

export async function runModel(modelId: ModelId, prompt: { system: string; user: string }) {
  return JSON.stringify({
    modelId,
    note: "Mock model response. Replace this with a real provider adapter.",
    eyes: [],
    nose: [],
    ears: [],
    brain: [
      {
        title: "File scanned",
        summary: "The file was scanned by the prompt pipeline.",
        evidence: ["Mock runner executed"]
      }
    ]
  });
}
TS

cat > src/tokens/token-tracker.ts <<'TS'
import fs from "fs";
import path from "path";
import { ModelId } from "../enums/model.enum.js";

export type TokenRecord = {
  modelId: ModelId;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  workUnits: number;
};

export type TokenLedger = Partial<Record<ModelId, TokenRecord>>;

const tokenPath = path.join(process.cwd(), ".cortex", "token-usage.json");

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function readTokenLedger(): TokenLedger {
  if (!fs.existsSync(tokenPath)) return {};
  return JSON.parse(fs.readFileSync(tokenPath, "utf8") || "{}");
}

export function recordTokenUsage(modelId: ModelId, inputText: string, outputText: string): TokenRecord {
  const ledger = readTokenLedger();

  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const totalTokens = inputTokens + outputTokens;

  const existing = ledger[modelId] || {
    modelId,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    workUnits: 0
  };

  const updated: TokenRecord = {
    modelId,
    inputTokens: existing.inputTokens + inputTokens,
    outputTokens: existing.outputTokens + outputTokens,
    totalTokens: existing.totalTokens + totalTokens,
    workUnits: existing.workUnits + 1
  };

  ledger[modelId] = updated;
  fs.writeFileSync(tokenPath, JSON.stringify(ledger, null, 2), "utf8");

  return updated;
}

export function shouldHandoff(modelId: ModelId, maxTokens: number, percent = 80): boolean {
  const ledger = readTokenLedger();
  const used = ledger[modelId]?.totalTokens || 0;
  return used >= maxTokens * (percent / 100);
}
TS

cat > src/observable/global-context.ts <<'TS'
import fs from "fs";
import path from "path";
import { RepoBrainState, createInitialRepoBrainState } from "../context/repo-brain.store.js";
import { RepoEvent } from "../context/repo-event.types.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { ModelId } from "../enums/model.enum.js";
import { WorkUnit } from "../enums/work-unit.enum.js";

const contextPath = path.join(process.cwd(), ".cortex", "context.json");

type Listener = (state: RepoBrainState) => void;

class GlobalContextStore {
  private listeners: Listener[] = [];

  get(): RepoBrainState {
    if (!fs.existsSync(contextPath)) {
      return createInitialRepoBrainState(process.cwd());
    }

    return JSON.parse(fs.readFileSync(contextPath, "utf8"));
  }

  set(state: RepoBrainState) {
    fs.mkdirSync(path.dirname(contextPath), { recursive: true });
    fs.writeFileSync(contextPath, JSON.stringify(state, null, 2), "utf8");
    this.listeners.forEach((listener) => listener(state));
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    listener(this.get());

    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  pushEvent(event: RepoEvent) {
    const state = this.get();

    const next = {
      ...state,
      eyes: event.targetFile === RepoMemoryFile.EYES ? [...state.eyes, event] : state.eyes,
      nose: event.targetFile === RepoMemoryFile.NOSE ? [...state.nose, event] : state.nose,
      ears: event.targetFile === RepoMemoryFile.EARS ? [...state.ears, event] : state.ears,
      hands: event.targetFile === RepoMemoryFile.HANDS ? [...state.hands, event] : state.hands,
      brain: event.targetFile === RepoMemoryFile.BRAIN ? [...state.brain, event] : state.brain
    };

    this.set(next);
  }

  setActiveWork(input: {
    directory?: string;
    file?: string;
    model?: ModelId;
    step?: WorkUnit;
  }) {
    const state = this.get();

    this.set({
      ...state,
      activeContext: {
        ...state.activeContext,
        activeDirectory: input.directory ?? state.activeContext.activeDirectory,
        activeFile: input.file ?? state.activeContext.activeFile,
        activeModel: input.model ?? state.activeContext.activeModel,
        activeStep: input.step ?? state.activeContext.activeStep
      }
    });
  }

  updateProgress(input: {
    totalFiles?: number;
    scannedFiles?: number;
    totalDirectories?: number;
    scannedDirectories?: number;
  }) {
    const state = this.get();

    const progress = {
      ...state.activeContext.progress,
      ...input
    };

    const percentComplete =
      progress.totalFiles > 0 ? Math.round((progress.scannedFiles / progress.totalFiles) * 100) : 0;

    this.set({
      ...state,
      activeContext: {
        ...state.activeContext,
        progress: {
          ...progress,
          percentComplete
        }
      }
    });
  }
}

export const GlobalContext = new GlobalContextStore();
TS

cat > src/prompts/base.prompt.ts <<'TS'
import { PromptId } from "../enums/prompt.enum.js";

export abstract class BasePrompt<TInput> {
  abstract id: PromptId;
  abstract system: string;

  constructor(protected input: TInput) {}

  abstract user(): string;

  build() {
    return {
      id: this.id,
      system: this.system.trim(),
      user: this.user().trim()
    };
  }
}
TS

cat > src/prompts/scan/file-scan.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class FileScanPrompt extends BasePrompt<{
  filePath: string;
  fileContent: string;
  currentBrain: string;
}> {
  id = PromptId.FILE_SCAN;

  system = `
You are scanning a repository.
Stay technology-agnostic.
Do not refactor.
Do not invent missing facts.
Return concise JSON only.
Classify findings for EYES, NOSE, EARS, and BRAIN.
`;

  user() {
    return `
Current Brain Context:
${this.input.currentBrain}

File Path:
${this.input.filePath}

File Content:
${this.input.fileContent}

Return JSON:
{
  "eyes": [],
  "nose": [],
  "ears": [],
  "brain": []
}
`;
  }
}
TS

cat > src/prompts/scan/directory-summary.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class DirectorySummaryPrompt extends BasePrompt<{
  directory: string;
  fileSummaries: string;
  currentContext: string;
}> {
  id = PromptId.DIRECTORY_SUMMARY;

  system = `
You summarize one directory after scanning its files.
Explain what this directory appears responsible for.
Return concise JSON only.
`;

  user() {
    return `
Directory:
${this.input.directory}

Current Context:
${this.input.currentContext}

File Summaries:
${this.input.fileSummaries}

Return JSON:
{
  "directoryPurpose": "",
  "importantFiles": [],
  "risks": [],
  "noise": [],
  "brainUpdate": "",
  "nextQuestions": []
}
`;
  }
}
TS

cat > src/prompts/brain/brain-update.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class BrainUpdatePrompt extends BasePrompt<{ context: string }> {
  id = PromptId.BRAIN_UPDATE;

  system = `
You update BRAIN.md from current repo observations.
Be concise.
Preserve durable understanding only.
Do not include raw logs.
`;

  user() {
    return `
Current Global Context:
${this.input.context}

Write a concise Brain update with:
- repo purpose if known
- architecture understanding
- important flows
- risks
- simplification strategy
- next recommended action
`;
  }
}
TS

cat > src/prompts/handoff/context-handoff.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt.js";
import { PromptId } from "../../enums/prompt.enum.js";

export class ContextHandoffPrompt extends BasePrompt<{
  fromModel: string;
  toModel: string;
  context: string;
}> {
  id = PromptId.CONTEXT_HANDOFF;

  system = `
You create a handoff summary for another model.
Compress aggressively.
Preserve only facts, decisions, risks, and next steps.
`;

  user() {
    return `
From Model:
${this.input.fromModel}

To Model:
${this.input.toModel}

Current Context:
${this.input.context}

Return JSON:
{
  "completedWork": [],
  "durableFacts": [],
  "risks": [],
  "openQuestions": [],
  "nextStep": ""
}
`;
  }
}
TS

cat > src/writers/organ-writer.ts <<'TS'
import fs from "fs";
import path from "path";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { RepoEvent } from "../context/repo-event.types.js";

export function appendOrganEvent(event: RepoEvent) {
  const filePath = path.join(process.cwd(), event.targetFile);

  const lines = [
    "",
    `### ${event.title}`,
    "",
    `- Type: ${event.type}`,
    event.sourcePath ? `- Source: \`${event.sourcePath}\`` : "",
    event.directory ? `- Directory: \`${event.directory}\`` : "",
    `- Confidence: ${event.confidence}`,
    `- Severity: ${event.severity}`,
    "",
    event.summary,
    "",
    "Evidence:",
    ...event.evidence.map((item) => `- ${item}`),
    event.suggestedAction ? "" : "",
    event.suggestedAction ? `Suggested action: ${event.suggestedAction}` : "",
    ""
  ].filter(Boolean);

  fs.appendFileSync(filePath, lines.join("\n"), "utf8");
}

export function appendBrainText(title: string, body: string) {
  fs.appendFileSync(
    path.join(process.cwd(), RepoMemoryFile.BRAIN),
    `\n\n## ${title}\n\n${body}\n`,
    "utf8"
  );
}
TS

cat > src/workflows/init-body.workflow.ts <<'TS'
import fs from "fs";
import path from "path";
import { createInitialRepoBrainState } from "../context/repo-brain.store.js";
import { DEFAULT_BRAIN } from "../default-brain/default-brain.js";

const ORGAN_TEMPLATES: Record<string, string> = {
  "BRAIN.md": `# BRAIN.md

> The Brain starts with default senior engineering knowledge, then learns from EYES, NOSE, EARS, and HANDS.

## Legend

- DEFAULT_KNOWLEDGE: Known before scanning.
- LEARNED_KNOWLEDGE: Learned from the repo.
- SMELL_KNOWLEDGE: Learned from NOSE.
- NOISE_KNOWLEDGE: Learned from EARS.
- WORK_CONTEXT: Learned from HANDS.
- DOC_CONTEXT: Fetched from official technology documentation.
- RISK: Needs attention.

---

# DEFAULT_KNOWLEDGE

## Identity

The Brain acts as a technology-agnostic senior full-stack developer.

It prefers simplicity, small modules, explicit behavior, visible failures, clean boundaries, low noise, and practical patterns.

## KISS

Keep the system as simple as possible.

## DRY

Avoid duplicated knowledge, not merely duplicated text.

## Single Responsibility

A file, class, function, or module should have one clear reason to change.

Flag as BREAKS_SINGLE_RESPONSIBILITY when one unit handles multiple unrelated jobs.

## Clean Architecture

Business rules should not be trapped inside UI, route handlers, controllers, or framework glue.

## Failure Visibility

Failures should usually be logged, returned, retried, rethrown, monitored, or intentionally documented.

## Type Safety

Unsafe type escapes may be acceptable at system boundaries, but should not spread into core business logic.

## Noise

Noise is anything that increases understanding cost without increasing system value.

---

# DOC_CONTEXT

Empty until technologies are detected and official docs are fetched.

---

# LEARNED_KNOWLEDGE

## Repo Purpose

Empty until learned.

## Architecture

Empty until learned.

## Main Flows

Empty until learned.

## Architecture Layers (High Level)

- Frontend code makeup: Empty until learned.
- Frontend to backend interactions: Empty until learned.
- Backend code: Empty until learned.
- Backend to database interactions: Empty until learned.
- Caching layer: Empty until learned.
- SignalR / Realtime layer: Empty until learned.

## Data Layer Posture

- Database technology: Database-agnostic until concrete database usage is detected.
- Database connection summary: Empty until learned.

## Tech Stack

Empty until learned.

## Learned From EYES

Empty until observed.

## Learned From NOSE

Empty until smells are detected.

## Learned From EARS

Empty until noise is detected.

## Work Status From HANDS

Empty until work begins.

## High-Risk Areas

Empty until risks are detected.

## Simplification Strategy

Empty until enough context exists.

## Next Recommended Actions

Empty until first pass completes.
`,
  "EYES.md": `# EYES.md

> EYES observes what exists. EYES does not judge. It records evidence.

## Directories

## Files

## Entry Points

## Routes

## Pages / Screens / Views

## API Endpoints

## Data Models

## Third-Party Integrations

## Config Files

## Scripts

## Tests

## Environment Variables

## Detected Technologies

## Risky Evidence Observed
`,
  "NOSE.md": `# NOSE.md

> NOSE classifies smells, risks, and bad patterns using code-agnostic rules.

## Breaks Single Responsibility

## Possible Silent Failures

## Unsafe Type Escapes

## Dead Code Candidates

## Dead Route Candidates

## Missing Error Handling

## Missing Test Coverage

## Framework Leaks

## Security Risks

## Performance Risks

## Cleanup Queue
`,
  "EARS.md": `# EARS.md

> EARS hears noise: code that may work but is louder, more complex, or harder to understand than needed.

## Noisy Code

## Overcomplicated Logic

## Too Many Abstractions

## Premature Patterns

## Unclear Naming

## Verbose Control Flow

## Repeated Boilerplate

## Cognitive Overload

## Unnecessary Indirection

## Could Be Simpler

## Suggested Simplifications
`,
  "HANDS.md": `# HANDS.md

> HANDS tracks work, progress, token usage, model usage, and handoffs.

## Active Goal

understand_repo

## Active Workflow

first_pass

## Active Directory

Empty until work begins.

## Active File

Empty until work begins.

## Completed Work Units

## Current Model

Empty until model is selected.

## Token Usage By Model

| Model | Input Tokens | Output Tokens | Total Tokens | Work Units |
|---|---:|---:|---:|---:|

## Token Budget

- Max tokens: 120000
- Handoff at: 80%

## Handoffs

## Progress

- Directories scanned: 0 / 0
- Files scanned: 0 / 0
- Percent complete: 0%

## Next Work

Initialize first pass scan.
`
};

export function initCortexBody(repoRoot: string) {
  const cortexDir = path.join(repoRoot, ".cortex");
  fs.mkdirSync(cortexDir, { recursive: true });

  fs.writeFileSync(
    path.join(cortexDir, "context.json"),
    JSON.stringify(createInitialRepoBrainState(repoRoot), null, 2),
    "utf8"
  );

  fs.writeFileSync(
    path.join(cortexDir, "default-brain.json"),
    JSON.stringify(DEFAULT_BRAIN, null, 2),
    "utf8"
  );

  fs.writeFileSync(path.join(cortexDir, "events.jsonl"), "", "utf8");
  fs.writeFileSync(path.join(cortexDir, "token-usage.json"), "{}", "utf8");
  fs.writeFileSync(path.join(cortexDir, "graph.json"), "{}", "utf8");

  for (const [file, contents] of Object.entries(ORGAN_TEMPLATES)) {
    const target = path.join(repoRoot, file);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, contents, "utf8");
    }
  }

  console.log("Cortex body initialized.");
  console.log("Created organs: BRAIN.md, EYES.md, NOSE.md, EARS.md, HANDS.md");
  console.log("Created state in .cortex/");
}
TS

cat > src/workflows/learn.workflow.ts <<'TS'
import fs from "fs";
import path from "path";
import { GlobalContext } from "../observable/global-context.js";
import { WorkUnit } from "../enums/work-unit.enum.js";
import { ModelId } from "../enums/model.enum.js";
import { selectModelForWorkUnit, MODEL_REGISTRY } from "../models/model-registry.js";
import { FileScanPrompt } from "../prompts/scan/file-scan.prompt.js";
import { ContextHandoffPrompt } from "../prompts/handoff/context-handoff.prompt.js";
import { runModel } from "../models/mock-model-runner.js";
import { recordTokenUsage, shouldHandoff } from "../tokens/token-tracker.js";
import { createRepoEvent } from "../events/event-factory.js";
import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { appendOrganEvent, appendBrainText } from "../writers/organ-writer.js";

const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".cortex", "coverage"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".py", ".go", ".rs", ".java", ".cs", ".php", ".rb"]);

function walk(dir: string): string[] {
  const results: string[] = [];

  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(item)) results.push(...walk(fullPath));
      continue;
    }

    if (CODE_EXTENSIONS.has(path.extname(item))) {
      results.push(fullPath);
    }
  }

  return results;
}

function readBrainContext() {
  const brainPath = path.join(process.cwd(), "BRAIN.md");
  if (!fs.existsSync(brainPath)) return "";
  return fs.readFileSync(brainPath, "utf8").slice(-12000);
}

async function handoffIfNeeded(modelId: ModelId): Promise<ModelId> {
  const config = MODEL_REGISTRY[modelId];

  if (!shouldHandoff(modelId, config.maxTokens, config.handoffAtPercent)) {
    return modelId;
  }

  const nextModel = ModelId.DEFAULT_REASONING;
  const context = JSON.stringify(GlobalContext.get()).slice(-20000);

  const prompt = new ContextHandoffPrompt({
    fromModel: modelId,
    toModel: nextModel,
    context
  }).build();

  const output = await runModel(modelId, prompt);
  recordTokenUsage(modelId, prompt.system + prompt.user, output);

  appendBrainText("Model Handoff", output);

  const event = createRepoEvent({
    type: RepoEventType.MODEL_HANDOFF_RECORDED,
    targetFile: RepoMemoryFile.HANDS,
    title: `Model handoff: ${modelId} -> ${nextModel}`,
    summary: "Token threshold reached. Context was compressed and handed to the next model.",
    evidence: [output],
    severity: "info",
    confidence: "high"
  });

  GlobalContext.pushEvent(event);
  appendOrganEvent(event);

  return nextModel;
}

export async function learn(repoRoot: string) {
  const files = walk(repoRoot);
  GlobalContext.updateProgress({ totalFiles: files.length });

  console.log(`Starting Cortex learn pass.`);
  console.log(`Files found: ${files.length}`);

  let scannedFiles = 0;

  for (const filePath of files) {
    const relativePath = path.relative(repoRoot, filePath);
    let modelId = selectModelForWorkUnit(WorkUnit.SCAN_FILE);
    modelId = await handoffIfNeeded(modelId);

    GlobalContext.setActiveWork({
      file: relativePath,
      directory: path.dirname(relativePath),
      model: modelId,
      step: WorkUnit.SCAN_FILE
    });

    const content = fs.readFileSync(filePath, "utf8");

    const prompt = new FileScanPrompt({
      filePath: relativePath,
      fileContent: content.slice(0, 20000),
      currentBrain: readBrainContext()
    }).build();

    const output = await runModel(modelId, prompt);
    recordTokenUsage(modelId, prompt.system + prompt.user, output);

    const event = createRepoEvent({
      type: RepoEventType.FILE_OBSERVED,
      targetFile: RepoMemoryFile.EYES,
      title: `Scanned ${relativePath}`,
      summary: "File was scanned during the first learn pass.",
      sourcePath: relativePath,
      directory: path.dirname(relativePath),
      evidence: [`Model used: ${modelId}`],
      severity: "info",
      confidence: "high"
    });

    GlobalContext.pushEvent(event);
    appendOrganEvent(event);

    scannedFiles += 1;
    GlobalContext.updateProgress({ scannedFiles });

    const state = GlobalContext.get();
    const pct = state.activeContext.progress.percentComplete;

    process.stdout.write(`\rLearning: ${scannedFiles}/${files.length} files | ${pct}% | model=${modelId} | file=${relativePath.slice(0, 60)}   `);
  }

  console.log("");
  console.log("Cortex learn pass complete.");
  console.log("Updated: EYES.md, HANDS.md, BRAIN.md, .cortex/context.json, .cortex/token-usage.json");
}
TS

cat > src/cli/index.ts <<'TS'
#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { initCortexBody } from "../workflows/init-body.workflow.js";
import { learn } from "../workflows/learn.workflow.js";

const program = new Command();

program
  .name("repo-cortex")
  .description("Code-agnostic observable repo memory system.")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Cortex organs and .cortex state.")
  .action(() => {
    console.log(chalk.cyan("Initializing Repo Cortex..."));
    initCortexBody(process.cwd());
  });

program
  .command("learn")
  .description("Run the first pass repository understanding workflow.")
  .action(async () => {
    console.log(chalk.cyan("Starting Repo Cortex learn pass..."));
    await learn(process.cwd());
  });

program.parse();
TS

cat > README.md <<'MD'
# Repo Cortex

Repo Cortex is a code-agnostic observable memory system for understanding software repositories.

It creates a simple set of markdown "organs" that describe what the repo is, what smells bad, what is noisy, what work is happening, and what the system understands.

## What It Creates

```txt
BRAIN.md
EYES.md
NOSE.md
EARS.md
HANDS.md

.cortex/
  context.json
  default-brain.json
  events.jsonl
  token-usage.json
  graph.json
