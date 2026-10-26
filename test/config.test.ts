import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parseRulesSource,
  readRulesFile,
  resolveRulesPath,
} from '../src/config';

const tempRoots: string[] = [];

function createDirectory(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'driftgraph-test-'));
  tempRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  return root;
}

const validYaml = (name: string): string => [
  `- name: ${name}`,
  '  source: "src/**/*"',
  '  forbiddenImports:',
  '    - "lib/**/*"',
  '',
].join('\n');

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('parseRulesSource', () => {
  it('accepts base and head case-insensitively', () => {
    expect(parseRulesSource('base')).toBe('base');
    expect(parseRulesSource(' HEAD ')).toBe('head');
  });

  it('rejects unsupported values', () => {
    expect(() => parseRulesSource('merge-base')).toThrow(/rules-source/i);
  });
});

describe('resolveRulesPath', () => {
  it('uses base rules when they exist', () => {
    const baseDir = createDirectory({ '.driftgraph.yml': validYaml('Base rule') });
    const headDir = createDirectory({ '.driftgraph.yml': validYaml('Head rule') });

    const resolved = resolveRulesPath({
      baseDir,
      headDir,
      rulesFile: '.driftgraph.yml',
      rulesSource: 'base',
    });

    expect(resolved.path).toBe(path.join(baseDir, '.driftgraph.yml'));
    expect(resolved.usedHeadFallback).toBe(false);
    expect(resolved.exists).toBe(true);
    expect(readRulesFile(resolved.path)[0].name).toBe('Base rule');
  });

  it('falls back to head rules when base rules do not exist', () => {
    const baseDir = createDirectory();
    const headDir = createDirectory({ '.driftgraph.yml': validYaml('Head rule') });

    const resolved = resolveRulesPath({
      baseDir,
      headDir,
      rulesFile: '.driftgraph.yml',
      rulesSource: 'base',
    });

    expect(resolved.path).toBe(path.join(headDir, '.driftgraph.yml'));
    expect(resolved.usedHeadFallback).toBe(true);
    expect(resolved.exists).toBe(true);
  });

  it('uses head rules when explicitly requested', () => {
    const baseDir = createDirectory({ '.driftgraph.yml': validYaml('Base rule') });
    const headDir = createDirectory({ '.driftgraph.yml': validYaml('Head rule') });

    const resolved = resolveRulesPath({
      baseDir,
      headDir,
      rulesFile: '.driftgraph.yml',
      rulesSource: 'head',
    });

    expect(resolved.path).toBe(path.join(headDir, '.driftgraph.yml'));
    expect(resolved.usedHeadFallback).toBe(false);
  });

  it('reports missing rules without throwing', () => {
    const baseDir = createDirectory();
    const headDir = createDirectory();

    const resolved = resolveRulesPath({
      baseDir,
      headDir,
      rulesFile: '.driftgraph.yml',
      rulesSource: 'base',
    });

    expect(resolved.exists).toBe(false);
    expect(readRulesFile(resolved.path)).toEqual([]);
  });

  it('rejects rules paths outside the repository', () => {
    const baseDir = createDirectory();
    const headDir = createDirectory();

    expect(() => resolveRulesPath({
      baseDir,
      headDir,
      rulesFile: '../rules.yml',
      rulesSource: 'base',
    })).toThrow(/inside the repository/i);
  });
});

describe('readRulesFile', () => {
  it('reads JSON rules', () => {
    const root = createDirectory({
      'rules.json': JSON.stringify([
        {
          name: 'JSON rule',
          source: 'src/**/*',
          forbiddenImports: ['lib/**/*'],
        },
      ]),
    });

    expect(readRulesFile(path.join(root, 'rules.json'))).toEqual([
      {
        name: 'JSON rule',
        source: 'src/**/*',
        forbiddenImports: ['lib/**/*'],
      },
    ]);
  });

  it('rejects invalid rule shapes with the file path', () => {
    const root = createDirectory({
      '.driftgraph.yml': '- name: Missing source\n  forbiddenImports: ["lib/**/*"]\n',
    });

    expect(() => readRulesFile(path.join(root, '.driftgraph.yml'))).toThrow(/source/i);
    expect(() => readRulesFile(path.join(root, '.driftgraph.yml'))).toThrow(/driftgraph\.yml/i);
  });
});
