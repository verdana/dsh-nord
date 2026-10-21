/**
 * Three build faces for one out-of-tree plugin:
 *
 * - `src/index.ts`        → `lib/index.js`   the Node half the Loader mounts.
 * - `src/balance.ts`      → `lib/balance.js` the balance projection on its own,
 *   so `npm test` runs it under plain Node without booting the plugin.
 * - `src/usage.ts`        → `lib/usage.js`   the usage-link decision, split off
 *   the browser half for the same reason.
 * - `src/fonts.ts`        → `lib/fonts.js`   the font catalog and the resolver
 *   that rebuilds a user-typed family list, split off for the same reason.
 * - `src/client/index.ts` → `lib/client.js`  the browser half the Web shell
 *   fetches through the `/plugins` combo route.
 *
 * The browser artifact must match the module-system wire contract exactly: a
 * CJS body wrapped by the registration banner/footer, with `module`/`exports`
 * introduced by the intro because the factory only receives `require`.
 */
import { readFileSync } from 'node:fs'
import type { UserConfig } from 'tsdown'

/** Package name the browser module system expects as the registration id. */
const PACKAGE_NAME = 'dsh-nord'

/**
 * Release label the browser half shows in its settings footer. Read here
 * because a browser bundle has no manifest at runtime; `src/client/version.ts`
 * resolves `__DSH_NORD_VERSION__` to this string.
 */
const PACKAGE_VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version

/**
 * Modules the Web shell seeds into its browser module table
 * (`packages/client/web/src/platform.ts`). Each stays an import answered by the
 * injected `require`; everything else is inlined, because a `require` the table
 * cannot answer throws at boot.
 */
const PLATFORM_MODULES: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const isPlatformModule = (specifier: string): boolean => PLATFORM_MODULES.includes(specifier)

const config: UserConfig[] = [
  {
    name: PACKAGE_NAME,
    entry: ['src/index.ts', 'src/balance.ts', 'src/usage.ts', 'src/fonts.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      onlyBundle: [
        '@deepseek-ai/cosmokit',
        '@deepseek-ai/dsh-brand',
        '@deepseek-ai/dsh-credentials',
        '@deepseek-ai/schemastery',
      ],
    },
  },
  {
    name: `${PACKAGE_NAME}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: false,
    // `PLUGIN_VERSION` in `src/client/version.ts` becomes a literal, so the
    // served bundle needs no manifest lookup and no runtime request.
    define: { __DSH_NORD_VERSION__: JSON.stringify(PACKAGE_VERSION) },
    deps: {
      neverBundle: isPlatformModule,
      alwaysBundle: (specifier: string) => !isPlatformModule(specifier),
    },
    outputOptions: {
      // The registry serves `lib/client.js`; clean stays off so this does not
      // wipe the Node half emitted by the sibling config.
      entryFileNames: 'client.js',
      sourcemapExcludeSources: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
]

export default config
