import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import { usePriceHistory } from '../hooks/usePrices'
import { useI18n } from '../lib/i18n'

export default function Risk() {
  const { t, ta } = useI18n()
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
    if (dd > -5) result.push({ type: 'bullish', text: `${t('risk.minimalDD')} (${dd.toFixed(2)}%): ${t('risk.minimalDDDesc')}` })
    else if (dd >= -15) result.push({ type: 'neutral', text: `${t('risk.moderateDD')} (${dd.toFixed(2)}%): ${t('risk.moderateDDDesc')}` })
    else if (dd >= -30) result.push({ type: 'bearish', text: `${t('risk.significantDD')} (${dd.toFixed(2)}%): ${t('risk.significantDDDesc')}` })
    else result.push({ type: 'bearish', text: `${t('risk.severeDD')} (${dd.toFixed(2)}%): ${t('risk.severeDDDesc')}` })

    // Volatility
    if (vol < 40) result.push({ type: 'bullish', text: `${t('risk.lowVol')} (${vol.toFixed(1)}%): ${t('risk.lowVolDesc')}` })
    else if (vol <= 70) result.push({ type: 'neutral', text: `${t('risk.medVol')} (${vol.toFixed(1)}%): ${t('risk.medVolDesc')}` })
    else result.push({ type: 'bearish', text: `${t('risk.highVol')} (${vol.toFixed(1)}%): ${t('risk.highVolDesc')}` })

    // Sharpe
    if (sharpe > 2) result.push({ type: 'bullish', text: `${t('risk.sharpeExcellent')} (${sharpe.toFixed(2)}): ${t('risk.sharpeExcellentDesc')}` })
    else if (sharpe >= 1) result.push({ type: 'bullish', text: `${t('risk.sharpeGood')} (${sharpe.toFixed(2)}): ${t('risk.sharpeGoodDesc')}` })
    else if (sharpe >= 0) result.push({ type: 'neutral', text: `${t('risk.sharpeLow')} (${sharpe.toFixed(2)}): ${t('risk.sharpeLowDesc')}` })
    else result.push({ type: 'bearish', text: `${t('risk.sharpeNeg')} (${sharpe.toFixed(2)}): ${t('risk.sharpeNegDesc')}` })

    // VaR
    result.push({ type: 'neutral', text: `${t('risk.varExplain')} ${var95.toFixed(2)}% ${t('risk.orMore')}` })

    return result
  }, [riskData, t])

  if (loading) return <div className="p-6"><PageHeader title={t('risk.title')} /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!riskData) return <div className="p-6"><PageHeader title={t('risk.title')} /><EmptyState command="btc-intel analyze risk" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('risk.title')} subtitle={t('risk.subtitle')}>
        <HelpButton
          title={t('risk.helpTitle')}
          content={ta('risk')}
        />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title={t('risk.currentDrawdown')} value={`${riskData.currentDD.toFixed(2)}%`} signal={riskData.currentDD < -20 ? 'extreme_bearish' : riskData.currentDD < -10 ? 'bearish' : undefined} />
        <MetricCard title={t('risk.maxDrawdown')} value={`${riskData.maxDD.toFixed(2)}%`} />
        <MetricCard title={t('risk.vol30d')} value={`${riskData.vol30.toFixed(1)}%`} />
        <MetricCard title={t('risk.sharpe')} value={riskData.sharpe.toFixed(4)} signal={riskData.sharpe > 1 ? 'bullish' : riskData.sharpe < 0 ? 'bearish' : undefined} />
        <MetricCard title={t('risk.var95')} value={`${riskData.var95.toFixed(2)}%`} subtitle={t('risk.daily')} />
      </div>

      <ChartContainer title={t('risk.drawdownChart')}>
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
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} formatter={(v) => [`${Number(v).toFixed(2)}%`, t('risk.drawdown')]} />
              <Area type="monotone" dataKey="dd" stroke="#ef4444" fill="url(#ddGrad)" strokeWidth={1.5} />
            </AreaChart>
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
