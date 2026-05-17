import fs from "fs";
import path from "path";
import { GlobalContext } from "../observable/global-context.js";
import { WorkUnit } from "../enums/work-unit.enum.js";
import { ModelId } from "../enums/model.enum.js";
import { selectModelForWorkUnit, MODEL_REGISTRY } from "../models/model-registry.js";
import { FileScanPrompt } from "../prompts/scan/file-scan.prompt.js";
import { ContextHandoffPrompt } from "../prompts/handoff/context-handoff.prompt.js";
import { runModel } from "../models/mock-model-runner.js";
import {
  estimateTokens,
  readTokenLedger,
  recordTokenUsage,
  shouldHandoff,
  TokenLedger
} from "../tokens/token-tracker.js";
import { createRepoEvent } from "../events/event-factory.js";
import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { appendOrganEvent, appendBrainText } from "../writers/organ-writer.js";
import { detectTechnologiesForPath } from "./technology-docs.js";
import {
  analyzeFileForArchitecture,
  architectureSnapshotSummary,
  buildArchitectureSnapshotMarkdown,
  createArchitectureSnapshot,
  type ArchitectureSnapshot
} from "./architecture-snapshot.js";

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cortex",
  "coverage"
]);

const DEFAULT_CODE_EXTENSIONS = new Set([
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
  ".rb",
  ".sh",
  ".yml",
  ".yaml"
]);

export type LearnOptions = {
  maxFileBytes: number;
  includeExt: string[];
  excludeDirs: string[];
  quiet: boolean;
  verbose: boolean;
};

export type DetectedTechnologySummary = {
  id: string;
  name: string;
  docsUrl: string;
  detectedIn: string[];
};

export type LearnSummary = {
  repoRoot: string;
  totalFiles: number;
  scannedFiles: number;
  durationMs: number;
  detectedTechnologies: DetectedTechnologySummary[];
  tokenUsageByModel: TokenLedger;
  architecture: ReturnType<typeof architectureSnapshotSummary>;
  distributionPlanPath: string;
};

const DEFAULT_LEARN_OPTIONS: LearnOptions = {
  maxFileBytes: 20000,
  includeExt: [],
  excludeDirs: [],
  quiet: false,
  verbose: false
};

