/**
 * Normalize one trusted-host entry to a bare `host` or `host:port` authority
 * (IPv6 literals in brackets), lowercased.
 * @param entry - text typed by the user or read from the configuration.
 * @returns the normalized authority, or undefined when the text is not one.
 */
export function normalizeAuthority(entry: string): string | undefined {
  const text = entry.trim().toLowerCase()
  if (text === '' || /[\s/\\@?#*]/.test(text)) return undefined
  try {
    // Parse only to reject text that is not a host or host:port at all; the separator check
    // above already rules out userinfo, paths, queries and fragments.
    // A default port disappears from `url.host`; the typed text is what the user meant, so keep it.
    new URL(`http://${text}`)
  } catch {
    return undefined
  }
  return text
}

/**
 * Split a list typed as text (commas, spaces or new lines) into entries.
 * @param text - the draft text.
 * @returns the non-empty entries, untouched.
 */
export function splitEntries(text: string): string[] {
  return text.split(/[\s,]+/).filter(entry => entry !== '')
}

/**
 * Normalize an allowed referrer to its origin.
 * @param entry - a URL such as `https://team.cloudflareaccess.com` (any path is dropped).
 * @returns the origin, or undefined when the text is not an http(s) URL.
 */
export function normalizeOrigin(entry: string): string | undefined {
  try {
    const url = new URL(entry.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined
  } catch {
    return undefined
  }
}
