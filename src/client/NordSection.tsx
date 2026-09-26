/**
 * This plugin's own page in the settings panel: the theme, font, balance, and
 * endpoint controls, rendered into the `settings.section` content column.
 *
 * The page owns its internals, its copy, and its write path; the shell owns the
 * panel, the nav row, and the scrolling column. Nothing here draws a card — a
 * page has room for the three groups the General section had to flatten into one
 * list of rows.
 *
 * Every option is one row in the shape the shipped sections use: label and
 * explanation on the left, control on the right, a hairline between rows. The
 * booleans use the shared `Switch`, the two font choices the shared `Menu`, and
 * the typed fields the shared `Input` — the design system owns the on/off skin,
 * the focus ring, and the disabled state, which a native control cannot carry.
 *
 * The typed fields are uncontrolled and keyed by their stored value. A
 * controlled input bound straight to the stored value cannot be edited: an
 * `onChange` that refuses the draft produces no update, and React restores the
 * stored value after every keystroke that did — so an interval passing through a
 * smaller number (60 → 90) or a half-typed URL could never be entered. The key
 * re-seeds a field when the stored value lands or changes underneath it.
 */
import { useState } from 'react'
import { Button, IconChevronDownOutline14, Input, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { CUSTOM_FONT, FONT_PRESETS, fontStacks, INHERIT_FONT, isPreset, presetPreview, SYSTEM_FONT } from '../fonts.ts'
import type { NordKey } from './locales.ts'
import { SETTINGS_ATTR } from './nord.ts'
import type { createNordSettingsStore } from './stores.ts'

/** Injected business face: one durable field write. */
export interface NordSectionInjected {
  /**
   * Write one field of this plugin's settings namespace.
   * @returns settlement once the Host confirms; a failure is reported through
   * the page's own error line, so the promise never rejects.
   */
  save: (field: string, value: unknown) => Promise<void>
}

/** Full component props: runtime share + store + locale seat + injected face. */
export type NordSectionProps =
  PropsRuntime<'settings.section'>
  & PropsStore<ReturnType<typeof createNordSettingsStore>>
  & PropsLocale<'dshNord'>
  & NordSectionInjected

/** Which of the two font tokens a row writes. */
type FontRole = 'ui' | 'code'

/** The two stored fields each role owns: the choice, then its raw companion. */
const FONT_FIELDS: Record<FontRole, { choice: 'uiFont' | 'codeFont', custom: 'uiFontCustom' | 'codeFontCustom' }> = {
  ui: { choice: 'uiFont', custom: 'uiFontCustom' },
  code: { choice: 'codeFont', custom: 'codeFontCustom' },
}

/**
 * Example family list shown in an empty custom field. CSS syntax rather than
 * copy, so it is not in the dictionary.
 */
const CUSTOM_PLACEHOLDER = "'LXGW WenKai', 'Microsoft YaHei'"

/**
 * Page column. `760px` is the shipped Plugins section's measure, and the content
 * column already carries the panel's 24px side padding and its own scrolling.
 */
const PAGE_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  maxWidth: '760px',
  color: 'var(--dsw-alias-label-primary)',
} as const
/** Page title: the shipped section heading (18/600, no margin of its own). */
const HEADING_STYLE = { margin: 0, fontSize: '18px', fontWeight: 600, lineHeight: '26px' } as const
const INTRO_STYLE = {
  margin: '6px 0 0',
  fontSize: '13px',
  lineHeight: '20px',
  color: 'var(--dsw-alias-label-tertiary)',
} as const
/** Group label above its first row; that row's own hairline is the separator. */
const GROUP_STYLE = {
  margin: '24px 0 0',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: '20px',
  color: 'var(--dsw-alias-label-secondary)',
} as const

/** One option: label block flexed left, control right, hairline above the row. */
const ROW_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '14px 0',
  borderTop: '0.5px solid var(--dsw-alias-border-l3)',
} as const
const ROW_TEXT_STYLE = {
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
} as const
const LABEL_STYLE = { fontSize: '14px', lineHeight: '22px', color: 'var(--dsw-alias-label-primary)' } as const
const HINT_STYLE = { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } as const

