# Distribution Plan

This document describes how `@monzingo89/engineer-maxxing` is distributed and versioned.

## Goals

- Keep releases predictable and easy to consume.
- Ensure package quality before publish.
- Provide clear upgrade guidance for users.

## Distribution Channels

### npm (primary)

- Package: `@monzingo89/engineer-maxxing`
- Usage: `npx @monzingo89/engineer-maxxing`
- Access: public scoped package

### GitHub Releases (secondary)

- Repository: `https://github.com/Monzingo89/engineer-maxxing`
- Semver tags (e.g., `v1.0.1`) are used for release tracking.
- Release notes summarize feature additions, fixes, and migration notes.

## Release Cadence

- `patch` releases for bug fixes and quality improvements.
- `minor` releases for backward-compatible features.
- `major` releases for breaking changes.

## Release Process

1. Ensure branch is up to date and CI is green.
2. Run local checks:
   - `npm run verify:publish`
3. Bump version:
   - `npm run release:patch` or `npm run release:minor`
4. Push commits and tags:
   - `git push origin main --follow-tags`
5. Publish package:
   - `npm publish --access public`
6. Create/update GitHub Release notes for the version tag.

## Quality Gates

- Type check: `npm run lint`
- Build: `npm run build`
- Tests: `npm run test:dist`
- Packaging dry-run: `npm pack --dry-run`

## Rollback / Mitigation

- If a release is broken, publish a follow-up patch as soon as possible.
- Mark problematic release clearly in GitHub Releases and changelog.
- Avoid force-changing published versions; always release a new semver version.
