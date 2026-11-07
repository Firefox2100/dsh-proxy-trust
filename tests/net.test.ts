import { describe, expect, it } from 'vitest'
import { isLoopbackAddress, normalizeBindAddress, normalizeCidr } from '../src/shared/net.ts'
import { isPeerAllowed } from '../src/host/forwarder.ts'

describe('normalizeBindAddress', () => {
  it.each(['0.0.0.0', '192.168.1.5', '::', '::1', 'fd00::1', '::ffff:10.0.0.1'])('accepts %s', (entry) => {
    expect(normalizeBindAddress(entry)).toBe(entry)
  })
  it.each(['', 'localhost', '256.1.1.1', '1.2.3', 'app.example', '1.2.3.4:80', 'zz::1', '::1/128'])('rejects %j', (entry) => {
    expect(normalizeBindAddress(entry)).toBeUndefined()
  })
})

describe('isLoopbackAddress', () => {
  it('knows loopback in its spellings', () => {
    for (const address of ['127.0.0.1', '127.9.9.9', '::1', '::ffff:127.0.0.1']) expect(isLoopbackAddress(address)).toBe(true)
    for (const address of ['0.0.0.0', '::', '192.168.1.5', '100.64.0.1']) expect(isLoopbackAddress(address)).toBe(false)
  })
})

describe('normalizeCidr', () => {
  it('accepts addresses and ranges', () => {
    expect(normalizeCidr('10.0.0.0/8')).toBe('10.0.0.0/8')
    expect(normalizeCidr('FD00::/8')).toBe('fd00::/8')
    expect(normalizeCidr('192.168.1.5')).toBe('192.168.1.5')
  })
  it.each(['10.0.0.0/33', 'fd00::/129', '10.0.0.0/', 'host.example', '10.0.0.0/a'])('rejects %j', (entry) => {
    expect(normalizeCidr(entry)).toBeUndefined()
  })
})

describe('isPeerAllowed', () => {
  it('allows everyone when the list is empty', () => {
    expect(isPeerAllowed('203.0.113.7', [])).toBe(true)
  })
  it('matches ranges and single addresses, IPv4-mapped peers included', () => {
    expect(isPeerAllowed('192.168.1.40', ['192.168.1.0/24'])).toBe(true)
    expect(isPeerAllowed('192.168.2.40', ['192.168.1.0/24'])).toBe(false)
    expect(isPeerAllowed('::ffff:192.168.1.40', ['192.168.1.0/24'])).toBe(true)
    expect(isPeerAllowed('100.86.189.45', ['100.64.0.0/10', '10.0.0.1'])).toBe(true)
    expect(isPeerAllowed('fd00::5', ['fd00::/8'])).toBe(true)
  })
  it('allows no one when no entry is valid, or the peer is unknown', () => {
    expect(isPeerAllowed('127.0.0.1', ['not-an-address'])).toBe(false)
    expect(isPeerAllowed(undefined, ['10.0.0.0/8'])).toBe(false)
  })
})
