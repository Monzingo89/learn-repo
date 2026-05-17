import fs from "fs";
import path from "path";
import chalk from "chalk";
import { GlobalContext } from "../observable/global-context.js";
import { WorkUnit } from "../enums/work-unit.enum.js";
import { ModelId } from "../enums/model.enum.js";
import { RepoTask } from "../enums/repo-task.enum.js";
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
import { appendOrganEvent, appendBrainText, ensureAnatomyFilesExist, writeAnatomyFile } from "../writers/organ-writer.js";
import { detectTechnologiesForPath } from "./technology-docs.js";
import {
  colorizeRepoAuthorshipModel,
  detectFileAuthorship,
  formatRepoAuthorshipModel,
  resolveRepoAuthorshipModels
} from "./model-authorship.js";
import {
  detectContainerPlatformsForFile,
  detectContainerPlatformsFromRoot
} from "./container-detection.js";
import {
  analyzeFileForArchitecture,
  architectureSnapshotSummary,
  buildArchitectureSnapshotMarkdown,
  createArchitectureSnapshot,
  type ArchitectureSnapshot
} from "./architecture-snapshot.js";
import { detectSubRepos } from "./sub-repo-detection.js";
import {
  analyzeFileForSymbolInventory,
  buildSymbolInventoryMarkdown,
  createSymbolInventory
} from "./symbol-inventory.js";
import {
  analyzeFileForDeadCode,
  createDeadCodeAccumulator,
  finalizeDeadCodeCandidates
} from "./dead-code-detection.js";
import {
  analyzeFileForDependencyUsage,
  buildDependencyAudit,
  buildSoulMarkdown,
  collectThirdPartyDocs,
  createDependencyUsageAccumulator
} from "./dependency-audit.js";
import {
  analyzeFileForArchitecturePatterns,
  buildArchitecturePatternsMarkdown,
  createArchitecturePatternAccumulator,
  finalizeArchitecturePatterns
} from "./architecture-patterns.js";
import { inferBackendProtocols } from "./heart-plan.js";
import { BackendProtocol } from "../enums/backend-protocol.enum.js";
import {
  analyzeFileForSecretHygiene,
  createSecretHygieneAccumulator,
  finalizeSecretHygiene
} from "./secret-hygiene.js";

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
  repoModels: string[];
  freshStart: boolean;
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
  containerPlatforms: string[];
  repoAuthoringModels: string[];
  fileAuthorshipCounts: Record<string, number>;
  architecture: ReturnType<typeof architectureSnapshotSummary>;
  distributionPlanPath: string;
  resumed: boolean;
  resumedAfter?: string;
  subRepoCount: number;
  deadCodeCandidateCount: number;
  dependencyHealthScore: number;
  unusedDependencyCount: number;
  identityProvider: string;
  dddDetected: boolean;
  multiTenantDetected: boolean;
  backendProtocols: string[];
};

const DEFAULT_LEARN_OPTIONS: LearnOptions = {
  maxFileBytes: 20000,
  includeExt: [],
  excludeDirs: [],
  repoModels: [],
  freshStart: false,
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
  const brainPath = path.join(repoRoot, RepoMemoryFile.BRAIN);
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
  const state = GlobalContext.get();
  const context = JSON.stringify({
    activeContext: state.activeContext,
    learned: state.learned,
    latestEyes: state.eyes.slice(-20),
    latestNose: state.nose.slice(-20),
    latestEars: state.ears.slice(-20),
    latestBrain: state.brain.slice(-20)
  }).slice(-20000);

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
  GlobalContext.setLastHandoff(modelId, nextModel);

  return nextModel;
}

