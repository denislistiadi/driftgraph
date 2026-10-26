import { Graph, GraphEdge } from './scanner';
import { minimatch } from 'minimatch';

export interface ArchitectureRule {
  name: string;
  source: string; // glob pattern for the source file (e.g. "src/domain/**/*")
  forbiddenImports: string[]; // glob patterns for forbidden dependencies (e.g. ["src/ui/**/*", "src/infrastructure/**/*"])
}

export interface RuleViolation {
  ruleName: string;
  edge: GraphEdge;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and normalizes the parsed rules file.
 */
export function validateRules(value: unknown): ArchitectureRule[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('Rules file must contain an array of architecture rules.');
  }

  return value.map((rule, index) => {
    if (!isRecord(rule)) {
      throw new Error(`Rule at index ${index} must be an object.`);
    }

    const { name, source, forbiddenImports } = rule;

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(`Rule at index ${index} is missing a valid "name".`);
    }

    if (typeof source !== 'string' || source.trim().length === 0) {
      throw new Error(`Rule "${name}" is missing a valid "source" pattern.`);
    }

    if (
      !Array.isArray(forbiddenImports) ||
      forbiddenImports.length === 0 ||
      !forbiddenImports.every(pattern => typeof pattern === 'string' && pattern.trim().length > 0)
    ) {
      throw new Error(`Rule "${name}" must define "forbiddenImports" as a non-empty array of glob patterns.`);
    }

    return {
      name: name.trim(),
      source: source.trim(),
      forbiddenImports: forbiddenImports.map(pattern => pattern.trim()),
    };
  });
}

/**
 * Evaluates a dependency graph against a set of architecture rules.
 * Returns a list of violations.
 */
export function evaluateRules(graph: Graph, rules: ArchitectureRule[]): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const edge of graph.edges) {
    for (const rule of rules) {
      if (minimatch(edge.source, rule.source)) {
        // Check if the target file matches any of the forbidden import patterns
        for (const forbiddenPattern of rule.forbiddenImports) {
          if (minimatch(edge.target, forbiddenPattern)) {
            violations.push({
              ruleName: rule.name,
              edge: edge,
            });
            break; // Move to the next rule if a violation is found for this edge
          }
        }
      }
    }
  }

  return violations;
}
