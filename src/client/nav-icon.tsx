/**
 * The settings rail's palette glyph, in both shapes the supported hosts need.
 *
 * A palette, because the row is a theme: among the shipped rail glyphs (account,
 * models, plugins, presets, archive, and the gear everything else falls back to)
 * it is the one mark that reads as 「appearance」 rather than 「more settings」. It
 * is drawn in the host's own geometry — a 16px box at a 1.3px effective stroke
 * (the artwork is a 24-unit outline scaled to the slot, so `stroke-width: 2`
 * lands on 1.33px) and `currentColor` throughout, so it dims and highlights with
 * the row's own label instead of carrying a fixed brand colour.
 *
 * ## Two paths, one artwork
 *
 * Before 0.2.2 the settings shell picked every rail icon from a hardcoded
 * per-id map (`navIcon` in ui-settings-general) and handed a third-party
 * section the generic gear; the `settings.section` slot carried no icon option.
 * The only way in was a DOM patch: find this plugin's row by its label, mark it,
 * hide the gear, draw the glyph as a `::before` mask. That path is still here for
 * 0.1.7 / 0.2.0 / 0.2.1 and is described in {@link navStylesheet}.
 *
 * 0.2.2 (first shipped in `0.2.2-alpha.3`) added the `settings.section.icon`
 * slot: a list of components addressed by the matching `settings.section` id,
 * rendered by the shell in place of its fallback glyph. {@link NavIcon} is that
 * contribution — the shell now owns the button, the wrapper, and the placement,
 * so the patch above must not also run or the row would show two palettes.
 *
 * The two paths are told apart by what the row *contains*, not by a release
 * number: the patch marks a row only when it carries no {@link ICON_ATTR} mark,
 * which the contributed component sets on its own root. A host that renders the
 * contribution therefore never gets the patch, whatever release label it
 * publishes, and a host that predates the slot still gets the glyph.
 */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Attribute marking this plugin's own row in the settings navigation. */
export const NAV_ATTR = 'data-dsh-nord-nav'

/**
 * Attribute marking the contributed icon's root element.
 *
 * Read by the legacy patch to tell 「the shell already drew this plugin's glyph」
 * from 「the shell drew its own」; it never reaches CSS.
 */
export const ICON_ATTR = 'data-dsh-nord-icon'

/** `<style>` element id carrying the settings-nav glyph patch. */
export const NAV_STYLE_ID = 'dsh-nord-nav'

/** The outline's 24-unit box; the slot scales it to the requested pixel size. */
const PALETTE_VIEWBOX = '0 0 24 24'

/** One-pixel radius paint wells, at the reference art's four positions. */
const PALETTE_WELLS: readonly (readonly [cx: number, cy: number])[] = [
  [13.5, 6.5], [17.5, 10.5], [8.5, 7.5], [6.5, 12.25],
]

/**
 * The paint-well outline: a disc with one bite taken out of the lower right,
 * which is what makes the mark read as a palette rather than a circle.
 */
const PALETTE_OUTLINE = 'M12 2C6.489 2 2 6.489 2 12s4.489 10 10 10c.926 0 1.648-.746 1.648-1.688 '
  + '0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996'
  + 'c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z'

/**
 * The glyph as a standalone SVG document, for the legacy mask.
 *
 * The paint wells are filled `r=1` rather than the reference art's hairline
 * dots: below a pixel they antialias into grey dust at this size. A mask reads
 * the artwork's alpha only, so the painted colour is irrelevant — stroke and
 * fill are black to keep the document unambiguous.
 * @returns one complete SVG document, ready to be percent-encoded.
 */
function paletteGlyph(): string {
  return [
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${PALETTE_VIEWBOX}' fill='none' `
    + "stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>",
    `<path d='${PALETTE_OUTLINE}'/>`,
    ...PALETTE_WELLS.map(([cx, cy]) => `<circle cx='${cx}' cy='${cy}' r='1' fill='black' stroke='none'/>`),
    '</svg>',
  ].join('')
}

/**
 * The legacy settings-nav glyph patch, for hosts without `settings.section.icon`.
 *
 * The mark is an attribute, never a class: the shell's nav classes are hashed
 * per release. Two rules do the work — every `svg` inside the marked button is
 * hidden (0.2.1 renders the gear as the button's direct child) and a `::before`
 * box is painted with the glyph as a mask, so it inherits `currentColor` through
 * the row's hover and active states. A host that renders a different nav row
 * shape simply keeps its gear: no rule here matches and nothing breaks.
 * @returns stylesheet text for one `<style>` element.
 */
export function navStylesheet(): string {
  const glyph = `url("data:image/svg+xml,${encodeURIComponent(paletteGlyph())}")`
  return [
    `button[${NAV_ATTR}] svg{display:none;}`,
    `button[${NAV_ATTR}]::before{content:'';flex:none;width:16px;height:16px;background-color:currentColor;`
    + `-webkit-mask-image:${glyph};-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:16px 16px;`
    + `mask-image:${glyph};mask-repeat:no-repeat;mask-position:center;mask-size:16px 16px;}`,
  ].join('')
}

/**
 * The rail icon dsh 0.2.2 asks for by section id.
 *
 * Rendered inside the shell's own `<span aria-hidden>` wrapper, so this returns
 * the bare `<svg>`; `size` is the shell's requested square edge (16 today).
 * `active` carries the row's selection but is deliberately ignored: the shell's
 * shipped glyphs are single-weight and pick up the row's colour through
 * `currentColor`, which is what keeps this mark consistent with them.
 * @param props - requested size, and the row's selection state (unused).
 * @returns the palette glyph at that size.
 */
export function NavIcon({ size }: PropsRuntime<'settings.section.icon'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={PALETTE_VIEWBOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...{ [ICON_ATTR]: '' }}
    >
      <path d={PALETTE_OUTLINE} />
      {PALETTE_WELLS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1} fill="currentColor" stroke="none" />
      ))}
    </svg>
  )
}
