import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_LISTEN_ADDRESS, DEFAULT_LISTEN_PORT } from '../shared/net.ts'

/**
 * Every field is live (volatile): the Settings section edits them and they
 * take effect on the next request without reloading the plugin. All bypasses
 * are off by default.
 */
export interface Config {
  /** Accept any `Host`; the host list is then ignored. Origin and cross-site checks still run. */
  hostsAny: Volatile<boolean>
  /** Authorities (`host` or `host:port`) accepted in addition to any given with `--trusted-host`. */
  hosts: Volatile<string[]>
  /** Do not ask for the launch token or session cookie. */
  skipAuth: Volatile<boolean>
  /** Accept a cross-site top-level page load (for example the redirect back from an access proxy). */
  crossSiteNavigation: Volatile<boolean>
  /** When non-empty, a cross-site page load must come from one of these origins. */
  crossSiteReferrers: Volatile<string[]>
  /** Tell the browser this page runs on the machine that owns the instance, unlocking features meant for local use. */
  ownsHost: Volatile<boolean>
  /** Also listen on `listenAddress:listenPort` and forward every connection to DSH's own listener. */
  listenEnabled: Volatile<boolean>
  /** Address the extra listener binds; `0.0.0.0` (every IPv4 interface) when empty. */
  listenAddress: Volatile<string>
  /** Port the extra listener binds; it cannot share the real listener's port. */
  listenPort: Volatile<number>
  /** Peers (addresses or CIDR ranges) allowed to use the extra listener; empty allows everyone. */
  listenAllow: Volatile<string[]>
}

export const Config = z.object({
  hostsAny: z.boolean().default(false).volatile(),
  hosts: z.array(String).default([]).volatile(),
  skipAuth: z.boolean().default(false).volatile(),
  crossSiteNavigation: z.boolean().default(false).volatile(),
  crossSiteReferrers: z.array(String).default([]).volatile(),
  ownsHost: z.boolean().default(false).volatile(),
  listenEnabled: z.boolean().default(false).volatile(),
  listenAddress: z.string().default(DEFAULT_LISTEN_ADDRESS).volatile(),
  listenPort: z.natural().max(65535).default(DEFAULT_LISTEN_PORT).volatile(),
  listenAllow: z.array(String).default([]).volatile(),
})
