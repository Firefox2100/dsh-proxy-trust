import { Component, type ErrorInfo, type ReactNode } from 'react'
import type { SettingsLocaleKey } from './locales.ts'
import { ProxyTrustSection, type ProxyTrustSectionProps } from './Section.tsx'
import css from './Section.module.css'

interface SectionBoundaryProps {
  t: (key: SettingsLocaleKey) => string
  children: ReactNode
}

interface SectionBoundaryState {
  failed: boolean
}

/**
 * Contains a failure inside the settings section.
 *
 * The section renders host UI: if the DSH client kit throws — a shape it no longer
 * understands, a missing translation, a hook that changed — React unmounts the whole
 * subtree it sits in and the user is left with a blank settings area. Catching it here
 * keeps the damage to this section and tells the user what to do.
 */
export class SectionBoundary extends Component<SectionBoundaryProps, SectionBoundaryState> {
  override state: SectionBoundaryState = { failed: false }

  static getDerivedStateFromError(): SectionBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('dsh-proxy-trust: the reverse proxy settings section failed to render', error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className={css.section}>
          <p className={css.warning} role="alert" data-testid="proxy-trust-crashed">
            {this.props.t('crashed')}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

/** The component registered on `settings.section`: the section, guarded. */
export function ProxyTrustSectionSlot(props: ProxyTrustSectionProps) {
  return (
    <SectionBoundary t={props.t}>
      <ProxyTrustSection {...props} />
    </SectionBoundary>
  )
}
