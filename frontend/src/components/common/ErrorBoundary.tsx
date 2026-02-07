import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl bg-bg-secondary/60 border border-border p-8 text-center">
        <div className="text-4xl mb-4">&#x26A0;</div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          {t('common.error')}
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          {t('common.errorMsg')}
        </p>
        {error && (
          <pre className="text-xs text-text-muted bg-bg-primary/50 rounded-lg p-3 mb-4 overflow-auto text-left max-h-32">
            {error.message}
          </pre>
        )}
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-accent-btc text-bg-primary font-medium text-sm hover:bg-accent-btc/80 transition-colors cursor-pointer"
        >
          {t('common.tryAgain')}
        </button>
      </div>
    </div>
  )
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }

    return this.props.children
  }
}
