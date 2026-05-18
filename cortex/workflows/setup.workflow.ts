import chalk from "chalk";
import { cleanRepo, CleanRepoSummary } from "./clean.workflow.js";
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
};

export type SetupRepoSummary = {
  repoRoot: string;
  durationMs: number;
  learn: LearnSummary;
  clean: CleanRepoSummary;
  reorganize: ReorganizeRepoSummary;
};

const DEFAULT_SETUP_OPTIONS: SetupRepoOptions = {
  maxFileBytes: 20000,
  includeExt: [],
  excludeDirs: [],
  repoModels: [],
  freshStart: true,
  quiet: false,
  verbose: false
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
    repoModels: Array.from(new Set((merged.repoModels || []).map((item) => item.trim()).filter(Boolean)))
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

  if (!options.quiet) {
    console.log(chalk.green("setup-repo pipeline completed."));
    console.log(`- learn scanned: ${summary.learn.scannedFiles}/${summary.learn.totalFiles}`);
    console.log(`- clean plan: ${summary.clean.planPath}`);
    console.log(`- reorganize plan: ${summary.reorganize.planPath}`);
  }

  return summary;
}
