import fs from "fs";
import path from "path";
import chalk from "chalk";
import { RepoAuthorshipModel } from "../enums/repo-authorship-model.enum.js";

export type RepoAuthorshipConfig = {
  selectedModels: RepoAuthorshipModel[];
  availableModels: RepoAuthorshipModel[];
  updatedAt: string;
};

export type ResolvedRepoAuthorship = {
  config: RepoAuthorshipConfig;
  source: "cli" | "file" | "bootstrap";
  invalidInputs: string[];
};

export type FileAuthorshipDetection = {
  model: RepoAuthorshipModel;
  evidence: string;
};

const AUTHORSHIP_MODEL_ALIAS_TO_ENUM: Record<string, RepoAuthorshipModel> = {
  manual: RepoAuthorshipModel.MANUAL,
  human: RepoAuthorshipModel.MANUAL,
  codex: RepoAuthorshipModel.CODEX,
  grok: RepoAuthorshipModel.GROK,
  chatgpt: RepoAuthorshipModel.CHATGPT,
  chatgt: RepoAuthorshipModel.CHATGPT,
  gpt: RepoAuthorshipModel.CHATGPT,
  claudehaiku: RepoAuthorshipModel.CLAUDE_HAIKU,
  haiku: RepoAuthorshipModel.CLAUDE_HAIKU,
  claudesonnet: RepoAuthorshipModel.CLAUDE_SONNET,
  sonnet: RepoAuthorshipModel.CLAUDE_SONNET,
  claudeopus: RepoAuthorshipModel.CLAUDE_OPUS,
  opus: RepoAuthorshipModel.CLAUDE_OPUS,
  gemini: RepoAuthorshipModel.GEMINI
};

const AUTHORSHIP_MODEL_COLOR: Record<RepoAuthorshipModel, (value: string) => string> = {
  [RepoAuthorshipModel.MANUAL]: chalk.gray,
  [RepoAuthorshipModel.CODEX]: chalk.cyan,
  [RepoAuthorshipModel.GROK]: chalk.magentaBright,
  [RepoAuthorshipModel.CHATGPT]: chalk.greenBright,
  [RepoAuthorshipModel.CLAUDE_HAIKU]: chalk.yellow,
  [RepoAuthorshipModel.CLAUDE_SONNET]: chalk.blueBright,
  [RepoAuthorshipModel.CLAUDE_OPUS]: chalk.magenta,
  [RepoAuthorshipModel.GEMINI]: chalk.whiteBright
};

const AUTHORSHIP_MODEL_LABEL: Record<RepoAuthorshipModel, string> = {
  [RepoAuthorshipModel.MANUAL]: "Manual",
  [RepoAuthorshipModel.CODEX]: "Codex",
  [RepoAuthorshipModel.GROK]: "Grok",
  [RepoAuthorshipModel.CHATGPT]: "ChatGPT",
  [RepoAuthorshipModel.CLAUDE_HAIKU]: "Claude Haiku",
  [RepoAuthorshipModel.CLAUDE_SONNET]: "Claude Sonnet",
  [RepoAuthorshipModel.CLAUDE_OPUS]: "Claude Opus",
  [RepoAuthorshipModel.GEMINI]: "Gemini"
};

const AUTHORSHIP_MODEL_MARKERS: Array<{ model: RepoAuthorshipModel; markers: string[] }> = [
  { model: RepoAuthorshipModel.CODEX, markers: ["codex"] },
  { model: RepoAuthorshipModel.GROK, markers: ["grok"] },
  { model: RepoAuthorshipModel.CHATGPT, markers: ["chatgpt", "chatgt", "gpt"] },
  { model: RepoAuthorshipModel.CLAUDE_HAIKU, markers: ["claude haiku", "claude-haiku", "haiku"] },
  { model: RepoAuthorshipModel.CLAUDE_SONNET, markers: ["claude sonnet", "claude-sonnet", "sonnet"] },
  { model: RepoAuthorshipModel.CLAUDE_OPUS, markers: ["claude opus", "claude-opus", "opus"] },
  { model: RepoAuthorshipModel.GEMINI, markers: ["gemini"] }
];

