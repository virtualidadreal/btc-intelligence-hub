import { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts'
import { useI18n } from '../../lib/i18n'

interface MacdPoint {
  date: string
  macd: number
  signal_line: number | null
  histogram: number | null
}

interface Cross {
  date: string
  macd: number
  type: 'bullish' | 'bearish'
}

interface Props {
  data: MacdPoint[]
  crosses: Cross[]
  formatAxisDate: (iso: string) => string
  formatTooltipLabel: (label: string) => string
}

export default function MacdChart({ data, crosses, formatAxisDate, formatTooltipLabel }: Props) {
  const { t } = useI18n()

  // Compute bar colors (direction-aware histogram)
  const barColors = useMemo(() => {
    return data.map((d, i) => {
      const h = d.histogram ?? 0
      const prevH = i > 0 ? (data[i - 1].histogram ?? 0) : 0
      const isPositive = h >= 0
      const isGrowing = Math.abs(h) > Math.abs(prevH)
      if (isPositive) return isGrowing ? '#22c55e' : '#22c55e80'
      return isGrowing ? '#ef4444' : '#ef444480'
    })
  }, [data])

  if (!data.length) return null

  return (
    <div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={formatAxisDate} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={45} />
            <Tooltip
              contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={formatTooltipLabel as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: any, name: any) => [v != null ? Number(v).toFixed(2) : '—', name === 'macd' ? 'MACD' : name === 'signal_line' ? 'Signal' : 'Histogram']) as any}
            />
            <ReferenceLine y={0} stroke="#4b5563" />

            {/* Colored histogram */}
            <Bar dataKey="histogram" isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={barColors[i]} />
              ))}
            </Bar>

            {/* MACD & Signal lines */}
            <Line type="monotone" dataKey="macd" stroke="#f7931a" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="signal_line" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />

            {/* Crossover markers */}
            {crosses.map((c, i) => (
              <ReferenceDot
                key={i}
                x={c.date}
                y={c.macd}
                r={5}
                fill={c.type === 'bullish' ? '#22c55e' : '#ef4444'}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-1 text-xs text-text-muted px-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f7931a] inline-block" /> MACD</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#3b82f6] inline-block" /> Signal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bullish inline-block" /> {t('technical.bullishCross')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bearish inline-block" /> {t('technical.bearishCross')}</span>
      </div>
    </div>
  )
}
