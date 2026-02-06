import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
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

  if (loading) return <div className="p-6"><PageHeader title="Risk" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!riskData) return <div className="p-6"><PageHeader title="Risk" /><EmptyState command="btc-intel analyze risk" /></div>

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Risk Analysis" subtitle="Drawdown, volatility, Sharpe, VaR" />

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
    </div>
  )
}
