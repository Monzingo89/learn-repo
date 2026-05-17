import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ContainerPlatform } from "../enums/container-platform.enum.js";
import {
  detectContainerPlatformsForFile,
  detectContainerPlatformsFromRoot
} from "../workflows/container-detection.js";

test("detectContainerPlatformsFromRoot detects Docker and Azure Container Apps signals", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engineer-maxxing-container-test-"));

  try {
    fs.writeFileSync(path.join(tempRoot, "Dockerfile"), "FROM node:20\n", "utf8");
    fs.writeFileSync(path.join(tempRoot, "azure.yaml"), "services:\n  api:\n    host: containerapp\n", "utf8");

    const detections = detectContainerPlatformsFromRoot(tempRoot);
    const platforms = detections.map((item) => item.platform);

    assert.ok(platforms.includes(ContainerPlatform.DOCKER));
    assert.ok(platforms.includes(ContainerPlatform.AZURE_CONTAINER_APPS));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("detectContainerPlatformsForFile detects Kubernetes/AKS signals", () => {
  const manifest = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\n# Microsoft.ContainerService/managedClusters`;

  const detections = detectContainerPlatformsForFile("infra/k8s/deployment.yaml", manifest);
  const platforms = detections.map((item) => item.platform);

  assert.ok(platforms.includes(ContainerPlatform.KUBERNETES));
  assert.ok(platforms.includes(ContainerPlatform.AZURE_KUBERNETES_SERVICE));
});
