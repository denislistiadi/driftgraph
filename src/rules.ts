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
