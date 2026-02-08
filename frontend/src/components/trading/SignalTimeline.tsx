import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus, Check, X, Clock, History } from 'lucide-react'
import { useSignalHistory } from '../../hooks/useSignalHistory'
import type { SignalHistory } from '../../lib/types'
import { formatPrice, cn } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'

type OutcomeFilter = 'all' | 'won' | 'lost' | 'pending'
type TfFilter = 'all' | '1H' | '4H' | '1D' | '1W'

function isWon(outcome: string | null): boolean {
  return outcome === 'correct' || outcome === 'tp1_hit' || outcome === 'tp2_hit'
}

function isLost(outcome: string | null): boolean {
  return outcome === 'incorrect' || outcome === 'sl_hit'
}

function isPending(outcome: string | null): boolean {
  return !outcome || outcome === 'pending'
}

function OutcomeIcon({ outcome }: { outcome: string | null }) {
  if (isWon(outcome)) return <Check className="w-3.5 h-3.5 text-bullish" />
  if (isLost(outcome)) return <X className="w-3.5 h-3.5 text-bearish" />
  return <Clock className="w-3.5 h-3.5 text-text-muted" />
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome || outcome === 'pending') return 'Pending'
  if (outcome === 'tp1_hit') return 'TP1 Hit'
  if (outcome === 'tp2_hit') return 'TP2 Hit'
  if (outcome === 'sl_hit') return 'SL Hit'
  if (outcome === 'correct') return 'Won'
  if (outcome === 'incorrect') return 'Lost'
  return outcome
}

function DirectionBadge({ direction }: { direction: string }) {
  const Icon = direction === 'LONG' ? ArrowUp : direction === 'SHORT' ? ArrowDown : Minus
  const color = direction === 'LONG' ? 'text-bullish bg-bullish/10 border-bullish/20'
    : direction === 'SHORT' ? 'text-bearish bg-bearish/10 border-bearish/20'
    : 'text-neutral-signal bg-neutral-signal/10 border-neutral-signal/20'

  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border', color)}>
      <Icon className="w-3 h-3" />
      {direction}
    </span>
  )
}

function formatTimestamp(date: string): string {
  try {
    const d = new Date(date)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return date.slice(0, 16)
  }
}

function SignalRow({ signal }: { signal: SignalHistory }) {
  const outcome = signal.outcome ?? signal.outcome_1h
  const extScore = signal.extended_score ?? signal.confidence

  return (
    <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-bg-tertiary/30 transition-colors">
      {/* Direction */}
      <DirectionBadge direction={signal.direction} />

      {/* Timeframe */}
      <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary/60 px-1.5 py-0.5 rounded w-8 text-center flex-shrink-0">
        {signal.timeframe}
      </span>

      {/* Price + Score */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold truncate">{formatPrice(signal.price_at_signal)}</span>
          <span className="text-[10px] text-text-muted">{extScore}%</span>
          {signal.setup_type && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-accent-btc/10 text-accent-btc border border-accent-btc/20 truncate max-w-[80px]">
              {signal.setup_type}
            </span>
          )}
        </div>
      </div>

      {/* Outcome */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <OutcomeIcon outcome={outcome} />
        <span className={cn(
          'text-[10px] font-mono',
          isWon(outcome) ? 'text-bullish' : isLost(outcome) ? 'text-bearish' : 'text-text-muted'
        )}>
          {outcomeLabel(outcome)}
        </span>
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-text-muted font-mono flex-shrink-0 hidden sm:block w-[90px] text-right">
        {formatTimestamp(signal.date)}
      </span>
    </div>
  )
}

export default function SignalTimeline() {
  const { t } = useI18n()
  const { data: signals, loading } = useSignalHistory(200)
  const [tfFilter, setTfFilter] = useState<TfFilter>('all')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')

  const filtered = useMemo(() => {
    if (!signals) return []
    return signals.filter((s) => {
      if (tfFilter !== 'all' && s.timeframe !== tfFilter) return false
      const outcome = s.outcome ?? s.outcome_1h
      if (outcomeFilter === 'won' && !isWon(outcome)) return false
      if (outcomeFilter === 'lost' && !isLost(outcome)) return false
      if (outcomeFilter === 'pending' && !isPending(outcome)) return false
      return true
    })
  }, [signals, tfFilter, outcomeFilter])

  if (loading) {
    return (
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm animate-pulse">
        <div className="h-4 bg-bg-tertiary rounded w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-bg-tertiary/50 rounded" />
          ))}
        </div>
      </div>
    )
  }

  const tfOptions: TfFilter[] = ['all', '1H', '4H', '1D', '1W']
  const outcomeOptions: { value: OutcomeFilter; label: string }[] = [
    { value: 'all', label: t('trading.filter_all') },
    { value: 'won', label: t('trading.filter_won') },
    { value: 'lost', label: t('trading.filter_lost') },
    { value: 'pending', label: t('trading.filter_pending') },
  ]

  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border backdrop-blur-sm overflow-hidden">
      {/* Header + Filters */}
      <div className="p-4 border-b border-border/50">
        <h3 className="text-xs font-display font-semibold text-text-secondary mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-accent-btc" />
          {t('trading.signalTimeline')}
        </h3>

        <div className="flex flex-wrap gap-2">
          {/* Timeframe filter */}
          <div className="flex gap-1">
            {tfOptions.map((tf) => (
              <button
                key={tf}
                onClick={() => setTfFilter(tf)}
                className={cn(
                  'text-[10px] font-mono px-2 py-1 rounded transition-colors',
                  tfFilter === tf
                    ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30'
                    : 'bg-bg-tertiary/50 text-text-muted border border-border hover:bg-bg-tertiary'
                )}
              >
                {tf === 'all' ? t('trading.allTimeframes') : tf}
              </button>
            ))}
          </div>

          {/* Outcome filter */}
          <div className="flex gap-1 ml-auto">
            {outcomeOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setOutcomeFilter(value)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded transition-colors',
                  outcomeFilter === value
                    ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30'
                    : 'bg-bg-tertiary/50 text-text-muted border border-border hover:bg-bg-tertiary'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Signal list */}
      <div className="max-h-[400px] overflow-y-auto divide-y divide-border/30">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-text-muted text-xs">{t('trading.noHistory')}</div>
        ) : (
          filtered.map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))
        )}
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50 text-[10px] text-text-muted">
          {filtered.length} {t('trading.totalSignals').toLowerCase()}
        </div>
      )}
    </div>
  )
}
