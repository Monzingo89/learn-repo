# @monzingo89/engineer-maxxing

Code-agnostic repository scanner that builds and updates a lightweight "cortex" memory of your codebase.

## What it does

When you run the CLI, it performs a learn pass over your repository and:

- scans source/config/docs files
- tracks progress and token usage
- records observations/events into organ-style memory files
- updates local Cortex context data for future passes

It is designed to be simple, inspectable, and easy to extend.

## Quick start

Run from any repository root:

```bash
npx @monzingo89/engineer-maxxing
```

Show options:

```bash
npx @monzingo89/engineer-maxxing --help
```

## CLI options

- `--path <repoPath>`: explicit repository path.
- `--max-file-bytes <bytes>`: max bytes from each file sent to prompts (default: `20000`).
- `--include-ext ".toml,.env"`: additional file extensions to include in scans.
- `--exclude-dir "tmp,artifacts"`: additional directory names to exclude.
- `--quiet`: suppress per-file output.
- `--verbose`: print detailed per-file token usage logs.
- `--json-summary`: print a final JSON summary (auto-enables quiet mode unless `--verbose` is set).

## Realtime token awareness

During scans, the CLI shows model token usage in realtime, including cumulative total and percent of model budget used. This helps make handoff timing and model usage visible while the run is happening.

## Technology detection and documentation links

When technologies are detected (for example TypeScript, Node.js, GitHub Actions, Python), the tool records documentation links in repo memory outputs so users can quickly jump to official docs.

- Technology observations are written into `EYES.md`.
- Documentation context is appended to `BRAIN.md`.

## High-level architecture and data-layer snapshot

As files/directories are scanned, the Brain captures a high-level architecture map covering:

- frontend code makeup
- frontend code that talks to backend
- backend code
- backend code that talks to database
- caching evidence
- SignalR/realtime evidence

The Brain starts **database-agnostic** by default and only records concrete database technologies when evidence is detected.

## What gets updated

The tool writes/updates these files in the target repo:

- `EYES.md`
- `HANDS.md`
- `BRAIN.md`
- `.cortex/context.json`
- `.cortex/token-usage.json`

## Production usage notes

- The tool writes to repository-local memory files and `.cortex` state files.
- Run it from the target repo root to keep outputs scoped correctly.
- If you want machine-readable output for automation, use `--json-summary`.

## CLI command name

After global install (or in npm script contexts), the binary command name is:

```bash
engineer-maxxing
```

## Distribution plan

Distribution process and release channels are documented in [`docs/distribution-plan.md`](./docs/distribution-plan.md).

## Development

From this project:

```bash
npm run dev
npm run lint
npm run build
npm run test
npm run verify:publish
npm run release:patch
npm run release:minor
```

## Package publishing notes

This package is configured for public scoped publishing:

- package name: `@monzingo89/engineer-maxxing`
- access: `public`
- binary entry: `dist/cortex/cli/learn.js`

## Troubleshooting

- **npm publish 403 (2FA/token policy)**:
	use a valid npm token with package write permission and bypass 2FA for publish (or publish with OTP when required).
- **Noisy output in CI**:
	run with `--json-summary` (and optionally without `--verbose`).
- **Unexpected scan scope**:
	use `--path`, `--include-ext`, and `--exclude-dir` to tune inputs.

## License

MIT — see [LICENSE](./LICENSE).
