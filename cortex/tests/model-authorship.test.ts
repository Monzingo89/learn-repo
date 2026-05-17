import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RepoAuthorshipModel } from "../enums/repo-authorship-model.enum.js";
import {
  detectFileAuthorship,
  parseRepoAuthorshipModels,
  resolveRepoAuthorshipModels
} from "../workflows/model-authorship.js";

test("parseRepoAuthorshipModels parses common aliases and reports invalid inputs", () => {
  const parsed = parseRepoAuthorshipModels(["Codex", "ChatGT", "Claude Sonnet", "UnknownModel"]);

  assert.deepEqual(parsed.models, [
    RepoAuthorshipModel.CODEX,
    RepoAuthorshipModel.CHATGPT,
    RepoAuthorshipModel.CLAUDE_SONNET
  ]);
  assert.deepEqual(parsed.invalidInputs, ["UnknownModel"]);
});

test("detectFileAuthorship detects explicit model markers", () => {
  const sample = `// generated-by: Claude Opus\nexport const value = 1;`;
  const detected = detectFileAuthorship("src/example.ts", sample, [RepoAuthorshipModel.CLAUDE_OPUS]);

  assert.equal(detected.model, RepoAuthorshipModel.CLAUDE_OPUS);
  assert.ok(detected.evidence.toLowerCase().includes("marker"));
});

test("resolveRepoAuthorshipModels bootstraps config on first run", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engineer-maxxing-authorship-test-"));

  try {
    const resolved = resolveRepoAuthorshipModels(tempRoot, []);
    const configPath = path.join(tempRoot, ".cortex", "repo-authorship.json");

    assert.equal(resolved.source, "bootstrap");
    assert.ok(fs.existsSync(configPath));
    assert.deepEqual(resolved.config.selectedModels, [RepoAuthorshipModel.MANUAL]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
