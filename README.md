# @monzingo89/learn-repo

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
npx @monzingo89/learn-repo
```

## What gets updated

The tool writes/updates these files in the target repo:

- `EYES.md`
- `HANDS.md`
- `BRAIN.md`
- `.cortex/context.json`
- `.cortex/token-usage.json`

## CLI command name

After global install (or in npm script contexts), the binary command name is:

```bash
learn-repo
```

## Development

From this project:

```bash
npm run dev
npm run lint
npm run build
npm run verify:publish
```

## Package publishing notes

This package is configured for public scoped publishing:

- package name: `@monzingo89/learn-repo`
- access: `public`
- binary entry: `dist/cortex/cli/learn.js`

## License

MIT — see [LICENSE](./LICENSE).
