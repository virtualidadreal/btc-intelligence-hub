import { useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus, Target, Bitcoin, BarChart3, TrendingUp, Zap, Activity, Clock, MapPin } from 'lucide-react'
import { SignalBadge } from '../components/common/MetricCard'
import SignalTimeline from '../components/trading/SignalTimeline'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import { usePriceChanges } from '../hooks/usePrices'
import { useLatestSignals } from '../hooks/useTechnical'
import { useSignalAccuracy, useSignalHistory } from '../hooks/useSignalHistory'
import type { SignalHistory } from '../lib/types'
import { formatPrice, formatPercent, formatTimestamp, cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'

function directionColor(dir: string) {
  if (dir === 'LONG') return 'text-bullish'
  if (dir === 'SHORT') return 'text-bearish'
  return 'text-neutral-signal'
}

function directionBg(dir: string) {
  if (dir === 'LONG') return 'bg-bullish/10 border-bullish/20'
  if (dir === 'SHORT') return 'bg-bearish/10 border-bearish/20'
  return 'bg-neutral-signal/10 border-neutral-signal/20'
}

function classificationColor(cls: string) {
  switch (cls) {
    case 'PREMIUM': return 'text-yellow-400'
    case 'STRONG': return 'text-green-400'
    case 'VALID': return 'text-blue-400'
    case 'WEAK': return 'text-orange-400'
    case 'NO ENTRY': return 'text-red-400'
    default: return 'text-text-muted'
  }
}

function classifyScore(score: number): string {
  if (score >= 85) return 'PREMIUM'
  if (score >= 70) return 'STRONG'
  if (score >= 55) return 'VALID'
  if (score >= 40) return 'WEAK'
  return 'NO ENTRY'
}

function classificationBg(cls: string) {
  switch (cls) {
    case 'PREMIUM': return 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
    case 'STRONG': return 'bg-green-400/15 border-green-400/30 text-green-400'
    case 'VALID': return 'bg-blue-400/15 border-blue-400/30 text-blue-400'
    case 'WEAK': return 'bg-orange-400/15 border-orange-400/30 text-orange-400'
    case 'NO ENTRY': return 'bg-red-400/15 border-red-400/30 text-red-400'
    default: return 'bg-bg-tertiary border-border text-text-muted'
  }
}

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  if (direction === 'LONG') return <ArrowUp className={className || 'w-5 h-5'} />
  if (direction === 'SHORT') return <ArrowDown className={className || 'w-5 h-5'} />
  return <Minus className={className || 'w-5 h-5'} />
}

function LevelRow({ label, price, pct, color, bg, method }: { label: string; price: number; pct: string; color: string; bg: string; method?: string | null }) {
  return (
    <div className={cn('flex items-center justify-between rounded-lg px-3 py-2', bg)}>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-mono font-bold w-12', color)}>{label}</span>
        <span className="font-mono text-sm font-bold">{formatPrice(price)}</span>
      </div>
      <div className="flex items-center gap-2">
        {pct && <span className={cn('text-xs font-mono', color)}>{pct}</span>}
        {method && <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{method}</span>}
      </div>
    </div>
  )
}

