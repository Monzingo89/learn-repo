#!/usr/bin/env bash
set -e

mkdir -p cortex/{organs,enums,context,events,default-brain,writers,workflows}
mkdir -p .cortex

cat > cortex/enums/repo-memory-file.enum.ts <<'TS'
export enum RepoMemoryFile {
  BRAIN = "BRAIN.md",
  EYES = "EYES.md",
  NOSE = "NOSE.md",
  EARS = "EARS.md",
  HANDS = "HANDS.md"
}
TS

cat > cortex/enums/repo-event-type.enum.ts <<'TS'
export enum RepoEventType {
  STRUCTURE_OBSERVED = "STRUCTURE_OBSERVED",
  FILE_OBSERVED = "FILE_OBSERVED",
  DIRECTORY_OBSERVED = "DIRECTORY_OBSERVED",
  ENTRYPOINT_OBSERVED = "ENTRYPOINT_OBSERVED",
  ROUTE_OBSERVED = "ROUTE_OBSERVED",
  API_ENDPOINT_OBSERVED = "API_ENDPOINT_OBSERVED",
  DATA_MODEL_OBSERVED = "DATA_MODEL_OBSERVED",
  INTEGRATION_OBSERVED = "INTEGRATION_OBSERVED",
  CONFIG_OBSERVED = "CONFIG_OBSERVED",
  TEST_OBSERVED = "TEST_OBSERVED",
  TECHNOLOGY_OBSERVED = "TECHNOLOGY_OBSERVED",

  CODE_SMELL_DETECTED = "CODE_SMELL_DETECTED",
  BREAKS_SINGLE_RESPONSIBILITY = "BREAKS_SINGLE_RESPONSIBILITY",
  POSSIBLE_SILENT_FAILURE = "POSSIBLE_SILENT_FAILURE",
  UNSAFE_TYPE_ESCAPE = "UNSAFE_TYPE_ESCAPE",
  DEAD_CODE_CANDIDATE = "DEAD_CODE_CANDIDATE",
  DEAD_ROUTE_CANDIDATE = "DEAD_ROUTE_CANDIDATE",
  MISSING_ERROR_HANDLING = "MISSING_ERROR_HANDLING",
  MISSING_TEST_COVERAGE = "MISSING_TEST_COVERAGE",
  FRAMEWORK_LEAK = "FRAMEWORK_LEAK",

  NOISE_DETECTED = "NOISE_DETECTED",
  OVERCOMPLICATED_LOGIC = "OVERCOMPLICATED_LOGIC",
  TOO_MANY_ABSTRACTIONS = "TOO_MANY_ABSTRACTIONS",
  PREMATURE_PATTERN = "PREMATURE_PATTERN",
  UNCLEAR_NAMING = "UNCLEAR_NAMING",
  VERBOSE_CONTROL_FLOW = "VERBOSE_CONTROL_FLOW",
  REPEATED_BOILERPLATE = "REPEATED_BOILERPLATE",
  UNNECESSARY_INDIRECTION = "UNNECESSARY_INDIRECTION",

  WORK_UNIT_STARTED = "WORK_UNIT_STARTED",
  WORK_UNIT_COMPLETED = "WORK_UNIT_COMPLETED",
  MODEL_TOKEN_USAGE_RECORDED = "MODEL_TOKEN_USAGE_RECORDED",
  MODEL_HANDOFF_RECORDED = "MODEL_HANDOFF_RECORDED",
  PROGRESS_UPDATED = "PROGRESS_UPDATED",

  DEFAULT_KNOWLEDGE_LOADED = "DEFAULT_KNOWLEDGE_LOADED",
  DOC_CONTEXT_ADDED = "DOC_CONTEXT_ADDED",
  ARCHITECTURE_INFERRED = "ARCHITECTURE_INFERRED",
  UNDERSTANDING_UPDATED = "UNDERSTANDING_UPDATED",
  NEXT_ACTION_RECOMMENDED = "NEXT_ACTION_RECOMMENDED"
}
TS

