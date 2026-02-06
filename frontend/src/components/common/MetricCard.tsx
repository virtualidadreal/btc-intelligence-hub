import { cn } from '../../lib/utils'

interface MetricCardProps {
  title: string
  value: string
  change?: string
  signal?: string | null
  icon?: React.ReactNode
  subtitle?: string
}

export default function MetricCard({ title, value, change, signal, icon, subtitle }: MetricCardProps) {
  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm hover:border-accent-btc/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-secondary">{title}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="font-mono text-xl font-bold text-text-primary">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        {change && (
          <span className={cn('text-sm font-mono', change.startsWith('+') ? 'text-bullish' : change.startsWith('-') ? 'text-bearish' : 'text-text-secondary')}>
            {change}
          </span>
        )}
        {signal && <SignalBadge signal={signal} />}
      </div>
      {subtitle && <span className="text-xs text-text-muted mt-1 block">{subtitle}</span>}
    </div>
  )
}

export function SignalBadge({ signal }: { signal: string }) {
  const color = signal.includes('bullish')
    ? 'bg-bullish/20 text-bullish border-bullish/30'
    : signal.includes('bearish')
      ? 'bg-bearish/20 text-bearish border-bearish/30'
      : 'bg-neutral-signal/20 text-neutral-signal border-neutral-signal/30'

  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase', color)}>
      {signal.replace('_', ' ')}
    </span>
  )
}
