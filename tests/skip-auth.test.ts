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
  it('treats a missing interactions parameter as none', () => {
    const svc: Record<string, unknown> = { browserAuth: auth() }
    installSkipAuth(svc, () => true, vi.fn())
    const res = response()
    ;(svc['browserAuth'] as ReturnType<typeof auth>).authorizeConnect({ headers: {} } as never, res as never)
    expect(res.written.status).toBe(302)
    expect(res.written.headers?.['location']).toBe('./api/remote.mux')
  })
  it('refuses a repeated interactions parameter', () => {
    const svc: Record<string, unknown> = { browserAuth: auth() }
    installSkipAuth(svc, () => true, vi.fn())
    const res = response()
    ;(svc['browserAuth'] as ReturnType<typeof auth>).authorizeConnect({ headers: {}, url: '/connect?interactions=answer&interactions=none' } as never, res as never)
    expect(res.written.status).toBe(400)
    expect(res.written.body).toContain('declared once')
  })
  it('passes other members through, bound, while the switch is off', () => {
    const real = Object.assign(auth(), {
      label: 'the real object',
      describe(this: { label: string }) { return this.label },
    })
    const svc: Record<string, unknown> = { browserAuth: real }
    installSkipAuth(svc, () => false, vi.fn())
    const wrapped = svc['browserAuth'] as typeof real
    expect(wrapped.label).toBe('the real object')
    expect(wrapped.describe()).toBe('the real object')
  })
  it('restores the original object', () => {
    const real = auth()
    const svc: Record<string, unknown> = { browserAuth: real }
    installSkipAuth(svc, () => true, vi.fn())?.()
    expect(svc['browserAuth']).toBe(real)
  })
  it('leaves an object replaced by someone else alone', () => {
    const svc: Record<string, unknown> = { browserAuth: auth() }
    const uninstall = installSkipAuth(svc, () => true, vi.fn())
    const replacement = auth()
    svc['browserAuth'] = replacement
    uninstall?.()
    expect(svc['browserAuth']).toBe(replacement)
  })
  it('delegates members it does not know, even while the switch is on', () => {
    const real = Object.assign(auth(), { label: 'the real object' })
    const svc: Record<string, unknown> = { browserAuth: real }
    installSkipAuth(svc, () => true, vi.fn())
    expect((svc['browserAuth'] as typeof real).label).toBe('the real object')
  })
  it('warns and stays inactive on an unknown shape', () => {
    const warn = vi.fn()
    expect(installSkipAuth({ browserAuth: { isAuthenticated: () => true } }, () => true, warn)).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })
})
