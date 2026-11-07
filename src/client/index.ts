import type { Context } from '@deepseek-ai/cordis'
import { registerSettings } from './settings/index.ts'

/** What the browser half needs from the page shell. */
export const inject = ['slots', 'locale', 'configForms']

export function apply(ctx: Context): void {
  registerSettings(ctx)
}
