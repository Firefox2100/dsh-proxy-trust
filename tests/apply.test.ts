import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/host/index.ts'
import { EXPOSURE_GLOBAL } from '../src/shared/ids.ts'

const volatile = <T>(value: T) => ({ get: () => value })

function mount(overrides: Record<string, unknown> = {}) {
  const injected = new Map<string, (ctx: unknown) => void>()
  const indexListeners: ((table: unknown[]) => void)[] = []
  const config = {
    hostsAny: volatile(false), hosts: volatile<string[]>([]), skipAuth: volatile(false),
    crossSiteNavigation: volatile(false), crossSiteReferrers: volatile<string[]>([]), ownsHost: volatile(false),
    listenEnabled: volatile(false), listenAddress: volatile('0.0.0.0'), listenPort: volatile(3081), listenAllow: volatile<string[]>([]),
    ...overrides,
  }
  const web = {
    on: (event: string, listener: (table: unknown[]) => void) => { if (event === 'webserver/index-inject') indexListeners.push(listener) },
    effect: (setup: () => unknown) => { setup() },
    logger: { warn: vi.fn() },
    webServer: { port: undefined, host: '127.0.0.1' },
  }
  const volatileHandlers: (() => void)[] = []
  const ctx = {
    logger: { warn: vi.fn() },
    on: (event: string, handler: () => void) => { if (event === 'loader/volatile-update') volatileHandlers.push(handler) },
    inject: (names: string[], callback: (ctx: unknown) => void) => { injected.set(names[0] as string, callback) },
  }
  apply(ctx as never, config as never)
  injected.get('webServer')?.(web)
  const connection = {
    connection: { trustedHosts: [] as string[], allowsRemoteAuthorities: false, isTrusted: () => true,
      browserAuth: { isAuthenticated: () => true, authenticateApi: () => undefined, authorizeIndex: () => true, authorizeConnect: () => undefined, authenticatedUrl: (url: string) => url } },
    effect: (setup: () => unknown) => { setup() },
    on: vi.fn(),
  }
  injected.get('connection')?.(connection)
  const configChanged = (): void => { for (const handler of volatileHandlers) handler() }
  const render = (): unknown[] => {
    const table: unknown[] = []
    for (const listener of indexListeners) listener(table)
    return table
  }
  return { render, configChanged }
}

describe('index injection', () => {
  it('always publishes the exposure global and no transport script by default', () => {
    const rows = mount().render() as { kind: string; name?: string }[]
    expect(rows.some(row => row.kind === 'global' && row.name === EXPOSURE_GLOBAL)).toBe(true)
    expect(rows.some(row => row.kind === 'script')).toBe(false)
  })
  it('adds the ownsHost declaration only while switched on, read at render time', () => {
    let on = false
    const { render } = mount({ ownsHost: { get: () => on } })
    expect(render().some(row => (row as { kind: string }).kind === 'script')).toBe(false)
    on = true
    const script = render().find(row => (row as { kind: string }).kind === 'script') as { text: string; placement: string }
    expect(script.placement).toBe('head')
    expect(script.text).toContain('ownsHost:true')
    expect(script.text).toContain('Object.assign({},globalThis.__DSH_TRANSPORT__')
  })
})

describe('exposure warning', () => {
  it('warns when login is skipped and a listener beyond loopback opens, including on a live change', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let listen = false
    const { configChanged } = mount({ skipAuth: volatile(true), listenEnabled: { get: () => listen }, listenAddress: volatile('0.0.0.0') })
    expect(warn).not.toHaveBeenCalled()
    listen = true
    configChanged()
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('login is skipped')
    configChanged()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
  it('does not warn for a loopback-only listener', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mount({ skipAuth: volatile(true), listenEnabled: volatile(true), listenAddress: volatile('127.0.0.2') })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
