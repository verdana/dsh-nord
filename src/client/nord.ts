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
import type { FontStacks } from '../fonts.ts'

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
   * background; every dark-mode alias below that needs a mid neutral uses this
   * instead. #8E9AAD reaches 3.0:1 on nord2 and 2.6:1 on nord3 (the previous
   * #7B88A1 stopped at 2.4 and 2.1) while staying 4.4:1 on nord0.
   */
  faint: '#8E9AAD',
} as const

/**
 * Light-mode shades for pairs that must hold 4.5:1. The palette offers no
 * light-safe frost or Aurora (nord10 on nord6 is 3.5:1 and the pastels are
 * worse), so these mix the official rung with polar night — Nord's guidelines
 * allow shading. The resolved hex and the ratio it buys are noted for review.
 */
const FROST_STRONG = 'color-mix(in srgb, #5E81AC 70%, #2E3440)' // #506A8C — 4.83:1 on nord6
const FROST_PRESSED = 'color-mix(in srgb, #5E81AC 60%, #2E3440)' // #4B6281 — 5.41:1 on nord6
const ERROR_TEXT_LIGHT = 'color-mix(in srgb, #BF616A 75%, #2E3440)' // #9B5660 — 4.70:1 on nord6
const ERROR_TEXT_DARK = 'color-mix(in srgb, #BF616A 65%, #ECEFF4)' // #CF939A — 4.92:1 on nord0

/** Layer identity for the token override the theme service stacks. */
export const TOKEN_SOURCE = 'dsh-nord'

/** `<style>` element id carrying the font rule. */
export const FONT_STYLE_ID = 'dsh-nord-fonts'

/** `<style>` element id carrying the balance surfaces' rules. */
export const SURFACE_STYLE_ID = 'dsh-nord-surfaces'

/** `<style>` element id carrying the wide-table scroll patch. */
export const TABLE_STYLE_ID = 'dsh-nord-tables'

/** `<style>` element id carrying the settings-nav glyph patch. */
export const NAV_STYLE_ID = 'dsh-nord-nav'

/** Attribute marking the balance readout: dock-row member and pill skin. */
export const BAR_ATTR = 'data-dsh-nord-bar'

/** Attribute marking the portaled balance panel. */
export const PANEL_ATTR = 'data-dsh-nord-panel'

/** Attribute marking the panel's usage-link row. */
export const USAGE_ATTR = 'data-dsh-nord-usage'

/** Attribute marking this plugin's own settings page. */
export const SETTINGS_ATTR = 'data-dsh-nord-settings'

/** Attribute marking this plugin's own row in the settings navigation. */
export const NAV_ATTR = 'data-dsh-nord-nav'

/** Section id this plugin registers into the settings nav (and `only` key). */
export const SECTION_ID = 'dsh-nord'

/**
 * Nav position. The shipped sections occupy 0 (General), 10 (Models), 15
 * (Plugins) and 20 (Agent presets), so a third-party page takes the same `40`
 * the reference community plugin uses and lands after all of them.
 */
