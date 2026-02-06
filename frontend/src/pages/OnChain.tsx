import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import { useLatestOnchain, useOnchainHistory } from '../hooks/useOnchain'

export default function OnChain() {
  const { data: latest, loading } = useLatestOnchain()
  const { data: hrHistory } = useOnchainHistory('HASH_RATE_MOM_30D', 365)
  const { data: nvtHistory } = useOnchainHistory('NVT_RATIO', 365)

  const hrChart = useMemo(() => hrHistory ? [...hrHistory].reverse().map((d) => ({ date: d.date.slice(5), value: d.value })) : [], [hrHistory])
  const nvtChart = useMemo(() => nvtHistory ? [...nvtHistory].reverse().map((d) => ({ date: d.date.slice(5), value: d.value })) : [], [nvtHistory])

  const hrMom = latest?.find((m) => m.metric === 'HASH_RATE_MOM_30D')
  const nvt = latest?.find((m) => m.metric === 'NVT_RATIO')
  const hashRate = latest?.find((m) => m.metric === 'HASH_RATE')

  const insights = useMemo(() => {
    const items: { type: 'bullish' | 'bearish' | 'neutral'; text: string }[] = []
    if (hrMom) {
      if (hrMom.value > 0) {
        items.push({ type: 'bullish', text: 'Hash Rate creciendo: la red se fortalece, mineros optimistas' })
      } else {
        items.push({ type: 'bearish', text: 'Hash Rate descendiendo: posible estres en mineros' })
      }
    }
    if (nvt) {
      if (nvt.value > 65) {
        items.push({ type: 'bearish', text: 'NVT alto (>65): red posiblemente sobrevalorada respecto a su uso real' })
      } else if (nvt.value < 30) {
        items.push({ type: 'bullish', text: 'NVT bajo (<30): red infravalorada, buena relacion valor/uso' })
      } else {
        items.push({ type: 'neutral', text: 'NVT en rango normal' })
      }
    }
    const bullish = items.filter((i) => i.type === 'bullish').length
    const bearish = items.filter((i) => i.type === 'bearish').length
    if (bullish > bearish) {
      items.push({ type: 'bullish', text: 'En conjunto, las metricas on-chain muestran una red saludable y en crecimiento' })
    } else if (bearish > bullish) {
      items.push({ type: 'bearish', text: 'En conjunto, las metricas on-chain muestran senales de debilidad en la red' })
    } else {
      items.push({ type: 'neutral', text: 'Las metricas on-chain muestran senales mixtas, sin tendencia clara' })
    }
    return items
  }, [hrMom, nvt])

  if (loading) return <div className="p-6"><PageHeader title="On-Chain" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!latest?.length) return <div className="p-6"><PageHeader title="On-Chain" /><EmptyState command="btc-intel analyze onchain" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="On-Chain Metrics" subtitle="Hash rate, NVT, network health">
        <HelpButton
          title="Metricas On-Chain"
          content={[
            "Datos directos de la blockchain de Bitcoin que muestran la salud de la red.",
            "Hash Rate: Potencia computacional total de la red Bitcoin en Exahashes/segundo. Un hash rate creciente indica una red mas segura y mineros optimistas.",
            "HR Momentum 30D: Cambio porcentual del hash rate en los ultimos 30 dias. Positivo = red creciendo, Negativo = mineros abandonando (posible senal de estres).",
            "NVT Ratio (Network Value to Transactions): Similar al P/E ratio en acciones. Compara la capitalizacion de mercado con el volumen de transacciones. NVT alto = red sobrevalorada, NVT bajo = red infravalorada.",
            "Signals: Las senales se generan automaticamente basandose en umbrales historicos de cada metrica.",
            "Estas metricas son fundamentales porque reflejan la actividad REAL en la blockchain, no solo especulacion en exchanges.",
          ]}
        />
      </PageHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Hash Rate" value={hashRate ? `${(hashRate.value / 1e18).toFixed(1)} EH/s` : 'N/A'} signal={hrMom?.signal} />
        <MetricCard title="HR Momentum 30D" value={hrMom ? `${hrMom.value.toFixed(2)}%` : 'N/A'} signal={hrMom?.signal} />
        <MetricCard title="NVT Ratio" value={nvt ? nvt.value.toFixed(2) : 'N/A'} signal={nvt?.signal} />
      </div>
      <ChartContainer title="Hash Rate Momentum 30D">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} />
              <ReferenceLine y={0} stroke="#6b7280" />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>
      <ChartContainer title="NVT Ratio">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={nvtChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} />
              <Line type="monotone" dataKey="value" stroke="#f7931a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* Interpretacion */}
      <div className="rounded-xl bg-gradient-to-br from-accent-purple/10 to-accent-btc/10 border border-accent-purple/30 p-4 md:p-6 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-3">Interpretacion</h3>
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
