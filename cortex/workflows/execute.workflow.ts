import fs from "fs";
import path from "path";
import chalk from "chalk";
import ts from "typescript";
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

type DependencyRemoval = {
  name: string;
  section: "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";
  mode: "dry-run" | "applied";
};

type SplitArtifact = {
  sourceFile: string;
  targetFile: string;
  exportName: string;
  mode: "dry-run" | "applied";
};

type DeadCodeAction = "none" | "quarantine" | "delete";

export type ExecuteRepoOptions = {
  quiet: boolean;
  dryRun: boolean;
  applyMoves: boolean;
  deadCodeAction: DeadCodeAction;
  splitGodFiles: boolean;
  maxFileLines: number;
  cleanupDependencies: boolean;
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
  deletedDeadCodeCount: number;
  dependencyRemovedCount: number;
  splitArtifactCount: number;
  splitFileCount: number;
  skippedCount: number;
  generatedAt: string;
};

const DEFAULT_EXECUTE_OPTIONS: ExecuteRepoOptions = {
  quiet: false,
  dryRun: false,
  applyMoves: true,
  deadCodeAction: "quarantine",
  splitGodFiles: true,
  maxFileLines: 500,
  cleanupDependencies: true,
  maxOperations: 300
};

function resolveExecuteOptions(input?: Partial<ExecuteRepoOptions>): ExecuteRepoOptions {
  const merged = {
    ...DEFAULT_EXECUTE_OPTIONS,
    ...(input || {})
  };

  return {
    ...merged,
    maxFileLines: Number.isFinite(merged.maxFileLines)
      ? Math.max(50, Math.floor(merged.maxFileLines))
      : DEFAULT_EXECUTE_OPTIONS.maxFileLines,
    maxOperations: Number.isFinite(merged.maxOperations)
      ? Math.max(1, Math.floor(merged.maxOperations))
      : DEFAULT_EXECUTE_OPTIONS.maxOperations
  };
}

function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b));
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

function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function sanitizeExportName(name: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "");
  return sanitized || "part";
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

function scriptKindFromPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function hasExportModifier(node: ts.HasModifiers): boolean {
  return Boolean((ts.getModifiers(node) || []).find((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function hasDefaultModifier(node: ts.HasModifiers): boolean {
  return Boolean((ts.getModifiers(node) || []).find((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
}

function collectImportedNames(statement: ts.ImportDeclaration): string[] {
  const names: string[] = [];
  const clause = statement.importClause;

  if (!clause) return names;
  if (clause.name) names.push(clause.name.getText());

  if (clause.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      names.push(clause.namedBindings.name.getText());
    }

    if (ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        names.push((element.propertyName || element.name).getText());
        names.push(element.name.getText());
      }
    }
  }

  return names;
}

function collectDeclaredNamesInStatement(statement: ts.Statement): string[] {
  const names: string[] = [];

  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) {
    if (statement.name) names.push(statement.name.getText());
  }

  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        names.push(declaration.name.getText());
      }
    }
  }

  return names;
}

function collectIdentifierNames(node: ts.Node): Set<string> {
  const names = new Set<string>();

  function visit(current: ts.Node) {
    if (ts.isIdentifier(current)) {
      names.add(current.text);
    }
    ts.forEachChild(current, visit);
  }

  visit(node);
  return names;
}

function reExportSpecifierForPath(targetPath: string): string {
  if (targetPath.endsWith(".ts") || targetPath.endsWith(".tsx")) {
    return targetPath.replace(/\.(ts|tsx)$/i, ".js");
  }

  if (targetPath.endsWith(".js") || targetPath.endsWith(".jsx")) {
    return targetPath.replace(/\.(js|jsx)$/i, "");
  }

  return targetPath;
}

const KNOWN_GLOBALS = new Set([
  "console",
  "process",
  "global",
  "globalThis",
  "Promise",
  "Array",
  "Object",
  "String",
  "Number",
  "Boolean",
  "Date",
  "Math",
  "JSON",
  "Set",
  "Map",
  "WeakMap",
  "WeakSet",
  "RegExp",
  "Error",
  "TypeError",
  "Symbol",
  "Buffer",
  "URL",
  "URLSearchParams",
  "fetch"
]);

type ExportCandidate = {
  name: string;
  start: number;
  end: number;
  text: string;
  ownNames: Set<string>;
  dependencies: Set<string>;
  lineCount: number;
};

function buildExportCandidates(sourceFile: ts.SourceFile, sourceText: string): {
  importBlocks: string[];
  importNames: Set<string>;
  allDeclaredNames: Set<string>;
  candidates: ExportCandidate[];
} {
  const importBlocks: string[] = [];
  const importNames = new Set<string>();
  const allDeclaredNames = new Set<string>();
  const candidates: ExportCandidate[] = [];

  for (const statement of sourceFile.statements) {
    for (const declaredName of collectDeclaredNamesInStatement(statement)) {
      allDeclaredNames.add(declaredName);
    }

    if (ts.isImportDeclaration(statement)) {
      importBlocks.push(sourceText.slice(statement.getStart(sourceFile), statement.getEnd()));
      for (const importedName of collectImportedNames(statement)) {
        importNames.add(importedName);
      }
      continue;
    }

    const start = statement.getFullStart();
    const end = statement.getEnd();
    const text = sourceText.slice(start, end).trim();

    if (!text) continue;

    if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement) && statement.name && !hasDefaultModifier(statement)) {
      const ownNames = new Set([statement.name.getText(sourceFile)]);
      const dependencies = collectIdentifierNames(statement);
      candidates.push({ name: statement.name.getText(sourceFile), start, end, text, ownNames, dependencies, lineCount: countLines(text) });
      continue;
    }

    if (ts.isClassDeclaration(statement) && hasExportModifier(statement) && statement.name && !hasDefaultModifier(statement)) {
      const ownNames = new Set([statement.name.getText(sourceFile)]);
      const dependencies = collectIdentifierNames(statement);
      candidates.push({ name: statement.name.getText(sourceFile), start, end, text, ownNames, dependencies, lineCount: countLines(text) });
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) && hasExportModifier(statement)) {
      const ownNames = new Set([statement.name.getText(sourceFile)]);
      const dependencies = collectIdentifierNames(statement);
      candidates.push({ name: statement.name.getText(sourceFile), start, end, text, ownNames, dependencies, lineCount: countLines(text) });
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement)) {
      const ownNames = new Set([statement.name.getText(sourceFile)]);
      const dependencies = collectIdentifierNames(statement);
      candidates.push({ name: statement.name.getText(sourceFile), start, end, text, ownNames, dependencies, lineCount: countLines(text) });
      continue;
    }

    if (ts.isEnumDeclaration(statement) && hasExportModifier(statement)) {
      const ownNames = new Set([statement.name.getText(sourceFile)]);
      const dependencies = collectIdentifierNames(statement);
      candidates.push({ name: statement.name.getText(sourceFile), start, end, text, ownNames, dependencies, lineCount: countLines(text) });
      continue;
    }

    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      const declarations = statement.declarationList.declarations;
      if (declarations.length !== 1) continue;
      const declaration = declarations[0];
      if (!ts.isIdentifier(declaration.name)) continue;

      const declarationName = declaration.name.getText(sourceFile);
      const ownNames = new Set([declarationName]);
      const dependencies = collectIdentifierNames(statement);
      candidates.push({ name: declarationName, start, end, text, ownNames, dependencies, lineCount: countLines(text) });
    }
  }

  return { importBlocks, importNames, allDeclaredNames, candidates };
}