cat > cortex/enums/work-unit.enum.ts <<'TS'
export enum WorkUnit {
  INIT_BODY = "INIT_BODY",
  UNDERSTAND_REPO = "UNDERSTAND_REPO",
  SCAN_DIRECTORY = "SCAN_DIRECTORY",
  SCAN_FILE = "SCAN_FILE",
  CLASSIFY_FILE = "CLASSIFY_FILE",
  DETECT_STRUCTURE = "DETECT_STRUCTURE",
  DETECT_SMELLS = "DETECT_SMELLS",
  DETECT_NOISE = "DETECT_NOISE",
  MAP_PATTERN_TO_STACK = "MAP_PATTERN_TO_STACK",
  MAP_PATTERN_TO_REPOSITORY = "MAP_PATTERN_TO_REPOSITORY",
  APPLY_PATTERN = "APPLY_PATTERN",
  AVOID_ANTI_PATTERN = "AVOID_ANTI_PATTERN",
  UPDATE_BRAIN = "UPDATE_BRAIN",
  WRITE_ORGAN = "WRITE_ORGAN"
}
TS

cat > cortex/enums/model.enum.ts <<'TS'
export enum ModelId {
  DEFAULT_FAST = "DEFAULT_FAST",
  DEFAULT_REASONING = "DEFAULT_REASONING",
  DEFAULT_LONG_CONTEXT = "DEFAULT_LONG_CONTEXT",
  DEFAULT_LOCAL = "DEFAULT_LOCAL"
}
TS

cat > cortex/context/repo-event.types.ts <<'TS'
import { RepoEventType } from "../enums/repo-event-type.enum";
import { RepoMemoryFile } from "../enums/repo-memory-file.enum";

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
TS

