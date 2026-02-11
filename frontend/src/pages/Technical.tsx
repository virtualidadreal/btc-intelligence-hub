import { useMemo, useState, useCallback } from 'react'
import { SignalBadge } from '../components/common/MetricCard'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import ChartContainer from '../components/common/ChartContainer'
import CandlestickChart from '../components/technical/CandlestickChart'
import RsiChart from '../components/technical/RsiChart'
import MacdChart from '../components/technical/MacdChart'
import SRLevelsSection from '../components/technical/SRLevelsSection'
import ReturnHeatmap from '../components/technical/ReturnHeatmap'
import TechnicalInterpretation from '../components/technical/TechnicalInterpretation'
import OverlayControls, { useOverlays } from '../components/technical/OverlayControls'
import { useIndicatorHistory, useLatestSignals } from '../hooks/useTechnical'
import { usePriceHistory } from '../hooks/usePrices'
import { usePriceLevels, useFibonacciLevels, useConfluenceZones } from '../hooks/useLevels'
import { useBinanceKlines } from '../hooks/useBinanceKlines'
import { useKlineIndicators } from '../hooks/useKlineIndicators'
import { useI18n } from '../lib/i18n'

/* ── Helpers ──────────────────────────────────────────────────── */
const RANGE_DAYS: Record<string, number> = { '1D': 1, '3D': 3, '1W': 7, '2W': 14, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, ALL: 9999 }

const TF_RANGES: Record<string, { ranges: string[]; default: string }> = {
  '1H': { ranges: ['1D', '3D', '1W', '2W'], default: '1W' },
  '4H': { ranges: ['1W', '2W', '1M', '3M'], default: '1M' },
  '1D': { ranges: ['1M', '3M', '6M', '1Y', 'ALL'], default: '1Y' },
  '1W': { ranges: ['6M', '1Y', '2Y', 'ALL'], default: '1Y' },
}

const TIMEFRAMES = ['1H', '4H', '1D', '1W'] as const

function sliceByRange<T>(data: T[], range: string): T[] {
  const days = RANGE_DAYS[range] || 365
  if (days >= data.length) return data
  return data.slice(-days)
}

function sliceByRangeHours<T>(data: T[], range: string, hoursPerCandle: number): T[] {
  const days = RANGE_DAYS[range] || 365
  const maxCandles = Math.ceil((days * 24) / hoursPerCandle)
  if (maxCandles >= data.length) return data
  return data.slice(-maxCandles)
}

