/**
 * Local port of the shell's `useAnchoredPosition`.
 *
 * dsh 0.2.2-rc.2 removed `useAnchoredPosition` from
 * `@deepseek-ai/dsh-client-ui-primitives` (that module now ships
 * `useAnchoredMaxHeight` and the dismiss hook only). A destructured import that
 * resolves to `undefined` throws on the first render, and the shell isolates a
 * crashing dock entry behind its slot error boundary: the readout disappears
 * without a visible trace while the rest of the plugin keeps working.
 *
 * Keeping the placement maths in-tree rather than importing it makes the
 * readout independent of that surface, and lets it keep working on Hosts that
 * still export the hook.
 *
 * The panel is portaled to `document.body` and positioned `fixed`, so both the
 * anchor and the panel are measured in viewport coordinates, and the panel must
 * already be laid out (hidden is fine) when the first measurement happens.
 */
import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

/** Inputs for {@link useAnchoredPosition}. */
export interface AnchoredPositionOptions {
  /** Whether the panel is mounted and should track its anchor. */
  open: boolean
  /** Element whose viewport rect anchors the panel. */
  anchorRef: RefObject<HTMLElement | null>
  /** Body-portaled, fixed-position panel. */
  panelRef: RefObject<HTMLElement | null>
  /** Preferred anchor edge; a right-side panel aligns its top edges. */
  side?: 'top' | 'bottom' | 'right'
  /** Horizontal alignment for panels above or below the anchor. */
  align?: 'start' | 'end'
  /** Distance from the preferred anchor edge, in CSS pixels. */
  gap: number
  /** Minimum viewport inset, in CSS pixels. */
  margin: number
  /** Key that forces a re-measure after a committed content change. */
  layoutKey?: string | number
}

/** Viewport box the placement clamps to. */
interface ViewportBox {
  /** Left offset of the visual viewport. */
  left: number
  /** Top offset of the visual viewport. */
  top: number
  /** Visible width. */
  width: number
  /** Visible height. */
  height: number
}

/**
 * Read the visible viewport, falling back to the layout viewport.
 * @param win - the anchor's window.
 * @returns the box the panel must stay inside.
 */
function readViewport(win: Window): ViewportBox {
  const viewport = win.visualViewport
  if (viewport !== null && viewport !== undefined) {
    return { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }
  }
  const doc = win.document.documentElement
  return { left: 0, top: 0, width: doc.clientWidth || win.innerWidth, height: doc.clientHeight || win.innerHeight }
}

/**
 * Keep a fixed panel aligned and constrained to the visible viewport.
 * @param options - open state, element refs, placement, and an optional content key.
 * @returns fixed coordinates and viewport size limits, or null while closed or unmeasured.
 */
export function useAnchoredPosition(options: AnchoredPositionOptions): CSSProperties | null {
  const { open, anchorRef, panelRef, side = 'bottom', align = 'start', gap, margin, layoutKey } = options
  const [position, setPosition] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return undefined
    }
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (anchor === null || panel === null) return undefined
    const win = anchor.ownerDocument.defaultView
    if (win === null) return undefined

    let active = true
    const place = (): void => {
      if (!active) return
      const rect = anchor.getBoundingClientRect()
      const box = panel.getBoundingClientRect()
      const view = readViewport(win)
      const maxWidth = Math.max(0, view.width - margin * 2)
      const maxHeight = Math.max(0, view.height - margin * 2)
      const width = Math.min(box.width, maxWidth)
      const height = Math.min(box.height, maxHeight)
      const left = side === 'right' ? rect.right + gap : align === 'end' ? rect.right - width : rect.left
      const top = side === 'right' ? rect.top : side === 'top' ? rect.top - gap - height : rect.bottom + gap
      const next: CSSProperties = {
        position: 'fixed',
        maxWidth,
        maxHeight,
        left: Math.max(view.left + margin, Math.min(left, view.left + view.width - margin - width)),
        top: Math.max(view.top + margin, Math.min(top, view.top + view.height - margin - height)),
      }
      setPosition(current => (current !== null
        && current.left === next.left
        && current.top === next.top
        && current.maxWidth === next.maxWidth
        && current.maxHeight === next.maxHeight
        ? current
        : next))
    }

    place()
    win.addEventListener('scroll', place, true)
    win.addEventListener('resize', place)
    win.visualViewport?.addEventListener('scroll', place)
    win.visualViewport?.addEventListener('resize', place)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    observer?.observe(anchor)
    observer?.observe(panel)
    return () => {
      active = false
      observer?.disconnect()
      win.removeEventListener('scroll', place, true)
      win.removeEventListener('resize', place)
      win.visualViewport?.removeEventListener('scroll', place)
      win.visualViewport?.removeEventListener('resize', place)
    }
  }, [open, anchorRef, panelRef, side, align, gap, margin, layoutKey])

  return position
}

/**
 * Close an open popover when a pointerdown lands outside its root element.
 *
 * Ported in-tree with the placement hook above: the readout must not depend on
 * primitives' hook surface to stay mounted.
 * @param root - element containing both the trigger and the open surface.
 * @param open - whether the surface is showing; false detaches the listener.
 * @param setOpen - state setter invoked with false on an outside pointerdown.
 * @param portal - surface portaled outside the root; counts as inside.
 */
export function useDismissOnOutsidePointer(
  root: RefObject<HTMLElement | null>,
  open: boolean,
  setOpen: (open: boolean) => void,
  portal?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (root.current?.contains(target) === true) return
      if (portal?.current?.contains(target) === true) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [root, open, setOpen, portal])
}
