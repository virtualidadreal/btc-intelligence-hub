import { Database } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

export default function EmptyState({ message, command }: { message?: string; command?: string }) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Database className="w-12 h-12 text-text-muted mb-4" />
      <p className="text-text-secondary mb-2">{message || t('common.noData')}</p>
      {command && (
        <code className="text-xs font-mono bg-bg-tertiary px-3 py-1.5 rounded text-accent-btc">
          {command}
        </code>
      )}
    </div>
  )
}
