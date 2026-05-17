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
