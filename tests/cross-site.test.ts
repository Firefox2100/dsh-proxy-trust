import { describe, expect, it, vi } from 'vitest'
import { installCrossSite, isAllowedNavigation } from '../src/host/hooks/cross-site.ts'

const nav = (extra: Record<string, string> = {}, method = 'GET', url = '/') => ({
  method,
  url,
  headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', ...extra },
})

describe('isAllowedNavigation', () => {
  it('accepts a cross-site GET page load on the document and the token exchange', () => {
    expect(isAllowedNavigation(nav(), [])).toBe(true)
    expect(isAllowedNavigation(nav({}, 'GET', '/connect?interactions=answer'), [])).toBe(true)
  })
  it.each([
    ['POST', nav({}, 'POST')],
    ['fetch mode', nav({ 'sec-fetch-mode': 'cors' })],
    ['non-document dest', nav({ 'sec-fetch-dest': 'empty' })],
    ['api path', nav({}, 'GET', '/api/remote.mux')],
    ['not cross-site', nav({ 'sec-fetch-site': 'same-origin' })],
  ])('refuses %s', (_label, request) => {
    expect(isAllowedNavigation(request, [])).toBe(false)
  })
  it('requires a listed referrer origin when any are configured', () => {
    const list = ['https://team.cloudflareaccess.com']
    expect(isAllowedNavigation(nav({ referer: 'https://team.cloudflareaccess.com/cdn-cgi/access/authorized' }), list)).toBe(true)
    expect(isAllowedNavigation(nav({ referer: 'https://evil.example/' }), list)).toBe(false)
    expect(isAllowedNavigation(nav(), list)).toBe(false)
  })
  it('reads Fetch headers too', () => {
    const request = { method: 'GET', url: '/', headers: new Headers({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' }) }
    expect(isAllowedNavigation(request, [])).toBe(true)
  })
})

describe('installCrossSite', () => {
  function service() {
    const seen: unknown[] = []
    const svc: Record<string, unknown> = {}
    Object.setPrototypeOf(svc, { isTrusted(request: { headers: Record<string, string> }) { seen.push(request.headers['sec-fetch-site']); return request.headers['sec-fetch-site'] !== 'cross-site' } })
    return { svc, seen }
  }
  it('hides the marker only from allowed page loads and only while switched on', () => {
    const { svc, seen } = service()
    let on = false
    installCrossSite(svc, { enabled: () => on, referrers: () => [] }, vi.fn())
    const trusted = svc['isTrusted'] as (request: unknown) => boolean
    expect(trusted.call(svc, nav())).toBe(false)
    on = true
    expect(trusted.call(svc, nav())).toBe(true)
    expect(trusted.call(svc, nav({}, 'GET', '/api/x'))).toBe(false)
    expect(trusted.call(svc, nav({}, 'POST'))).toBe(false)
    expect(seen).toEqual(['cross-site', 'none', 'cross-site', 'cross-site'])
  })
  it('removes its wrapper and leaves the prototype method', () => {
    const { svc } = service()
    installCrossSite(svc, { enabled: () => true, referrers: () => [] }, vi.fn())?.()
    expect(Object.hasOwn(svc, 'isTrusted')).toBe(false)
    expect(typeof svc['isTrusted']).toBe('function')
  })
  it('warns and stays inactive on an unknown shape', () => {
    const warn = vi.fn()
    expect(installCrossSite({}, { enabled: () => true, referrers: () => [] }, warn)).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })
})
