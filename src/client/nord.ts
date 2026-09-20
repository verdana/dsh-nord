/**
 * The Nord theme layer: alias-token overrides folded over whatever base palette
 * is active, plus the font stacks.
 *
 * Colors go through `ctx.theme.overrideTokens()`, which composes per palette
 * mode and is removed with the plugin. Fonts cannot: every composite family
 * (`--dsw-font-markdown-*`, `--dsw-font-<size>-*`) is declared on `:root` as
 * `var(--dsw-font-family)`, and a `var()` reference resolves where it is
 * declared — an override written on `body` would never reach them. A single
 * plugin-owned `:root` rule wins the cascade against the upstream `:root` block
 * and every derived family follows.
 */
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** The sixteen official Nord colors (nord0–nord15). */
const P = {
  nord0: '#2E3440',
  nord1: '#3B4252',
  nord2: '#434C5E',
  nord3: '#4C566A',
  nord4: '#D8DEE9',
  nord5: '#E5E9F0',
  nord6: '#ECEFF4',
  nord7: '#8FBCBB',
  nord8: '#88C0D0',
  nord9: '#81A1C1',
  nord10: '#5E81AC',
  nord11: '#BF616A',
  nord12: '#D08770',
  nord13: '#EBCB8B',
  nord14: '#A3BE8C',
  nord15: '#B48EAD',
  /**
   * One step between nord3 and nord4. The official scale jumps from #4C566A to
   * #D8DEE9, which leaves caption and dimmed text unreadable on a dark
   * background; every alias below that needs a mid neutral uses this instead.
   */
  faint: '#7B88A1',
} as const

/** Layer identity for the token override the theme service stacks. */
export const TOKEN_SOURCE = 'dsh-nord'

/** `<style>` element id carrying the font rule. */
export const FONT_STYLE_ID = 'dsh-nord-fonts'

/** `<style>` element id carrying the balance surfaces' rules. */
export const SURFACE_STYLE_ID = 'dsh-nord-surfaces'

/** `<style>` element id carrying the wide-table scroll patch. */
export const TABLE_STYLE_ID = 'dsh-nord-tables'

/** Attribute marking the balance readout: dock-row member and pill skin. */
export const BAR_ATTR = 'data-dsh-nord-bar'

/** Attribute marking the portaled balance panel. */
export const PANEL_ATTR = 'data-dsh-nord-panel'

/** Maple Mono first, then the upstream Chinese and Latin fallbacks. */
export const UI_FONT_STACK = "'Maple Mono', 'Maple Mono NF CN', ui-sans-serif, -apple-system, "
  + "BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', "
  + "'Helvetica Neue', Helvetica, Arial, sans-serif"

/**
 * Code stack. The bare `monospace` tail is deliberately absent: Windows CJK
 * falls back to SimSun through it, which `ui-theme/src/styles/base.css` records
 * for the upstream stack as well.
 */
export const CODE_FONT_STACK = "'Maple Mono', 'Maple Mono NF CN', ui-monospace, 'SF Mono', "
  + "'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, "
  + "'PingFang SC', 'Microsoft YaHei'"

/**
 * `[token, light, dark]`. `--dsw-alias-*` carry the semantic surface; the
 * `--dsw-static-*` rows patch the components that read the raw scale instead of
 * an alias (plan cards, deliverables, the guide body, file-type icons, loading
 * gradients) — without them a light theme shows near-white boxes on a Nord
 * canvas, which is exactly the leak the upstream `light` palette is shaped for.
 */
