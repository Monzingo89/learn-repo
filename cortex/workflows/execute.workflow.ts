import fs from "fs";
import path from "path";
import chalk from "chalk";
import { createRepoEvent } from "../events/event-factory.js";
import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { GlobalContext } from "../observable/global-context.js";
import { appendBrainText, appendOrganEvent, ensureAnatomyFilesExist } from "../writers/organ-writer.js";

export type MoveOperation = {
  source: string;
  target: string;
  reason: string;
};

export type ExecuteRepoOptions = {
  quiet: boolean;
  dryRun: boolean;
  applyMoves: boolean;
  applyDeadCode: boolean;
  maxOperations: number;
};

export type ExecuteRepoSummary = {
  repoRoot: string;
  dryRun: boolean;
  moveMapPath: string;
  cleanupQueuePath?: string;
  reportPath: string;
  parsedMoveCount: number;
  movedCount: number;
  quarantinedDeadCodeCount: number;
  skippedCount: number;
  generatedAt: string;
};

const DEFAULT_EXECUTE_OPTIONS: ExecuteRepoOptions = {
  quiet: false,
  dryRun: false,
  applyMoves: true,
  applyDeadCode: false,
  maxOperations: 300
};

function resolveExecuteOptions(input?: Partial<ExecuteRepoOptions>): ExecuteRepoOptions {
  const merged = {
    ...DEFAULT_EXECUTE_OPTIONS,
    ...(input || {})
  };

  return {
    ...merged,
    maxOperations: Number.isFinite(merged.maxOperations)
      ? Math.max(1, Math.floor(merged.maxOperations))
      : DEFAULT_EXECUTE_OPTIONS.maxOperations
  };
}

function normalizeCell(value: string): string {
  return value.replace(/^`+|`+$/g, "").trim();
}

export function parseMoveMapMarkdown(markdown: string): MoveOperation[] {
  const operations: MoveOperation[] = [];
  const lines = markdown.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line.startsWith("|")) continue;
    if (/^\|\s*(Source|---|_none_)/i.test(line)) continue;

    const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    const source = normalizeCell(parts[0]);
    const target = normalizeCell(parts[1]);
    const reason = normalizeCell(parts[2]);

    if (!source || !target || source === "_none_" || target === "_none_") continue;

    operations.push({ source, target, reason });
  }

  return operations;
}

function parseDeadCodeQueue(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith("#") && !line.startsWith("Total candidates:"));
}

function isPlaceholderPath(filePath: string): boolean {
  return /<[^>]+>/.test(filePath);
}

function toSafeAbsolute(repoRoot: string, relativePath: string): string {
  const absolute = path.resolve(repoRoot, relativePath);
  const normalizedRoot = path.resolve(repoRoot);

  if (!(absolute === normalizedRoot || absolute.startsWith(`${normalizedRoot}${path.sep}`))) {
    throw new Error(`Unsafe path outside repository root: ${relativePath}`);
  }

  return absolute;
}

function writeExecutionReport(input: {
  repoRoot: string;
  generatedAt: string;
  dryRun: boolean;
  moveMapPath: string;
  cleanupQueuePath?: string;
  moved: Array<{ source: string; target: string; mode: "dry-run" | "applied" }>;
  quarantined: Array<{ source: string; target: string; mode: "dry-run" | "applied" }>;
  skipped: Array<{ operation: string; reason: string }>;
}): string {
  const reportPath = "anatomy/EXECUTION_REPORT.md";
  const absolutePath = path.join(input.repoRoot, reportPath);

  const lines: string[] = [];
  lines.push("# EXECUTION_REPORT.md");
  lines.push("");
  lines.push(`- Generated at: ${input.generatedAt}`);
  lines.push(`- Mode: ${input.dryRun ? "dry-run" : "apply"}`);
  lines.push(`- Move map source: \`${input.moveMapPath}\``);
  lines.push(`- Dead-code queue source: \`${input.cleanupQueuePath || "none"}\``);
  lines.push("");

  lines.push("## Applied / planned file moves");
  lines.push("");
  if (input.moved.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("| Source | Target | Mode |");
    lines.push("|---|---|---|");
    for (const entry of input.moved) {
      lines.push(`| \`${entry.source}\` | \`${entry.target}\` | ${entry.mode} |`);
    }
  }

  lines.push("");
  lines.push("## Dead-code quarantine actions");
  lines.push("");
  if (input.quarantined.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("| Source | Quarantine target | Mode |");
    lines.push("|---|---|---|");
    for (const entry of input.quarantined) {
      lines.push(`| \`${entry.source}\` | \`${entry.target}\` | ${entry.mode} |`);
    }
  }

  lines.push("");
  lines.push("## Skipped operations");
  lines.push("");
  if (input.skipped.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("| Operation | Reason |");
    lines.push("|---|---|");
    for (const item of input.skipped) {
      lines.push(`| ${item.operation} | ${item.reason} |`);
    }
  }

  fs.writeFileSync(absolutePath, `${lines.join("\n")}\n`, "utf8");
  return reportPath;
}

