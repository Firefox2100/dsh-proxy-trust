/**
 * The single module that reaches into DSH's client UI kit.
 *
 * `practices.md` discourages plugins from using Client packages as modules: they are
 * host UI, they change between DSH releases, and a throwing component takes its whole
 * slot down. This package needs the shared settings form so the panel looks and behaves
 * like the rest of DSH, so the dependency is kept, but it is confined to this file —
 * replacing the kit, or removing it in favour of hand-written controls, starts here.
 *
 * Only names re-exported below may be used elsewhere in the plugin.
 */
export {
  SettingsForm,
  SettingsFormModel,
  SettingsValueField,
  Switch,
} from '@deepseek-ai/dsh-client-ui-primitives'
export type {
  SettingsFieldSpec,
  SettingsFieldState,
  SettingsFormActions,
  SettingsFormLabels,
  SettingsFormScope,
  SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
