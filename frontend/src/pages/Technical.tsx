import { useMemo, useState, useCallback } from 'react'
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Bar, ReferenceLine, ReferenceDot } from 'recharts'
import { SignalBadge } from '../components/common/MetricCard'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import { useIndicatorHistory, useLatestSignals } from '../hooks/useTechnical'
import { usePriceHistory } from '../hooks/usePrices'
import { formatPrice } from '../lib/utils'

const RANGE_DAYS: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, ALL: 9999 }

function sliceByRange<T>(data: T[], range: string): T[] {
  const days = RANGE_DAYS[range] || 365
  if (days >= data.length) return data
  return data.slice(-days)
}

export default function Technical() {
  const [range, setRange] = useState('1Y')
  const { data: rsiData, loading } = useIndicatorHistory('RSI_14', 3000)
  const { data: macdData } = useIndicatorHistory('MACD', 3000)
  const { data: macdSignalData } = useIndicatorHistory('MACD_SIGNAL', 3000)
  const { data: macdHistData } = useIndicatorHistory('MACD_HIST', 3000)
  const { data: signals } = useLatestSignals()
  const { data: prices } = usePriceHistory(3000)

  const handleRange = useCallback((r: string) => setRange(r), [])

  // Build full datasets (reversed = chronological)
  const fullRsi = useMemo(() => {
    if (!rsiData) return []
    return [...rsiData].reverse().map((d) => ({ date: d.date.slice(5), fullDate: d.date, value: d.value, signal: d.signal }))
  }, [rsiData])

  const fullMacd = useMemo(() => {
    if (!macdData) return []
    const signalMap = new Map(macdSignalData?.map((d) => [d.date, d.value]) || [])
    const histMap = new Map(macdHistData?.map((d) => [d.date, d.value]) || [])
    return [...macdData].reverse().map((d) => ({
      date: d.date.slice(5),
      fullDate: d.date,
      macd: d.value,
      signal_line: signalMap.get(d.date) ?? null,
      histogram: histMap.get(d.date) ?? null,
      sig: d.signal,
    }))
  }, [macdData, macdSignalData, macdHistData])

  const fullPrice = useMemo(() => {
    if (!prices) return []
    return [...prices].reverse().map((p) => ({ date: p.date.slice(5), fullDate: p.date, price: p.close }))
  }, [prices])

  // Apply time range filter
  const rsiChart = useMemo(() => sliceByRange(fullRsi, range), [fullRsi, range])
  const macdChart = useMemo(() => sliceByRange(fullMacd, range), [fullMacd, range])
  const priceChart = useMemo(() => sliceByRange(fullPrice, range), [fullPrice, range])

  // Detect MACD crossovers
  const crosses = useMemo(() => {
    const pts: { date: string; macd: number; type: 'bullish' | 'bearish' }[] = []
    for (let i = 1; i < macdChart.length; i++) {
      const prev = macdChart[i - 1]
      const curr = macdChart[i]
      if (prev.macd != null && prev.signal_line != null && curr.macd != null && curr.signal_line != null) {
        const prevDiff = prev.macd - prev.signal_line
        const currDiff = curr.macd - curr.signal_line
        if (prevDiff <= 0 && currDiff > 0) pts.push({ date: curr.date, macd: curr.macd, type: 'bullish' })
        if (prevDiff >= 0 && currDiff < 0) pts.push({ date: curr.date, macd: curr.macd, type: 'bearish' })
      }
    }
    return pts
  }, [macdChart])

  // Technical interpretation
  const insights = useMemo(() => {
    const result: { type: 'bullish' | 'bearish' | 'neutral'; text: string }[] = []
    if (!rsiChart.length) return result
    const latestRsi = rsiChart[rsiChart.length - 1]
    if (latestRsi) {
      if (latestRsi.value > 70) result.push({ type: 'bearish', text: `RSI en sobrecompra (${latestRsi.value.toFixed(1)}): posible correccion a corto plazo` })
      else if (latestRsi.value < 30) result.push({ type: 'bullish', text: `RSI en sobreventa (${latestRsi.value.toFixed(1)}): posible rebote a corto plazo` })
      else if (latestRsi.value > 50) result.push({ type: 'bullish', text: `RSI en zona alcista (${latestRsi.value.toFixed(1)}): momentum positivo` })
      else result.push({ type: 'bearish', text: `RSI en zona bajista (${latestRsi.value.toFixed(1)}): momentum debil` })
    }
    if (macdChart.length) {
      const latestMacd = macdChart[macdChart.length - 1]
      if (latestMacd.histogram != null) {
        if (latestMacd.histogram > 0) result.push({ type: 'bullish', text: `MACD histograma positivo (${latestMacd.histogram.toFixed(2)}): momentum alcista` })
        else result.push({ type: 'bearish', text: `MACD histograma negativo (${latestMacd.histogram.toFixed(2)}): momentum bajista` })
      }
      if (crosses.length) {
        const lastCross = crosses[crosses.length - 1]
        result.push({
          type: lastCross.type,
          text: `Ultimo cruce MACD: ${lastCross.type === 'bullish' ? 'alcista (MACD cruza por encima de signal)' : 'bajista (MACD cruza por debajo de signal)'} en ${lastCross.date}`,
        })
      }
    }
    const smaSignal = signals?.find((s) => s.indicator === 'SMA_CROSS')
    if (smaSignal) {
      result.push({
        type: smaSignal.signal === 'bullish' ? 'bullish' : smaSignal.signal === 'bearish' ? 'bearish' : 'neutral',
        text: smaSignal.signal === 'bullish' ? 'Golden Cross activo (SMA50 > SMA200): tendencia alcista de largo plazo' : smaSignal.signal === 'bearish' ? 'Death Cross activo (SMA50 < SMA200): tendencia bajista de largo plazo' : 'SMAs convergiendo: posible cambio de tendencia',
      })
    }
    return result
  }, [rsiChart, macdChart, crosses, signals])

  if (loading) return <div className="p-6"><PageHeader title="Technical" /><div className="grid grid-cols-2 gap-4">{Array.from({length:4}).map((_,i)=><CardSkeleton key={i}/>)}</div></div>

  if (!rsiData?.length) return <div className="p-6"><PageHeader title="Technical" /><EmptyState command="btc-intel analyze technical" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Technical Analysis" subtitle="Indicadores tecnicos y signals">
        <HelpButton
          title="Analisis Tecnico"
          content={[
            "Indicadores tecnicos calculados sobre el precio historico de BTC.",
            "RSI (14): Relative Strength Index. Por encima de 70 = sobrecompra, por debajo de 30 = sobreventa.",
            "MACD: Linea MACD (naranja), Signal (azul), Histograma (barras). Los circulos marcan los cruces: verde=alcista, rojo=bajista.",
            "SMA Cross: Cruce de medias moviles SMA 50 y SMA 200. Golden Cross = senal alcista, Death Cross = bajista.",
            "Usa los botones 1M/3M/6M/1Y/ALL para cambiar el rango temporal de todos los graficos.",
          ]}
        />
      </PageHeader>

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
      <ChartContainer title="BTC Price" activeRange={range} onTimeRangeChange={handleRange}>
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
      <ChartContainer title="RSI (14)" activeRange={range} onTimeRangeChange={handleRange}>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rsiChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '70', position: 'right', fill: '#ef4444', fontSize: 10 }} />
              <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: '30', position: 'right', fill: '#22c55e', fontSize: 10 }} />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* MACD Chart */}
      <ChartContainer title="MACD (12, 26, 9)" activeRange={range} onTimeRangeChange={handleRange}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={macdChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [v != null ? Number(v).toFixed(2) : '—', name === 'macd' ? 'MACD' : name === 'signal_line' ? 'Signal' : 'Histogram']}
              />
              <ReferenceLine y={0} stroke="#4b5563" />
              <Bar dataKey="histogram" fill="#6b7280" opacity={0.5} />
              <Line type="monotone" dataKey="macd" stroke="#f7931a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="signal_line" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              {crosses.map((c, i) => (
                <ReferenceDot
                  key={i}
                  x={c.date}
                  y={c.macd}
                  r={4}
                  fill={c.type === 'bullish' ? '#22c55e' : '#ef4444'}
                  stroke="none"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f7931a] inline-block" /> MACD</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#3b82f6] inline-block border-dashed" /> Signal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bullish inline-block" /> Cruce alcista</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bearish inline-block" /> Cruce bajista</span>
        </div>
      </ChartContainer>

      {/* Interpretation */}
      {insights.length > 0 && (
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
      )}
    </div>
  )
}
