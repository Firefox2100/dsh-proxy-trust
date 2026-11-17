import { Children, isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  SettingsForm: (props: { children?: ReactNode }) => props.children,
  SettingsValueField: () => null,
  Switch: () => null,
}))

import { ProxyTrustSection } from '../src/client/settings/Section.tsx'
import { ProxyTrustSectionSlot, SectionBoundary } from '../src/client/settings/SectionBoundary.tsx'

const field = (text = '') => ({ text, overridden: false, invalid: false })

function state(overrides: Record<string, unknown> = {}) {
  return {
    available: true,
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    hostsAny: field(),
    hosts: field(),
    skipAuth: field(),
    crossSiteNavigation: field(),
    crossSiteReferrers: field(),
    ownsHost: field(),
    listenEnabled: field(),
    listenAddress: field(),
    listenPort: field(),
    listenAllow: field(),
    peerAllow: field(),
    cliHosts: [],
    exposed: false,
    ...overrides,
  }
}

/** Executes this small component tree without needing a browser DOM. */
function walk(node: ReactNode): void {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (!isValidElement(node)) {
    Children.forEach(node, walk)
    return
  }
  const props = node.props as Record<string, unknown>
  for (const callback of ['onChange', 'onEdit', 'onReset', 'onSave', 'onDiscard']) {
    if (typeof props[callback] === 'function') (props[callback] as (value?: unknown) => void)(callback === 'onChange' ? true : 'edited')
  }
  if (typeof node.type === 'function') {
    const Component = node.type as (componentProps: Record<string, unknown>) => ReactNode
    walk(Component(props))
    return
  }
  Children.forEach(props.children as ReactNode, walk)
}

function render(settings: ReturnType<typeof state>) {
  const edit = vi.fn()
  const resetField = vi.fn()
  const save = vi.fn()
  const discard = vi.fn()
  const tree = ProxyTrustSection({
    t: (key: string) => key,
    useProxyTrustSettings: (selector: (value: ReturnType<typeof state>) => unknown) => selector(settings),
    edit,
    resetField,
    save,
    discard,
  } as never)
  walk(tree)
  return { tree, edit, resetField, save, discard }
}

describe('ProxyTrustSection', () => {
  it('renders and wires every editable control', () => {
    const result = render(state({
      skipAuth: field('true'),
      exposed: true,
      cliHosts: ['proxy.example'],
      listenEnabled: field('true'),
      crossSiteNavigation: field('true'),
    }))

    expect(result.tree).toBeTruthy()
    expect(result.edit).toHaveBeenCalled()
    expect(result.resetField).toHaveBeenCalled()
    expect(result.save).toHaveBeenCalled()
    expect(result.discard).toHaveBeenCalled()
  })

  it('renders the safe, locked state without optional warnings or CLI hosts', () => {
    const result = render(state({ writable: false }))
    expect(result.tree).toBeTruthy()
    expect(result.edit).toHaveBeenCalled()
  })
})

describe('SectionBoundary', () => {
  const t = (key: string) => key
  const props = (settings: ReturnType<typeof state>) => ({
    t,
    useProxyTrustSettings: (selector: (value: ReturnType<typeof state>) => unknown) => selector(settings),
    edit: vi.fn(),
    resetField: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
  } as never)

  it('passes the section through while nothing has failed', () => {
    const boundary = new SectionBoundary({ t, children: 'child-marker' })
    expect(boundary.render()).toBe('child-marker')
  })

  it('marks itself failed when a child throws', () => {
    expect(SectionBoundary.getDerivedStateFromError()).toEqual({ failed: true })
  })

  it('replaces the section with an alert once it has failed', () => {
    const boundary = new SectionBoundary({ t, children: null })
    boundary.state = { failed: true }
    const tree = boundary.render()
    expect(isValidElement(tree)).toBe(true)
    const alert = (tree as { props: { children: unknown } }).props.children
    expect(isValidElement(alert)).toBe(true)
    const props = (alert as { props: Record<string, unknown> }).props
    expect(props.role).toBe('alert')
    expect(props['data-testid']).toBe('proxy-trust-crashed')
    expect(props.children).toBe('crashed')
  })

  it('logs the failure instead of swallowing it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const boundary = new SectionBoundary({ t, children: null })
    const error = new Error('boom')
    boundary.componentDidCatch(error, { componentStack: 'stack' } as never)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('failed to render'), error, 'stack')
    spy.mockRestore()
  })

  it('registers the guarded slot rather than the bare section', () => {
    const tree = ProxyTrustSectionSlot(props(state()))
    expect(isValidElement(tree)).toBe(true)
    const slot = tree as { type: unknown; props: { children: unknown } }
    expect(slot.type).toBe(SectionBoundary)
    expect(isValidElement(slot.props.children)).toBe(true)
    expect((slot.props.children as { type: unknown }).type).toBe(ProxyTrustSection)
  })
})
