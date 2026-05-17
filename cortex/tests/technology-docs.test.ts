import assert from "node:assert/strict";
import test from "node:test";
import { detectTechnologiesForPath } from "../workflows/technology-docs.js";

test("detectTechnologiesForPath detects TypeScript and Node.js contexts", () => {
  const tsTech = detectTechnologiesForPath("cortex/workflows/learn.workflow.ts");
  assert.ok(tsTech.some((item) => item.id === "typescript"));

  const nodeTech = detectTechnologiesForPath("package.json");
  assert.ok(nodeTech.some((item) => item.id === "nodejs"));
});

test("detectTechnologiesForPath detects GitHub Actions docs links", () => {
  const actions = detectTechnologiesForPath(".github/workflows/ci.yml");
  const ghActions = actions.find((item) => item.id === "github-actions");

  assert.ok(ghActions);
  assert.equal(ghActions?.docsUrl, "https://docs.github.com/actions");
});
