/** Persistent balance readout under the composer, with its click-open panel. */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { NordKey } from './locales.ts'
import { BAR_ATTR, PANEL_ATTR } from './nord.ts'
import type { createNordBalanceStore } from './stores.ts'

/** Full component props: session runtime share + store + locale seat. */
export type BalanceBarProps =
  PropsRuntime<'conversation.composer.dock'>
  & PropsStore<ReturnType<typeof createNordBalanceStore>>
  & PropsLocale<'dshNord'>

/**
 * Attributes for the two surfaces. Spread rather than written literally so the
 * selectors in `surfaceStylesheet` and the markup cannot drift apart.
 */
const BAR_PROPS = { [BAR_ATTR]: '' } as const

/** Panel container attribute. */
const PANEL_PROPS = { [PANEL_ATTR]: '' } as const

/** Viewport margin the placement clamp keeps (the shipped stat dialog's). */
const PANEL_MARGIN = 12

/** Distance between the readout's top edge and the panel's bottom. */
const PANEL_GAP = 8

/** Unplaced portal panel: hidden but laid out so the clamp measures real dimensions. */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** Failure codes the dictionary carries copy for. */
const ERROR_KEYS: Record<string, NordKey> = {
  'credentials-missing': 'error.credentials-missing',
  'credentials-unavailable': 'error.credentials-unavailable',
  disabled: 'error.disabled',
  'upstream-failed': 'error.upstream-failed',
  'malformed-response': 'error.malformed-response',
  'request-failed': 'error.request-failed',
}

/** Card glyph marking the readout as the account balance. */
function BalanceIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
      <rect x="1.9" y="3.9" width="12.2" height="8.2" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.9 6.9h12.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * Absolute read time through the dictionary's date template. `toLocaleString`
 * would follow the browser language rather than the app locale, and print
 * mixed-language text after a locale switch.
 * @param fetchedAt - epoch milliseconds of the read.
 * @param t - this namespace's translate seat.
 * @returns the localized date and minute.
 */
function stampLabel(fetchedAt: number, t: BalanceBarProps['t']): string {
  const at = new Date(fetchedAt)
  const pad2 = (value: number): string => String(value).padStart(2, '0')
  return t('balance.dialog.stamp', {
    y: at.getFullYear(),
    m: at.getMonth() + 1,
    d: at.getDate(),
    time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
  })
}

/**
 * Render the balance readout; a successful reading is a button opening the
 * breakdown panel, the pending and failed readings stay plain text.
 * @param props - composed slot props.
 * @returns the bar element, or null while the readout is not in use.
 */
export function BalanceBar({ useStore, t }: BalanceBarProps) {
  const phase = useStore(s => s.phase)
  const currency = useStore(s => s.currency)
  const total = useStore(s => s.total)
  const granted = useStore(s => s.granted)
  const toppedUp = useStore(s => s.toppedUp)
  const available = useStore(s => s.available)
  const fetchedAt = useStore(s => s.fetchedAt)
  const error = useStore(s => s.error)

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  // Portal placement: the panel is fixed above the readout and clamped inside
  // the viewport, so a readout near the window edge cannot push it off-screen.
  const pos = useAnchoredPosition({
    open,
    anchorRef: rootRef,
    panelRef,
    side: 'top',
    gap: PANEL_GAP,
    margin: PANEL_MARGIN,
  })
  // Outside pointerdown closes through the shared primitive; the portaled panel
  // counts as inside. Escape close stays local, one listener while open.
  useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  // `idle` is both the initial state and the state a disabled readout clears to.
  if (phase === 'idle') return null
  if (phase !== 'ready') {
    return (
      <span {...BAR_PROPS}>
        <BalanceIcon />
        {phase === 'loading' ? t('balance.loading') : t(ERROR_KEYS[error] ?? 'error.unknown')}
      </span>
    )
  }
  return (
    <>
      <button
        type="button"
        {...BAR_PROPS}
        ref={rootRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <BalanceIcon />
        {t('balance.label')}
        {' '}
        {currency}
        {' '}
        {total}
        {available ? '' : ` · ${t('balance.insufficient')}`}
      </button>
      {open && createPortal(
        <div
          {...PANEL_PROPS}
          ref={panelRef}
          role="dialog"
          aria-label={t('balance.dialog.title')}
          style={pos ?? MEASURE_STYLE}
        >
          <header>
            <span>
              <BalanceIcon />
              {t('balance.dialog.title')}
            </span>
            <span>{`${currency} ${total}`}</span>
          </header>
          <hr />
          <dl>
            <dt>{t('balance.dialog.granted')}</dt>
            <dd>{`${granted} ${currency}`}</dd>
            <dt>{t('balance.dialog.toppedUp')}</dt>
            <dd>{`${toppedUp} ${currency}`}</dd>
            <dt>{t('balance.dialog.status')}</dt>
            <dd>{available ? t('balance.dialog.available') : t('balance.insufficient')}</dd>
            <dt>{t('balance.dialog.updated')}</dt>
            <dd>{stampLabel(fetchedAt, t)}</dd>
          </dl>
        </div>,
        document.body,
      )}
    </>
  )
}
