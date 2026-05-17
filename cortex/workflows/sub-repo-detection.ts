import fs from "fs";
import path from "path";
import { SubRepoFinding } from "../context/repo-brain.store.js";

const WORKSPACE_FILES = ["lerna.json", "turbo.json", "nx.json", "pnpm-workspace.yaml", "rush.json"];

function safeReadJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function dirExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

export function detectSubRepos(repoRoot: string): SubRepoFinding[] {
  const findings: SubRepoFinding[] = [];
  const rootPackageJsonPath = path.join(repoRoot, "package.json");

  if (fileExists(rootPackageJsonPath)) {
    const manifest = safeReadJson(rootPackageJsonPath) as { workspaces?: unknown; name?: string } | null;

    if (manifest && manifest.workspaces) {
      const evidence: string[] = ["package.json declares workspaces"];

      findings.push({
        name: manifest.name || path.basename(repoRoot),
        relativePath: ".",
        kind: "monorepo_root",
        evidence
      });
    }
  }

  for (const workspaceFile of WORKSPACE_FILES) {
    const candidate = path.join(repoRoot, workspaceFile);

    if (fileExists(candidate)) {
      findings.push({
        name: workspaceFile,
        relativePath: workspaceFile,
        kind: "monorepo_root",
        evidence: [`Monorepo orchestrator file present: ${workspaceFile}`]
      });
    }
  }

  const gitmodulesPath = path.join(repoRoot, ".gitmodules");
  if (fileExists(gitmodulesPath)) {
    const text = fs.readFileSync(gitmodulesPath, "utf8");
    const pathLines = text.split(/\r?\n/).filter((line) => line.trim().startsWith("path"));

    for (const line of pathLines) {
      const value = line.split("=")[1]?.trim();
      if (value) {
        findings.push({
          name: value,
          relativePath: value,
          kind: "git_submodule",
          evidence: [".gitmodules"]
        });
      }
    }
  }

  walkForNested(repoRoot, repoRoot, findings, 0);

  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.kind}::${finding.relativePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const NESTED_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".cortex",
  ".next",
  "coverage"
]);

function walkForNested(repoRoot: string, dir: string, findings: SubRepoFinding[], depth: number) {
  if (depth > 6) return;

  let items: string[];
  try {
    items = fs.readdirSync(dir);
  } catch {
    return;
  }

  for (const item of items) {
    if (NESTED_SKIP.has(item)) continue;

    const fullPath = path.join(dir, item);
    if (!dirExists(fullPath)) continue;

    const isRoot = fullPath === repoRoot;

    if (!isRoot) {
      const nestedGit = path.join(fullPath, ".git");
      if (dirExists(nestedGit) || fileExists(nestedGit)) {
        findings.push({
          name: path.basename(fullPath),
          relativePath: path.relative(repoRoot, fullPath),
          kind: "nested_git",
          evidence: ["Contains its own .git directory"]
        });
      }

      const nestedPkg = path.join(fullPath, "package.json");
      if (fileExists(nestedPkg)) {
        findings.push({
          name: path.basename(fullPath),
          relativePath: path.relative(repoRoot, fullPath),
          kind: "workspace_package",
          evidence: ["Has its own package.json"]
        });
      }
    }

    walkForNested(repoRoot, fullPath, findings, depth + 1);
  }
}
