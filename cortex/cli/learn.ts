#!/usr/bin/env node

import path from "path";
import { Command } from "commander";
import { learn } from "../workflows/learn.workflow.js";
import { cleanRepo } from "../workflows/clean.workflow.js";
import { executeRepo } from "../workflows/execute.workflow.js";
import { reorganizeRepo } from "../workflows/reorganize.workflow.js";
import { setupRepo } from "../workflows/setup.workflow.js";

type CliOptions = {
  path?: string;
  maxFileBytes: string;
  includeExt?: string;
  excludeDir?: string;
  repoModels?: string;
  fresh?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  jsonSummary?: boolean;
};

type CleanCliOptions = {
  path?: string;
  quiet?: boolean;
  jsonSummary?: boolean;
};

type ReorganizeCliOptions = {
  path?: string;
  quiet?: boolean;
  jsonSummary?: boolean;
};

type SetupCliOptions = {
  path?: string;
  maxFileBytes: string;
  includeExt?: string;
  excludeDir?: string;
  repoModels?: string;
  fresh?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  execute?: boolean;
  dryRun?: boolean;
  executeDeadCode?: boolean;
  jsonSummary?: boolean;
};

type ExecuteCliOptions = {
  path?: string;
  quiet?: boolean;
  dryRun?: boolean;
  deadCode?: boolean;
  maxOperations?: string;
  jsonSummary?: boolean;
};

function parseCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function runInRepoRoot<T>(repoRoot: string, action: () => Promise<T>): Promise<T> {
  const previousCwd = process.cwd();
  process.chdir(repoRoot);

  try {
    return await action();
  } finally {
    process.chdir(previousCwd);
  }
}

const program = new Command();

program
  .name("engineer-maxxing")
  .description("Scan a repository and update Cortex memory files with realtime token usage and technology docs context.")
  .argument("[repoPath]", "Path to the repository root (default: current working directory)")
  .option("--path <repoPath>", "Explicit repository path (overrides positional repoPath)")
  .option("--max-file-bytes <bytes>", "Maximum bytes from each file sent to prompts", "20000")
  .option("--include-ext <extensions>", "Additional file extensions to include, comma-separated (example: .toml,.env)")
  .option("--exclude-dir <directories>", "Additional directory names to exclude, comma-separated")
  .option("--repo-models <models>", "Comma-separated repo authoring models (Codex,Grok,ChatGPT,Claude Haiku,Claude Sonnet,Claude Opus,Gemini,Manual)")
  .option("--fresh", "Reset anatomy and local cortex state before scanning")
  .option("--quiet", "Suppress per-file progress output")
  .option("--verbose", "Print verbose per-file token usage output")
  .option("--json-summary", "Print final run summary as JSON")
  .action(async (repoPath: string | undefined, options: CliOptions) => {
    const cwd = process.cwd();
    const repoRootInput = options.path || repoPath || cwd;
    const repoRoot = path.resolve(cwd, repoRootInput);

    const maxFileBytes = Number.parseInt(options.maxFileBytes, 10);

    if (!Number.isFinite(maxFileBytes) || maxFileBytes <= 0) {
      throw new Error(`Invalid --max-file-bytes value: ${options.maxFileBytes}`);
    }

    const quiet = Boolean((options.quiet && !options.verbose) || (options.jsonSummary && !options.verbose));

    const summary = await runInRepoRoot(repoRoot, async () =>
      learn(process.cwd(), {
        maxFileBytes,
        includeExt: parseCsv(options.includeExt),
        excludeDirs: parseCsv(options.excludeDir),
        repoModels: parseCsv(options.repoModels),
        freshStart: Boolean(options.fresh),
        quiet,
        verbose: Boolean(options.verbose)
      })
    );

    if (options.jsonSummary) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }
  });

program
  .command("clean-repo [repoPath]")
  .description("Generate an actionable CLEAN_REPO plan from anatomy and .cortex context")
  .option("--path <repoPath>", "Explicit repository path (overrides positional repoPath)")
  .option("--quiet", "Suppress command output")
  .option("--json-summary", "Print final run summary as JSON")
  .action(async (repoPath: string | undefined, options: CleanCliOptions) => {
    const cwd = process.cwd();
    const repoRootInput = options.path || repoPath || cwd;
    const repoRoot = path.resolve(cwd, repoRootInput);
    const quiet = Boolean(options.quiet || options.jsonSummary);

    const summary = await runInRepoRoot(repoRoot, async () =>
      cleanRepo(process.cwd(), {
        quiet
      })
    );

    if (options.jsonSummary) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }
  });

