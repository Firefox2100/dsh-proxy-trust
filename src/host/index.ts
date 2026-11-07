import type { Context } from '@deepseek-ai/cordis'
// Type-only: these declare the `connection` service and the `loader/volatile-update` and `webserver/index-inject` events.
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { EXPOSURE_GLOBAL, type ProxyTrustExposure } from '../shared/ids.ts'
import { normalizeAuthority } from '../shared/authority.ts'
import { isLoopbackAddress, normalizeBindAddress, DEFAULT_LISTEN_ADDRESS } from '../shared/net.ts'
import { Forwarder } from './forwarder.ts'
import { Config } from './config.ts'
import { installCrossSite } from './hooks/cross-site.ts'
import { installHosts } from './hooks/hosts.ts'
import { installSkipAuth } from './hooks/skip-auth.ts'
import type { ConnectionInternals } from './hooks/shape.ts'

export const name = 'dsh-proxy-trust'

/**
 * Declares the page owns its host. The browser half of the connection reads
 * `__DSH_TRANSPORT__.ownsHost` once, and then treats the page as local whatever
 * address it was opened under; a served page never carries the global otherwise.
 */
const OWNS_HOST_SCRIPT = 'globalThis.__DSH_TRANSPORT__=Object.assign({},globalThis.__DSH_TRANSPORT__,{ownsHost:true});'
export { Config }


/**
 * Switch off DSH's checks for a reverse-proxied deployment, each on its own.
 *
 * Nothing here is required at load: the hooks attach once `connection` exists
 * and each one stays inactive, with a warning, when the installed DSH exposes
 * a different shape. Every switch is read per request, so edits made in
 * Settings (or the profile patch) apply without a reload.
 * @param ctx - plugin context.
 * @param config - live settings.
 */
export function apply(ctx: Context, config: Config): void {
  let cliHosts: readonly string[] = []
  const configured = (): string[] => config.hosts.get().flatMap((entry) => {
    const normalized = normalizeAuthority(entry)
    return normalized === undefined ? [] : [normalized]
  })
  // A listener beyond loopback lets anyone on that network send `Host: localhost`, so the
  // host check stops protecting anything: count it as exposure whatever hosts are trusted.
  const listensBeyondLoopback = (): boolean => {
    if (!config.listenEnabled.get()) return false
    const address = normalizeBindAddress(config.listenAddress.get() || DEFAULT_LISTEN_ADDRESS)
    return address !== undefined && !isLoopbackAddress(address)
  }
  // The loader delivers `loader/volatile-update` only to listeners on the plugin's own context, not to
  // those registered inside an `inject` callback, so the callbacks publish their handlers here.
  const onConfigChange = new Set<() => void>()
  ctx.on('loader/volatile-update', () => { for (const handler of [...onConfigChange]) handler() })
  const subscribe = (handler: () => void): (() => void) => {
    onConfigChange.add(handler)
    return () => { onConfigChange.delete(handler) }
  }
  const exposed = (): boolean => config.hostsAny.get() || cliHosts.length > 0 || configured().length > 0 || listensBeyondLoopback()

  ctx.inject(['connection'], (c) => {
    const svc = c.connection as unknown as ConnectionInternals
    const original = svc['trustedHosts']
    cliHosts = Array.isArray(original) ? original.filter((entry): entry is string => typeof entry === 'string') : []
    // The web profile mounts no logger sink, so a warning would vanish; print it as well.
    const warn = (message: string): void => {
      ctx.logger.warn(`dsh-proxy-trust: ${message}`)
      console.warn(`dsh-proxy-trust: ${message}`)
    }
    const installed = [
      installHosts(svc, { any: () => config.hostsAny.get(), hosts: () => config.hosts.get() }, warn),
      installSkipAuth(svc, () => config.skipAuth.get(), warn),
      installCrossSite(svc, { enabled: () => config.crossSiteNavigation.get(), referrers: () => config.crossSiteReferrers.get() }, warn),
    ]
    c.effect(() => () => {
      for (const uninstall of installed.reverse()) uninstall?.()
    }, 'dsh-proxy-trust: connection hooks')

    let warned = false
    const check = (): void => {
      const now = config.skipAuth.get() && exposed()
      if (now && !warned) {
        warn('login is skipped and this instance accepts requests for hosts other than localhost; anyone who can reach it is signed in')
      }
      warned = now
    }
    check()
    c.effect(() => subscribe(check), 'dsh-proxy-trust: exposure warning')
  })

  ctx.inject(['webServer'], (w) => {
    const forwarder = new Forwarder({
      settings: () => ({
        enabled: config.listenEnabled.get(),
        address: config.listenAddress.get(),
        port: config.listenPort.get(),
        allow: config.listenAllow.get(),
      }),
      upstream: () => {
        const port = w.webServer.port
        return port === undefined ? undefined : { host: w.webServer.host, port }
      },
      info: (message) => { console.info(`dsh-proxy-trust: ${message}`) },
      warn: (message) => {
        w.logger.warn(`dsh-proxy-trust: ${message}`)
        console.warn(`dsh-proxy-trust: ${message}`)
      },
    })
    // The listener lives and dies with the web server it forwards to.
    w.effect(() => {
      void forwarder.sync()
      return () => forwarder.dispose()
    }, 'dsh-proxy-trust: extra listener')
    w.effect(() => subscribe(() => { void forwarder.sync() }), 'dsh-proxy-trust: extra listener updates')
    w.on('webserver/index-inject', (table) => {
      const value: ProxyTrustExposure = { cliHosts }
      table.push({ kind: 'global', name: EXPOSURE_GLOBAL, value })
      // Merged into any transport declaration another plugin already made; read once when the page loads.
      if (config.ownsHost.get()) table.push({ kind: 'script', placement: 'head', text: OWNS_HOST_SCRIPT })
    })
  })
}
