import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus, Check, X, Clock, History, ChevronDown } from 'lucide-react'
import { useSignalHistory } from '../../hooks/useSignalHistory'
import type { SignalHistory } from '../../lib/types'
import { formatPrice, formatTimestamp, cn } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'

type OutcomeFilter = 'all' | 'won' | 'lost' | 'pending'
type TfFilter = 'all' | '1H' | '4H' | '1D' | '1W'

function isWon(outcome: string | null): boolean {
  return outcome === 'tp1_hit' || outcome === 'tp2_hit'
}

function isLost(outcome: string | null): boolean {
  return outcome === 'sl_hit'
}

function isLegacy(outcome: string | null): boolean {
  return outcome === 'correct' || outcome === 'incorrect'
}

function isPending(outcome: string | null): boolean {
  return !outcome || outcome === 'pending'
}

function OutcomeIcon({ outcome }: { outcome: string | null }) {
  if (isWon(outcome)) return <Check className="w-3.5 h-3.5 text-bullish" />
  if (isLost(outcome)) return <X className="w-3.5 h-3.5 text-bearish" />
  if (isLegacy(outcome)) return <Minus className="w-3.5 h-3.5 text-text-muted" />
  return <Clock className="w-3.5 h-3.5 text-text-muted" />
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome || outcome === 'pending') return 'Pending'
  if (outcome === 'tp1_hit') return 'TP1 Hit'
  if (outcome === 'tp2_hit') return 'TP2 Hit'
  if (outcome === 'sl_hit') return 'SL Hit'
  if (outcome === 'correct' || outcome === 'incorrect') return 'Sin TP/SL'
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

function DetailRow({ label, value, color }: { label: string; value: string | number | null | undefined; color?: string }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-text-muted">{label}</span>
      <span className={cn('font-mono', color)}>{value}</span>
    </div>
  )
}

function classificationColor(cls: string | null): string {
  if (cls === 'PREMIUM') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
  if (cls === 'STRONG') return 'text-green-400 bg-green-400/10 border-green-400/30'
  if (cls === 'VALID') return 'text-blue-400 bg-blue-400/10 border-blue-400/30'
  return 'text-text-muted bg-bg-tertiary/40 border-border/40'
}

