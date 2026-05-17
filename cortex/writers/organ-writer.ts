import fs from "fs";
import path from "path";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { RepoEvent } from "../context/repo-event.types.js";

export function appendOrganEvent(event: RepoEvent) {
  const filePath = path.join(process.cwd(), event.targetFile);

  const lines = [
    "",
    `### ${event.title}`,
    "",
    `- Type: ${event.type}`,
    event.sourcePath ? `- Source: \`${event.sourcePath}\`` : "",
    event.directory ? `- Directory: \`${event.directory}\`` : "",
    `- Confidence: ${event.confidence}`,
    `- Severity: ${event.severity}`,
    "",
    event.summary,
    "",
    "Evidence:",
    ...event.evidence.map((item) => `- ${item}`),
    event.suggestedAction ? "" : "",
    event.suggestedAction ? `Suggested action: ${event.suggestedAction}` : "",
    ""
  ].filter(Boolean);

  fs.appendFileSync(filePath, lines.join("\n"), "utf8");
}

export function appendBrainText(title: string, body: string) {
  fs.appendFileSync(
    path.join(process.cwd(), RepoMemoryFile.BRAIN),
    `\n\n## ${title}\n\n${body}\n`,
    "utf8"
  );
}
