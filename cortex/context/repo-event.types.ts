import { RepoEventType } from "../enums/repo-event-type.enum.js";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";

export type Confidence = "low" | "medium" | "high";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type RepoEvent = {
  id: string;
  type: RepoEventType;
  targetFile: RepoMemoryFile;
  title: string;
  summary: string;
  sourcePath?: string;
  directory?: string;
  line?: number;
  confidence: Confidence;
  severity: Severity;
  evidence: string[];
  suggestedAction?: string;
  createdAt: string;
};
