import fs from "fs";
import path from "path";
import { DependencyAuditFindings, DependencyHealthEntry } from "../context/repo-brain.store.js";

const HEAVY_DEPS = new Set([
  "moment",
  "lodash",
  "rxjs",
  "puppeteer",
  "playwright",
  "electron",
  "@tensorflow/tfjs",
  "aws-sdk",
  "firebase",
  "webpack",
  "babel-core",
  "@babel/core"
]);

function safeReadJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function categoryOf(
  name: string,
  manifest: Record<string, Record<string, string>>
): DependencyHealthEntry["category"] | null {
  if (manifest.dependencies?.[name]) return "runtime";
  if (manifest.devDependencies?.[name]) return "dev";
  if (manifest.peerDependencies?.[name]) return "peer";
  if (manifest.optionalDependencies?.[name]) return "optional";
  return null;
}

export type DependencyUsageAccumulator = {
  byPackage: Map<string, Set<string>>;
};

export type ThirdPartyDocLink = {
  packageName: string;
  docsUrl: string;
  category: DependencyHealthEntry["category"];
  used: boolean;
};

export type SecretHygieneSummary = {
  findings: Array<{ filePath: string; kind: string }>;
};

export function createDependencyUsageAccumulator(): DependencyUsageAccumulator {
  return { byPackage: new Map() };
}

