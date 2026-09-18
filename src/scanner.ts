import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

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

/**
 * Normalizes a file path to use forward slashes and removes the base directory prefix.
 */
function normalizePath(filePath: string, baseDir: string): string {
  let relativePath = path.relative(baseDir, filePath);
  // Ensure forward slashes for deterministic graph IDs
  return relativePath.split(path.sep).join('/');
}

/**
 * Scans a directory and builds a dependency graph of the TypeScript/JavaScript files.
 * @param targetDir The directory to scan (e.g., the checked out branch)
 * @param tsconfigPath Optional path to a tsconfig.json file for path alias resolution
 */
export function scanArchitecture(targetDir: string, tsconfigPath?: string): Graph {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      resolveJsonModule: true,
    },
    ...(tsconfigPath && fs.existsSync(tsconfigPath) ? { tsConfigFilePath: tsconfigPath } : {}),
  });

  project.addSourceFilesAtPaths(path.join(targetDir, '**/*.{ts,tsx,js,jsx}'));

  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];

  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    if (!sourceFile.getFilePath().startsWith(targetDir) && !sourceFile.getFilePath().replace(/\\/g, '/').startsWith(targetDir.replace(/\\/g, '/'))) {
      continue;
    }

    const sourceId = normalizePath(sourceFile.getFilePath(), targetDir);
    
    if (!nodes.has(sourceId)) {
      nodes.set(sourceId, { id: sourceId });
    }

    const importDeclarations = sourceFile.getImportDeclarations();
    for (const importDecl of importDeclarations) {
      const importedSourceFile = importDecl.getModuleSpecifierSourceFile();
      
      if (importedSourceFile) {
        const isInternal = importedSourceFile.getFilePath().replace(/\\/g, '/').startsWith(targetDir.replace(/\\/g, '/'));
        
        if (isInternal) {
          const targetId = normalizePath(importedSourceFile.getFilePath(), targetDir);
          
          if (!nodes.has(targetId)) {
            nodes.set(targetId, { id: targetId });
          }

          edges.push({
            source: sourceId,
            target: targetId,
          });
        }
      }
    }

    const exportDeclarations = sourceFile.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      if (exportDecl.hasModuleSpecifier()) {
         const exportedSourceFile = exportDecl.getModuleSpecifierSourceFile();
         if (exportedSourceFile) {
           const isInternal = exportedSourceFile.getFilePath().replace(/\\/g, '/').startsWith(targetDir.replace(/\\/g, '/'));
           if (isInternal) {
             const targetId = normalizePath(exportedSourceFile.getFilePath(), targetDir);
             
             if (!nodes.has(targetId)) {
               nodes.set(targetId, { id: targetId });
             }

             edges.push({
               source: sourceId,
               target: targetId,
             });
           }
         }
      }
    }
  }

  const uniqueEdges = Array.from(new Set(edges.map(e => JSON.stringify(e)))).map(e => JSON.parse(e));

  return {
    nodes: Array.from(nodes.values()).sort((a, b) => a.id.localeCompare(b.id)),
    edges: uniqueEdges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
  };
}
