import { describe, expect, it, vi } from 'vitest'

const registerSettings = vi.hoisted(() => vi.fn())

vi.mock('../src/client/settings/index.ts', () => ({ registerSettings }))

import { apply, inject } from '../src/client/index.ts'

describe('client entry', () => {
  it('waits for the shell services the settings section needs', () => {
    expect(inject).toEqual(['slots', 'locale', 'configForms'])
  })
  it('registers the settings section', () => {
    const ctx = { marker: 'the browser context' }
    apply(ctx as never)
    expect(registerSettings).toHaveBeenCalledWith(ctx)
  })
})
