import net from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installPeerGate } from '../src/host/hooks/peers.ts'

const servers: net.Server[] = []
afterEach(() => { for (const server of servers.splice(0)) server.close() })

async function listen(): Promise<{ server: net.Server; port: number; accepted: () => number }> {
  let count = 0
  const server = net.createServer((socket) => { socket.once('data', () => { count += 1; socket.end('hi') }) })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return { server, port: (server.address() as net.AddressInfo).port, accepted: () => count }
}

function reach(port: number): Promise<string> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1', () => { socket.write('x') })
    let data = ''
    socket.on('data', (chunk) => { data += String(chunk) })
    socket.on('error', () => { /* a refused connection resets */ })
    socket.on('close', () => { resolve(data) })
  })
}

describe('installPeerGate', () => {
  it('lets everyone in while the list is empty', async () => {
    const { server, port } = await listen()
    let allow: string[] = []
    installPeerGate({ server }, { allow: () => allow, warn: vi.fn() })
    expect(await reach(port)).toBe('hi')
    allow = ['10.0.0.0/8']
    expect(await reach(port)).toBe('')
  })
  it('admits a listed peer, including loopback ranges', async () => {
    const { server, port } = await listen()
    installPeerGate({ server }, { allow: () => ['127.0.0.0/8'], warn: vi.fn() })
    expect(await reach(port)).toBe('hi')
  })
  it('refuses everyone when the list holds no valid entry', async () => {
    const { server, port } = await listen()
    installPeerGate({ server }, { allow: () => ['nonsense'], warn: vi.fn() })
    expect(await reach(port)).toBe('')
  })
  it('logs a refusal once per interval', async () => {
    const { server, port } = await listen()
    const warn = vi.fn()
    installPeerGate({ server }, { allow: () => ['10.0.0.0/8'], warn })
    await reach(port)
    await reach(port)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('127.0.0.1')
  })
  it('stops gating once removed', async () => {
    const { server, port } = await listen()
    const uninstall = installPeerGate({ server }, { allow: () => ['10.0.0.0/8'], warn: vi.fn() })
    uninstall?.()
    expect(await reach(port)).toBe('hi')
  })
  it('stays inactive on a web server of another shape', () => {
    expect(installPeerGate({}, { allow: () => ['10.0.0.0/8'], warn: vi.fn() })).toBeUndefined()
  })
})