/** Field widths for `Input`, whose own root shrink-wraps the inner input. */
const INTERVAL_STYLE = { width: '76px' } as const
const URL_STYLE = { width: '240px' } as const

/**
 * Font trigger: the outline capsule at the fixed width that keeps the two rows
 * aligned. The label inside carries the preview stack, so the trigger shows the
 * family in use — and, when it is not installed, the fallback it reads through.
 */
const FONT_TRIGGER_STYLE = { width: '200px', justifyContent: 'space-between' } as const
const FONT_TRIGGER_LABEL = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
} as const
const FONT_CARET_STYLE = { flex: 'none', color: 'var(--dsw-alias-label-tertiary)' } as const

const NOTE_STYLE = { margin: '12px 0 0', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } as const
const ERROR_STYLE = { ...NOTE_STYLE, color: 'var(--dsw-alias-state-error-primary)' } as const

/**
 * The menu row a stored choice lands on: a preset id, one of the two keywords,
 * or `custom`. An id this build does not offer — a newer version's document, or
 * a hand-edited `settings.yaml` — reads as the raw list it must have been, so
 * the field holding it stays visible instead of the row showing a blank.
 * @param choice - stored choice.
 * @param allowInherit - whether this role offers `inherit` at all.
 * @returns the menu row id.
 */
function rowFor(choice: string, allowInherit: boolean): string {
  if (choice === SYSTEM_FONT) return SYSTEM_FONT
  if (allowInherit && choice === INHERIT_FONT) return INHERIT_FONT
  return isPreset(choice) ? choice : CUSTOM_FONT
}

/** Props for one font row: its copy, the stored pair, and both write paths. */
interface FontRowProps {
  /** This namespace's translate seat. */
  readonly t: NordSectionProps['t']
  /** Which token this row writes. */
  readonly role: FontRole
  readonly labelKey: NordKey
  readonly hintKey: NordKey
  /** Stored choice and its raw companion. */
  readonly choice: string
  readonly custom: string
  /** The stack this row currently resolves to, previewed on the trigger. */
  readonly stack: string
  readonly disabled: boolean
  /** Offer 「follow the interface font」 — the code row only. */
  readonly allowInherit: boolean
  readonly onSelect: (id: string) => void
  readonly onCustom: (value: string) => void
}

/**
 * One font row: a dropdown whose rows preview the family they select, plus the
 * custom field 「自定义」 reveals.
 * @param props - row copy, stored pair, and the two write paths.
 * @returns the row element tree.
 */
