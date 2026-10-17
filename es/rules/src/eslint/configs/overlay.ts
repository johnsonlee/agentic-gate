import type { Linter } from "eslint";

const WARNING_SEVERITY = "warn";

/** One ESLint flat-config layer or a nested group of layers to overlay. */
type GateConfigLayer =
  | Linter.Config
  | readonly GateConfigLayer[];

function flattenLayers(
  layers: readonly GateConfigLayer[],
  result: Linter.Config[]
): void {
  for (const layer of layers) {
    if (Array.isArray(layer)) {
      flattenLayers(layer, result);
    } else {
      result.push(layer as Linter.Config);
    }
  }
}

function isWarningSeverity(value: unknown): boolean {
  const severity = Array.isArray(value) ? value[0] : value;
  return severity === WARNING_SEVERITY || severity === 1;
}

function promoteRuleSetting(setting: unknown): unknown {
  if (!isWarningSeverity(setting)) return setting;
  if (Array.isArray(setting)) return ["error", ...setting.slice(1)];
  return "error";
}

function makeBlocking(config: Linter.Config): Linter.Config {
  const rules = config.rules
    ? Object.fromEntries(
        Object.entries(config.rules).map(([ruleId, setting]) => [
          ruleId,
          promoteRuleSetting(setting)
        ])
      )
    : undefined;

  const linterOptions = config.linterOptions
    ? {
        ...config.linterOptions,
        reportUnusedDisableDirectives: isWarningSeverity(
          config.linterOptions.reportUnusedDisableDirectives
        )
          ? "error" as const
          : config.linterOptions.reportUnusedDisableDirectives,
        reportUnusedInlineConfigs: isWarningSeverity(
          config.linterOptions.reportUnusedInlineConfigs
        )
          ? "error" as const
          : config.linterOptions.reportUnusedInlineConfigs
      }
    : undefined;

  return {
    ...config,
    ...(rules ? { rules } : {}),
    ...(linterOptions ? { linterOptions } : {})
  } as Linter.Config;
}

/**
 * Flattens ESLint flat-config layers in overlay order and promotes every
 * warning-only check to an error. ESLint applies later configurations after
 * earlier configurations.
 */
export function createGateConfig(
  ...layers: readonly GateConfigLayer[]
): Linter.Config[] {
  const configs: Linter.Config[] = [];
  flattenLayers(layers, configs);
  return configs.map(makeBlocking);
}
