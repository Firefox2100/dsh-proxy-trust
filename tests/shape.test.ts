import { describe, expect, it } from 'vitest'
import { headerOf } from '../src/host/hooks/shape.ts'

describe('headerOf', () => {
  it('reads Fetch headers', () => {
    const headers = new Headers({ 'sec-fetch-site': 'cross-site' })
    expect(headerOf(headers, 'sec-fetch-site')).toBe('cross-site')
    expect(headerOf(headers, 'referer')).toBeUndefined()
  })
  it('reads node:http headers, including repeated values', () => {
    expect(headerOf({ 'sec-fetch-site': 'cross-site' }, 'sec-fetch-site')).toBe('cross-site')
    expect(headerOf({ 'sec-fetch-site': ['cross-site', 'same-origin'] }, 'sec-fetch-site')).toBe('cross-site')
    expect(headerOf({}, 'referer')).toBeUndefined()
    expect(headerOf({ 'content-type': undefined }, 'content-type')).toBeUndefined()
  })
})