export const SECTION_ORDER = 40

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
  ['--dsw-alias-brand-text', FROST_STRONG, P.nord8],
  ['--dsw-alias-brand-primary-new-colorprimary-new-color', P.nord10, P.nord8],

  // Buttons.
  ['--dsw-alias-button-contrast-fill', P.nord1, P.nord6],
  ['--dsw-alias-button-elevated-fill', P.nord6, P.nord1],
  ['--dsw-alias-button-floating-fill', P.nord6, P.nord1],
  ['--dsw-alias-button-floating-hover', P.nord5, P.nord2],
  ['--dsw-alias-button-ghost-active-border', P.nord9, P.nord9],
  ['--dsw-alias-button-ghost-active-fill', P.nord5, P.nord2],
  ['--dsw-alias-button-ghost-active-hover', P.nord4, P.nord3],
  ['--dsw-alias-button-info-fill', FROST_STRONG, P.nord8],
  ['--dsw-alias-button-info-hover', FROST_PRESSED, P.nord7],
  ['--dsw-alias-button-primary-dimmed', P.nord4, P.nord2],
  ['--dsw-alias-button-primary-fill', FROST_STRONG, P.nord8],
  ['--dsw-alias-button-primary-hover', FROST_PRESSED, P.nord7],
  ['--dsw-alias-button-tool-bar-fill-invisible', 'rgba(46, 52, 64, 0.36)', 'rgba(46, 52, 64, 0.36)'],
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
  ['--dsw-alias-label-primary-bluish', FROST_STRONG, P.nord4],
  ['--dsw-alias-label-primary-dimmed', P.nord1, P.nord5],
  ['--dsw-alias-label-primary-foreground', P.nord6, P.nord0],
  ['--dsw-alias-label-primary-inverted', P.nord6, P.nord1],
  ['--dsw-alias-label-secondary', P.nord2, P.nord4],
  ['--dsw-alias-label-tertiary', P.nord3, P.faint],
  ['--dsw-alias-label-caption', P.nord3, P.faint],
  ['--dsw-alias-label-dimmed', P.nord3, P.faint],
  ['--dsw-alias-link', FROST_STRONG, P.nord8],
  // Upstream's light menu icon is a literal dark grey; the dark rung already
  // resolves through label-primary-dimmed.
  ['--dsw-alias-menu-icon', P.nord1, P.nord5],

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
  ['--dsw-alias-state-business-primary', FROST_STRONG, P.nord8],
  ['--dsw-alias-state-business-tertiary', 'rgba(94, 129, 172, 0.16)', 'rgba(136, 192, 208, 0.16)'],
  // Error is the one Aurora text pair that is not reused on the always-dark
  // toast, so it can be shaded per mode to clear 4.5:1.
  ['--dsw-alias-state-error-primary', ERROR_TEXT_LIGHT, ERROR_TEXT_DARK],
  ['--dsw-alias-state-error-secondary', ERROR_TEXT_LIGHT, ERROR_TEXT_DARK],
  ['--dsw-alias-state-success-primary', P.nord14, P.nord14],
  ['--dsw-alias-state-success-secondary', P.nord14, P.nord14],
  ['--dsw-alias-state-success-tertiary', 'rgba(163, 190, 140, 0.18)', 'rgba(163, 190, 140, 0.18)'],
  ['--dsw-alias-state-warn-label', P.nord12, P.nord13],
  ['--dsw-alias-state-warn-primary', P.nord12, P.nord13],
  ['--dsw-alias-state-warn-secondary', P.nord12, P.nord13],
  ['--dsw-alias-state-warn-tertiary', 'rgba(208, 135, 112, 0.18)', 'rgba(235, 203, 139, 0.18)'],
  // Upstream's idle dot is a bare neutral; use the mid step that clears 3:1 on
  // each canvas (faint is too light on nord6, so light keeps the older step).
  ['--dsw-alias-state-idle-primary', '#7B88A1', P.faint],

  // File-diff surfaces are literal hex upstream, so the raw-scale patch below
  // cannot reach them; these opaque Nord mixes take the deliverables diff off
  // GitHub green/red and keep it one step off the canvas.
  ['--dsw-alias-file-diff-added-bg', 'color-mix(in srgb, #A3BE8C 18%, #ECEFF4)', 'color-mix(in srgb, #A3BE8C 14%, #3B4252)'],
  ['--dsw-alias-file-diff-added-gutter', 'color-mix(in srgb, #A3BE8C 12%, #ECEFF4)', 'color-mix(in srgb, #A3BE8C 9%, #3B4252)'],
  ['--dsw-alias-file-diff-added-marker', 'color-mix(in srgb, #A3BE8C 55%, #2E3440)', P.nord14],
  ['--dsw-alias-file-diff-deleted-bg', 'color-mix(in srgb, #BF616A 16%, #ECEFF4)', 'color-mix(in srgb, #BF616A 18%, #3B4252)'],
  ['--dsw-alias-file-diff-deleted-gutter', 'color-mix(in srgb, #BF616A 10%, #ECEFF4)', 'color-mix(in srgb, #BF616A 11%, #3B4252)'],
  ['--dsw-alias-file-diff-deleted-marker', ERROR_TEXT_LIGHT, ERROR_TEXT_DARK],

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
  // The alpha siblings feed the code-diff overlays only; without them the
  // diff rows keep upstream green/red.
  ['--dsw-static-green-500-a08', 'rgba(163, 190, 140, 0.08)', 'rgba(163, 190, 140, 0.08)'],
  ['--dsw-static-green-500-a12', 'rgba(163, 190, 140, 0.12)', 'rgba(163, 190, 140, 0.12)'],
  ['--dsw-static-red-600-a08', 'rgba(191, 97, 106, 0.08)', 'rgba(191, 97, 106, 0.08)'],
  ['--dsw-static-red-400-a12', 'rgba(191, 97, 106, 0.12)', 'rgba(191, 97, 106, 0.12)'],
  ['--dsw-static-blue-450', P.nord9, P.nord9],
  ['--dsw-static-blue-500', P.nord10, P.nord8],
  ['--dsw-static-blue-900', P.nord10, P.nord9],

  // dsh 0.2.0 additions. The palette gained these eight alias tokens after
  // 0.1.7; these four are the ones that do not land on Nord by themselves. The
  // menu group header is a hardcoded neutral in the palette, so no alias of this
  // layer can reach it; the three label tokens mix in static rungs this layer
  // deliberately leaves alone (`neutral-1000`, `blue-950`, `blue-300`), or read
  // `neutral-00` in the mode where Nord flips it dark — which is why the dark
  // shimmer needs an explicit value rather than the palette's own mix.
  //
  // Each value keeps the token's original job: the header band hides the rows
  // that scroll under it, the two deep-diving tokens colour and then sweep the
  // thinking label of a DeepSeek account, and the shimmer stays one step off its
  // own label — dimmer in light, brighter in dark, as upstream has it.
  //
  // The other four (`switch-thumb`, `bg-document-selection`, `turn-trigger-bg`
  // and its hover) already resolve to Nord through the aliases and statics above,
  // so they are deliberately absent here.
  ['--dsw-alias-menu-group-header-fill', 'rgba(236, 239, 244, 0.94)', 'rgba(59, 66, 82, 0.94)'],
  ['--dsw-alias-label-shimmer', 'rgba(46, 52, 64, 0.3)', 'rgba(216, 222, 233, 0.45)'],
  ['--dsw-alias-label-deep-diving', 'color-mix(in srgb, #5E81AC 70%, #2E3440)', P.nord8],
  ['--dsw-alias-label-deep-diving-shimmer', 'color-mix(in srgb, #5E81AC 30%, #2E3440)', 'color-mix(in srgb, #ECEFF4 65%, #8FBCBB)'],
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
 *
 * The stacks arrive already resolved and already rebuilt from validated family
 * names (`src/fonts.ts`), so no user-typed text reaches this string as text.
 * @param stacks - the two resolved family lists.
 * @returns stylesheet text for one `<style>` element.
 */