const TOKENS: readonly (readonly [name: string, light: string, dark: string])[] = [
  // Backgrounds.
  ['--dsw-alias-bg-base', P.nord6, P.nord0],
  ['--dsw-alias-bg-layer-1', P.nord5, P.nord1],
  ['--dsw-alias-bg-layer-2', P.nord5, P.nord2],
  ['--dsw-alias-bg-layer-3', P.nord4, P.nord3],
  ['--dsw-alias-bg-document-preview', P.nord6, P.nord0],
  ['--dsw-alias-label-document-preview', P.nord1, P.nord4],
  ['--dsw-alias-bg-module-platform', P.nord5, P.nord1],
  ['--dsw-alias-bg-multi-select', P.nord5, P.nord2],
  ['--dsw-alias-bg-overlay', P.nord4, P.nord2],
  ['--dsw-alias-bg-skeleton', 'rgba(46, 52, 64, 0.06)', 'rgba(216, 222, 233, 0.08)'],
  ['--dsw-alias-bg-mask-1', 'rgba(46, 52, 64, 0.24)', 'rgba(0, 0, 0, 0.5)'],
  ['--dsw-alias-bg-mask-2', 'rgba(46, 52, 64, 0.12)', 'rgba(0, 0, 0, 0.2)'],
  ['--dsw-alias-bg-mask-3', 'rgba(46, 52, 64, 0.48)', 'rgba(0, 0, 0, 0.48)'],
  ['--dsw-alias-bg-mask-photo', 'rgba(0, 0, 0, 0.88)', 'rgba(0, 0, 0, 0.88)'],
  ['--dsw-alias-bg-mask-drop', 'rgba(236, 239, 244, 0.7)', 'rgba(59, 66, 82, 0.7)'],

  // Borders.
  ['--dsw-alias-border-l1', 'rgba(46, 52, 64, 0.08)', 'rgba(216, 222, 233, 0.08)'],
  ['--dsw-alias-border-l2', 'rgba(46, 52, 64, 0.14)', 'rgba(216, 222, 233, 0.14)'],
  ['--dsw-alias-border-l2-darkmode-thin', 'rgba(46, 52, 64, 0.10)', 'rgba(216, 222, 233, 0.08)'],
  ['--dsw-alias-border-l3', 'rgba(46, 52, 64, 0.18)', 'rgba(216, 222, 233, 0.18)'],
  ['--dsw-alias-border-l4', 'rgba(46, 52, 64, 0.24)', 'rgba(216, 222, 233, 0.24)'],
  ['--dsw-alias-border-inverted', 'rgba(236, 239, 244, 0.06)', 'rgba(236, 239, 244, 0.06)'],
  ['--dsw-alias-border-inverted2', 'rgba(236, 239, 244, 0.08)', 'rgba(236, 239, 244, 0.08)'],

  // Brand accent: Nord frost.
  ['--dsw-alias-brand-primary', P.nord10, P.nord8],
  ['--dsw-alias-brand-primary-invert', P.nord6, P.nord0],
  ['--dsw-alias-brand-text', P.nord10, P.nord8],
  ['--dsw-alias-brand-primary-new-colorprimary-new-color', P.nord10, P.nord8],

  // Buttons.
  ['--dsw-alias-button-contrast-fill', P.nord1, P.nord6],
  ['--dsw-alias-button-elevated-fill', P.nord6, P.nord1],
  ['--dsw-alias-button-floating-fill', P.nord6, P.nord1],
  ['--dsw-alias-button-floating-hover', P.nord5, P.nord2],
  ['--dsw-alias-button-ghost-active-border', P.nord9, P.nord9],
  ['--dsw-alias-button-ghost-active-fill', P.nord5, P.nord2],
  ['--dsw-alias-button-ghost-active-hover', P.nord4, P.nord3],
  ['--dsw-alias-button-info-fill', P.nord10, P.nord8],
  ['--dsw-alias-button-info-hover', P.nord9, P.nord7],
  ['--dsw-alias-button-primary-dimmed', P.nord4, P.nord2],
  ['--dsw-alias-button-primary-fill', P.nord10, P.nord8],
  ['--dsw-alias-button-primary-hover', P.nord9, P.nord7],
  ['--dsw-alias-button-tool-bar-fill-invisible', 'rgba(46, 52, 64, 0.36)', 'rgba(31, 31, 31, 0.36)'],
  ['--dsw-alias-button-tool-bar-fill', 'rgba(76, 86, 106, 0.5)', 'rgba(76, 86, 106, 0.5)'],
  ['--dsw-alias-button-tool-bar-hover', 'rgba(76, 86, 106, 0.6)', 'rgba(76, 86, 106, 0.6)'],

  // Interaction states.
  ['--dsw-alias-interactive-bg-active', 'rgba(94, 129, 172, 0.16)', 'rgba(136, 192, 208, 0.16)'],
  ['--dsw-alias-interactive-bg-hover-accent', 'rgba(94, 129, 172, 0.22)', 'rgba(136, 192, 208, 0.22)'],
  ['--dsw-alias-interactive-bg-hover-danger', 'rgba(191, 97, 106, 0.10)', 'rgba(191, 97, 106, 0.16)'],
  ['--dsw-alias-interactive-bg-hover-solid', P.nord5, P.nord2],
  ['--dsw-alias-interactive-bg-hover', 'rgba(46, 52, 64, 0.06)', 'rgba(216, 222, 233, 0.08)'],

  // Labels.
  ['--dsw-alias-label-primary', P.nord0, P.nord6],
  ['--dsw-alias-label-primary-bluish', P.nord10, P.nord4],
  ['--dsw-alias-label-primary-dimmed', P.nord1, P.nord5],
  ['--dsw-alias-label-primary-foreground', P.nord6, P.nord0],
  ['--dsw-alias-label-primary-inverted', P.nord6, P.nord1],
  ['--dsw-alias-label-secondary', P.nord2, P.nord4],
  ['--dsw-alias-label-tertiary', P.nord3, P.faint],
  ['--dsw-alias-label-caption', P.nord3, P.faint],
  ['--dsw-alias-label-dimmed', P.nord3, P.faint],
  ['--dsw-alias-link', P.nord10, P.nord8],

  // Markdown surfaces.
  ['--dsw-alias-markdown-citation', P.nord4, P.nord2],
  ['--dsw-alias-markdown-code-block', P.nord5, P.nord1],
  ['--dsw-alias-markdown-code-block-banner', P.nord4, P.nord2],
  ['--dsw-alias-markdown-code-segment-selected', P.nord6, P.nord1],
  ['--dsw-alias-markdown-code-segment-unselected', P.nord5, P.nord0],
  ['--dsw-alias-markdown-inline-code', P.nord4, P.nord2],
  ['--dsw-alias-markdown-placeholder', P.nord4, P.nord3],
  ['--dsw-alias-markdown-tag', P.nord5, P.nord2],

  // Scrollbars.
  ['--dsw-alias-scrollbar-bg-l1', P.nord4, P.nord2],
  ['--dsw-alias-scrollbar-bg-l2', P.nord4, P.nord2],
  ['--dsw-alias-scrollbar-hover-l1', P.nord3, P.nord3],
  ['--dsw-alias-scrollbar-hover-l2', P.nord3, P.nord3],

  // States: Aurora.
  ['--dsw-alias-state-business-primary', P.nord10, P.nord8],
  ['--dsw-alias-state-business-tertiary', 'rgba(94, 129, 172, 0.16)', 'rgba(136, 192, 208, 0.16)'],
  ['--dsw-alias-state-error-primary', P.nord11, P.nord11],
  ['--dsw-alias-state-error-secondary', P.nord11, P.nord11],
  ['--dsw-alias-state-success-primary', P.nord14, P.nord14],
  ['--dsw-alias-state-success-secondary', P.nord14, P.nord14],
  ['--dsw-alias-state-success-tertiary', 'rgba(163, 190, 140, 0.18)', 'rgba(163, 190, 140, 0.18)'],
  ['--dsw-alias-state-warn-label', P.nord12, P.nord13],
  ['--dsw-alias-state-warn-primary', P.nord12, P.nord13],
  ['--dsw-alias-state-warn-secondary', P.nord12, P.nord13],
  ['--dsw-alias-state-warn-tertiary', 'rgba(208, 135, 112, 0.18)', 'rgba(235, 203, 139, 0.18)'],

  // Floating surfaces.
  ['--dsw-alias-toast-bg', P.nord1, P.nord2],
  ['--dsw-alias-tooltip-bg', P.nord2, P.nord2],

  // Composer, sidebar, and selector surfaces.
  ['--dsw-specific-bubble-highlight', P.nord5, P.nord2],
  ['--dsw-specific-bubble', P.nord5, P.nord1],
  ['--dsw-specific-input-major', P.nord6, P.nord1],
  ['--dsw-specific-login-input', P.nord5, P.nord1],
  ['--dsw-specific-selector', P.nord5, P.nord2],
  ['--dsw-specific-sidebar-fill', P.nord5, P.nord1],
  ['--dsw-specific-sidebar-nav-item-active-accent', 'rgba(94, 129, 172, 0.18)', 'rgba(136, 192, 208, 0.16)'],
  ['--dsw-specific-sidebar-nav-item-active', P.nord4, P.nord2],
  ['--dsw-specific-sidebar-nav-item-hover', P.nord4, P.nord2],
  ['--dsw-specific-tip', P.nord5, P.nord2],

  // Raw-scale patch: consumers that bypass the alias layer.
  ['--dsw-static-neutral-00', P.nord6, P.nord0],
  ['--dsw-static-neutral-50', P.nord5, P.nord1],
  ['--dsw-static-neutral-100', P.nord4, P.nord2],
  ['--dsw-static-neutral-200', P.nord4, P.nord2],
  ['--dsw-static-neutral-700', P.nord3, P.nord4],
  ['--dsw-static-neutral-800', P.nord2, P.nord2],
  ['--dsw-static-neutral-850', P.nord1, P.nord1],
  ['--dsw-static-neutral-bluish-00', P.nord6, P.nord6],
  ['--dsw-static-neutral-bluish-300', P.nord9, P.nord4],
  ['--dsw-static-neutral-bluish-400', P.nord10, P.nord8],
  ['--dsw-static-deepseek-50', P.nord5, P.nord1],
  ['--dsw-static-deepseek-100', P.nord4, P.nord2],
  ['--dsw-static-deepseek-200', P.nord9, P.nord10],
  ['--dsw-static-deepseek-400', P.nord9, P.nord7],
  ['--dsw-static-deepseek-450', P.nord8, P.nord8],
  ['--dsw-static-deepseek-500', P.nord10, P.nord8],
  ['--dsw-static-green-400', P.nord14, P.nord14],
  ['--dsw-static-green-500', P.nord14, P.nord14],
  ['--dsw-static-amber-400', P.nord13, P.nord13],
  ['--dsw-static-amber-500', P.nord12, P.nord13],
  ['--dsw-static-red-400', P.nord11, P.nord11],
  ['--dsw-static-red-600', P.nord11, P.nord11],
  ['--dsw-static-blue-450', P.nord9, P.nord9],
  ['--dsw-static-blue-500', P.nord10, P.nord8],
  ['--dsw-static-blue-900', P.nord10, P.nord9],
]