const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^'"`]+\s+from\s+)?['"`]([^'"`]+)['"`]/g,
  /\brequire\(\s*['"`]([^'"`]+)['"`]\s*\)/g
];

function packageNameFromSpecifier(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    if (!name) return null;
    return `${scope}/${name}`;
  }
  return specifier.split("/")[0];
}

export function analyzeFileForDependencyUsage(
  relativePath: string,
  content: string,
  accumulator: DependencyUsageAccumulator
) {
  for (const regex of IMPORT_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const specifier = match[1];
      const packageName = packageNameFromSpecifier(specifier);
      if (!packageName) continue;

      const set = accumulator.byPackage.get(packageName) || new Set<string>();
      set.add(relativePath);
      accumulator.byPackage.set(packageName, set);
    }
  }
}

export function buildDependencyAudit(
  repoRoot: string,
  usage: DependencyUsageAccumulator
): DependencyAuditFindings | null {
  const manifestPath = path.join(repoRoot, "package.json");
  const manifest = safeReadJson(manifestPath) as Record<string, Record<string, string>> | null;
  if (!manifest) return null;

  const buckets: Array<DependencyHealthEntry["category"]> = ["runtime", "dev", "peer", "optional"];
  const bucketKeys: Record<DependencyHealthEntry["category"], string> = {
    runtime: "dependencies",
    dev: "devDependencies",
    peer: "peerDependencies",
    optional: "optionalDependencies"
  };

  const entries: DependencyHealthEntry[] = [];

  for (const category of buckets) {
    const section = manifest[bucketKeys[category]] || {};

    for (const [name, versionRange] of Object.entries(section)) {
      const importers = Array.from(usage.byPackage.get(name) || []).sort();
      entries.push({
        name,
        versionRange: String(versionRange),
        used: importers.length > 0 || categoryOf(name, manifest) === "peer",
        importedFrom: importers.slice(0, 5),
        category
      });
    }
  }

  const usedCount = entries.filter((entry) => entry.used).length;
  const unused = entries
    .filter((entry) => !entry.used && entry.category === "runtime")
    .map((entry) => entry.name)
    .sort();
  const heavy = entries
    .filter((entry) => HEAVY_DEPS.has(entry.name))
    .map((entry) => entry.name)
    .sort();

  const healthScore = entries.length === 0 ? 100 : Math.round((usedCount / entries.length) * 100);

  return {
    manifestPath: path.relative(repoRoot, manifestPath) || "package.json",
    totalDependencies: entries.length,
    usedDependencies: usedCount,
    unusedDependencies: unused,
    heavyDependencies: heavy,
    healthScore,
    entries: entries.sort((a, b) => a.name.localeCompare(b.name))
  };
}

export function buildSoulMarkdown(
  audit: DependencyAuditFindings,
  technologyDocs: Array<{ name: string; docsUrl: string }>,
  thirdPartyDocs: ThirdPartyDocLink[],
  secretHygiene: SecretHygieneSummary
): string {
  const lines: string[] = [];

  lines.push("# SOUL — Dependency Manifest & Audit");
  lines.push("");
  lines.push(`- Manifest: \`${audit.manifestPath}\``);
  lines.push(`- Total dependencies: **${audit.totalDependencies}**`);
  lines.push(`- Used dependencies: **${audit.usedDependencies}**`);
  lines.push(`- Unused runtime dependencies: **${audit.unusedDependencies.length}**`);
  lines.push(`- Heavy/expensive dependencies flagged: **${audit.heavyDependencies.length}**`);
  lines.push(`- Health score: **${audit.healthScore} / 100**`);
  lines.push("");

  if (audit.unusedDependencies.length > 0) {
    lines.push("## Unused runtime dependencies");
    for (const name of audit.unusedDependencies) lines.push(`- \`${name}\``);
    lines.push("");
  }

  if (audit.heavyDependencies.length > 0) {
    lines.push("## Heavy dependencies (review for slimming)");
    for (const name of audit.heavyDependencies) lines.push(`- \`${name}\``);
    lines.push("");
  }

  lines.push("## Dependency table");
  lines.push("| Package | Range | Category | Used? | Imported from (sample) |");
  lines.push("|---|---|---|---|---|");
  for (const entry of audit.entries) {
    const sample = entry.importedFrom.slice(0, 3).join(", ") || "—";
    lines.push(
      `| \`${entry.name}\` | \`${entry.versionRange}\` | ${entry.category} | ${entry.used ? "✓" : "✗"} | ${sample} |`
    );
  }
  lines.push("");

  if (technologyDocs.length > 0) {
    lines.push("## Technology documentation");
    for (const tech of technologyDocs) {
      lines.push(`- ${tech.name}: ${tech.docsUrl}`);
    }
    lines.push("");
  }

  if (thirdPartyDocs.length > 0) {
    lines.push("## Third-party integration documentation");
    lines.push("| Package | Category | Used? | Docs |\n|---|---|---|---|");
    for (const item of thirdPartyDocs) {
      lines.push(
        `| \`${item.packageName}\` | ${item.category} | ${item.used ? "✓" : "✗"} | ${item.docsUrl} |`
      );
    }
    lines.push("");
  }

  lines.push("## Secret hygiene (do not commit secrets)");
  if (secretHygiene.findings.length === 0) {
    lines.push("- Status: ✅ No obvious secret exposures detected during scan.");
  } else {
    lines.push(`- Status: ⚠️ ${secretHygiene.findings.length} possible secret exposure signal(s) detected.`);
    lines.push("- Review these files immediately:");
    for (const finding of secretHygiene.findings.slice(0, 30)) {
      lines.push(`  - ${finding.filePath} (${finding.kind})`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

const PACKAGE_DOC_OVERRIDES: Record<string, string> = {
  "@azure/cosmos": "https://learn.microsoft.com/azure/cosmos-db/",
  "@azure/identity": "https://learn.microsoft.com/javascript/api/overview/azure/identity-readme",
  "@azure/storage-blob": "https://learn.microsoft.com/javascript/api/overview/azure/storage-blob-readme",
  "@aws-sdk/client-dynamodb": "https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-dynamodb/",
  "@microsoft/signalr": "https://learn.microsoft.com/aspnet/core/signalr/",
  "@prisma/client": "https://www.prisma.io/docs/orm/prisma-client",
  "@types/node": "https://nodejs.org/docs/latest-v22.x/api/",
  chalk: "https://github.com/chalk/chalk",
  commander: "https://github.com/tj/commander.js",
  express: "https://expressjs.com/",
  fastify: "https://www.fastify.io/docs/latest/",
  koa: "https://koajs.com/",
  mongoose: "https://mongoosejs.com/docs/",
  react: "https://react.dev/",
  sequelize: "https://sequelize.org/docs/v6/",
  typeorm: "https://typeorm.io/"
};

function docsUrlForPackage(packageName: string): string {
  return PACKAGE_DOC_OVERRIDES[packageName] || `https://www.npmjs.com/package/${packageName}`;
}

export function collectThirdPartyDocs(audit: DependencyAuditFindings): ThirdPartyDocLink[] {
  return audit.entries
    .map((entry) => ({
      packageName: entry.name,
      docsUrl: docsUrlForPackage(entry.name),
      category: entry.category,
      used: entry.used
    }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}