function FontRow({
  t, role, labelKey, hintKey, choice, custom, stack, disabled, allowInherit, onSelect, onCustom,
}: FontRowProps) {
  const [open, setOpen] = useState(false)
  // Revealing the custom field and focusing it are two flags, not one. The
  // field remounts under a new `key` after every accepted write, and `autoFocus`
  // is honoured at mount — a standing `true` there would pull focus straight
  // back the moment the user blurred the field to commit it.
  const [revealed, setRevealed] = useState(false)
  const [focusPending, setFocusPending] = useState(false)

  const row = rowFor(choice, allowInherit)
  const editing = revealed || row === CUSTOM_FONT

  const entries: MenuEntry[] = [
    { id: SYSTEM_FONT, label: <span style={{ fontFamily: 'inherit' }}>{t('font.system')}</span> },
  ]
  if (allowInherit) {
    entries.push({ id: INHERIT_FONT, label: <span style={{ fontFamily: 'inherit' }}>{t('font.inherit')}</span> })
  }
  for (const preset of FONT_PRESETS) {
    // The row is its own specimen: a family that is not installed renders the
    // fallback the pick would actually produce, so the preview never lies.
    entries.push({
      id: preset.id,
      label: <span style={{ fontFamily: presetPreview(preset.id, role) }}>{t(preset.label)}</span>,
    })
  }
  entries.push({ type: 'separator', id: 'font-custom' })
  entries.push({ id: CUSTOM_FONT, label: <span style={{ fontFamily: 'inherit' }}>{t('font.custom')}</span> })

  const preset = FONT_PRESETS.find(entry => entry.id === row)
  const triggerText = row === CUSTOM_FONT ? t('font.custom')
    : row === SYSTEM_FONT ? t('font.system')
      : row === INHERIT_FONT ? t('font.inherit')
        : preset === undefined ? t('font.custom') : t(preset.label)

  const select = (id: string): void => {
    setOpen(false)
    if (id === CUSTOM_FONT) {
      setRevealed(true)
      setFocusPending(true)
      return
    }
    setRevealed(false)
    onSelect(id)
  }

  return (
    <div style={ROW_STYLE}>
      <div style={ROW_TEXT_STYLE}>
        <div style={LABEL_STYLE}>{t(labelKey)}</div>
        <div style={HINT_STYLE}>{t(editing ? 'page.fontCustomHint' : hintKey)}</div>
        {editing ? (
          <div style={{ paddingTop: '6px' }}>
            <Input
              key={custom}
              type="text"
              defaultValue={custom}
              disabled={disabled}
              autoFocus={focusPending}
              aria-label={t('page.fontCustom')}
              placeholder={CUSTOM_PLACEHOLDER}
              style={URL_STYLE}
              onFocus={() => { setFocusPending(false) }}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
              onBlur={(event) => {
                setFocusPending(false)
                const next = event.currentTarget.value.trim()
                event.currentTarget.value = next
                const committed = row === CUSTOM_FONT
                // Opening the field and leaving it empty is a change of mind, not
                // a request for an empty stack: the previous choice stands and the
                // field folds. Clearing a field that IS the choice is the other
                // case, and it does commit — an empty list resolves to the tail.
                if (!committed && next === '') {
                  setRevealed(false)
                  return
                }
                if (committed && next === custom) return
                onCustom(next)
              }}
            />
          </div>
        ) : null}
      </div>
      <Menu
        open={open}
        autoFocus
        portal
        dense
        align="end"
        items={entries}
        selectedId={row}
        onSelect={select}
        onClose={() => { setOpen(false) }}
        anchor={(
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            style={FONT_TRIGGER_STYLE}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t(labelKey)}
            onClick={() => { setOpen(!open) }}
          >
            <span style={{ ...FONT_TRIGGER_LABEL, fontFamily: stack }}>{triggerText}</span>
            <span style={FONT_CARET_STYLE}><IconChevronDownOutline14 /></span>
          </Button>
        )}
      />
    </div>
  )
}

/**
 * Render this plugin's settings page.
 * @param props - composed slot props.
 * @returns the page element tree.
 */