/**
 * Build the Nord token layer.
 * @returns every alias and raw-scale override, valued for both palette modes.
 */
export function nordTokens(): ThemeTokenOverrides {
  const layer: ThemeTokenOverrides = {}
  for (const [name, light, dark] of TOKENS) layer[name] = { light, dark }
  return layer
}

/**
 * The `:root` rule that replaces both upstream font stacks.
 * @returns stylesheet text for one `<style>` element.
 */
export function fontStylesheet(): string {
  return `:root{--dsw-font-family:${UI_FONT_STACK};--ds-font-family-code:${CODE_FONT_STACK};}`
}

/**
 * Pins the wide markdown table wrapper (the renderer's `md-table-wide` hook) to
 * an ordinary auto-scrolling box.
 *
 * `ui-primitives` keeps the horizontal bar hidden at rest and swaps it in on
 * hover while reserving its height with `padding-bottom`, which moves the
 * wrapper out from under the pointer that triggered the swap. Pinning the
 * reserve only trades that collapse for an 8px hover jump, so the state is
 * pinned instead; DEVELOPMENT.md records the measurements.
 * @returns stylesheet text for one `<style>` element.
 */
export function tableStylesheet(): string {
  return '.md-table-wide{overflow-x:auto!important;padding-bottom:0!important;}'
}

