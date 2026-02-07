import { useMemo } from 'react'
import { BarChart as BarChartIcon } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import { useLatestCycleScore, useCycleScoreHistory } from '../hooks/useCycleScore'
import { formatDate } from '../lib/utils'
import { useI18n } from '../lib/i18n'

const PHASE_COLORS: Record<string, string> = {
  capitulation: '#ef4444',
  accumulation: '#22c55e',
  early_bull: '#84cc16',
  mid_bull: '#eab308',
  late_bull: '#f97316',
  distribution: '#f97316',
  euphoria: '#ef4444',
}

export default function CycleScore() {
  const { t, ta } = useI18n()
  const { data: latest, loading } = useLatestCycleScore()
  const { data: history } = useCycleScoreHistory(90)

  const cs = latest?.[0]

  const components = useMemo(() => {
    if (!cs) return []
    return [
      { name: t('cycleScore.smaPosition'), value: cs.mvrv_component, max: 100 },
      { name: t('cycleScore.pricePosition'), value: cs.nupl_component, max: 100 },
      { name: t('cycleScore.halving'), value: cs.halving_component, max: 100 },
      { name: t('cycleScore.rsiMonthly'), value: cs.rsi_monthly_component, max: 100 },
      { name: t('cycleScore.hashRateMom'), value: cs.exchange_flow_component, max: 100 },
      { name: t('cycleScore.fearGreed'), value: cs.fear_greed_component, max: 100 },
      { name: t('cycleScore.fg30d'), value: cs.google_trends_component, max: 100 },
    ].filter((c) => c.value != null)
  }, [cs, t])

  const historyChart = useMemo(() => {
    if (!history) return []
    return [...history].reverse().map((h) => ({ date: h.date.slice(5), score: h.score, phase: h.phase }))
  }, [history])

  const phaseLabel = (phase: string) => t(`phase.${phase}`) || phase

  const insights = useMemo(() => {
    if (!cs) return []
    const result: { type: 'bullish' | 'bearish' | 'neutral'; text: string }[] = []
    const score = cs.score

    // Score level
    if (score <= 14) result.push({ type: 'bullish', text: `${t('cycleScore.capitulation')} (${score}): ${t('cycleScore.capitulationDesc')}` })
    else if (score <= 29) result.push({ type: 'bullish', text: `${t('cycleScore.accumulation')} (${score}): ${t('cycleScore.accumulationDesc')}` })
    else if (score <= 44) result.push({ type: 'neutral', text: `${t('cycleScore.earlyBull')} (${score}): ${t('cycleScore.earlyBullDesc')}` })
    else if (score <= 59) result.push({ type: 'neutral', text: `${t('cycleScore.midBull')} (${score}): ${t('cycleScore.midBullDesc')}` })
    else if (score <= 74) result.push({ type: 'bearish', text: `${t('cycleScore.lateBull')} (${score}): ${t('cycleScore.lateBullDesc')}` })
    else if (score <= 84) result.push({ type: 'bearish', text: `${t('cycleScore.distribution')} (${score}): ${t('cycleScore.distributionDesc')}` })
    else result.push({ type: 'bearish', text: `${t('cycleScore.euphoria')} (${score}): ${t('cycleScore.euphoriaDesc')}` })

    // Components analysis
    if (components.length > 0) {
      const highest = components.reduce((a, b) => ((a.value || 0) > (b.value || 0) ? a : b))
      const lowest = components.reduce((a, b) => ((a.value || 0) < (b.value || 0) ? a : b))
      result.push({ type: 'bearish', text: `${t('cycleScore.mostBearish')} ${highest.name} (${highest.value}/100)` })
      result.push({ type: 'bullish', text: `${t('cycleScore.mostBullish')} ${lowest.name} (${lowest.value}/100)` })
    }

    // History trend
    if (history && history.length >= 30) {
      const reversed = [...history].reverse()
      const current = reversed[reversed.length - 1]
      const thirtyDaysAgo = reversed[reversed.length - 31] || reversed[0]
      if (current && thirtyDaysAgo) {
        if (current.score > thirtyDaysAgo.score) {
          result.push({ type: 'bearish', text: `${t('cycleScore.trendUp')} (${t('cycleScore.ago30d')} ${thirtyDaysAgo.score}, ${t('cycleScore.now')} ${current.score})` })
        } else if (current.score < thirtyDaysAgo.score) {
          result.push({ type: 'bullish', text: `${t('cycleScore.trendDown')} (${t('cycleScore.ago30d')} ${thirtyDaysAgo.score}, ${t('cycleScore.now')} ${current.score})` })
        }
      }
    }

    return result
  }, [cs, components, history, t])

  if (loading) return <div className="p-6"><PageHeader title={t('cycleScore.title')} /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!cs) return <div className="p-6"><PageHeader title={t('cycleScore.title')} /><EmptyState command="btc-intel analyze cycle-score" /></div>

  const phaseColor = PHASE_COLORS[cs.phase || ''] || '#f7931a'

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('cycleScore.title')} subtitle={t('cycleScore.subtitle')}>
        <HelpButton
          title={t('cycleScore.helpTitle')}
          content={ta('cycleScore')}
        />
      </PageHeader>

      {/* Score Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-6 backdrop-blur-sm flex flex-col items-center">
          <div className="relative w-40 h-40 mb-3">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#2a2a3e" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={phaseColor} strokeWidth="10" strokeDasharray={`${(cs.score / 100) * 314} 314`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-4xl font-bold">{cs.score}</span>
              <span className="text-xs text-text-muted">/100</span>
            </div>
          </div>
          <span className="font-display font-semibold" style={{ color: phaseColor }}>{phaseLabel(cs.phase || '')}</span>
          <span className="text-xs text-text-muted mt-1">{formatDate(cs.date)}</span>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <MetricCard title={t('cycleScore.score')} value={`${cs.score}/100`} subtitle={phaseLabel(cs.phase || '')} />
          <MetricCard title={t('cycleScore.phase')} value={phaseLabel(cs.phase || '') || 'N/A'} />
          <MetricCard title={t('cycleScore.components')} value={`${components.length}`} subtitle={t('cycleScore.activeInputs')} icon={<BarChartIcon className="w-4 h-4" />} />
          <MetricCard title={t('cycleScore.date')} value={formatDate(cs.date)} />
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-4">{t('cycleScore.componentBreakdown')}</h3>
        <div className="space-y-3">
          {components.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-28 shrink-0">{c.name}</span>
              <div className="flex-1 h-3 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${c.value}%`, backgroundColor: (c.value || 0) < 30 ? '#22c55e' : (c.value || 0) < 70 ? '#f7931a' : '#ef4444' }}
                />
              </div>
              <span className="text-xs font-mono w-8 text-right">{c.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Score History */}
      <ChartContainer title={t('cycleScore.history')}>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="#f7931a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* Interpretacion */}
      <div className="rounded-xl bg-gradient-to-br from-accent-purple/10 to-accent-btc/10 border border-accent-purple/30 p-4 md:p-6 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-3">{t('common.interpretation')}</h3>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${insight.type === 'bullish' ? 'bg-bullish' : insight.type === 'bearish' ? 'bg-bearish' : 'bg-neutral-signal'}`} />
              <p className="text-sm text-text-secondary">{insight.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
