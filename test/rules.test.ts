import { describe, expect, it } from 'vitest';
import { evaluateRules, validateRules } from '../src/rules';
import { Graph } from '../src/scanner';

const graph: Graph = {
  nodes: [
    { id: 'src/domain/order.ts' },
    { id: 'src/ui/checkout.ts' },
    { id: 'src/infrastructure/db.ts' },
  ],
  edges: [
    { source: 'src/domain/order.ts', target: 'src/ui/checkout.ts' },
    { source: 'src/domain/order.ts', target: 'src/infrastructure/db.ts' },
    { source: 'src/ui/checkout.ts', target: 'src/domain/order.ts' },
  ],
};

describe('validateRules', () => {
  it('normalizes valid rules', () => {
    expect(validateRules([
      {
        name: ' Domain isolation ',
        source: ' src/domain/**/* ',
        forbiddenImports: [' src/ui/**/* ', ' src/infrastructure/**/* '],
      },
    ])).toEqual([
      {
        name: 'Domain isolation',
        source: 'src/domain/**/*',
        forbiddenImports: ['src/ui/**/*', 'src/infrastructure/**/*'],
      },
    ]);
  });

  it('treats empty files as no rules', () => {
    expect(validateRules(null)).toEqual([]);
    expect(validateRules([])).toEqual([]);
  });

  it('rejects rules that are not an array', () => {
    expect(() => validateRules({ name: 'invalid' })).toThrow(/array/i);
  });

  it('rejects rules without a name', () => {
    expect(() => validateRules([
      { source: 'src/**/*', forbiddenImports: ['lib/**/*'] },
    ])).toThrow(/name/i);
  });

  it('rejects rules without forbidden imports', () => {
    expect(() => validateRules([
      { name: 'Invalid', source: 'src/**/*', forbiddenImports: [] },
    ])).toThrow(/forbiddenImports/i);
  });
});

describe('evaluateRules', () => {
  it('returns matches for forbidden dependencies', () => {
    const violations = evaluateRules(graph, [
      {
        name: 'Domain isolation',
        source: 'src/domain/**/*',
        forbiddenImports: ['src/ui/**/*', 'src/infrastructure/**/*'],
      },
    ]);

    expect(violations).toEqual([
      {
        ruleName: 'Domain isolation',
        edge: { source: 'src/domain/order.ts', target: 'src/ui/checkout.ts' },
      },
      {
        ruleName: 'Domain isolation',
        edge: { source: 'src/domain/order.ts', target: 'src/infrastructure/db.ts' },
      },
    ]);
  });
});