export async function executeRepo(repoRoot: string, inputOptions?: Partial<ExecuteRepoOptions>): Promise<ExecuteRepoSummary> {
  const options = resolveExecuteOptions(inputOptions);
  ensureAnatomyFilesExist();

  const moveMapPath = "anatomy/REORGANIZE_MOVE_MAP.md";
  const moveMapAbsolute = path.join(repoRoot, moveMapPath);

  if (!fs.existsSync(moveMapAbsolute)) {
    throw new Error("Missing anatomy/REORGANIZE_MOVE_MAP.md. Run `reorganize-repo` first.");
  }

  const moveMapMarkdown = fs.readFileSync(moveMapAbsolute, "utf8");
  const moveOperations = parseMoveMapMarkdown(moveMapMarkdown);

  const cleanupQueuePath = "anatomy/CLEANUP_DEAD_CODE_QUEUE.txt";
  const cleanupQueueAbsolute = path.join(repoRoot, cleanupQueuePath);
  const deadCodeCandidates = fs.existsSync(cleanupQueueAbsolute)
    ? parseDeadCodeQueue(fs.readFileSync(cleanupQueueAbsolute, "utf8"))
    : [];

  const moved: Array<{ source: string; target: string; mode: "dry-run" | "applied" }> = [];
  const quarantined: Array<{ source: string; target: string; mode: "dry-run" | "applied" }> = [];
  const skipped: Array<{ operation: string; reason: string }> = [];

  let remainingOperations = options.maxOperations;

  if (options.applyMoves) {
    for (const operation of moveOperations) {
      if (remainingOperations <= 0) {
        skipped.push({ operation: `${operation.source} -> ${operation.target}`, reason: "maxOperations reached" });
        continue;
      }

      if (isPlaceholderPath(operation.target)) {
        skipped.push({ operation: `${operation.source} -> ${operation.target}`, reason: "target contains unresolved placeholder" });
        continue;
      }

      const sourceAbsolute = toSafeAbsolute(repoRoot, operation.source);
      const targetAbsolute = toSafeAbsolute(repoRoot, operation.target);

      if (!fs.existsSync(sourceAbsolute)) {
        skipped.push({ operation: `${operation.source} -> ${operation.target}`, reason: "source not found" });
        continue;
      }

      if (fs.existsSync(targetAbsolute)) {
        skipped.push({ operation: `${operation.source} -> ${operation.target}`, reason: "target already exists" });
        continue;
      }

      const mode = options.dryRun ? "dry-run" : "applied";
      moved.push({ source: operation.source, target: operation.target, mode });

      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(targetAbsolute), { recursive: true });
        fs.renameSync(sourceAbsolute, targetAbsolute);
      }

      remainingOperations -= 1;
    }
  }

  if (options.applyDeadCode && deadCodeCandidates.length > 0) {
    for (const candidate of deadCodeCandidates) {
      if (remainingOperations <= 0) {
        skipped.push({ operation: candidate, reason: "maxOperations reached" });
        continue;
      }

      const sourceAbsolute = toSafeAbsolute(repoRoot, candidate);

      if (!fs.existsSync(sourceAbsolute)) {
        skipped.push({ operation: candidate, reason: "dead-code candidate not found" });
        continue;
      }

      const quarantineRelative = path.join(".cortex", "trash", "dead-code", candidate);
      const quarantineAbsolute = toSafeAbsolute(repoRoot, quarantineRelative);

      if (fs.existsSync(quarantineAbsolute)) {
        skipped.push({ operation: candidate, reason: "quarantine target already exists" });
        continue;
      }

      const mode = options.dryRun ? "dry-run" : "applied";
      quarantined.push({ source: candidate, target: quarantineRelative, mode });

      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(quarantineAbsolute), { recursive: true });
        fs.renameSync(sourceAbsolute, quarantineAbsolute);
      }

      remainingOperations -= 1;
    }
  }

  const generatedAt = new Date().toISOString();

  const reportPath = writeExecutionReport({
    repoRoot,
    generatedAt,
    dryRun: options.dryRun,
    moveMapPath,
    cleanupQueuePath: fs.existsSync(cleanupQueueAbsolute) ? cleanupQueuePath : undefined,
    moved,
    quarantined,
    skipped
  });

  appendBrainText(
    "Execution Summary",
    [
      `- Executed plan actions (${options.dryRun ? "dry-run" : "apply"})`,
      `- Moves: ${moved.length}`,
      `- Dead-code quarantined: ${quarantined.length}`,
      `- Skipped: ${skipped.length}`,
      `- Report: \`${reportPath}\``
    ].join("\n")
  );

  const taskEvent = createRepoEvent({
    type: RepoEventType.TASK_PROGRESS_UPDATED,
    targetFile: RepoMemoryFile.HANDS,
    title: options.dryRun ? "Task updated: EXECUTE_REPO (dry-run)" : "Task updated: EXECUTE_REPO",
    summary: options.dryRun
      ? "Execution simulation completed. Review report and rerun without --dry-run to apply changes."
      : "Execution pass applied planned move/quarantine operations.",
    evidence: [
      `mode: ${options.dryRun ? "dry-run" : "apply"}`,
      `moves: ${moved.length}`,
      `dead-code quarantined: ${quarantined.length}`,
      `skipped: ${skipped.length}`,
      `report: ${reportPath}`
    ],
    severity: "info",
    confidence: "high"
  });

  GlobalContext.pushEvent(taskEvent);
  appendOrganEvent(taskEvent);

  const summary: ExecuteRepoSummary = {
    repoRoot,
    dryRun: options.dryRun,
    moveMapPath,
    cleanupQueuePath: fs.existsSync(cleanupQueueAbsolute) ? cleanupQueuePath : undefined,
    reportPath,
    parsedMoveCount: moveOperations.length,
    movedCount: moved.length,
    quarantinedDeadCodeCount: quarantined.length,
    skippedCount: skipped.length,
    generatedAt
  };

  if (!options.quiet) {
    console.log(chalk.cyan(`EXECUTE_REPO ${options.dryRun ? "dry-run" : "apply"} complete.`));
    console.log(`- Parsed moves: ${summary.parsedMoveCount}`);
    console.log(`- Executed moves: ${summary.movedCount}`);
    console.log(`- Dead-code quarantined: ${summary.quarantinedDeadCodeCount}`);
    console.log(`- Skipped: ${summary.skippedCount}`);
    console.log(`- Report: ${summary.reportPath}`);
  }

  return summary;
}
