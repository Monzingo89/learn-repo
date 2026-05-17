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

  const brainSeed = `# BRAIN

The synthesis layer. Pre-loaded with code-agnostic engineering knowledge that an expert engineer carries into any codebase. Repository-specific observations are appended below as the scan progresses.

## Core Design Principles

- **KISS** — Keep It Simple, Stupid. Prefer the simplest design that solves the problem. Complexity must be earned, not assumed.
- **DRY** — Don't Repeat Yourself. Every piece of knowledge should have a single, unambiguous representation. Extract duplication only after the third occurrence (Rule of Three).
- **YAGNI** — You Aren't Gonna Need It. Don't build for hypothetical futures. Add abstractions when the second concrete use case appears.
- **SOLID**
  - *Single Responsibility* — a module/class has one reason to change.
  - *Open/Closed* — open for extension, closed for modification.
  - *Liskov Substitution* — subtypes must be substitutable for their base types.
  - *Interface Segregation* — many small, role-specific interfaces beat one fat one.
  - *Dependency Inversion* — depend on abstractions, not concretions.
- **Separation of Concerns** — each layer/module owns one axis of change.
- **Principle of Least Astonishment** — code should behave the way a reader expects.
- **Composition over Inheritance** — prefer assembling behavior from small parts.
- **Fail Fast & Explicit Errors** — surface invalid state at the boundary, not deep in business logic.

## Clean Architecture (code-agnostic)

- **Concentric layers**, dependencies point inward only:
  1. *Entities / Domain* — pure business rules, no framework knowledge.
  2. *Use Cases / Application* — orchestrate entities; define ports (interfaces).
  3. *Interface Adapters* — controllers, presenters, gateways, repositories (implement ports).
  4. *Frameworks & Drivers* — web, db, UI, devices, external services.
- **Ports & Adapters (Hexagonal)** — domain defines interfaces; adapters implement them. Swappable infra.
- **Domain-Driven Design building blocks** — Entity, Value Object, Aggregate, Repository, Domain Event, Bounded Context, Ubiquitous Language.
- **CQRS** — separate read and write models when their shapes or scaling profiles diverge.
- **Event-Driven** — communicate state changes via events; favors loose coupling, enables audit/replay.

## Common Design Patterns

- **Creational** — Factory, Abstract Factory, Builder, Singleton (sparingly), Prototype.
- **Structural** — Adapter, Decorator, Facade, Proxy, Composite, Bridge.
- **Behavioral** — Strategy, Observer, Command, State, Iterator, Mediator, Chain of Responsibility, Template Method.
- **Enterprise / Application** — Repository, Unit of Work, Specification, Service Layer, DTO, Mapper, Result/Either, Saga.
- **Concurrency** — Producer/Consumer, Pub/Sub, Pipeline, Actor, Worker Pool, Circuit Breaker, Bulkhead, Retry with backoff.
- **API** — REST, GraphQL, RPC/gRPC, SOAP, Webhook, BFF (Backend-for-Frontend).

## Code Quality Heuristics

- Functions: one job, descriptive name, small body, few parameters, no hidden side effects.
- Files: cohesive — everything in the file should belong together.
- Naming: nouns for things, verbs for actions, no abbreviations that aren't standard.
- Comments explain *why*, not *what*. Code explains *what*.
- Tests: arrange / act / assert, one behavior per test, fast and deterministic.
- Boundaries: validate input at the system boundary, trust internal callers.

## Repository-Specific Synthesis

_Observations from this repository will be appended below as the scan runs._
`;

  const fileHeaders: Record<RepoMemoryFile, string> = {
    [RepoMemoryFile.BRAIN]: brainSeed,
    [RepoMemoryFile.EYES]: "# EYES\n",
    [RepoMemoryFile.EARS]: "# EARS\n",
    [RepoMemoryFile.NOSE]: "# NOSE\n",
    [RepoMemoryFile.HANDS]: "# HANDS\n",
    [RepoMemoryFile.SOUL]: "# SOUL\n",
    [RepoMemoryFile.HEART]: "# HEART\n"
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
