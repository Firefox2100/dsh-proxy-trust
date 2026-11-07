/**
 * The members of DSH's `HostConnectionService` these hooks override. They are
 * not public API (TypeScript `private`, but plain properties at runtime), so
 * each hook checks the shape it needs and stays inactive, with one warning,
 * when a release changes it.
 */
export type ConnectionInternals = Record<string, unknown>

/** Request headers as either the Fetch or the node:http representation. */
export type HeaderBag = Headers | Readonly<Record<string, string | readonly string[] | undefined>>

/** The request facts a trust decision reads; `method` and `url` exist on real requests. */
export interface TrustRequest {
  readonly headers: HeaderBag
  readonly method?: string | undefined
  readonly url?: string | undefined
}

/** Undo one installed hook. */
export type Uninstall = () => void

/** Where a hook reports that it could not install. */
export type Warn = (message: string) => void

/**
 * Read one header.
 * @param headers - Fetch or node:http headers.
 * @param name - lowercase header name.
 * @returns the first value, or undefined.
 */
export function headerOf(headers: HeaderBag, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const value = headers[name]
  if (typeof value === 'string') return value
  return Array.isArray(value) ? (value[0] as string | undefined) : undefined
}
