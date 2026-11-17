import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ scopes: [] as unknown[], disposed: 0, fail: false }))

vi.mock('../src/client/settings/controller.ts', () => ({
  ProxyTrustSettingsController: class {
    constructor(scope: unknown) {
      if (mocks.fail) throw new Error('the client kit changed shape')
      mocks.scopes.push(scope)
    }
    inject(): unknown { return { hooks: { proxyTrustSettings: 'the store' } } }
    dispose(): void { mocks.disposed += 1 }
  },
}))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  SettingsForm: (props: { children?: unknown }) => props.children,
  SettingsValueField: () => null,
  Switch: () => null,
}))

import { registerSettings } from '../src/client/settings/index.ts'
import { ProxyTrustSectionSlot } from '../src/client/settings/SectionBoundary.tsx'
import { dictionaries } from '../src/client/settings/locales.ts'
import { ENTRY_ID } from '../src/shared/ids.ts'

const NAMESPACE = 'proxyTrust.settings'

interface Effect { readonly label: string | undefined, readonly cleanup: (() => unknown) | undefined }

function context(scope: unknown = { marker: 'the config form' }) {
  const effects: Effect[] = []
  const registered: { namespace: string, table: unknown }[] = []
  const served: string[][] = []
  const slotPoints: string[] = []
  const slots: { spec: Record<string, unknown>, component: unknown }[] = []
  let requested: string | undefined
  const ctx = {
    effect: (setup: () => unknown, label?: string) => {
      effects.push({ label, cleanup: setup() as (() => unknown) | undefined })
    },
    locale: {
      bind: (namespace: string) => (key: string) => `${namespace}.${key}`,
      register: (namespace: string, table: unknown) => { registered.push({ namespace, table }); return () => undefined },
    },
    configForms: {
      get: (id: string) => { requested = id; return scope },
      whileServed: (ids: string[], run: () => void) => { served.push([...ids]); run(); return () => undefined },
    },
    slots: {
      inject: (point: string, run: () => void) => { slotPoints.push(point); run(); return () => undefined },
      register: (spec: Record<string, unknown>, component: unknown) => { slots.push({ spec, component }); return () => undefined },
    },
  }
  return { ctx, effects, registered, served, slotPoints, slots, requested: () => requested }
}

describe('registerSettings', () => {
  beforeEach(() => {
    mocks.scopes.length = 0
    mocks.disposed = 0
    mocks.fail = false
  })

  it('registers every translation under the section namespace', () => {
    const { ctx, registered } = context()
    registerSettings(ctx as never)
    expect(registered).toHaveLength(1)
    expect(registered[0]?.namespace).toBe(NAMESPACE)
    expect(registered[0]?.table).toBe(dictionaries)
  })

  it('builds the form from the host config form', () => {
    const { ctx, requested } = context()
    registerSettings(ctx as never)
    expect(requested()).toBe(ENTRY_ID)
    expect(mocks.scopes).toHaveLength(1)
  })

  it('adds the section only while the host serves its form', () => {
    const { ctx, served, slotPoints, slots } = context()
    registerSettings(ctx as never)
    expect(served).toEqual([[ENTRY_ID]])
    expect(slotPoints).toEqual(['settings.section'])
    expect(slots).toHaveLength(1)
    const spec = slots[0]?.spec
    expect(spec).toMatchObject({ name: 'settings.section', id: 'proxy-trust', order: 60, locale: NAMESPACE })
    expect((spec?.['label'] as () => string)()).toBe(`${NAMESPACE}.nav`)
    expect((spec?.['inject'] as () => unknown)()).toEqual({ hooks: { proxyTrustSettings: 'the store' } })
    expect(slots[0]?.component).toBe(ProxyTrustSectionSlot)
  })

  it('keeps the section hidden when the form model cannot be built', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.fail = true
    const { ctx, served, slots } = context()
    registerSettings(ctx as never)
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('the section stays hidden')
    expect(served).toEqual([])
    expect(slots).toEqual([])
    warn.mockRestore()
  })

  it('disposes the form when the effect is released', () => {
    const { ctx, effects } = context()
    registerSettings(ctx as never)
    const form = effects.find(effect => effect.label === 'dsh-proxy-trust: settings form')
    expect(form?.cleanup).toBeTypeOf('function')
    form?.cleanup?.()
    expect(mocks.disposed).toBe(1)
  })
})