function SignalDetailCard({ sig, currentPrice, t }: { sig: SignalHistory; currentPrice: number; t: (k: string) => string }) {
  const extScore = sig.extended_score ?? sig.confidence
  const cls = sig.classification || classifyScore(extScore)
  const tfLabels: Record<string, string> = { '1H': t('trading.1H'), '4H': t('trading.4H'), '1D': t('trading.1D'), '1W': t('trading.1W') }

  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className={cn('flex items-center justify-between p-4 border-b border-border', directionBg(sig.direction))}>
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 font-bold text-xl', directionColor(sig.direction))}>
            <DirectionIcon direction={sig.direction} className="w-6 h-6" />
            <span>{sig.direction}</span>
          </div>
          <span className="text-xs font-mono text-text-muted bg-bg-tertiary/60 px-2 py-0.5 rounded">{sig.timeframe}</span>
          <span className="text-xs text-text-secondary hidden sm:block">{tfLabels[sig.timeframe]}</span>
        </div>
        <div className="text-right">
          <span className={cn('font-mono text-lg font-bold', directionColor(sig.direction))}>{extScore}%</span>
          <div className="flex items-center gap-1.5 justify-end mt-0.5">
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', classificationBg(cls))}>
              {cls}
            </span>
          </div>
        </div>
      </div>

      {/* Timestamp + Entry */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2 text-xs text-text-muted font-mono">
        <Clock className="w-3.5 h-3.5" />
        {sig.date && formatTimestamp(sig.date)}
        <span className="ml-auto">Entry: {formatPrice(sig.price_at_signal)}</span>
        <span className={cn(currentPrice >= sig.price_at_signal ? 'text-bullish' : 'text-bearish')}>
          ({((currentPrice - sig.price_at_signal) / sig.price_at_signal * 100) >= 0 ? '+' : ''}{((currentPrice - sig.price_at_signal) / sig.price_at_signal * 100).toFixed(1)}%)
        </span>
      </div>

      {/* Score Breakdown */}
      <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-accent-btc/5 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-accent-btc" />
          <span className="text-[10px] font-display font-semibold text-text-secondary uppercase tracking-wider">{t('trading.extendedScore')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono flex-wrap">
          <span className="text-text-muted">{t('trading.baseScore')}: {sig.confidence}</span>
          {(sig.level_score ?? 0) > 0 && <span className="text-green-400">+{sig.level_score} {t('trading.bonusLevels')}</span>}
          {(sig.candle_score ?? 0) > 0 && <span className="text-blue-400">+{sig.candle_score} {t('trading.bonusCandles')}</span>}
          {(sig.onchain_bonus ?? 0) > 0 && <span className="text-purple-400">+{sig.onchain_bonus} {t('trading.bonusOnchain')}</span>}
          {(sig.penalties ?? 0) < 0 && <span className="text-red-400">{sig.penalties} {t('trading.penaltiesLabel')}</span>}
          <span className="text-text-muted">=</span>
          <span className={cn('font-bold', classificationColor(cls))}>{extScore}%</span>
        </div>

        {/* Setup type and candle pattern badges */}
        <div className="flex gap-2 flex-wrap mt-2">
          {sig.setup_type && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent-btc/15 text-accent-btc border border-accent-btc/30 font-semibold flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5" />
              {sig.setup_type}
            </span>
          )}
          {sig.candle_pattern && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/15 text-purple-400 border border-purple-400/30 font-semibold flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" />
              {sig.candle_pattern.replace(/_/g, ' ')}
              {sig.candle_score != null && sig.candle_score > 0 && <span className="text-purple-300 ml-0.5">(+{sig.candle_score})</span>}
            </span>
          )}
        </div>
      </div>

      {/* TP/SL Levels */}
      {sig.tp1 && sig.sl && (
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-accent-btc" />
            <span className="text-xs font-display font-semibold text-text-secondary">{t('trading.operationLevels')}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {sig.direction === 'LONG' ? (
              <>
                {sig.tp2 && <LevelRow label="TP2" price={sig.tp2} pct={`+${(Math.abs(sig.tp2 - sig.price_at_signal) / sig.price_at_signal * 100).toFixed(1)}%`} color="text-bullish" bg="bg-bullish/10" method={sig.tp2_method} />}
                <LevelRow label="TP1" price={sig.tp1} pct={`+${(Math.abs(sig.tp1 - sig.price_at_signal) / sig.price_at_signal * 100).toFixed(1)}%`} color="text-bullish" bg="bg-bullish/5" method={sig.tp1_method} />
                <LevelRow label="ENTRY" price={sig.price_at_signal} pct="" color="text-accent-btc" bg="bg-accent-btc/10" />
                <LevelRow label="SL" price={sig.sl} pct={`-${(Math.abs(sig.sl - sig.price_at_signal) / sig.price_at_signal * 100).toFixed(1)}%`} color="text-bearish" bg="bg-bearish/10" method={sig.sl_method} />
              </>
            ) : (
              <>
                <LevelRow label="SL" price={sig.sl} pct={`-${(Math.abs(sig.sl - sig.price_at_signal) / sig.price_at_signal * 100).toFixed(1)}%`} color="text-bearish" bg="bg-bearish/10" method={sig.sl_method} />
                <LevelRow label="ENTRY" price={sig.price_at_signal} pct="" color="text-accent-btc" bg="bg-accent-btc/10" />
                <LevelRow label="TP1" price={sig.tp1} pct={`+${(Math.abs(sig.tp1 - sig.price_at_signal) / sig.price_at_signal * 100).toFixed(1)}%`} color="text-bullish" bg="bg-bullish/5" method={sig.tp1_method} />
                {sig.tp2 && <LevelRow label="TP2" price={sig.tp2} pct={`+${(Math.abs(sig.tp2 - sig.price_at_signal) / sig.price_at_signal * 100).toFixed(1)}%`} color="text-bullish" bg="bg-bullish/10" method={sig.tp2_method} />}
              </>
            )}
          </div>
        </div>
      )}

      {/* Nearby Levels */}
      {sig.nearby_levels && sig.nearby_levels.length > 0 && (
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] font-display font-semibold text-text-secondary uppercase tracking-wider">Nearby Levels</span>
          </div>
          <div className="space-y-1">
            {(sig.nearby_levels as Array<{ price: number; strength: number; type?: string }>).slice(0, 5).map((lv, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-mono">
                <span className="text-text-secondary">{formatPrice(lv.price)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">str {lv.strength}</span>
                  {lv.type && <span className="text-[9px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{lv.type}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outcome */}
      {sig.outcome && (
        <div className={cn('px-4 py-3', sig.outcome.includes('tp') ? 'bg-bullish/10' : 'bg-bearish/10')}>
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-bold', sig.outcome.includes('tp') ? 'text-bullish' : 'text-bearish')}>
              {sig.outcome.toUpperCase().replace('_', ' ')}
            </span>
            {sig.hit_at && <span className="text-[10px] font-mono text-text-muted">{formatTimestamp(sig.hit_at)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Trading() {
  const { t, ta } = useI18n()
  const { data: prices, loading: priceLoading } = usePriceChanges()
  const { data: signals } = useLatestSignals()
  const { stats: signalStats } = useSignalAccuracy()

  // Signal history — single source of truth for all signal data
  const { data: signalHistoryRaw } = useSignalHistory(50)
  const latestV2Signals = useMemo(() => {
    if (!signalHistoryRaw) return null
    const byTf = new Map<string, typeof signalHistoryRaw[0]>()
    for (const s of signalHistoryRaw) {
      if (!byTf.has(s.timeframe)) byTf.set(s.timeframe, s)
    }
    return Array.from(byTf.values())
  }, [signalHistoryRaw])

  const currentPrice = useMemo(() => {
    if (!prices || prices.length === 0) return null
    return prices[0].close
  }, [prices])

  if (priceLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('trading.title')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!currentPrice) return <div className="p-6"><EmptyState command="btc-intel update-data" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('trading.title')} subtitle={t('trading.subtitle')}>
        <HelpButton
          title={t('trading.title')}
          content={ta('trading')}
        />
      </PageHeader>

      {/* Current price reference */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm flex items-center gap-3">
        <Bitcoin className="w-5 h-5 text-accent-btc" />
        <span className="text-sm text-text-secondary">{t('trading.currentPrice')}</span>
        <span className="font-mono text-lg font-bold">{formatPrice(currentPrice)}</span>
        {prices && prices.length > 1 && (
          <span className={cn('text-sm font-mono', prices[0].close >= prices[1].close ? 'text-bullish' : 'text-bearish')}>
            {formatPercent(((prices[0].close - prices[1].close) / prices[1].close) * 100)}
          </span>
        )}
      </div>

      {/* Classification legend */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-3 backdrop-blur-sm">
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono justify-center">
          <span className="text-text-muted mr-1">{t('trading.signalQuality')}:</span>
          <span className="text-yellow-400 font-bold">PREMIUM <span className="text-text-muted font-normal">&ge;85%</span></span>
          <span className="text-green-400 font-bold">STRONG <span className="text-text-muted font-normal">&ge;70%</span></span>
          <span className="text-blue-400 font-bold">VALID <span className="text-text-muted font-normal">&ge;55%</span></span>
          <span className="text-orange-400 font-bold">WEAK <span className="text-text-muted font-normal">&ge;40%</span></span>
          <span className="text-red-400 font-bold">NO ENTRY <span className="text-text-muted font-normal">&lt;40%</span></span>
        </div>
      </div>

      {/* Summary cards — driven by signal_history (single source of truth) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['1H', '4H', '1D', '1W'] as const).map((tf) => {
          const sig = latestV2Signals?.find(s => s.timeframe === tf)
          const tfLabels: Record<string, string> = { '1H': t('trading.1H'), '4H': t('trading.4H'), '1D': t('trading.1D'), '1W': t('trading.1W') }

          if (!sig) {
            return (
              <div key={tf} className="rounded-xl border border-border/50 p-4 backdrop-blur-sm bg-bg-secondary/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono text-text-muted">{tf}</span>
                  <span className="text-[10px] text-text-muted">{tfLabels[tf]}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-text-muted text-lg font-bold py-3">
                  <Minus className="w-5 h-5" />
                  <span>{t('trading.noSignal') || 'NO SIGNAL'}</span>
                </div>
                <div className="text-center text-[10px] text-text-muted">{t('trading.waitingSignal') || 'Waiting for valid signal'}</div>
              </div>
            )
          }

          const direction = sig.direction
          const extScore = sig.extended_score ?? sig.confidence
          const cls = sig.classification || classifyScore(extScore)
          const priceAt = sig.price_at_signal

          return (
            <div key={tf} className={cn('rounded-xl border p-4 backdrop-blur-sm', directionBg(direction))}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-mono text-text-muted">{tf}</span>
                <span className="text-[10px] text-text-muted">{tfLabels[tf]}</span>
              </div>
              {sig.date && (
                <div className="text-[10px] text-text-muted font-mono text-center mb-1">{formatTimestamp(sig.date)}</div>
              )}
              <div className={cn('flex items-center justify-center gap-1.5 font-bold text-2xl mb-1', directionColor(direction))}>
                <DirectionIcon direction={direction} className="w-7 h-7" />
                <span>{direction}</span>
              </div>
              <div className="text-center">
                <span className={cn('text-lg font-mono font-bold', directionColor(direction))}>{extScore}%</span>
                <div className={cn('text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded border inline-block', classificationBg(cls))}>
                  {cls}
                </div>
              </div>
              {sig.tp1 && sig.tp2 && sig.sl && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-bullish">TP2</span>
                    <span>{formatPrice(sig.tp2)}</span>
                    <span className="text-bullish">+{(Math.abs(sig.tp2 - priceAt) / priceAt * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bullish">TP1</span>
                    <span>{formatPrice(sig.tp1)}</span>
                    <span className="text-bullish">+{(Math.abs(sig.tp1 - priceAt) / priceAt * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bearish">SL</span>
                    <span>{formatPrice(sig.sl)}</span>
                    <span className="text-bearish">-{(Math.abs(sig.sl - priceAt) / priceAt * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
              {priceAt && currentPrice && (
                <div className="text-center mt-2 text-[10px] font-mono text-text-muted">
                  Entry: {formatPrice(priceAt)}
                  {' '}
                  <span className={cn(currentPrice >= priceAt ? 'text-bullish' : 'text-bearish')}>
                    ({((currentPrice - priceAt) / priceAt * 100) >= 0 ? '+' : ''}{((currentPrice - priceAt) / priceAt * 100).toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Active signals chips */}
      {signals && signals.length > 0 && (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
          <h3 className="text-xs font-display font-semibold text-text-secondary mb-2">{t('trading.activeSignals')}</h3>
          <div className="flex flex-wrap gap-2">
            {signals.map((s) => (
              <div key={s.indicator} className="flex items-center gap-2 bg-bg-tertiary/50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-mono text-text-secondary">{s.indicator}</span>
                <span className="text-xs font-mono text-text-muted">{s.value != null ? s.value.toFixed(1) : ''}</span>
                {s.signal && <SignalBadge signal={s.signal} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed breakdown per timeframe — from signal_history */}
      {latestV2Signals && latestV2Signals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {latestV2Signals.map((sig) => (
            <SignalDetailCard key={sig.id} sig={sig} currentPrice={currentPrice} t={t} />
          ))}
        </div>
      )}

      {/* Signal Accuracy */}
      {signalStats && signalStats.overall.total > 0 && (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
          <h3 className="text-xs font-display font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-btc" />
            {t('trading.signalAccuracy')} — {t('trading.last30d')}
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-accent-btc">{signalStats.winRate}%</div>
              <div className="text-[10px] text-text-muted">{t('trading.winRate')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-mono font-bold">{signalStats.overall.total}</div>
              <div className="text-[10px] text-text-muted">{t('trading.totalSignals')}</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-mono">
                <span className="text-bullish">{signalStats.overall.correct}</span>
                <span className="text-text-muted mx-1">/</span>
                <span className="text-bearish">{signalStats.overall.incorrect}</span>
              </div>
              <div className="text-[10px] text-text-muted">{t('trading.correct')} / {t('trading.incorrect')}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-text-muted uppercase border-b border-border/50">
                  <th className="text-left py-1 px-2">{t('trading.timeframe')}</th>
                  <th className="text-right py-1 px-2">{t('trading.winRateLabel')}</th>
                  <th className="text-right py-1 px-2">{t('trading.correct')}</th>
                  <th className="text-right py-1 px-2">{t('trading.incorrect')}</th>
                  <th className="text-right py-1 px-2">{t('trading.total')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(signalStats.byTimeframe).map(([tf, data]) => (
                  <tr key={tf} className="border-b border-border/30">
                    <td className="py-1 px-2 font-mono text-xs">{tf}</td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-accent-btc">
                      {data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0}%
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-bullish">{data.correct}</td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-bearish">{data.incorrect}</td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-text-muted">{data.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Signal History Timeline */}
      <SignalTimeline />

      {/* Disclaimer */}
      <p className="text-[10px] text-text-muted italic text-center">
        {t('trading.disclaimer')}
      </p>
    </div>
  )
}
