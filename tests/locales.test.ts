import { describe, expect, it } from 'vitest'
import { dictionaries } from '../src/client/settings/locales.ts'

describe('settings locales', () => {
  it('covers every locale shipped by DSH with the complete English key set', () => {
    expect(Object.keys(dictionaries)).toEqual(['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])
    const englishKeys = Object.keys(dictionaries.en).sort()
    for (const dictionary of Object.values(dictionaries)) {
      expect(Object.keys(dictionary).sort()).toEqual(englishKeys)
    }
  })
})