function TfSelector({ active, onChange }: { active: string; onChange: (tf: string) => void }) {
  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
            active === tf
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

function fmtDate(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/* ── Main page ────────────────────────────────────────────────── */
export default function Technical() {
  const { t, ta } = useI18n()
  const [tf, setTf] = useState('1D')
  const [range, setRange] = useState('1Y')
  const { overlays, toggle } = useOverlays()

  /* ── Binance klines (only for non-1D timeframes) ──────────── */
  const { data: klines, loading: klinesLoading } = useBinanceKlines(tf === '1D' ? '' : tf)
  const { rsi: klineRsi, macd: klineMacd } = useKlineIndicators(tf === '1D' ? null : klines)

  /* ── Data hooks ─────────────────────────────────────────────── */
  const { data: rsiData, loading } = useIndicatorHistory('RSI_14', 3000)
  const { data: macdData } = useIndicatorHistory('MACD', 3000)
  const { data: macdSignalData } = useIndicatorHistory('MACD_SIGNAL', 3000)
  const { data: macdHistData } = useIndicatorHistory('MACD_HIST', 3000)
  const { data: signals } = useLatestSignals()
  const { data: prices } = usePriceHistory(3000)
  const { data: ema21Data } = useIndicatorHistory('EMA_21', 3000)
  const { data: sma50Data } = useIndicatorHistory('SMA_50', 3000)
  const { data: sma200Data } = useIndicatorHistory('SMA_200', 3000)
  const { data: bbUpperData } = useIndicatorHistory('BB_UPPER', 3000)
  const { data: bbMidData } = useIndicatorHistory('BB_MID', 3000)
  const { data: bbLowerData } = useIndicatorHistory('BB_LOWER', 3000)
  const { data: levels } = usePriceLevels(0)
  const { data: fibLevels } = useFibonacciLevels()
  const { data: confluenceZones } = useConfluenceZones()

  const handleRange = useCallback((r: string) => setRange(r), [])
  const handleTf = useCallback((newTf: string) => {
    setTf(newTf)
    setRange(TF_RANGES[newTf]?.default || '1Y')
  }, [])

  /* ── Format helpers ─────────────────────────────────────────── */
  const formatAxisDate = useCallback((iso: string) => {
    if (!iso) return ''
    // ISO datetime from Binance (contains T)
    if (iso.includes('T')) {
      const d = new Date(iso)
      if (tf === '1H' || tf === '4H') {
        return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      return `${d.getDate()}/${d.getMonth() + 1}`
    }
    // Daily date from Supabase (YYYY-MM-DD)
    if (!iso.includes('-')) return iso
    const [y, m, d] = iso.split('-')
    if (range === '1M' || range === '3M') return `${d}/${m}`
    return `${m}/${y.slice(2)}`
  }, [range, tf])

  const formatTooltipLabel = useCallback((label: unknown) => {
    if (!label) return ''
    const s = String(label)
    if (s.includes('T')) {
      const d = new Date(s)
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return fmtDate(s)
  }, [])

  /* ── Indicator maps ─────────────────────────────────────────── */
  const ema21Map = useMemo(() => new Map(ema21Data?.map((d) => [d.date, d.value]) || []), [ema21Data])
  const sma50Map = useMemo(() => new Map(sma50Data?.map((d) => [d.date, d.value]) || []), [sma50Data])
  const sma200Map = useMemo(() => new Map(sma200Data?.map((d) => [d.date, d.value]) || []), [sma200Data])
  const bbUpperMap = useMemo(() => new Map(bbUpperData?.map((d) => [d.date, d.value]) || []), [bbUpperData])
  const bbMidMap = useMemo(() => new Map(bbMidData?.map((d) => [d.date, d.value]) || []), [bbMidData])
  const bbLowerMap = useMemo(() => new Map(bbLowerData?.map((d) => [d.date, d.value]) || []), [bbLowerData])

  /* ── RSI data ───────────────────────────────────────────────── */
  const fullRsi = useMemo(() => {
    if (!rsiData) return []
    return [...rsiData].reverse().map((d) => ({ date: d.date, value: d.value, signal: d.signal }))
  }, [rsiData])

  /* ── MACD data + crossovers ─────────────────────────────────── */
  const fullMacd = useMemo(() => {
    if (!macdData) return []
    const signalMap = new Map(macdSignalData?.map((d) => [d.date, d.value]) || [])
    const histMap = new Map(macdHistData?.map((d) => [d.date, d.value]) || [])
    return [...macdData].reverse().map((d) => ({
      date: d.date,
      macd: d.value,
      signal_line: signalMap.get(d.date) ?? null,
      histogram: histMap.get(d.date) ?? null,
    }))
  }, [macdData, macdSignalData, macdHistData])

  /* ── Choose data source: Supabase (1D) vs Binance klines ──── */
  const hoursPerCandle: Record<string, number> = { '1H': 1, '4H': 4, '1D': 24, '1W': 168 }

  const rsiChart = useMemo(() => {
    if (tf === '1D') return sliceByRange(fullRsi, range)
    return sliceByRangeHours(klineRsi, range, hoursPerCandle[tf] || 24)
  }, [tf, fullRsi, klineRsi, range])

  const macdChart = useMemo(() => {
    if (tf === '1D') return sliceByRange(fullMacd, range)
    return sliceByRangeHours(klineMacd, range, hoursPerCandle[tf] || 24)
  }, [tf, fullMacd, klineMacd, range])

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

  /* ── Price data for range-filtered charts ───────────────────── */
  const filteredPrices = useMemo(() => {
    if (!prices) return []
    const days = RANGE_DAYS[range] || 365
    const reversed = [...prices].reverse()
    return days >= reversed.length ? reversed : reversed.slice(-days)
  }, [prices, range])

  /* ── Current price ──────────────────────────────────────────── */
  const currentPrice = useMemo(() => {
    if (!prices?.length) return 0
    return prices[0].close
  }, [prices])

  /* ── Interpretation data ────────────────────────────────────── */
  const rsiLatest = useMemo(() => (rsiChart.length ? rsiChart[rsiChart.length - 1] : null), [rsiChart])
  const macdLatest = useMemo(() => (macdChart.length ? macdChart[macdChart.length - 1] : null), [macdChart])
  const lastCross = useMemo(() => (crosses.length ? crosses[crosses.length - 1] : null), [crosses])
  const priceLatest = useMemo(() => {
    if (!filteredPrices.length) return null
    const p = filteredPrices[filteredPrices.length - 1]
    return {
      price: p.close,
      ema21: ema21Map.get(p.date) ?? null,
      sma50: sma50Map.get(p.date) ?? null,
      sma200: sma200Map.get(p.date) ?? null,
    }
  }, [filteredPrices, ema21Map, sma50Map, sma200Map])
  const smaSignal = useMemo(() => signals?.find((s) => s.indicator === 'SMA_CROSS')?.signal ?? null, [signals])

  /* ── Loading / Empty states ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={t('technical.title')} />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!rsiData?.length) {
    return (
      <div className="p-6">
        <PageHeader title={t('technical.title')} />
        <EmptyState command="btc-intel analyze technical" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('technical.title')} subtitle={t('technical.subtitle')}>
        <HelpButton title={t('technical.helpTitle')} content={ta('technical')} />
      </PageHeader>

      {/* ── Signal chips ──────────────────────────────────────── */}
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

      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-3 backdrop-blur-sm">
        <OverlayControls overlays={overlays} onToggle={toggle} />
      </div>

      {/* ── Candlestick Chart ─────────────────────────────────── */}
      <ChartContainer title={t('technical.candlestick')} activeRange={range} onTimeRangeChange={handleRange}>
        <CandlestickChart
          prices={prices ? [...prices] : []}
          ema21Map={ema21Map}
          sma50Map={sma50Map}
          sma200Map={sma200Map}
          bbUpperMap={bbUpperMap}
          bbMidMap={bbMidMap}
          bbLowerMap={bbLowerMap}
          levels={levels || []}
          fibLevels={fibLevels || []}
          overlays={overlays}
          range={range}
        />
      </ChartContainer>

      {/* ── RSI Chart ─────────────────────────────────────────── */}
      <ChartContainer
        title={t('technical.rsi')}
        activeRange={range}
        onTimeRangeChange={handleRange}
        timeRanges={TF_RANGES[tf].ranges}
        extraControls={<TfSelector active={tf} onChange={handleTf} />}
      >
        {tf !== '1D' && klinesLoading ? (
          <div className="h-40 flex items-center justify-center text-text-muted text-sm">Loading {tf} data...</div>
        ) : (
          <RsiChart
            data={rsiChart}
            formatAxisDate={formatAxisDate}
            formatTooltipLabel={formatTooltipLabel}
          />
        )}
      </ChartContainer>

      {/* ── MACD Chart ────────────────────────────────────────── */}
      <ChartContainer
        title={t('technical.macd')}
        activeRange={range}
        onTimeRangeChange={handleRange}
        timeRanges={TF_RANGES[tf].ranges}
        extraControls={<TfSelector active={tf} onChange={handleTf} />}
      >
        {tf !== '1D' && klinesLoading ? (
          <div className="h-44 flex items-center justify-center text-text-muted text-sm">Loading {tf} data...</div>
        ) : (
          <MacdChart
            data={macdChart}
            crosses={crosses}
            formatAxisDate={formatAxisDate}
            formatTooltipLabel={formatTooltipLabel}
          />
        )}
      </ChartContainer>

      {/* ── S/R Levels + Fibonacci + Confluence ─────────────── */}
      <SRLevelsSection
        levels={levels || []}
        fibLevels={fibLevels || []}
        confluenceZones={confluenceZones || []}
        currentPrice={currentPrice}
      />

      {/* ── Return Heatmap ────────────────────────────────────── */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-3">{t('technical.returnHeatmap')}</h3>
        <ReturnHeatmap prices={prices || []} />
      </div>

      {/* ── Extended Interpretation ────────────────────────────── */}
      <TechnicalInterpretation
        rsiLatest={rsiLatest}
        macdLatest={macdLatest}
        lastCross={lastCross}
        priceLatest={priceLatest}
        levels={levels || []}
        fibLevels={fibLevels || []}
        confluenceZones={confluenceZones || []}
        prices={prices || []}
        smaSignal={smaSignal}
      />
    </div>
  )
}
