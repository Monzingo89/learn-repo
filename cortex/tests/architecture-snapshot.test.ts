import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeFileForArchitecture,
  architectureSnapshotSummary,
  createArchitectureSnapshot
} from "../workflows/architecture-snapshot.js";

test("architecture snapshot starts database-agnostic", () => {
  const snapshot = createArchitectureSnapshot();
  const summary = architectureSnapshotSummary(snapshot);

  assert.equal(summary.databaseAgnostic, true);
  assert.deepEqual(summary.databaseTechnologies, []);
});

test("architecture snapshot detects backend->db, caching, and signalr evidence", () => {
  const snapshot = createArchitectureSnapshot();

  analyzeFileForArchitecture(
    "backend/services/user-service.ts",
    "import { PrismaClient } from '@prisma/client'; import Redis from 'redis'; import { HubConnectionBuilder } from '@microsoft/signalr'; const db = new PrismaClient();",
    snapshot
  );

  const summary = architectureSnapshotSummary(snapshot);

  assert.ok(summary.backendCodeCount >= 1);
  assert.ok(summary.backendToDatabaseCount >= 1);
  assert.ok(summary.cachingCount >= 1);
  assert.ok(summary.signalRCount >= 1);
  assert.equal(summary.databaseAgnostic, false);
  assert.ok(summary.databaseTechnologies.includes("Prisma (ORM)"));
});