export function NordSection({ useStore, t, save }: NordSectionProps) {
  const themeEnabled = useStore(s => s.themeEnabled)
  const fontEnabled = useStore(s => s.fontEnabled)
  const uiFont = useStore(s => s.uiFont)
  const uiFontCustom = useStore(s => s.uiFontCustom)
  const codeFont = useStore(s => s.codeFont)
  const codeFontCustom = useStore(s => s.codeFontCustom)
  const balanceEnabled = useStore(s => s.balanceEnabled)
  const refreshSeconds = useStore(s => s.refreshSeconds)
  const baseURL = useStore(s => s.baseURL)
  const writable = useStore(s => s.writable)
  const served = useStore(s => s.served)
  const error = useStore(s => s.error)

  if (!served) return <p style={NOTE_STYLE}>{t('page.unavailable')}</p>

  const disabled = !writable
  const locked = disabled ? t('page.readonly') : undefined
  // Both fields configure the bar, so they follow its own switch.
  const fieldDisabled = disabled || !balanceEnabled
  // The two font rows only do anything while the font layer is on.
  const fontDisabled = disabled || !fontEnabled
  const stacks = fontStacks({ uiFont, uiFontCustom, codeFont, codeFontCustom })
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
        onChange={(next) => { void save(field, next) }}
      />
    </div>
  )

  /**
   * Commit a typed family list. Two fields move, in order: the raw list lands
   * before the choice that reads it, so no observer — this page's mirror, or the
   * `:root` rule beside it — ever sees `custom` pointing at the previous list.
   * The second write waits for the first to settle rather than relying on the
   * scope's queue for that ordering.
   */
  const commitCustom = (role: FontRole, value: string): void => {
    const fields = FONT_FIELDS[role]
    void save(fields.custom, value).then(() => save(fields.choice, CUSTOM_FONT))
  }

  return (
    <section style={PAGE_STYLE} {...{ [SETTINGS_ATTR]: '' }}>
      <h2 style={HEADING_STYLE}>{t('page.title')}</h2>
      <p style={INTRO_STYLE}>{t('page.intro')}</p>

      <h3 style={GROUP_STYLE}>{t('group.appearance')}</h3>
      {toggleRow('page.theme', 'page.themeHint', themeEnabled, 'themeEnabled')}

      <h3 style={GROUP_STYLE}>{t('group.font')}</h3>
      {toggleRow('page.font', 'page.fontHint', fontEnabled, 'fontEnabled')}
      <FontRow
        t={t}
        role="ui"
        labelKey="page.uiFont"
        hintKey="page.uiFontHint"
        choice={uiFont}
        custom={uiFontCustom}
        stack={stacks.ui}
        disabled={fontDisabled}
        allowInherit={false}
        onSelect={(id) => { void save('uiFont', id) }}
        onCustom={(value) => { commitCustom('ui', value) }}
      />
      <FontRow
        t={t}
        role="code"
        labelKey="page.codeFont"
        hintKey="page.codeFontHint"
        choice={codeFont}
        custom={codeFontCustom}
        stack={stacks.code}
        disabled={fontDisabled}
        allowInherit
        onSelect={(id) => { void save('codeFont', id) }}
        onCustom={(value) => { commitCustom('code', value) }}
      />

      <h3 style={GROUP_STYLE}>{t('group.balance')}</h3>
      {toggleRow('page.balance', 'page.balanceHint', balanceEnabled, 'balanceEnabled')}
      <div style={ROW_STYLE}>
        <div style={ROW_TEXT_STYLE}>
          <div style={LABEL_STYLE}>{t('page.refresh')}</div>
          <div style={HINT_STYLE}>{t('page.refreshHint')}</div>
        </div>
        <Input
          key={refreshSeconds}
          type="number"
          min={15}
          max={3600}
          step={1}
          defaultValue={refreshSeconds}
          disabled={fieldDisabled}
          aria-label={t('page.refresh')}
          style={INTERVAL_STYLE}
          onBlur={(event) => {
            const next = Number(event.currentTarget.value)
            if (Number.isInteger(next) && next >= 15 && next <= 3600) {
              if (next !== refreshSeconds) void save('refreshSeconds', next)
              return
            }
            // The draft never became a writable value; put the field back.
            event.currentTarget.value = String(refreshSeconds)
          }}
        />
      </div>
      <div style={ROW_STYLE}>
        <div style={ROW_TEXT_STYLE}>
          <div style={LABEL_STYLE}>{t('page.baseURL')}</div>
          <div style={HINT_STYLE}>{t('page.baseURLHint')}</div>
        </div>
        <Input
          key={baseURL}
          type="text"
          defaultValue={baseURL}
          disabled={fieldDisabled}
          aria-label={t('page.baseURL')}
          style={URL_STYLE}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim()
            event.currentTarget.value = next
            if (next !== '' && next !== baseURL) void save('baseURL', next)
          }}
        />
      </div>
      {disabled ? <p style={NOTE_STYLE}>{t('page.readonly')}</p> : null}
      {error === '' ? null : <p style={ERROR_STYLE}>{t('page.saveFailed')}</p>}
    </section>
  )
}
