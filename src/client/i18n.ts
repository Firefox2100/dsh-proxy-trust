import type { BuiltInLocaleId } from '@deepseek-ai/dsh-client-locale/client'

/** A feature's copy for every locale the web UI ships; a missing translation is a compile error. */
export type Dictionaries<Key extends string> = Record<BuiltInLocaleId, Record<Key, string>>
