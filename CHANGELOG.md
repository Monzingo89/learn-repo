# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/).

## [1.0.1] - Unreleased

### Added
- CLI options for path selection, file size limits, include/exclude controls, and output modes (`--quiet`, `--verbose`, `--json-summary`).
- Realtime token usage visibility during scans, including cumulative token budget usage per model.
- Automatic technology detection with official documentation links written into repo memory context.
- High-level architecture and data-layer Brain snapshot (frontend, frontend->backend, backend, backend->database, caching, SignalR/realtime).
- Database-agnostic default Brain posture until concrete database technology evidence is detected.
- Distribution planning document at `docs/distribution-plan.md`.
- Automated test coverage for model selection, token tracker behavior, and technology docs detection.
- Release helper scripts: `release:patch` and `release:minor`.

### Changed
- Scan ordering is now deterministic (sorted traversal/results).
- Publish verification now includes tests before packaging dry-run.

## [1.0.0] - 2026-05-16

### Added
- First public npm release: `@monzingo89/engineer-maxxing`.
- CLI usage via `npx @monzingo89/engineer-maxxing`.
- Core Cortex scanner structure under `cortex/`:
  - workflows, prompts, models, token tracking, events, and writers.
- Repository memory/organ markdown files (`BRAIN.md`, `EYES.md`, `EARS.md`, `NOSE.md`, `HANDS.md`).
- Packaging and publish verification scripts (`verify:publish`, `prepublishOnly`).
- Open-source project documentation (`README.md`) and licensing (`MIT`).

[1.0.0]: https://github.com/Monzingo89/engineer-maxxing/releases/tag/v1.0.0