export async function learn(repoRoot: string, inputOptions?: Partial<LearnOptions>): Promise<LearnSummary> {
  const options = resolveLearnOptions(inputOptions);

  if (options.freshStart) {
    fs.rmSync(path.join(repoRoot, ".cortex", "context.json"), { force: true });
    fs.rmSync(path.join(repoRoot, ".cortex", "token-usage.json"), { force: true });
    ensureAnatomyFilesExist({ reset: true });
  } else {
    ensureAnatomyFilesExist();
  }

  const includeExtensions = new Set(DEFAULT_CODE_EXTENSIONS);
  for (const extension of options.includeExt) includeExtensions.add(extension);

  const excludeDirs = new Set(DEFAULT_IGNORE_DIRS);
  for (const dir of options.excludeDirs) excludeDirs.add(dir);

  const previousState = GlobalContext.get();
  const previousLearnTask = previousState.activeContext.tasks[RepoTask.LEARN_REPO];
  const resumeFromFile =
    previousLearnTask.status === "in_progress" && previousState.activeContext.lastCompletedFile
      ? previousState.activeContext.lastCompletedFile
      : undefined;

  if (resumeFromFile && !options.quiet) {
    console.log(
      chalk.green(
        `Resuming LEARN_REPO at ${previousLearnTask.percentComplete}% — last completed file: ${resumeFromFile}`
      )
    );

    const resumeEvent = createRepoEvent({
      type: RepoEventType.RESUME_DETECTED,
      targetFile: RepoMemoryFile.BRAIN,
      title: "Resumed prior learn pass",
      summary: `Resumed LEARN_REPO after ${resumeFromFile} at ${previousLearnTask.percentComplete}%.`,
      evidence: [
        `Previous completed: ${previousLearnTask.completedItems}/${previousLearnTask.totalItems}`,
        `Last file: ${resumeFromFile}`
      ],
      severity: "info",
      confidence: "high"
    });

    GlobalContext.pushEvent(resumeEvent);
    appendOrganEvent(resumeEvent);
  }

  const resolvedAuthorship = resolveRepoAuthorshipModels(repoRoot, options.repoModels);
  GlobalContext.setRepoAuthoringModels(resolvedAuthorship.config.selectedModels);

  if (resolvedAuthorship.invalidInputs.length > 0 && !options.quiet) {
    console.log(
      chalk.yellow(
        `Ignored unknown --repo-models values: ${resolvedAuthorship.invalidInputs.join(", ")}`
      )
    );
  }

  if (resolvedAuthorship.source === "bootstrap" && !options.quiet) {
    console.log(
      chalk.cyan(
        "Authorship profile initialized at .cortex/repo-authorship.json. Use --repo-models to declare model authorship (Codex, Grok, ChatGPT, Claude Haiku/Sonnet/Opus, Gemini)."
      )
    );
  }

  const files = walk(repoRoot, includeExtensions, excludeDirs);
  const uniqueDirectories = new Set(files.map((filePath) => path.dirname(path.relative(repoRoot, filePath))));

  GlobalContext.updateProgress({
    totalFiles: files.length,
    scannedFiles: 0,
    totalDirectories: uniqueDirectories.size,
    scannedDirectories: 0
  });

  GlobalContext.setTaskProgress(RepoTask.LEARN_REPO, {
    status: "in_progress",
    totalItems: files.length,
    completedItems: 0,
    note: "Initial repository learning pass."
  });

  const rootContainerDetections = detectContainerPlatformsFromRoot(repoRoot);
  for (const detection of rootContainerDetections) {
    GlobalContext.recordContainerObservation(detection.platform, detection.evidencePath);

    const containerEvent = createRepoEvent({
      type: RepoEventType.CONTAINER_OBSERVED,
      targetFile: RepoMemoryFile.EYES,
      title: `Detected container platform: ${detection.platform}`,
      summary: detection.reason,
      sourcePath: detection.evidencePath,
      directory: path.dirname(detection.evidencePath),
      evidence: [detection.reason],
      severity: "info",
      confidence: "high"
    });

    GlobalContext.pushEvent(containerEvent);
    appendOrganEvent(containerEvent);
  }

  if (!options.quiet) {
    console.log("Starting Cortex learn pass.");
    console.log(`Files found: ${files.length}`);
  }

  const startedAt = Date.now();

  let scannedFiles = 0;
  const scannedDirectories = new Set<string>();
  const observedContainerPlatforms = new Set(rootContainerDetections.map((item) => item.platform));
  const detectedTechMap = new Map<string, { id: string; name: string; docsUrl: string; detectedIn: Set<string> }>();
  const architectureSnapshot: ArchitectureSnapshot = createArchitectureSnapshot();
  const symbolInventory = createSymbolInventory();
  const deadCodeAccumulator = createDeadCodeAccumulator();
  const dependencyUsage = createDependencyUsageAccumulator();
  const architecturePatterns = createArchitecturePatternAccumulator();
  const backendProtocolSet = new Set<BackendProtocol>();
  const secretHygiene = createSecretHygieneAccumulator();

  let skippingForResume = Boolean(resumeFromFile);

  for (const filePath of files) {
    const relativePath = path.relative(repoRoot, filePath);

    if (skippingForResume) {
      if (relativePath === resumeFromFile) {
        skippingForResume = false;
      }
      continue;
    }

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

    for (const detection of detectContainerPlatformsForFile(relativePath, content)) {
      GlobalContext.recordContainerObservation(detection.platform, detection.evidencePath);

      if (!observedContainerPlatforms.has(detection.platform)) {
        observedContainerPlatforms.add(detection.platform);

        const containerEvent = createRepoEvent({
          type: RepoEventType.CONTAINER_OBSERVED,
          targetFile: RepoMemoryFile.EYES,
          title: `Detected container platform: ${detection.platform}`,
          summary: detection.reason,
          sourcePath: detection.evidencePath,
          directory: path.dirname(detection.evidencePath),
          evidence: [detection.reason],
          severity: "info",
          confidence: "high"
        });

        GlobalContext.pushEvent(containerEvent);
        appendOrganEvent(containerEvent);
      }
    }

    const authorship = detectFileAuthorship(
      relativePath,
      content,
      resolvedAuthorship.config.selectedModels
    );
    GlobalContext.recordFileAuthorship(authorship.model);

    const authorshipLabel = formatRepoAuthorshipModel(authorship.model);
    const coloredPath = colorizeRepoAuthorshipModel(authorship.model, relativePath);
    const coloredAuthorship = colorizeRepoAuthorshipModel(authorship.model, authorshipLabel);

    const architectureDelta = analyzeFileForArchitecture(relativePath, content, architectureSnapshot);

    analyzeFileForSymbolInventory(relativePath, content, symbolInventory);
    analyzeFileForDeadCode(relativePath, content, deadCodeAccumulator);
    analyzeFileForDependencyUsage(relativePath, content, dependencyUsage);
    analyzeFileForArchitecturePatterns(relativePath, content, architecturePatterns);
    analyzeFileForSecretHygiene(relativePath, content, secretHygiene);
    for (const protocol of inferBackendProtocols(content)) backendProtocolSet.add(protocol);

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
      evidence: [
        `Model used: ${modelId}`,
        `Authorship: ${authorshipLabel}`,
        authorship.evidence
      ],
      severity: "info",
      confidence: "high"
    });

    GlobalContext.pushEvent(event);
    appendOrganEvent(event);

    const authorshipEvent = createRepoEvent({
      type: RepoEventType.FILE_AUTHORSHIP_OBSERVED,
      targetFile: RepoMemoryFile.EYES,
      title: `Authorship observed in ${relativePath}`,
      summary: `Detected authorship as ${authorshipLabel}.`,
      sourcePath: relativePath,
      directory: path.dirname(relativePath),
      evidence: [authorship.evidence],
      severity: "info",
      confidence: "medium"
    });

    GlobalContext.pushEvent(authorshipEvent);
    appendOrganEvent(authorshipEvent);

    scannedFiles += 1;
    scannedDirectories.add(path.dirname(relativePath));
    GlobalContext.setLastCompletedFile(relativePath);
    GlobalContext.updateProgress({
      scannedFiles,
      scannedDirectories: scannedDirectories.size
    });
    GlobalContext.setTaskProgress(RepoTask.LEARN_REPO, {
      status: scannedFiles >= files.length ? "completed" : "in_progress",
      totalItems: files.length,
      completedItems: scannedFiles
    });

    const state = GlobalContext.get();
    const pct = state.activeContext.progress.percentComplete;

    const modelConfig = MODEL_REGISTRY[modelId];
    const tokenPct = Math.round((updatedTokens.totalTokens / modelConfig.maxTokens) * 100);

    if (!options.quiet && options.verbose) {
      console.log(
        `[scan] ${scannedFiles}/${files.length} (${pct}%) | ${coloredPath} | model=${modelId} | author=${coloredAuthorship} | +${inputTokens + outputTokens} tokens (in:${inputTokens}, out:${outputTokens}) | total=${updatedTokens.totalTokens}/${modelConfig.maxTokens} (${tokenPct}%)`
      );
    } else if (!options.quiet) {
      process.stdout.write(
        `\rLearning: ${scannedFiles}/${files.length} files | ${pct}% | model=${modelId} | author=${coloredAuthorship} | tokens=${updatedTokens.totalTokens}/${modelConfig.maxTokens} (${tokenPct}%) | file=${coloredPath.slice(0, 60)}   `
      );
    }
  }

  if (!options.quiet && !options.verbose) {
    console.log("");
  }

  GlobalContext.setTaskProgress(RepoTask.LEARN_REPO, {
    status: "completed",
    totalItems: files.length,
    completedItems: scannedFiles,
    note: "Initial repository learning pass completed."
  });

  const taskEvent = createRepoEvent({
    type: RepoEventType.TASK_PROGRESS_UPDATED,
    targetFile: RepoMemoryFile.HANDS,
    title: "Task completed: LEARN_REPO",
    summary: "Learn repo task reached 100% and is ready for CLEAN_REPO and SIMPLIFY_REPO phases.",
    evidence: [`Completed ${scannedFiles}/${files.length} files.`],
    severity: "info",
    confidence: "high"
  });

  GlobalContext.pushEvent(taskEvent);
  appendOrganEvent(taskEvent);

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

  // === Anatomy build-out: sub-repos, symbols, dead code, dependency audit, architecture patterns, HEART ===
  const subRepos = detectSubRepos(repoRoot);
  GlobalContext.setSubRepos(subRepos);

  if (subRepos.length > 0) {
    const subRepoEvent = createRepoEvent({
      type: RepoEventType.SUB_REPO_DETECTED,
      targetFile: RepoMemoryFile.EYES,
      title: `Detected ${subRepos.length} sub-repo(s) or workspace package(s)`,
      summary: "Nested repositories, git submodules, or monorepo workspace packages were detected.",
      evidence: subRepos.map((finding) => `${finding.kind}: ${finding.relativePath}`),
      severity: "info",
      confidence: "high"
    });

    GlobalContext.pushEvent(subRepoEvent);
    appendOrganEvent(subRepoEvent);
  }

  const deadCodeCandidates = finalizeDeadCodeCandidates(deadCodeAccumulator);
  GlobalContext.setDeadCodeCandidates(deadCodeCandidates);

  if (deadCodeCandidates.length > 0) {
    const deadCodeEvent = createRepoEvent({
      type: RepoEventType.DEAD_CODE_CANDIDATE,
      targetFile: RepoMemoryFile.NOSE,
      title: `${deadCodeCandidates.length} possible dead-code file(s)`,
      summary:
        "Files have no inbound local imports and are not standard entrypoints (cli/, bin/, index, main, server, .test, .spec, .config).",
      evidence: deadCodeCandidates.slice(0, 25),
      severity: "medium",
      confidence: "medium"
    });

    GlobalContext.pushEvent(deadCodeEvent);
    appendOrganEvent(deadCodeEvent);
  }

  GlobalContext.setSymbolInventory(symbolInventory);
  const symbolMarkdown = buildSymbolInventoryMarkdown(symbolInventory);
  appendBrainText("Symbol Inventory", symbolMarkdown);

  const symbolEvent = createRepoEvent({
    type: RepoEventType.SYMBOL_INVENTORY_UPDATED,
    targetFile: RepoMemoryFile.BRAIN,
    title: "Symbol inventory updated",
    summary: "Counts and sample paths for interfaces, classes, enums, type aliases, and model-like files.",
    evidence: symbolMarkdown.split("\n").filter(Boolean),
    severity: "info",
    confidence: "medium"
  });

  GlobalContext.pushEvent(symbolEvent);
  appendOrganEvent(symbolEvent);

  const dependencyAudit = buildDependencyAudit(repoRoot, dependencyUsage);
  const secretFindings = finalizeSecretHygiene(secretHygiene);

  if (secretFindings.length > 0) {
    const secretEvent = createRepoEvent({
      type: RepoEventType.SECRET_EXPOSURE_DETECTED,
      targetFile: RepoMemoryFile.NOSE,
      title: `${secretFindings.length} possible secret exposure signal(s)`,
      summary: "Potential committed secrets were detected. Review immediately and rotate exposed credentials.",
      evidence: secretFindings.slice(0, 30).map((item) => `${item.filePath}: ${item.kind}`),
      severity: "high",
      confidence: "medium"
    });

    GlobalContext.pushEvent(secretEvent);
    appendOrganEvent(secretEvent);
  }

  if (dependencyAudit) {
    GlobalContext.setDependencyAudit(dependencyAudit);

    const technologyDocs = Array.from(detectedTechMap.values()).map((tech) => ({
      name: tech.name,
      docsUrl: tech.docsUrl
    }));

    const thirdPartyDocs = collectThirdPartyDocs(dependencyAudit);

    const soulMarkdown = buildSoulMarkdown(
      dependencyAudit,
      technologyDocs,
      thirdPartyDocs,
      {
        findings: secretFindings.map((item) => ({
          filePath: item.filePath,
          kind: item.kind
        }))
      }
    );
    writeAnatomyFile(RepoMemoryFile.SOUL, soulMarkdown);

    const dependencyEvent = createRepoEvent({
      type: RepoEventType.DEPENDENCY_AUDIT_COMPLETED,
      targetFile: RepoMemoryFile.BRAIN,
      title: `Dependency audit complete — score ${dependencyAudit.healthScore}/100`,
      summary: `${dependencyAudit.usedDependencies}/${dependencyAudit.totalDependencies} dependencies used; ${dependencyAudit.unusedDependencies.length} unused runtime; ${dependencyAudit.heavyDependencies.length} heavy.`,
      evidence: [
        `manifest: ${dependencyAudit.manifestPath}`,
        `unused: ${dependencyAudit.unusedDependencies.slice(0, 10).join(", ") || "none"}`,
        `heavy: ${dependencyAudit.heavyDependencies.join(", ") || "none"}`
      ],
      severity: dependencyAudit.healthScore < 70 ? "medium" : "info",
      confidence: "medium"
    });

    GlobalContext.pushEvent(dependencyEvent);
    appendOrganEvent(dependencyEvent);
  }

  const architectureFindings = finalizeArchitecturePatterns(architecturePatterns);
  GlobalContext.setArchitecturePatterns(architectureFindings);

  const patternsMarkdown = buildArchitecturePatternsMarkdown(architectureFindings);
  appendBrainText("Architecture Patterns (DDD, multi-tenancy, identity, database)", patternsMarkdown);

  const patternsEvent = createRepoEvent({
    type: RepoEventType.ARCHITECTURE_PATTERN_DETECTED,
    targetFile: RepoMemoryFile.BRAIN,
    title: "Architecture patterns detected",
    summary: `DDD=${architectureFindings.domainDrivenDesign.detected}; multi-tenant=${architectureFindings.multiTenant.detected}; identity=${architectureFindings.identity.provider}; db=${architectureFindings.database.paradigm}.`,
    evidence: patternsMarkdown.split("\n").filter(Boolean),
    severity: "info",
    confidence: "medium"
  });

  GlobalContext.pushEvent(patternsEvent);
  appendOrganEvent(patternsEvent);

  const backendProtocols = Array.from(backendProtocolSet);
  // HEART.md is intentionally not generated during the initial scan.
  // It is reserved for feature-work planning sessions (visual/frontend/backend/infra changes).

  GlobalContext.markSaved();
  // === End anatomy build-out ===

  const durationMs = Date.now() - startedAt;
  const architecture = architectureSnapshotSummary(architectureSnapshot);
  const state = GlobalContext.get();

  const summary: LearnSummary = {
    repoRoot,
    totalFiles: files.length,
    scannedFiles,
    durationMs,
    detectedTechnologies,
    tokenUsageByModel: readTokenLedger(),
    containerPlatforms: Object.keys(state.activeContext.containers).sort((a, b) => a.localeCompare(b)),
    repoAuthoringModels: state.activeContext.repoAuthoringModels,
    fileAuthorshipCounts: {
      ...state.activeContext.fileAuthorshipCounts
    },
    architecture,
    distributionPlanPath: "docs/distribution-plan.md",
    resumed: Boolean(resumeFromFile),
    resumedAfter: resumeFromFile,
    subRepoCount: subRepos.length,
    deadCodeCandidateCount: deadCodeCandidates.length,
    dependencyHealthScore: dependencyAudit?.healthScore ?? 100,
    unusedDependencyCount: dependencyAudit?.unusedDependencies.length ?? 0,
    identityProvider: architectureFindings.identity.provider,
    dddDetected: architectureFindings.domainDrivenDesign.detected,
    multiTenantDetected: architectureFindings.multiTenant.detected,
    backendProtocols
  };

  if (!options.quiet) {
    console.log("Cortex learn pass complete.");
    console.log(
      "Updated: anatomy/EYES.md, anatomy/HANDS.md, anatomy/BRAIN.md, anatomy/NOSE.md, anatomy/SOUL.md, .cortex/context.json, .cortex/token-usage.json"
    );

    if (summary.resumed) {
      console.log(chalk.green(`Resumed from previous run after ${summary.resumedAfter}.`));
    }

    if (detectedTechnologies.length > 0) {
      console.log("Detected technologies with docs:");
      for (const technology of detectedTechnologies) {
        console.log(`- ${technology.name}: ${technology.docsUrl}`);
      }
    }

    if (summary.containerPlatforms.length > 0) {
      console.log(`Detected container platforms: ${summary.containerPlatforms.join(", ")}`);
    }

    if (subRepos.length > 0) {
      console.log(`Sub-repos / workspace packages detected: ${subRepos.length}`);
      for (const finding of subRepos.slice(0, 10)) {
        console.log(`- [${finding.kind}] ${finding.relativePath}`);
      }
    }

    if (Object.keys(summary.fileAuthorshipCounts).length > 0) {
      console.log("Authorship distribution:");
      for (const [model, count] of Object.entries(summary.fileAuthorshipCounts)) {
        const readableModel = formatRepoAuthorshipModel(model as never);
        console.log(`- ${readableModel}: ${count}`);
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

    console.log("Architecture patterns:");
    console.log(`- DDD: ${architectureFindings.domainDrivenDesign.detected} (${architectureFindings.domainDrivenDesign.confidence})`);
    console.log(`- Multi-tenant: ${architectureFindings.multiTenant.detected} (${architectureFindings.multiTenant.confidence})`);
    console.log(`- Identity provider: ${architectureFindings.identity.provider}; roles=${architectureFindings.identity.rolesUsed}; claims=${architectureFindings.identity.claimsUsed}`);
    console.log(`- Database paradigm: ${architectureFindings.database.paradigm}`);

    if (dependencyAudit) {
      console.log(
        `SOUL — dependency health: ${dependencyAudit.healthScore}/100 (${dependencyAudit.usedDependencies}/${dependencyAudit.totalDependencies} used, ${dependencyAudit.unusedDependencies.length} unused runtime)`
      );
    }

    console.log(`Dead-code candidates: ${deadCodeCandidates.length}`);
    console.log(`Backend protocols detected: ${backendProtocols.join(", ") || "none"}`);
    console.log(`Distribution plan: ${summary.distributionPlanPath}`);
  }

  return summary;
}
