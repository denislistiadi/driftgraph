# Changelog

## 1.0.3

### Fixed

- Migrated the JavaScript action runtime from Node.js 20 to Node.js 24.
- Made the base branch worktree portable by using the runner temp directory, detaching the worktree, and cleaning it up after every run.
- Architecture rules are now read from the base branch by default, preventing a PR from weakening its own gate. If the base rules file is missing, Driftgraph falls back to the head file with a warning. Use `rules-source: head` to opt out.
- Base snapshot failures now fail the check instead of rendering an empty baseline as if every file was added.
- Generated directories such as `node_modules`, `dist`, `build`, and `coverage` are ignored during scanning.
- Imports that resolve to external packages or outside the repository are no longer included in the graph.
- PR comments are paginated and identified with a hidden marker, preventing duplicate Driftgraph comments on busy PRs.
- Comment creation/update failures no longer crash the action. Fork PRs fall back to workflow annotations.
- Fixed the generated comment footer URL.

### Added

- `rules-source` input.
- Rules file validation with descriptive errors.
- Workflow annotations for architecture violations.
- Vitest test suite and CI on Linux and Windows.
- `rules-file` default value and documentation.

### Changed

- Node.js 24 is now required for the action runtime and self-hosted runners.
- The action bundle is verified against `src/` in CI.

### Security

- Upgraded Vitest to 5.0.5 and added npm overrides for `@actions/http-client` 3.0.2 and `undici` 6.29.1.
- `npm audit` now reports zero known vulnerabilities.

## 1.0.2

- Fixed Mermaid link styles for GitHub rendering.

## 1.0.1

- Added Marketplace branding and documentation.

## 1.0.0

- Initial release: AST scanning, graph diffing, Mermaid diagrams, and architecture rules.
