import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { ArchitectureRule, validateRules } from './rules';

export type RulesSource = 'base' | 'head';

const MAX_RULES_FILE_BYTES = 1024 * 1024;

export interface ResolveRulesPathOptions {
  baseDir: string;
  headDir: string;
  rulesFile: string;
  rulesSource: string;
}

export interface ResolvedRulesPath {
  path: string;
  usedHeadFallback: boolean;
  exists: boolean;
  source: RulesSource;
}

export function parseRulesSource(value: string): RulesSource {
  const normalized = value.trim().toLowerCase();
  if (normalized !== 'base' && normalized !== 'head') {
    throw new Error(`Invalid rules-source "${value}". Expected "base" or "head".`);
  }
  return normalized;
}

function resolveInside(rootDir: string, filePath: string): string {
  const normalizedInput = filePath.replace(/\\/g, '/');

  if (
    path.isAbsolute(filePath) ||
    path.win32.isAbsolute(filePath) ||
    normalizedInput === '..' ||
    normalizedInput.startsWith('../')
  ) {
    throw new Error(`Rules file must be a path inside the repository: ${filePath}`);
  }

  const resolved = path.resolve(rootDir, filePath);
  const relative = path.relative(rootDir, resolved);

  if (
    relative.length === 0 ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Rules file must be a file inside the repository: ${filePath}`);
  }

  return resolved;
}

export function resolveRulesPath(options: ResolveRulesPathOptions): ResolvedRulesPath {
  const source = parseRulesSource(options.rulesSource);
  const baseRulesPath = resolveInside(options.baseDir, options.rulesFile);
  const headRulesPath = resolveInside(options.headDir, options.rulesFile);

  if (source === 'head') {
    return {
      path: headRulesPath,
      usedHeadFallback: false,
      exists: fs.existsSync(headRulesPath),
      source,
    };
  }

  if (fs.existsSync(baseRulesPath)) {
    return {
      path: baseRulesPath,
      usedHeadFallback: false,
      exists: true,
      source,
    };
  }

  const headExists = fs.existsSync(headRulesPath);
  return {
    path: headRulesPath,
    usedHeadFallback: headExists,
    exists: headExists,
    source,
  };
}

export function readRulesFile(filePath: string): ArchitectureRule[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const stat = fs.statSync(filePath);
  if (stat.size > MAX_RULES_FILE_BYTES) {
    throw new Error(`Rules file is too large (maximum ${MAX_RULES_FILE_BYTES} bytes): ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;

  try {
    parsed = path.extname(filePath).toLowerCase() === '.json'
      ? JSON.parse(content)
      : yaml.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse rules file ${filePath}: ${message}`);
  }

  try {
    return validateRules(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid rules file ${filePath}: ${message}`);
  }
}
