import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { scanArchitecture } from '../src/scanner';

const tempRoots: string[] = [];

function createProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'driftgraph-test-'));
  tempRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('scanArchitecture', () => {
  it('builds nodes and edges for internal imports and re-exports', () => {
    const root = createProject({
      'src/a.ts': "import { b } from './b';\nexport { c } from './c';\nexport const a = b;\n",
      'src/b.ts': 'export const b = 1;\n',
      'src/c.ts': 'export const c = 2;\n',
    });

    const graph = scanArchitecture(root);

    expect(graph.nodes.map(node => node.id)).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(graph.edges).toEqual([
      { source: 'src/a.ts', target: 'src/b.ts' },
      { source: 'src/a.ts', target: 'src/c.ts' },
    ]);
  });

  it('ignores generated directories and external packages', () => {
    const root = createProject({
      'src/a.ts': [
        "import external from 'external-package';",
        "import { generated } from '../dist/generated';",
        "import { b } from './b';",
        'export const value = external + generated + b;',
        '',
      ].join('\n'),
      'src/b.ts': 'export const b = 1;\n',
      'dist/generated.ts': 'export const generated = 1;\n',
      'build/generated.ts': 'export const generated = 2;\n',
      'coverage/report.ts': 'export const report = 1;\n',
      'node_modules/external-package/package.json': JSON.stringify({
        name: 'external-package',
        version: '1.0.0',
        types: 'index.d.ts',
      }),
      'node_modules/external-package/index.d.ts': 'declare const external: number;\nexport default external;\n',
    });

    const graph = scanArchitecture(root);

    expect(graph.nodes.map(node => node.id)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(graph.edges).toEqual([{ source: 'src/a.ts', target: 'src/b.ts' }]);
  });

  it('resolves path aliases from tsconfig without scanning node_modules', () => {
    const root = createProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@app/*': ['src/*'],
          },
        },
      }),
      'src/a.ts': "import { b } from '@app/b';\nexport const a = b;\n",
      'src/b.ts': 'export const b = 1;\n',
    });

    const graph = scanArchitecture(root, path.join(root, 'tsconfig.json'));

    expect(graph.nodes.map(node => node.id)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(graph.edges).toEqual([{ source: 'src/a.ts', target: 'src/b.ts' }]);
  });

  it('does not include imports that resolve outside the scanned root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'driftgraph-test-'));
    tempRoots.push(root);

    const outsideName = `outside-${path.basename(root)}.ts`;
    const outsidePath = path.join(path.dirname(root), outsideName);
    fs.writeFileSync(outsidePath, 'export const outside = 1;\n', 'utf8');

    try {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'src', 'a.ts'),
        `import { outside } from '../../${outsideName}';\nexport const a = outside;\n`,
        'utf8',
      );

      const graph = scanArchitecture(root);

      expect(graph.nodes.map(node => node.id)).toEqual(['src/a.ts']);
      expect(graph.edges).toEqual([]);
    } finally {
      fs.rmSync(outsidePath, { force: true });
    }
  });
});
