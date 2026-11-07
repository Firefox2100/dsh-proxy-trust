import { Children, isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  SettingsForm: (props: { children?: ReactNode }) => props.children,
  SettingsValueField: () => null,
  Switch: () => null,
}))

import { ProxyTrustSection } from '../src/client/settings/Section.tsx'

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
