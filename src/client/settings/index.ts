import type { Context } from '@deepseek-ai/cordis'
// Type-only: these pull in the Context and SlotMap augmentations this feature relies on.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { ENTRY_ID } from '../../shared/ids.ts'
import { ProxyTrustSettingsController } from './controller.ts'
import { dictionaries, type SettingsLocaleKey } from './locales.ts'
import { ProxyTrustSection } from './Section.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'proxyTrust.settings': SettingsLocaleKey
  }
}

const NAMESPACE = 'proxyTrust.settings'

/** Adds the Reverse proxy section to the settings modal. */
export function registerSettings(ctx: Context): void {
  const t = ctx.locale.bind(NAMESPACE)
  ctx.effect(() => ctx.locale.register(NAMESPACE, dictionaries), 'dsh-proxy-trust: settings dictionaries')

  const controller = new ProxyTrustSettingsController(ctx.configForms.get(ENTRY_ID))
  ctx.effect(() => () => { controller.dispose() }, 'dsh-proxy-trust: settings form')

  // The section only exists while the host plugin is loaded and serves its form.
  ctx.effect(
    () => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject('settings.section', () =>
      ctx.slots.register({
        name: 'settings.section',
        id: 'proxy-trust',
        order: 60,
        label: () => t('nav'),
        locale: NAMESPACE,
        inject: () => controller.inject(),
      }, ProxyTrustSection))),
    'dsh-proxy-trust: settings section',
  )
}
