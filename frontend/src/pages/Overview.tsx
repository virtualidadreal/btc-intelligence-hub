import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, TrendingUp, Shield, AlertTriangle, Brain, Bitcoin, ArrowUp, ArrowDown, Minus, ArrowRight } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import MetricCard, { SignalBadge } from '../components/common/MetricCard'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import { usePriceChanges } from '../hooks/usePrices'
import { useLatestCycleScore } from '../hooks/useCycleScore'
import { useLatestSignals } from '../hooks/useTechnical'
import { useLatestSentiment } from '../hooks/useSentiment'
import { useSignalHistory } from '../hooks/useSignalHistory'
import { useActiveAlerts } from '../hooks/useAlerts'
import { useConclusions } from '../hooks/useConclusions'
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

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'LONG') return <ArrowUp className="w-5 h-5" />
  if (direction === 'SHORT') return <ArrowDown className="w-5 h-5" />
  return <Minus className="w-5 h-5" />
}

function classificationBg(cls: string) {
  switch (cls) {
    case 'PREMIUM': return 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
    case 'STRONG': return 'bg-green-400/15 border-green-400/30 text-green-400'
    case 'VALID': return 'bg-blue-400/15 border-blue-400/30 text-blue-400'
    default: return 'bg-bg-tertiary border-border text-text-muted'
  }
}

function classifyScore(score: number): string {
  if (score >= 85) return 'PREMIUM'
  if (score >= 70) return 'STRONG'
  if (score >= 55) return 'VALID'
  if (score >= 40) return 'WEAK'
  return 'NO ENTRY'
}

function SignalCard({ sig, tf, t }: { sig: SignalHistory | null; tf: string; t: (k: string) => string }) {
  if (!sig) {
    return (
      <div className="rounded-lg border border-border/50 p-3 bg-bg-secondary/30">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-text-muted">{tf}</span>
        </div>
        <div className="flex items-center justify-center gap-1 text-text-muted text-sm font-bold py-1.5">
          <Minus className="w-4 h-4" />
          <span>{t('trading.noSignal') || 'NO SIGNAL'}</span>
        </div>
      </div>
    )
  }

  const extScore = sig.extended_score ?? sig.confidence
  const cls = sig.classification || classifyScore(extScore)

  return (
    <div className={cn('rounded-lg border p-3', directionBg(sig.direction))}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-text-muted">{sig.timeframe}</span>
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', classificationBg(cls))}>{cls}</span>
      </div>
      {sig.date && <div className="text-[9px] text-text-muted font-mono text-center mb-0.5">{formatTimestamp(sig.date)}</div>}
      <div className={cn('flex items-center justify-center gap-1.5 font-bold text-lg', directionColor(sig.direction))}>
        <DirectionIcon direction={sig.direction} />
        <span>{sig.direction}</span>
      </div>
      <div className="text-center mt-1">
        <span className={cn('text-sm font-mono font-bold', directionColor(sig.direction))}>{extScore}%</span>
      </div>
      {sig.tp1 && sig.sl && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5 text-[10px] font-mono">
          <div className="flex justify-between"><span className="text-bullish">TP1</span><span>{formatPrice(sig.tp1)}</span></div>
          <div className="flex justify-between"><span className="text-bearish">SL</span><span>{formatPrice(sig.sl)}</span></div>
        </div>
      )}
    </div>
  )
}

