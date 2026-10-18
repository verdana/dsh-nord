/**
 * Whether the hosting DSH owns font settings itself.
 *
 * dsh 0.2.1 moved the two interface font tokens from `:root` to a `body`
 * declaration and added Font family / Font size rows to its own Appearance
 * settings. From that release on this plugin delegates every font decision to
 * the shell: it injects no font stylesheet, writes no font token, and hides its
 * own font rows behind one explanatory line.
 *
 * The signal is the Host release the page booted from (`window.__DSH_BOOT__`),
 * which 0.2.1 publishes and older generations do not. A shell that publishes no
 * release is asked the capability question instead — whether its theme snapshot
 * carries the per-role `fontFamilies` the font settings introduced — so a
 * pre-release build that already shipped the font system still delegates even if
 * it predates the release field.
 *
 * Both answers are computed once per page load: the Host release cannot change
 * under a live page, and the theme service's shape is fixed by the composition.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { bootReleaseVersion, hostOwnsFonts } from '../fonts.ts'

/** The theme service as this module reads it, without importing a generation's types. */
interface ThemeProbe {
  /** Snapshot reader every generation that ships a theme service provides. */
  getTheme?: () => unknown
}

/** Whether the hosting theme publishes the per-role font lists the font settings added. */
function themeOwnsFonts(ctx: ClientContext): boolean {
  try {
    const theme = (ctx as unknown as { theme?: ThemeProbe }).theme
    const snapshot = theme?.getTheme?.()
    // `fontFamilies` exists only once the host-owned font settings do; 0.2.0's
    // snapshot carries `fontSize` and no family lists at all.
    return typeof snapshot === 'object' && snapshot !== null && 'fontFamilies' in snapshot
  } catch {
    // An older or partially initialized theme service must never take the page
    // down over a font decision: fall back to the plugin-owned fonts.
    return false
  }
}

/**
 * Decide which side owns fonts on this page.
 * @param ctx - client root context, used only for the capability fallback.
 * @returns true when the shell owns fonts and this plugin must not touch them.
 */
export function detectHostFonts(ctx: ClientContext): boolean {
  const version = bootReleaseVersion()
  if (version !== undefined) return hostOwnsFonts(version)
  return themeOwnsFonts(ctx)
}