cat > cortex/default-brain/default-brain.json <<'JSON'
{
  "identity": "Technology-agnostic senior full-stack developer focused on simplicity, maintainability, clean architecture, and practical design.",
  "principles": [
    {
      "id": "kiss",
      "name": "KISS",
      "rule": "Prefer the simplest design that solves the actual problem."
    },
    {
      "id": "dry",
      "name": "DRY",
      "rule": "Avoid duplicated knowledge, not merely duplicated text."
    },
    {
      "id": "single_responsibility",
      "name": "Single Responsibility Principle",
      "rule": "A file, class, function, or module should have one clear reason to change.",
      "violationEnum": "BREAKS_SINGLE_RESPONSIBILITY"
    },
    {
      "id": "clean_architecture",
      "name": "Clean Architecture",
      "rule": "Keep business logic independent from frameworks where practical."
    },
    {
      "id": "visible_failures",
      "name": "Failure Visibility",
      "rule": "Failures should be visible unless intentionally suppressed with evidence."
    },
    {
      "id": "type_safety",
      "name": "Type Safety",
      "rule": "Do not bypass safety systems unless at a clear boundary with validation."
    },
    {
      "id": "low_noise",
      "name": "Low Noise",
      "rule": "Code should reduce understanding cost."
    }
  ],
  "workUnits": [
    {
      "id": "UNDERSTAND_REPO",
      "goal": "Build a clear model of repository purpose, structure, and main flows."
    },
    {
      "id": "MAP_PATTERN_TO_STACK",
      "goal": "Choose the right architecture layer before applying a pattern."
    },
    {
      "id": "MAP_PATTERN_TO_REPOSITORY",
      "goal": "Choose the right repository area before writing a pattern implementation."
    },
    {
      "id": "APPLY_PATTERN",
      "goal": "Apply only the minimum pattern needed to solve the current problem."
    },
    {
      "id": "AVOID_ANTI_PATTERN",
      "goal": "Detect and avoid anti-patterns that increase coupling, complexity, or fragility."
    }
  ],
  "patterns": [
    {
      "id": "factory",
      "useWhen": ["creation varies by config", "provider differs", "task type differs"],
      "stackLayers": ["application", "infrastructure"],
      "repositoryAreas": ["cortex/organs", "cortex/workflows", "cortex/writers"],
      "recommendedWorkUnits": ["CLASSIFY_FILE", "MAP_PATTERN_TO_STACK", "MAP_PATTERN_TO_REPOSITORY", "APPLY_PATTERN"],
      "antiPatternsToAvoid": ["god_factory", "switch_factory_sprawl", "hidden_dependency_resolution"]
    },
    {
      "id": "adapter",
      "useWhen": ["external APIs differ", "technology-specific implementations need a common interface"],
      "stackLayers": ["infrastructure", "integration_boundary"],
      "repositoryAreas": ["cortex/organs", "cortex/context"],
      "recommendedWorkUnits": ["DETECT_STRUCTURE", "MAP_PATTERN_TO_STACK", "MAP_PATTERN_TO_REPOSITORY", "APPLY_PATTERN"],
      "antiPatternsToAvoid": ["leaky_adapter", "double_abstraction", "framework_lock_in"]
    },
    {
      "id": "strategy",
      "useWhen": ["same task has multiple algorithms"],
      "stackLayers": ["domain", "application"],
      "repositoryAreas": ["cortex/workflows", "cortex/organs"],
      "recommendedWorkUnits": ["CLASSIFY_FILE", "DETECT_NOISE", "MAP_PATTERN_TO_STACK", "APPLY_PATTERN"],
      "antiPatternsToAvoid": ["speculative_strategy", "strategy_for_single_case", "configuration_explosion"]
    },
    {
      "id": "observer",
      "useWhen": ["state changes should notify other systems"],
      "stackLayers": ["application", "integration"],
      "repositoryAreas": ["cortex/events", "cortex/workflows", "cortex/organs"],
      "recommendedWorkUnits": ["DETECT_STRUCTURE", "DETECT_SMELLS", "MAP_PATTERN_TO_REPOSITORY", "APPLY_PATTERN"],
      "antiPatternsToAvoid": ["event_storm_without_need", "hidden_side_effects", "observer_cycle"]
    }
  ],
  "antiPatternAvoidance": [
    {
      "id": "god_factory",
      "description": "A single factory that knows too many unrelated construction rules.",
      "signals": ["factory grows with every feature", "large switch by type", "frequent unrelated edits"],
      "avoidBy": ["split by bounded context", "delegate provider-specific creation", "use composition over branching"]
    },
    {
      "id": "switch_factory_sprawl",
      "description": "Factory behavior controlled by deeply nested conditionals.",
      "signals": ["nested if/switch creation logic", "feature flags scattered inside constructors"],
      "avoidBy": ["extract creator map", "register creators by key", "validate config early"]
    },
    {
      "id": "hidden_dependency_resolution",
      "description": "Factory reaches into globals or service locators to resolve dependencies.",
      "signals": ["implicit global state", "runtime lookup without contracts"],
      "avoidBy": ["pass dependencies explicitly", "declare interfaces", "keep wiring at composition root"]
    },
    {
      "id": "leaky_adapter",
      "description": "Adapter exposes vendor-specific shapes into core logic.",
      "signals": ["vendor types in domain code", "feature code depends on SDK semantics"],
      "avoidBy": ["translate to internal contracts", "map errors at boundary", "keep SDK objects local to adapter"]
    },
    {
      "id": "double_abstraction",
      "description": "Adapter layers wrap each other without adding clear value.",
      "signals": ["wrapper over wrapper", "pass-through methods with no policy"],
      "avoidBy": ["remove redundant layers", "keep one explicit boundary interface"]
    },
    {
      "id": "framework_lock_in",
      "description": "Core behavior tied directly to framework APIs.",
      "signals": ["framework classes in business logic", "cannot test logic without framework runtime"],
      "avoidBy": ["isolate framework calls", "use ports and adapters", "keep domain pure"]
    },
    {
      "id": "speculative_strategy",
      "description": "Strategy introduced before there are real alternative algorithms.",
      "signals": ["single implementation with interface ceremony", "no present roadmap for alternatives"],
      "avoidBy": ["start concrete first", "introduce strategy when second real variant appears"]
    },
    {
      "id": "strategy_for_single_case",
      "description": "Strategy pattern kept despite only one stable path.",
      "signals": ["unused strategy subclasses", "conditional strategy wiring always selects one"],
      "avoidBy": ["collapse back to direct implementation", "keep extension point only where needed"]
    },
    {
      "id": "configuration_explosion",
      "description": "Strategy selection controlled by too many unvalidated options.",
      "signals": ["many flags alter behavior", "difficult to reason about active algorithm"],
      "avoidBy": ["reduce config surface", "validate mutually exclusive options", "prefer explicit strategy keys"]
    },
    {
      "id": "event_storm_without_need",
      "description": "Observer/event model introduced for simple direct flows.",
      "signals": ["events for purely local synchronous updates", "hard-to-trace call flow"],
      "avoidBy": ["keep direct call when coupling is acceptable", "promote events only for real decoupling needs"]
    },
    {
      "id": "hidden_side_effects",
      "description": "Observers trigger side effects not visible at publish site.",
      "signals": ["publish call appears harmless but mutates many systems", "surprise behavior in handlers"],
      "avoidBy": ["document event contract", "name events by business intent", "keep handlers focused and observable"]
    },
    {
      "id": "observer_cycle",
      "description": "Event handlers emit events that recursively trigger each other.",
      "signals": ["reentrant publish loops", "duplicate cascaded events"],
      "avoidBy": ["add idempotency guards", "separate command vs event channels", "use cycle-safe policies"]
    }
  ]
}
JSON

