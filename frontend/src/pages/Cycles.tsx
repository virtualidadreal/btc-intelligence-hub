import { useMemo } from 'react'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import EmptyState from '../components/common/EmptyState'
import MetricCard from '../components/common/MetricCard'
import { useCycles } from '../hooks/useCycles'
import { formatPercent, formatPrice } from '../lib/utils'

const HALVINGS = [
  { date: '2012-11-28', label: '1st Halving' },
  { date: '2016-07-09', label: '2nd Halving' },
  { date: '2020-05-11', label: '3rd Halving' },
  { date: '2024-04-20', label: '4th Halving' },
]

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0
}

export default function Cycles() {
  const { data: cycles, loading } = useCycles()

  const halvingCycles = useMemo(() => cycles?.filter((c) => c.type === 'halving_cycle') || [], [cycles])
  const bullCycles = useMemo(() => cycles?.filter((c) => c.type === 'bull_market') || [], [cycles])
  const bearCycles = useMemo(() => cycles?.filter((c) => c.type === 'bear_market') || [], [cycles])

  const daysSinceHalving = useMemo(() => {
    const last = new Date('2024-04-20')
    return Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
  }, [])

  // --- Cycle Intervals & Projections ---
  const cycleAnalysis = useMemo(() => {
    if (!cycles?.length) return null

    // Extract peaks from halving cycles (sorted by peak_date)
    const peaks = halvingCycles
      .filter((c) => c.peak_date && c.btc_price_peak)
      .sort((a, b) => a.peak_date!.localeCompare(b.peak_date!))
      .map((c) => ({ date: c.peak_date!, price: c.btc_price_peak!, name: c.name }))

    // Extract bottoms from bear markets (sorted by end_date which is the bottom)
    const bottoms = bearCycles
      .filter((c) => c.end_date && c.btc_price_bottom)
      .sort((a, b) => a.end_date!.localeCompare(b.end_date!))
      .map((c) => ({ date: c.end_date!, price: c.btc_price_bottom!, name: c.name }))

    // 1. Days between tops (peak to peak)
    const topToTop: { from: string; to: string; days: number; priceFrom: number; priceTo: number }[] = []
    for (let i = 1; i < peaks.length; i++) {
      topToTop.push({
        from: peaks[i - 1].date,
        to: peaks[i].date,
        days: daysBetween(peaks[i - 1].date, peaks[i].date),
        priceFrom: peaks[i - 1].price,
        priceTo: peaks[i].price,
      })
    }

    // 2. Days between bottoms
    const bottomToBottom: { from: string; to: string; days: number; priceFrom: number; priceTo: number }[] = []
    for (let i = 1; i < bottoms.length; i++) {
      bottomToBottom.push({
        from: bottoms[i - 1].date,
        to: bottoms[i].date,
        days: daysBetween(bottoms[i - 1].date, bottoms[i].date),
        priceFrom: bottoms[i - 1].price,
        priceTo: bottoms[i].price,
      })
    }

    // 3. Days from top to next bottom
    const topToBottom: { from: string; to: string; days: number; priceFrom: number; priceTo: number; drawdown: number }[] = []
    for (const peak of peaks) {
      const nextBottom = bottoms.find((b) => b.date > peak.date)
      if (nextBottom) {
        topToBottom.push({
          from: peak.date,
          to: nextBottom.date,
          days: daysBetween(peak.date, nextBottom.date),
          priceFrom: peak.price,
          priceTo: nextBottom.price,
          drawdown: ((nextBottom.price - peak.price) / peak.price) * 100,
        })
      }
    }

    // 4. Projections
    const avgTopToTop = avg(topToTop.map((t) => t.days))
    const avgBottomToBottom = avg(bottomToBottom.map((t) => t.days))
    const avgTopToBottom = avg(topToBottom.map((t) => t.days))

    const lastPeak = peaks[peaks.length - 1]
    const lastBottom = bottoms[bottoms.length - 1]

    const projNextTop = lastPeak ? addDays(lastPeak.date, avgTopToTop) : null
    const projNextBottom = lastPeak ? addDays(lastPeak.date, avgTopToBottom) : null
    const projNextBottomFromBottom = lastBottom ? addDays(lastBottom.date, avgBottomToBottom) : null

    return {
      peaks,
      bottoms,
      topToTop,
      bottomToBottom,
      topToBottom,
      avgTopToTop,
      avgBottomToBottom,
      avgTopToBottom,
      lastPeak,
      lastBottom,
      projNextTop,
      projNextBottom,
      projNextBottomFromBottom,
    }
  }, [cycles, halvingCycles, bearCycles])

  if (loading) return <div className="p-6"><PageHeader title="Cycles" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!cycles?.length) return <div className="p-6"><PageHeader title="Cycles" /><EmptyState command="btc-intel seed-all" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Cycle Analysis" subtitle="Halvings, bull/bear markets">
        <HelpButton
          title="Analisis de Ciclos"
          content={[
            "Historial de ciclos de Bitcoin basados en los halvings (reduccion de recompensa de mineria a la mitad cada ~4 anos).",
            "Dias entre Techos: Cuanto tiempo pasa entre cada maximo historico de ciclo (ATH). Util para estimar cuando podria llegar el proximo pico.",
            "Dias entre Suelos: Cuanto tiempo pasa entre cada minimo de ciclo. Los suelos marcan las mejores oportunidades de compra historicas.",
            "Techo a Suelo: Cuanto dura la caida desde el maximo hasta el minimo. Incluye el drawdown (% de caida).",
            "Proyecciones: Estimacion del proximo techo y suelo basada en los promedios de ciclos anteriores. Son orientativas, no predicciones exactas.",
            "All Cycles: Tabla con todos los ciclos registrados, incluyendo ROI y Max Drawdown.",
            "Patron historico: Rendimientos decrecientes por ciclo (5167%, 1222%, 643%), caidas cada vez menores (-87%, -84%, -77%).",
          ]}
        />
      </PageHeader>

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

      {/* Cycle Intervals & Projections */}
      {cycleAnalysis && (
        <>
          {/* Top to Top */}
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-bullish" /> Dias entre Techos de Ciclo
            </h3>
            <div className="space-y-3">
              {cycleAnalysis.topToTop.map((t, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-bg-tertiary/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-secondary">{t.from.slice(0, 10)}</span>
                    <span className="text-text-muted">→</span>
                    <span className="font-mono text-text-secondary">{t.to.slice(0, 10)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{formatPrice(t.priceFrom)} → {formatPrice(t.priceTo)}</span>
                    <span className="font-mono font-bold text-bullish">{t.days}d</span>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm text-text-secondary">
                Promedio: <span className="font-mono font-bold text-text-primary">{cycleAnalysis.avgTopToTop} dias</span>
              </div>
            </div>
          </div>

          {/* Bottom to Bottom */}
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-bearish" /> Dias entre Suelos de Ciclo
            </h3>
            <div className="space-y-3">
              {cycleAnalysis.bottomToBottom.map((t, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-bg-tertiary/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-secondary">{t.from.slice(0, 10)}</span>
                    <span className="text-text-muted">→</span>
                    <span className="font-mono text-text-secondary">{t.to.slice(0, 10)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{formatPrice(t.priceFrom)} → {formatPrice(t.priceTo)}</span>
                    <span className="font-mono font-bold text-bearish">{t.days}d</span>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm text-text-secondary">
                Promedio: <span className="font-mono font-bold text-text-primary">{cycleAnalysis.avgBottomToBottom} dias</span>
              </div>
            </div>
          </div>

          {/* Top to Bottom (Crash Duration) */}
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-signal" /> Dias de Techo a Suelo (Caida)
            </h3>
            <div className="space-y-3">
              {cycleAnalysis.topToBottom.map((t, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-bg-tertiary/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-secondary">{t.from.slice(0, 10)}</span>
                    <span className="text-text-muted">→</span>
                    <span className="font-mono text-text-secondary">{t.to.slice(0, 10)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-bearish font-mono">{formatPercent(t.drawdown)}</span>
                    <span className="font-mono font-bold text-neutral-signal">{t.days}d</span>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm text-text-secondary">
                Promedio: <span className="font-mono font-bold text-text-primary">{cycleAnalysis.avgTopToBottom} dias</span>
              </div>
            </div>
          </div>

          {/* Projections */}
          <div className="rounded-xl bg-gradient-to-br from-accent-btc/10 to-accent-purple/10 border border-accent-btc/30 p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-btc animate-pulse" /> Proyecciones (basadas en promedios historicos)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cycleAnalysis.projNextBottom && cycleAnalysis.lastPeak && (
                <div className="bg-bg-primary/60 rounded-lg p-4 border border-border">
                  <span className="text-xs text-text-muted block mb-1">Proximo Suelo (desde ultimo techo)</span>
                  <span className="font-mono text-lg font-bold text-bearish block">{cycleAnalysis.projNextBottom}</span>
                  <span className="text-xs text-text-secondary">
                    {cycleAnalysis.lastPeak.date.slice(0, 10)} + {cycleAnalysis.avgTopToBottom}d
                  </span>
                </div>
              )}
              {cycleAnalysis.projNextBottomFromBottom && cycleAnalysis.lastBottom && (
                <div className="bg-bg-primary/60 rounded-lg p-4 border border-border">
                  <span className="text-xs text-text-muted block mb-1">Proximo Suelo (desde ultimo suelo)</span>
                  <span className="font-mono text-lg font-bold text-bearish block">{cycleAnalysis.projNextBottomFromBottom}</span>
                  <span className="text-xs text-text-secondary">
                    {cycleAnalysis.lastBottom.date.slice(0, 10)} + {cycleAnalysis.avgBottomToBottom}d
                  </span>
                </div>
              )}
              {cycleAnalysis.projNextTop && cycleAnalysis.lastPeak && (
                <div className="bg-bg-primary/60 rounded-lg p-4 border border-border">
                  <span className="text-xs text-text-muted block mb-1">Proximo Techo (desde ultimo techo)</span>
                  <span className="font-mono text-lg font-bold text-bullish block">{cycleAnalysis.projNextTop}</span>
                  <span className="text-xs text-text-secondary">
                    {cycleAnalysis.lastPeak.date.slice(0, 10)} + {cycleAnalysis.avgTopToTop}d
                  </span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-3 italic">
              * Proyecciones basadas en promedios de ciclos anteriores. No es consejo financiero. Los rendimientos pasados no garantizan resultados futuros.
            </p>
          </div>
        </>
      )}

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
                  <span className={`text-xs px-1.5 py-0.5 rounded ${c.type?.includes('bull') ? 'bg-bullish/20 text-bullish' : c.type?.includes('bear') ? 'bg-bearish/20 text-bearish' : 'bg-accent-btc/20 text-accent-btc'}`}>
                    {c.type || '—'}
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
