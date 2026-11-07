import { describe, expect, it, vi } from 'vitest'
import { installSkipAuth } from '../src/host/hooks/skip-auth.ts'

function auth() {
  return {
    isAuthenticated: vi.fn((..._args: unknown[]) => false),
    authenticateApi: vi.fn((..._args: unknown[]): string | undefined => 'peer'),
    authorizeIndex: vi.fn((..._args: unknown[]) => false),
    authorizeConnect: vi.fn((..._args: unknown[]) => undefined),
    authenticatedUrl: vi.fn((url: string) => `${url}?token=t`),
  }
}

function response() {
  const written: { status?: number; headers?: Record<string, string>; body?: string } = {}
  return {
    written,
    writeHead(status: number, headers?: Record<string, string>) { written.status = status; if (headers) written.headers = headers },
    end(body?: string) { if (body !== undefined) written.body = body },
  }
}

describe('installSkipAuth', () => {
  it('delegates while the switch is off and answers while it is on', () => {
    const real = auth()
    const svc: Record<string, unknown> = { browserAuth: real }
    let on = false
    installSkipAuth(svc, () => on, vi.fn())
    const wrapped = svc['browserAuth'] as typeof real
    expect(wrapped.isAuthenticated({ headers: {} })).toBe(false)
    expect(wrapped.authenticatedUrl('http://x/')).toBe('http://x/?token=t')
    on = true
    expect(wrapped.isAuthenticated({ headers: {} })).toBe(true)
    expect(wrapped.authorizeIndex({ headers: {} })).toBe(true)
    expect(wrapped.authenticateApi({ headers: {} })).toBeUndefined()
    expect(wrapped.authenticatedUrl('http://x/')).toBe('http://x/')
    expect(real.authorizeConnect).not.toHaveBeenCalled()
  })
  it('redirects /connect to the mux without a cookie', () => {
    const svc: Record<string, unknown> = { browserAuth: auth() }
    installSkipAuth(svc, () => true, vi.fn())
    const res = response()
    ;(svc['browserAuth'] as ReturnType<typeof auth>).authorizeConnect({ headers: {}, url: '/connect?interactions=answer' } as never, res as never)
    expect(res.written.status).toBe(302)
    expect(res.written.headers?.['location']).toBe('./api/remote.mux')
    expect(res.written.headers).not.toHaveProperty('set-cookie')
  })
  it('refuses an undeclared interactions value like the real handler', () => {
    const svc: Record<string, unknown> = { browserAuth: auth() }
    installSkipAuth(svc, () => true, vi.fn())
    const res = response()
    ;(svc['browserAuth'] as ReturnType<typeof auth>).authorizeConnect({ headers: {}, url: '/connect?interactions=all' } as never, res as never)
    expect(res.written.status).toBe(400)
  })
  it('restores the original object', () => {
    const real = auth()
    const svc: Record<string, unknown> = { browserAuth: real }
    installSkipAuth(svc, () => true, vi.fn())?.()
    expect(svc['browserAuth']).toBe(real)
  })
  it('warns and stays inactive on an unknown shape', () => {
    const warn = vi.fn()
    expect(installSkipAuth({ browserAuth: { isAuthenticated: () => true } }, () => true, warn)).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })
})
