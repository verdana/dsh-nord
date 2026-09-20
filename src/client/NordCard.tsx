/**
 * General-section preference row: the theme, font, balance, and endpoint
 * controls. The owner supplies no props and draws no label — the row owns its
 * internals, its copy, and its write path.
 *
 * Every option is one row in the shape shipped settings rows use: label and
 * explanation on the left, control on the right, a hairline between rows. The
 * three booleans use the shared `Switch` — the design system owns the on/off
 * skin, its focus ring, and its disabled state, which a native checkbox cannot
 * carry.
 *
 * The two fields are uncontrolled and keyed by their stored value. A controlled
 * input bound straight to the stored value cannot be edited: an `onChange` that
 * refuses the draft produces no update, and React restores the stored value
 * after every keystroke that did — so an interval passing through a smaller
 * number (60 → 90) or a half-typed URL could never be entered. The key re-seeds
 * a field when the stored value lands or changes underneath it.
 */
import { Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { NordKey } from './locales.ts'
import type { createNordSettingsStore } from './stores.ts'

/** Injected business face: one durable field write. */
export interface NordCardInjected {
  /** Write one field of this plugin's settings namespace. */
  save: (field: string, value: unknown) => void
}

/** Full component props: runtime share + store + locale seat + injected face. */
export type NordCardProps =
  PropsRuntime<'settings.general.item'>
  & PropsStore<ReturnType<typeof createNordSettingsStore>>
  & PropsLocale<'dshNord'>
  & NordCardInjected

/** Card chrome. The section strips the trailing hairline wherever the column ends. */
const CARD_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  padding: '16px 0',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
} as const
const HEADING_STYLE = { display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '4px' } as const
const TITLE_STYLE = { fontSize: '14px', lineHeight: '22px', color: 'var(--dsw-alias-label-primary)' } as const
const SUMMARY_STYLE = { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } as const

/** One option: label block flexed left, control right, hairline above the row. */
const ROW_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '12px 0',
  borderTop: '0.5px solid var(--dsw-alias-border-l3)',
} as const
const ROW_TEXT_STYLE = {
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
} as const
const LABEL_STYLE = { fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-primary)' } as const
const HINT_STYLE = { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } as const

/** Field widths for `Input`, whose own root shrink-wraps the inner input. */
const INTERVAL_STYLE = { width: '76px' } as const
const URL_STYLE = { width: '240px' } as const

const NOTE_STYLE = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } as const
const ERROR_STYLE = { ...NOTE_STYLE, color: 'var(--dsw-alias-state-error-primary)' } as const

/**
 * Render the Nord preference row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function NordCard({ useStore, t, save }: NordCardProps) {
  const themeEnabled = useStore(s => s.themeEnabled)
  const fontEnabled = useStore(s => s.fontEnabled)
  const balanceEnabled = useStore(s => s.balanceEnabled)
  const refreshSeconds = useStore(s => s.refreshSeconds)
  const baseURL = useStore(s => s.baseURL)
  const writable = useStore(s => s.writable)
  const served = useStore(s => s.served)
  const error = useStore(s => s.error)

  if (!served) return <p style={NOTE_STYLE}>{t('card.unavailable')}</p>

  const disabled = !writable
  const locked = disabled ? t('card.readonly') : undefined
  // Both fields configure the bar, so they follow its own switch.
  const fieldDisabled = disabled || !balanceEnabled
  const toggleRow = (
    label: NordKey,
    hint: NordKey,
    checked: boolean,
    field: 'themeEnabled' | 'fontEnabled' | 'balanceEnabled',
  ) => (
    <div style={ROW_STYLE}>
      <div style={ROW_TEXT_STYLE}>
        <div style={LABEL_STYLE}>{t(label)}</div>
        <div style={HINT_STYLE}>{t(hint)}</div>
      </div>
      <Switch
        checked={checked}
        label={t(label)}
        disabled={disabled}
        title={locked}
        onChange={(next) => { save(field, next) }}
      />
    </div>
  )

  return (
    <div style={CARD_STYLE}>
      <div style={HEADING_STYLE}>
        <div style={TITLE_STYLE}>{t('card.title')}</div>
        <div style={SUMMARY_STYLE}>{t('card.summary')}</div>
      </div>
      {toggleRow('card.theme', 'card.themeHint', themeEnabled, 'themeEnabled')}
      {toggleRow('card.font', 'card.fontHint', fontEnabled, 'fontEnabled')}
      {toggleRow('card.balance', 'card.balanceHint', balanceEnabled, 'balanceEnabled')}
      <div style={ROW_STYLE}>
        <div style={ROW_TEXT_STYLE}>
          <div style={LABEL_STYLE}>{t('card.refresh')}</div>
          <div style={HINT_STYLE}>{t('card.refreshHint')}</div>
        </div>
        <Input
          key={refreshSeconds}
          type="number"
          min={15}
          max={3600}
          step={1}
          defaultValue={refreshSeconds}
          disabled={fieldDisabled}
          aria-label={t('card.refresh')}
          style={INTERVAL_STYLE}
          onBlur={(event) => {
            const next = Number(event.currentTarget.value)
            if (Number.isInteger(next) && next >= 15 && next <= 3600) {
              if (next !== refreshSeconds) save('refreshSeconds', next)
              return
            }
            // The draft never became a writable value; put the field back.
            event.currentTarget.value = String(refreshSeconds)
          }}
        />
      </div>
      <div style={ROW_STYLE}>
        <div style={ROW_TEXT_STYLE}>
          <div style={LABEL_STYLE}>{t('card.baseURL')}</div>
          <div style={HINT_STYLE}>{t('card.baseURLHint')}</div>
        </div>
        <Input
          key={baseURL}
          type="text"
          defaultValue={baseURL}
          disabled={fieldDisabled}
          aria-label={t('card.baseURL')}
          style={URL_STYLE}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim()
            event.currentTarget.value = next
            if (next !== '' && next !== baseURL) save('baseURL', next)
          }}
        />
      </div>
      {disabled ? <p style={NOTE_STYLE}>{t('card.readonly')}</p> : null}
      {error === '' ? null : <p style={ERROR_STYLE}>{t('card.saveFailed')}</p>}
    </div>
  )
}
