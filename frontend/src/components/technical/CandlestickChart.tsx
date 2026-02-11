import { useRef, useEffect, useMemo } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  LineStyle,
} from 'lightweight-charts'
import type { IChartApi, Time, CandlestickData } from 'lightweight-charts'
import { formatPrice } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { Overlays } from './OverlayControls'
import type { BtcPrice, PriceLevel, FibonacciLevel } from '../../lib/types'

/* ── Fibonacci colors (TradingView-like) ─────────────────────── */
const FIB_COLORS: Record<string, string> = {
  '0.236': '#787b86',
  '0.382': '#089981',
  '0.5': '#2962ff',
  '0.618': '#f7931a',
  '0.65': '#f7931a',
  '0.786': '#e91e63',
  '1.0': '#787b86',
  '1.272': '#089981',
  '1.618': '#f7931a',
}

/* ── Props ────────────────────────────────────────────────────── */
interface Props {
  prices: BtcPrice[]
  ema21Map: Map<string, number>
  sma50Map: Map<string, number>
  sma200Map: Map<string, number>
  bbUpperMap: Map<string, number>
  bbMidMap: Map<string, number>
  bbLowerMap: Map<string, number>
  levels: PriceLevel[]
  fibLevels: FibonacciLevel[]
  overlays: Overlays
  range: string
}

const RANGE_DAYS: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, ALL: 9999 }