export default function Overview() {
  const { t, ta } = useI18n()
  const { data: prices, loading: priceLoading } = usePriceChanges()
  const { data: cycleScore } = useLatestCycleScore()
  const { data: signals } = useLatestSignals()
  const { data: sentiment } = useLatestSentiment()
  const { data: alerts } = useActiveAlerts()
  const { data: conclusions } = useConclusions(undefined, 3)

  const PHASE_LABELS: Record<string, string> = {
    capitulation: t('phase.capitulation'),
    accumulation: t('phase.accumulation'),
    early_bull: t('phase.early_bull'),
    mid_bull: t('phase.mid_bull'),
    late_bull: t('phase.late_bull'),
    distribution: t('phase.distribution'),
    euphoria: t('phase.euphoria'),
  }

  // Signal history for trading cards (single source of truth)
  const { data: signalHistoryRaw } = useSignalHistory(50)
  const latestV2Signals = useMemo(() => {
    if (!signalHistoryRaw) return null
    const byTf = new Map<string, typeof signalHistoryRaw[0]>()
    for (const s of signalHistoryRaw) {
      if (!byTf.has(s.timeframe)) byTf.set(s.timeframe, s)
    }
    return Array.from(byTf.values())
  }, [signalHistoryRaw])

  const priceData = useMemo(() => {
    if (!prices || prices.length < 2) return null
    const current = prices[0].close
    const day = prices.length > 1 ? ((current - prices[1].close) / prices[1].close) * 100 : 0
    const week = prices.length > 7 ? ((current - prices[7].close) / prices[7].close) * 100 : 0
    const month = prices.length > 30 ? ((current - prices[30].close) / prices[30].close) * 100 : 0
    return { current, day, week, month, date: prices[0].date }
  }, [prices])

  const sparkline = useMemo(() => {
    if (!prices) return []
    return [...prices].reverse().slice(-7).map((p) => ({ v: p.close }))
  }, [prices])

  const cs = cycleScore?.[0]
  const fg = sentiment?.find((s) => s.metric === 'FEAR_GREED')
  const fgLabel =
    fg && fg.value <= 20 ? t('overview.extremeFear') : fg && fg.value <= 40 ? t('overview.fear') : fg && fg.value <= 60 ? t('overview.neutral') : fg && fg.value <= 80 ? t('overview.greed') : t('overview.extremeGreed')

  if (priceLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!priceData) return <div className="p-6"><EmptyState command="btc-intel update-data" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')}>
        <HelpButton
          title={t('overview.helpTitle')}
          content={ta('overview')}
        />
      </PageHeader>

      {/* Price Hero */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Bitcoin className="w-6 h-6 md:w-8 md:h-8 text-accent-btc" />
              <span className="font-mono text-2xl md:text-4xl font-bold">{formatPrice(priceData.current)}</span>
            </div>
            <div className="flex gap-3 md:gap-4 text-xs md:text-sm font-mono">
              <span className={priceData.day >= 0 ? 'text-bullish' : 'text-bearish'}>24h: {formatPercent(priceData.day)}</span>
              <span className={priceData.week >= 0 ? 'text-bullish' : 'text-bearish'}>7d: {formatPercent(priceData.week)}</span>
              <span className={priceData.month >= 0 ? 'text-bullish' : 'text-bearish'}>30d: {formatPercent(priceData.month)}</span>
            </div>
          </div>
          {sparkline.length > 0 && (
            <div className="w-full sm:w-32 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline}>
                  <Line type="monotone" dataKey="v" stroke={priceData.week >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Cycle Score Gauge + Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {cs && (
          <div className="lg:col-span-1 rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm flex flex-col items-center">
            <div className="relative w-24 h-24 mb-2">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#2a2a3e" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={cs.score < 30 ? '#22c55e' : cs.score < 70 ? '#f7931a' : '#ef4444'} strokeWidth="10" strokeDasharray={`${(cs.score / 100) * 314} 314`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-xl font-bold">{cs.score}</span>
              </div>
            </div>
            <span className="text-xs font-display text-text-secondary">Cycle Score</span>
            <span className="text-xs font-mono text-accent-btc">{PHASE_LABELS[cs.phase || ''] || cs.phase}</span>
          </div>
        )}
        <div className={`${cs ? 'lg:col-span-4' : 'lg:col-span-5'} grid grid-cols-2 lg:grid-cols-4 gap-4`}>
          <MetricCard title={t('overview.btcPrice')} value={formatPrice(priceData.current)} change={formatPercent(priceData.day)} icon={<Bitcoin className="w-4 h-4" />} />
          <MetricCard title={t('overview.fearGreed')} value={fg ? `${fg.value}` : 'N/A'} subtitle={fg ? fgLabel : ''} icon={<Brain className="w-4 h-4" />} />
          <MetricCard title={t('overview.alerts')} value={alerts ? `${alerts.length}` : '0'} icon={<AlertTriangle className="w-4 h-4" />} />
          <MetricCard title={t('overview.conclusions')} value={conclusions ? `${conclusions.length}` : '0'} icon={<Activity className="w-4 h-4" />} />
        </div>
      </div>

      {/* Trading Signal Summary — driven by signal_history */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-btc" /> {t('overview.tradingSignal')}
          </h3>
          <Link to="/trading" className="flex items-center gap-1 text-xs text-accent-btc hover:text-accent-btc/80 transition-colors">
            {t('overview.seeDetail')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['1H', '4H', '1D', '1W'] as const).map((tf) => (
            <SignalCard key={tf} sig={latestV2Signals?.find(s => s.timeframe === tf) ?? null} tf={tf} t={t} />
          ))}
        </div>
        {signals && signals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {signals.map((s) => (
              <div key={s.indicator} className="flex items-center gap-2 bg-bg-tertiary/50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-mono text-text-secondary">{s.indicator}</span>
                <span className="text-xs font-mono text-text-muted">{s.value != null ? s.value.toFixed(1) : ''}</span>
                {s.signal && <SignalBadge signal={s.signal} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts + Conclusions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {alerts && alerts.length > 0 && (
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-bearish" /> {t('overview.alerts')}</h3>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a) => (
                <div key={a.id} className={`flex items-center gap-3 p-2 rounded-lg ${a.severity === 'critical' ? 'bg-bearish/10 border border-bearish/20' : 'bg-neutral-signal/10 border border-neutral-signal/20'}`}>
                  <span className={`text-xs font-mono uppercase ${a.severity === 'critical' ? 'text-bearish' : 'text-neutral-signal'}`}>{a.severity}</span>
                  <span className="text-sm">{a.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {conclusions && conclusions.length > 0 && (
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-3">{t('overview.conclusions')}</h3>
            <div className="space-y-3">
              {conclusions.map((c) => (
                <div key={c.id} className="border-l-2 border-accent-btc/50 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.title}</span>
                    <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{c.confidence}/10</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