function SignalRow({ signal, expanded, onToggle }: { signal: SignalHistory; expanded: boolean; onToggle: () => void }) {
  const outcome = signal.outcome ?? signal.outcome_1h
  const extScore = signal.extended_score ?? signal.confidence
  const classification = signal.classification || (extScore >= 85 ? 'PREMIUM' : extScore >= 70 ? 'STRONG' : extScore >= 55 ? 'VALID' : 'WEAK')

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        {/* Chevron */}
        <ChevronDown className={cn('w-3 h-3 text-text-muted transition-transform flex-shrink-0', expanded && 'rotate-180')} />

        {/* Direction */}
        <DirectionBadge direction={signal.direction} />

        {/* Timeframe */}
        <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary/60 px-1.5 py-0.5 rounded w-8 text-center flex-shrink-0">
          {signal.timeframe}
        </span>

        {/* Price + Score + Classification */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold truncate">{formatPrice(signal.price_at_signal)}</span>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', classificationColor(classification))}>
              {classification}
            </span>
            <span className="text-[10px] text-text-muted">{extScore}%</span>
            {signal.setup_type && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-accent-btc/10 text-accent-btc border border-accent-btc/20 truncate max-w-[80px] hidden sm:inline">
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

      {/* Expanded detail panel */}
      {expanded && (
        <div className="mx-3 mb-2 p-3 rounded-lg bg-bg-tertiary/20 border-t border-border/30 text-[10px] space-y-3">
          {/* TP / SL levels */}
          {(signal.tp1 || signal.tp2 || signal.sl) && (
            <div>
              <span className="font-semibold text-text-secondary uppercase tracking-wider block mb-1">Niveles TP/SL</span>
              <div className="space-y-0.5">
                {signal.tp2 != null && (
                  <DetailRow
                    label={`TP2${signal.tp2_method ? ` (${signal.tp2_method})` : ''}`}
                    value={formatPrice(signal.tp2)}
                    color="text-bullish"
                  />
                )}
                {signal.tp1 != null && (
                  <DetailRow
                    label={`TP1${signal.tp1_method ? ` (${signal.tp1_method})` : ''}`}
                    value={formatPrice(signal.tp1)}
                    color="text-bullish"
                  />
                )}
                {signal.sl != null && (
                  <DetailRow
                    label={`SL${signal.sl_method ? ` (${signal.sl_method})` : ''}`}
                    value={formatPrice(signal.sl)}
                    color="text-bearish"
                  />
                )}
              </div>
            </div>
          )}

          {/* Setup & Candle pattern */}
          {(signal.setup_type || signal.candle_pattern) && (
            <div>
              <span className="font-semibold text-text-secondary uppercase tracking-wider block mb-1">Setup</span>
              <div className="space-y-0.5">
                <DetailRow label="Setup type" value={signal.setup_type} color="text-accent-btc" />
                <DetailRow
                  label="Candle pattern"
                  value={signal.candle_pattern ? `${signal.candle_pattern.replace(/_/g, ' ')}${signal.candle_score != null ? ` (score: ${signal.candle_score})` : ''}` : null}
                  color="text-purple-400"
                />
              </div>
            </div>
          )}

          {/* Score breakdown */}
          <div>
            <span className="font-semibold text-text-secondary uppercase tracking-wider block mb-1">Score breakdown</span>
            <div className="space-y-0.5">
              <DetailRow label="Base confidence" value={`${signal.confidence}%`} />
              <DetailRow label="Level bonus" value={signal.level_score != null && signal.level_score > 0 ? `+${signal.level_score}` : null} color="text-green-400" />
              <DetailRow label="Onchain bonus" value={signal.onchain_bonus != null && signal.onchain_bonus > 0 ? `+${signal.onchain_bonus}` : null} color="text-purple-400" />
              <DetailRow label="Penalties" value={signal.penalties != null && signal.penalties < 0 ? `${signal.penalties}` : null} color="text-red-400" />
              {signal.extended_score != null && (
                <DetailRow label="Extended score" value={`${signal.extended_score}%`} color="text-accent-btc" />
              )}
            </div>
          </div>

          {/* Outcome */}
          {outcome && outcome !== 'pending' && (
            <div>
              <span className="font-semibold text-text-secondary uppercase tracking-wider block mb-1">Resultado</span>
              <div className="space-y-1">
                <DetailRow
                  label="Resultado"
                  value={outcomeLabel(outcome)}
                  color={isWon(outcome) ? 'text-bullish' : 'text-bearish'}
                />
                {/* Explanation of why won/lost */}
                {outcome === 'tp1_hit' && signal.tp1 != null && (
                  <div className="text-bullish leading-relaxed">
                    TP1 alcanzado en {formatPrice(signal.tp1)}
                    {signal.tp1_method && <span className="text-text-muted"> ({signal.tp1_method})</span>}
                    <span className="ml-1 font-bold">
                      {signal.direction === 'LONG'
                        ? `+${((signal.tp1 - signal.price_at_signal) / signal.price_at_signal * 100).toFixed(2)}%`
                        : `+${((signal.price_at_signal - signal.tp1) / signal.price_at_signal * 100).toFixed(2)}%`
                      }
                    </span>
                  </div>
                )}
                {outcome === 'tp2_hit' && signal.tp2 != null && (
                  <div className="text-bullish leading-relaxed">
                    TP2 alcanzado en {formatPrice(signal.tp2)}
                    {signal.tp2_method && <span className="text-text-muted"> ({signal.tp2_method})</span>}
                    <span className="ml-1 font-bold">
                      {signal.direction === 'LONG'
                        ? `+${((signal.tp2 - signal.price_at_signal) / signal.price_at_signal * 100).toFixed(2)}%`
                        : `+${((signal.price_at_signal - signal.tp2) / signal.price_at_signal * 100).toFixed(2)}%`
                      }
                    </span>
                  </div>
                )}
                {outcome === 'sl_hit' && signal.sl != null && (
                  <div className="text-bearish leading-relaxed">
                    Stop Loss ejecutado en {formatPrice(signal.sl)}
                    {signal.sl_method && <span className="text-text-muted"> ({signal.sl_method})</span>}
                    <span className="ml-1 font-bold">
                      {signal.direction === 'LONG'
                        ? `${((signal.sl - signal.price_at_signal) / signal.price_at_signal * 100).toFixed(2)}%`
                        : `${((signal.price_at_signal - signal.sl) / signal.price_at_signal * 100).toFixed(2)}%`
                      }
                    </span>
                  </div>
                )}
                {(outcome === 'correct' || outcome === 'incorrect') && (
                  <div className="text-text-muted leading-relaxed">
                    Señal sin niveles TP/SL definidos — evaluación por dirección de precio
                    {outcome === 'correct'
                      ? ` (precio se movió a favor de ${signal.direction})`
                      : ` (precio se movió en contra de ${signal.direction})`
                    }
                  </div>
                )}
                {/* Entry price reference */}
                <DetailRow label="Precio de entrada" value={formatPrice(signal.price_at_signal)} />
                {signal.hit_at && (
                  <DetailRow label="Fecha de cierre" value={formatTimestamp(signal.hit_at)} />
                )}
              </div>
            </div>
          )}

          {/* Nearby levels */}
          {signal.nearby_levels && signal.nearby_levels.length > 0 && (
            <div>
              <span className="font-semibold text-text-secondary uppercase tracking-wider block mb-1">Nearby levels</span>
              <div className="flex flex-wrap gap-1">
                {signal.nearby_levels.map((lv, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-bg-tertiary/60 border border-border/50 font-mono">
                    {lv.price != null ? formatPrice(Number(lv.price)) : ''}{lv.type ? ` (${lv.type})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SignalTimeline() {
  const { t } = useI18n()
  const { data: signals, loading } = useSignalHistory(200)
  const [tfFilter, setTfFilter] = useState<TfFilter>('all')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)

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
            <SignalRow
              key={signal.id}
              signal={signal}
              expanded={expandedId === signal.id}
              onToggle={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
            />
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
