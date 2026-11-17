import net from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/host/index.ts'
import { EXPOSURE_GLOBAL } from '../src/shared/ids.ts'

const volatile = <T>(value: T) => ({ get: () => value })

function mount(overrides: Record<string, unknown> = {}, options: { webServer?: Record<string, unknown>, service?: Record<string, unknown> } = {}) {
  const injected = new Map<string, (ctx: unknown) => void>()
  const indexListeners: ((table: unknown[]) => void)[] = []
  const cleanups: (() => unknown)[] = []
  const config = {
    hostsAny: volatile(false), hosts: volatile<string[]>([]), skipAuth: volatile(false),
    crossSiteNavigation: volatile(false), crossSiteReferrers: volatile<string[]>([]), ownsHost: volatile(false),
    listenEnabled: volatile(false), listenAddress: volatile('0.0.0.0'), listenPort: volatile(3081), listenAllow: volatile<string[]>([]), peerAllow: volatile<string[]>([]),
    ...overrides,
  }
  const effect = (setup: () => unknown): void => {
    const cleanup = setup()
    if (typeof cleanup === 'function') cleanups.push(cleanup as () => unknown)
  }
  const web = {
    on: (event: string, listener: (table: unknown[]) => void) => { if (event === 'webserver/index-inject') indexListeners.push(listener) },
    effect,
    logger: { warn: vi.fn() },
    webServer: { port: undefined, host: '127.0.0.1', ...options.webServer },
  }
  const volatileHandlers: (() => void)[] = []
  const ctx = {
    logger: { warn: vi.fn() },
    on: (event: string, handler: () => void) => { if (event === 'loader/volatile-update') volatileHandlers.push(handler) },
    inject: (names: string[], callback: (ctx: unknown) => void) => { injected.set(names[0] as string, callback) },
  }
  apply(ctx as never, config as never)
  injected.get('webServer')?.(web)
  const service: Record<string, unknown> = {
    trustedHosts: [] as string[], allowsRemoteAuthorities: false, isTrusted: () => true,
    browserAuth: { isAuthenticated: () => true, authenticateApi: () => undefined, authorizeIndex: () => true, authorizeConnect: () => undefined, authenticatedUrl: (url: string) => url },
    ...options.service,
  }
  const connection = {
    connection: service,
    effect,
    on: vi.fn(),
  }
  injected.get('connection')?.(connection)
  const configChanged = (): void => { for (const handler of volatileHandlers) handler() }
  const render = (): unknown[] => {
    const table: unknown[] = []
    for (const listener of indexListeners) listener(table)
    return table
  }
  const dispose = async (): Promise<void> => {
    for (const cleanup of cleanups.reverse()) await cleanup()
    await new Promise((resolve) => { setTimeout(resolve, 50) })
  }
  return { render, configChanged, dispose, service }
}

async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', () => { resolve() }) })
  const port = (server.address() as net.AddressInfo).port
  await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
  return port
}

async function connectTo(port: number): Promise<net.Socket> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const socket = await new Promise<net.Socket | undefined>((resolve) => {
      const client = net.connect(port, '127.0.0.1', () => { resolve(client) })
      client.once('error', () => { client.destroy(); resolve(undefined) })
    })
    if (socket !== undefined) return socket
    await new Promise((resolve) => { setTimeout(resolve, 25) })
  }
  throw new Error(`the forwarder never listened on ${port}`)
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
  it('does not count a configured entry that is not an authority as exposure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mount({ skipAuth: volatile(true), hosts: volatile(['https://bad.example', '*.example']) })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
  it('counts a configured authority as exposure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mount({ skipAuth: volatile(true), hosts: volatile(['ok.example']) })
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('login is skipped')
    warn.mockRestore()
  })
})

describe('teardown', () => {
  it('restores the connection service when the hooks are released', async () => {
    const { dispose, service } = mount()
    expect(Object.hasOwn(service['trustedHosts'] as string[], 'some')).toBe(true)
    await dispose()
    expect(Object.hasOwn(service['trustedHosts'] as string[], 'some')).toBe(false)
    expect(service['trustedHosts']).toEqual([])
    expect(service['allowsRemoteAuthorities']).toBe(false)
  })
})

describe('peer allowlist notice', () => {
  it('warns once when an allowlist is set but the web server cannot enforce it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { configChanged } = mount({ peerAllow: volatile(['192.0.2.0/24']) })
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('peer allowlist')
    configChanged()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

describe('extra listener', () => {
  it('warns when the configured address is not an IP address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { dispose } = mount({ listenEnabled: volatile(true), listenAddress: volatile('not-an-ip') })
    await vi.waitFor(() => {
      expect(warn.mock.calls.some(call => String(call[0]).includes('is not an IP address'))).toBe(true)
    })
    await dispose()
    warn.mockRestore()
  })
  it('refuses a connection when DSH has no listener port to forward to', async () => {
    const port = await freePort()
    const { dispose } = mount({ listenEnabled: volatile(true), listenAddress: volatile('127.0.0.1'), listenPort: volatile(port) })
    const socket = await connectTo(port)
    await new Promise<void>((resolve) => { socket.once('close', () => { resolve() }) })
    expect(socket.destroyed).toBe(true)
    await dispose()
  })
  it('forwards to the port the web server listens on', async () => {
    const upstream = net.createServer((socket) => { socket.pipe(socket) })
    await new Promise<void>((resolve) => { upstream.listen(0, '127.0.0.1', () => { resolve() }) })
    const upstreamPort = (upstream.address() as net.AddressInfo).port
    const port = await freePort()
    const { dispose } = mount(
      { listenEnabled: volatile(true), listenAddress: volatile('127.0.0.1'), listenPort: volatile(port) },
      { webServer: { port: upstreamPort } },
    )
    const socket = await connectTo(port)
    const reply = await new Promise<string>((resolve) => {
      socket.once('data', (chunk) => { resolve(String(chunk)) })
      socket.write('ping')
    })
    expect(reply).toBe('ping')
    socket.destroy()
    await dispose()
    await new Promise<void>((resolve) => { upstream.close(() => { resolve() }) })
  })
})

describe('web server shapes', () => {
  it('installs the peer gate when the web server exposes its node server', async () => {
    const on = vi.fn()
    const off = vi.fn()
    const { dispose } = mount({ peerAllow: volatile(['192.0.2.0/24']) }, { webServer: { server: { on, off } } })
    expect(on).toHaveBeenCalledWith('connection', expect.any(Function))
    await dispose()
    expect(off).toHaveBeenCalledWith('connection', expect.any(Function))
  })
  it('treats a connection service without a trusted-host list as having none', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { render } = mount({ skipAuth: volatile(true) }, { service: { trustedHosts: new Set(['cli.example']) } })
    const global = (render() as { kind: string; name?: string; value?: { cliHosts?: string[] } }[])
      .find(row => row.kind === 'global' && row.name === EXPOSURE_GLOBAL)
    expect(global?.value?.cliHosts).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('different shape'))
    warn.mockRestore()
  })
  it('counts an empty listen address as the wildcard beyond loopback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mount({ skipAuth: volatile(true), listenEnabled: volatile(true), listenAddress: volatile(''), listenPort: volatile(0) })
    expect(warn.mock.calls.some(call => String(call[0]).includes('login is skipped'))).toBe(true)
    warn.mockRestore()
  })
})
