export const Flowchart = {
  HEADER: '%%{init: {"flowchart": {"curve": "step"}}}%%\nflowchart LR',
  VIOLATION_CLASS:
    "classDef violation fill:#ffebe9,stroke:#cf222e,stroke-width:2px"
} as const;

const LINK_STYLE_PREFIX = "    linkStyle ";
const VIOLATION_EDGE_STYLE = " stroke:#cf222e,stroke-width:2px";

export function compareDependencyEdges(
  left: { source: string; target: string },
  right: { source: string; target: string }
): number {
  return left.source.localeCompare(right.source) || left.target.localeCompare(right.target);
}

export function violationLinkStyle(edgeIndexes: readonly number[]): string | undefined {
  if (edgeIndexes.length === 0) return undefined;
  return `${LINK_STYLE_PREFIX}${edgeIndexes.join(",")}${VIOLATION_EDGE_STYLE}`;
}