export function fontStylesheet(stacks: FontStacks): string {
  return `:root{--dsw-font-family:${stacks.ui};--ds-font-family-code:${stacks.code};}`
}

/**
 * Pins the wide markdown table wrapper (the renderer's `md-table-wide` hook) to
 * an ordinary auto-scrolling box.
 *
 * `ui-primitives` keeps the horizontal bar hidden at rest and swaps it in on
 * hover while reserving its height with `padding-bottom`, which moves the
 * wrapper out from under the pointer that triggered the swap. Pinning the
 * reserve only trades that collapse for a hover jump, so the state itself is
 * pinned instead — see DEVELOPMENT.md「宽表格为什么被钉在 `auto`」。
 * @returns stylesheet text for one `<style>` element.
 */
export function tableStylesheet(): string {
  return '.md-table-wide{overflow-x:auto!important;padding-bottom:0!important;}'
}

/**
 * The glyph this plugin's settings nav row draws in place of the shell's gear.
 *
 * A palette, because the row is a theme: among the shipped rail glyphs (account,
 * models, plugins, presets, archive, and the gear those fall back to) the palette
 * is the one mark that reads as 「appearance」 rather than 「more settings」. It is
 * drawn in the host's own geometry — a 16px box at a 1.3px effective stroke (the
 * artwork is a 24-unit outline scaled to the slot, so `stroke-width: 2` lands on
 * 1.33px) and `currentColor` throughout, so it dims and highlights with the row's
 * own label instead of carrying a fixed brand colour.
 *
 * The paint wells are filled `r=1` rather than the reference art's hairline
 * dots: below a pixel they antialias into grey dust at this size.
 */
