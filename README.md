# dsh-proxy-trust

[简体中文](README.zh.md)

`dsh-proxy-trust` lets the DeepSeek Harness (DSH) Web UI run behind a reverse proxy. It is intended for deployments where the proxy handles access, such as Cloudflare Access, and DSH remains bound to a private or loopback address.

The plugin does not replace DSH's connection service. It changes a small set of checks in the running service, and each change has its own setting. Everything is off by default.

Settings are available under `Settings > Reverse proxy`. You can also edit the plugin entry in the profile's `cordis.patch.yml`.

## Requirements

- DSH `>=0.2.2-rc.1 <0.3.0`
- Node.js 22 or later

## Install

```sh
dsh plugin --profile web add dsh-proxy-trust
```

Start the web profile as usual. Values passed with `--trusted-host` continue to work and are combined with the hosts configured by this plugin.

## Configuration

Most changes take effect as soon as they are saved. Enabling `ownsHost` affects the next page load, while changing the extra listener may close and reopen its port.

| Setting | What it does |
|---|---|
| `hosts` | Adds host names that browsers use to reach DSH, such as `app.example` or `app.example:8443`. These are combined with any `--trusted-host` values. |
| `hostsAny` | Accepts any `Host` value. The configured host list is ignored, but DSH's Origin and cross-site checks still run. |
| `skipAuth` | Stops requiring the DSH launch token and session cookie. The URL DSH prints and opens at startup no longer carries a token. The proxy in front of DSH becomes the only login layer. |
| `crossSiteNavigation` | Allows a cross-site top-level `GET` navigation to `/`, `/index.html`, or `/connect`. Fetch requests, uploads, other paths, and WebSocket upgrades do not qualify. |
| `crossSiteReferrers` | Limits cross-site navigation to listed origins, such as `https://team.cloudflareaccess.com`. An empty list places no restriction on the referrer. |
| `ownsHost` | Sets `__DSH_TRANSPORT__.ownsHost` on the page. DSH then exposes features intended for its own machine, such as "Open configuration file," even when the page uses a proxy or network address. |
| `listenEnabled` | Opens a second TCP listener and forwards its connections to DSH's listener. This provides wildcard or network binding without changing DSH's own bind address. |
| `listenAddress` | Sets the address for the extra listener. Empty or `0.0.0.0` means every IPv4 interface; use `::` for IPv6. |
| `listenPort` | Sets the extra listener's port. The default is `3081`, and it must differ from DSH's port. |
| `listenAllow` | Lists the client IP addresses or CIDR ranges allowed to use the extra listener. An empty list allows every client that can reach the port. A non-empty list with no valid entry allows nobody. |

The same settings can be written in the profile patch:

```yaml
# $DSH_HOME/profiles/<name>/cordis.patch.yml
- id: proxy-trust
  name: dsh-proxy-trust
  config:
    hosts:
      - app.example
    skipAuth: true
```

Do not change the row ID. `proxy-trust` is also the settings namespace used by the plugin's UI.

## Using the extra listener

DSH 0.2.2 refuses wildcard bind addresses such as `0.0.0.0`. The optional listener works around that restriction with a plain TCP forwarder inside the DSH process. It passes HTTP, WebSocket, and TLS traffic through without interpreting it, so DSH still performs its normal Host, Origin, token, and cookie checks.

There are a few consequences:

- DSH sees forwarded connections as coming from its own listener, usually `127.0.0.1`. The plugin still uses the real client address for `listenAllow` and refusal logs.
- A remote client can send `Host: localhost` through a listener exposed beyond loopback. The Host check alone is therefore not an access boundary. Use `listenAllow`, a firewall, or an authenticating proxy.
- The listener accepts up to 512 simultaneous connections.
- An invalid address, a port already in use, or a missing bind permission produces a warning. DSH itself keeps running.
- Firewall rules and container port mappings remain your responsibility.

Example with a peer allowlist:

```yaml
- id: proxy-trust
  name: dsh-proxy-trust
  config:
    listenEnabled: true
    listenAddress: 0.0.0.0
    listenPort: 3081
    listenAllow:
      - 100.64.0.0/10
      - 192.168.1.0/24
    hosts:
      - dsh.example.com
```

## Security

`skipAuth` removes DSH's browser login check. Anyone who can reach an accepted host is treated as signed in. When the plugin detects that login is skipped and the instance is reachable beyond localhost, it shows a warning in Settings and writes a warning to the DSH log.

For a remotely reachable deployment, use `skipAuth` only when every route to the instance passes through a proxy that authenticates users. Restrict the listener so clients cannot bypass that proxy. A loopback-only instance can use the option without becoming remotely accessible. If DSH's token login is still useful in your deployment, leave `skipAuth` off and use the other settings independently.

`crossSiteNavigation` is deliberately narrow. It only relaxes DSH's cross-site marker for a document navigation on the three listed paths. The original Host and Origin checks still decide whether the request is trusted.

## Compatibility

The plugin wraps private members of DSH's connection service: the trusted-host list, browser authentication object, and request trust method. Those members are not part of DSH's public plugin API.

Each hook checks the runtime shape before installing. If a DSH update changes an expected member, that feature stays off and the plugin logs a warning instead of stopping DSH. Unloading the plugin restores the original objects and methods.

The package currently supports DSH `>=0.2.2-rc.1 <0.3.0`.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The socket tests open loopback listeners and need an environment that permits local network binding.
