import { normalizeOrigin } from '../../shared/authority.ts'
import { headerOf, type ConnectionInternals, type HeaderBag, type TrustRequest, type Uninstall, type Warn } from './shape.ts'

/** Live view of the cross-site settings. */
export interface CrossSiteSource {
  enabled(): boolean
  referrers(): readonly string[]
}

/** The only paths a cross-site page load may reach: the document and the token exchange. */
const PAGE_PATHS = new Set(['/', '/index.html', '/connect'])

/**
 * Whether a request is a cross-site top-level page load the source allows.
 * It must be a GET navigation to a document on an allowed path, and, when
 * referrers are configured, arrive from one of them. Fetches, uploads,
 * WebSocket upgrades and every other method never qualify.
 * @param request - the request under decision.
 * @param referrers - configured allowed origins; empty means any.
 * @returns true when the cross-site marker may be ignored.
 */
export function isAllowedNavigation(request: TrustRequest, referrers: readonly string[]): boolean {
  const { headers } = request
  if (request.method !== 'GET') return false
  if (headerOf(headers, 'sec-fetch-site') !== 'cross-site') return false
  if (headerOf(headers, 'sec-fetch-mode') !== 'navigate' || headerOf(headers, 'sec-fetch-dest') !== 'document') return false
  let pathname: string
  try {
    pathname = new URL(request.url ?? '/', 'http://dsh.invalid').pathname
  } catch {
    return false
  }
  if (!PAGE_PATHS.has(pathname)) return false
  if (referrers.length === 0) return true
  const referer = headerOf(headers, 'referer')
  const origin = referer === undefined ? undefined : normalizeOrigin(referer)
  return origin !== undefined && referrers.some(entry => normalizeOrigin(entry) === origin)
}

function withoutCrossSiteMarker(headers: HeaderBag): HeaderBag {
  if (headers instanceof Headers) {
    const copy = new Headers(headers)
    copy.set('sec-fetch-site', 'none')
    return copy
  }
  return { ...headers, 'sec-fetch-site': 'none' }
}

/**
 * Let the connection service's trust check ignore the cross-site marker for
 * allowed page loads. The check is wrapped, not reimplemented: the Host and
 * Origin rules still run on a copy of the request whose marker reads `none`
 * (what typing the address would send).
 * @param svc - the connection service.
 * @param source - live settings.
 * @param warn - receives the reason when the hook cannot install.
 * @returns the function that removes the wrapper, or undefined when not installed.
 */
export function installCrossSite(svc: ConnectionInternals, source: CrossSiteSource, warn: Warn): Uninstall | undefined {
  const original = svc['isTrusted']
  if (typeof original !== 'function') {
    warn('cross-site navigation: the connection service has a different shape; cross-site page loads stay refused')
    return undefined
  }
  const wrapper = function (this: unknown, request: TrustRequest): unknown {
    if (source.enabled() && isAllowedNavigation(request, source.referrers())) {
      return (original as (request: TrustRequest) => unknown).call(this, {
        headers: withoutCrossSiteMarker(request.headers),
        method: request.method,
        url: request.url,
      })
    }
    return (original as (request: TrustRequest) => unknown).call(this, request)
  }
  const hadOwn = Object.hasOwn(svc, 'isTrusted')
  svc['isTrusted'] = wrapper
  return () => {
    if (svc['isTrusted'] !== wrapper) return
    // The method normally lives on the prototype; only put back an own property that was there.
    if (hadOwn) svc['isTrusted'] = original
    else delete svc['isTrusted']
  }
}
