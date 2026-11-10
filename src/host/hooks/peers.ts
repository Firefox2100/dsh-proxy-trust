import type net from 'node:net'
import { isPeerAllowed } from '../forwarder.ts'
import type { Uninstall, Warn } from './shape.ts'

/** The part of a node HTTP server the gate listens on. */
interface ConnectionSource {
  on(event: 'connection', listener: (socket: net.Socket) => void): unknown
  off(event: 'connection', listener: (socket: net.Socket) => void): unknown
}

export interface PeerGateDeps {
  /** Live allowlist; empty switches the gate off. */
  allow(): readonly string[]
  warn: Warn
}

/** What to tell the user when an allowlist is set but cannot be enforced. */
export const PEER_GATE_UNAVAILABLE = 'peer allowlist: the web server has a different shape; connections are not restricted'

const REFUSAL_LOG_INTERVAL_MS = 10_000

function isConnectionSource(value: unknown): value is ConnectionSource {
  return typeof value === 'object' && value !== null
    && typeof (value as ConnectionSource).on === 'function'
    && typeof (value as ConnectionSource).off === 'function'
}

/**
 * Close every TCP connection to DSH's own listener whose peer address is not on
 * the allowlist, before a byte of HTTP is read. The address comes from the
 * socket, so no header can forge it, and the gate covers every route: the page,
 * its files, `/api`, `/connect` and WebSocket upgrades.
 *
 * The list is read per connection, so edits apply to new connections; ones
 * already open stay open until they close. Behind the extra listener DSH sees
 * the forwarder (loopback) as the peer, so use the listener's own allowlist
 * there.
 * @param webServer - the web server service; its node server is read from the private `server` field.
 * @param deps - live settings and the warning sink.
 * @returns the function that removes the gate, or undefined when the web server has another shape (see {@link PEER_GATE_UNAVAILABLE}).
 */
export function installPeerGate(webServer: unknown, deps: PeerGateDeps): Uninstall | undefined {
  const server = (webServer as { server?: unknown } | undefined)?.server
  if (!isConnectionSource(server)) return undefined
  let lastLog = 0
  const gate = (socket: net.Socket): void => {
    const allow = deps.allow()
    if (allow.length === 0 || isPeerAllowed(socket.remoteAddress, allow)) return
    socket.destroy()
    const now = Date.now()
    if (now - lastLog >= REFUSAL_LOG_INTERVAL_MS) {
      lastLog = now
      deps.warn(`peer allowlist: refused a connection from ${socket.remoteAddress ?? 'an unknown address'}`)
    }
  }
  server.on('connection', gate)
  return () => { server.off('connection', gate) }
}
