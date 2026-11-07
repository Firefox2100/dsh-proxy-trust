import type { ConnectionInternals, HeaderBag, Uninstall, Warn } from './shape.ts'

const METHODS = ['isAuthenticated', 'authenticateApi', 'authorizeIndex', 'authorizeConnect', 'authenticatedUrl'] as const

interface IndexRequest {
  readonly headers: HeaderBag
  readonly url?: string | undefined
}

interface Response {
  writeHead(status: number, headers?: Readonly<Record<string, string>>): unknown
  end(body?: string): unknown
}

/**
 * The `/connect` answer while login is skipped: the same redirect the real
 * exchange ends with, minus the cookie there is nothing to sign. The one
 * client-visible rule of the real handler (`interactions` is declared once, as
 * `answer` or `none`) is kept so clients get the same 400.
 * @param request - the `/connect` request.
 * @param response - the response to complete.
 */
function connectRedirect(request: IndexRequest, response: Response): void {
  const url = new URL(request.url ?? '/', 'http://dsh.invalid')
  const declared = url.searchParams.getAll('interactions')
  const interactions = declared[0] ?? 'none'
  if (declared.length > 1 || (interactions !== 'answer' && interactions !== 'none')) {
    response.writeHead(400, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' })
    response.end('interactions must be declared once as answer or none\n')
    return
  }
  response.writeHead(302, { 'cache-control': 'no-store', 'location': './api/remote.mux', 'referrer-policy': 'no-referrer' })
  response.end()
}

/**
 * Stop asking for the launch token and the session cookie while `enabled()` is true.
 *
 * The connection service reaches authentication through one object with five
 * methods. That object is wrapped by a Proxy that answers all five of them itself
 * while the switch is on and delegates everything otherwise, so a toggle needs
 * no reload. The Host fence still runs before authentication on `/api` and
 * `/connect`.
 * @param svc - the connection service.
 * @param enabled - live switch.
 * @param warn - receives the reason when the hook cannot install.
 * @returns the function that restores the original object, or undefined when not installed.
 */
export function installSkipAuth(svc: ConnectionInternals, enabled: () => boolean, warn: Warn): Uninstall | undefined {
  const real = svc['browserAuth']
  const complete = typeof real === 'object' && real !== null
    && METHODS.every(method => typeof (real as Record<string, unknown>)[method] === 'function')
  if (!complete) {
    warn('skip login: the connection service has a different shape; login is not skipped')
    return undefined
  }
  const target = real as Record<string | symbol, unknown>
  const wrapper = new Proxy(target, {
    get(_target, property) {
      if (enabled()) {
        if (property === 'isAuthenticated' || property === 'authorizeIndex') return () => true
        if (property === 'authenticateApi') return () => undefined
        // Nothing consumes a launch token now, so the printed/opened URL carries none.
        if (property === 'authenticatedUrl') return (baseUrl: string) => baseUrl
        if (property === 'authorizeConnect') return connectRedirect
      }
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  })
  svc['browserAuth'] = wrapper
  return () => {
    if (svc['browserAuth'] === wrapper) svc['browserAuth'] = real
  }
}