function normalizeAlias(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getAuthorshipConfigPath(repoRoot: string): string {
  return path.join(repoRoot, ".cortex", "repo-authorship.json");
}

function ensureCortexDirectory(repoRoot: string) {
  fs.mkdirSync(path.join(repoRoot, ".cortex"), { recursive: true });
}

function toUniqueModels(models: RepoAuthorshipModel[]): RepoAuthorshipModel[] {
  return Array.from(new Set(models));
}

export function getAllRepoAuthorshipModels(): RepoAuthorshipModel[] {
  return Object.values(RepoAuthorshipModel);
}

export function parseRepoAuthorshipModels(rawModels: string[]): {
  models: RepoAuthorshipModel[];
  invalidInputs: string[];
} {
  const models: RepoAuthorshipModel[] = [];
  const invalidInputs: string[] = [];

  for (const raw of rawModels) {
    const normalized = normalizeAlias(raw);
    const mapped = AUTHORSHIP_MODEL_ALIAS_TO_ENUM[normalized];

    if (mapped) {
      models.push(mapped);
    } else if (raw.trim()) {
      invalidInputs.push(raw.trim());
    }
  }

  return {
    models: toUniqueModels(models),
    invalidInputs
  };
}

function buildAuthorshipConfig(selectedModels: RepoAuthorshipModel[]): RepoAuthorshipConfig {
  return {
    selectedModels: toUniqueModels(selectedModels.length > 0 ? selectedModels : [RepoAuthorshipModel.MANUAL]),
    availableModels: getAllRepoAuthorshipModels(),
    updatedAt: new Date().toISOString()
  };
}

export function resolveRepoAuthorshipModels(repoRoot: string, cliModels: string[]): ResolvedRepoAuthorship {
  ensureCortexDirectory(repoRoot);

  const configPath = getAuthorshipConfigPath(repoRoot);
  const parsedCli = parseRepoAuthorshipModels(cliModels);

  if (parsedCli.models.length > 0) {
    const config = buildAuthorshipConfig(parsedCli.models);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

    return {
      config,
      source: "cli",
      invalidInputs: parsedCli.invalidInputs
    };
  }

  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8") || "{}");
    const selectedModels = Array.isArray(raw.selectedModels)
      ? parseRepoAuthorshipModels(raw.selectedModels.map((value: unknown) => String(value))).models
      : [];

    const config = buildAuthorshipConfig(selectedModels);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

    return {
      config,
      source: "file",
      invalidInputs: parsedCli.invalidInputs
    };
  }

  const config = buildAuthorshipConfig([RepoAuthorshipModel.MANUAL]);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  return {
    config,
    source: "bootstrap",
    invalidInputs: parsedCli.invalidInputs
  };
}

export function detectFileAuthorship(
  relativePath: string,
  fileContent: string,
  declaredModels: RepoAuthorshipModel[]
): FileAuthorshipDetection {
  const headerText = fileContent.split("\n").slice(0, 80).join("\n").toLowerCase();
  const filePathText = relativePath.toLowerCase();
  const joined = `${filePathText}\n${headerText}`;

  const markerRegexes = [
    /@engineer-maxxing:model\s*=\s*([a-z0-9 _-]+)/i,
    /generated[-_ ]by\s*[:=]\s*([a-z0-9 _-]+)/i,
    /ai[-_ ]model\s*[:=]\s*([a-z0-9 _-]+)/i,
    /model\s*[:=]\s*([a-z0-9 _-]+)/i
  ];

  for (const markerRegex of markerRegexes) {
    const match = joined.match(markerRegex);

    if (match?.[1]) {
      const parsed = parseRepoAuthorshipModels([match[1]]).models[0];

      if (parsed && parsed !== RepoAuthorshipModel.MANUAL) {
        return {
          model: parsed,
          evidence: `Marker matched: ${match[0]}`
        };
      }
    }
  }

  for (const markerSet of AUTHORSHIP_MODEL_MARKERS) {
    if (markerSet.markers.some((marker) => joined.includes(marker))) {
      return {
        model: markerSet.model,
        evidence: `Marker keyword matched: ${markerSet.markers[0]}`
      };
    }
  }

  const nonManualDeclared = declaredModels.filter((model) => model !== RepoAuthorshipModel.MANUAL);

  if (nonManualDeclared.length === 1) {
    return {
      model: nonManualDeclared[0],
      evidence: "Single non-manual repo model declared; using declared default."
    };
  }

  return {
    model: RepoAuthorshipModel.MANUAL,
    evidence: "No model marker found; treated as manual code."
  };
}

export function formatRepoAuthorshipModel(model: RepoAuthorshipModel): string {
  return AUTHORSHIP_MODEL_LABEL[model] || model;
}

export function colorizeRepoAuthorshipModel(model: RepoAuthorshipModel, value: string): string {
  const colorizer = AUTHORSHIP_MODEL_COLOR[model] || ((text: string) => text);
  return colorizer(value);
}
