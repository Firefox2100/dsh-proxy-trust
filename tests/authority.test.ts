import { describe, expect, it } from 'vitest'
import { normalizeAuthority, normalizeOrigin, splitEntries } from '../src/shared/authority.ts'

describe('normalizeAuthority', () => {
  it('accepts bare hosts, ports and bracketed IPv6', () => {
    expect(normalizeAuthority('App.Example')).toBe('app.example')
    expect(normalizeAuthority(' app.example:8443 ')).toBe('app.example:8443')
    expect(normalizeAuthority('[::1]:3080')).toBe('[::1]:3080')
    expect(normalizeAuthority('10.0.0.5')).toBe('10.0.0.5')
  })
  it.each(['', 'https://app.example', 'app.example/ui', 'user@app.example', '*.example', 'a b', 'app.example?x=1', 'app.example#f'])('rejects %j', (entry) => {
    expect(normalizeAuthority(entry)).toBeUndefined()
  })
})

describe('splitEntries / normalizeOrigin', () => {
  it('splits on commas, spaces and new lines', () => {
    expect(splitEntries('a.example, b.example\nc.example  d.example')).toEqual(['a.example', 'b.example', 'c.example', 'd.example'])
  })
  it('keeps only the origin of a URL', () => {
    expect(normalizeOrigin('https://team.cloudflareaccess.com/cdn-cgi/access/login')).toBe('https://team.cloudflareaccess.com')
    expect(normalizeOrigin('team.cloudflareaccess.com')).toBeUndefined()
    expect(normalizeOrigin('ftp://x.example')).toBeUndefined()
  })
})
