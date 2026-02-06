import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import { useLatestOnchain, useOnchainHistory } from '../hooks/useOnchain'
import { useI18n } from '../lib/i18n'

export default function OnChain() {
  const { t, ta } = useI18n()
  const { data: latest, loading } = useLatestOnchain()
  const { data: hrHistory } = useOnchainHistory('HASH_RATE_MOM_30D', 365)
  const { data: nvtHistory } = useOnchainHistory('NVT_RATIO', 365)
  const { data: frHistory } = useOnchainHistory('FUNDING_RATE', 90)

  const hrChart = useMemo(() => hrHistory ? [...hrHistory].reverse().map((d) => ({ date: d.date.slice(5), value: d.value })) : [], [hrHistory])
  const nvtChart = useMemo(() => nvtHistory ? [...nvtHistory].reverse().map((d) => ({ date: d.date.slice(5), value: d.value })) : [], [nvtHistory])
  const frChart = useMemo(() => frHistory ? [...frHistory].reverse().map((d) => ({ date: d.date.slice(5), value: d.value })) : [], [frHistory])

  const hrMom = latest?.find((m) => m.metric === 'HASH_RATE_MOM_30D')
  const nvt = latest?.find((m) => m.metric === 'NVT_RATIO')
  const hashRate = latest?.find((m) => m.metric === 'HASH_RATE')
  const fundingRate = latest?.find((m) => m.metric === 'FUNDING_RATE')
  const openInterest = latest?.find((m) => m.metric === 'OPEN_INTEREST')

  const insights = useMemo(() => {
    const items: { type: 'bullish' | 'bearish' | 'neutral'; text: string }[] = []
    if (hrMom) {
      if (hrMom.value > 0) {
        items.push({ type: 'bullish', text: t('onchain.hrGrowing') })
      } else {
        items.push({ type: 'bearish', text: t('onchain.hrDecreasing') })
      }
    }
    if (nvt) {
      if (nvt.value > 65) {
        items.push({ type: 'bearish', text: t('onchain.nvtHigh') })
      } else if (nvt.value < 30) {
        items.push({ type: 'bullish', text: t('onchain.nvtLow') })
      } else {
        items.push({ type: 'neutral', text: t('onchain.nvtNormal') })
      }
    }
    // Funding Rate insights
    if (fundingRate) {
      const fr = fundingRate.value
      if (Math.abs(fr) > 0.05) {
        items.push({ type: fr > 0 ? 'bearish' : 'bullish', text: t('onchain.frExtreme') })
      } else if (fr > 0.01) {
        items.push({ type: 'neutral', text: t('onchain.frPositive') })
      } else if (fr < -0.01) {
        items.push({ type: 'neutral', text: t('onchain.frNegative') })
      } else {
        items.push({ type: 'neutral', text: t('onchain.frNeutral') })
      }
    }
    // OI insights
    if (openInterest) {
      const sig = openInterest.signal
      if (sig === 'bearish') {
        items.push({ type: 'bearish', text: t('onchain.oiHigh') })
      } else if (sig === 'bullish') {
        items.push({ type: 'bullish', text: t('onchain.oiLow') })
      } else {
        items.push({ type: 'neutral', text: t('onchain.oiNormal') })
      }
    }

    const bullish = items.filter((i) => i.type === 'bullish').length
    const bearish = items.filter((i) => i.type === 'bearish').length
    if (bullish > bearish) {
      items.push({ type: 'bullish', text: t('onchain.healthyNetwork') })
    } else if (bearish > bullish) {
      items.push({ type: 'bearish', text: t('onchain.weakNetwork') })
    } else {
      items.push({ type: 'neutral', text: t('onchain.mixedSignals') })
    }
    return items
  }, [hrMom, nvt, fundingRate, openInterest, t])

  if (loading) return <div className="p-6"><PageHeader title="On-Chain" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!latest?.length) return <div className="p-6"><PageHeader title="On-Chain" /><EmptyState command="btc-intel analyze onchain" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('onchain.title')} subtitle={t('onchain.subtitle')}>
        <HelpButton
          title={t('onchain.helpTitle')}
          content={ta('onchain')}
        />
      </PageHeader>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard title={t('onchain.hashRate')} value={hashRate ? `${(hashRate.value / 1e18).toFixed(1)} EH/s` : 'N/A'} signal={hrMom?.signal} />
        <MetricCard title={t('onchain.hrMomentum')} value={hrMom ? `${hrMom.value.toFixed(2)}%` : 'N/A'} signal={hrMom?.signal} />
        <MetricCard title={t('onchain.nvtRatio')} value={nvt ? nvt.value.toFixed(2) : 'N/A'} signal={nvt?.signal} />
        <MetricCard title={t('onchain.fundingRate')} value={fundingRate ? `${fundingRate.value.toFixed(4)}%` : 'N/A'} signal={fundingRate?.signal} />
        <MetricCard title={t('onchain.openInterest')} value={openInterest ? `$${(openInterest.value / 1e9).toFixed(2)}B` : 'N/A'} signal={openInterest?.signal} />
      </div>

      {/* Hash Rate Momentum Chart */}
      <ChartContainer title={t('onchain.hrMomentumChart')}>
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

      {/* NVT Chart */}
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

      {/* Funding Rate Chart */}
      {frChart.length > 0 && (
        <ChartContainer title={t('onchain.fundingRateChart')}>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={frChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => `${v.toFixed(3)}%`} />
                <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8 }} formatter={(v) => [`${Number(v).toFixed(4)}%`, 'Funding Rate']} />
                <ReferenceLine y={0} stroke="#6b7280" />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      )}

      {/* Interpretation */}
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
