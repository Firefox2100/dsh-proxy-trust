/** Address the extra listener binds when none is given: every IPv4 interface. */
export const DEFAULT_LISTEN_ADDRESS = '0.0.0.0'

/** Port the extra listener uses when none is given; the real listener keeps its own. */
export const DEFAULT_LISTEN_PORT = 3081

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function ipv4Octets(text: string): number[] | undefined {
  const match = IPV4.exec(text)
  if (match === null) return undefined
  const octets = match.slice(1).map(Number)
  return octets.every(octet => octet <= 255) ? octets : undefined
}

function isIpv6(text: string): boolean {
  if (!text.includes(':') || !/^[0-9a-f:.]+$/.test(text)) return false
  try {
    return new URL(`http://[${text}]/`).hostname !== ''
  } catch {
    return false
  }
}

/**
 * Normalize an IP literal to lowercase text.
 * @param entry - text typed by the user.
 * @returns the address, or undefined when it is neither an IPv4 nor an IPv6 literal.
 */
export function normalizeBindAddress(entry: string): string | undefined {
  const text = entry.trim().toLowerCase()
  if (ipv4Octets(text) !== undefined || isIpv6(text)) return text
  return undefined
}

/**
 * Whether a bind address keeps the listener on this machine (127/8, `::1` and their mapped forms).
 * @param address - an IP literal.
 * @returns true for loopback addresses.
 */
export function isLoopbackAddress(address: string): boolean {
  const text = address.trim().toLowerCase()
  const tail = text.startsWith('::ffff:') ? text.slice(7) : text
  const octets = ipv4Octets(tail)
  if (octets !== undefined) return octets[0] === 127
  return text === '::1'
}

/**
 * Normalize one allowlist entry: an address, or an address with a prefix length.
 * @param entry - `10.0.0.5`, `10.0.0.0/8`, `fd00::/8` and the like.
 * @returns the entry in lowercase, or undefined when it is not one.
 */
export function normalizeCidr(entry: string): string | undefined {
  const text = entry.trim().toLowerCase()
  const slash = text.indexOf('/')
  const address = slash === -1 ? text : text.slice(0, slash)
  if (normalizeBindAddress(address) === undefined) return undefined
  if (slash === -1) return text
  const prefix = text.slice(slash + 1)
  if (!/^\d{1,3}$/.test(prefix)) return undefined
  const max = ipv4Octets(address) === undefined ? 128 : 32
  return Number(prefix) <= max ? text : undefined
}
