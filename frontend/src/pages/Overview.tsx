import { useMemo } from 'react'
import { Activity, TrendingUp, Shield, AlertTriangle, Brain, Bitcoin } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import MetricCard, { SignalBadge } from '../components/common/MetricCard'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { usePriceChanges } from '../hooks/usePrices'
import { useLatestCycleScore } from '../hooks/useCycleScore'
import { useLatestSignals } from '../hooks/useTechnical'
import { useLatestSentiment } from '../hooks/useSentiment'
import { useActiveAlerts } from '../hooks/useAlerts'
import { useConclusions } from '../hooks/useConclusions'
import { formatPrice, formatPercent } from '../lib/utils'

const PHASE_LABELS: Record<string, string> = {
  capitulation: 'CAPITULACION',
  accumulation: 'ACUMULACION',
  early_bull: 'BULL TEMPRANO',
  mid_bull: 'BULL MEDIO',
  late_bull: 'BULL TARDIO',
  distribution: 'DISTRIBUCION',
  euphoria: 'EUFORIA',
}

export default function Overview() {
  const { data: prices, loading: priceLoading } = usePriceChanges()
  const { data: cycleScore } = useLatestCycleScore()
  const { data: signals } = useLatestSignals()
  const { data: sentiment } = useLatestSentiment()
  const { data: alerts } = useActiveAlerts()
  const { data: conclusions } = useConclusions(undefined, 3)

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
    fg && fg.value <= 20 ? 'Miedo Extremo' : fg && fg.value <= 40 ? 'Miedo' : fg && fg.value <= 60 ? 'Neutral' : fg && fg.value <= 80 ? 'Codicia' : 'Codicia Extrema'

  if (priceLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Overview" subtitle="BTC Intelligence Hub" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!priceData) return <div className="p-6"><EmptyState command="btc-intel update-data" /></div>

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Overview" subtitle="BTC Intelligence Hub" />

      {/* Price Hero */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Bitcoin className="w-8 h-8 text-accent-btc" />
              <span className="font-mono text-4xl font-bold">{formatPrice(priceData.current)}</span>
            </div>
            <div className="flex gap-4 text-sm font-mono">
              <span className={priceData.day >= 0 ? 'text-bullish' : 'text-bearish'}>24h: {formatPercent(priceData.day)}</span>
              <span className={priceData.week >= 0 ? 'text-bullish' : 'text-bearish'}>7d: {formatPercent(priceData.week)}</span>
              <span className={priceData.month >= 0 ? 'text-bullish' : 'text-bearish'}>30d: {formatPercent(priceData.month)}</span>
            </div>
          </div>
          {sparkline.length > 0 && (
            <div className="w-32 h-12">
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
          <MetricCard title="BTC Price" value={formatPrice(priceData.current)} change={formatPercent(priceData.day)} icon={<Bitcoin className="w-4 h-4" />} />
          <MetricCard title="Fear & Greed" value={fg ? `${fg.value}` : 'N/A'} subtitle={fg ? fgLabel : ''} icon={<Brain className="w-4 h-4" />} />
          <MetricCard title="Alertas" value={alerts ? `${alerts.length}` : '0'} icon={<AlertTriangle className="w-4 h-4" />} />
          <MetricCard title="Conclusiones" value={conclusions ? `${conclusions.length}` : '0'} icon={<Activity className="w-4 h-4" />} />
        </div>
      </div>

      {/* Signals */}
      {signals && signals.length > 0 && (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent-btc" /> Signals</h3>
          <div className="flex flex-wrap gap-2">
            {signals.map((s, i) => (
              <div key={`${s.indicator}-${i}`} className="flex items-center gap-2 bg-bg-tertiary/50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-mono text-text-secondary">{s.indicator}</span>
                {s.signal && <SignalBadge signal={s.signal} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts + Conclusions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {alerts && alerts.length > 0 && (
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-bearish" /> Alertas</h3>
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
            <h3 className="font-display font-semibold mb-3">Conclusiones</h3>
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
