import { useMemo } from 'react'
import PageHeader from '../components/common/PageHeader'
import EmptyState from '../components/common/EmptyState'
import MetricCard from '../components/common/MetricCard'
import { useCycles } from '../hooks/useCycles'
import { formatPercent } from '../lib/utils'

const HALVINGS = [
  { date: '2012-11-28', label: '1st Halving' },
  { date: '2016-07-09', label: '2nd Halving' },
  { date: '2020-05-11', label: '3rd Halving' },
  { date: '2024-04-20', label: '4th Halving' },
]

export default function Cycles() {
  const { data: cycles, loading } = useCycles()

  const halvingCycles = useMemo(() => cycles?.filter((c) => c.type === 'halving_cycle') || [], [cycles])
  const bullCycles = useMemo(() => cycles?.filter((c) => c.type === 'bull_market') || [], [cycles])
  const bearCycles = useMemo(() => cycles?.filter((c) => c.type === 'bear_market') || [], [cycles])

  const daysSinceHalving = useMemo(() => {
    const last = new Date('2024-04-20')
    return Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
  }, [])

  if (loading) return <div className="p-6"><PageHeader title="Cycles" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!cycles?.length) return <div className="p-6"><PageHeader title="Cycles" /><EmptyState command="btc-intel seed-all" /></div>

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Cycle Analysis" subtitle="Halvings, bull/bear markets" />

      {/* Halving Timeline */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-6 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-4">Halving Timeline</h3>
        <div className="relative flex items-center justify-between">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border" />
          {HALVINGS.map((h, i) => (
            <div key={h.date} className="relative flex flex-col items-center z-10">
              <div className={`w-4 h-4 rounded-full ${i === HALVINGS.length - 1 ? 'bg-accent-btc animate-pulse' : 'bg-accent-purple'}`} />
              <span className="text-xs font-mono text-text-secondary mt-2">{h.date.slice(0, 7)}</span>
              <span className="text-[10px] text-text-muted">{h.label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-text-secondary mt-4 font-mono">
          Day <span className="text-accent-btc font-bold">{daysSinceHalving}</span> since last halving
        </p>
      </div>

      {/* Current Cycle Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Current Cycle" value="#4" subtitle="2024-04-20" />
        <MetricCard title="Days Since Halving" value={`${daysSinceHalving}`} />
        <MetricCard title="Halving Cycles" value={`${halvingCycles.length}`} />
        <MetricCard title="Bull/Bear" value={`${bullCycles.length}/${bearCycles.length}`} />
      </div>

      {/* Cycles Table */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm overflow-x-auto">
        <h3 className="font-display font-semibold mb-3">All Cycles</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border">
              <th className="text-left py-2 pr-4">Name</th>
              <th className="text-left py-2 pr-4">Type</th>
              <th className="text-right py-2 pr-4">Start</th>
              <th className="text-right py-2 pr-4">End</th>
              <th className="text-right py-2 pr-4">Duration</th>
              <th className="text-right py-2 pr-4">ROI</th>
              <th className="text-right py-2">Max DD</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-bg-tertiary/30">
                <td className="py-2 pr-4 font-mono">{c.name}</td>
                <td className="py-2 pr-4">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${c.type.includes('bull') ? 'bg-bullish/20 text-bullish' : c.type.includes('bear') ? 'bg-bearish/20 text-bearish' : 'bg-accent-btc/20 text-accent-btc'}`}>
                    {c.type}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right font-mono text-text-secondary">{c.start_date?.slice(0, 10)}</td>
                <td className="py-2 pr-4 text-right font-mono text-text-secondary">{c.end_date?.slice(0, 10) || 'ongoing'}</td>
                <td className="py-2 pr-4 text-right font-mono">{c.duration_days ? `${c.duration_days}d` : '—'}</td>
                <td className={`py-2 pr-4 text-right font-mono ${(c.roi_percent || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {c.roi_percent != null ? formatPercent(c.roi_percent) : '—'}
                </td>
                <td className="py-2 text-right font-mono text-bearish">{c.max_drawdown != null ? `${c.max_drawdown}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
