/**
 * General-section preference row: the theme, font, balance, and endpoint
 * controls. The owner supplies no props and draws no label — the row owns its
 * internals, its copy, and its write path.
 */
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
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

/** Row layout. A shipped plugin replaces this with the Client styling pipeline. */
const ROW_STYLE = { display: 'flex', flexDirection: 'column', gap: '10px' } as const
const TITLE_STYLE = { color: 'var(--dsw-alias-label-primary)' } as const
const OPTION_STYLE = { display: 'flex', alignItems: 'center', gap: '8px' } as const
const FIELD_STYLE = {
  width: '84px',
  padding: '4px 8px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '6px',
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
} as const
const URL_STYLE = { ...FIELD_STYLE, width: '260px' } as const
const NOTE_STYLE = { color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px' } as const
const ERROR_STYLE = { color: 'var(--dsw-alias-state-error-primary)', fontSize: '12px' } as const

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
  const toggle = (field: string, value: boolean) => () => { if (!disabled) save(field, value) }

  return (
    <div style={ROW_STYLE}>
      <div style={TITLE_STYLE}>{t('card.title')}</div>
      <label style={OPTION_STYLE}>
        <input type="checkbox" checked={themeEnabled} disabled={disabled} onChange={toggle('themeEnabled', !themeEnabled)} />
        {t('card.theme')}
      </label>
      <label style={OPTION_STYLE}>
        <input type="checkbox" checked={fontEnabled} disabled={disabled} onChange={toggle('fontEnabled', !fontEnabled)} />
        {t('card.font')}
      </label>
      <label style={OPTION_STYLE}>
        <input type="checkbox" checked={balanceEnabled} disabled={disabled} onChange={toggle('balanceEnabled', !balanceEnabled)} />
        {t('card.balance')}
      </label>
      <label style={OPTION_STYLE}>
        {t('card.refresh')}
        <input
          type="number"
          min={15}
          max={3600}
          step={1}
          value={refreshSeconds}
          disabled={disabled}
          style={FIELD_STYLE}
          onChange={(event) => {
            const next = Number(event.currentTarget.value)
            if (Number.isInteger(next) && next >= 15 && next <= 3600) save('refreshSeconds', next)
          }}
        />
      </label>
      <label style={OPTION_STYLE}>
        {t('card.baseURL')}
        <input
          type="text"
          defaultValue={baseURL}
          disabled={disabled}
          style={URL_STYLE}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim()
            if (next !== '' && next !== baseURL) save('baseURL', next)
          }}
        />
      </label>
      {disabled ? <p style={NOTE_STYLE}>{t('card.readonly')}</p> : null}
      {error === '' ? null : <p style={ERROR_STYLE}>{t('card.saveFailed')}</p>}
    </div>
  )
}
