import { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Customized,
} from 'recharts'
import { formatPrice } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { Overlays } from './OverlayControls'
import type { BtcPrice, PriceLevel, FibonacciLevel, ConfluenceZone } from '../../lib/types'

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

/* ── Types ────────────────────────────────────────────────────── */
interface CandleRow {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  ema21: number | null
  sma50: number | null
  sma200: number | null
  bb_upper: number | null
  bb_mid: number | null
  bb_lower: number | null
  volumeSma20: number | null
  // hidden bars for Y domain
  _high: number
  _low: number
}

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
  confluenceZones?: ConfluenceZone[]
  overlays: Overlays
  range: string
  formatAxisDate: (iso: string) => string
  formatTooltipLabel: (label: string) => string
}

/* ── Candlestick renderer via Customized ─────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandlestickLayer(props: any) {
  const { formattedGraphicalItems, xAxisMap, yAxisMap } = props

  if (!xAxisMap || !yAxisMap) return null
  const xAxis = Object.values(xAxisMap)[0] as { scale: (v: string) => number; bandSize?: number } | undefined
  const yAxis = Object.values(yAxisMap)[0] as { scale: (v: number) => number } | undefined
  if (!xAxis?.scale || !yAxis?.scale) return null

  // Find the _high line to get the data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const highItem = formattedGraphicalItems?.find((i: any) => i?.item?.props?.dataKey === '_high')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const points = highItem?.props?.points as { payload: CandleRow }[] | undefined
  if (!points?.length) return null

  const yScale = yAxis.scale
  const bandwidth = xAxis.bandSize || 8
  const candleWidth = Math.max(Math.min(bandwidth * 0.7, 12), 2)

  return (
    <g className="candlestick-layer">
      {points.map((pt, i) => {
        const d = pt.payload
        if (!d || d.open == null || d.close == null) return null

        const xCenter = xAxis.scale(d.date) + bandwidth / 2
        const openY = yScale(d.open)
        const closeY = yScale(d.close)
        const highY = yScale(d.high)
        const lowY = yScale(d.low)

        if ([openY, closeY, highY, lowY].some((v) => v == null || isNaN(v))) return null

        const isUp = d.close >= d.open
        const fill = isUp ? '#22c55e' : '#ef4444'
        const bodyTop = Math.min(openY, closeY)
        const bodyHeight = Math.max(Math.abs(closeY - openY), 1)

        return (
          <g key={i}>
            <line x1={xCenter} y1={highY} x2={xCenter} y2={lowY} stroke={fill} strokeWidth={1} />
            <rect
              x={xCenter - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={fill}
            />
          </g>
        )
      })}
    </g>
  )
}

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
  formatAxisDate,
  formatTooltipLabel,
}: Props) {
  const { t } = useI18n()

  const chartData = useMemo(() => {
    if (!prices.length) return []
    const reversed = [...prices].reverse()
    // Volume SMA 20
    const volumes = reversed.map((p) => p.volume ?? 0)
    const volSma: (number | null)[] = volumes.map((_, i) => {
      if (i < 19) return null
      const slice = volumes.slice(i - 19, i + 1)
      return slice.reduce((a, b) => a + b, 0) / 20
    })

    return reversed.map((p, i) => ({
      date: p.date,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume ?? 0,
      ema21: ema21Map.get(p.date) ?? null,
      sma50: sma50Map.get(p.date) ?? null,
      sma200: sma200Map.get(p.date) ?? null,
      bb_upper: bbUpperMap.get(p.date) ?? null,
      bb_mid: bbMidMap.get(p.date) ?? null,
      bb_lower: bbLowerMap.get(p.date) ?? null,
      volumeSma20: volSma[i],
      _high: p.high,
      _low: p.low,
    }))
  }, [prices, ema21Map, sma50Map, sma200Map, bbUpperMap, bbMidMap, bbLowerMap])

  // Apply time range filter
  const RANGE_DAYS: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, ALL: 9999 }
  const data = useMemo(() => {
    const days = RANGE_DAYS[range] || 365
    if (days >= chartData.length) return chartData
    return chartData.slice(-days)
  }, [chartData, range])

  // Price domain
  const [domainMin, domainMax] = useMemo(() => {
    if (!data.length) return [0, 1]
    let min = Infinity
    let max = -Infinity
    for (const d of data) {
      if (d.low < min) min = d.low
      if (d.high > max) max = d.high
    }
    const pad = (max - min) * 0.03
    return [min - pad, max + pad]
  }, [data])

  // Filtered levels for overlay (strength >= 5)
  const srLevels = useMemo(() => {
    if (!overlays.sr) return []
    return levels
      .filter((l) => l.strength >= 5 && l.price >= domainMin && l.price <= domainMax)
      .slice(0, 20)
  }, [levels, overlays.sr, domainMin, domainMax])

  // Fibonacci data
  const fibData = useMemo(() => {
    if (!overlays.fib || !fibLevels.length) return null
    // Use the first (most relevant) fibonacci set
    const fib = fibLevels[0]
    if (!fib?.levels) return null
    const entries = Object.entries(fib.levels as Record<string, number>)
      .filter(([, price]) => typeof price === 'number' && price >= domainMin && price <= domainMax)
    return { entries, swingLow: fib.swing_low, swingHigh: fib.swing_high }
  }, [fibLevels, overlays.fib, domainMin, domainMax])

  // Golden Pocket from Fib
  const goldenPocket = useMemo(() => {
    if (!fibData) return null
    const levels = Object.fromEntries(fibData.entries) as Record<string, number>
    const fib618 = levels['0.618']
    const fib65 = levels['0.65']
    if (fib618 && fib65) return { y1: Math.min(fib618, fib65), y2: Math.max(fib618, fib65) }
    return null
  }, [fibData])

  // Volume max for Y axis
  const volMax = useMemo(() => {
    if (!data.length) return 1
    return Math.max(...data.map((d) => d.volume || 0)) * 1.2
  }, [data])

  if (!data.length) return null

  return (
    <div className="space-y-1">
      {/* Main chart */}
      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={formatAxisDate} />
            <YAxis
              yAxisId="price"
              domain={[domainMin, domainMax]}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              width={55}
            />
            {overlays.volume && (
              <YAxis yAxisId="volume" orientation="right" domain={[0, volMax]} hide />
            )}
            <Tooltip
              contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={formatTooltipLabel as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: any, name: any) => {
                if (v == null) return ['—', name]
                if (name === 'volume' || name === 'volumeSma20') return [(Number(v) / 1e9).toFixed(2) + 'B', name === 'volumeSma20' ? t('technical.volumeSma') : 'Vol']
                const labels: Record<string, string> = { _high: 'High', _low: 'Low', ema21: 'EMA 21', sma50: 'SMA 50', sma200: 'SMA 200', bb_upper: 'BB Upper', bb_mid: 'BB Mid', bb_lower: 'BB Lower' }
                return [formatPrice(Number(v)), labels[name] || name]
              }) as any}
            />

            {/* Hidden lines for Y-axis domain + tooltip data */}
            <Line yAxisId="price" type="monotone" dataKey="_high" stroke="transparent" dot={false} activeDot={false} />
            <Line yAxisId="price" type="monotone" dataKey="_low" stroke="transparent" dot={false} activeDot={false} />

            {/* Volume bars */}
            {overlays.volume && (
              <>
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  isAnimationActive={false}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  fill="#6b728040"
                  opacity={0.4}
                />
                <Line yAxisId="volume" type="monotone" dataKey="volumeSma20" stroke="#8b5cf6" strokeWidth={1} dot={false} connectNulls />
              </>
            )}

            {/* S/R Levels */}
            {srLevels.map((l) => (
              <ReferenceLine
                key={l.id}
                yAxisId="price"
                y={l.price}
                stroke={l.type === 'support' ? '#22c55e' : '#ef4444'}
                strokeWidth={l.strength >= 15 ? 2 : l.strength >= 10 ? 1.5 : 1}
                strokeOpacity={l.strength >= 15 ? 0.8 : l.strength >= 10 ? 0.6 : 0.3}
                strokeDasharray={l.strength >= 10 ? undefined : '5 5'}
                label={{
                  value: `${formatPrice(l.price)} (${l.strength}/20)`,
                  position: l.type === 'resistance' ? 'top' : 'bottom',
                  fill: l.type === 'support' ? '#22c55e' : '#ef4444',
                  fontSize: 9,
                }}
              />
            ))}

            {/* Fibonacci */}
            {fibData?.entries.map(([ratio, price]) => (
              <ReferenceLine
                key={ratio}
                yAxisId="price"
                y={price as number}
                stroke={FIB_COLORS[ratio] || '#787b86'}
                strokeWidth={ratio === '0.618' || ratio === '0.65' ? 2 : 1}
                strokeDasharray={ratio === '0.5' ? '5 5' : undefined}
                strokeOpacity={0.7}
                label={{
                  value: `${ratio} — ${formatPrice(price as number)}`,
                  position: 'right',
                  fill: FIB_COLORS[ratio] || '#787b86',
                  fontSize: 9,
                }}
              />
            ))}

            {/* Golden Pocket zone */}
            {goldenPocket && (
              <ReferenceArea
                yAxisId="price"
                y1={goldenPocket.y1}
                y2={goldenPocket.y2}
                fill="#f7931a"
                fillOpacity={0.12}
                label={{ value: t('technical.goldenPocket'), fill: '#f7931a', fontSize: 11 }}
              />
            )}

            {/* Bollinger Bands */}
            {overlays.bb && (
              <>
                <Line yAxisId="price" type="monotone" dataKey="bb_upper" stroke="#6b7280" strokeWidth={1} dot={false} strokeDasharray="4 2" connectNulls />
                <Line yAxisId="price" type="monotone" dataKey="bb_mid" stroke="#6b728080" strokeWidth={1} dot={false} strokeDasharray="2 2" connectNulls />
                <Line yAxisId="price" type="monotone" dataKey="bb_lower" stroke="#6b7280" strokeWidth={1} dot={false} strokeDasharray="4 2" connectNulls />
              </>
            )}

            {/* EMA / SMA overlays */}
            {overlays.emas && (
              <>
                <Line yAxisId="price" type="monotone" dataKey="ema21" stroke="#06b6d4" strokeWidth={1.5} dot={false} connectNulls />
                <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="#a855f7" strokeWidth={1.5} dot={false} connectNulls />
                <Line yAxisId="price" type="monotone" dataKey="sma200" stroke="#ef4444" strokeWidth={1.5} dot={false} connectNulls />
              </>
            )}

            {/* Candlestick rendering */}
            <Customized component={CandlestickLayer} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-text-muted px-1">
        <span className="flex items-center gap-1"><span className="w-2 h-3 bg-bullish inline-block rounded-sm" /><span className="w-2 h-3 bg-bearish inline-block rounded-sm" /> Velas</span>
        {overlays.emas && (
          <>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#06b6d4] inline-block" /> EMA 21</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#a855f7] inline-block" /> SMA 50</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#ef4444] inline-block" /> SMA 200</span>
          </>
        )}
        {overlays.sr && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#22c55e] inline-block" />/<span className="w-3 h-0.5 bg-[#ef4444] inline-block" /> S/R</span>}
        {overlays.fib && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f7931a] inline-block" /> Fib</span>}
        {overlays.volume && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#8b5cf6] inline-block" /> {t('technical.volumeSma')}</span>}
      </div>
    </div>
  )
}
