/**
 * Durable settings schema. Host-only: importing this module is what pulls
 * schemastery into a build, so the browser half takes the interface and the
 * defaults from `config.ts` and never reaches this file.
 */
import z from '@deepseek-ai/schemastery'
import { DEFAULTS, type Config as NordConfig } from './config.ts'

/** Durable schema; also the wire envelope the browser scope validates against. */
export const Config: z<NordConfig> = z.object({
  themeEnabled: z.boolean().default(DEFAULTS.themeEnabled),
  fontEnabled: z.boolean().default(DEFAULTS.fontEnabled),
  balanceEnabled: z.boolean().default(DEFAULTS.balanceEnabled),
  refreshSeconds: z.number().step(1).min(15).max(3600).default(DEFAULTS.refreshSeconds),
  baseURL: z.string().default(DEFAULTS.baseURL),
})