cat > BRAIN.md <<'MD'
# BRAIN.md

> The Brain starts with default senior engineering knowledge, then learns from EYES, NOSE, EARS, and HANDS.

## Legend

- DEFAULT_KNOWLEDGE: Known before scanning.
- LEARNED_KNOWLEDGE: Learned from the repo.
- SMELL_KNOWLEDGE: Learned from NOSE.
- NOISE_KNOWLEDGE: Learned from EARS.
- WORK_CONTEXT: Learned from HANDS.
- DOC_CONTEXT: Fetched from official technology documentation.
- RISK: Needs attention.

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

Flag as `BREAKS_SINGLE_RESPONSIBILITY` when one unit handles multiple unrelated jobs.

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
MD

cat > EYES.md <<'MD'
# EYES.md

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

## Risky Evidence Observed
MD

cat > NOSE.md <<'MD'
# NOSE.md

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
MD

cat > EARS.md <<'MD'
# EARS.md

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
MD

cat > HANDS.md <<'MD'
# HANDS.md

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
MD

cat > .cortex/context.json <<'JSON'
{
  "repoPath": ".",
  "eyes": [],
  "nose": [],
  "ears": [],
  "hands": [],
  "brain": [],
  "activeContext": {
    "activeGoal": "understand_repo",
    "activeWorkflow": "first_pass",
    "tokenBudget": {
      "maxTokens": 120000,
      "handoffAtPercent": 80,
      "totalUsed": 0,
      "percentUsed": 0
    },
    "tokenUsageByModel": {},
    "progress": {
      "totalDirectories": 0,
      "scannedDirectories": 0,
      "totalFiles": 0,
      "scannedFiles": 0,
      "percentComplete": 0
    }
  },
  "learned": {
    "technologies": [],
    "routes": [],
    "integrations": [],
    "risks": [],
    "smells": [],
    "noise": [],
    "simplifications": []
  }
}
JSON

cp cortex/default-brain/default-brain.json .cortex/default-brain.json
touch .cortex/events.jsonl
echo "{}" > .cortex/token-usage.json
echo "{}" > .cortex/graph.json

echo "Cortex body initialized."
echo "Created: BRAIN.md EYES.md NOSE.md EARS.md HANDS.md"
echo "Created: .cortex/context.json .cortex/default-brain.json .cortex/events.jsonl .cortex/token-usage.json .cortex/graph.json"
