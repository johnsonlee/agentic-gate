import packageMetadata from "../../package.json";

/** Package identity embedded in the ESLint plugin metadata. */
export const PackageIdentity = {
  NAME: packageMetadata.name,
  VERSION: packageMetadata.version
} as const;
