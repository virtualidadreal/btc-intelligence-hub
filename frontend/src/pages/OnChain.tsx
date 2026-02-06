import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
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

  if (loading) return <div className="p-6"><PageHeader title="On-Chain" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!latest?.length) return <div className="p-6"><PageHeader title="On-Chain" /><EmptyState command="btc-intel analyze onchain" /></div>

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="On-Chain Metrics" subtitle="Hash rate, NVT, network health" />
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
    </div>
  )
}
