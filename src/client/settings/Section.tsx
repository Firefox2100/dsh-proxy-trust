import { SettingsForm, SettingsValueField, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { formLabels, type SettingsLocaleKey } from './locales.ts'
import type { ProxyTrustSettingsFace } from './controller.ts'
import css from './Section.module.css'

export type ProxyTrustSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'proxyTrust.settings'>
  & InjectFace<ProxyTrustSettingsFace>

type Translate = (key: SettingsLocaleKey) => string

function SwitchRow(props: { t: Translate; label: SettingsLocaleKey; hint: SettingsLocaleKey; checked: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  const { t } = props
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <span className={css.rowLabel}>{t(props.label)}</span>
        <p className={css.rowHint}>{t(props.hint)}</p>
      </div>
      <Switch checked={props.checked} label={t(props.label)} disabled={props.disabled} onChange={props.onChange} />
    </div>
  )
}

export function ProxyTrustSection(props: ProxyTrustSectionProps) {
  const { t } = props
  const state = props.useProxyTrustSettings(snapshot => snapshot)
  const locked = !state.writable
  const skipping = state.skipAuth.text === 'true'
  const flag = (field: string) => (next: boolean): void => { props.edit(field, next ? 'true' : 'false') }
  const field = (id: string, label: SettingsLocaleKey, hint: SettingsLocaleKey, placeholder: SettingsLocaleKey, name: 'hosts' | 'crossSiteReferrers' | 'listenAddress' | 'listenPort' | 'listenAllow', disabled: boolean, numeric = false) => (
    <SettingsValueField
      id={id}
      label={t(label)}
      hint={t(hint)}
      placeholder={t(placeholder)}
      {...numeric ? { numeric: true } : {}}
      overriddenLabel={t('overridden')}
      resetLabel={t('reset')}
      invalidLabel={t('invalid')}
      disabled={disabled}
      {...state[name]}
      onEdit={(text) => { props.edit(name, text) }}
      onReset={() => { props.resetField(name) }}
    />
  )
  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      {skipping && state.exposed
        ? (
          <p className={css.warning} role="alert" data-testid="proxy-trust-warning">
            <span className={css.warningTitle}>{t('warningTitle')}</span>
            {t('warningBody')}
          </p>
        )
        : null}
      <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
        <section className={css.group}>
          <h3 className={css.heading}>{t('hostsTitle')}</h3>
          <SwitchRow t={t} label="hostsAny" hint="hostsAnyHint" checked={state.hostsAny.text === 'true'} disabled={locked} onChange={flag('hostsAny')} />
          {field('proxy-trust-hosts', 'hosts', 'hostsHint', 'hostsPlaceholder', 'hosts', locked || state.hostsAny.text === 'true')}
          {state.cliHosts.length > 0 ? <p className={css.cli}>{t('cliHosts')} {state.cliHosts.join(', ')}</p> : null}
        </section>
        <section className={css.group}>
          <h3 className={css.heading}>{t('loginTitle')}</h3>
          <SwitchRow t={t} label="skipAuth" hint="skipAuthHint" checked={skipping} disabled={locked} onChange={flag('skipAuth')} />
        </section>
        <section className={css.group}>
          <h3 className={css.heading}>{t('listenTitle')}</h3>
          <SwitchRow t={t} label="listenEnabled" hint="listenEnabledHint" checked={state.listenEnabled.text === 'true'} disabled={locked} onChange={flag('listenEnabled')} />
          {field('proxy-trust-listen-address', 'listenAddress', 'listenAddressHint', 'listenAddressPlaceholder', 'listenAddress', locked || state.listenEnabled.text !== 'true')}
          {field('proxy-trust-listen-port', 'listenPort', 'listenPortHint', 'listenPortPlaceholder', 'listenPort', locked || state.listenEnabled.text !== 'true', true)}
          {field('proxy-trust-listen-allow', 'listenAllow', 'listenAllowHint', 'listenAllowPlaceholder', 'listenAllow', locked || state.listenEnabled.text !== 'true')}
        </section>
        <section className={css.group}>
          <h3 className={css.heading}>{t('pageTitle')}</h3>
          <SwitchRow t={t} label="ownsHost" hint="ownsHostHint" checked={state.ownsHost.text === 'true'} disabled={locked} onChange={flag('ownsHost')} />
        </section>
        <section className={css.group}>
          <h3 className={css.heading}>{t('crossSiteTitle')}</h3>
          <SwitchRow t={t} label="crossSite" hint="crossSiteHint" checked={state.crossSiteNavigation.text === 'true'} disabled={locked} onChange={flag('crossSiteNavigation')} />
          {field('proxy-trust-referrers', 'referrers', 'referrersHint', 'referrersPlaceholder', 'crossSiteReferrers', locked || state.crossSiteNavigation.text !== 'true')}
        </section>
      </SettingsForm>
    </div>
  )
}
