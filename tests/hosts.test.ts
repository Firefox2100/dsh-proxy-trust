import { describe, expect, it, vi } from 'vitest'
import { installHosts } from '../src/host/hooks/hosts.ts'

const fence = (svc: Record<string, unknown>, host: string): boolean =>
  (svc['trustedHosts'] as string[]).some(entry => entry === host)

function service(cli: string[] = [], allows = false): Record<string, unknown> {
  return { trustedHosts: cli, allowsRemoteAuthorities: allows }
}

describe('installHosts', () => {
  it('accepts command-line and configured hosts together, live', () => {
    const svc = service(['cli.example'])
    let hosts = ['cfg.example']
    installHosts(svc, { any: () => false, hosts: () => hosts }, vi.fn())
    expect(fence(svc, 'cli.example')).toBe(true)
    expect(fence(svc, 'cfg.example')).toBe(true)
    expect(fence(svc, 'evil.example')).toBe(false)
    hosts = ['other.example']
    expect(fence(svc, 'cfg.example')).toBe(false)
    expect(fence(svc, 'other.example')).toBe(true)
  })
  it('ignores entries that are not authorities', () => {
    const svc = service()
    installHosts(svc, { any: () => false, hosts: () => ['https://x.example', '*.example'] }, vi.fn())
    expect((svc['trustedHosts'] as string[]).some(() => true)).toBe(false)
  })
  it('accepts anything in any mode', () => {
    const svc = service()
    let any = false
    installHosts(svc, { any: () => any, hosts: () => [] }, vi.fn())
    expect(fence(svc, 'evil.example')).toBe(false)
    any = true
    expect(fence(svc, 'evil.example')).toBe(true)
  })
  it('reports remote access only when something is trusted', () => {
    const svc = service()
    let hosts: string[] = []
    installHosts(svc, { any: () => false, hosts: () => hosts }, vi.fn())
    expect(svc['allowsRemoteAuthorities']).toBe(false)
    hosts = ['cfg.example']
    expect(svc['allowsRemoteAuthorities']).toBe(true)
  })
  it('restores the original list and flag', () => {
    const svc = service(['cli.example'], true)
    const original = svc['trustedHosts']
    const uninstall = installHosts(svc, { any: () => true, hosts: () => [] }, vi.fn())
    uninstall?.()
    expect(svc['trustedHosts']).toBe(original)
    expect(svc['allowsRemoteAuthorities']).toBe(true)
  })
  it('warns and stays inactive on an unknown shape', () => {
    const warn = vi.fn()
    expect(installHosts({}, { any: () => true, hosts: () => [] }, warn)).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })
})
