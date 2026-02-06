import { useMemo } from 'react'
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Bar } from 'recharts'
import { SignalBadge } from '../components/common/MetricCard'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import ChartContainer from '../components/common/ChartContainer'
import { useIndicatorHistory, useLatestSignals } from '../hooks/useTechnical'
import { usePriceHistory } from '../hooks/usePrices'
import { formatPrice } from '../lib/utils'

export default function Technical() {
  const { data: rsiData, loading } = useIndicatorHistory('RSI_14', 365)
  const { data: macdData } = useIndicatorHistory('MACD', 365)
  const { data: signals } = useLatestSignals()
  const { data: prices } = usePriceHistory(365)

  const rsiChart = useMemo(() => {
    if (!rsiData) return []
    return [...rsiData].reverse().map((d) => ({ date: d.date.slice(5), value: d.value, signal: d.signal }))
  }, [rsiData])

  const macdChart = useMemo(() => {
    if (!macdData) return []
    return [...macdData].reverse().map((d) => ({ date: d.date.slice(5), value: d.value }))
  }, [macdData])

  const priceChart = useMemo(() => {
    if (!prices) return []
    return [...prices].reverse().map((p) => ({ date: p.date.slice(5), price: p.close }))
  }, [prices])

  if (loading) return <div className="p-6"><PageHeader title="Technical" /><div className="grid grid-cols-2 gap-4">{Array.from({length:4}).map((_,i)=><CardSkeleton key={i}/>)}</div></div>

  if (!rsiData?.length) return <div className="p-6"><PageHeader title="Technical" /><EmptyState command="btc-intel analyze technical" /></div>

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Technical Analysis" subtitle="Indicadores tecnico y signals" />

      {/* Latest Signals */}
      {signals && signals.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {signals.map((s, i) => (
            <div key={`${s.indicator}-${i}`} className="flex items-center gap-2 bg-bg-secondary/60 border border-border rounded-lg px-4 py-2">
              <span className="text-sm font-mono text-text-secondary">{s.indicator}:</span>
              <span className="font-mono text-sm">{typeof s.value === 'number' ? s.value.toFixed(2) : s.value}</span>
              {s.signal && <SignalBadge signal={s.signal} />}
            </div>
          ))}
        </div>
      )}

      {/* Price Chart */}
      <ChartContainer title="BTC Price">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceChart}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f7931a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f7931a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} labelStyle={{ color: '#9ca3af' }} formatter={(v) => [formatPrice(Number(v)), 'BTC']} />
              <Area type="monotone" dataKey="price" stroke="#f7931a" fill="url(#priceGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* RSI Chart */}
      <ChartContainer title="RSI (14)">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rsiChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} />
              {/* Overbought/Oversold lines */}
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span>Oversold (&lt;30)</span>
          <span>Overbought (&gt;70)</span>
        </div>
      </ChartContainer>

      {/* MACD Chart */}
      <ChartContainer title="MACD">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={macdChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#3b82f6" opacity={0.6} />
              <Line type="monotone" dataKey="value" stroke="#f7931a" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>
    </div>
  )
}
