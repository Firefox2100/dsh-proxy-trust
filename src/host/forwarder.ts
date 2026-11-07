import net from 'node:net'
import { DEFAULT_LISTEN_ADDRESS, normalizeBindAddress, normalizeCidr } from '../shared/net.ts'

/** The extra listener's settings, read live. */
export interface ForwarderSettings {
  readonly enabled: boolean
  readonly address: string
  readonly port: number
  /** Allowed peers (addresses or CIDR ranges); empty allows everyone. */
  readonly allow: readonly string[]
}

/** Where DSH's real listener is. */
export interface Upstream {
  readonly host: string
  readonly port: number
}

export interface ForwarderDeps {
  settings(): ForwarderSettings
  upstream(): Upstream | undefined
  info(message: string): void
  warn(message: string): void
}

/** Simultaneous connections the extra listener accepts. */
const MAX_CONNECTIONS = 512
const KEEPALIVE_MS = 30_000
const REFUSAL_LOG_INTERVAL_MS = 10_000

/**
 * Peer address as the allowlist sees it: IPv4-mapped IPv6 reads as IPv4 and a zone id is dropped.
 * @param address - the socket's remote address.
 * @returns the address and its family.
 */
function peerOf(address: string | undefined): { address: string; family: 'ipv4' | 'ipv6' } | undefined {
  if (address === undefined) return undefined
  let text = address.toLowerCase()
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)
  if (text.startsWith('::ffff:') && net.isIPv4(text.slice(7))) text = text.slice(7)
  if (net.isIPv4(text)) return { address: text, family: 'ipv4' }
  return net.isIPv6(text) ? { address: text, family: 'ipv6' } : undefined
}

/**
 * Whether a peer may connect. An empty list allows everyone; a list with no
 * valid entry allows no one, so a typo never opens the listener.
 * @param peerAddress - the socket's remote address.
 * @param allow - configured allowlist entries.
 * @returns true when the connection may proceed.
 */
export function isPeerAllowed(peerAddress: string | undefined, allow: readonly string[]): boolean {
  if (allow.length === 0) return true
  const peer = peerOf(peerAddress)
  if (peer === undefined) return false
  const list = new net.BlockList()
  let valid = 0
  for (const entry of allow) {
    const normalized = normalizeCidr(entry)
    if (normalized === undefined) continue
    const slash = normalized.indexOf('/')
    const address = slash === -1 ? normalized : normalized.slice(0, slash)
    const family = net.isIPv4(address) ? 'ipv4' : 'ipv6'
    if (slash === -1) list.addAddress(address, family)
    else list.addSubnet(address, Number(normalized.slice(slash + 1)), family)
    valid++
  }
  return valid > 0 && list.check(peer.address, peer.family)
}

/**
 * A second, plain TCP listener that hands every connection to DSH's real
 * listener. DSH refuses to bind a wildcard address itself, but it never looks
 * at the connecting socket's address, so a forwarder is invisible to it: every
 * Host, Origin, token and cookie check runs exactly as on a direct connection.
 * Settings are re-read on `sync()`; a changed address or port reopens the
 * listener, anything else (the allowlist) applies to the next connection.
 */
export class Forwarder {
  private server: net.Server | undefined
  private bound: { address: string; port: number } | undefined
  private readonly sockets = new Set<net.Socket>()
  private chain: Promise<void> = Promise.resolve()
  private refusals = 0
  private lastRefusalLog = 0

  constructor(private readonly deps: ForwarderDeps) {}

  /** The address and port currently listening, or undefined. */
  get listening(): { address: string; port: number } | undefined {
    return this.bound
  }

  /** Bring the listener in line with the current settings; calls queue up and never overlap. */
  sync(): Promise<void> {
    this.chain = this.chain.then(() => this.reconcile()).catch((error: unknown) => {
      this.deps.warn(`extra listener: ${error instanceof Error ? error.message : String(error)}`)
    })
    return this.chain
  }

  /** Close the listener and every connection through it. */
  dispose(): Promise<void> {
    this.chain = this.chain.then(() => this.close())
    return this.chain
  }

  private desired(): { address: string; port: number } | undefined {
    const settings = this.deps.settings()
    if (!settings.enabled) return undefined
    const address = normalizeBindAddress(settings.address === '' ? DEFAULT_LISTEN_ADDRESS : settings.address)
    if (address === undefined) {
      this.deps.warn(`extra listener: "${settings.address}" is not an IP address; not listening`)
      return undefined
    }
    if (!Number.isInteger(settings.port) || settings.port < 0 || settings.port > 65535) {
      this.deps.warn(`extra listener: ${String(settings.port)} is not a port; not listening`)
      return undefined
    }
    return { address, port: settings.port }
  }

  private async reconcile(): Promise<void> {
    const want = this.desired()
    const have = this.bound
    if (want !== undefined && have !== undefined && want.address === have.address && (want.port === have.port || want.port === 0)) return
    await this.close()
    if (want !== undefined) await this.open(want)
  }

  private open(want: { address: string; port: number }): Promise<void> {
    const server = net.createServer({ noDelay: true, keepAlive: true, keepAliveInitialDelay: KEEPALIVE_MS }, socket => { this.accept(socket) })
    server.maxConnections = MAX_CONNECTIONS
    return new Promise<void>((resolve) => {
      server.once('error', (error: NodeJS.ErrnoException) => {
        this.deps.warn(`extra listener: cannot listen on ${want.address}:${String(want.port)} (${error.code ?? error.message}); DSH itself is unaffected`)
        resolve()
      })
      server.listen(want.port, want.address, () => {
        server.on('error', (error) => { this.deps.warn(`extra listener: ${error.message}`) })
        const port = (server.address() as net.AddressInfo).port
        this.server = server
        this.bound = { address: want.address, port }
        this.deps.info(`extra listener: also listening on ${want.address}:${String(port)}, forwarding to DSH`)
        resolve()
      })
    })
  }

  private async close(): Promise<void> {
    const server = this.server
    this.server = undefined
    this.bound = undefined
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
    if (server !== undefined) await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
  }

  private refuse(peer: string | undefined): void {
    this.refusals++
    const now = Date.now()
    if (now - this.lastRefusalLog < REFUSAL_LOG_INTERVAL_MS) return
    this.deps.warn(`extra listener: refused ${String(this.refusals)} connection(s) not on the allowlist, latest from ${peer ?? 'an unknown address'}`)
    this.refusals = 0
    this.lastRefusalLog = now
  }

  private accept(client: net.Socket): void {
    if (!isPeerAllowed(client.remoteAddress, this.deps.settings().allow)) {
      this.refuse(client.remoteAddress)
      client.destroy()
      return
    }
    const target = this.deps.upstream()
    if (target === undefined) {
      client.destroy()
      return
    }
    // Hold the client's bytes until DSH's listener has accepted, so none are lost.
    client.pause()
    const upstream = net.connect({ host: target.host, port: target.port, noDelay: true })
    this.sockets.add(client)
    this.sockets.add(upstream)
    client.setKeepAlive(true, KEEPALIVE_MS)
    upstream.setKeepAlive(true, KEEPALIVE_MS)
    let closed = false
    const teardown = (): void => {
      if (closed) return
      closed = true
      client.destroy()
      upstream.destroy()
      this.sockets.delete(client)
      this.sockets.delete(upstream)
    }
    client.on('error', teardown)
    upstream.on('error', teardown)
    client.on('close', teardown)
    upstream.on('close', teardown)
    upstream.once('connect', () => {
      client.pipe(upstream)
      upstream.pipe(client)
      client.resume()
    })
  }
}