function selectSplitCandidates(sourceText: string, sourceRelativePath: string, maxFileLines: number): ExportCandidate[] {
  if (countLines(sourceText) <= maxFileLines) return [];

  const sourceFile = ts.createSourceFile(
    sourceRelativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFromPath(sourceRelativePath)
  );

  const { importNames, allDeclaredNames, candidates } = buildExportCandidates(sourceFile, sourceText);

  if (candidates.length <= 1) return [];

  const safeCandidates: ExportCandidate[] = [];

  for (const candidate of candidates.slice(1)) {
    const unresolvedLocalDependencies = [...candidate.dependencies].filter((name) => {
      if (candidate.ownNames.has(name)) return false;
      if (importNames.has(name)) return false;
      if (KNOWN_GLOBALS.has(name)) return false;
      if (!allDeclaredNames.has(name)) return false;
      return true;
    });

    if (unresolvedLocalDependencies.length > 0) continue;
    safeCandidates.push(candidate);
  }

  if (safeCandidates.length === 0) return [];

  let remainingLines = countLines(sourceText);
  const selected: ExportCandidate[] = [];

  for (const candidate of [...safeCandidates].sort((a, b) => b.lineCount - a.lineCount)) {
    if (remainingLines <= maxFileLines && selected.length > 0) break;
    selected.push(candidate);
    remainingLines -= candidate.lineCount;
  }

  return selected;
}

function applySafeSplitForFile(input: {
  repoRoot: string;
  relativePath: string;
  dryRun: boolean;
  maxFileLines: number;
}): SplitArtifact[] {
  const absolutePath = toSafeAbsolute(input.repoRoot, input.relativePath);
  if (!fs.existsSync(absolutePath)) return [];

  const ext = path.extname(input.relativePath).toLowerCase();
  if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) return [];
  if (/\.d\.ts$/i.test(input.relativePath)) return [];

  const sourceText = fs.readFileSync(absolutePath, "utf8");
  const selected = selectSplitCandidates(sourceText, input.relativePath, input.maxFileLines);
  if (selected.length === 0) return [];

  const sourceFile = ts.createSourceFile(
    input.relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFromPath(input.relativePath)
  );

  const { importBlocks } = buildExportCandidates(sourceFile, sourceText);
  const importsBlock = importBlocks.join("\n").trim();

  let updated = sourceText;
  for (const item of [...selected].sort((a, b) => b.start - a.start)) {
    updated = `${updated.slice(0, item.start)}${updated.slice(item.end)}`;
  }

  const dir = path.dirname(input.relativePath);
  const baseName = path.basename(input.relativePath, ext);

  const reExports: string[] = [];
  const artifacts: SplitArtifact[] = [];

  for (const item of selected) {
    const splitBaseName = `${baseName}.${sanitizeExportName(item.name)}`;
    const splitRelativePath = path.join(dir, `${splitBaseName}${ext}`);
    const splitAbsolutePath = toSafeAbsolute(input.repoRoot, splitRelativePath);

    if (fs.existsSync(splitAbsolutePath)) {
      continue;
    }

    const splitBody = [importsBlock, importsBlock ? "" : "", item.text.trim(), ""].join("\n").trimStart();
    const moduleSpecifier = reExportSpecifierForPath(`./${splitBaseName}${ext}`);
    reExports.push(`export { ${item.name} } from "${moduleSpecifier}";`);

    artifacts.push({
      sourceFile: input.relativePath,
      targetFile: splitRelativePath,
      exportName: item.name,
      mode: input.dryRun ? "dry-run" : "applied"
    });

    if (!input.dryRun) {
      fs.mkdirSync(path.dirname(splitAbsolutePath), { recursive: true });
      fs.writeFileSync(splitAbsolutePath, `${splitBody}\n`, "utf8");
    }
  }

  if (reExports.length === 0) {
    return [];
  }

  const mergedContent = `${updated.trimEnd()}\n\n${reExports.join("\n")}\n`;

  if (!input.dryRun) {
    fs.writeFileSync(absolutePath, mergedContent, "utf8");
  }

  return artifacts;
}

