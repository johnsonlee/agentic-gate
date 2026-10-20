export interface UnusedSymbolContext {
  symbol: string;
}

export function unusedMessage(
  kind: "export" | "type",
  { symbol }: UnusedSymbolContext
): string {
  return `The ${kind} '${symbol}' is not used by any reachable module.`;
}

export function removeOrExpose({ symbol }: UnusedSymbolContext): string {
  return `Remove '${symbol}' or expose and consume it through a public entry point.`;
}
