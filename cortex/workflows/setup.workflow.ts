import chalk from "chalk";
import { cleanRepo, CleanRepoSummary } from "./clean.workflow.js";
import { executeRepo, ExecuteRepoSummary } from "./execute.workflow.js";
import { learn, LearnSummary } from "./learn.workflow.js";
import { reorganizeRepo, ReorganizeRepoSummary } from "./reorganize.workflow.js";

export type SetupRepoOptions = {
  maxFileBytes: number;
  includeExt: string[];
  excludeDirs: string[];
  repoModels: string[];
  freshStart: boolean;
  quiet: boolean;
  verbose: boolean;
  executeAfterPlan: boolean;
  executeDryRun: boolean;
  executeDeadCodeAction: "none" | "quarantine" | "delete";
  executeSplitGodFiles: boolean;
  executeCleanupDependencies: boolean;
  executeMaxFileLines: number;
  executeMaxOperations: number;
};

export type SetupRepoSummary = {
  repoRoot: string;
  durationMs: number;
  learn: LearnSummary;
  clean: CleanRepoSummary;
  reorganize: ReorganizeRepoSummary;
  execute?: ExecuteRepoSummary;
};

const DEFAULT_SETUP_OPTIONS: SetupRepoOptions = {
  maxFileBytes: 20000,
  includeExt: [],
  excludeDirs: [],
  repoModels: [],
  freshStart: true,
  quiet: false,
  verbose: false,
  executeAfterPlan: false,
  executeDryRun: false,
  executeDeadCodeAction: "quarantine",
  executeSplitGodFiles: true,
  executeCleanupDependencies: true,
  executeMaxFileLines: 500,
  executeMaxOperations: 300
};

export function resolveSetupOptions(input?: Partial<SetupRepoOptions>): SetupRepoOptions {
  const merged = {
    ...DEFAULT_SETUP_OPTIONS,
    ...(input || {})
  };

  return {
    ...merged,
    maxFileBytes:
      Number.isFinite(merged.maxFileBytes) && merged.maxFileBytes > 0
        ? Math.floor(merged.maxFileBytes)
        : DEFAULT_SETUP_OPTIONS.maxFileBytes,
    includeExt: Array.from(new Set((merged.includeExt || []).map((item) => item.trim()).filter(Boolean))),
    excludeDirs: Array.from(new Set((merged.excludeDirs || []).map((item) => item.trim()).filter(Boolean))),
    repoModels: Array.from(new Set((merged.repoModels || []).map((item) => item.trim()).filter(Boolean))),
    executeMaxFileLines: Number.isFinite(merged.executeMaxFileLines)
      ? Math.max(50, Math.floor(merged.executeMaxFileLines))
      : DEFAULT_SETUP_OPTIONS.executeMaxFileLines,
    executeMaxOperations: Number.isFinite(merged.executeMaxOperations)
      ? Math.max(1, Math.floor(merged.executeMaxOperations))
      : DEFAULT_SETUP_OPTIONS.executeMaxOperations
  };
}

export async function setupRepo(repoRoot: string, inputOptions?: Partial<SetupRepoOptions>): Promise<SetupRepoSummary> {
  const options = resolveSetupOptions(inputOptions);
  const startedAt = Date.now();

  if (!options.quiet) {
    console.log(chalk.cyan("Starting setup-repo pipeline: LEARN_REPO -> CLEAN_REPO -> SIMPLIFY_REPO"));
  }

  const learnSummary = await learn(repoRoot, {
    maxFileBytes: options.maxFileBytes,
    includeExt: options.includeExt,
    excludeDirs: options.excludeDirs,
    repoModels: options.repoModels,
    freshStart: options.freshStart,
    quiet: options.quiet,
    verbose: options.verbose
  });

  const cleanSummary = await cleanRepo(repoRoot, {
    quiet: options.quiet
  });

  const reorganizeSummary = await reorganizeRepo(repoRoot, {
    quiet: options.quiet
  });

  const summary: SetupRepoSummary = {
    repoRoot,
    durationMs: Date.now() - startedAt,
    learn: learnSummary,
    clean: cleanSummary,
    reorganize: reorganizeSummary
  };

  if (options.executeAfterPlan) {
    summary.execute = await executeRepo(repoRoot, {
      quiet: options.quiet,
      dryRun: options.executeDryRun,
      applyMoves: true,
      deadCodeAction: options.executeDeadCodeAction,
      splitGodFiles: options.executeSplitGodFiles,
      cleanupDependencies: options.executeCleanupDependencies,
      maxFileLines: options.executeMaxFileLines,
      maxOperations: options.executeMaxOperations
    });
  }

  if (!options.quiet) {
    console.log(chalk.green("setup-repo pipeline completed."));
    console.log(`- learn scanned: ${summary.learn.scannedFiles}/${summary.learn.totalFiles}`);
    console.log(`- clean plan: ${summary.clean.planPath}`);
    console.log(`- reorganize plan: ${summary.reorganize.planPath}`);
    if (summary.execute) {
      console.log(`- execution report: ${summary.execute.reportPath}`);
    }
  }

  return summary;
}