function cleanupDependenciesFromContext(repoRoot: string, dryRun: boolean): DependencyRemoval[] {
  const state = GlobalContext.get();
  const audit = state.learned.dependencyAudit;
  if (!audit || !Array.isArray(audit.entries) || audit.entries.length === 0) return [];

  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) return [];

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;

  const removals: DependencyRemoval[] = [];

  for (const entry of audit.entries) {
    if (entry.used) continue;

    const section =
      entry.category === "runtime"
        ? "dependencies"
        : entry.category === "dev"
          ? "devDependencies"
          : entry.category === "peer"
            ? "peerDependencies"
            : "optionalDependencies";

    const sectionObject = packageJson[section] as Record<string, string> | undefined;
    if (!sectionObject || !sectionObject[entry.name]) continue;

    removals.push({
      name: entry.name,
      section,
      mode: dryRun ? "dry-run" : "applied"
    });

    if (!dryRun) {
      delete sectionObject[entry.name];
      if (Object.keys(sectionObject).length === 0) {
        delete packageJson[section];
      }
    }
  }

  if (!dryRun && removals.length > 0) {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  }

  return removals;
}

function writeExecutionReport(input: {
  repoRoot: string;
  generatedAt: string;
  dryRun: boolean;
  moveMapPath: string;
  cleanupQueuePath?: string;
  moved: Array<{ source: string; target: string; mode: "dry-run" | "applied" }>;
  quarantined: Array<{ source: string; target: string; mode: "dry-run" | "applied" }>;
  deleted: Array<{ source: string; mode: "dry-run" | "applied" }>;
  dependencyRemovals: DependencyRemoval[];
  splitArtifacts: SplitArtifact[];
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
  lines.push("## Dead-code delete actions");
  lines.push("");
  if (input.deleted.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("| Source | Mode |");
    lines.push("|---|---|");
    for (const entry of input.deleted) {
      lines.push(`| \`${entry.source}\` | ${entry.mode} |`);
    }
  }

  lines.push("");
  lines.push("## Dependency cleanup actions");
  lines.push("");
  if (input.dependencyRemovals.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("| Dependency | Section | Mode |");
    lines.push("|---|---|---|");
    for (const removal of input.dependencyRemovals) {
      lines.push(`| \`${removal.name}\` | \`${removal.section}\` | ${removal.mode} |`);
    }
  }

  lines.push("");
  lines.push("## God-file split actions");
  lines.push("");
  if (input.splitArtifacts.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("| Source file | New file | Export | Mode |");
    lines.push("|---|---|---|---|");
    for (const artifact of input.splitArtifacts) {
      lines.push(`| \`${artifact.sourceFile}\` | \`${artifact.targetFile}\` | \`${artifact.exportName}\` | ${artifact.mode} |`);
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
  const deleted: Array<{ source: string; mode: "dry-run" | "applied" }> = [];
  const splitArtifacts: SplitArtifact[] = [];
  const dependencyRemovals: DependencyRemoval[] = [];
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

  if (options.cleanupDependencies && remainingOperations > 0) {
    const removals = cleanupDependenciesFromContext(repoRoot, options.dryRun);
    for (const removal of removals) {
      if (remainingOperations <= 0) {
        skipped.push({ operation: `${removal.name} from ${removal.section}`, reason: "maxOperations reached" });
        continue;
      }

      dependencyRemovals.push(removal);
      remainingOperations -= 1;
    }
  }

  if (options.splitGodFiles && remainingOperations > 0) {
    const state = GlobalContext.get();
    const observedCodeFiles = uniqueSorted(
      state.eyes
        .filter((event) => event.type === RepoEventType.FILE_OBSERVED && Boolean(event.sourcePath))
        .map((event) => event.sourcePath as string)
        .filter((relativePath) => /\.(ts|tsx|js|jsx)$/i.test(relativePath) && !/\.d\.ts$/i.test(relativePath))
    );

    for (const relativePath of observedCodeFiles) {
      if (remainingOperations <= 0) {
        skipped.push({ operation: `${relativePath} split`, reason: "maxOperations reached" });
        continue;
      }

      const absolutePath = toSafeAbsolute(repoRoot, relativePath);
      if (!fs.existsSync(absolutePath)) continue;

      const lineCount = countLines(fs.readFileSync(absolutePath, "utf8"));
      if (lineCount <= options.maxFileLines) continue;

      const artifacts = applySafeSplitForFile({
        repoRoot,
        relativePath,
        dryRun: options.dryRun,
        maxFileLines: options.maxFileLines
      });

      if (artifacts.length === 0) {
        skipped.push({ operation: `${relativePath} split`, reason: "no safe split candidates" });
        continue;
      }

      for (const artifact of artifacts) {
        if (remainingOperations <= 0) {
          skipped.push({ operation: `${artifact.sourceFile} -> ${artifact.targetFile}`, reason: "maxOperations reached" });
          continue;
        }

        splitArtifacts.push(artifact);
        remainingOperations -= 1;
      }
    }
  }

  if (options.deadCodeAction !== "none" && deadCodeCandidates.length > 0) {
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

      const mode = options.dryRun ? "dry-run" : "applied";

      if (options.deadCodeAction === "delete") {
        deleted.push({ source: candidate, mode });
        if (!options.dryRun) {
          fs.rmSync(sourceAbsolute, { force: true });
        }
      } else {
        const quarantineRelative = path.join(".cortex", "trash", "dead-code", candidate);
        const quarantineAbsolute = toSafeAbsolute(repoRoot, quarantineRelative);

        if (fs.existsSync(quarantineAbsolute)) {
          skipped.push({ operation: candidate, reason: "quarantine target already exists" });
          continue;
        }

        quarantined.push({ source: candidate, target: quarantineRelative, mode });

        if (!options.dryRun) {
          fs.mkdirSync(path.dirname(quarantineAbsolute), { recursive: true });
          fs.renameSync(sourceAbsolute, quarantineAbsolute);
        }
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
    deleted,
    dependencyRemovals,
    splitArtifacts,
    skipped
  });

  appendBrainText(
    "Execution Summary",
    [
      `- Executed plan actions (${options.dryRun ? "dry-run" : "apply"})`,
      `- Moves: ${moved.length}`,
      `- Dead-code quarantined: ${quarantined.length}`,
      `- Dead-code deleted: ${deleted.length}`,
      `- Dependencies removed: ${dependencyRemovals.length}`,
      `- Split artifacts: ${splitArtifacts.length}`,
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
      `dead-code deleted: ${deleted.length}`,
      `dependencies removed: ${dependencyRemovals.length}`,
      `split artifacts: ${splitArtifacts.length}`,
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
    deletedDeadCodeCount: deleted.length,
    dependencyRemovedCount: dependencyRemovals.length,
    splitArtifactCount: splitArtifacts.length,
    splitFileCount: uniqueSorted(splitArtifacts.map((artifact) => artifact.sourceFile)).length,
    skippedCount: skipped.length,
    generatedAt
  };

  if (!options.quiet) {
    console.log(chalk.cyan(`EXECUTE_REPO ${options.dryRun ? "dry-run" : "apply"} complete.`));
    console.log(`- Parsed moves: ${summary.parsedMoveCount}`);
    console.log(`- Executed moves: ${summary.movedCount}`);
    console.log(`- Dead-code quarantined: ${summary.quarantinedDeadCodeCount}`);
    console.log(`- Dead-code deleted: ${summary.deletedDeadCodeCount}`);
    console.log(`- Dependencies removed: ${summary.dependencyRemovedCount}`);
    console.log(`- Split artifacts: ${summary.splitArtifactCount} across ${summary.splitFileCount} file(s)`);
    console.log(`- Skipped: ${summary.skippedCount}`);
    console.log(`- Report: ${summary.reportPath}`);
  }

  return summary;
}
