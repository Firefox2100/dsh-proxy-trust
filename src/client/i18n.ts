import type { BuiltInLocaleId } from '@deepseek-ai/dsh-client-locale/client'

/** Baseline locales plus the language packs shipped by current DSH releases. */
export type SupportedLocaleId = BuiltInLocaleId | 'ja' | 'es' | 'fr' | 'de' | 'ru' | 'pt'

/** A feature's copy for every locale the web UI ships; a missing translation is a compile error. */
export type Dictionaries<Key extends string> = Record<SupportedLocaleId, Record<Key, string>>