const NAV_GLYPH = `url("data:image/svg+xml,${encodeURIComponent([
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>",
  "<path d='M12 2C6.489 2 2 6.489 2 12s4.489 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z'/>",
  "<circle cx='13.5' cy='6.5' r='1' fill='black' stroke='none'/>",
  "<circle cx='17.5' cy='10.5' r='1' fill='black' stroke='none'/>",
  "<circle cx='8.5' cy='7.5' r='1' fill='black' stroke='none'/>",
  "<circle cx='6.5' cy='12.25' r='1' fill='black' stroke='none'/>",
  '</svg>',
].join(''))}")`

/**
 * The settings-nav glyph patch. dsh's settings shell draws its rail icons from
 * a hardcoded per-id map (`navIcon(id)` in ui-settings-general) and hands every
 * third-party section the generic settings gear; the `settings.section` slot
 * carries no icon option, so the row is marked from the browser half and
 * skinned here.
 *
 * The mark is an attribute, never a class: the shell's nav classes are hashed
 * per release. Only the button's direct-child `svg` is hidden — its other child
 * is the label — and the replacement is a `::before` box painted with the glyph
 * as a mask, so it inherits `currentColor` through the row's hover and active
 * states. A host that renders a different nav row shape simply keeps its gear:
 * no rule here matches and nothing breaks.
 * @returns stylesheet text for one `<style>` element.
 */
export function navStylesheet(): string {
  return [
    `button[${NAV_ATTR}]>svg{display:none;}`,
    `button[${NAV_ATTR}]::before{content:'';flex:none;width:16px;height:16px;background-color:currentColor;`
    + `-webkit-mask-image:${NAV_GLYPH};-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:16px 16px;`
    + `mask-image:${NAV_GLYPH};mask-repeat:no-repeat;mask-position:center;mask-size:16px 16px;}`,
  ].join('')
}

/**
 * Every rule the two balance surfaces need, as one plugin-owned sheet: the dock
 * row, the readout itself, and its click-open panel.
 *
 * The readout cannot stay on inline styles the way the settings card does,
 * because it has interaction states (hover, `aria-expanded`) that inline styles
 * cannot express. The panel mirrors the shipped stat dialog skin
 * (`ui-chat/src/client/chat/stat-dialog.module.css`) token for token, so it
 * reads as the same surface as the two pills beside it; its DeepSeek-only usage
 * row is the one extra, skinned as the link colour of that same skin.
 *
 * The first rule is the dock row. The composer dock is one outlet per slot and
 * the outlet is an addressable surface (`div[data-slot]`), so one rule turns the
 * outlet itself into the centered row that holds the shipped pills and this
 * plugin's readout together. The `:has()` guard leaves the outlet untouched
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
    // Upstream floats a popover on a PAIR of declarations: the menu fill plus its
    // frost. The fill turned translucent and the frost moved into
    // `--dsw-menu-backdrop-filter` (`blur(40px) saturate(150%)`) — copying the fill
    // alone is what makes a panel read as merely see-through. A host that ships no
    // such token falls back to the initial `none`, i.e. an opaque fill with no blur.
    + 'backdrop-filter:var(--dsw-menu-backdrop-filter);'
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
    // The usage row is a DeepSeek-only extra, so it is simply absent for any
    // other account; right-aligned, it reads as one more row of the same list.
    `[${PANEL_ATTR}] > p[${USAGE_ATTR}]{display:flex;justify-content:flex-end;margin:8px 0 0;}`,
    `[${PANEL_ATTR}] > p[${USAGE_ATTR}] a{color:var(--dsw-alias-link);text-decoration:none;}`,
    `[${PANEL_ATTR}] > p[${USAGE_ATTR}] a:hover{text-decoration:underline;}`,
  ].join('')
}
