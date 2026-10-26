# Driftgraph

![Works with GitHub](https://img.shields.io/badge/Works%20with-GitHub-100000?style=for-the-badge&logo=github&logoColor=white)

Driftgraph is a GitHub Action that visualizes architecture changes and enforces dependency boundaries on Pull Requests. It scans TypeScript/JavaScript files, compares the PR against its base branch, and posts a Mermaid.js diagram directly into the PR. If an import violates your rules, the edge is highlighted and the check fails.

Driftgraph is deterministic: no AI/LLM, no external services, and no code execution. All analysis happens locally inside the GitHub Actions runner.

## Usage

### 1. Add the workflow

Create `.github/workflows/driftgraph.yml`:

```yaml
name: "Architecture Check"

on:
  pull_request:
    branches:
      - main
      - master

jobs:
  analyze:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - name: Run Driftgraph
        uses: denislistiadi/driftgraph@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

`fetch-depth: 0` is recommended so Driftgraph can fetch the exact base commit of the PR.

### 2. Configure architecture rules

Create `.driftgraph.yml` in the repository root:

```yaml
- name: "Domain Logic Isolation"
  source: "src/domain/**/*"
  forbiddenImports:
    - "src/ui/**/*"
    - "src/infrastructure/**/*"

- name: "UI Cannot Access Infrastructure"
  source: "src/ui/**/*"
  forbiddenImports:
    - "src/infrastructure/**/*"
```

If the rules file is missing, Driftgraph still works as a visualizer.

By default, rules are read from the **base branch**. This prevents a pull request from weakening the rules that gate it. If the rules file does not exist on the base branch, Driftgraph falls back to the PR head and emits a warning. Set `rules-source: head` if you intentionally want to use rules from the PR branch.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | Yes | - | Token for reading the PR and posting comments. |
| `rules-file` | No | `.driftgraph.yml` | Rules file path relative to the repository root. |
| `rules-source` | No | `base` | Read rules from `base` or `head`. |

## Behavior and limitations

- Imports and re-exports between files are analyzed. Dynamic `import()`, `require()`, and monorepo-wide tsconfig references are not yet supported.
- Generated directories are ignored by default: `node_modules`, `dist`, `build`, `out`, `coverage`, `.next`, `.turbo`, `vendor`, and `.git`.
- If the base snapshot cannot be prepared, the check fails instead of rendering a misleading diagram.
- On pull requests from forks, the default `GITHUB_TOKEN` is read-only. Driftgraph cannot post a comment, but it still emits architecture violations as workflow annotations and fails the check when rules are violated.
- Full monorepo/workspace support and a local CLI are planned for later releases.
- Self-hosted runners must support Node.js 24 actions (Actions runner `v2.327.1` or newer).

## Troubleshooting

**The comment is not created on a fork PR.**
This is expected. Forks receive a read-only token. Check the workflow annotations instead.

**The base snapshot fails.**
Make sure the workflow uses `actions/checkout` with `fetch-depth: 0`, and that the runner can run `git fetch` against the repository.

**No rules are enforced.**
Check that `.driftgraph.yml` exists on the base branch, `rules-source` is correct, and the file contains an array of rules. Invalid rules fail the action with a descriptive error.

**A generated file appears in the diagram.**
Keep generated output outside the scanned source tree, or open an issue to request an additional default ignore directory. Current defaults exclude the most common build directories.

## Development

```bash
npm ci
npm run typecheck
npm run typecheck:test
npm test
npm run build
```

The action bundle is committed at `dist/index.js`; rebuild it before publishing a release.

## License

ISC. See [LICENSE](LICENSE).
