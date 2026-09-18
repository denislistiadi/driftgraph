import { Graph, GraphNode, GraphEdge } from './scanner';
import { RuleViolation } from './rules';

export type DiffStatus = 'added' | 'removed' | 'unchanged';

export interface DiffNode extends GraphNode {
  status: DiffStatus;
}

export interface DiffEdge extends GraphEdge {
  status: DiffStatus;
  isViolation?: boolean;
  violatedRules?: string[];
}

export interface DiffGraph {
  nodes: DiffNode[];
  edges: DiffEdge[];
}

function edgeToString(edge: GraphEdge): string {
  return `${edge.source}::${edge.target}`;
}

/**
 * Compares the base graph and the head graph to produce a diffed graph.
 * Also integrates architecture rule violations into the diffed edges.
 */
export function diffGraphs(base: Graph, head: Graph, violations: RuleViolation[] = []): DiffGraph {
  const diffNodes: DiffNode[] = [];
  const diffEdges: DiffEdge[] = [];

  const baseNodeIds = new Set(base.nodes.map(n => n.id));
  const headNodeIds = new Set(head.nodes.map(n => n.id));

  const baseEdgeSet = new Set(base.edges.map(edgeToString));
  const headEdgeSet = new Set(head.edges.map(edgeToString));

  for (const headNode of head.nodes) {
    diffNodes.push({
      ...headNode,
      status: baseNodeIds.has(headNode.id) ? 'unchanged' : 'added',
    });
  }

  for (const baseNode of base.nodes) {
    if (!headNodeIds.has(baseNode.id)) {
      diffNodes.push({
        ...baseNode,
        status: 'removed',
      });
    }
  }

  const violationsMap = new Map<string, string[]>();
  for (const violation of violations) {
    const edgeStr = edgeToString(violation.edge);
    if (!violationsMap.has(edgeStr)) {
      violationsMap.set(edgeStr, []);
    }
    violationsMap.get(edgeStr)!.push(violation.ruleName);
  }

  for (const headEdge of head.edges) {
    const edgeStr = edgeToString(headEdge);
    const ruleNames = violationsMap.get(edgeStr);
    
    diffEdges.push({
      ...headEdge,
      status: baseEdgeSet.has(edgeStr) ? 'unchanged' : 'added',
      ...(ruleNames ? { isViolation: true, violatedRules: ruleNames } : {})
    });
  }

  for (const baseEdge of base.edges) {
    const edgeStr = edgeToString(baseEdge);
    if (!headEdgeSet.has(edgeStr)) {
      diffEdges.push({
        ...baseEdge,
        status: 'removed',
      });
    }
  }

  return {
    nodes: diffNodes,
    edges: diffEdges,
  };
}
