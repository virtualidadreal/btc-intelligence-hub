import { useMemo } from 'react'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import EmptyState from '../components/common/EmptyState'
import MetricCard from '../components/common/MetricCard'
import { useCycles } from '../hooks/useCycles'
import { formatPercent, formatPrice, formatDateShort } from '../lib/utils'
import { useI18n } from '../lib/i18n'

const HALVINGS = [
  { date: '2012-11-28', labelKey: 'cycles.1st' },
  { date: '2016-07-09', labelKey: 'cycles.2nd' },
  { date: '2020-05-11', labelKey: 'cycles.3rd' },
  { date: '2024-04-20', labelKey: 'cycles.4th' },
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
  const { t, ta } = useI18n()
  const { data: cycles, loading } = useCycles()

  const halvingCycles = useMemo(() => cycles?.filter((c) => c.type?.includes('halving')) || [], [cycles])
  const bullCycles = useMemo(() => cycles?.filter((c) => c.type?.includes('bull')) || [], [cycles])
  const bearCycles = useMemo(() => cycles?.filter((c) => c.type?.includes('bear')) || [], [cycles])

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

  if (loading) return <div className="p-6"><PageHeader title={t('cycles.title')} /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!cycles?.length) return <div className="p-6"><PageHeader title={t('cycles.title')} /><EmptyState command="btc-intel seed-all" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('cycles.title')} subtitle={t('cycles.subtitle')}>
        <HelpButton
          title={t('cycles.helpTitle')}
          content={ta('cycles')}
        />
      </PageHeader>

      {/* Halving Timeline */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-6 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-4">{t('cycles.halvingTimeline')}</h3>
        <div className="relative flex items-center justify-between">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border" />
          {HALVINGS.map((h, i) => (
            <div key={h.date} className="relative flex flex-col items-center z-10">
              <div className={`w-4 h-4 rounded-full ${i === HALVINGS.length - 1 ? 'bg-accent-btc animate-pulse' : 'bg-accent-purple'}`} />
              <span className="text-xs font-mono text-text-secondary mt-2">{h.date.slice(0, 7)}</span>
              <span className="text-[10px] text-text-muted">{t(h.labelKey)}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-text-secondary mt-4 font-mono">
          <span className="text-accent-btc font-bold">{daysSinceHalving}</span> {t('cycles.daySinceHalving')}
        </p>
      </div>

      {/* Current Cycle Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={t('cycles.currentCycle')} value="#4" subtitle="2024-04-20" />
        <MetricCard title={t('cycles.daysSinceHalving')} value={`${daysSinceHalving}`} />
        <MetricCard title={t('cycles.halvingCycles')} value={`${halvingCycles.length}`} />
        <MetricCard title={t('cycles.bullBear')} value={`${bullCycles.length}/${bearCycles.length}`} />
      </div>

      {/* Cycle Intervals & Projections */}
      {cycleAnalysis && (
        <>
          {/* Top to Top */}
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-bullish" /> {t('cycles.daysBetweenPeaks')}
            </h3>
            <div className="space-y-3">
              {cycleAnalysis.topToTop.map((interval, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-bg-tertiary/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-secondary">{formatDateShort(interval.from)}</span>
                    <span className="text-text-muted">→</span>
                    <span className="font-mono text-text-secondary">{formatDateShort(interval.to)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{formatPrice(interval.priceFrom)} → {formatPrice(interval.priceTo)}</span>
                    <span className="font-mono font-bold text-bullish">{interval.days}d</span>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm text-text-secondary">
                {t('cycles.average')} <span className="font-mono font-bold text-text-primary">{cycleAnalysis.avgTopToTop} {t('common.days')}</span>
              </div>
            </div>
          </div>

          {/* Bottom to Bottom */}
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-bearish" /> {t('cycles.daysBetweenBottoms')}
            </h3>
            <div className="space-y-3">
              {cycleAnalysis.bottomToBottom.map((interval, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-bg-tertiary/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-secondary">{formatDateShort(interval.from)}</span>
                    <span className="text-text-muted">→</span>
                    <span className="font-mono text-text-secondary">{formatDateShort(interval.to)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{formatPrice(interval.priceFrom)} → {formatPrice(interval.priceTo)}</span>
                    <span className="font-mono font-bold text-bearish">{interval.days}d</span>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm text-text-secondary">
                {t('cycles.average')} <span className="font-mono font-bold text-text-primary">{cycleAnalysis.avgBottomToBottom} {t('common.days')}</span>
              </div>
            </div>
          </div>

          {/* Top to Bottom (Crash Duration) */}
          <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-signal" /> {t('cycles.daysPeakToBottom')}
            </h3>
            <div className="space-y-3">
              {cycleAnalysis.topToBottom.map((interval, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-bg-tertiary/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-secondary">{formatDateShort(interval.from)}</span>
                    <span className="text-text-muted">→</span>
                    <span className="font-mono text-text-secondary">{formatDateShort(interval.to)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-bearish font-mono">{formatPercent(interval.drawdown)}</span>
                    <span className="font-mono font-bold text-neutral-signal">{interval.days}d</span>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm text-text-secondary">
                {t('cycles.average')} <span className="font-mono font-bold text-text-primary">{cycleAnalysis.avgTopToBottom} {t('common.days')}</span>
              </div>
            </div>
          </div>

          {/* Projections */}
          <div className="rounded-xl bg-gradient-to-br from-accent-btc/10 to-accent-purple/10 border border-accent-btc/30 p-4 md:p-6 backdrop-blur-sm">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-btc animate-pulse" /> {t('cycles.projections')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cycleAnalysis.projNextBottom && cycleAnalysis.lastPeak && (
                <div className="bg-bg-primary/60 rounded-lg p-4 border border-border">
                  <span className="text-xs text-text-muted block mb-1">{t('cycles.nextBottomFromPeak')}</span>
                  <span className="font-mono text-lg font-bold text-bearish block">{formatDateShort(cycleAnalysis.projNextBottom)}</span>
                  <span className="text-xs text-text-secondary">
                    {formatDateShort(cycleAnalysis.lastPeak.date)} + {cycleAnalysis.avgTopToBottom}d
                  </span>
                </div>
              )}
              {cycleAnalysis.projNextBottomFromBottom && cycleAnalysis.lastBottom && (
                <div className="bg-bg-primary/60 rounded-lg p-4 border border-border">
                  <span className="text-xs text-text-muted block mb-1">{t('cycles.nextBottomFromBottom')}</span>
                  <span className="font-mono text-lg font-bold text-bearish block">{formatDateShort(cycleAnalysis.projNextBottomFromBottom)}</span>
                  <span className="text-xs text-text-secondary">
                    {formatDateShort(cycleAnalysis.lastBottom.date)} + {cycleAnalysis.avgBottomToBottom}d
                  </span>
                </div>
              )}
              {cycleAnalysis.projNextTop && cycleAnalysis.lastPeak && (
                <div className="bg-bg-primary/60 rounded-lg p-4 border border-border">
                  <span className="text-xs text-text-muted block mb-1">{t('cycles.nextPeakFromPeak')}</span>
                  <span className="font-mono text-lg font-bold text-bullish block">{formatDateShort(cycleAnalysis.projNextTop)}</span>
                  <span className="text-xs text-text-secondary">
                    {formatDateShort(cycleAnalysis.lastPeak.date)} + {cycleAnalysis.avgTopToTop}d
                  </span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-3 italic">
              {t('cycles.projNote')}
            </p>
          </div>
        </>
      )}

      {/* Cycles Table */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm overflow-x-auto">
        <h3 className="font-display font-semibold mb-3">{t('cycles.allCycles')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border">
              <th className="text-left py-2 pr-4">{t('cycles.name')}</th>
              <th className="text-left py-2 pr-4">{t('cycles.type')}</th>
              <th className="text-right py-2 pr-4">{t('cycles.start')}</th>
              <th className="text-right py-2 pr-4">{t('cycles.end')}</th>
              <th className="text-right py-2 pr-4">{t('cycles.duration')}</th>
              <th className="text-right py-2 pr-4">{t('cycles.roi')}</th>
              <th className="text-right py-2">{t('cycles.maxDD')}</th>
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
                <td className="py-2 pr-4 text-right font-mono text-text-secondary">{c.start_date ? formatDateShort(c.start_date) : '—'}</td>
                <td className="py-2 pr-4 text-right font-mono text-text-secondary">{c.end_date ? formatDateShort(c.end_date) : t('common.ongoing')}</td>
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
