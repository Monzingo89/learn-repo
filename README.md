# @monzingo89/engineer-maxxing

Lightweight repo-learning scanner that builds a persistent anatomy context.

## Quick start

Run in a repo root:

```bash
npx @monzingo89/engineer-maxxing
```

Start fresh (reset anatomy + local state first):

```bash
npx @monzingo89/engineer-maxxing --fresh
```

## What it creates

The scanner writes to:

- `anatomy/BRAIN.md`
- `anatomy/EYES.md`
- `anatomy/EARS.md`
- `anatomy/NOSE.md`
- `anatomy/HANDS.md`
- `anatomy/SOUL.md`
- `anatomy/HEART.md`
- `.cortex/context.json`
- `.cortex/token-usage.json`

### Anatomy behavior

- `BRAIN.md` is pre-seeded with code-agnostic engineering principles.
- `EYES`, `EARS`, `NOSE`, `HANDS`, `SOUL`, `HEART` start empty (header only).
- Initial scan populates observations and dependency audit (`SOUL`).
- `HEART` is reserved for feature planning and is not populated by the initial scan.

## Core capabilities

- Real-time token usage and model handoff at threshold.
- Resume-aware learning using persistent `.cortex/context.json`.
- Container signal detection (Docker, Compose, AKS, ACA, Kubernetes).
- Technology detection with docs links.
- Architecture summary + pattern inference (DDD/multi-tenant/identity/database).
- Symbol inventory and dead-code candidate detection.
- Dependency health audit and unused dependency identification.

## CLI options

- `--path <repoPath>`: explicit repository path.
- `--fresh`: reset anatomy and local cortex state before scanning.
- `--max-file-bytes <bytes>`: file bytes sent to prompts (default: `20000`).
- `--include-ext ".toml,.env"`: add extensions to scan.
- `--exclude-dir "tmp,artifacts"`: add directories to skip.
- `--repo-models "Codex,ChatGPT,Gemini"`: declare repo authorship models.
- `--quiet`: minimal output.
- `--verbose`: detailed per-file output.
- `--json-summary`: machine-readable summary.

## Development

```bash
npm run build
npm run test
```

## License

MIT — see [LICENSE](./LICENSE).
