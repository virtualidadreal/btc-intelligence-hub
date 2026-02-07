import { useMemo } from 'react'
import { formatPrice } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { PriceLevel, FibonacciLevel, ConfluenceZone, BtcPrice } from '../../lib/types'

interface Insight {
  type: 'bullish' | 'bearish' | 'neutral'
  label: string
  text: string
}

interface Props {
  rsiLatest: { value: number; signal: string | null } | null
  macdLatest: { histogram: number | null } | null
  lastCross: { type: 'bullish' | 'bearish'; date: string } | null
  priceLatest: { price: number; ema21: number | null; sma50: number | null; sma200: number | null } | null
  levels: PriceLevel[]
  fibLevels: FibonacciLevel[]
  confluenceZones: ConfluenceZone[]
  prices: BtcPrice[]
  smaSignal: string | null
}

export default function TechnicalInterpretation({
  rsiLatest,
  macdLatest,
  lastCross,
  priceLatest,
  levels,
  fibLevels,
  confluenceZones,
  prices,
  smaSignal,
}: Props) {
  const { t } = useI18n()

  const insights = useMemo(() => {
    const result: Insight[] = []
    const currentPrice = priceLatest?.price ?? 0

    // ── RSI ──
    if (rsiLatest) {
      const v = rsiLatest.value
      if (v > 70) result.push({ type: 'bearish', label: 'RSI', text: `RSI en sobrecompra (${v.toFixed(1)}): ${t('technical.rsiOverbought')}` })
      else if (v < 30) result.push({ type: 'bullish', label: 'RSI', text: `RSI en sobreventa (${v.toFixed(1)}): ${t('technical.rsiOversold')}` })
      else if (v > 50) result.push({ type: 'bullish', label: 'RSI', text: `RSI zona alcista (${v.toFixed(1)}): ${t('technical.rsiBullZone')}` })
      else result.push({ type: 'bearish', label: 'RSI', text: `RSI zona bajista (${v.toFixed(1)}): ${t('technical.rsiBearZone')}` })
    }

    // ── MACD ──
    if (macdLatest?.histogram != null) {
      const h = macdLatest.histogram
      if (h > 0) result.push({ type: 'bullish', label: 'MACD', text: `MACD histograma positivo (${h.toFixed(2)}): ${t('technical.macdPosBullish')}` })
      else result.push({ type: 'bearish', label: 'MACD', text: `MACD histograma negativo (${h.toFixed(2)}): ${t('technical.macdNegBearish')}` })
    }
    if (lastCross) {
      result.push({
        type: lastCross.type,
        label: 'MACD',
        text: `${t('technical.lastMacdCross')} ${lastCross.type === 'bullish' ? t('technical.bullishMacdCross') : t('technical.bearishMacdCross')}`,
      })
    }

    // ── Moving Averages ──
    if (priceLatest?.ema21 && currentPrice) {
      const pct = ((currentPrice - priceLatest.ema21) / priceLatest.ema21) * 100
      if (Math.abs(pct) < 2) result.push({ type: 'neutral', label: 'EMA', text: `Precio cerca de EMA 21 (${formatPrice(priceLatest.ema21)}): ${t('technical.priceNearEma')}` })
      else if (pct > 0) result.push({ type: 'bullish', label: 'EMA', text: `Precio ${pct.toFixed(1)}% ${t('technical.priceAboveEma')} (${formatPrice(priceLatest.ema21)})` })
      else result.push({ type: 'bearish', label: 'EMA', text: `Precio ${Math.abs(pct).toFixed(1)}% ${t('technical.priceBelowEma')} (${formatPrice(priceLatest.ema21)})` })
    }
    if (priceLatest?.sma50 && priceLatest?.sma200) {
      if (priceLatest.sma50 > priceLatest.sma200) {
        result.push({ type: 'bullish', label: 'SMA', text: `SMA 50 (${formatPrice(priceLatest.sma50)}) ${t('technical.smaAbove')} (${formatPrice(priceLatest.sma200)}): ${t('technical.structureBullish')}` })
      } else {
        result.push({ type: 'bearish', label: 'SMA', text: `SMA 50 (${formatPrice(priceLatest.sma50)}) ${t('technical.smaBelow')} (${formatPrice(priceLatest.sma200)}): ${t('technical.structureBearish')}` })
      }
    }
    if (smaSignal) {
      result.push({
        type: smaSignal === 'bullish' ? 'bullish' : smaSignal === 'bearish' ? 'bearish' : 'neutral',
        label: 'SMA',
        text: smaSignal === 'bullish' ? t('technical.goldenCross') : smaSignal === 'bearish' ? t('technical.deathCross') : t('technical.smaConverging'),
      })
    }

    // ── Levels S/R ──
    if (levels.length && currentPrice) {
      const nearestSupport = levels.filter((l) => l.price <= currentPrice && l.strength >= 8).sort((a, b) => b.price - a.price)[0]
      const nearestResistance = levels.filter((l) => l.price > currentPrice && l.strength >= 8).sort((a, b) => a.price - b.price)[0]
      if (nearestSupport && nearestResistance) {
        const sDist = ((currentPrice - nearestSupport.price) / currentPrice * 100).toFixed(1)
        const rDist = ((nearestResistance.price - currentPrice) / currentPrice * 100).toFixed(1)
        result.push({
          type: 'neutral',
          label: t('technical.interpretation.levels'),
          text: `BTC entre soporte ${formatPrice(nearestSupport.price)} (${nearestSupport.strength}/20, ${sDist}% debajo) y resistencia ${formatPrice(nearestResistance.price)} (${nearestResistance.strength}/20, ${rDist}% arriba).`,
        })
      }
    }

    // ── Fibonacci ──
    if (fibLevels.length && currentPrice) {
      const fib = fibLevels[0]
      const fibEntries = Object.entries(fib.levels as Record<string, number>)
      const nearest = fibEntries
        .map(([ratio, price]) => ({ ratio, price, dist: Math.abs(price - currentPrice) / currentPrice * 100 }))
        .sort((a, b) => a.dist - b.dist)[0]
      if (nearest) {
        result.push({
          type: nearest.dist < 2 ? (currentPrice > nearest.price ? 'bullish' : 'bearish') : 'neutral',
          label: t('technical.interpretation.fibonacci'),
          text: `Fib ${nearest.ratio} en ${formatPrice(nearest.price)} (${nearest.dist.toFixed(1)}% de distancia). Swing ${formatPrice(fib.swing_low)} → ${formatPrice(fib.swing_high)} (${fib.timeframe}).`,
        })
      }
    }

    // ── Confluence ──
    if (confluenceZones.length && currentPrice) {
      const nearest = confluenceZones
        .map((z) => ({ ...z, dist: Math.abs(z.price_mid - currentPrice) / currentPrice * 100 }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2)
      for (const z of nearest) {
        const dir = z.price_mid < currentPrice ? 'soporte' : 'resistencia'
        result.push({
          type: z.dist < 3 ? (z.type === 'support' ? 'bullish' : 'bearish') : 'neutral',
          label: t('technical.interpretation.confluence'),
          text: `Confluencia ${dir} en ${formatPrice(z.price_low)}-${formatPrice(z.price_high)} (${z.num_timeframes} TFs, fuerza ${z.strength}/20, ${z.dist.toFixed(1)}% de distancia).`,
        })
      }
    }

    // ── Seasonality ──
    if (prices.length > 365) {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
      const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date))
      // Compute from monthly OHLC
      const monthlyData = new Map<string, { first: number; last: number }>()
      for (const p of sorted) {
        const key = p.date.substring(0, 7)
        const existing = monthlyData.get(key)
        if (!existing) monthlyData.set(key, { first: p.open || p.close, last: p.close })
        else existing.last = p.close
      }
      const monthRets = new Map<number, number[]>()
      for (const [key, val] of monthlyData) {
        const m = parseInt(key.split('-')[1])
        const ret = val.first > 0 ? ((val.last - val.first) / val.first) * 100 : 0
        if (!monthRets.has(m)) monthRets.set(m, [])
        monthRets.get(m)!.push(ret)
      }
      const avgForMonth = (m: number) => {
        const arr = monthRets.get(m) || []
        return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      }
      const currentAvg = avgForMonth(currentMonth)
      result.push({
        type: currentAvg > 3 ? 'bullish' : currentAvg < -3 ? 'bearish' : 'neutral',
        label: t('technical.interpretation.seasonality'),
        text: `${monthNames[currentMonth - 1]} tiene rendimiento medio historico de ${currentAvg > 0 ? '+' : ''}${currentAvg.toFixed(1)}%.`,
      })
    }

    return result
  }, [rsiLatest, macdLatest, lastCross, priceLatest, levels, fibLevels, confluenceZones, prices, smaSignal, t])

  if (!insights.length) return null

  return (
    <div className="rounded-xl bg-gradient-to-br from-accent-purple/10 to-accent-btc/10 border border-accent-purple/30 p-4 md:p-6 backdrop-blur-sm">
      <h3 className="font-display font-semibold mb-3">{t('common.interpretation')}</h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${insight.type === 'bullish' ? 'bg-bullish' : insight.type === 'bearish' ? 'bg-bearish' : 'bg-neutral-signal'}`} />
            <div>
              <span className="text-[10px] font-mono text-text-muted mr-1">[{insight.label}]</span>
              <span className="text-sm text-text-secondary">{insight.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
