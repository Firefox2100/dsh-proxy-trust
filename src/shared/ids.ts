/** Row id in the profile patch; also the settings namespace the Settings section edits. */
export const ENTRY_ID = 'proxy-trust'

/** Page global the host fills at index render time for the browser half. */
export const EXPOSURE_GLOBAL = '__DSH_PROXY_TRUST__'

/** Facts only the host process knows, handed to the page when it loads. */
export interface ProxyTrustExposure {
  /** Authorities given on the command line (`--trusted-host`), accepted in addition to the configured ones. */
  readonly cliHosts: readonly string[]
}