/**
 * Every rule the two balance surfaces need, as one plugin-owned sheet: the dock
 * row, the readout itself, and its click-open panel.
 *
 * The readout cannot stay on inline styles the way the settings card does,
 * because it has interaction states (hover, `aria-expanded`) that inline styles
 * cannot express. The panel mirrors the shipped stat dialog skin
 * (`ui-chat/src/client/chat/stat-dialog.module.css`) token for token, so it
 * reads as the same surface as the two pills beside it.
 *
 * The first rule is the dock row. The composer dock is one outlet per slot, and
 * 0.1.5 lays that outlet's entries out in the composer column — every
 * contribution lands on its own line. The outlet is an addressable surface
 * (`div[data-slot]`), so one rule turns the outlet itself into the row 0.1.6
 * gives the dock natively. The `:has()` guard leaves the outlet untouched
 * whenever this plugin contributes no bar, and `!important` is required because
 * the shell writes `display: contents` as an inline style on the same element.
 * @returns stylesheet text for one `<style>` element.
 */
export function surfaceStylesheet(): string {
  return [
    `div[data-slot="conversation.composer.dock"]:has(> [${BAR_ATTR}]){`
    + 'display:flex!important;align-items:center;justify-content:center;gap:12px;max-width:100%;}',
    `[${BAR_ATTR}]{display:inline-flex;align-items:center;gap:6px;flex:none;margin-top:4px;padding: 1px 8px;border-radius:24px;`
    + 'border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-family:inherit;'
    + 'font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;'
    + 'line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;}',
    `[${BAR_ATTR}] svg{flex:none;}`,
    `button[${BAR_ATTR}]{cursor:pointer;}`,
    `button[${BAR_ATTR}]:hover,button[${BAR_ATTR}][aria-expanded="true"]{`
    + 'background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);}',
    `[${PANEL_ATTR}]{position:fixed;z-index:1100;box-sizing:border-box;width:max-content;`
    + 'min-width:min(300px,calc(100vw - 24px));max-width:min(440px,calc(100vw - 24px));padding:16px;'
    + 'border:0;border-radius:12px;background:var(--dsw-specific-menu);'
    + '--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);'
    + 'font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);cursor:default;}',
    `[${PANEL_ATTR}] > header{display:flex;justify-content:space-between;gap:16px;margin-bottom:8px;`
    + 'color:var(--dsw-alias-label-primary);font-weight:500;}',
    `[${PANEL_ATTR}] > header > span{display:inline-flex;align-items:center;gap:6px;min-width:0;}`,
    `[${PANEL_ATTR}] > header svg{width:14px;height:14px;flex:none;}`,
    `[${PANEL_ATTR}] > header > span:last-child{font-variant-numeric:tabular-nums;}`,
    `[${PANEL_ATTR}] > hr{margin:0 0 10px;border:0;border-top:.5px solid var(--dsw-alias-border-l2);}`,
    `[${PANEL_ATTR}] > dl{display:grid;grid-template-columns:minmax(76px,auto) minmax(0,1fr);`
    + 'gap:6px 16px;margin:0;color:var(--dsw-alias-label-tertiary);}',
    `[${PANEL_ATTR}] dt,[${PANEL_ATTR}] dd{min-width:0;margin:0;}`,
    `[${PANEL_ATTR}] dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;`
    + 'text-align:right;}',
  ].join('')
}
