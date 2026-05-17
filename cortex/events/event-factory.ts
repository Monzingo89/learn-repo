import crypto from "crypto";
import { RepoEvent } from "../context/repo-event.types.js";
import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";

export function createRepoEvent(input: {
  type: RepoEventType;
  targetFile: RepoMemoryFile;
  title: string;
  summary: string;
  sourcePath?: string;
  directory?: string;
  evidence?: string[];
  suggestedAction?: string;
  confidence?: "low" | "medium" | "high";
  severity?: "info" | "low" | "medium" | "high" | "critical";
}): RepoEvent {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    targetFile: input.targetFile,
    title: input.title,
    summary: input.summary,
    sourcePath: input.sourcePath,
    directory: input.directory,
    confidence: input.confidence || "medium",
    severity: input.severity || "info",
    evidence: input.evidence || [],
    suggestedAction: input.suggestedAction,
    createdAt: new Date().toISOString()
  };
}
