import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { executeRepo, parseMoveMapMarkdown } from "../workflows/execute.workflow.js";

test("parseMoveMapMarkdown extracts move rows", () => {
  const markdown = [
    "# REORGANIZE_MOVE_MAP.md",
    "",
    "| Source | Suggested target | Reason |",
    "|---|---|---|",
    "| `apps/api/src/handlers/orders.ts` | `apps/api/src/modules/orders/orders.ts` | Single-responsibility split candidate |",
    "| `apps/web/src/pages/home.tsx` | `apps/web/src/features/home/home.tsx` | Structure normalization |"
  ].join("\n");

  const moves = parseMoveMapMarkdown(markdown);
  assert.equal(moves.length, 2);
  assert.deepEqual(moves[0], {
    source: "apps/api/src/handlers/orders.ts",
    target: "apps/api/src/modules/orders/orders.ts",
    reason: "Single-responsibility split candidate"
  });
});

test("executeRepo supports dry-run and apply modes", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engineer-maxxing-exec-"));
  const previousCwd = process.cwd();

  try {
    fs.mkdirSync(path.join(tempRoot, "anatomy"), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, "src"), { recursive: true });

    fs.writeFileSync(
      path.join(tempRoot, "anatomy", "REORGANIZE_MOVE_MAP.md"),
      [
        "# REORGANIZE_MOVE_MAP.md",
        "",
        "| Source | Suggested target | Reason |",
        "|---|---|---|",
        "| `src/old.ts` | `src/new.ts` | Structure normalization |"
      ].join("\n"),
      "utf8"
    );

    fs.writeFileSync(
      path.join(tempRoot, "anatomy", "CLEANUP_DEAD_CODE_QUEUE.txt"),
      ["# Dead Code Queue", "", "src/dead.ts"].join("\n"),
      "utf8"
    );

    fs.writeFileSync(path.join(tempRoot, "src", "old.ts"), "export const oldValue = 1;\n", "utf8");
    fs.writeFileSync(path.join(tempRoot, "src", "dead.ts"), "export const deadValue = 1;\n", "utf8");

    process.chdir(tempRoot);

    const dryRunSummary = await executeRepo(tempRoot, {
      quiet: true,
      dryRun: true,
      applyMoves: true,
      applyDeadCode: true,
      maxOperations: 10
    });

    assert.equal(dryRunSummary.movedCount, 1);
    assert.equal(dryRunSummary.quarantinedDeadCodeCount, 1);
    assert.equal(fs.existsSync(path.join(tempRoot, "src", "old.ts")), true);
    assert.equal(fs.existsSync(path.join(tempRoot, "src", "new.ts")), false);

    const applySummary = await executeRepo(tempRoot, {
      quiet: true,
      dryRun: false,
      applyMoves: true,
      applyDeadCode: true,
      maxOperations: 10
    });

    assert.equal(applySummary.movedCount, 1);
    assert.equal(applySummary.quarantinedDeadCodeCount, 1);
    assert.equal(fs.existsSync(path.join(tempRoot, "src", "old.ts")), false);
    assert.equal(fs.existsSync(path.join(tempRoot, "src", "new.ts")), true);
    assert.equal(fs.existsSync(path.join(tempRoot, ".cortex", "trash", "dead-code", "src", "dead.ts")), true);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
