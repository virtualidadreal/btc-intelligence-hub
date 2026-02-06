import { useState } from 'react'

interface ChartContainerProps {
  title: string
  children: React.ReactNode
  timeRanges?: string[]
  onTimeRangeChange?: (range: string) => void
}

const DEFAULT_RANGES = ['1M', '3M', '6M', '1Y', 'ALL']

export default function ChartContainer({
  title,
  children,
  timeRanges = DEFAULT_RANGES,
  onTimeRangeChange,
}: ChartContainerProps) {
  const [active, setActive] = useState('1Y')

  const handleChange = (range: string) => {
    setActive(range)
    onTimeRangeChange?.(range)
  }

  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-text-primary">{title}</h3>
        <div className="flex gap-1">
          {timeRanges.map((r) => (
            <button
              key={r}
              onClick={() => handleChange(r)}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                active === r
                  ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
