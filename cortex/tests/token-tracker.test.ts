import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ModelId } from "../enums/model.enum.js";
import {
  estimateTokens,
  readTokenLedger,
  recordTokenUsage,
  shouldHandoff
} from "../tokens/token-tracker.js";

test("estimateTokens rounds up to quarter-char token estimate", () => {
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("recordTokenUsage writes cumulative model ledger and handoff threshold checks", () => {
  const originalCwd = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engineer-maxxing-token-test-"));

  try {
    process.chdir(tempRoot);
    fs.mkdirSync(path.join(tempRoot, ".cortex"), { recursive: true });

    const first = recordTokenUsage(ModelId.DEFAULT_FAST, "abcd", "efgh");
    assert.equal(first.totalTokens, 2);
    assert.equal(first.workUnits, 1);

    const second = recordTokenUsage(ModelId.DEFAULT_FAST, "abcdefgh", "ijklmnop");
    assert.equal(second.inputTokens, 3);
    assert.equal(second.outputTokens, 3);
    assert.equal(second.totalTokens, 6);
    assert.equal(second.workUnits, 2);

    const ledger = readTokenLedger();
    assert.ok(ledger[ModelId.DEFAULT_FAST]);
    assert.equal(ledger[ModelId.DEFAULT_FAST]?.totalTokens, 6);

    assert.equal(shouldHandoff(ModelId.DEFAULT_FAST, 10, 70), false);
    assert.equal(shouldHandoff(ModelId.DEFAULT_FAST, 10, 60), true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
