import { Database } from 'lucide-react'

export default function EmptyState({ message, command }: { message?: string; command?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Database className="w-12 h-12 text-text-muted mb-4" />
      <p className="text-text-secondary mb-2">{message || 'Sin datos disponibles'}</p>
      {command && (
        <code className="text-xs font-mono bg-bg-tertiary px-3 py-1.5 rounded text-accent-btc">
          {command}
        </code>
      )}
    </div>
  )
}
