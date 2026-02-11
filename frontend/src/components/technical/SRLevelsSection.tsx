import { useMemo, useState } from 'react'
import { formatPrice, cn } from '../../lib/utils'
import type { PriceLevel, FibonacciLevel, ConfluenceZone } from '../../lib/types'

interface Props {
  levels: PriceLevel[]
  fibLevels: FibonacciLevel[]
  confluenceZones: ConfluenceZone[]
  currentPrice: number
}

/* ── Helpers ─────────────────────────────────────────────── */

function strengthBg(s: number): string {
  if (s >= 15) return 'bg-red-500'
  if (s >= 10) return 'bg-orange-500'
  if (s >= 5) return 'bg-yellow-500'
  return 'bg-gray-600'
}

const FIB_BG: Record<string, string> = {
  '0.236': 'bg-blue-400',
  '0.382': 'bg-cyan-400',
  '0.5': 'bg-green-400',
  '0.618': 'bg-yellow-400',
  '0.65': 'bg-yellow-300',
  '0.786': 'bg-orange-400',
  '1.0': 'bg-red-400',
  '1.272': 'bg-pink-400',
  '1.618': 'bg-purple-400',
  '2.0': 'bg-indigo-400',
  '2.618': 'bg-violet-400',
}

const FIB_TEXT: Record<string, string> = {
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

type Tab = 'visual' | 'fibonacci' | 'confluence' | 'decisions'

/* ── Unified level entry ─────────────────────────────────── */

interface UnifiedLevel {
  price: number
  strength: number // 0 for fib-only levels
  type: 'support' | 'resistance'
  sources: string[]
  fibRatios: string[]
  isPsy: boolean
  isFlip: boolean
  isHighVol: boolean
  isFib: boolean
  confluenceTFs: number // how many TFs this appears in
}

function useUnifiedLevels(levels: PriceLevel[], fibLevels: FibonacciLevel[], confluenceZones: ConfluenceZone[], currentPrice: number) {
  return useMemo(() => {
    const map = new Map<number, UnifiedLevel>()

    // S/R levels
    for (const l of levels) {
      const key = Math.round(l.price)
      map.set(key, {
        price: l.price,
        strength: l.strength,
        type: l.price > currentPrice ? 'resistance' : 'support',
        sources: l.source || [],
        fibRatios: l.fib_level != null ? [String(l.fib_level)] : [],
        isPsy: l.is_psychological,
        isFlip: l.is_role_flip,
        isHighVol: l.is_high_volume,
        isFib: l.fib_level != null,
        confluenceTFs: 0,
      })
    }

    // Fibonacci levels
    for (const fib of fibLevels) {
      if (!fib.levels) continue
      for (const [ratio, price] of Object.entries(fib.levels)) {
        const p = Number(price)
        if (p <= 0 || p < currentPrice * 0.3 || p > currentPrice * 2) continue
        const key = Math.round(p)
        const existing = map.get(key)
        if (existing) {
          if (!existing.fibRatios.includes(ratio)) existing.fibRatios.push(ratio)
          existing.isFib = true
        } else {
          map.set(key, {
            price: p,
            strength: 0,
            type: p > currentPrice ? 'resistance' : 'support',
            sources: ['fibonacci'],
            fibRatios: [ratio],
            isPsy: false,
            isFlip: false,
            isHighVol: false,
            isFib: true,
            confluenceTFs: 0,
          })
        }
      }
    }

    // Mark confluence
    for (const z of confluenceZones) {
      for (const [, entry] of map) {
        if (entry.price >= z.price_low && entry.price <= z.price_high) {
          entry.confluenceTFs = Math.max(entry.confluenceTFs, z.num_timeframes)
        }
      }
    }

    const all = Array.from(map.values()).sort((a, b) => b.price - a.price)
    return all
  }, [levels, fibLevels, confluenceZones, currentPrice])
}

/* ── Main Component ──────────────────────────────────────── */

export default function SRLevelsSection({ levels, fibLevels, confluenceZones, currentPrice }: Props) {
  const [tab, setTab] = useState<Tab>('visual')
  const unified = useUnifiedLevels(levels, fibLevels, confluenceZones, currentPrice)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'visual', label: 'Mapa Visual' },
    { id: 'fibonacci', label: 'Fibonacci' },
    { id: 'confluence', label: 'Confluencia' },
    { id: 'decisions', label: 'Decisiones' },
  ]

  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border backdrop-blur-sm overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <h3 className="font-display font-semibold text-sm mb-3">Soportes, Resistencias & Fibonacci</h3>
        <div className="flex gap-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-mono rounded-lg transition-colors',
                tab === t.id
                  ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {tab === 'visual' && <VisualPriceMap levels={unified} currentPrice={currentPrice} confluenceZones={confluenceZones} />}
        {tab === 'fibonacci' && <FibonacciTab fibLevels={fibLevels} currentPrice={currentPrice} />}
        {tab === 'confluence' && <ConfluenceTab zones={confluenceZones} currentPrice={currentPrice} />}
        {tab === 'decisions' && <DecisionsTab levels={unified} fibLevels={fibLevels} confluenceZones={confluenceZones} currentPrice={currentPrice} />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 1: VISUAL PRICE MAP
   A graphical vertical price ladder
   ═══════════════════════════════════════════════════════════ */

function VisualPriceMap({ levels, currentPrice, confluenceZones }: { levels: UnifiedLevel[]; currentPrice: number; confluenceZones: ConfluenceZone[] }) {
  // Calculate the price range to display
  const { maxPrice, range } = useMemo(() => {
    const prices = levels.map((l) => l.price)
    prices.push(currentPrice)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const r = max - min || 1
    return { maxPrice: max + r * 0.02, range: r * 1.04 }
  }, [levels, currentPrice])

  // Position helper: converts price to percentage from top (0=max, 100=min)
  const priceToY = (price: number) => ((maxPrice - price) / range) * 100

  const resistances = levels.filter((l) => l.price > currentPrice)
  const supports = levels.filter((l) => l.price <= currentPrice)
  const currentY = priceToY(currentPrice)

  return (
    <div className="space-y-3">
      {/* Chart area */}
      <div className="relative bg-bg-primary/60 rounded-lg border border-border/50 overflow-hidden" style={{ minHeight: Math.max(400, levels.length * 22 + 60) }}>

        {/* Confluence zone backgrounds */}
        {confluenceZones.map((z) => {
          const top = priceToY(z.price_high)
          const bottom = priceToY(z.price_low)
          const isSupport = z.type === 'support'
          return (
            <div
              key={z.id}
              className={cn('absolute left-0 right-0 opacity-15', isSupport ? 'bg-green-400' : 'bg-red-400')}
              style={{ top: `${top}%`, height: `${bottom - top}%` }}
            />
          )
        })}

        {/* Current price line */}
        <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: `${currentY}%` }}>
          <div className="flex-1 h-px bg-[#f7931a]" style={{ boxShadow: '0 0 8px #f7931a80' }} />
          <div className="bg-[#f7931a] text-black text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm whitespace-nowrap">
            {formatPrice(currentPrice)}
          </div>
          <div className="flex-1 h-px bg-[#f7931a]" style={{ boxShadow: '0 0 8px #f7931a80' }} />
        </div>

        {/* Level lines */}
        {levels.map((l, i) => {
          const y = priceToY(l.price)
          const dist = ((l.price - currentPrice) / currentPrice) * 100
          const isSupport = l.type === 'support'
          const isNear = Math.abs(dist) < 1.5
          const maxStr = 20

          return (
            <div key={i} className="absolute left-0 right-0 z-10 flex items-center group" style={{ top: `${y}%` }}>
              {/* Price label */}
              <div className={cn('text-[9px] font-mono w-20 text-right pr-2 shrink-0', isSupport ? 'text-green-400' : 'text-red-400', isNear && 'font-bold')}>
                {formatPrice(l.price)}
              </div>

              {/* Line */}
              <div className="flex-1 relative h-px">
                {l.strength > 0 ? (
                  <div
                    className={cn('h-[2px] rounded', isSupport ? 'bg-green-500' : 'bg-red-500')}
                    style={{ width: `${Math.max(15, (l.strength / maxStr) * 100)}%`, opacity: 0.3 + (l.strength / maxStr) * 0.7 }}
                  />
                ) : (
                  <div className="w-full border-t border-dashed border-accent-btc/25" />
                )}
              </div>

              {/* Info panel on hover */}
              <div className={cn('shrink-0 flex items-center gap-1 pl-2 text-[9px] font-mono')}>
                {l.strength > 0 && (
                  <span className={cn('px-1 rounded', strengthBg(l.strength), 'text-black font-bold')}>
                    {l.strength}
                  </span>
                )}
                <span className={cn('w-12 text-right', isSupport ? 'text-green-400/70' : 'text-red-400/70')}>
                  {dist > 0 ? '+' : ''}{dist.toFixed(1)}%
                </span>
                {l.isPsy && <span className="text-yellow-400" title="Psicológico">&#9679;</span>}
                {l.isFlip && <span className="text-purple-400" title="Role Flip">&#8693;</span>}
                {l.isHighVol && <span className="text-blue-400" title="Alto Volumen">&#9646;</span>}
                {l.isFib && <span className="text-accent-btc" title="Fibonacci">&#9671;</span>}
                {l.confluenceTFs >= 2 && <span className="text-purple-300" title={`Confluencia ${l.confluenceTFs}TF`}>&#9733;</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between text-[10px] font-mono text-text-muted px-1">
        <span><span className="text-red-400">&#9632;</span> {resistances.length} resistencias</span>
        <span><span className="text-green-400">&#9632;</span> {supports.length} soportes</span>
        <span>
          <span className="text-yellow-400">&#9679;</span> PSY
          <span className="text-purple-400 ml-2">&#8693;</span> Flip
          <span className="text-blue-400 ml-2">&#9646;</span> Vol
          <span className="text-accent-btc ml-2">&#9671;</span> Fib
          <span className="text-purple-300 ml-2">&#9733;</span> Confluencia
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 2: FIBONACCI
   ═══════════════════════════════════════════════════════════ */

function FibonacciTab({ fibLevels, currentPrice }: { fibLevels: FibonacciLevel[]; currentPrice: number }) {
  const [selectedTf, setSelectedTf] = useState<string>('all')

  const timeframes = useMemo(() => {
    const tfs = [...new Set(fibLevels.map((f) => f.timeframe))].sort()
    return ['all', ...tfs]
  }, [fibLevels])

  const filtered = useMemo(() => {
    if (selectedTf === 'all') return fibLevels
    return fibLevels.filter((f) => f.timeframe === selectedTf)
  }, [fibLevels, selectedTf])

  if (!fibLevels.length) return <p className="text-sm text-text-muted">Sin niveles Fibonacci activos</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {timeframes.map((tf) => (
          <button key={tf} onClick={() => setSelectedTf(tf)} className={cn('px-2 py-1 text-[10px] font-mono rounded transition-colors', selectedTf === tf ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30' : 'text-text-muted hover:text-text-secondary')}>
            {tf === 'all' ? 'TODOS' : tf}
          </button>
        ))}
      </div>
      {filtered.map((fib) => <FibSetVisual key={fib.id} fib={fib} currentPrice={currentPrice} />)}
    </div>
  )
}

function FibSetVisual({ fib, currentPrice }: { fib: FibonacciLevel; currentPrice: number }) {
  const sortedLevels = useMemo(() => {
    if (!fib.levels) return []
    return Object.entries(fib.levels as Record<string, number>)
      .map(([ratio, price]) => ({ ratio, price: Number(price) }))
      .filter((l) => l.price > 0)
      .sort((a, b) => b.price - a.price)
  }, [fib])

  const maxP = Math.max(...sortedLevels.map((l) => l.price), currentPrice) * 1.02
  const minP = Math.min(...sortedLevels.map((l) => l.price), currentPrice) * 0.98
  const rangeP = maxP - minP || 1

  const dirColor = fib.direction === 'LONG' ? 'text-bullish' : 'text-bearish'
  const dirBg = fib.direction === 'LONG' ? 'bg-bullish/10 border-bullish/20' : 'bg-bearish/10 border-bearish/20'

  return (
    <div className="rounded-lg border border-border bg-bg-primary/40 overflow-hidden">
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

      {/* Visual fib levels */}
      <div className="p-3">
        <div className="relative bg-bg-tertiary/30 rounded" style={{ height: Math.max(160, sortedLevels.length * 28 + 20) }}>
          {/* Current price */}
          <div className="absolute left-0 right-0 flex items-center z-10" style={{ top: `${((maxP - currentPrice) / rangeP) * 100}%` }}>
            <div className="flex-1 h-px bg-[#f7931a]" />
            <span className="text-[8px] font-mono bg-[#f7931a] text-black px-1 rounded-sm font-bold">{formatPrice(currentPrice)}</span>
          </div>

          {/* Fib levels */}
          {sortedLevels.map((l) => {
            const y = ((maxP - l.price) / rangeP) * 100
            const dist = ((l.price - currentPrice) / currentPrice) * 100
            const isAbove = l.price > currentPrice
            const isNear = Math.abs(dist) < 2

            return (
              <div key={l.ratio} className="absolute left-0 right-0 flex items-center" style={{ top: `${y}%` }}>
                <span className={cn('text-[9px] font-mono font-bold w-10 text-right pr-1', FIB_TEXT[l.ratio] || 'text-accent-btc')}>
                  {l.ratio}
                </span>
                <div className={cn('flex-1 h-[2px] rounded opacity-60', FIB_BG[l.ratio] || 'bg-accent-btc')} />
                <div className="flex items-center gap-1 pl-1">
                  <span className={cn('text-[9px] font-mono', isNear ? 'text-accent-btc font-bold' : 'text-text-secondary')}>{formatPrice(l.price)}</span>
                  <span className={cn('text-[8px] font-mono', isAbove ? 'text-red-400/70' : 'text-green-400/70')}>
                    {dist > 0 ? '+' : ''}{dist.toFixed(1)}%
                  </span>
                  {isNear && <span className="text-[8px] px-1 bg-accent-btc/20 text-accent-btc rounded font-bold">NEAR</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 3: CONFLUENCE
   ═══════════════════════════════════════════════════════════ */

function ConfluenceTab({ zones, currentPrice }: { zones: ConfluenceZone[]; currentPrice: number }) {
  if (!zones.length) return <p className="text-sm text-text-muted">Sin zonas de confluencia activas</p>

  return (
    <div className="space-y-4">
      {zones.map((z) => {
        const isSupport = z.type === 'support'
        const distPct = ((z.price_mid - currentPrice) / currentPrice) * 100
        const isCritical = z.strength >= 15 || z.has_gran_nivel

        return (
          <div key={z.id} className={cn('rounded-xl border p-4', isCritical ? (isSupport ? 'border-bullish/40 bg-bullish/5' : 'border-bearish/40 bg-bearish/5') : 'border-border bg-bg-primary/40')}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={cn('w-2.5 h-2.5 rounded-full', isSupport ? 'bg-bullish' : 'bg-bearish')} />
                <span className="text-xs font-display font-bold">{isCritical ? 'ZONA CRITICA' : 'ZONA FUERTE'} — {isSupport ? 'Soporte' : 'Resistencia'}</span>
                {z.has_gran_nivel && <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/15 text-purple-400 border border-purple-400/30 font-bold">GRAN NIVEL</span>}
              </div>
              <span className={cn('text-xs font-mono font-bold', Math.abs(distPct) < 3 ? 'text-accent-btc' : 'text-text-muted')}>{distPct > 0 ? '+' : ''}{distPct.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg bg-bg-tertiary/50 p-3 mb-3">
              <div className="flex items-center justify-between font-mono text-sm">
                <span className="text-text-muted">{formatPrice(z.price_low)}</span>
                <span className="text-text-primary font-bold">{formatPrice(z.price_mid)}</span>
                <span className="text-text-muted">{formatPrice(z.price_high)}</span>
              </div>
              <div className="mt-2 h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', isSupport ? 'bg-bullish/60' : 'bg-bearish/60')} style={{ width: `${(z.strength / 20) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-text-muted font-mono">
                <span>Fuerza: {z.strength}/20</span>
                <span>{z.num_timeframes} timeframes</span>
              </div>
            </div>
            <div className="flex gap-1.5 mb-2">
              {z.timeframes.map((tf) => <span key={tf} className="text-[10px] px-2 py-0.5 bg-bg-tertiary rounded font-mono text-text-secondary">{tf}</span>)}
            </div>
            {z.fib_ratios && z.fib_ratios.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {z.fib_ratios.map((r) => <span key={r} className="text-[9px] px-1.5 py-0.5 rounded font-mono border text-accent-btc border-accent-btc/20 bg-accent-btc/5">Fib {r}</span>)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 4: DECISIONS — Actionable analysis
   ═══════════════════════════════════════════════════════════ */

function DecisionsTab({ levels, fibLevels, confluenceZones, currentPrice }: { levels: UnifiedLevel[]; fibLevels: FibonacciLevel[]; confluenceZones: ConfluenceZone[]; currentPrice: number }) {
  const analysis = useMemo(() => {
    const resistances = levels.filter((l) => l.type === 'resistance').sort((a, b) => a.price - b.price)
    const supports = levels.filter((l) => l.type === 'support').sort((a, b) => b.price - a.price)

    // Nearest strong S/R (strength >= 5)
    const nearestStrongRes = resistances.find((l) => l.strength >= 5) ?? null
    const nearestStrongSup = supports.find((l) => l.strength >= 5) ?? null

    // Nearest any S/R
    const nearestRes = resistances[0] ?? null
    const nearestSup = supports[0] ?? null

    // Fibonacci levels near price (within 3%)
    const nearFibs: { ratio: string; price: number; tf: string; type: string; dist: number }[] = []
    for (const fib of fibLevels) {
      if (!fib.levels) continue
      for (const [ratio, price] of Object.entries(fib.levels)) {
        const p = Number(price)
        if (p <= 0) continue
        const dist = ((p - currentPrice) / currentPrice) * 100
        if (Math.abs(dist) <= 3) {
          nearFibs.push({ ratio, price: p, tf: fib.timeframe, type: fib.type, dist })
        }
      }
    }
    nearFibs.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))

    // Confluence near price
    const nearConfluence = confluenceZones.filter((z) => {
      const dist = Math.abs(z.price_mid - currentPrice) / currentPrice * 100
      return dist <= 5
    })

    // Risk zones: areas with many levels clustered
    const clusterSupports = supports.filter((l) => l.strength >= 10 || l.confluenceTFs >= 2)
    const clusterResistances = resistances.filter((l) => l.strength >= 10 || l.confluenceTFs >= 2)

    // R:R estimate
    const riskLevel = nearestStrongSup || nearestSup
    const rewardLevel = nearestStrongRes || nearestRes
    const risk = riskLevel ? Math.abs(currentPrice - riskLevel.price) : 0
    const reward = rewardLevel ? Math.abs(rewardLevel.price - currentPrice) : 0
    const rr = risk > 0 ? (reward / risk) : 0

    // Position in range
    const allPrices = levels.map((l) => l.price)
    const rangeHigh = Math.max(...allPrices, currentPrice)
    const rangeLow = Math.min(...allPrices, currentPrice)
    const rangePct = rangeLow !== rangeHigh ? ((currentPrice - rangeLow) / (rangeHigh - rangeLow)) * 100 : 50

    // Bias
    let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    const strongSupCount = supports.filter((l) => l.strength >= 10).length
    const strongResCount = resistances.filter((l) => l.strength >= 10).length
    if (strongSupCount > strongResCount + 1) bias = 'bullish'
    else if (strongResCount > strongSupCount + 1) bias = 'bearish'
    if (nearConfluence.some((z) => z.type === 'support' && z.strength >= 15)) bias = 'bullish'
    if (nearConfluence.some((z) => z.type === 'resistance' && z.strength >= 15)) bias = 'bearish'

    return {
      nearestRes, nearestSup, nearestStrongRes, nearestStrongSup,
      nearFibs, nearConfluence, clusterSupports, clusterResistances,
      rr, risk, reward, rangePct, bias,
    }
  }, [levels, fibLevels, confluenceZones, currentPrice])

  const { nearestRes, nearestSup, nearestStrongRes, nearestStrongSup, nearFibs, nearConfluence, rr, risk, reward, rangePct, bias } = analysis

  return (
    <div className="space-y-5">

      {/* Position in range */}
      <div className="rounded-lg border border-border bg-bg-primary/40 p-4">
        <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">Posicion en rango</div>
        <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden relative mb-2">
          <div className="h-full bg-gradient-to-r from-green-500/60 via-yellow-500/60 to-red-500/60 rounded-full" style={{ width: '100%' }} />
          <div className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-lg" style={{ left: `${rangePct}%`, transform: 'translateX(-50%)' }} />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-text-muted">
          <span className="text-green-400">Soporte fuerte</span>
          <span className={cn('font-bold', bias === 'bullish' ? 'text-green-400' : bias === 'bearish' ? 'text-red-400' : 'text-yellow-400')}>
            {rangePct.toFixed(0)}% del rango
          </span>
          <span className="text-red-400">Resistencia fuerte</span>
        </div>
      </div>

      {/* Nearest levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NearestCard
          title="Resistencia mas cercana"
          level={nearestRes}
          strongLevel={nearestStrongRes}
          currentPrice={currentPrice}
          colorClass="text-red-400"
          bgClass="border-red-400/20 bg-red-400/5"
        />
        <NearestCard
          title="Soporte mas cercano"
          level={nearestSup}
          strongLevel={nearestStrongSup}
          currentPrice={currentPrice}
          colorClass="text-green-400"
          bgClass="border-green-400/20 bg-green-400/5"
        />
      </div>

      {/* R:R */}
      <div className="rounded-lg border border-border bg-bg-primary/40 p-4">
        <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">Risk / Reward estimado</div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-red-400">Riesgo (al soporte)</span>
              <span className="text-xs font-mono font-bold text-red-400">{risk > 0 ? formatPrice(risk) : '—'}</span>
            </div>
            <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-red-500/50 rounded-full" style={{ width: rr > 0 ? `${Math.min(100, (1 / (1 + rr)) * 100)}%` : '50%' }} />
            </div>
          </div>
          <div className={cn('text-lg font-mono font-bold px-3 py-1 rounded-lg border', rr >= 2 ? 'text-green-400 border-green-400/30 bg-green-400/10' : rr >= 1 ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10')}>
            {rr > 0 ? `${rr.toFixed(1)}:1` : '—'}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-green-400">Reward (a resistencia)</span>
              <span className="text-xs font-mono font-bold text-green-400">{reward > 0 ? formatPrice(reward) : '—'}</span>
            </div>
            <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-green-500/50 rounded-full" style={{ width: rr > 0 ? `${Math.min(100, (rr / (1 + rr)) * 100)}%` : '50%' }} />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-text-muted mt-2">
          {rr >= 2 ? 'R:R favorable — el potencial de ganancia supera al riesgo.' :
           rr >= 1 ? 'R:R equilibrado — gestiona el tamano de la posicion.' :
           rr > 0 ? 'R:R desfavorable — el riesgo supera al potencial. Espera mejor entrada.' :
           'No hay suficientes niveles para calcular R:R.'}
        </p>
      </div>

      {/* Fibonacci near price */}
      {nearFibs.length > 0 && (
        <div className="rounded-lg border border-accent-btc/20 bg-accent-btc/5 p-4">
          <div className="text-[10px] font-mono text-accent-btc uppercase tracking-wider mb-2">Fibonacci cerca del precio (3%)</div>
          <div className="space-y-1.5">
            {nearFibs.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-mono">
                <span className={cn('font-bold', FIB_TEXT[f.ratio] || 'text-accent-btc')}>Fib {f.ratio}</span>
                <span className="text-text-secondary">{formatPrice(f.price)}</span>
                <span className="text-[10px] bg-bg-tertiary px-1.5 py-0.5 rounded text-text-muted">{f.tf} {f.type}</span>
                <span className={cn(f.dist > 0 ? 'text-red-400' : 'text-green-400')}>
                  {f.dist > 0 ? '+' : ''}{f.dist.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confluence alert */}
      {nearConfluence.length > 0 && (
        <div className="rounded-lg border border-purple-400/30 bg-purple-400/5 p-4">
          <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wider mb-2">Zonas de confluencia cercanas</div>
          {nearConfluence.map((z) => {
            const distPct = ((z.price_mid - currentPrice) / currentPrice) * 100
            return (
              <div key={z.id} className="flex items-center justify-between text-xs font-mono mb-1">
                <span className={cn('font-bold', z.type === 'support' ? 'text-green-400' : 'text-red-400')}>
                  {z.type === 'support' ? 'Soporte' : 'Resistencia'} — {z.num_timeframes} TFs
                </span>
                <span className="text-text-secondary">{formatPrice(z.price_low)} - {formatPrice(z.price_high)}</span>
                <span className="text-text-muted">{distPct > 0 ? '+' : ''}{distPct.toFixed(1)}%</span>
                {z.has_gran_nivel && <span className="text-[9px] px-1.5 py-0.5 bg-purple-400/15 text-purple-400 rounded font-bold">GRAN NIVEL</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Actionable summary */}
      <div className={cn('rounded-lg border p-4', bias === 'bullish' ? 'border-green-400/30 bg-green-400/5' : bias === 'bearish' ? 'border-red-400/30 bg-red-400/5' : 'border-yellow-400/30 bg-yellow-400/5')}>
        <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: bias === 'bullish' ? '#4ade80' : bias === 'bearish' ? '#f87171' : '#facc15' }}>
          Sesgo estructural: {bias === 'bullish' ? 'ALCISTA' : bias === 'bearish' ? 'BAJISTA' : 'NEUTRAL'}
        </div>
        <div className="space-y-1.5 text-xs text-text-secondary leading-relaxed">
          {nearestSup && (
            <p>
              <span className="text-green-400 font-bold">Soporte inmediato:</span> {formatPrice(nearestSup.price)} ({((nearestSup.price - currentPrice) / currentPrice * 100).toFixed(1)}%)
              {nearestSup.strength >= 10 && ' — nivel fuerte, deberia actuar como muro.'}
              {nearestSup.strength < 5 && ' — nivel debil, podria romperse facilmente.'}
              {nearestSup.confluenceTFs >= 2 && ` Confluencia en ${nearestSup.confluenceTFs} timeframes.`}
            </p>
          )}
          {nearestRes && (
            <p>
              <span className="text-red-400 font-bold">Resistencia inmediata:</span> {formatPrice(nearestRes.price)} ({((nearestRes.price - currentPrice) / currentPrice * 100).toFixed(1)}%)
              {nearestRes.strength >= 10 && ' — nivel fuerte, dificil de superar.'}
              {nearestRes.strength < 5 && ' — nivel debil, podria superarse con volumen.'}
              {nearestRes.confluenceTFs >= 2 && ` Confluencia en ${nearestRes.confluenceTFs} timeframes.`}
            </p>
          )}
          {nearFibs.length > 0 && (
            <p>
              <span className="text-accent-btc font-bold">Fibonacci:</span> {nearFibs.length} nivel{nearFibs.length > 1 ? 'es' : ''} dentro del 3%.
              {nearFibs[0] && ` El mas cercano es Fib ${nearFibs[0].ratio} en ${formatPrice(nearFibs[0].price)} (${nearFibs[0].dist > 0 ? '+' : ''}${nearFibs[0].dist.toFixed(2)}%).`}
            </p>
          )}
          {rr >= 2 && <p><span className="text-green-400 font-bold">Oportunidad:</span> R:R de {rr.toFixed(1)}:1 es favorable para entrar en largo si hay confirmacion tecnica.</p>}
          {rr > 0 && rr < 1 && <p><span className="text-red-400 font-bold">Precaucion:</span> R:R de {rr.toFixed(1)}:1 es desfavorable. Considera esperar un retroceso para mejor entrada.</p>}
          {nearConfluence.length > 0 && <p><span className="text-purple-400 font-bold">Confluencia:</span> {nearConfluence.length} zona{nearConfluence.length > 1 ? 's' : ''} cercana{nearConfluence.length > 1 ? 's' : ''} al precio. Estas zonas son niveles criticos donde convergen multiples senales.</p>}
        </div>
      </div>
    </div>
  )
}

function NearestCard({ title, level, strongLevel, currentPrice, colorClass, bgClass }: {
  title: string; level: UnifiedLevel | null; strongLevel: UnifiedLevel | null; currentPrice: number; colorClass: string; bgClass: string
}) {
  const target = level
  if (!target) return (
    <div className={cn('rounded-lg border p-3', bgClass)}>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">{title}</div>
      <div className="text-sm text-text-muted">Sin niveles</div>
    </div>
  )

  const dist = ((target.price - currentPrice) / currentPrice) * 100
  const abs = Math.abs(target.price - currentPrice)

  return (
    <div className={cn('rounded-lg border p-3', bgClass)}>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">{title}</div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={cn('text-lg font-mono font-bold', colorClass)}>{formatPrice(target.price)}</span>
        <span className={cn('text-xs font-mono', colorClass)}>{dist > 0 ? '+' : ''}{dist.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
        <span>Distancia: {formatPrice(abs)}</span>
        {target.strength > 0 && (
          <span className={cn('px-1.5 py-0.5 rounded font-bold text-black', strengthBg(target.strength))}>STR {target.strength}</span>
        )}
      </div>
      <div className="flex gap-1 mt-1.5">
        {target.isPsy && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">PSY</span>}
        {target.isFlip && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400 border border-purple-400/20">FLIP</span>}
        {target.isHighVol && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">VOL</span>}
        {target.isFib && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-btc/10 text-accent-btc border border-accent-btc/20">FIB</span>}
        {target.confluenceTFs >= 2 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-300/10 text-purple-300 border border-purple-300/20">{target.confluenceTFs}TF</span>}
      </div>
      {strongLevel && strongLevel.price !== target.price && (
        <div className="mt-2 pt-2 border-t border-border/30 text-[10px] font-mono text-text-muted">
          Nivel fuerte mas cercano: <span className={colorClass}>{formatPrice(strongLevel.price)}</span> ({((strongLevel.price - currentPrice) / currentPrice * 100).toFixed(1)}%, STR {strongLevel.strength})
        </div>
      )}
    </div>
  )
}
