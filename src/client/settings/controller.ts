import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  SettingsFormModel,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormScope,
  type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { EXPOSURE_GLOBAL, type ProxyTrustExposure } from '../../shared/ids.ts'
import { DEFAULT_LISTEN_ADDRESS, isLoopbackAddress, normalizeBindAddress } from '../../shared/net.ts'
import { hostsField, listenAddressField, listenAllowField, listenPortField, referrersField, switchField, type ProxyTrustSettings } from './fields.ts'

export interface ProxyTrustSettingsState extends SettingsFormShell {
  hostsAny: SettingsFieldState
  hosts: SettingsFieldState
  skipAuth: SettingsFieldState
  crossSiteNavigation: SettingsFieldState
  crossSiteReferrers: SettingsFieldState
  ownsHost: SettingsFieldState
  listenEnabled: SettingsFieldState
  listenAddress: SettingsFieldState
  listenPort: SettingsFieldState
  listenAllow: SettingsFieldState
  /** Authorities accepted because of `--trusted-host`; read-only here. */
  cliHosts: readonly string[]
  /** Whether, as staged, the instance accepts requests for hosts other than localhost. */
  exposed: boolean
}

export interface ProxyTrustSettingsFace extends SettingsFormActions {
  hooks: {
    /** Bound by the renderer as `useProxyTrustSettings`. */
    proxyTrustSettings: SnapshotStore<ProxyTrustSettingsState>
  }
}

/** Reads what the host placed on the page; empty when absent (a host without the plugin's index row). */
function cliHostsOnPage(): readonly string[] {
  const exposure = (globalThis as Record<string, unknown>)[EXPOSURE_GLOBAL] as Partial<ProxyTrustExposure> | undefined
  return Array.isArray(exposure?.cliHosts) ? exposure.cliHosts : []
}

/** Stages the reverse-proxy form over the host plugin's configuration entry. */
export class ProxyTrustSettingsController {
  private readonly form: SettingsFormModel<ProxyTrustSettings>
  private readonly store: SnapshotStore<ProxyTrustSettingsState>

  constructor(scope: SettingsFormScope<ProxyTrustSettings>) {
    this.form = new SettingsFormModel(scope, [
      switchField('hostsAny'),
      hostsField,
      switchField('skipAuth'),
      switchField('crossSiteNavigation'),
      referrersField,
      switchField('ownsHost'),
      switchField('listenEnabled'),
      listenAddressField,
      listenPortField,
      listenAllowField,
    ])
    this.store = this.form.bind(() => {
      const hostsAny = this.form.field('hostsAny')
      const hosts = this.form.field('hosts')
      const cliHosts = cliHostsOnPage()
      const listenEnabled = this.form.field('listenEnabled')
      const listenAddress = this.form.field('listenAddress')
      // An address that does not parse is shown as exposed: the save is blocked, but the warning errs safe.
      const bound = normalizeBindAddress(listenAddress.text.trim() === '' ? DEFAULT_LISTEN_ADDRESS : listenAddress.text)
      const listensBeyondLoopback = listenEnabled.text === 'true' && (bound === undefined || !isLoopbackAddress(bound))
      return {
        ...this.form.shell(),
        hostsAny,
        hosts,
        skipAuth: this.form.field('skipAuth'),
        crossSiteNavigation: this.form.field('crossSiteNavigation'),
        crossSiteReferrers: this.form.field('crossSiteReferrers'),
        ownsHost: this.form.field('ownsHost'),
        listenEnabled,
        listenAddress,
        listenPort: this.form.field('listenPort'),
        listenAllow: this.form.field('listenAllow'),
        cliHosts,
        exposed: hostsAny.text === 'true' || hosts.text.trim() !== '' || cliHosts.length > 0 || listensBeyondLoopback,
      }
    })
  }

  inject(): ProxyTrustSettingsFace {
    return { hooks: { proxyTrustSettings: this.store }, ...this.form.actions() }
  }

  dispose(): void {
    this.form.dispose()
  }
}
