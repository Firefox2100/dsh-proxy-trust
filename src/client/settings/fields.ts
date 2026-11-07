import type { SettingsFieldSpec } from '@deepseek-ai/dsh-client-ui-primitives'
import { normalizeAuthority, normalizeOrigin, splitEntries } from '../../shared/authority.ts'
import { normalizeBindAddress, normalizeCidr } from '../../shared/net.ts'

/** The stored section; every field may be absent when the profile does not set it. */
export interface ProxyTrustSettings {
  hostsAny?: boolean
  hosts?: string[]
  skipAuth?: boolean
  crossSiteNavigation?: boolean
  crossSiteReferrers?: string[]
  ownsHost?: boolean
  listenEnabled?: boolean
  listenAddress?: string
  listenPort?: number
  listenAllow?: string[]
}

/**
 * A switch. Off clears the field so the profile stays clean and the default (off) applies.
 * @param field - field name inside the section.
 * @returns the field's conversion spec.
 */
export function switchField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => (value === true ? 'true' : 'false'),
    parse: text => (text === 'true' ? { kind: 'set', value: true } : { kind: 'clear' }),
  }
}

/**
 * A list typed as comma-separated text. Empty clears the field; one invalid entry blocks the save.
 * @param field - field name inside the section.
 * @param normalize - validates and normalizes one entry.
 * @returns the field's conversion spec.
 */
export function listField(field: string, normalize: (entry: string) => string | undefined): SettingsFieldSpec {
  return {
    field,
    format: value => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').join(', ') : ''),
    parse: (text) => {
      const entries = splitEntries(text)
      if (entries.length === 0) return { kind: 'clear' }
      const normalized = entries.map(normalize)
      return normalized.every(entry => entry !== undefined) ? { kind: 'set', value: normalized } : undefined
    },
  }
}

export const hostsField = listField('hosts', normalizeAuthority)
export const referrersField = listField('crossSiteReferrers', (entry) => {
  const origin = normalizeOrigin(entry)
  return origin === undefined ? undefined : entry.trim()
})

/** The extra listener's address: an IP literal; empty clears it so the default (every IPv4 interface) applies. */
export const listenAddressField: SettingsFieldSpec = {
  field: 'listenAddress',
  format: value => (typeof value === 'string' ? value : ''),
  parse: (text) => {
    const trimmed = text.trim()
    if (trimmed === '') return { kind: 'clear' }
    const address = normalizeBindAddress(trimmed)
    return address === undefined ? undefined : { kind: 'set', value: address }
  },
}

/** The extra listener's port, 1 to 65535; empty clears it so the default applies. */
export const listenPortField: SettingsFieldSpec = {
  field: 'listenPort',
  format: value => (typeof value === 'number' ? String(value) : ''),
  parse: (text) => {
    const trimmed = text.trim()
    if (trimmed === '') return { kind: 'clear' }
    const port = Number(trimmed)
    return /^\d+$/.test(trimmed) && port >= 1 && port <= 65535 ? { kind: 'set', value: port } : undefined
  },
}

export const listenAllowField = listField('listenAllow', normalizeCidr)
