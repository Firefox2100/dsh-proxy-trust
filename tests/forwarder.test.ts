import net from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Forwarder, type ForwarderSettings } from '../src/host/forwarder.ts'

const closers: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const close of closers.splice(0).reverse()) await close()
})

function listen(server: net.Server, port = 0): Promise<number> {
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => { resolve((server.address() as net.AddressInfo).port) })
  })
}

/** A plain TCP server whose accepted sockets are destroyed with it. */
async function upstreamServer(onSocket: (socket: net.Socket) => void): Promise<number> {
  const sockets = new Set<net.Socket>()
  const server = net.createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => { sockets.delete(socket) })
    onSocket(socket)
  })
  const port = await listen(server)
  closers.push(() => new Promise<void>((resolve) => {
    for (const socket of sockets) socket.destroy()
    server.close(() => { resolve() })
  }))
  return port
}

const echoUpstream = (): Promise<number> => upstreamServer((socket) => { socket.pipe(socket) })

function setup(upstreamPort: number | undefined, initial: Partial<ForwarderSettings> = {}) {
  const settings: { -readonly [K in keyof ForwarderSettings]: ForwarderSettings[K] } = {
    enabled: true, address: '127.0.0.1', port: 0, allow: [], ...initial,
  }
  const warn = vi.fn()
  const info = vi.fn()
  const forwarder = new Forwarder({
    settings: () => settings,
    upstream: () => (upstreamPort === undefined ? undefined : { host: '127.0.0.1', port: upstreamPort }),
    warn,
    info,
  })
  closers.push(() => forwarder.dispose())
  return { forwarder, settings, warn, info }
}

function connect(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => { resolve(socket) })
    socket.once('error', reject)
    closers.push(() => { socket.destroy() })
  })
}

function roundTrip(socket: net.Socket, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.once('data', chunk => { resolve(chunk.toString()) })
    socket.once('close', () => { reject(new Error('closed before a reply')) })
    socket.write(text)
  })
}

const closed = (socket: net.Socket): Promise<void> => new Promise((resolve) => { socket.once('close', () => { resolve() }) })

describe('Forwarder', () => {
  it('forwards bytes both ways to the real listener', async () => {
    const { forwarder, info } = setup(await echoUpstream())
    await forwarder.sync()
    const socket = await connect(forwarder.listening!.port)
    expect(await roundTrip(socket, 'hello')).toBe('hello')
    expect(await roundTrip(socket, 'again')).toBe('again')
    expect(info).toHaveBeenCalledOnce()
  })

  it('does nothing while switched off', async () => {
    const { forwarder } = setup(await echoUpstream(), { enabled: false })
    await forwarder.sync()
    expect(forwarder.listening).toBeUndefined()
  })

  it('refuses peers outside the allowlist and serves those inside it', async () => {
    const { forwarder, settings, warn } = setup(await echoUpstream(), { allow: ['10.0.0.0/8'] })
    await forwarder.sync()
    const port = forwarder.listening!.port
    const refused = await connect(port)
    await closed(refused)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('refused'))
    settings.allow = ['127.0.0.0/8']
    expect(await roundTrip(await connect(port), 'ok')).toBe('ok')
  })

  it('reopens on a changed port and closes when switched off, live', async () => {
    const { forwarder, settings } = setup(await echoUpstream())
    await forwarder.sync()
    const first = forwarder.listening!.port
    const probe = net.createServer()
    const free = await listen(probe)
    await new Promise<void>((resolve) => { probe.close(() => { resolve() }) })
    settings.port = free
    await forwarder.sync()
    expect(forwarder.listening?.port).toBe(free)
    expect(free).not.toBe(first)
    settings.enabled = false
    await forwarder.sync()
    expect(forwarder.listening).toBeUndefined()
    await expect(connect(free)).rejects.toThrow()
  })

  it('warns and leaves DSH alone when the port is taken', async () => {
    const holder = net.createServer()
    const taken = await listen(holder)
    closers.push(() => new Promise<void>((resolve) => { holder.close(() => { resolve() }) }))
    const { forwarder, warn } = setup(await echoUpstream(), { port: taken })
    await forwarder.sync()
    expect(forwarder.listening).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('EADDRINUSE'))
  })

  it.each([
    ['an address that is not an IP', { address: 'app.example' }],
    ['a port out of range', { port: 70000 }],
  ])('does not listen for %s', async (_label, bad) => {
    const { forwarder, warn } = setup(await echoUpstream(), bad)
    await forwarder.sync()
    expect(forwarder.listening).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('drops the client when DSH has no listener', async () => {
    const { forwarder } = setup(undefined)
    await forwarder.sync()
    const socket = await connect(forwarder.listening!.port)
    await closed(socket)
  })

  it('closes the other side when one side ends', async () => {
    const { forwarder } = setup(await upstreamServer((socket) => { socket.end('bye') }))
    await forwarder.sync()
    const socket = await connect(forwarder.listening!.port)
    socket.resume()
    await closed(socket)
  })

  it('closes open connections on dispose', async () => {
    const { forwarder } = setup(await echoUpstream())
    await forwarder.sync()
    const socket = await connect(forwarder.listening!.port)
    expect(await roundTrip(socket, 'x')).toBe('x')
    const done = closed(socket)
    await forwarder.dispose()
    await done
    expect(forwarder.listening).toBeUndefined()
  })
})
