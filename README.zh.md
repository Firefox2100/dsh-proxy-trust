# dsh-proxy-trust

[English](README.md)

`dsh-proxy-trust` 用于把 DeepSeek Harness（DSH）Web UI 放到反向代理后面。它适合由 Cloudflare Access 等前置代理负责访问控制，而 DSH 继续监听私有地址或回环地址的部署方式。

插件不会替换 DSH 的连接服务。它只在运行时调整几项检查，而且每项都能单独控制。所有选项默认关闭。

安装后可在 `设置 > 反向代理` 中配置，也可以直接修改对应 Profile 下的 `cordis.patch.yml`。

## 环境要求

- DSH `>=0.2.2-rc.1 <0.3.0`
- Node.js 22 或更高版本

## 安装

```sh
dsh plugin --profile web add dsh-proxy-trust
```

之后照常启动 Web Profile 即可。通过 `--trusted-host` 传入的主机名仍然有效，并会与插件中配置的主机名合并。

## 配置项

大多数修改保存后立即生效。`ownsHost` 要到下次加载页面时才会生效；修改额外监听地址或端口时，插件会关闭并重新打开对应端口。

| 配置项 | 作用 |
|---|---|
| `hosts` | 添加浏览器访问 DSH 时使用的主机名，例如 `app.example` 或 `app.example:8443`。这些值会与 `--trusted-host` 合并。 |
| `hostsAny` | 接受任意 `Host`。开启后忽略主机列表，但 DSH 的 Origin 和跨站检查仍然有效。 |
| `skipAuth` | 不再要求 DSH 启动令牌和会话 Cookie。此时前置代理是唯一的登录验证层。 |
| `crossSiteNavigation` | 允许跨站顶层 `GET` 导航访问 `/`、`/index.html` 或 `/connect`。Fetch 请求、上传、其他路径和 WebSocket 升级都不会被放行。 |
| `crossSiteReferrers` | 把跨站导航限制到指定来源，例如 `https://team.cloudflareaccess.com`。留空表示不限制 Referer。 |
| `ownsHost` | 在页面中设置 `__DSH_TRANSPORT__.ownsHost`。即使通过代理或网络地址访问，DSH 也会显示仅供本机使用的功能，例如“打开配置文件”。 |
| `listenEnabled` | 打开第二个 TCP 监听端口，并把连接转发到 DSH 自己的监听端口。这样可以在不修改 DSH 监听地址的情况下对外提供网络访问。 |
| `listenAddress` | 额外监听使用的地址。留空或填写 `0.0.0.0` 表示所有 IPv4 网卡；IPv6 使用 `::`。 |
| `listenPort` | 额外监听使用的端口，默认是 `3081`，不能与 DSH 自己的端口相同。 |
| `listenAllow` | 允许连接额外监听端口的客户端 IP 或 CIDR 网段。留空表示允许所有能访问该端口的客户端。列表非空但没有有效条目时，所有客户端都会被拒绝。 |

也可以在 Profile Patch 中写入相同配置：

```yaml
# $DSH_HOME/profiles/<name>/cordis.patch.yml
- id: proxy-trust
  name: dsh-proxy-trust
  config:
    hosts:
      - app.example
    skipAuth: true
```

不要修改这里的行 ID。`proxy-trust` 同时也是插件设置界面使用的命名空间。

## 使用额外监听

DSH 0.2.2 不接受 `0.0.0.0` 这样的通配监听地址。插件提供的额外监听本质上是运行在 DSH 进程内的 TCP 转发器。它不会解析流量，而是直接转发 HTTP、WebSocket 和 TLS 连接，因此 Host、Origin、令牌和 Cookie 检查仍由 DSH 完成。

使用时需要注意：

- 经过转发后，DSH 看到的连接来源是它自己的监听端，通常为 `127.0.0.1`。插件仍会使用真实客户端地址检查 `listenAllow`，并在拒绝日志中记录该地址。
- 如果额外监听对回环地址以外的网络开放，远程客户端可以发送 `Host: localhost`。因此 Host 检查本身不能作为访问边界，请配合 `listenAllow`、防火墙或带身份验证的代理使用。
- 额外监听最多同时接受 512 个连接。
- 地址无效、端口被占用或没有监听权限时，插件只会记录警告，不会导致 DSH 停止运行。
- 防火墙规则和容器端口映射需要自行配置。

下面的例子只允许 Tailscale 网段和一个局域网网段访问：

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

## 安全说明

`skipAuth` 会移除 DSH 的浏览器登录检查。任何能通过受信主机访问实例的人都会被视为已经登录。如果插件发现登录已跳过，而且实例可以从 localhost 以外访问，设置页面和 DSH 日志都会给出警告。

如果实例可以被远程访问，只有在所有访问路径都经过身份验证代理时，才应开启 `skipAuth`。额外监听也要限制来源，避免客户端绕过代理直接连接。仅监听回环地址的实例可以使用该选项，而不会因此对外开放。如果你的部署仍需要 DSH 的令牌登录，请保持 `skipAuth` 关闭，其他功能可以单独使用。

`crossSiteNavigation` 的放行范围很小。它只会忽略三个指定路径上文档导航请求的跨站标记，最终是否信任请求仍由原有的 Host 和 Origin 检查决定。

## 兼容性

插件会包装 DSH 连接服务的几个私有成员，包括受信主机列表、浏览器认证对象和请求信任方法。这些成员不属于 DSH 的公开插件 API。

每个 Hook 在安装前都会检查运行时结构。如果 DSH 更新改变了所需成员，对应功能会保持关闭，插件只记录警告，不会阻止 DSH 启动。卸载插件时，原有对象和方法会恢复。

当前支持 DSH `>=0.2.2-rc.1 <0.3.0`。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Socket 测试会打开本机回环监听端口，因此运行环境必须允许本地网络绑定。
