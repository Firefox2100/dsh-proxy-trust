import { describe, expect, it } from 'vitest'
import {
  hostsField,
  listenAddressField,
  listenAllowField,
  listenPortField,
  listField,
  referrersField,
  switchField,
} from '../src/client/settings/fields.ts'

describe('settings field conversions', () => {
  it('stores only enabled switches', () => {
    const field = switchField('enabled')
    expect(field.field).toBe('enabled')
    expect(field.format(true)).toBe('true')
    expect(field.format(false)).toBe('false')
    expect(field.format(undefined)).toBe('false')
    expect(field.parse('true')).toEqual({ kind: 'set', value: true })
    expect(field.parse('false')).toEqual({ kind: 'clear' })
  })

  it('formats, clears, normalizes, and rejects list fields', () => {
    const field = listField('items', entry => entry === 'bad' ? undefined : entry.toUpperCase())
    expect(field.format(['one', 2, 'two'])).toBe('one, two')
    expect(field.format('one')).toBe('')
    expect(field.parse('  ')).toEqual({ kind: 'clear' })
    expect(field.parse('one, two')).toEqual({ kind: 'set', value: ['ONE', 'TWO'] })
    expect(field.parse('one, bad')).toBeUndefined()
  })

  it('validates host authorities and referrer origins', () => {
    expect(hostsField.parse('proxy.example:8443, [::1]')).toEqual({
      kind: 'set',
      value: ['proxy.example:8443', '[::1]'],
    })
    expect(hostsField.parse('https://proxy.example')).toBeUndefined()
    expect(referrersField.parse(' https://login.example/path ')).toEqual({
      kind: 'set',
      value: ['https://login.example/path'],
    })
    expect(referrersField.parse('not a URL')).toBeUndefined()
  })

  it('accepts IP listener addresses and rejects hostnames', () => {
    expect(listenAddressField.format('::1')).toBe('::1')
    expect(listenAddressField.format(42)).toBe('')
    expect(listenAddressField.parse(' ')).toEqual({ kind: 'clear' })
    expect(listenAddressField.parse(' 127.0.0.1 ')).toEqual({ kind: 'set', value: '127.0.0.1' })
    expect(listenAddressField.parse('proxy.example')).toBeUndefined()
  })

  it('accepts whole ports in range', () => {
    expect(listenPortField.format(3081)).toBe('3081')
    expect(listenPortField.format('3081')).toBe('')
    expect(listenPortField.parse('')).toEqual({ kind: 'clear' })
    expect(listenPortField.parse(' 65535 ')).toEqual({ kind: 'set', value: 65535 })
    expect(listenPortField.parse('0')).toBeUndefined()
    expect(listenPortField.parse('65536')).toBeUndefined()
    expect(listenPortField.parse('1.5')).toBeUndefined()
  })

  it('normalizes listener CIDR allowlists', () => {
    expect(listenAllowField.parse('127.0.0.1, 2001:db8::/32')).toEqual({
      kind: 'set',
      value: ['127.0.0.1', '2001:db8::/32'],
    })
    expect(listenAllowField.parse('127.0.0.1/99')).toBeUndefined()
  })
})
