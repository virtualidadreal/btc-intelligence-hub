import { useMemo, useState } from 'react'
import { formatPrice, cn } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { PriceLevel, FibonacciLevel, ConfluenceZone } from '../../lib/types'

interface Props {
  levels: PriceLevel[]
  fibLevels: FibonacciLevel[]
  confluenceZones: ConfluenceZone[]
  currentPrice: number
}

/* ── Helpers ─────────────────────────────────────────────── */

function strengthColor(s: number): string {
  if (s >= 15) return 'text-red-400'
  if (s >= 10) return 'text-orange-400'
  if (s >= 5) return 'text-yellow-400'
  return 'text-gray-400'
}

function strengthBg(s: number): string {
  if (s >= 15) return 'bg-red-500'
  if (s >= 10) return 'bg-orange-500'
  if (s >= 5) return 'bg-yellow-500'
  return 'bg-gray-600'
}

function distLabel(price: number, current: number): string {
  const d = ((price - current) / current) * 100
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}%`
}

const FIB_COLORS: Record<string, string> = {
  '0.236': 'text-blue-300',
  '0.382': 'text-cyan-400',
  '0.5': 'text-green-400',
  '0.618': 'text-yellow-400',
  '0.65': 'text-yellow-300',
  '0.786': 'text-orange-400',
  '1.0': 'text-red-400',
  '1.272': 'text-pink-400',
  '1.618': 'text-purple-400',
  '2.0': 'text-indigo-400',
  '2.618': 'text-violet-400',
}

type Tab = 'map' | 'fibonacci' | 'confluence'

/* ── Main Component ──────────────────────────────────────── */

export default function SRLevelsSection({ levels, fibLevels, confluenceZones, currentPrice }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('map')

  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <h3 className="font-display font-semibold text-sm mb-3">
          Soportes, Resistencias & Fibonacci
        </h3>
        <div className="flex gap-1">
          {(['map', 'fibonacci', 'confluence'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-mono rounded-lg transition-colors',
                tab === t
                  ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50',
              )}
            >
              {t === 'map' ? 'Mapa S/R' : t === 'fibonacci' ? 'Fibonacci' : 'Confluencia'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === 'map' && <PriceMap levels={levels} fibLevels={fibLevels} confluenceZones={confluenceZones} currentPrice={currentPrice} />}
        {tab === 'fibonacci' && <FibonacciTable fibLevels={fibLevels} currentPrice={currentPrice} />}
        {tab === 'confluence' && <ConfluenceView zones={confluenceZones} currentPrice={currentPrice} />}
      </div>
    </div>
  )
}

/* ── Tab 1: Full Price Map ───────────────────────────────── */

interface MapEntry {
  price: number
  label: string
  type: 'support' | 'resistance' | 'current'
  strength: number
  badges: string[]
  source: string
  color: string
}

function PriceMap({ levels, fibLevels, confluenceZones, currentPrice }: Props) {
  const entries = useMemo(() => {
    const items: MapEntry[] = []

    // S/R levels
    for (const l of levels) {
      const badges: string[] = []
      if (l.is_psychological) badges.push('PSY')
      if (l.is_role_flip) badges.push('FLIP')
      if (l.is_high_volume) badges.push('VOL')
      if (l.fib_level != null) badges.push(`F${l.fib_level}`)

      items.push({
        price: l.price,
        label: formatPrice(l.price),
        type: l.price > currentPrice ? 'resistance' : 'support',
        strength: l.strength,
        badges,
        source: l.source?.join(', ') || 'S/R',
        color: l.price > currentPrice ? 'text-bearish' : 'text-bullish',
      })
    }

    // Add fib prices not already in levels
    const existingPrices = new Set(levels.map((l) => Math.round(l.price)))
    for (const fib of fibLevels) {
      if (!fib.levels) continue
      for (const [ratio, price] of Object.entries(fib.levels)) {
        const p = Number(price)
        if (p <= 0 || existingPrices.has(Math.round(p))) continue
        // Only show fibs within reasonable range
        if (p < currentPrice * 0.3 || p > currentPrice * 2) continue
        existingPrices.add(Math.round(p))
        items.push({
          price: p,
          label: formatPrice(p),
          type: p > currentPrice ? 'resistance' : 'support',
          strength: 0,
          badges: [`Fib ${ratio}`, fib.timeframe],
          source: `Fibonacci ${fib.type} ${fib.direction}`,
          color: FIB_COLORS[ratio] || 'text-accent-btc',
        })
      }
    }

    // Sort descending by price
    items.sort((a, b) => b.price - a.price)
    return items
  }, [levels, fibLevels, currentPrice])

  // Split into resistances and supports
  const resistances = entries.filter((e) => e.price > currentPrice)
  const supports = entries.filter((e) => e.price <= currentPrice)

  return (
    <div className="space-y-0">
      {/* Resistances header */}
      <div className="text-[10px] font-mono text-bearish tracking-wider uppercase mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-bearish" />
        Resistencias ({resistances.length})
      </div>

      {/* Resistances */}
      <div className="space-y-0.5 mb-3">
        {resistances.length === 0 ? (
          <p className="text-xs text-text-muted italic">Sin resistencias activas</p>
        ) : (
          resistances.map((e, i) => (
            <MapRow key={`r-${i}`} entry={e} currentPrice={currentPrice} />
          ))
        )}
      </div>

      {/* Current price */}
      <div className="flex items-center gap-2 py-2 my-2 border-y border-accent-btc/40">
        <span className="text-xs font-mono text-accent-btc font-bold w-28 text-right">
          {formatPrice(currentPrice)}
        </span>
        <div className="flex-1 h-0.5 bg-accent-btc/40 rounded" />
        <span className="text-[10px] font-mono text-accent-btc font-bold">PRECIO ACTUAL</span>
        <div className="flex-1 h-0.5 bg-accent-btc/40 rounded" />
      </div>

      {/* Supports header */}
      <div className="text-[10px] font-mono text-bullish tracking-wider uppercase mt-2 mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-bullish" />
        Soportes ({supports.length})
      </div>

      {/* Supports */}
      <div className="space-y-0.5">
        {supports.length === 0 ? (
          <p className="text-xs text-text-muted italic">Sin soportes activos</p>
        ) : (
          supports.map((e, i) => (
            <MapRow key={`s-${i}`} entry={e} currentPrice={currentPrice} />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-3 text-[10px] text-text-muted">
        <span><span className="text-yellow-400">PSY</span> = Psicológico</span>
        <span><span className="text-purple-400">FLIP</span> = Role Flip</span>
        <span><span className="text-blue-400">VOL</span> = Alto Volumen</span>
        <span><span className="text-accent-btc">Fib</span> = Fibonacci</span>
      </div>
    </div>
  )
}

function MapRow({ entry, currentPrice }: { entry: MapEntry; currentPrice: number }) {
  const dist = ((entry.price - currentPrice) / currentPrice) * 100
  const isSupport = entry.price <= currentPrice
  const hasFib = entry.badges.some((b) => b.startsWith('Fib') || b.startsWith('F'))

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1 px-2 rounded-lg transition-colors hover:bg-bg-tertiary/30 group',
        Math.abs(dist) < 2 && 'bg-accent-btc/5 border border-accent-btc/10',
      )}
      title={entry.source}
    >
      {/* Price */}
      <span className={cn('text-xs font-mono w-28 text-right font-medium', entry.strength > 0 ? (isSupport ? 'text-bullish' : 'text-bearish') : entry.color)}>
        {entry.label}
      </span>

      {/* Strength bar */}
      {entry.strength > 0 ? (
        <div className="w-20 h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', strengthBg(entry.strength))}
            style={{ width: `${(entry.strength / 20) * 100}%` }}
          />
        </div>
      ) : (
        <div className="w-20 h-2 flex items-center">
          <div className="w-full border-t border-dashed border-accent-btc/30" />
        </div>
      )}

      {/* Strength text */}
      <span className={cn('text-[10px] font-mono w-8 text-right', strengthColor(entry.strength))}>
        {entry.strength > 0 ? `${entry.strength}` : '—'}
      </span>

      {/* Distance */}
      <span className={cn('text-[10px] font-mono w-14 text-right', isSupport ? 'text-bullish' : 'text-bearish')}>
        {distLabel(entry.price, currentPrice)}
      </span>

      {/* Badges */}
      <div className="flex gap-1 flex-wrap flex-1 min-w-0">
        {entry.badges.map((b, i) => (
          <span
            key={i}
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-mono whitespace-nowrap',
              b === 'PSY' && 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20',
              b === 'FLIP' && 'bg-purple-400/10 text-purple-400 border border-purple-400/20',
              b === 'VOL' && 'bg-blue-400/10 text-blue-400 border border-blue-400/20',
              b.startsWith('Fib') && 'bg-accent-btc/10 text-accent-btc border border-accent-btc/20',
              b.startsWith('F0') && 'bg-accent-btc/10 text-accent-btc border border-accent-btc/20',
              !b.match(/^(PSY|FLIP|VOL|Fib|F0|F1|F2)/) && 'bg-bg-tertiary text-text-muted border border-border/50',
            )}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Tab 2: Fibonacci Table ──────────────────────────────── */

function FibonacciTable({ fibLevels, currentPrice }: { fibLevels: FibonacciLevel[]; currentPrice: number }) {
  const [selectedTf, setSelectedTf] = useState<string>('all')

  const timeframes = useMemo(() => {
    const tfs = [...new Set(fibLevels.map((f) => f.timeframe))].sort()
    return ['all', ...tfs]
  }, [fibLevels])

  const filtered = useMemo(() => {
    if (selectedTf === 'all') return fibLevels
    return fibLevels.filter((f) => f.timeframe === selectedTf)
  }, [fibLevels, selectedTf])

  if (!fibLevels.length) {
    return <p className="text-sm text-text-muted">Sin niveles Fibonacci activos</p>
  }

  return (
    <div className="space-y-4">
      {/* TF selector */}
      <div className="flex gap-1">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedTf(tf)}
            className={cn(
              'px-2 py-1 text-[10px] font-mono rounded transition-colors',
              selectedTf === tf
                ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {tf === 'all' ? 'TODOS' : tf}
          </button>
        ))}
      </div>

      {/* Fib sets */}
      {filtered.map((fib) => (
        <FibSet key={fib.id} fib={fib} currentPrice={currentPrice} />
      ))}
    </div>
  )
}

function FibSet({ fib, currentPrice }: { fib: FibonacciLevel; currentPrice: number }) {
  const sortedLevels = useMemo(() => {
    if (!fib.levels) return []
    return Object.entries(fib.levels as Record<string, number>)
      .map(([ratio, price]) => ({ ratio, price: Number(price) }))
      .filter((l) => l.price > 0)
      .sort((a, b) => b.price - a.price)
  }, [fib])

  const dirColor = fib.direction === 'LONG' ? 'text-bullish' : 'text-bearish'
  const dirBg = fib.direction === 'LONG' ? 'bg-bullish/10 border-bullish/20' : 'bg-bearish/10 border-bearish/20'

  return (
    <div className="rounded-lg border border-border bg-bg-primary/40 overflow-hidden">
      {/* Header */}
      <div className={cn('flex items-center justify-between p-3 border-b border-border/50', dirBg)}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-bg-tertiary px-2 py-0.5 rounded">{fib.timeframe}</span>
          <span className={cn('text-xs font-bold', dirColor)}>{fib.direction}</span>
          <span className="text-[10px] text-text-muted capitalize">{fib.type}</span>
        </div>
        <div className="text-[10px] font-mono text-text-muted">
          {formatPrice(fib.swing_low)} → {formatPrice(fib.swing_high)}
        </div>
      </div>

      {/* Levels */}
      <div className="divide-y divide-border/30">
        {sortedLevels.map((l) => {
          const dist = ((l.price - currentPrice) / currentPrice) * 100
          const isNear = Math.abs(dist) < 2
          const isAbove = l.price > currentPrice

          return (
            <div
              key={l.ratio}
              className={cn(
                'flex items-center justify-between px-3 py-1.5 text-xs',
                isNear && 'bg-accent-btc/5',
              )}
            >
              <span className={cn('font-mono font-bold w-16', FIB_COLORS[l.ratio] || 'text-text-secondary')}>
                {l.ratio}
              </span>
              <span className="font-mono text-text-primary flex-1 text-right">
                {formatPrice(l.price)}
              </span>
              <span className={cn('font-mono w-16 text-right', isAbove ? 'text-bearish' : 'text-bullish')}>
                {dist > 0 ? '+' : ''}{dist.toFixed(1)}%
              </span>
              {isNear && (
                <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-accent-btc/15 text-accent-btc rounded font-bold">
                  NEAR
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Tab 3: Confluence View ──────────────────────────────── */

function ConfluenceView({ zones, currentPrice }: { zones: ConfluenceZone[]; currentPrice: number }) {
  if (!zones.length) {
    return <p className="text-sm text-text-muted">Sin zonas de confluencia activas</p>
  }

  return (
    <div className="space-y-4">
      {zones.map((z) => {
        const isCritical = z.strength >= 15 || z.has_gran_nivel
        const isSupport = z.type === 'support'
        const distPct = ((z.price_mid - currentPrice) / currentPrice) * 100

        return (
          <div
            key={z.id}
            className={cn(
              'rounded-xl border p-4 backdrop-blur-sm',
              isCritical
                ? isSupport
                  ? 'border-bullish/40 bg-bullish/5'
                  : 'border-bearish/40 bg-bearish/5'
                : 'border-border bg-bg-primary/40',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={cn('w-2.5 h-2.5 rounded-full', isSupport ? 'bg-bullish' : 'bg-bearish')} />
                <span className="text-xs font-display font-bold text-text-primary">
                  {isCritical ? 'ZONA CRÍTICA' : 'ZONA FUERTE'}
                  {' — '}
                  {isSupport ? 'Soporte' : 'Resistencia'}
                </span>
                {z.has_gran_nivel && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/15 text-purple-400 border border-purple-400/30 font-bold">
                    GRAN NIVEL
                  </span>
                )}
              </div>
              <span className={cn('text-xs font-mono font-bold', Math.abs(distPct) < 3 ? 'text-accent-btc' : 'text-text-muted')}>
                {distPct > 0 ? '+' : ''}{distPct.toFixed(1)}%
              </span>
            </div>

            {/* Price range visual */}
            <div className="rounded-lg bg-bg-tertiary/50 p-3 mb-3">
              <div className="flex items-center justify-between font-mono text-sm">
                <span className="text-text-muted">{formatPrice(z.price_low)}</span>
                <span className="text-text-primary font-bold">{formatPrice(z.price_mid)}</span>
                <span className="text-text-muted">{formatPrice(z.price_high)}</span>
              </div>
              <div className="mt-2 h-2 bg-bg-secondary rounded-full overflow-hidden relative">
                <div
                  className={cn(
                    'h-full rounded-full',
                    isSupport ? 'bg-bullish/60' : 'bg-bearish/60',
                  )}
                  style={{ width: `${(z.strength / 20) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-text-muted font-mono">
                <span>Fuerza: {z.strength}/20</span>
                <span>{z.num_timeframes} timeframes</span>
              </div>
            </div>

            {/* Timeframes */}
            <div className="flex gap-1.5 mb-2">
              {z.timeframes.map((tf) => (
                <span key={tf} className="text-[10px] px-2 py-0.5 bg-bg-tertiary rounded font-mono text-text-secondary">
                  {tf}
                </span>
              ))}
            </div>

            {/* Fibonacci ratios */}
            {z.fib_ratios && z.fib_ratios.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {z.fib_ratios.map((r) => (
                  <span
                    key={r}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded font-mono border',
                      FIB_COLORS[String(r)] ? `${FIB_COLORS[String(r)]} border-current/20 bg-current/5` : 'text-accent-btc border-accent-btc/20 bg-accent-btc/5',
                    )}
                  >
                    Fib {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
