/** A directed dependency edge from caller to callee. */
export interface DirectedEdge {
  source: string;
  target: string;
}

export function directedEdgeKey(source: string, target: string): string {
  return `${source}\0${target}`;
}

/** Returns the directed edges that close one reported cycle. */
export function cycleEdgeKeys(cycle: readonly string[]): Set<string> {
  return new Set(
    cycle.slice(0, -1).map((source, index) =>
      directedEdgeKey(source, cycle[index + 1]!)
    )
  );
}

/** Removes duplicate directed edges while retaining their first occurrence. */
export function uniqueDirectedEdges<T extends DirectedEdge>(edges: readonly T[]): T[] {
  return [...new Map(
    edges.map((edge) => [directedEdgeKey(edge.source, edge.target), edge])
  ).values()];
}

/** Finds every distinct cycle in a directed graph. */
export function findDirectedCycles(edges: readonly DirectedEdge[]): string[][] {
  const targets = new Map<string, Set<string>>();
  for (const { source, target } of edges) {
    const values = targets.get(source) ?? new Set<string>();
    values.add(target);
    targets.set(source, values);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const reported = new Set<string>();
  const cycles: string[][] = [];
  function visit(node: string, path: string[]): void {
    if (visiting.has(node)) {
      const cycle = [...path.slice(path.indexOf(node)), node];
      const key = [...new Set(cycle)].sort().join("\0");
      if (!reported.has(key)) {
        reported.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const target of [...(targets.get(node) ?? [])].sort()) {
      visit(target, [...path, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of [...targets.keys()].sort()) visit(node, []);
  return cycles;
}
