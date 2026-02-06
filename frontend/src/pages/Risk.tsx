import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import { usePriceHistory } from '../hooks/usePrices'

export default function Risk() {
  const { data: prices, loading } = usePriceHistory(365)

  const riskData = useMemo(() => {
    if (!prices || prices.length < 30) return null
    const sorted = [...prices].reverse()
    const returns = sorted.map((p, i) => i === 0 ? 0 : (p.close - sorted[i - 1].close) / sorted[i - 1].close)

    let cummax = 0
    const drawdowns = sorted.map((p) => {
      cummax = Math.max(cummax, p.close)
      return { date: p.date.slice(5), dd: ((p.close - cummax) / cummax) * 100, price: p.close }
    })

    const recent = returns.slice(-30)
    const vol30 = Math.sqrt(recent.reduce((s, r) => s + r * r, 0) / recent.length) * Math.sqrt(365) * 100
    const recent365 = returns.slice(-365)
    const meanRet = recent365.reduce((s, r) => s + r, 0) / recent365.length
    const stdRet = Math.sqrt(recent365.reduce((s, r) => s + (r - meanRet) ** 2, 0) / recent365.length)
    const sharpe = stdRet > 0 ? (meanRet * 365) / (stdRet * Math.sqrt(365)) : 0
    const var95 = (meanRet - 1.645 * stdRet) * 100

    return {
      currentDD: drawdowns[drawdowns.length - 1]?.dd || 0,
      maxDD: Math.min(...drawdowns.map((d) => d.dd)),
      vol30: vol30,
      sharpe: sharpe,
      var95: var95,
      drawdowns: drawdowns,
    }
  }, [prices])

  const insights = useMemo(() => {
    if (!riskData) return []
    const result: { type: 'bullish' | 'bearish' | 'neutral'; text: string }[] = []
    const dd = riskData.currentDD
    const vol = riskData.vol30
    const sharpe = riskData.sharpe
    const var95 = riskData.var95

    // Drawdown
    if (dd > -5) result.push({ type: 'bullish', text: `Drawdown minimo (${dd.toFixed(2)}%): BTC cerca de maximos, tendencia fuerte` })
    else if (dd >= -15) result.push({ type: 'neutral', text: `Drawdown moderado (${dd.toFixed(2)}%): correccion saludable dentro de tendencia` })
    else if (dd >= -30) result.push({ type: 'bearish', text: `Drawdown significativo (${dd.toFixed(2)}%): correccion profunda, posible cambio de tendencia` })
    else result.push({ type: 'bearish', text: `Drawdown severo (${dd.toFixed(2)}%): mercado en fase bajista, extrema precaucion` })

    // Volatility
    if (vol < 40) result.push({ type: 'bullish', text: `Volatilidad baja (${vol.toFixed(1)}%): mercado estable, posible acumulacion` })
    else if (vol <= 70) result.push({ type: 'neutral', text: `Volatilidad media (${vol.toFixed(1)}%): niveles normales para BTC` })
    else result.push({ type: 'bearish', text: `Volatilidad alta (${vol.toFixed(1)}%): mercado inestable, mayor riesgo en operaciones` })

    // Sharpe
    if (sharpe > 2) result.push({ type: 'bullish', text: `Sharpe ratio excelente (${sharpe.toFixed(2)}): retornos excepcionales ajustados por riesgo` })
    else if (sharpe >= 1) result.push({ type: 'bullish', text: `Sharpe ratio bueno (${sharpe.toFixed(2)}): retornos positivos con riesgo aceptable` })
    else if (sharpe >= 0) result.push({ type: 'neutral', text: `Sharpe ratio bajo (${sharpe.toFixed(2)}): retornos positivos pero con alto riesgo` })
    else result.push({ type: 'bearish', text: `Sharpe ratio negativo (${sharpe.toFixed(2)}): perdidas netas, entorno desfavorable` })

    // VaR
    result.push({ type: 'neutral', text: `VaR 95%: en un dia malo (5% de probabilidad), la perdida podria ser de ${var95.toFixed(2)}% o mas` })

    return result
  }, [riskData])

  if (loading) return <div className="p-6"><PageHeader title="Risk" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!riskData) return <div className="p-6"><PageHeader title="Risk" /><EmptyState command="btc-intel analyze risk" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Risk Analysis" subtitle="Drawdown, volatility, Sharpe, VaR">
        <HelpButton
          title="Analisis de Riesgo"
          content={[
            "Metricas de riesgo calculadas sobre el precio historico de BTC.",
            "Current Drawdown: Caida actual desde el ultimo maximo historico. Ejemplo: -15% significa que el precio esta un 15% por debajo de su pico.",
            "Max Drawdown: La mayor caida desde maximo en el periodo analizado. Indica el peor escenario historico.",
            "Volatilidad 30D (Anualizada): Cuanto varia el precio en 30 dias, proyectado a un ano. BTC tipicamente tiene 50-80% de volatilidad anual.",
            "Sharpe Ratio (365D): Mide el retorno ajustado por riesgo. Mayor que 1 = buen rendimiento por unidad de riesgo. Negativo = perdidas.",
            "VaR 95% (diario): Value at Risk. Con 95% de confianza, la perdida maxima esperada en un dia. Ejemplo: -3.5% significa que solo 1 de cada 20 dias deberia caer mas que eso.",
          ]}
        />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Current Drawdown" value={`${riskData.currentDD.toFixed(2)}%`} signal={riskData.currentDD < -20 ? 'extreme_bearish' : riskData.currentDD < -10 ? 'bearish' : undefined} />
        <MetricCard title="Max Drawdown" value={`${riskData.maxDD.toFixed(2)}%`} />
        <MetricCard title="Vol 30D (Ann.)" value={`${riskData.vol30.toFixed(1)}%`} />
        <MetricCard title="Sharpe (365D)" value={riskData.sharpe.toFixed(4)} signal={riskData.sharpe > 1 ? 'bullish' : riskData.sharpe < 0 ? 'bearish' : undefined} />
        <MetricCard title="VaR 95%" value={`${riskData.var95.toFixed(2)}%`} subtitle="daily" />
      </div>

      <ChartContainer title="Drawdown Chart">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={riskData.drawdowns}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Drawdown']} />
              <Area type="monotone" dataKey="dd" stroke="#ef4444" fill="url(#ddGrad)" strokeWidth={1.5} />
            </AreaChart>
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