/* ── Main component ──────────────────────────────────────────── */
export default function CandlestickChart({
  prices,
  ema21Map,
  sma50Map,
  sma200Map,
  bbUpperMap,
  bbMidMap,
  bbLowerMap,
  levels,
  fibLevels,
  overlays,
  range,
}: Props) {
  const { t } = useI18n()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  /* ── Prepare candle data (oldest → newest) ───────────────── */
  const candleData = useMemo(() => {
    if (!prices.length) return []
    const days = RANGE_DAYS[range] || 365
    const reversed = [...prices].reverse()
    const sliced = days >= reversed.length ? reversed : reversed.slice(-days)
    return sliced.map((p) => ({
      time: p.date as Time,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    })) as CandlestickData<Time>[]
  }, [prices, range])

  /* ── Helper: build line data from map ────────────────────── */
  const buildLineData = (map: Map<string, number>) =>
    candleData
      .filter((d) => map.has(d.time as string))
      .map((d) => ({ time: d.time, value: map.get(d.time as string)! }))

  /* ── Chart lifecycle ─────────────────────────────────────── */
  useEffect(() => {
    if (!chartContainerRef.current || !candleData.length) return

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const container = chartContainerRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#2a2a3e' },
        horzLines: { color: '#2a2a3e' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: {
        borderColor: '#2a2a3e',
      },
      timeScale: {
        borderColor: '#2a2a3e',
        timeVisible: false,
      },
    })

    /* ── Candlestick series ─────────────────────────────── */
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeries.setData(candleData)

    /* ── EMA / SMA overlays ─────────────────────────────── */
    if (overlays.emas) {
      const ema21Data = buildLineData(ema21Map)
      if (ema21Data.length) {
        const s = chart.addSeries(LineSeries, {
          color: '#06b6d4',
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        s.setData(ema21Data)
      }

      const sma50Data = buildLineData(sma50Map)
      if (sma50Data.length) {
        const s = chart.addSeries(LineSeries, {
          color: '#a855f7',
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        s.setData(sma50Data)
      }

      const sma200Data = buildLineData(sma200Map)
      if (sma200Data.length) {
        const s = chart.addSeries(LineSeries, {
          color: '#ef4444',
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        s.setData(sma200Data)
      }
    }

    /* ── Bollinger Bands ────────────────────────────────── */
    if (overlays.bb) {
      const upperData = buildLineData(bbUpperMap)
      const midData = buildLineData(bbMidMap)
      const lowerData = buildLineData(bbLowerMap)

      if (upperData.length) {
        const s = chart.addSeries(LineSeries, {
          color: '#6b7280',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        s.setData(upperData)
      }
      if (midData.length) {
        const s = chart.addSeries(LineSeries, {
          color: '#6b728080',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        s.setData(midData)
      }
      if (lowerData.length) {
        const s = chart.addSeries(LineSeries, {
          color: '#6b7280',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        s.setData(lowerData)
      }
    }

    /* ── S/R Levels as price lines ──────────────────────── */
    if (overlays.sr && levels.length) {
      const low = Math.min(...candleData.map((d) => d.low))
      const high = Math.max(...candleData.map((d) => d.high))
      const range = high - low
      const srLevels = levels
        .filter((l) => l.strength >= 1 && l.price >= low - range * 0.3 && l.price <= high + range * 0.3)
        .slice(0, 25)

      for (const l of srLevels) {
        candleSeries.createPriceLine({
          price: l.price,
          color: l.type === 'support' ? '#22c55e' : '#ef4444',
          lineWidth: l.strength >= 15 ? 2 : 1,
          lineStyle: l.strength >= 10 ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${formatPrice(l.price)} (${l.strength}/20)`,
        })
      }
    }

    /* ── Fibonacci levels as price lines ─────────────────── */
    if (overlays.fib && fibLevels.length) {
      const fib = fibLevels[0]
      if (fib?.levels) {
        const entries = Object.entries(fib.levels as Record<string, number>)
        for (const [ratio, price] of entries) {
          if (typeof price !== 'number') continue
          candleSeries.createPriceLine({
            price,
            color: FIB_COLORS[ratio] || '#787b86',
            lineWidth: ratio === '0.618' || ratio === '0.65' ? 2 : 1,
            lineStyle: ratio === '0.5' ? LineStyle.Dashed : LineStyle.Solid,
            axisLabelVisible: true,
            title: `Fib ${ratio}`,
          })
        }
      }
    }

    /* ── Volume histogram ───────────────────────────────── */
    if (overlays.volume) {
      const reversed = [...prices].reverse()
      const days = RANGE_DAYS[range] || 365
      const sliced = days >= reversed.length ? reversed : reversed.slice(-days)
      const volumeData = sliced.map((p) => ({
        time: p.date as Time,
        value: p.volume ?? 0,
        color: p.close >= p.open ? '#22c55e40' : '#ef444440',
      }))

      const volSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volume',
        lastValueVisible: false,
        priceLineVisible: false,
      })
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volSeries.setData(volumeData)
    }

    /* ── Fit content ────────────────────────────────────── */
    chart.timeScale().fitContent()

    /* ── Resize observer ────────────────────────────────── */
    const resizeObserver = new ResizeObserver(() => {
      if (container) {
        chart.applyOptions({ width: container.clientWidth })
      }
    })
    resizeObserver.observe(container)

    chartRef.current = chart

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candleData, overlays, levels, fibLevels, ema21Map, sma50Map, sma200Map, bbUpperMap, bbMidMap, bbLowerMap])

  if (!prices.length) return null

  return (
    <div>
      <div ref={chartContainerRef} className="h-[500px]" />
      <div className="flex flex-wrap gap-4 text-xs text-text-muted px-1 mt-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-3 bg-bullish inline-block rounded-sm" />
          <span className="w-2 h-3 bg-bearish inline-block rounded-sm" /> {t('technical.candles') || 'Velas'}
        </span>
        {overlays.emas && (
          <>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#06b6d4] inline-block" /> EMA 21</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#a855f7] inline-block" /> SMA 50</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#ef4444] inline-block" /> SMA 200</span>
          </>
        )}
        {overlays.bb && (
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#6b7280] inline-block" /> BB</span>
        )}
        {overlays.sr && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#22c55e] inline-block" />/
            <span className="w-3 h-0.5 bg-[#ef4444] inline-block" /> S/R
          </span>
        )}
        {overlays.fib && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f7931a] inline-block" /> Fib</span>}
        {overlays.volume && <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#6b728060] inline-block" /> Vol</span>}
      </div>
    </div>
  )
}
