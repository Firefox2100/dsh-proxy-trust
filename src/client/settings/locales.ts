import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Dictionaries } from '../i18n.ts'

export type SettingsLocaleKey =
  | 'nav' | 'title' | 'description'
  | 'hostsTitle' | 'hostsAny' | 'hostsAnyHint' | 'hosts' | 'hostsHint' | 'hostsPlaceholder' | 'cliHosts'
  | 'loginTitle' | 'skipAuth' | 'skipAuthHint'
  | 'crossSiteTitle' | 'crossSite' | 'crossSiteHint' | 'referrers' | 'referrersHint' | 'referrersPlaceholder'
  | 'listenTitle' | 'listenEnabled' | 'listenEnabledHint' | 'listenAddress' | 'listenAddressHint' | 'listenAddressPlaceholder' | 'listenPort' | 'listenPortHint' | 'listenPortPlaceholder' | 'listenAllow' | 'listenAllowHint' | 'listenAllowPlaceholder'
  | 'pageTitle' | 'ownsHost' | 'ownsHostHint'
  | 'warningTitle' | 'warningBody'
  | 'overridden' | 'reset' | 'invalid'
  | 'readOnly' | 'unavailable' | 'save' | 'saving' | 'saveFailed'

export const dictionaries: Dictionaries<SettingsLocaleKey> = {
  en: {
    nav: 'Reverse proxy',
    title: 'Reverse proxy',
    description: 'Let this instance be reached through a reverse proxy. Every option is off until you turn it on, and takes effect at once.',
    hostsTitle: 'Hosts',
    hostsAny: 'Trust any host',
    hostsAnyHint: 'Skip the host check completely. The cross-site and origin checks still apply.',
    hosts: 'Trusted hosts',
    hostsHint: 'Host names the browser uses to reach this instance, such as app.example or app.example:8443. Separate several with commas.',
    hostsPlaceholder: 'app.example',
    cliHosts: 'Also trusted from the command line (--trusted-host):',
    loginTitle: 'Login',
    skipAuth: 'Skip login',
    skipAuthHint: 'Do not ask for the launch token or a session cookie. Use this only when the proxy in front already signs users in.',
    crossSiteTitle: 'Cross-site page loads',
    crossSite: 'Accept cross-site page loads',
    crossSiteHint: 'Accept the first page load when the browser arrives from another site, for example the redirect back from an access proxy. Only opening the page and the token exchange are affected.',
    referrers: 'Only from these sites',
    referrersHint: 'Optional. When set, the page load must come from one of these addresses, such as https://team.cloudflareaccess.com. Separate several with commas.',
    referrersPlaceholder: 'https://team.cloudflareaccess.com',
    listenTitle: 'Extra listener',
    listenEnabled: 'Also listen on another address',
    listenEnabledHint: 'DSH refuses to bind every interface (0.0.0.0) itself. This opens a second port that hands each connection to DSH, so it can be reached from other machines. DSH sees these connections as coming from this machine. Also trust the host names people use (Hosts above); with a listener beyond localhost the host check no longer keeps strangers out.',
    listenAddress: 'Address',
    listenAddressPlaceholder: '0.0.0.0',
    listenAddressHint: 'An IP address of this machine. Empty means 0.0.0.0, every IPv4 interface; use :: for IPv6.',
    listenPort: 'Port',
    listenPortPlaceholder: '3081',
    listenPortHint: 'Must differ from the port DSH itself listens on.',
    listenAllow: 'Only these peers',
    listenAllowHint: 'Optional. Addresses or ranges allowed to connect, such as 192.168.1.0/24 or 100.64.0.0/10. Empty allows everyone who can reach the port. Separate several with commas.',
    listenAllowPlaceholder: '192.168.1.0/24',
    pageTitle: 'Browser',
    ownsHost: 'Treat this page as local',
    ownsHostHint: 'Tell the browser it is running on the machine that owns this instance, even when opened through a proxy or a network address. This also unlocks features meant for local use, such as opening the settings file. Takes effect when the page is reloaded.',
    warningTitle: 'Login is skipped and others can reach this instance',
    warningBody: 'Anyone who can reach this instance through a trusted host is signed in without a token. Make sure the proxy in front of it authenticates every visitor.',
    overridden: 'Set',
    reset: 'Reset',
    invalid: 'This is not a valid value.',
    readOnly: 'The settings document is read-only.',
    unavailable: 'These settings are not available.',
    save: 'Save',
    saving: 'Saving…',
    saveFailed: 'The change was not saved.',
  },
  zh: {
    nav: '反向代理',
    title: '反向代理',
    description: '让本实例可以通过反向代理访问。所有选项默认关闭，开启后立即生效。',
    hostsTitle: '主机',
    hostsAny: '信任任意主机',
    hostsAnyHint: '完全跳过主机检查。跨站与来源检查仍然有效。',
    hosts: '受信主机',
    hostsHint: '浏览器访问本实例所用的主机名，例如 app.example 或 app.example:8443。多个用逗号分隔。',
    hostsPlaceholder: 'app.example',
    cliHosts: '另外来自命令行（--trusted-host）的受信主机：',
    loginTitle: '登录',
    skipAuth: '跳过登录',
    skipAuthHint: '不再要求启动令牌或会话 Cookie。仅在前置代理已经完成身份验证时使用。',
    crossSiteTitle: '跨站页面加载',
    crossSite: '接受跨站页面加载',
    crossSiteHint: '当浏览器从其他站点跳转而来（例如访问代理登录后的重定向）时，接受第一次页面加载。只影响打开页面和令牌交换。',
    referrers: '仅限这些站点',
    referrersHint: '可选。设置后，页面加载必须来自其中之一，例如 https://team.cloudflareaccess.com。多个用逗号分隔。',
    referrersPlaceholder: 'https://team.cloudflareaccess.com',
    listenTitle: '额外监听',
    listenEnabled: '同时监听另一个地址',
    listenEnabledHint: 'DSH 自身拒绝绑定所有网卡（0.0.0.0）。此选项会额外开一个端口，把每个连接转交给 DSH，从而允许其他机器访问。DSH 会认为这些连接来自本机。同时请在上面的「主机」中信任大家使用的主机名；监听范围超出本机后，主机检查不再能挡住陌生人。',
    listenAddress: '地址',
    listenAddressPlaceholder: '0.0.0.0',
    listenAddressHint: '本机的 IP 地址。留空表示 0.0.0.0（所有 IPv4 网卡）；IPv6 请填 ::。',
    listenPort: '端口',
    listenPortPlaceholder: '3081',
    listenPortHint: '不能与 DSH 自己监听的端口相同。',
    listenAllow: '仅允许这些来源',
    listenAllowHint: '可选。允许连接的地址或网段，例如 192.168.1.0/24 或 100.64.0.0/10。留空表示任何能访问该端口的人都可连接。多个用逗号分隔。',
    listenAllowPlaceholder: '192.168.1.0/24',
    pageTitle: '浏览器',
    ownsHost: '将此页面视为本机页面',
    ownsHostHint: '告诉浏览器它运行在拥有本实例的机器上，即使通过代理或网络地址打开。这也会开启仅限本机使用的功能，例如打开设置文件。重新加载页面后生效。',
    warningTitle: '已跳过登录，且其他人可以访问本实例',
    warningBody: '任何能通过受信主机访问本实例的人都会无需令牌直接登录。请确保前置代理对每个访问者进行身份验证。',
    overridden: '已设置',
    reset: '重置',
    invalid: '这不是有效的值。',
    readOnly: '设置文档为只读。',
    unavailable: '这些设置当前不可用。',
    save: '保存',
    saving: '正在保存…',
    saveFailed: '修改未能保存。',
  },
}

/**
 * The form frame's copy.
 * @param t - the section's translator.
 * @returns the labels `SettingsForm` renders.
 */
export const formLabels = (t: (key: SettingsLocaleKey) => string): SettingsFormLabels => ({
  unavailable: t('unavailable'),
  readOnly: t('readOnly'),
  saveFailed: t('saveFailed'),
  save: t('save'),
  saving: t('saving'),
})
