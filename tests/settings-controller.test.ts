import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsFormScope, SettingsFormScopeSnapshot } from '@deepseek-ai/dsh-client-ui-primitives'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  SettingsFormModel: class {
    private readonly unsubscribe: () => void
    private project: (() => unknown) | undefined

    constructor(private readonly scope: SettingsFormScope<ProxyTrustSettings>, private readonly specs: { field: string; format(value: unknown): string }[]) {
      this.unsubscribe = scope.subscribe(() => undefined)
    }

    bind(project: () => unknown) {
      this.project = project
      return { getSnapshot: () => this.project?.() }
    }

    field(name: string) {
      const value = this.scope.getSnapshot().value?.[name as keyof ProxyTrustSettings]
      const spec = this.specs.find(candidate => candidate.field === name)
      return { text: spec?.format(value) ?? '', overridden: value !== undefined, invalid: false }
    }

    shell() {
      const snapshot = this.scope.getSnapshot()
      return { available: snapshot.status === 'ready', writable: snapshot.writable, dirty: false, invalid: false, saving: false, failed: false }
    }

    actions() {
      return { edit: vi.fn(), resetField: vi.fn(), save: vi.fn(), discard: vi.fn() }
    }

    dispose() {
      this.unsubscribe()
    }
  },
}))

import { ProxyTrustSettingsController } from '../src/client/settings/controller.ts'
import type { ProxyTrustSettings } from '../src/client/settings/fields.ts'
import { EXPOSURE_GLOBAL } from '../src/shared/ids.ts'

function setup(value: ProxyTrustSettings = {}) {
  let listener: (() => void) | undefined
  const unsubscribe = vi.fn()
  const snapshot: SettingsFormScopeSnapshot<ProxyTrustSettings> = {
    status: 'ready',
    value,
    base: {},
    user: value,
    writable: true,
    revision: 1,
  }
  const scope: SettingsFormScope<ProxyTrustSettings> = {
    getSnapshot: () => snapshot,
    subscribe: (next) => {
      listener = next
      return unsubscribe
    },
    mutate: vi.fn(async () => true),
  }
  const controller = new ProxyTrustSettingsController(scope)
  return { controller, face: controller.inject(), listener: () => listener, unsubscribe }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[EXPOSURE_GLOBAL]
})

describe('ProxyTrustSettingsController', () => {
  it('projects form fields and CLI hosts into the settings state', () => {
    ;(globalThis as Record<string, unknown>)[EXPOSURE_GLOBAL] = { cliHosts: ['proxy.example'] }
    const { controller, face, unsubscribe } = setup({ hosts: ['configured.example'] })
    const state = face.hooks.proxyTrustSettings.getSnapshot()

    expect(state.available).toBe(true)
    expect(state.hosts.text).toBe('configured.example')
    expect(state.cliHosts).toEqual(['proxy.example'])
    expect(state.exposed).toBe(true)

    controller.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('treats a non-loopback or invalid enabled listener as exposed', () => {
    for (const listenAddress of ['0.0.0.0', 'not-an-ip']) {
      const { controller, face } = setup({ listenEnabled: true, listenAddress })
      expect(face.hooks.proxyTrustSettings.getSnapshot().exposed).toBe(true)
      controller.dispose()
    }
  })

  it('keeps a loopback-only default configuration unexposed', () => {
    const { controller, face } = setup({ listenEnabled: true, listenAddress: '127.0.0.1' })
    const state = face.hooks.proxyTrustSettings.getSnapshot()

    expect(state.exposed).toBe(false)
    expect(state.skipAuth.text).toBe('false')
    expect(state.listenPort.text).toBe('')

    controller.dispose()
  })
})
