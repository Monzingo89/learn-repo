import assert from "node:assert/strict";
import test from "node:test";
import { resolveSetupOptions } from "../workflows/setup.workflow.js";

test("resolveSetupOptions normalizes and deduplicates values", () => {
  const options = resolveSetupOptions({
    maxFileBytes: -1,
    includeExt: [".env", ".env", " .toml "],
    excludeDirs: ["tmp", "tmp", " artifacts "],
    repoModels: ["Codex", "Codex", " Gemini "],
    freshStart: false,
    quiet: true,
    verbose: true
  });

  assert.equal(options.maxFileBytes, 20000);
  assert.deepEqual(options.includeExt, [".env", ".toml"]);
  assert.deepEqual(options.excludeDirs, ["tmp", "artifacts"]);
  assert.deepEqual(options.repoModels, ["Codex", "Gemini"]);
  assert.equal(options.freshStart, false);
  assert.equal(options.quiet, true);
  assert.equal(options.verbose, true);
});
