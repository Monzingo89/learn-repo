#!/usr/bin/env bash
set -e

mkdir -p cortex/{models,prompts/scan,prompts/brain,prompts/handoff,tokens,observable,cli,workflows}

cat > cortex/enums/prompt.enum.ts <<'TS'
export enum PromptId {
  REPO_SCAN = "REPO_SCAN",
  FILE_SCAN = "FILE_SCAN",
  DIRECTORY_SUMMARY = "DIRECTORY_SUMMARY",
  BRAIN_UPDATE = "BRAIN_UPDATE",
  CONTEXT_HANDOFF = "CONTEXT_HANDOFF"
}
TS

cat > cortex/enums/model-role.enum.ts <<'TS'
export enum ModelRole {
  FAST_SCAN = "FAST_SCAN",
  DEEP_REASONING = "DEEP_REASONING",
  LONG_CONTEXT = "LONG_CONTEXT",
  LOCAL_SAFE = "LOCAL_SAFE"
}
TS

cat > cortex/models/model-registry.ts <<'TS'
import { ModelId } from "../enums/model.enum";
import { ModelRole } from "../enums/model-role.enum";
import { WorkUnit } from "../enums/work-unit.enum";

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
    provider: "openai",
    maxTokens: 120000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_REASONING]: {
    id: ModelId.DEFAULT_REASONING,
    role: ModelRole.DEEP_REASONING,
    provider: "openai",
    maxTokens: 120000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_LONG_CONTEXT]: {
    id: ModelId.DEFAULT_LONG_CONTEXT,
    role: ModelRole.LONG_CONTEXT,
    provider: "openai",
    maxTokens: 500000,
    handoffAtPercent: 80
  },
  [ModelId.DEFAULT_LOCAL]: {
    id: ModelId.DEFAULT_LOCAL,
    role: ModelRole.LOCAL_SAFE,
    provider: "local",
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

cat > cortex/tokens/token-tracker.ts <<'TS'
import fs from "fs";
import path from "path";
import { ModelId } from "../enums/model.enum";

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

export function recordTokenUsage(
  modelId: ModelId,
  inputText: string,
  outputText: string
): TokenRecord {
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

cat > cortex/observable/global-context.ts <<'TS'
import fs from "fs";
import path from "path";
import { RepoBrainState, createInitialRepoBrainState } from "../context/repo-brain.store";
import { RepoEvent } from "../context/repo-event.types";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum";
import { ModelId } from "../enums/model.enum";
import { WorkUnit } from "../enums/work-unit.enum";

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
      progress.totalFiles > 0
        ? Math.round((progress.scannedFiles / progress.totalFiles) * 100)
        : 0;

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

cat > cortex/prompts/base.prompt.ts <<'TS'
import { PromptId } from "../enums/prompt.enum";

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

cat > cortex/prompts/scan/file-scan.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt";
import { PromptId } from "../../enums/prompt.enum";

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
  "eyes": [
    {
      "title": "",
      "summary": "",
      "evidence": []
    }
  ],
  "nose": [
    {
      "title": "",
      "summary": "",
      "severity": "low|medium|high|critical",
      "evidence": [],
      "suggestedAction": ""
    }
  ],
  "ears": [
    {
      "title": "",
      "summary": "",
      "evidence": [],
      "simplerDirection": ""
    }
  ],
  "brain": [
    {
      "title": "",
      "summary": "",
      "evidence": []
    }
  ]
}
`;
  }
}
TS

cat > cortex/prompts/scan/directory-summary.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt";
import { PromptId } from "../../enums/prompt.enum";

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

cat > cortex/prompts/brain/brain-update.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt";
import { PromptId } from "../../enums/prompt.enum";

export class BrainUpdatePrompt extends BasePrompt<{
  context: string;
}> {
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

cat > cortex/prompts/handoff/context-handoff.prompt.ts <<'TS'
import { BasePrompt } from "../base.prompt";
import { PromptId } from "../../enums/prompt.enum";

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

cat > cortex/writers/organ-writer.ts <<'TS'
import fs from "fs";
import path from "path";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum";
import { RepoEvent } from "../context/repo-event.types";

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

cat > cortex/events/event-factory.ts <<'TS'
import crypto from "crypto";
import { RepoEvent } from "../context/repo-event.types";
import { RepoEventType } from "../enums/repo-event-type.enum";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum";

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

cat > cortex/models/mock-model-runner.ts <<'TS'
import { ModelId } from "../enums/model.enum";

export async function runModel(modelId: ModelId, prompt: { system: string; user: string }) {
  return JSON.stringify({
    modelId,
    note: "Mock model response. Replace this with real provider call.",
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

cat > cortex/workflows/learn.workflow.ts <<'TS'
import fs from "fs";
import path from "path";
import { GlobalContext } from "../observable/global-context";
import { WorkUnit } from "../enums/work-unit.enum";
import { ModelId } from "../enums/model.enum";
import { selectModelForWorkUnit, MODEL_REGISTRY } from "../models/model-registry";
import { FileScanPrompt } from "../prompts/scan/file-scan.prompt";
import { ContextHandoffPrompt } from "../prompts/handoff/context-handoff.prompt";
import { runModel } from "../models/mock-model-runner";
import { recordTokenUsage, shouldHandoff } from "../tokens/token-tracker";
import { createRepoEvent } from "../events/event-factory";
import { RepoEventType } from "../enums/repo-event-type.enum";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum";
import { appendOrganEvent, appendBrainText } from "../writers/organ-writer";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cortex",
  "coverage"
]);

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".cs",
  ".php",
  ".rb"
]);

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

cat > cortex/cli/learn.ts <<'TS'
import { learn } from "../workflows/learn.workflow";

learn(process.cwd()).catch((error) => {
  console.error(error);
  process.exit(1);
});
TS

echo "Learn layer installed."
echo "Run with: npx tsx cortex/cli/learn.ts"
