import { describe, expect, it } from 'vitest';
import { diffGraphs } from '../src/differ';
import { Graph } from '../src/scanner';

const base: Graph = {
  nodes: [{ id: 'src/a.ts' }, { id: 'src/removed.ts' }],
  edges: [
    { source: 'src/a.ts', target: 'src/removed.ts' },
  ],
};

const head: Graph = {
  nodes: [{ id: 'src/a.ts' }, { id: 'src/added.ts' }],
  edges: [
    { source: 'src/a.ts', target: 'src/added.ts' },
  ],
};

describe('diffGraphs', () => {
  it('marks added, removed, and unchanged nodes and edges', () => {
    const diff = diffGraphs(base, head);

    expect(diff.nodes).toEqual([
      { id: 'src/a.ts', status: 'unchanged' },
      { id: 'src/added.ts', status: 'added' },
      { id: 'src/removed.ts', status: 'removed' },
    ]);
    expect(diff.edges).toEqual([
      { source: 'src/a.ts', target: 'src/added.ts', status: 'added' },
      { source: 'src/a.ts', target: 'src/removed.ts', status: 'removed' },
    ]);
  });

  it('marks violating edges', () => {
    const diff = diffGraphs(base, head, [
      {
        ruleName: 'No UI imports',
        edge: { source: 'src/a.ts', target: 'src/added.ts' },
      },
    ]);

    expect(diff.edges[0]).toEqual({
      source: 'src/a.ts',
      target: 'src/added.ts',
      status: 'added',
      isViolation: true,
      violatedRules: ['No UI imports'],
    });
  });
});
