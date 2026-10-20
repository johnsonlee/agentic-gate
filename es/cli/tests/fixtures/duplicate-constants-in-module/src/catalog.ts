export const JavaScriptValueTypes = {
  OBJECT: "object",
  READY: "ready",
  unrelatedField: "shared-value"
} as const satisfies Record<string, string>;

export const firstState = true as const;
export const numericOne = 1;
export const stringOne = "1";
export const SHARED_STATE = "shared";
