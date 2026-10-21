/**
 * The plugin's own release label.
 *
 * The browser half is served as a plain CJS bundle, so it has no manifest to
 * read at runtime; the value is baked in by the build instead (`tsdown.config.ts`
 * defines `__DSH_NORD_VERSION__` from `package.json`). The `typeof` guard is
 * deliberate: a build that does not define the constant — another bundler, or a
 * direct import from a test — degrades to `0.0.0` instead of throwing, and
 * `typeof` on an undeclared identifier is the one read that never throws.
 */
declare const __DSH_NORD_VERSION__: string

/** Release label shown in the settings page footer, e.g. `0.4.1`. */
export const PLUGIN_VERSION: string =
  typeof __DSH_NORD_VERSION__ === 'string' ? __DSH_NORD_VERSION__ : '0.0.0'
