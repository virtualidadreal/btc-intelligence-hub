import { useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus, Info, Target, ShieldAlert, Bitcoin, BarChart3, Layers, TrendingUp, Zap, Activity } from 'lucide-react'
import { SignalBadge } from '../components/common/MetricCard'
import SignalTimeline from '../components/trading/SignalTimeline'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import { usePriceChanges } from '../hooks/usePrices'
import { useLatestCycleScore } from '../hooks/useCycleScore'
import { useLatestSignals, useLatestIndicators, useTradingRecommendations, SIGNAL_LABELS } from '../hooks/useTechnical'
import type { TradingRecommendation, SignalDetail, TradingLevels, V2TradingData } from '../hooks/useTechnical'
import { useLatestSentiment } from '../hooks/useSentiment'
import { useSignalAccuracy, useSignalHistory } from '../hooks/useSignalHistory'
import { usePriceLevels, useFibonacciLevels, useConfluenceZones } from '../hooks/useLevels'
import { useSupabaseQuery, supabase } from '../hooks/useSupabase'
import type { OnchainMetric } from '../lib/types'
import { formatPrice, formatPercent, formatTimestamp, cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'

function signalExplanation(key: string, detail: SignalDetail, t: (k: string) => string): string {
  const label = SIGNAL_LABELS[key] || key
  const dir = detail.score > 0 ? t('trading.bullish') : detail.score < 0 ? t('trading.bearish') : t('trading.neutral')
  const val = detail.rawValue != null ? detail.rawValue.toFixed(1) : '?'

  switch (key) {
    case 'RSI_14':
      if (detail.score === 1) return `${label} en ${val} — ${t('sig.rsi.extremeBullish')}`
      if (detail.score === 0.5) return `${label} en ${val} — ${t('sig.rsi.bullish')}`
      if (detail.score === -0.5) return `${label} en ${val} — ${t('sig.rsi.bearish')}`
      if (detail.score === -1) return `${label} en ${val} — ${t('sig.rsi.extremeBearish')}`
      return `${label} en ${val} — ${t('sig.rsi.neutral')}`
    case 'MACD':
      if (detail.score > 0) return `${label} ${dir} — ${t('sig.macd.bullish')}`
      if (detail.score < 0) return `${label} ${dir} — ${t('sig.macd.bearish')}`
      return `${label} ${t('trading.neutral')} — ${t('sig.macd.neutral')}`
    case 'SMA_CROSS':
      if (detail.score > 0) return `${label} ${dir} — ${t('sig.sma.bullish')}`
      if (detail.score < 0) return `${label} ${dir} — ${t('sig.sma.bearish')}`
      return `${label} ${t('trading.neutral')} — ${t('sig.sma.neutral')}`
    case 'BB':
      if (detail.score > 0) return `Bollinger ${dir} — ${t('sig.bb.bullish')}`
      if (detail.score < 0) return `Bollinger ${dir} — ${t('sig.bb.bearish')}`
      return `Bollinger ${t('trading.neutral')} — ${t('sig.bb.neutral')}`
    case 'FEAR_GREED':
      if (detail.score === 1) return `Fear & Greed en ${val} — ${t('sig.fg.extremeBullish')}`
      if (detail.score === 0.5) return `Fear & Greed en ${val} — ${t('sig.fg.bullish')}`
      if (detail.score === -0.5) return `Fear & Greed en ${val} — ${t('sig.fg.bearish')}`
      if (detail.score === -1) return `Fear & Greed en ${val} — ${t('sig.fg.extremeBearish')}`
      return `Fear & Greed en ${val} — ${t('sig.fg.neutral')}`
    case 'HASH_RATE_MOM':
      if (detail.score > 0) return `Hash Rate momentum ${dir} — ${t('sig.hr.bullish')}`
      if (detail.score < 0) return `Hash Rate momentum ${dir} — ${t('sig.hr.bearish')}`
      return `${t('sig.hr.neutral')}`
    case 'NVT_RATIO':
      if (detail.score > 0) return `NVT Ratio ${dir} — ${t('sig.nvt.bullish')}`
      if (detail.score < 0) return `NVT Ratio ${dir} — ${t('sig.nvt.bearish')}`
      return `NVT Ratio ${t('trading.neutral')} — ${t('sig.nvt.neutral')}`
    case 'EMA_21':
      if (detail.score === 1) return `EMA 21 en ${formatPrice(Number(val))} — ${t('sig.ema.extremeBullish')}`
      if (detail.score === 0.5) return `EMA 21 en ${formatPrice(Number(val))} — ${t('sig.ema.bullish')}`
      if (detail.score === -0.5) return `EMA 21 en ${formatPrice(Number(val))} — ${t('sig.ema.bearish')}`
      if (detail.score === -1) return `EMA 21 en ${formatPrice(Number(val))} — ${t('sig.ema.extremeBearish')}`
      return `EMA 21 en ${formatPrice(Number(val))} — ${t('sig.ema.neutral')}`
    case 'CYCLE_SCORE':
      if (detail.score > 0) return `Cycle Score en ${val} — ${t('sig.cs.bullish')}`
      if (detail.score < 0) return `Cycle Score en ${val} — ${t('sig.cs.bearish')}`
      return `Cycle Score en ${val} — ${t('sig.cs.neutral')}`
    case 'FUNDING_RATE': {
      const pct = detail.rawValue != null ? (detail.rawValue * 100).toFixed(4) : '?'
      if (detail.score > 0) return `Funding Rate en ${pct}% — ${t('sig.fr.bullish')}`
      if (detail.score < 0) return `Funding Rate en ${pct}% — ${t('sig.fr.bearish')}`
      return `Funding Rate en ${pct}% — ${t('sig.fr.neutral')}`
    }
    case 'OPEN_INTEREST':
      if (detail.score > 0) return `Open Interest — ${t('sig.oi.bullish')}`
      if (detail.score < 0) return `Open Interest — ${t('sig.oi.bearish')}`
      return `Open Interest — ${t('sig.oi.neutral')}`
    default:
      return `${label}: ${val} (${dir})`
  }
}

function directionColor(dir: string) {
  if (dir === 'LONG') return 'text-bullish'
  if (dir === 'SHORT') return 'text-bearish'
  return 'text-neutral-signal'
}

function directionBg(dir: string) {
  if (dir === 'LONG') return 'bg-bullish/10 border-bullish/20'
  if (dir === 'SHORT') return 'bg-bearish/10 border-bearish/20'
  return 'bg-neutral-signal/10 border-neutral-signal/20'
}

function classificationColor(cls: string) {
  switch (cls) {
    case 'PREMIUM': return 'text-yellow-400'
    case 'STRONG': return 'text-green-400'
    case 'VALID': return 'text-blue-400'
    case 'WEAK': return 'text-orange-400'
    case 'NO ENTRY': return 'text-red-400'
    default: return 'text-text-muted'
  }
}

function classifyScore(score: number): string {
  if (score >= 85) return 'PREMIUM'
  if (score >= 70) return 'STRONG'
  if (score >= 55) return 'VALID'
  if (score >= 40) return 'WEAK'
  return 'NO ENTRY'
}

function classificationBg(cls: string) {
  switch (cls) {
    case 'PREMIUM': return 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
    case 'STRONG': return 'bg-green-400/15 border-green-400/30 text-green-400'
    case 'VALID': return 'bg-blue-400/15 border-blue-400/30 text-blue-400'
    case 'WEAK': return 'bg-orange-400/15 border-orange-400/30 text-orange-400'
    case 'NO ENTRY': return 'bg-red-400/15 border-red-400/30 text-red-400'
    default: return 'bg-bg-tertiary border-border text-text-muted'
  }
}

function StructuralAnalysis({ price, direction, rec, v2Data, htfDirection, t }: {
  price: number; direction: string; rec: TradingRecommendation; v2Data: V2TradingData; htfDirection: string | null; t: (k: string) => string
}) {
  const levels = v2Data.priceLevels ?? []
  const confluences = v2Data.confluences ?? []
  const ema21 = rec.signals['EMA_21']?.rawValue ?? null
  const fearGreed = rec.signals['FEAR_GREED']?.rawValue ?? null

  type Item = { icon: string; text: string; color: string }
  const levelItems: Item[] = []
  const penaltyItems: Item[] = []

  // --- Level analysis ---
  const near1pct = levels.filter(lv => Math.abs(price - lv.price) / (lv.price || 1) * 100 <= 1.0)

  if (near1pct.some(lv => lv.strength >= 10)) {
    const lv = near1pct.find(lv => lv.strength >= 10)!
    levelItems.push({ icon: '✓', text: `${t('trading.strongLevel')} ${formatPrice(lv.price)} (str ${lv.strength}) → +8`, color: 'text-green-400' })
  } else {
    const sorted = [...levels].sort((a, b) => Math.abs(price - a.price) - Math.abs(price - b.price))
    if (sorted.length > 0) {
      const n = sorted[0]
      const d = ((n.price - price) / price * 100)
      levelItems.push({ icon: '✗', text: `${t('trading.nearestLevel')}: ${formatPrice(n.price)} (str ${n.strength}) a ${Math.abs(d).toFixed(1)}% — ${t('trading.outOfRange')} (1%)`, color: 'text-red-400/70' })
    } else {
      levelItems.push({ icon: '—', text: t('trading.noLevelsAvailable'), color: 'text-text-muted' })
    }
  }

  if (near1pct.some(lv => lv.is_role_flip)) levelItems.push({ icon: '✓', text: `Role flip → +4`, color: 'text-green-400' })
  if (near1pct.some(lv => lv.is_psychological)) levelItems.push({ icon: '✓', text: `${t('trading.psychLevel')} → +1`, color: 'text-green-400' })

  // --- Confluence (kept without Fibonacci) ---
  const nearConf = confluences.filter(c => Math.abs(price - c.price_mid) / (c.price_mid || 1) * 100 <= 1.0 && c.num_timeframes >= 2)
  if (nearConf.length > 0) {
    levelItems.push({ icon: '✓', text: `${t('trading.confluenceZone')} ${formatPrice(nearConf[0].price_mid)} (${nearConf[0].num_timeframes} TF) → +6`, color: 'text-green-400' })
  } else if (confluences.length > 0) {
    const nc = [...confluences].sort((a, b) => Math.abs(price - a.price_mid) - Math.abs(price - b.price_mid))[0]
    levelItems.push({ icon: '✗', text: `${t('trading.nearestConfluence')}: ${formatPrice(nc.price_mid)} (${nc.num_timeframes} TF) a ${(Math.abs(price - nc.price_mid) / (nc.price_mid || 1) * 100).toFixed(1)}%`, color: 'text-red-400/70' })
  }

  // --- Penalty reasons ---
  const strong2pct = levels.filter(lv => lv.strength >= 6 && Math.abs(price - lv.price) / (lv.price || 1) * 100 <= 2.0)
  if (strong2pct.length === 0) penaltyItems.push({ icon: '✗', text: `${t('trading.penNoLevels')}: -5`, color: 'text-red-400' })
  if (htfDirection && htfDirection !== direction && htfDirection !== 'NEUTRAL') penaltyItems.push({ icon: '✗', text: `${t('trading.penAgainstHTF')} (${htfDirection}): -8`, color: 'text-red-400' })
  if (ema21 && ema21 > 0) {
    const dp = Math.abs(price - ema21) / ema21 * 100
    if (dp > 5) penaltyItems.push({ icon: '✗', text: `${t('trading.penOverextended')} (${dp.toFixed(1)}%): -5`, color: 'text-red-400' })
  }
  if (fearGreed != null) {
    if (direction === 'LONG' && fearGreed > 85) penaltyItems.push({ icon: '✗', text: `Long en ${t('trading.penEuphoria')} (F&G: ${fearGreed}): -5`, color: 'text-red-400' })
    if (direction === 'SHORT' && fearGreed < 15) penaltyItems.push({ icon: '✗', text: `Short en ${t('trading.penExtremeFear')} (F&G: ${fearGreed}): -5`, color: 'text-red-400' })
  }

  return (
    <div className="mt-3 space-y-2.5 text-[10px]">
      <div>
        <span className="font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1 mb-1">
          <Layers className="w-3 h-3" /> {t('trading.srLevels')}
        </span>
        {levelItems.map((it, i) => (
          <p key={i} className="text-text-secondary leading-relaxed flex items-start gap-1.5 ml-4">
            <span className={cn('font-mono font-bold shrink-0', it.color)}>{it.icon}</span> {it.text}
          </p>
        ))}
      </div>
      {penaltyItems.length > 0 && (
        <div>
          <span className="font-semibold text-red-400/80 uppercase tracking-wider flex items-center gap-1 mb-1">
            <ShieldAlert className="w-3 h-3" /> {t('trading.penaltyReasons')}
          </span>
          {penaltyItems.map((it, i) => (
            <p key={i} className="text-red-400/70 leading-relaxed flex items-start gap-1.5 ml-4">
              <span className="font-mono font-bold shrink-0">{it.icon}</span> {it.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  if (direction === 'LONG') return <ArrowUp className={className || 'w-5 h-5'} />
  if (direction === 'SHORT') return <ArrowDown className={className || 'w-5 h-5'} />
  return <Minus className={className || 'w-5 h-5'} />
}

function ContributionBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0
  const color = value > 0 ? 'bg-bullish' : value < 0 ? 'bg-bearish' : 'bg-neutral-signal'

  return (
    <div className="w-full flex items-center gap-1">
      <div className="flex w-1/2 justify-end">
        {value < 0 && <div className={cn(color, 'h-2 rounded-l')} style={{ width: `${pct}%` }} />}
      </div>
      <div className="w-px h-3 bg-border flex-shrink-0" />
      <div className="flex w-1/2 justify-start">
        {value > 0 && <div className={cn(color, 'h-2 rounded-r')} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  )
}

function LevelsPanel({ levels, direction, t }: { levels: TradingLevels; direction: string; t: (k: string) => string }) {
  const isLong = direction === 'LONG'

  return (
    <div className="rounded-lg border border-border bg-bg-primary/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-accent-btc" />
        <span className="text-xs font-display font-semibold text-text-secondary">{t('trading.operationLevels')}</span>
      </div>

      {/* Visual price ladder */}
      <div className="flex flex-col gap-1.5 mb-4">
        {isLong ? (
          <>
            <LevelRow label="TP2" price={levels.tp2} pct={`+${levels.tp2Percent}%`} color="text-bullish" bg="bg-bullish/10" rr={`R:R ${levels.riskReward2}`} />
            <LevelRow label="TP1" price={levels.tp1} pct={`+${levels.tp1Percent}%`} color="text-bullish" bg="bg-bullish/5" rr={`R:R ${levels.riskReward1}`} />
            <LevelRow label="ENTRY" price={levels.entry} pct="" color="text-accent-btc" bg="bg-accent-btc/10" />
            <LevelRow label="SL" price={levels.sl} pct={`${levels.slPercent}%`} color="text-bearish" bg="bg-bearish/10" />
          </>
        ) : (
          <>
            <LevelRow label="SL" price={levels.sl} pct={`${levels.slPercent}%`} color="text-bearish" bg="bg-bearish/10" />
            <LevelRow label="ENTRY" price={levels.entry} pct="" color="text-accent-btc" bg="bg-accent-btc/10" />
            <LevelRow label="TP1" price={levels.tp1} pct={`+${levels.tp1Percent}%`} color="text-bullish" bg="bg-bullish/5" rr={`R:R ${levels.riskReward1}`} />
            <LevelRow label="TP2" price={levels.tp2} pct={`+${levels.tp2Percent}%`} color="text-bullish" bg="bg-bullish/10" rr={`R:R ${levels.riskReward2}`} />
          </>
        )}
      </div>

      {/* Method explanation */}
      <div className="text-[10px] text-text-muted leading-relaxed space-y-0.5">
        <p className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> {t('trading.calcBased')} {levels.method}</p>
        <p>{t('trading.slAdjusted')}</p>
      </div>
    </div>
  )
}

function LevelRow({ label, price, pct, color, bg, rr }: { label: string; price: number; pct: string; color: string; bg: string; rr?: string }) {
  return (
    <div className={cn('flex items-center justify-between rounded-lg px-3 py-2', bg)}>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-mono font-bold w-12', color)}>{label}</span>
        <span className="font-mono text-sm font-bold">{formatPrice(price)}</span>
      </div>
      <div className="flex items-center gap-2">
        {pct && <span className={cn('text-xs font-mono', color)}>{pct}</span>}
        {rr && <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{rr}</span>}
      </div>
    </div>
  )
}

function generateThesis(rec: TradingRecommendation, price: number, t: (k: string) => string): { why: string; entries: string[]; risks: string[] } {
  const entries = Object.entries(rec.signals).sort((a, b) => Math.abs(b[1].contribution) - Math.abs(a[1].contribution))
  const bullish = entries.filter(([, d]) => d.score > 0)
  const bearish = entries.filter(([, d]) => d.score < 0)
  const dir = rec.direction

  // Build WHY paragraph
  const whyParts: string[] = []

  if (dir === 'NEUTRAL') {
    whyParts.push(`${t('trading.mixedSignals')} ${rec.bullishCount} ${t('trading.bullishIndicators')} ${rec.bearishCount} ${t('trading.bearishIndicators')}`)
    whyParts.push(`${t('trading.noClearBias')} ${rec.score.toFixed(3)}.`)
    whyParts.push(t('trading.stayOut'))
  } else {
    const isLong = dir === 'LONG'
    const mainSignals = isLong ? bullish : bearish
    const counterSignals = isLong ? bearish : bullish

    whyParts.push(`${rec.bullishCount + rec.bearishCount + rec.neutralCount} ${t('trading.indicatorsAnalyzed')} ${rec.bullishCount} ${t('trading.bullish')}, ${rec.bearishCount} ${t('trading.bearish')}, ${rec.neutralCount} ${t('trading.neutral')}.`)

    // Main driver
    if (mainSignals.length > 0) {
      const [topKey, topDetail] = mainSignals[0]
      const topLabel = SIGNAL_LABELS[topKey] || topKey
      whyParts.push(`${t('trading.mainSignal')} ${topLabel} (${topDetail.signal}, peso ${(topDetail.weight * 100).toFixed(0)}%) ${t('trading.contributes')} ${topDetail.contribution > 0 ? '+' : ''}${topDetail.contribution.toFixed(3)} ${t('trading.toScore')}`)
    }

    // RSI context
    const rsi = rec.signals['RSI_14']
    if (rsi) {
      if (rsi.rawValue != null && rsi.rawValue < 30) whyParts.push(`RSI en ${rsi.rawValue.toFixed(1)} ${t('trading.rsiOversold')}`)
      else if (rsi.rawValue != null && rsi.rawValue > 70) whyParts.push(`RSI en ${rsi.rawValue.toFixed(1)} ${t('trading.rsiOverbought')}`)
    }

    // EMA context
    const ema = rec.signals['EMA_21']
    if (ema && ema.rawValue != null) {
      const pctFromEma = ((price - ema.rawValue) / ema.rawValue) * 100
      if (isLong && pctFromEma > 0) whyParts.push(`${t('trading.currentPrice')} ${pctFromEma.toFixed(1)}% ${t('trading.priceAboveEma')} (${formatPrice(ema.rawValue)}) ${t('trading.emaSupportActive')}`)
      else if (isLong && pctFromEma < 0) whyParts.push(`${t('trading.currentPrice')} ${Math.abs(pctFromEma).toFixed(1)}% ${t('trading.priceBelowEma')} (${formatPrice(ema.rawValue)}) ${t('trading.emaResistance')}`)
      else if (!isLong && pctFromEma < 0) whyParts.push(`${t('trading.currentPrice')} ${Math.abs(pctFromEma).toFixed(1)}% ${t('trading.priceBelowEma')} (${formatPrice(ema.rawValue)}) ${t('trading.emaResistanceBearish')}`)
      else if (!isLong && pctFromEma > 0) whyParts.push(`${t('trading.currentPrice')} ${pctFromEma.toFixed(1)}% ${t('trading.priceAboveEma')} (${formatPrice(ema.rawValue)}) ${t('trading.emaSupportBreak')}`)
    }

    // Cycle context
    const cs = rec.signals['CYCLE_SCORE']
    if (cs && cs.rawValue != null) {
      if (cs.rawValue < 30) whyParts.push(`Cycle Score en ${cs.rawValue.toFixed(0)} ${t('trading.csAccumulation')}`)
      else if (cs.rawValue > 70) whyParts.push(`Cycle Score en ${cs.rawValue.toFixed(0)} ${t('trading.csDistribution')}`)
    }

    // Counter signals
    if (counterSignals.length > 0) {
      const counterNames = counterSignals.map(([k]) => SIGNAL_LABELS[k] || k).join(', ')
      whyParts.push(`${t('trading.counterSignals')} ${counterNames} (${counterSignals.length}/${entries.length}).`)
    }
  }

  // WHEN TO ENTER
  const entryConditions: string[] = []

  if (dir !== 'NEUTRAL') {
    const isLong = dir === 'LONG'
    const ema = rec.signals['EMA_21']
    const rsi = rec.signals['RSI_14']

    // Aggressive entry
    if (rec.confidence >= 65) {
      entryConditions.push(`${t('trading.entryAggressive')} (${formatPrice(price)}) ${t('trading.highConfidence')} (${rec.confidence}%), ${t('trading.signalClear')}`)
    } else if (rec.confidence >= 40) {
      entryConditions.push(`${t('trading.entryModerate')} (${formatPrice(price)}) ${t('trading.mediumConfidence')} (${rec.confidence}%), ${t('trading.reducedSize')}`)
    } else {
      entryConditions.push(`${t('trading.weakSignal')} (${rec.confidence}% ${t('trading.confidence')}) ${t('trading.waitConfirmation')}`)
    }

    // EMA-based entry
    if (ema && ema.rawValue != null) {
      const pctFromEma = ((price - ema.rawValue) / ema.rawValue) * 100
      if (isLong && pctFromEma < 0) {
        entryConditions.push(`${t('trading.conservativeBreakAbove')} (${formatPrice(ema.rawValue)}) ${t('trading.asBullishConfirmation')}`)
      } else if (isLong && pctFromEma > 0 && pctFromEma < 3) {
        entryConditions.push(`EMA 21 (${formatPrice(ema.rawValue)}) ${t('trading.emaSupportNear')}`)
      } else if (!isLong && pctFromEma > 0) {
        entryConditions.push(`${t('trading.conservativeBreakBelow')} (${formatPrice(ema.rawValue)}) ${t('trading.asBearishConfirmation')}`)
      } else if (!isLong && pctFromEma < 0 && pctFromEma > -3) {
        entryConditions.push(`EMA 21 (${formatPrice(ema.rawValue)}) ${t('trading.emaResistanceNear')}`)
      }
    }

    // RSI-based timing
    if (rsi && rsi.rawValue != null) {
      if (isLong && rsi.rawValue < 25) {
        entryConditions.push(t('trading.rsiExtremeOversold'))
      } else if (!isLong && rsi.rawValue > 75) {
        entryConditions.push(t('trading.rsiExtremeOverbought'))
      }
    }

    // Levels-based
    if (rec.levels) {
      entryConditions.push(`Stop Loss en ${formatPrice(rec.levels.sl)} (${rec.levels.slPercent}%) ${t('trading.slInvalidates')}`)
    }
  }

  // RISKS
  const riskFactors: string[] = []
  const fg = rec.signals['FEAR_GREED']
  if (fg) {
    if (fg.rawValue != null && fg.rawValue <= 20) riskFactors.push(t('trading.fgExtremeFear'))
    else if (fg.rawValue != null && fg.rawValue >= 80) riskFactors.push(t('trading.fgExtremeGreed'))
  }

  const hr = rec.signals['HASH_RATE_MOM']
  if (hr && hr.score < 0) riskFactors.push(t('trading.hrDecline'))

  const nvt = rec.signals['NVT_RATIO']
  if (nvt && nvt.score < 0) riskFactors.push(t('trading.nvtHigh'))

  if (rec.confidence < 50) riskFactors.push(`${t('trading.lowConfidence')} (${rec.confidence}%) ${t('trading.ambiguousSignals')}`)

  const counterCount = dir === 'LONG' ? rec.bearishCount : dir === 'SHORT' ? rec.bullishCount : 0
  if (counterCount >= 3) riskFactors.push(`${counterCount} ${t('trading.counterIndicators')}`)

  if (riskFactors.length === 0) riskFactors.push(t('trading.noRisks'))

  return { why: whyParts.join(' '), entries: entryConditions, risks: riskFactors }
}

function TradingThesis({ rec, price, t }: { rec: TradingRecommendation; price: number; t: (k: string) => string }) {
  const thesis = generateThesis(rec, price, t)

  return (
    <div className="p-4 border-b border-border/50 bg-gradient-to-br from-accent-btc/5 to-transparent">
      <h4 className="text-xs font-display font-semibold text-accent-btc mb-3 flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5" /> {t('trading.thesis')}
      </h4>

      <div className="space-y-3">
        {/* Why */}
        <div>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            {t('trading.why')} {rec.direction}?
          </span>
          <p className="text-xs text-text-secondary leading-relaxed mt-1">{thesis.why}</p>
        </div>

        {/* When */}
        {thesis.entries.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              {t('trading.when')}
            </span>
            <ul className="mt-1 space-y-1">
              {thesis.entries.map((e, i) => (
                <li key={i} className="text-xs text-text-secondary leading-relaxed flex items-start gap-1.5">
                  <span className="text-accent-btc mt-0.5 shrink-0">›</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        <div>
          <span className="text-[10px] font-semibold text-bearish/80 uppercase tracking-wider">
            {t('trading.risks')}
          </span>
          <ul className="mt-1 space-y-1">
            {thesis.risks.map((r, i) => (
              <li key={i} className="text-xs text-text-secondary leading-relaxed flex items-start gap-1.5">
                <span className="text-bearish mt-0.5 shrink-0">!</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function TimeframeDetail({ rec, price, t, v2Data, htfDirection }: { rec: TradingRecommendation; price: number; t: (k: string) => string; v2Data?: V2TradingData; htfDirection?: string | null }) {
  const entries = Object.entries(rec.signals).sort((a, b) => Math.abs(b[1].contribution) - Math.abs(a[1].contribution))
  const maxAbs = entries.reduce((max, [, d]) => Math.max(max, Math.abs(d.contribution)), 0)
  const totalSignals = rec.bullishCount + rec.bearishCount + rec.neutralCount
  const v2Signal = v2Data?.latestV2Signals?.find(s => s.timeframe === rec.timeframe)

  // Use backend values from signal_history when available (single source of truth)
  const displayScore = v2Signal?.confidence ?? rec.confidence
  const displayClassification = v2Signal?.classification || rec.classification
  const displayConfidence = v2Signal?.confidence ?? rec.confidence
  const displayBonusLevels = v2Signal?.level_score ?? rec.bonusLevels
  const displayBonusCandles = v2Signal?.candle_score ?? rec.bonusCandles
  const displayBonusOnchain = v2Signal?.onchain_bonus ?? rec.bonusOnchain
  const displayPenalties = v2Signal?.penalties ?? rec.penalties

  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className={cn('flex items-center justify-between p-4 border-b border-border', directionBg(rec.direction))}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className={cn('flex items-center gap-1.5 font-bold text-xl', directionColor(rec.direction))}>
              <DirectionIcon direction={rec.direction} className="w-6 h-6" />
              <span>{rec.direction}</span>
            </div>
            <span className="text-xs font-mono text-text-muted bg-bg-tertiary/60 px-2 py-0.5 rounded">{rec.timeframe}</span>
            <span className="text-xs text-text-secondary hidden sm:block">{t(`trading.${rec.timeframe}`)}</span>
          </div>
          {v2Signal?.date && (
            <span className="text-[10px] font-mono text-text-muted">{formatTimestamp(v2Signal.date)}</span>
          )}
        </div>
        <div className="text-right">
          <span className={cn('font-mono text-lg font-bold', directionColor(rec.direction))}>{displayScore}%</span>
          <div className="flex items-center gap-1.5 justify-end mt-0.5">
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', classificationBg(displayClassification))}>
              {displayClassification}
            </span>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center gap-3 text-xs">
        <span className="text-text-muted">{t('trading.score')}</span>
        <span className={cn('font-mono font-bold', directionColor(rec.direction))}>{rec.score >= 0 ? '+' : ''}{rec.score.toFixed(3)}</span>
        <span className="text-text-muted ml-auto">{totalSignals} {t('trading.signals')}</span>
        {rec.bullishCount > 0 && <span className="text-bullish font-mono">{rec.bullishCount} {t('trading.bullish')}</span>}
        {rec.bearishCount > 0 && <span className="text-bearish font-mono">{rec.bearishCount} {t('trading.bearish')}</span>}
        {rec.neutralCount > 0 && <span className="text-neutral-signal font-mono">{rec.neutralCount} {t('trading.neutral')}</span>}
      </div>

      {/* v2: Extended Score Breakdown */}
      {rec.direction !== 'NEUTRAL' && (
        <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-accent-btc/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-accent-btc" />
            <span className="text-[10px] font-display font-semibold text-text-secondary uppercase tracking-wider">{t('trading.extendedScore')}</span>
          </div>

          {/* Score breakdown bar */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono flex-wrap mb-2">
            <span className="text-text-muted">{t('trading.baseScore')}: {displayConfidence}</span>
            {displayBonusLevels > 0 && <span className="text-green-400">+{displayBonusLevels} {t('trading.bonusLevels')}</span>}
            {displayBonusCandles > 0 && <span className="text-blue-400">+{displayBonusCandles} {t('trading.bonusCandles')}</span>}
            {displayBonusOnchain > 0 && <span className="text-purple-400">+{displayBonusOnchain} {t('trading.bonusOnchain')}</span>}
            {displayPenalties < 0 && <span className="text-red-400">{displayPenalties} {t('trading.penaltiesLabel')}</span>}
            <span className="text-text-muted">=</span>
            <span className={cn('font-bold', classificationColor(displayClassification))}>{displayScore}%</span>
          </div>

          {/* Structural Analysis */}
          {v2Data && (
            <StructuralAnalysis price={price} direction={rec.direction} rec={rec} v2Data={v2Data} htfDirection={htfDirection ?? null} t={t} />
          )}

          {/* Setup type and candle pattern badges */}
          <div className="flex gap-2 flex-wrap mt-2">
            {rec.setupType && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent-btc/15 text-accent-btc border border-accent-btc/30 font-semibold flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" />
                {rec.setupType}
              </span>
            )}
            {rec.candlePattern && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/15 text-purple-400 border border-purple-400/30 font-semibold flex items-center gap-1">
                <Activity className="w-2.5 h-2.5" />
                {rec.candlePattern.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Trading Thesis */}
      <TradingThesis rec={rec} price={price} t={t} />

      {/* TP/SL Levels */}
      {rec.levels && (
        <div className="p-4 border-b border-border/50">
          <LevelsPanel levels={rec.levels} direction={rec.direction} t={t} />
        </div>
      )}

      {/* Signal table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-text-muted uppercase border-b border-border/50">
              <th className="text-left py-2 px-4">{t('trading.indicator')}</th>
              <th className="text-right py-2 px-2">{t('trading.value')}</th>
              <th className="text-center py-2 px-2">{t('trading.signal')}</th>
              <th className="text-right py-2 px-2">{t('trading.weight')}</th>
              <th className="text-center py-2 px-2 w-28 hidden sm:table-cell">{t('trading.impact')}</th>
              <th className="text-right py-2 px-4">{t('trading.contrib')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, detail]) => (
              <tr key={key} className="border-b border-border/30 hover:bg-bg-tertiary/20">
                <td className="py-2 px-4 font-mono text-xs">{SIGNAL_LABELS[key] || key}</td>
                <td className="py-2 px-2 text-right font-mono text-xs text-text-secondary">
                  {detail.rawValue != null ? detail.rawValue.toFixed(1) : '—'}
                </td>
                <td className="py-2 px-2 text-center">
                  <SignalBadge signal={detail.signal} />
                </td>
                <td className="py-2 px-2 text-right font-mono text-xs text-text-muted">
                  {(detail.weight * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-2 hidden sm:table-cell">
                  <ContributionBar value={detail.contribution} maxAbs={maxAbs} />
                </td>
                <td className={cn('py-2 px-4 text-right font-mono text-xs font-bold', detail.contribution > 0 ? 'text-bullish' : detail.contribution < 0 ? 'text-bearish' : 'text-text-muted')}>
                  {detail.contribution >= 0 ? '+' : ''}{detail.contribution.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explanations */}
      <div className="p-4 space-y-1.5 border-t border-border/50 bg-bg-tertiary/20">
        <div className="flex items-center gap-1.5 mb-2">
          <Info className="w-3.5 h-3.5 text-accent-btc" />
          <span className="text-xs font-display font-semibold text-text-secondary">{t('trading.reasoning')}</span>
        </div>
        {entries.map(([key, detail]) => (
          <p key={key} className="text-xs text-text-secondary leading-relaxed">
            <span className={cn('font-mono font-semibold', detail.score > 0 ? 'text-bullish' : detail.score < 0 ? 'text-bearish' : 'text-neutral-signal')}>
              {detail.score > 0 ? '+' : detail.score < 0 ? '-' : '~'}
            </span>
            {' '}
            {signalExplanation(key, detail, t)}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function Trading() {
  const { t, ta } = useI18n()
  const { data: prices, loading: priceLoading } = usePriceChanges()
  const { data: cycleScore } = useLatestCycleScore()
  const { data: signals } = useLatestSignals()
  const { data: allIndicators } = useLatestIndicators()
  const { data: sentiment } = useLatestSentiment()
  const { stats: signalStats } = useSignalAccuracy()
  const { data: priceLevels } = usePriceLevels(5)

  const { data: onchainRaw } = useSupabaseQuery<OnchainMetric[]>(
    () =>
      supabase
        .from('onchain_metrics')
        .select('*')
        .in('metric', ['HASH_RATE_MOM', 'NVT_RATIO'])
        .order('date', { ascending: false })
        .limit(4),
    [],
    'onchain-trading-signals',
  )

  const onchainMetrics = useMemo(() => {
    const hashRate = onchainRaw?.find((m) => m.metric === 'HASH_RATE_MOM') ?? null
    const nvt = onchainRaw?.find((m) => m.metric === 'NVT_RATIO') ?? null
    return { hashRate, nvt }
  }, [onchainRaw])

  // v2: Derivatives data (funding rate, open interest)
  const { data: derivativesRaw } = useSupabaseQuery<OnchainMetric[]>(
    () =>
      supabase
        .from('onchain_metrics')
        .select('*')
        .in('metric', ['FUNDING_RATE', 'OPEN_INTEREST'])
        .order('date', { ascending: false })
        .limit(4),
    [],
    'derivatives-trading-signals',
  )

  const fundingRate = useMemo(() => derivativesRaw?.find(m => m.metric === 'FUNDING_RATE') ?? null, [derivativesRaw])
  const openInterest = useMemo(() => derivativesRaw?.find(m => m.metric === 'OPEN_INTEREST') ?? null, [derivativesRaw])

  // v2: Fibonacci levels and confluence zones
  const { data: fibLevels } = useFibonacciLevels()
  const { data: confluences } = useConfluenceZones()

  // v2: Latest signal history (for candle patterns, setup type)
  const { data: signalHistoryRaw } = useSignalHistory(50)
  const latestV2Signals = useMemo(() => {
    if (!signalHistoryRaw) return null
    const byTf = new Map<string, typeof signalHistoryRaw[0]>()
    for (const s of signalHistoryRaw) {
      if (!byTf.has(s.timeframe)) byTf.set(s.timeframe, s)
    }
    return Array.from(byTf.values())
  }, [signalHistoryRaw])

  // v2: Compose v2 data object
  const v2Data: V2TradingData = useMemo(() => ({
    fundingRate,
    openInterest,
    priceLevels: priceLevels ?? null,
    fibLevels: fibLevels ?? null,
    confluences: confluences ?? null,
    latestV2Signals,
  }), [fundingRate, openInterest, priceLevels, fibLevels, confluences, latestV2Signals])

  const bbIndicators = useMemo(() => {
    if (!allIndicators) return null
    return allIndicators.filter((i) => i.indicator.startsWith('BB_'))
  }, [allIndicators])

  const currentPrice = useMemo(() => {
    if (!prices || prices.length === 0) return null
    return prices[0].close
  }, [prices])

  const recommendations = useTradingRecommendations(signals, bbIndicators, sentiment, onchainMetrics, cycleScore, currentPrice, allIndicators, v2Data)

  if (priceLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('trading.title')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!currentPrice) return <div className="p-6"><EmptyState command="btc-intel update-data" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('trading.title')} subtitle={t('trading.subtitle')}>
        <HelpButton
          title={t('trading.title')}
          content={ta('trading')}
        />
      </PageHeader>

      {/* Current price reference */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm flex items-center gap-3">
        <Bitcoin className="w-5 h-5 text-accent-btc" />
        <span className="text-sm text-text-secondary">{t('trading.currentPrice')}</span>
        <span className="font-mono text-lg font-bold">{formatPrice(currentPrice)}</span>
        {prices && prices.length > 1 && (
          <span className={cn('text-sm font-mono', prices[0].close >= prices[1].close ? 'text-bullish' : 'text-bearish')}>
            {formatPercent(((prices[0].close - prices[1].close) / prices[1].close) * 100)}
          </span>
        )}
      </div>

      {/* Classification legend */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-3 backdrop-blur-sm">
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono justify-center">
          <span className="text-text-muted mr-1">{t('trading.signalQuality')}:</span>
          <span className="text-yellow-400 font-bold">PREMIUM <span className="text-text-muted font-normal">&ge;85%</span></span>
          <span className="text-green-400 font-bold">STRONG <span className="text-text-muted font-normal">&ge;70%</span></span>
          <span className="text-blue-400 font-bold">VALID <span className="text-text-muted font-normal">&ge;55%</span></span>
          <span className="text-orange-400 font-bold">WEAK <span className="text-text-muted font-normal">&ge;40%</span></span>
          <span className="text-red-400 font-bold">NO ENTRY <span className="text-text-muted font-normal">&lt;40%</span></span>
        </div>
      </div>

      {/* Summary cards — driven by signal_history (single source of truth) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['1H', '4H', '1D', '1W'] as const).map((tf) => {
          const sig = latestV2Signals?.find(s => s.timeframe === tf)
          const tfLabels: Record<string, string> = { '1H': t('trading.1H'), '4H': t('trading.4H'), '1D': t('trading.1D'), '1W': t('trading.1W') }

          if (!sig) {
            return (
              <div key={tf} className="rounded-xl border border-border/50 p-4 backdrop-blur-sm bg-bg-secondary/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono text-text-muted">{tf}</span>
                  <span className="text-[10px] text-text-muted">{tfLabels[tf]}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-text-muted text-lg font-bold py-3">
                  <Minus className="w-5 h-5" />
                  <span>{t('trading.noSignal') || 'NO SIGNAL'}</span>
                </div>
                <div className="text-center text-[10px] text-text-muted">{t('trading.waitingSignal') || 'Waiting for valid signal'}</div>
              </div>
            )
          }

          const direction = sig.direction
          const extScore = sig.confidence ?? sig.extended_score
          const cls = sig.classification || classifyScore(extScore)
          const priceAt = sig.price_at_signal

          return (
            <div key={tf} className={cn('rounded-xl border p-4 backdrop-blur-sm', directionBg(direction))}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-mono text-text-muted">{tf}</span>
                <span className="text-[10px] text-text-muted">{tfLabels[tf]}</span>
              </div>
              {sig.date && (
                <div className="text-[10px] text-text-muted font-mono text-center mb-1">{formatTimestamp(sig.date)}</div>
              )}
              <div className={cn('flex items-center justify-center gap-1.5 font-bold text-2xl mb-1', directionColor(direction))}>
                <DirectionIcon direction={direction} className="w-7 h-7" />
                <span>{direction}</span>
              </div>
              <div className="text-center">
                <span className={cn('text-lg font-mono font-bold', directionColor(direction))}>{extScore}%</span>
                <div className={cn('text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded border inline-block', classificationBg(cls))}>
                  {cls}
                </div>
              </div>
              {sig.tp1 && sig.tp2 && sig.sl && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-bullish">TP2</span>
                    <span>{formatPrice(sig.tp2)}</span>
                    <span className="text-bullish">+{(Math.abs(sig.tp2 - priceAt) / priceAt * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bullish">TP1</span>
                    <span>{formatPrice(sig.tp1)}</span>
                    <span className="text-bullish">+{(Math.abs(sig.tp1 - priceAt) / priceAt * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bearish">SL</span>
                    <span>{formatPrice(sig.sl)}</span>
                    <span className="text-bearish">-{(Math.abs(sig.sl - priceAt) / priceAt * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
              {priceAt && currentPrice && (
                <div className="text-center mt-2 text-[10px] font-mono text-text-muted">
                  Entry: {formatPrice(priceAt)}
                  {' '}
                  <span className={cn(currentPrice >= priceAt ? 'text-bullish' : 'text-bearish')}>
                    ({((currentPrice - priceAt) / priceAt * 100) >= 0 ? '+' : ''}{((currentPrice - priceAt) / priceAt * 100).toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Active signals chips */}
      {signals && signals.length > 0 && (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
          <h3 className="text-xs font-display font-semibold text-text-secondary mb-2">{t('trading.activeSignals')}</h3>
          <div className="flex flex-wrap gap-2">
            {signals.map((s) => (
              <div key={s.indicator} className="flex items-center gap-2 bg-bg-tertiary/50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-mono text-text-secondary">{s.indicator}</span>
                <span className="text-xs font-mono text-text-muted">{s.value != null ? s.value.toFixed(1) : ''}</span>
                {s.signal && <SignalBadge signal={s.signal} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed breakdown per timeframe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recommendations.map((rec) => {
          const htfMap: Record<string, string> = { '1H': '4H', '4H': '1D', '1D': '1W' }
          const htfTf = htfMap[rec.timeframe]
          const htfDir = htfTf ? recommendations.find(r => r.timeframe === htfTf)?.direction ?? null : null
          return <TimeframeDetail key={rec.timeframe} rec={rec} price={currentPrice} t={t} v2Data={v2Data} htfDirection={htfDir} />
        })}
      </div>

      {/* Signal Accuracy */}
      {signalStats && signalStats.overall.total > 0 && (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
          <h3 className="text-xs font-display font-semibold text-text-secondary mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-btc" />
            {t('trading.signalAccuracy')} — {t('trading.last30d')}
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-accent-btc">{signalStats.winRate}%</div>
              <div className="text-[10px] text-text-muted">{t('trading.winRate')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-mono font-bold">{signalStats.overall.total}</div>
              <div className="text-[10px] text-text-muted">{t('trading.totalSignals')}</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-mono">
                <span className="text-bullish">{signalStats.overall.correct}</span>
                <span className="text-text-muted mx-1">/</span>
                <span className="text-bearish">{signalStats.overall.incorrect}</span>
              </div>
              <div className="text-[10px] text-text-muted">{t('trading.correct')} / {t('trading.incorrect')}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-text-muted uppercase border-b border-border/50">
                  <th className="text-left py-1 px-2">{t('trading.timeframe')}</th>
                  <th className="text-right py-1 px-2">{t('trading.winRateLabel')}</th>
                  <th className="text-right py-1 px-2">{t('trading.correct')}</th>
                  <th className="text-right py-1 px-2">{t('trading.incorrect')}</th>
                  <th className="text-right py-1 px-2">{t('trading.total')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(signalStats.byTimeframe).map(([tf, data]) => (
                  <tr key={tf} className="border-b border-border/30">
                    <td className="py-1 px-2 font-mono text-xs">{tf}</td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-accent-btc">
                      {data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0}%
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-bullish">{data.correct}</td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-bearish">{data.incorrect}</td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-text-muted">{data.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Signal History Timeline */}
      <SignalTimeline />

      {/* Disclaimer */}
      <p className="text-[10px] text-text-muted italic text-center">
        {t('trading.disclaimer')}
      </p>
    </div>
  )
}
