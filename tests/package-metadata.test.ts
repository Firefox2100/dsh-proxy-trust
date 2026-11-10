import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  icon?: string
  exports?: Record<string, string>
  files?: string[]
}

const locales = ['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt']

describe('DSH package metadata', () => {
  it('exports and publishes its icon and locale resources', () => {
    expect(manifest.icon).toBe('./icon.svg')
    expect(manifest.exports?.['./icon']).toBe('./icon.svg')
    expect(manifest.exports?.['./locale/*.json']).toBe('./locale/*.json')
    expect(manifest.files).toEqual(expect.arrayContaining(['icon.svg', 'locale/*.json']))
  })

  it('uses a supported, compact icon', () => {
    const icon = readFileSync(resolve(root, 'icon.svg'), 'utf8')
    expect(icon).toContain('viewBox="0 0 36 36"')
    expect(icon).toContain('<title')
    expect(icon).toContain('<desc')
    expect(statSync(resolve(root, 'icon.svg')).size).toBeLessThanOrEqual(256 * 1024)
  })

  it.each(locales)('provides non-empty %s display metadata', (locale) => {
    const dictionary = JSON.parse(readFileSync(resolve(root, `locale/${locale}.json`), 'utf8')) as {
      meta?: { title?: string; description?: string }
    }
    expect(dictionary.meta?.title?.trim()).toBeTruthy()
    expect(dictionary.meta?.description?.trim()).toBeTruthy()
  })
})