function normalizeExtension(extension: string) {
  if (!extension) return "";
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

function resolveLearnOptions(input?: Partial<LearnOptions>): LearnOptions {
  const merged = {
    ...DEFAULT_LEARN_OPTIONS,
    ...(input || {})
  };

  return {
    ...merged,
    maxFileBytes: Number.isFinite(merged.maxFileBytes) && merged.maxFileBytes > 0
      ? Math.floor(merged.maxFileBytes)
      : DEFAULT_LEARN_OPTIONS.maxFileBytes,
    includeExt: Array.from(new Set((merged.includeExt || []).map(normalizeExtension).filter(Boolean))),
    excludeDirs: Array.from(new Set((merged.excludeDirs || []).map((item) => item.trim()).filter(Boolean)))
  };
}

function walk(dir: string, includeExtensions: Set<string>, excludeDirs: Set<string>): string[] {
  const results: string[] = [];

  const items = fs.readdirSync(dir).sort((a, b) => a.localeCompare(b));

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.has(item)) results.push(...walk(fullPath, includeExtensions, excludeDirs));
      continue;
    }

    if (includeExtensions.has(path.extname(item).toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results.sort((a, b) => a.localeCompare(b));
}

function readBrainContext(repoRoot: string) {
  const brainPath = path.join(repoRoot, "BRAIN.md");
  if (!fs.existsSync(brainPath)) return "";
  return fs.readFileSync(brainPath, "utf8").slice(-12000);
}

function readFileForPrompt(filePath: string, maxFileBytes: number): string {
  const raw = fs.readFileSync(filePath);
  return raw.subarray(0, maxFileBytes).toString("utf8");
}

async function handoffIfNeeded(modelId: ModelId, options: LearnOptions): Promise<ModelId> {
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
  const updatedTokens = recordTokenUsage(modelId, prompt.system + prompt.user, output);
  const tokenPct = Math.round((updatedTokens.totalTokens / config.maxTokens) * 100);

  if (!options.quiet) {
    console.log(`\n[handoff] ${modelId} -> ${nextModel} | model token use: ${updatedTokens.totalTokens}/${config.maxTokens} (${tokenPct}%)`);
  }

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

export async function learn(repoRoot: string, inputOptions?: Partial<LearnOptions>): Promise<LearnSummary> {
  const options = resolveLearnOptions(inputOptions);

  const includeExtensions = new Set(DEFAULT_CODE_EXTENSIONS);
  for (const extension of options.includeExt) includeExtensions.add(extension);

  const excludeDirs = new Set(DEFAULT_IGNORE_DIRS);
  for (const dir of options.excludeDirs) excludeDirs.add(dir);

  const files = walk(repoRoot, includeExtensions, excludeDirs);
  GlobalContext.updateProgress({ totalFiles: files.length });

  if (!options.quiet) {
    console.log("Starting Cortex learn pass.");
    console.log(`Files found: ${files.length}`);
  }

  const startedAt = Date.now();

  let scannedFiles = 0;
  const detectedTechMap = new Map<string, { id: string; name: string; docsUrl: string; detectedIn: Set<string> }>();
  const architectureSnapshot: ArchitectureSnapshot = createArchitectureSnapshot();

  for (const filePath of files) {
    const relativePath = path.relative(repoRoot, filePath);

    for (const technology of detectTechnologiesForPath(relativePath)) {
      const existing = detectedTechMap.get(technology.id);

      if (!existing) {
        detectedTechMap.set(technology.id, {
          ...technology,
          detectedIn: new Set([relativePath])
        });

        const techEvent = createRepoEvent({
          type: RepoEventType.TECHNOLOGY_OBSERVED,
          targetFile: RepoMemoryFile.EYES,
          title: `Detected technology: ${technology.name}`,
          summary: "Technology detected during scan. Documentation link captured.",
          sourcePath: relativePath,
          directory: path.dirname(relativePath),
          evidence: [`Docs: ${technology.docsUrl}`],
          severity: "info",
          confidence: "high"
        });

        GlobalContext.pushEvent(techEvent);
        appendOrganEvent(techEvent);
      } else {
        existing.detectedIn.add(relativePath);
      }
    }

    let modelId = selectModelForWorkUnit(WorkUnit.SCAN_FILE);
    modelId = await handoffIfNeeded(modelId, options);

    GlobalContext.setActiveWork({
      file: relativePath,
      directory: path.dirname(relativePath),
      model: modelId,
      step: WorkUnit.SCAN_FILE
    });

    const content = readFileForPrompt(filePath, options.maxFileBytes);
    const architectureDelta = analyzeFileForArchitecture(relativePath, content, architectureSnapshot);

    if (options.verbose && architectureDelta.newlyDetectedDatabaseTechnologies.length > 0) {
      console.log(`[db-tech] ${relativePath} -> ${architectureDelta.newlyDetectedDatabaseTechnologies.join(", ")}`);
    }

    const prompt = new FileScanPrompt({
      filePath: relativePath,
      fileContent: content,
      currentBrain: readBrainContext(repoRoot)
    }).build();

    const output = await runModel(modelId, prompt);
    const promptText = prompt.system + prompt.user;
    const inputTokens = estimateTokens(promptText);
    const outputTokens = estimateTokens(output);
    const updatedTokens = recordTokenUsage(modelId, promptText, output);

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

    const modelConfig = MODEL_REGISTRY[modelId];
    const tokenPct = Math.round((updatedTokens.totalTokens / modelConfig.maxTokens) * 100);

    if (!options.quiet && options.verbose) {
      console.log(
        `[scan] ${scannedFiles}/${files.length} (${pct}%) | ${relativePath} | model=${modelId} | +${inputTokens + outputTokens} tokens (in:${inputTokens}, out:${outputTokens}) | total=${updatedTokens.totalTokens}/${modelConfig.maxTokens} (${tokenPct}%)`
      );
    } else if (!options.quiet) {
      process.stdout.write(
        `\rLearning: ${scannedFiles}/${files.length} files | ${pct}% | model=${modelId} | tokens=${updatedTokens.totalTokens}/${modelConfig.maxTokens} (${tokenPct}%) | file=${relativePath.slice(0, 60)}   `
      );
    }
  }

  if (!options.quiet && !options.verbose) {
    console.log("");
  }

  const detectedTechnologies = Array.from(detectedTechMap.values())
    .map((technology) => ({
      id: technology.id,
      name: technology.name,
      docsUrl: technology.docsUrl,
      detectedIn: Array.from(technology.detectedIn).sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (detectedTechnologies.length > 0) {
    GlobalContext.updateLearned({ technologies: detectedTechnologies.map((technology) => technology.name) });

    const docContextMarkdown = detectedTechnologies
      .map((technology) => `- ${technology.name}: ${technology.docsUrl}`)
      .join("\n");

    appendBrainText("Technology Documentation Links", docContextMarkdown);

    const docContextEvent = createRepoEvent({
      type: RepoEventType.DOC_CONTEXT_ADDED,
      targetFile: RepoMemoryFile.BRAIN,
      title: "Technology documentation context updated",
      summary: "Documentation links were captured for detected technologies.",
      evidence: detectedTechnologies.map((technology) => `${technology.name}: ${technology.docsUrl}`),
      severity: "info",
      confidence: "high"
    });

    GlobalContext.pushEvent(docContextEvent);
    appendOrganEvent(docContextEvent);
  }

  const architectureMarkdown = buildArchitectureSnapshotMarkdown(architectureSnapshot);
  appendBrainText("Architecture & Data Layer Snapshot", architectureMarkdown);

  const architectureEvent = createRepoEvent({
    type: RepoEventType.ARCHITECTURE_INFERRED,
    targetFile: RepoMemoryFile.BRAIN,
    title: "Architecture and data-layer snapshot updated",
    summary:
      "High-level frontend/backend/data flow was inferred, including database posture, caching, and SignalR/realtime evidence.",
    evidence: architectureMarkdown.split("\n").filter(Boolean),
    severity: "info",
    confidence: "medium"
  });

  GlobalContext.pushEvent(architectureEvent);
  appendOrganEvent(architectureEvent);

  const durationMs = Date.now() - startedAt;
  const architecture = architectureSnapshotSummary(architectureSnapshot);

  const summary: LearnSummary = {
    repoRoot,
    totalFiles: files.length,
    scannedFiles,
    durationMs,
    detectedTechnologies,
    tokenUsageByModel: readTokenLedger(),
    architecture,
    distributionPlanPath: "docs/distribution-plan.md"
  };

  if (!options.quiet) {
    console.log("Cortex learn pass complete.");
    console.log("Updated: EYES.md, HANDS.md, BRAIN.md, .cortex/context.json, .cortex/token-usage.json");

    if (detectedTechnologies.length > 0) {
      console.log("Detected technologies with docs:");
      for (const technology of detectedTechnologies) {
        console.log(`- ${technology.name}: ${technology.docsUrl}`);
      }
    }

    console.log(`Architecture snapshot:`);
    console.log(`- Frontend files: ${architecture.frontendCodeCount}`);
    console.log(`- Frontend -> backend files: ${architecture.frontendToBackendCount}`);
    console.log(`- Backend files: ${architecture.backendCodeCount}`);
    console.log(`- Backend -> database files: ${architecture.backendToDatabaseCount}`);
    console.log(`- Caching evidence files: ${architecture.cachingCount}`);
    console.log(`- SignalR/realtime evidence files: ${architecture.signalRCount}`);
    console.log(
      `- Database technology: ${architecture.databaseAgnostic ? "Database-agnostic (not detected yet)" : architecture.databaseTechnologies.join(", ")}`
    );

    console.log(`Distribution plan: ${summary.distributionPlanPath}`);
  }

  return summary;
}
