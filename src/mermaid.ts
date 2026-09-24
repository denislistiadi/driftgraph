import { DiffGraph, DiffNode, DiffEdge } from './differ';

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function generateMermaid(graph: DiffGraph, maxNodes: number = 100): string {
  const lines: string[] = [];
  lines.push('graph TD');

  lines.push('    classDef added fill:#e6ffed,stroke:#2ea043,stroke-width:2px,color:#000;');
  lines.push('    classDef removed fill:#ffebe9,stroke:#cf222e,stroke-width:2px,stroke-dasharray: 5 5,color:#000;');
  lines.push('    classDef unchanged fill:#f6f8fa,stroke:#d0d7de,color:#000;');
  lines.push('    classDef violation fill:#ffebe9,stroke:#cf222e,stroke-width:4px,color:#cf222e;');

  const activeNodeIds = new Set<string>();
  
  for (const edge of graph.edges) {
    if (edge.status !== 'unchanged' || edge.isViolation) {
      activeNodeIds.add(edge.source);
      activeNodeIds.add(edge.target);
    }
  }

  for (const node of graph.nodes) {
    if (node.status !== 'unchanged') {
      activeNodeIds.add(node.id);
    }
  }

  if (activeNodeIds.size === 0 && graph.nodes.length > 0) {
     lines.push('    no_change["No architectural changes detected"]:::unchanged');
     return lines.join('\n');
  }

  let nodesToRender = graph.nodes.filter(n => activeNodeIds.has(n.id));
  
  // Truncate if too large to avoid GitHub comment limits
  if (nodesToRender.length > maxNodes) {
    nodesToRender = nodesToRender.slice(0, maxNodes);
    lines.push(`    %% WARNING: Diagram truncated from ${activeNodeIds.size} to ${maxNodes} nodes`);
  }

  const renderedNodeIds = new Set(nodesToRender.map(n => n.id));

  for (const node of nodesToRender) {
    const sId = sanitizeId(node.id);
    const label = node.id; // use the path as label
    const className = node.status;
    lines.push(`    ${sId}["${label}"]:::${className}`);
  }

  let linkIndex = 0;
  const linkStyles: string[] = [];

  for (const edge of graph.edges) {
    if (renderedNodeIds.has(edge.source) && renderedNodeIds.has(edge.target)) {
      const src = sanitizeId(edge.source);
      const tgt = sanitizeId(edge.target);
      
      let arrow = '-->';
      if (edge.status === 'removed') {
        arrow = '-.->';
      }

      let edgeLabel = '';
      if (edge.isViolation && edge.violatedRules) {
         edgeLabel = `|"${edge.violatedRules.join(', ')}"|`;
      }

      lines.push(`    ${src} ${arrow}${edgeLabel} ${tgt}`);

      if (edge.isViolation) {
        linkStyles.push(`    linkStyle ${linkIndex} stroke:#cf222e,stroke-width:3px,color:#cf222e`);
      } else if (edge.status === 'added') {
        linkStyles.push(`    linkStyle ${linkIndex} stroke:#2ea043,stroke-width:2px`);
      } else if (edge.status === 'removed') {
        linkStyles.push(`    linkStyle ${linkIndex} stroke:#cf222e,stroke-width:2px,stroke-dasharray: 5 5`);
      } else {
        linkStyles.push(`    linkStyle ${linkIndex} stroke:#d0d7de`);
      }

      linkIndex++;
    }
  }

  lines.push(...linkStyles);

  return lines.join('\n');
}
