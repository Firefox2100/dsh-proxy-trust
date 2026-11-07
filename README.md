# dsh-proxy-trust

A plugin for DeepSeek Harness (DSH) 0.2.2 that lets the Web UI be reached through a reverse proxy,
for example one that signs users in before forwarding (Cloudflare Access). The plugin stays enabled;
every bypass is a separate switch, all off by default, edited in **Settings → Reverse proxy** or in the
profile's `cordis.patch.yml`. Changes apply to the next request, with no restart.

## Install

```sh
dsh plugin --profile web add dsh-proxy-trust
```

Start the web profile as usual (`--trusted-host` still works and is added to the configured list).

## What it can switch off

| Setting | Effect |
|---|---|
| `hosts` | Host names the browser uses (`app.example`, `app.example:8443`), accepted next to any `--trusted-host`. |
| `hostsAny` | Accept any `Host`. The host list is ignored. The cross-site and origin checks still run. |
| `skipAuth` | Do not ask for the launch token or session cookie. |
| `crossSiteNavigation` | Accept a cross-site top-level page load (the redirect back from an access proxy). Only `GET` page loads of `/`, `/index.html` and `/connect` qualify; fetches, uploads and WebSocket upgrades never do. |
| `crossSiteReferrers` | Optional origins (`https://team.cloudflareaccess.com`) a cross-site page load must come from. |
| `ownsHost` | Tell the browser the page is local (`__DSH_TRANSPORT__.ownsHost`), so features meant for the machine itself, such as "Open configuration file", appear when the page is opened through a proxy or a network address. Applies on the next page load. |

| `listenEnabled` | Also listen on another address and hand every connection to DSH's own listener. DSH refuses to bind `0.0.0.0` itself, so this is how to reach it on every interface. |
| `listenAddress` | Address of the extra listener. Empty or `0.0.0.0` means every IPv4 interface; `::` for IPv6. |
| `listenPort` | Port of the extra listener (default 3081). It cannot share the port DSH listens on. |
| `listenAllow` | Optional peers (`192.168.1.0/24`, `100.64.0.0/10`, single addresses) allowed to connect; empty allows everyone who can reach the port. A list with no valid entry allows no one. |

```yaml
# $DSH_HOME/profiles/<name>/cordis.patch.yml
- id: proxy-trust
  name: dsh-proxy-trust
  config:
    hosts: [app.example]
    skipAuth: true
```

## Extra listener

The listener is a plain TCP forwarder inside the DSH process; it needs no changes to DSH. Host, Origin,
token and cookie checks run exactly as on a direct connection, and TLS passes through untouched. Things to
know:

- DSH sees every forwarded connection as coming from `127.0.0.1`. DSH 0.2.2 never reads the peer address,
  so behavior is unchanged, but its logs and any plugin that reads the address lose the real client. The
  plugin logs refused connections with their real address.
- With a listener beyond loopback, a remote client can send `Host: localhost`, so the host check no longer
  keeps strangers out. Use the allowlist, a firewall, or a proxy that authenticates visitors.
- A taken port, an invalid address or a missing permission is logged and leaves DSH running.
- At most 512 connections at a time. Open the port in your firewall or container mapping.

## Security

With `skipAuth` on and a trusted host (or `hostsAny`) set, anyone who can reach the instance is signed
in. The Settings page shows a warning in that state and the plugin logs one at startup. DSH has no
password of its own: the proxy in front must authenticate every visitor, and the listening port should
only be reachable from that proxy.

## How it works, and its limits

The plugin overrides members of DSH's connection service in the running process (the accepted host list,
the browser-auth object and the trust check). They are not public API, so each hook checks the shape it
needs and stays inactive, with a warning, when a release changes it. Unloading the plugin restores the
originals. Supported: DSH `>=0.2.2-rc.1 <0.3.0`.

## Development

```sh
pnpm install
pnpm typecheck && pnpm test && pnpm build
```
