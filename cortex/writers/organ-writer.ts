import fs from "fs";
import path from "path";
import { ANATOMY_DIRECTORY, RepoMemoryFile } from "../enums/repo-memory-file.enum.js";
import { RepoEvent } from "../context/repo-event.types.js";

function ensureAnatomyDirectory() {
  fs.mkdirSync(path.join(process.cwd(), ANATOMY_DIRECTORY), { recursive: true });
}

export function ensureAnatomyFilesExist(options?: { reset?: boolean }) {
  ensureAnatomyDirectory();
  const reset = Boolean(options?.reset);

  const brainSeed = `# BRAIN.md

> The Brain starts with default senior engineering knowledge, then learns from EYES, NOSE, EARS, and HANDS.

## Legend

- DEFAULT_KNOWLEDGE: Known before scanning.
- LEARNED_KNOWLEDGE: Learned from the repo.
- SMELL_KNOWLEDGE: Learned from NOSE.
- NOISE_KNOWLEDGE: Learned from EARS.
- WORK_CONTEXT: Learned from HANDS.
- DOC_CONTEXT: Fetched from official technology documentation.
- RISK: Needs attention.

## MODEL_ACTION_GUARDRAILS

- Ask questions first before any prompt/action when executing work.
- For any **new feature**, always run a **plan phase first** before implementation.
- Do not over-complicate solutions. Prefer the simplest implementation that satisfies requirements.
- Use the least amount of tokens possible: avoid repeated scans, keep context concise, summarize aggressively.
- Follow industry standards for each technology by using official/vendor documentation as the primary source of truth.
- Do not hallucinate. Do not invent facts, files, code paths, APIs, or behaviors.
- Do not assume missing requirements. Mark unknowns and ask clarifying questions.
- If confidence is low, stop and ask before proceeding.

---

# DEFAULT_KNOWLEDGE

## Identity

The Brain acts as a technology-agnostic senior full-stack developer.

It prefers:

- simplicity over cleverness
- small modules over god files
- explicit behavior over magic
- readable code over abstract code
- useful patterns over premature patterns
- visible failures over silent failures
- stable boundaries over hidden coupling
- business logic separated from framework glue
- boring, maintainable implementation

## KISS

Keep the system as simple as possible.

## DRY

Avoid duplicated knowledge, not merely duplicated text.

## Single Responsibility

A file, class, function, or module should have one clear reason to change.

Flag as \`BREAKS_SINGLE_RESPONSIBILITY\` when one unit handles multiple unrelated jobs.

## Clean Architecture

Business rules should not be trapped inside UI, route handlers, controllers, or framework glue.

## Failure Visibility

Failures should usually be logged, returned, retried, rethrown, monitored, or intentionally documented.

## Type Safety

Unsafe type escapes may be acceptable at system boundaries, but should not spread into core business logic.

## Noise

Noise is anything that increases understanding cost without increasing system value.

---

# DOC_CONTEXT

Empty until technologies are detected and official docs are fetched.

---

# LEARNED_KNOWLEDGE

## Repo Purpose

Empty until learned.

## Architecture

Empty until learned.

## Main Flows

Empty until learned.

## Architecture Layers (High Level)

- Frontend code makeup: Empty until learned.
- Frontend to backend interactions: Empty until learned.
- Backend code: Empty until learned.
- Backend to database interactions: Empty until learned.
- Caching layer: Empty until learned.
- SignalR / Realtime layer: Empty until learned.

## Data Layer Posture

- Database technology: Database-agnostic until concrete database usage is detected.
- Database connection summary: Empty until learned.

## Tech Stack

Empty until learned.

## Learned From EYES

Empty until observed.

## Learned From NOSE

Empty until smells are detected.

## Learned From EARS

Empty until noise is detected.

## Work Status From HANDS

Empty until work begins.

## High-Risk Areas

Empty until risks are detected.

## Simplification Strategy

Empty until enough context exists.

## Next Recommended Actions

Empty until first pass completes.
`;

  const eyesSeed = `# EYES.md

> EYES observes what exists. EYES does not judge. It records evidence.

## Directories

## Files

## Entry Points

## Routes

## Pages / Screens / Views

## API Endpoints

## Data Models

## Third-Party Integrations

## Config Files

## Scripts

## Tests

## Environment Variables

## Detected Technologies
`;

  const earsSeed = `# EARS.md

> EARS hears noise: code that may work but is louder, more complex, or harder to understand than needed.

## Noisy Code

## Overcomplicated Logic

## Too Many Abstractions

## Premature Patterns

## Unclear Naming

## Verbose Control Flow

## Repeated Boilerplate

## Cognitive Overload

## Unnecessary Indirection

## Could Be Simpler

## Suggested Simplifications
`;

  const noseSeed = `# NOSE.md

> NOSE classifies smells, risks, and bad patterns using code-agnostic rules.

## Breaks Single Responsibility

## Possible Silent Failures

## Unsafe Type Escapes

## Dead Code Candidates

## Dead Route Candidates

## Missing Error Handling

## Missing Test Coverage

## Framework Leaks

## Security Risks

## Performance Risks

## Cleanup Queue
`;

  const handsSeed = `# HANDS.md

> HANDS tracks work, progress, token usage, model usage, and handoffs.

## Active Goal

understand_repo

## Active Workflow

first_pass

## Active Directory

Empty until work begins.

## Active File

Empty until work begins.

## Completed Work Units

## Current Model

Empty until model is selected.

## Token Usage By Model

| Model | Input Tokens | Output Tokens | Total Tokens | Work Units |
|---|---:|---:|---:|---:|

## Token Budget

- Max tokens: 120000
- Handoff at: 80%

## Handoffs

## Progress

- Directories scanned: 0 / 0
- Files scanned: 0 / 0
- Percent complete: 0%

## Next Work

Initialize first pass scan.
`;

  const soulSeed = `# SOUL.md

## Standards Policy

## Manifest Source

## Runtime Dependencies

## Dev Dependencies

## Used Dependencies

## Unused Dependencies

## Heavy Dependencies

## Dependency Health Score

## Technology Documentation Links

## Third-Party Integration Documentation Links

## Secret Hygiene (Do not commit secrets)
`;

  const heartSeed = `# HEART.md

> HEART is reserved for feature planning after learning/cleanup.

## Visual Changes (Markup)

## Frontend Changes (Components, Modules, Services, State)

## Backend Changes (API, SOAP, OTHER)

## Database Changes (Schema, Migrations, Queries, Indexes, Security, Performance)

## Infrastructure Changes (Helpers, Extensions, Shared, Repository, Factory)
`;

  const fileHeaders: Record<RepoMemoryFile, string> = {
    [RepoMemoryFile.BRAIN]: brainSeed,
    [RepoMemoryFile.EYES]: eyesSeed,
    [RepoMemoryFile.EARS]: earsSeed,
    [RepoMemoryFile.NOSE]: noseSeed,
    [RepoMemoryFile.HANDS]: handsSeed,
    [RepoMemoryFile.SOUL]: soulSeed,
    [RepoMemoryFile.HEART]: heartSeed
  };

  for (const memoryFile of Object.values(RepoMemoryFile)) {
    const filePath = path.join(process.cwd(), memoryFile);

    if (reset || !fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, fileHeaders[memoryFile], "utf8");
    }
  }
}

export function appendAnatomyText(memoryFile: RepoMemoryFile, title: string, body: string) {
  ensureAnatomyDirectory();

  fs.appendFileSync(
    path.join(process.cwd(), memoryFile),
    `\n\n## ${title}\n\n${body}\n`,
    "utf8"
  );
}

export function writeAnatomyFile(memoryFile: RepoMemoryFile, content: string) {
  ensureAnatomyDirectory();
  fs.writeFileSync(path.join(process.cwd(), memoryFile), content, "utf8");
}

export function appendOrganEvent(event: RepoEvent) {
  ensureAnatomyDirectory();
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
  ensureAnatomyDirectory();
  fs.appendFileSync(
    path.join(process.cwd(), RepoMemoryFile.BRAIN),
    `\n\n## ${title}\n\n${body}\n`,
    "utf8"
  );
}
