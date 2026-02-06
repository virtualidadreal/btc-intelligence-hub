import { useMemo } from 'react'
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import { useLatestSentiment, useSentimentHistory } from '../hooks/useSentiment'

export default function Sentiment() {
  const { data: latest, loading } = useLatestSentiment()
  const { data: fgHistory } = useSentimentHistory('FEAR_GREED', 365)

  const fg = latest?.find((s) => s.metric === 'FEAR_GREED')
  const fg30 = latest?.find((s) => s.metric === 'FEAR_GREED_30D')

  const fgLabel = fg && fg.value <= 20 ? 'Extreme Fear' : fg && fg.value <= 40 ? 'Fear' : fg && fg.value <= 60 ? 'Neutral' : fg && fg.value <= 80 ? 'Greed' : 'Extreme Greed'
  const gaugeColor = fg && fg.value <= 25 ? '#ef4444' : fg && fg.value <= 45 ? '#f97316' : fg && fg.value <= 55 ? '#eab308' : fg && fg.value <= 75 ? '#84cc16' : '#22c55e'

  const fgChart = useMemo(() => fgHistory ? [...fgHistory].reverse().map((d) => ({ date: d.date.slice(5), value: d.value })) : [], [fgHistory])

  if (loading) return <div className="p-6"><PageHeader title="Sentiment" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!fg) return <div className="p-6"><PageHeader title="Sentiment" /><EmptyState command="btc-intel analyze sentiment" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Sentiment Analysis" subtitle="Fear & Greed Index">
        <HelpButton
          title="Analisis de Sentimiento"
          content={[
            "El sentimiento del mercado medido por el indice Fear & Greed de Alternative.me.",
            "Fear & Greed Index: Escala de 0 a 100. 0 = Miedo Extremo (el mercado tiene panico, posible oportunidad de compra). 100 = Codicia Extrema (el mercado esta euforico, posible momento de venta).",
            "30D Average: Media movil de 30 dias del indice. Suaviza el ruido diario y muestra la tendencia general del sentimiento.",
            "Zone: Clasificacion del nivel actual: Extreme Fear (<20), Fear (20-40), Neutral (40-60), Greed (60-80), Extreme Greed (>80).",
            "Divergence: Diferencia entre el valor actual y la media de 30 dias. Valores positivos indican que el sentimiento esta mas alto de lo normal.",
            "Historicamente, comprar en Extreme Fear y vender en Extreme Greed ha sido una estrategia rentable a largo plazo.",
          ]}
        />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fear & Greed Gauge */}
        <div className="lg:col-span-1 rounded-xl bg-bg-secondary/60 border border-border p-6 backdrop-blur-sm flex flex-col items-center">
          <div className="relative w-36 h-36 mb-3">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#2a2a3e" strokeWidth="8" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={gaugeColor} strokeWidth="8" strokeDasharray={`${(fg.value / 100) * 314} 314`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-bold">{fg.value}</span>
              <span className="text-xs text-text-muted">{fgLabel}</span>
            </div>
          </div>
          <span className="text-sm font-display text-text-secondary">Fear & Greed Index</span>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <MetricCard title="Fear & Greed" value={`${fg.value}`} subtitle={fgLabel} />
          <MetricCard title="30D Average" value={fg30 ? `${fg30.value.toFixed(1)}` : 'N/A'} />
          <MetricCard title="Zone" value={fgLabel} signal={fg.value <= 25 ? 'extreme_bearish' : fg.value >= 75 ? 'extreme_bullish' : undefined} />
          <MetricCard title="Divergence" value={fg30 ? `${(fg.value - fg30.value).toFixed(1)}` : 'N/A'} subtitle="vs 30D avg" />
        </div>
      </div>

      <ChartContainer title="Fear & Greed History">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fgChart}>
              <defs>
                <linearGradient id="fgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="#eab308" fill="url(#fgGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>
    </div>
  )
}