program
  .command("reorganize-repo [repoPath]")
  .description("Generate a SIMPLIFY_REPO reorganization plan from anatomy and SOUL technology docs")
  .option("--path <repoPath>", "Explicit repository path (overrides positional repoPath)")
  .option("--quiet", "Suppress command output")
  .option("--json-summary", "Print final run summary as JSON")
  .action(async (repoPath: string | undefined, options: ReorganizeCliOptions) => {
    const cwd = process.cwd();
    const repoRootInput = options.path || repoPath || cwd;
    const repoRoot = path.resolve(cwd, repoRootInput);
    const quiet = Boolean(options.quiet || options.jsonSummary);

    const summary = await runInRepoRoot(repoRoot, async () =>
      reorganizeRepo(process.cwd(), {
        quiet
      })
    );

    if (options.jsonSummary) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }
  });

program
  .command("setup-repo [repoPath]")
  .description("Run LEARN_REPO + CLEAN_REPO + REORGANIZE_REPO in one command")
  .option("--path <repoPath>", "Explicit repository path (overrides positional repoPath)")
  .option("--max-file-bytes <bytes>", "Maximum bytes from each file sent to prompts", "20000")
  .option("--include-ext <extensions>", "Additional file extensions to include, comma-separated (example: .toml,.env)")
  .option("--exclude-dir <directories>", "Additional directory names to exclude, comma-separated")
  .option("--repo-models <models>", "Comma-separated repo authoring models (Codex,Grok,ChatGPT,Claude Haiku,Claude Sonnet,Claude Opus,Gemini,Manual)")
  .option("--fresh", "Reset anatomy and local cortex state before running the full pipeline")
  .option("--quiet", "Suppress command output")
  .option("--verbose", "Print verbose learn pass output")
  .option("--execute", "Execute generated plans after learn/clean/reorganize")
  .option("--dry-run", "When combined with --execute, simulate execution without applying file changes")
  .option("--execute-dead-code", "When combined with --execute, move dead-code queue entries into quarantine")
  .option("--json-summary", "Print final run summary as JSON")
  .action(async (repoPath: string | undefined, options: SetupCliOptions) => {
    const cwd = process.cwd();
    const repoRootInput = options.path || repoPath || cwd;
    const repoRoot = path.resolve(cwd, repoRootInput);

    const maxFileBytes = Number.parseInt(options.maxFileBytes, 10);

    if (!Number.isFinite(maxFileBytes) || maxFileBytes <= 0) {
      throw new Error(`Invalid --max-file-bytes value: ${options.maxFileBytes}`);
    }

    const quiet = Boolean((options.quiet && !options.verbose) || (options.jsonSummary && !options.verbose));

    const summary = await runInRepoRoot(repoRoot, async () =>
      setupRepo(process.cwd(), {
        maxFileBytes,
        includeExt: parseCsv(options.includeExt),
        excludeDirs: parseCsv(options.excludeDir),
        repoModels: parseCsv(options.repoModels),
        freshStart: Boolean(options.fresh),
        quiet,
        verbose: Boolean(options.verbose),
        executeAfterPlan: Boolean(options.execute),
        executeDryRun: Boolean(options.dryRun),
        executeDeadCode: Boolean(options.executeDeadCode)
      })
    );

    if (options.jsonSummary) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }
  });

program
  .command("execute-repo [repoPath]")
  .description("Apply generated clean/reorganize plan artifacts (moves + optional dead-code quarantine)")
  .option("--path <repoPath>", "Explicit repository path (overrides positional repoPath)")
  .option("--quiet", "Suppress command output")
  .option("--dry-run", "Simulate execution without applying file changes")
  .option("--dead-code", "Also quarantine dead-code queue entries into .cortex/trash/dead-code")
  .option("--max-operations <count>", "Maximum operations to apply during this pass", "300")
  .option("--json-summary", "Print final run summary as JSON")
  .action(async (repoPath: string | undefined, options: ExecuteCliOptions) => {
    const cwd = process.cwd();
    const repoRootInput = options.path || repoPath || cwd;
    const repoRoot = path.resolve(cwd, repoRootInput);
    const quiet = Boolean(options.quiet || options.jsonSummary);
    const maxOperations = Number.parseInt(options.maxOperations || "300", 10);

    if (!Number.isFinite(maxOperations) || maxOperations <= 0) {
      throw new Error(`Invalid --max-operations value: ${options.maxOperations}`);
    }

    const summary = await runInRepoRoot(repoRoot, async () =>
      executeRepo(process.cwd(), {
        quiet,
        dryRun: Boolean(options.dryRun),
        applyMoves: true,
        applyDeadCode: Boolean(options.deadCode),
        maxOperations
      })
    );

    if (options.jsonSummary) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
