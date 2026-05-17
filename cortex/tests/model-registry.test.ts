import assert from "node:assert/strict";
import test from "node:test";
import { WorkUnit } from "../enums/work-unit.enum.js";
import { ModelId } from "../enums/model.enum.js";
import { selectModelForWorkUnit } from "../models/model-registry.js";

test("selectModelForWorkUnit chooses FAST_SCAN model for file-level operations", () => {
  assert.equal(selectModelForWorkUnit(WorkUnit.SCAN_FILE), ModelId.DEFAULT_FAST);
  assert.equal(selectModelForWorkUnit(WorkUnit.CLASSIFY_FILE), ModelId.DEFAULT_FAST);
  assert.equal(selectModelForWorkUnit(WorkUnit.DETECT_STRUCTURE), ModelId.DEFAULT_FAST);
});

test("selectModelForWorkUnit chooses reasoning and long-context models for higher-order work", () => {
  assert.equal(selectModelForWorkUnit(WorkUnit.DETECT_SMELLS), ModelId.DEFAULT_REASONING);
  assert.equal(selectModelForWorkUnit(WorkUnit.DETECT_NOISE), ModelId.DEFAULT_REASONING);
  assert.equal(selectModelForWorkUnit(WorkUnit.UNDERSTAND_REPO), ModelId.DEFAULT_LONG_CONTEXT);
});
