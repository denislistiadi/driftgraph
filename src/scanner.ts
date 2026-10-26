import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';
import { minimatch } from 'minimatch';

export interface GraphNode {
  id: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/vendor/**',
];

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * Normalizes a file path to use forward slashes and removes the base directory prefix.
 */
function normalizePath(filePath: string, baseDir: string): string {
  return toPosix(path.relative(baseDir, filePath));
}

function isOutsideRelativePath(relativePath: string): boolean {
  return relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath);
}

function getRelativePath(filePath: string, rootDir: string): string | undefined {
  const relativePath = path.relative(rootDir, filePath);

  if (relativePath.length === 0 || isOutsideRelativePath(relativePath)) {
    return undefined;
  }

  return toPosix(relativePath);
}

function isIgnoredRelativePath(relativePath: string): boolean {
  return DEFAULT_IGNORES.some(pattern => minimatch(relativePath, pattern, { dot: true }));
}

function isPathIncluded(filePath: string, rootDir: string): boolean {
  const relativePath = getRelativePath(filePath, rootDir);
  return relativePath !== undefined && !isIgnoredRelativePath(relativePath);
}

/**
 * Scans a directory and builds a dependency graph of the TypeScript/JavaScript files.
 * @param targetDir The directory to scan (e.g., the checked out branch)
 * @param tsconfigPath Optional path to a tsconfig.json file for path alias resolution
 */
export function scanArchitecture(targetDir: string, tsconfigPath?: string): Graph {
  const targetRoot = path.resolve(targetDir);
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      resolveJsonModule: true,
    },
    ...(tsconfigPath && fs.existsSync(tsconfigPath)
      ? { tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: true }
      : {}),
  });

  const files = fg.sync('**/*.{ts,tsx,js,jsx}', {
    cwd: targetRoot,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
    ignore: DEFAULT_IGNORES,
  });

  for (const filePath of files) {
    const absolutePath = path.resolve(filePath);
    if (isPathIncluded(absolutePath, targetRoot)) {
      project.addSourceFileAtPath(absolutePath);
    }
  }

  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  const addNode = (id: string): void => {
    if (!nodes.has(id)) {
      nodes.set(id, { id });
    }
  };

  const addEdge = (source: string, target: string): void => {
    const key = `${source}::${target}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({ source, target });
    }
  };

  for (const sourceFile of project.getSourceFiles()) {
    const sourceFilePath = sourceFile.getFilePath();
    if (!isPathIncluded(sourceFilePath, targetRoot)) {
      continue;
    }

    const sourceId = normalizePath(sourceFilePath, targetRoot);
    addNode(sourceId);

    for (const importDecl of sourceFile.getImportDeclarations()) {
      const importedSourceFile = importDecl.getModuleSpecifierSourceFile();

      if (importedSourceFile && isPathIncluded(importedSourceFile.getFilePath(), targetRoot)) {
        const targetId = normalizePath(importedSourceFile.getFilePath(), targetRoot);
        addNode(targetId);
        addEdge(sourceId, targetId);
      }
    }

    for (const exportDecl of sourceFile.getExportDeclarations()) {
      if (!exportDecl.hasModuleSpecifier()) {
        continue;
      }

      const exportedSourceFile = exportDecl.getModuleSpecifierSourceFile();
      if (exportedSourceFile && isPathIncluded(exportedSourceFile.getFilePath(), targetRoot)) {
        const targetId = normalizePath(exportedSourceFile.getFilePath(), targetRoot);
        addNode(targetId);
        addEdge(sourceId, targetId);
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()).sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
  };
}
