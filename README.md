# Driftgraph

Driftgraph is a custom GitHub Action that automatically visualizes architecture changes and enforces boundary rules on your Pull Requests. It reads your codebase and posts a Mermaid.js diagram directly into the PR comment.

## How to Use

To integrate Driftgraph into your repository, follow these two simple steps:

### 1. Add the GitHub Action Workflow

Create a new file in your repository at `.github/workflows/driftgraph.yml` with the following content:

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
    
    # Required permissions to post comments on the PR
    permissions:
      pull-requests: write
      contents: read

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Important: Required to fetch the base branch for comparison

      - name: Run Driftgraph
        uses: denislistiadi/driftgraph@v1.0.0 # Replace with your published repository and version
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Configure Architecture Rules (Optional but Recommended)

You can define rules to prevent certain layers of your application from importing others (e.g., UI cannot import Database directly). 

Create a `.driftgraph.yml` file in the root of your repository. If an import violates these rules, the GitHub Action will fail and the violating path will be highlighted in **red** in the PR diagram.

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

If you do not create this file, Driftgraph will still work perfectly as a pure architecture visualizer without the gatekeeping feature.
