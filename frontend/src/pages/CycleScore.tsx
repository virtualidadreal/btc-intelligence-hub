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

const PHASE_LABELS: Record<string, string> = {
  capitulation: 'CAPITULACION',
  accumulation: 'ACUMULACION',
  early_bull: 'BULL TEMPRANO',
  mid_bull: 'BULL MEDIO',
  late_bull: 'BULL TARDIO',
  distribution: 'DISTRIBUCION',
  euphoria: 'EUFORIA',
}

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
  const { data: latest, loading } = useLatestCycleScore()
  const { data: history } = useCycleScoreHistory(90)

  const cs = latest?.[0]

  const components = useMemo(() => {
    if (!cs) return []
    return [
      { name: 'SMA Position', value: cs.mvrv_component, max: 100 },
      { name: 'Price Position', value: cs.nupl_component, max: 100 },
      { name: 'Halving', value: cs.halving_component, max: 100 },
      { name: 'RSI Monthly', value: cs.rsi_monthly_component, max: 100 },
      { name: 'Hash Rate Mom', value: cs.exchange_flow_component, max: 100 },
      { name: 'Fear & Greed', value: cs.fear_greed_component, max: 100 },
      { name: 'F&G 30D', value: cs.google_trends_component, max: 100 },
    ].filter((c) => c.value != null)
  }, [cs])

  const historyChart = useMemo(() => {
    if (!history) return []
    return [...history].reverse().map((h) => ({ date: h.date.slice(5), score: h.score, phase: h.phase }))
  }, [history])

  if (loading) return <div className="p-6"><PageHeader title="Cycle Score" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!cs) return <div className="p-6"><PageHeader title="Cycle Score" /><EmptyState command="btc-intel analyze cycle-score" /></div>

  const phaseColor = PHASE_COLORS[cs.phase || ''] || '#f7931a'

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Cycle Score" subtitle="Composite indicator 0-100">
        <HelpButton
          title="Cycle Score - Indicador de Ciclo"
          content={[
            "El Cycle Score es un indicador compuesto propietario que condensa multiples metricas en un numero entre 0 y 100, indicando donde estamos en el ciclo de mercado de Bitcoin.",
            "0 = Bottom absoluto / maxima oportunidad de compra. 100 = Top absoluto / maximo riesgo.",
            "Fases: Capitulacion (0-14), Acumulacion (15-29), Bull Temprano (30-44), Bull Medio (45-59), Bull Tardio (60-74), Distribucion (75-84), Euforia (85-100).",
            "Componentes: SMA Position (20%), Price Position (20%), Halving Position (15%), RSI Mensual (10%), Hash Rate Momentum (10%), Fear & Greed (5%), F&G 30D (5%).",
            "Las barras de componentes muestran cuanto aporta cada metrica al score total. Verde = bajo riesgo, Naranja = cautela, Rojo = alto riesgo.",
            "IMPORTANTE: No es predictivo. Indica DONDE estamos en el ciclo, no donde iremos. Usalo como contexto, no como senal de trading.",
          ]}
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
          <span className="font-display font-semibold" style={{ color: phaseColor }}>{PHASE_LABELS[cs.phase || ''] || cs.phase}</span>
          <span className="text-xs text-text-muted mt-1">{formatDate(cs.date)}</span>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <MetricCard title="Score" value={`${cs.score}/100`} subtitle={PHASE_LABELS[cs.phase || '']} />
          <MetricCard title="Phase" value={PHASE_LABELS[cs.phase || ''] || cs.phase || 'N/A'} />
          <MetricCard title="Components" value={`${components.length}`} subtitle="active inputs" icon={<BarChartIcon className="w-4 h-4" />} />
          <MetricCard title="Date" value={formatDate(cs.date)} />
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-4">Component Breakdown</h3>
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
      <ChartContainer title="Score History (90d)">
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
    </div>
  )
}
