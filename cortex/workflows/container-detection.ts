import fs from "fs";
import path from "path";
import { ContainerPlatform } from "../enums/container-platform.enum.js";

export type ContainerDetection = {
  platform: ContainerPlatform;
  evidencePath: string;
  reason: string;
};

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase();
}

export function detectContainerPlatformsFromRoot(repoRoot: string): ContainerDetection[] {
  const detections: ContainerDetection[] = [];

  const rootDockerFiles = ["Dockerfile", ".dockerignore"];
  if (rootDockerFiles.some((fileName) => fs.existsSync(path.join(repoRoot, fileName)))) {
    detections.push({
      platform: ContainerPlatform.DOCKER,
      evidencePath: "Dockerfile",
      reason: "Docker root artifact detected."
    });
  }

  const composeFiles = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
  for (const composeFile of composeFiles) {
    if (fs.existsSync(path.join(repoRoot, composeFile))) {
      detections.push({
        platform: ContainerPlatform.DOCKER_COMPOSE,
        evidencePath: composeFile,
        reason: "Compose orchestration file detected."
      });
      break;
    }
  }

  const azureYamlPath = path.join(repoRoot, "azure.yaml");
  if (fs.existsSync(azureYamlPath)) {
    const content = fs.readFileSync(azureYamlPath, "utf8").toLowerCase();

    if (content.includes("containerapp") || content.includes("container app")) {
      detections.push({
        platform: ContainerPlatform.AZURE_CONTAINER_APPS,
        evidencePath: "azure.yaml",
        reason: "Azure Container Apps signal found in azure.yaml."
      });
    }

    if (content.includes("aks") || content.includes("managedclusters")) {
      detections.push({
        platform: ContainerPlatform.AZURE_KUBERNETES_SERVICE,
        evidencePath: "azure.yaml",
        reason: "AKS signal found in azure.yaml."
      });
    }
  }

  return dedupeDetections(detections);
}

export function detectContainerPlatformsForFile(relativePath: string, fileContent: string): ContainerDetection[] {
  const detections: ContainerDetection[] = [];
  const normalizedPath = normalizePath(relativePath);
  const normalizedContent = fileContent.toLowerCase();
  const joined = `${normalizedPath}\n${normalizedContent}`;

  if (normalizedPath.endsWith("dockerfile") || joined.includes("from ") && joined.includes(" as ")) {
    detections.push({
      platform: ContainerPlatform.DOCKER,
      evidencePath: relativePath,
      reason: "Dockerfile build syntax detected."
    });
  }

  if (
    normalizedPath.endsWith("docker-compose.yml") ||
    normalizedPath.endsWith("docker-compose.yaml") ||
    normalizedPath.endsWith("compose.yml") ||
    normalizedPath.endsWith("compose.yaml") ||
    normalizedContent.includes("services:") && normalizedContent.includes("image:")
  ) {
    detections.push({
      platform: ContainerPlatform.DOCKER_COMPOSE,
      evidencePath: relativePath,
      reason: "Compose service/image pattern detected."
    });
  }

  const looksLikeKubernetesManifest =
    normalizedPath.includes("/k8s/") ||
    normalizedPath.includes("/kubernetes/") ||
    (normalizedContent.includes("apiversion:") && normalizedContent.includes("kind:"));

  if (looksLikeKubernetesManifest) {
    detections.push({
      platform: ContainerPlatform.KUBERNETES,
      evidencePath: relativePath,
      reason: "Kubernetes manifest signal detected."
    });
  }

  if (
    joined.includes("microsoft.app/containerapps") ||
    joined.includes("container app") ||
    joined.includes("containerapp")
  ) {
    detections.push({
      platform: ContainerPlatform.AZURE_CONTAINER_APPS,
      evidencePath: relativePath,
      reason: "Azure Container Apps signal detected."
    });
  }

  if (
    joined.includes("microsoft.containerservice/managedclusters") ||
    joined.includes("az aks") ||
    joined.includes("aks")
  ) {
    detections.push({
      platform: ContainerPlatform.AZURE_KUBERNETES_SERVICE,
      evidencePath: relativePath,
      reason: "AKS signal detected."
    });
  }

  return dedupeDetections(detections);
}

function dedupeDetections(detections: ContainerDetection[]): ContainerDetection[] {
  const byPlatform = new Map<ContainerPlatform, ContainerDetection>();

  for (const detection of detections) {
    if (!byPlatform.has(detection.platform)) {
      byPlatform.set(detection.platform, detection);
    }
  }

  return Array.from(byPlatform.values());
}
