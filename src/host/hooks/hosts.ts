import { normalizeAuthority } from '../../shared/authority.ts'
import type { ConnectionInternals, Uninstall, Warn } from './shape.ts'

/** Live view of the host settings. */
export interface HostsSource {
  any(): boolean
  hosts(): readonly string[]
}

type Predicate = (entry: string, index: number, array: string[]) => unknown

/**
 * Make the Host fence accept the configured authorities next to those given on
 * the command line, or any Host at all.
 *
 * The connection service keeps its accepted authorities in `trustedHosts` and
 * only asks it `some(...)` per request. It is replaced by an array that
 * recomputes its contents from the command-line list plus the live
 * configuration at each question, so edits apply at once. In "any" mode
 * `some` answers true; the Origin and cross-site checks that follow the Host
 * check are untouched.
 * @param svc - the connection service.
 * @param source - live settings.
 * @param warn - receives the reason when the hook cannot install.
 * @returns the function that restores the original state, or undefined when not installed.
 */
export function installHosts(svc: ConnectionInternals, source: HostsSource, warn: Warn): Uninstall | undefined {
  const original = svc['trustedHosts']
  const originalAllows = svc['allowsRemoteAuthorities']
  if (!Array.isArray(original) || typeof originalAllows !== 'boolean') {
    warn('trusted hosts: the connection service has a different shape; host settings are not applied')
    return undefined
  }
  const cli = original.filter((entry): entry is string => typeof entry === 'string')
  const configured = (): string[] => source.hosts().flatMap((entry) => {
    const normalized = normalizeAuthority(entry)
    return normalized === undefined ? [] : [normalized]
  })
  const live: string[] = [...cli]
  const refresh = (): void => {
    live.length = 0
    live.push(...cli, ...configured())
  }
  Object.defineProperty(live, 'some', {
    configurable: true,
    value(predicate: Predicate): boolean {
      if (source.any()) return true
      refresh()
      return Array.prototype.some.call(live, predicate as never)
    },
  })
  svc['trustedHosts'] = live
  const descriptor = Object.getOwnPropertyDescriptor(svc, 'allowsRemoteAuthorities')
  Object.defineProperty(svc, 'allowsRemoteAuthorities', {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => originalAllows || source.any() || configured().length > 0,
  })
  return () => {
    if (svc['trustedHosts'] === live) svc['trustedHosts'] = original
    Object.defineProperty(svc, 'allowsRemoteAuthorities', {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      writable: true,
      value: originalAllows,
    })
  }
}
