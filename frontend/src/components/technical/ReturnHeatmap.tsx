import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import type { BtcPrice } from '../../lib/types'

interface Props {
  prices: BtcPrice[]
}

interface HeatmapCell {
  year: number
  month: number
  returnPct: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ReturnHeatmap({ prices }: Props) {
  const { t } = useI18n()

  const { cells, years, monthAvgs } = useMemo(() => {
    if (!prices.length) return { cells: [], years: [], monthAvgs: new Map<number, number>() }

    // Group by year-month, get first and last price of each month
    const monthly = new Map<string, { first: number; last: number }>()
    const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date))

    for (const p of sorted) {
      const [y, m] = p.date.split('-')
      const key = `${y}-${m}`
      const existing = monthly.get(key)
      if (!existing) {
        monthly.set(key, { first: p.open || p.close, last: p.close })
      } else {
        existing.last = p.close
      }
    }

    const result: HeatmapCell[] = []
    for (const [key, val] of monthly) {
      const [y, m] = key.split('-')
      const ret = val.first > 0 ? ((val.last - val.first) / val.first) * 100 : 0
      result.push({ year: parseInt(y), month: parseInt(m), returnPct: ret })
    }

    // Unique years sorted
    const uniqueYears = [...new Set(result.map((c) => c.year))].sort()

    // Monthly averages
    const monthSums = new Map<number, { sum: number; count: number }>()
    for (const c of result) {
      const existing = monthSums.get(c.month)
      if (existing) {
        existing.sum += c.returnPct
        existing.count++
      } else {
        monthSums.set(c.month, { sum: c.returnPct, count: 1 })
      }
    }
    const avgs = new Map<number, number>()
    for (const [m, { sum, count }] of monthSums) {
      avgs.set(m, sum / count)
    }

    return { cells: result, years: uniqueYears, monthAvgs: avgs }
  }, [prices])

  if (!cells.length) return <p className="text-sm text-text-muted">{t('technical.heatmap.noData')}</p>

  const getCellForYearMonth = (year: number, month: number) =>
    cells.find((c) => c.year === year && c.month === month)

  return (
    <div className="overflow-x-auto">
      <table className="text-xs font-mono w-full">
        <thead>
          <tr>
            <th className="text-left text-text-muted py-1 pr-2">{t('technical.heatmap.year')}</th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="text-center text-text-muted py-1 px-0.5 w-12">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="text-text-secondary py-0.5 pr-2">{year}</td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const cell = getCellForYearMonth(year, month)
                if (!cell) return <td key={month} className="text-center py-0.5 px-0.5"><span className="block w-full h-6 rounded bg-bg-tertiary/30" /></td>
                return (
                  <td key={month} className="text-center py-0.5 px-0.5">
                    <CellBlock value={cell.returnPct} />
                  </td>
                )
              })}
            </tr>
          ))}
          {/* Average row */}
          <tr className="border-t border-border">
            <td className="text-text-muted py-1 pr-2 font-bold">{t('technical.heatmap.avg')}</td>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const avg = monthAvgs.get(month)
              if (avg == null) return <td key={month} />
              return (
                <td key={month} className="text-center py-1 px-0.5">
                  <CellBlock value={avg} isBold />
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CellBlock({ value, isBold }: { value: number; isBold?: boolean }) {
  const intensity = Math.min(Math.abs(value) / 30, 1)
  const baseRgb = value >= 0 ? '34, 197, 94' : '239, 68, 68'
  const bgAlpha = 0.15 + intensity * 0.55
  const textColor = intensity > 0.25 ? '#fff' : '#9ca3af'

  return (
    <div
      className={`w-full h-6 rounded flex items-center justify-center text-[10px] ${isBold ? 'font-bold' : ''}`}
      style={{
        backgroundColor: `rgba(${baseRgb}, ${bgAlpha})`,
        color: textColor,
      }}
      title={`${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
    >
      {value > 0 ? '+' : ''}{value.toFixed(0)}%
    </div>
  )
}
