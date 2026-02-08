import { useMemo } from 'react'
import { supabase, useSupabaseQuery } from './useSupabase'
import type {
  TechnicalIndicator, OnchainMetric, SentimentData, CycleScore,
  PriceLevel as PriceLevelType, FibonacciLevel, ConfluenceZone, SignalHistory,
} from '../lib/types'

export function useLatestIndicators() {
  return useSupabaseQuery<TechnicalIndicator[]>(
    () =>
      supabase
        .from('technical_indicators')
        .select('*')
        .in('indicator', ['RSI_14', 'MACD', 'SMA_CROSS', 'SMA_50', 'SMA_200', 'EMA_21', 'ATR_14', 'BB_UPPER', 'BB_LOWER', 'BB_MID'])
        .order('date', { ascending: false })
        .limit(30),
    [],
    'latest-indicators',
  )
}

export function useIndicatorHistory(indicator: string, limit = 365) {
  return useSupabaseQuery<TechnicalIndicator[]>(
    () =>
      supabase
        .from('technical_indicators')
        .select('*')
        .eq('indicator', indicator)
        .order('date', { ascending: false })
        .limit(limit),
    [indicator, limit],
    `indicator-history-${indicator}-${limit}`,
  )
}

export function useLatestSignals() {
  const raw = useSupabaseQuery<TechnicalIndicator[]>(
    () =>
      supabase
        .from('technical_indicators')
        .select('*')
        .in('indicator', ['RSI_14', 'MACD', 'SMA_CROSS'])
        .order('date', { ascending: false })
        .limit(10),
    [],
    'latest-signals',
  )

  const deduped = useMemo(() => {
    if (!raw.data) return null
    const seen = new Map<string, TechnicalIndicator>()
    for (const s of raw.data) {
      if (!seen.has(s.indicator)) seen.set(s.indicator, s)
    }
    return Array.from(seen.values())
  }, [raw.data])

  return { ...raw, data: deduped }
}

// --- Trading Recommendations ---

type SignalLabel = 'extreme_bullish' | 'bullish' | 'neutral' | 'bearish' | 'extreme_bearish'

const SIGNAL_SCORE: Record<SignalLabel, number> = {
  extreme_bullish: 1.0,
  bullish: 0.5,
  neutral: 0.0,
  bearish: -0.5,
  extreme_bearish: -1.0,
}

// v2: Added FUNDING_RATE and OPEN_INTEREST, rebalanced weights
const WEIGHTS: Record<string, Record<string, number>> = {
  '1H': { RSI_14: 0.22, MACD: 0.22, SMA_CROSS: 0.00, BB: 0.13, EMA_21: 0.13, FEAR_GREED: 0.10, HASH_RATE_MOM: 0.00, NVT_RATIO: 0.00, CYCLE_SCORE: 0.10, FUNDING_RATE: 0.07, OPEN_INTEREST: 0.03 },
  '4H': { RSI_14: 0.18, MACD: 0.18, SMA_CROSS: 0.08, BB: 0.08, EMA_21: 0.12, FEAR_GREED: 0.12, HASH_RATE_MOM: 0.04, NVT_RATIO: 0.04, CYCLE_SCORE: 0.00, FUNDING_RATE: 0.10, OPEN_INTEREST: 0.06 },
  '1D': { RSI_14: 0.14, MACD: 0.14, SMA_CROSS: 0.14, BB: 0.09, EMA_21: 0.09, FEAR_GREED: 0.09, HASH_RATE_MOM: 0.09, NVT_RATIO: 0.05, CYCLE_SCORE: 0.09, FUNDING_RATE: 0.05, OPEN_INTEREST: 0.03 },
  '1W': { RSI_14: 0.05, MACD: 0.10, SMA_CROSS: 0.25, BB: 0.00, EMA_21: 0.05, FEAR_GREED: 0.10, HASH_RATE_MOM: 0.15, NVT_RATIO: 0.10, CYCLE_SCORE: 0.20, FUNDING_RATE: 0.00, OPEN_INTEREST: 0.00 },
}

function signalToScore(signal: string | null): number {
  if (!signal) return 0
  return SIGNAL_SCORE[signal as SignalLabel] ?? 0
}

function fgValueToSignal(value: number): SignalLabel {
  if (value <= 15) return 'extreme_bearish'
  if (value <= 30) return 'bearish'
  if (value <= 55) return 'neutral'
  if (value <= 80) return 'bullish'
  return 'extreme_bullish'
}

function cycleScoreToSignal(score: number): SignalLabel {
  if (score <= 20) return 'extreme_bullish'
  if (score <= 40) return 'bullish'
  if (score <= 60) return 'neutral'
  if (score <= 80) return 'bearish'
  return 'extreme_bearish'
}

function emaToSignal(price: number, ema: number): SignalLabel {
  const pct = ((price - ema) / ema) * 100
  if (pct > 5) return 'extreme_bullish'
  if (pct > 1) return 'bullish'
  if (pct > -1) return 'neutral'
  if (pct > -5) return 'bearish'
  return 'extreme_bearish'
}

function fundingRateToSignal(rate: number): SignalLabel {
  // Contrarian: positive funding = bearish (overcrowded longs), negative = bullish
  if (rate > 0.1) return 'extreme_bearish'
  if (rate > 0.03) return 'bearish'
  if (rate > -0.03) return 'neutral'
  if (rate > -0.05) return 'bullish'
  return 'extreme_bullish'
}

export interface SignalDetail {
  signal: string
  weight: number
  score: number
  rawValue: number | null
  contribution: number
}

export interface TradingLevels {
  entry: number
  sl: number
  tp1: number
  tp2: number
  riskReward1: number
  riskReward2: number
  slPercent: number
  tp1Percent: number
  tp2Percent: number
  method: string
  slMethod: string
  tp1Method: string
  tp2Method: string
}

export interface TradingRecommendation {
  timeframe: string
  direction: 'LONG' | 'SHORT' | 'NEUTRAL'
  score: number
  confidence: number
  signals: Record<string, SignalDetail>
  bullishCount: number
  bearishCount: number
  neutralCount: number
  levels: TradingLevels | null
  // v2 extended
  extendedScore: number
  classification: string
  bonusLevels: number
  bonusCandles: number
  bonusOnchain: number
  penalties: number
  setupType: string | null
  candlePattern: string | null
  nearbyLevels: PriceLevelType[]
}

export const SIGNAL_LABELS: Record<string, string> = {
  RSI_14: 'RSI (14)',
  MACD: 'MACD',
  SMA_CROSS: 'SMA Cross',
  BB: 'Bollinger Bands',
  EMA_21: 'EMA (21)',
  FEAR_GREED: 'Fear & Greed',
  HASH_RATE_MOM: 'Hash Rate Mom.',
  NVT_RATIO: 'NVT Ratio',
  CYCLE_SCORE: 'Cycle Score',
  FUNDING_RATE: 'Funding Rate',
  OPEN_INTEREST: 'Open Interest',
}

// ── v2: Extended Scoring ────────────────────────────────────────────────────

function isNear(price: number, levelPrice: number, tolerancePct: number): boolean {
  if (levelPrice === 0) return false
  return Math.abs(price - levelPrice) / levelPrice * 100 <= tolerancePct
}

function calcLevelBonus(
  price: number,
  levels: PriceLevelType[],
  fibs: FibonacciLevel[],
  confluences: ConfluenceZone[],
): number {
  let bonus = 0
  const proximityPct = 1.0
  const nearby = levels.filter(lv => isNear(price, lv.price, proximityPct))

  // Gran nivel (strength >= 10)
  if (nearby.some(lv => lv.strength >= 10)) bonus += 8

  // Golden Pocket (Fib 0.618-0.650)
  let atGoldenPocket = false
  for (const fib of fibs) {
    if (fib.type === 'extension') continue
    const lvls = fib.levels as Record<string, number>
    for (const [ratioStr, fibPrice] of Object.entries(lvls)) {
      const r = parseFloat(ratioStr)
      if ((Math.abs(r - 0.618) < 0.01 || Math.abs(r - 0.65) < 0.01) && typeof fibPrice === 'number' && isNear(price, fibPrice, proximityPct)) {
        bonus += 7
        atGoldenPocket = true
        break
      }
    }
    if (atGoldenPocket) break
  }

  // Multi-TF Fibonacci confluence
  for (const conf of confluences) {
    if (isNear(price, conf.price_mid, proximityPct) && conf.num_timeframes >= 2) {
      bonus += 6
      break
    }
  }

  // Level + Fib combo (only if not already golden pocket)
  if (!atGoldenPocket && nearby.some(lv => lv.strength >= 10) && fibs.length > 0) {
    outer: for (const fib of fibs) {
      if (fib.type === 'extension') continue
      const lvls = fib.levels as Record<string, number>
      for (const fibPrice of Object.values(lvls)) {
        if (typeof fibPrice === 'number' && isNear(price, fibPrice, proximityPct)) {
          bonus += 5
          break outer
        }
      }
    }
  }

  // Role flip level
  if (nearby.some(lv => lv.is_role_flip)) bonus += 4

  // Psychological level
  if (nearby.some(lv => lv.is_psychological)) bonus += 1

  return Math.min(bonus, 20)
}

function calcCandleBonus(
  candleInfo: { pattern: string | null; score: number } | null,
  price: number,
  levels: PriceLevelType[],
): number {
  if (!candleInfo?.pattern) return 0
  let bonus = 0
  const atLevel = levels.some(lv => lv.strength >= 8 && isNear(price, lv.price, 1.0))
  if (candleInfo.score >= 7 && atLevel) bonus += 8
  else if (candleInfo.score >= 5 && atLevel) bonus += 5
  else if (candleInfo.score >= 7) bonus += 4
  return Math.min(bonus, 10)
}

function calcOnchainBonus(
  onchain: { fearGreed: number | null; fundingRate: number | null },
  direction: string,
  timeframe: string,
): number {
  if (timeframe === '1H') return 0
  let bonus = 0
  if (onchain.fearGreed != null) {
    if (onchain.fearGreed < 20 && direction === 'LONG') bonus += 4
    else if (onchain.fearGreed > 80 && direction === 'SHORT') bonus += 4
  }
  if (onchain.fundingRate != null) {
    if (onchain.fundingRate > 0.05 && direction === 'SHORT') bonus += 3
    else if (onchain.fundingRate < -0.03 && direction === 'LONG') bonus += 3
  }
  return Math.min(bonus, 10)
}

function calcPenalties(
  price: number,
  direction: string,
  levels: PriceLevelType[],
  ema21: number | null,
  fearGreed: number | null,
  htfDirection: string | null,
): number {
  let penalty = 0
  const nearbyStrong = levels.filter(lv => lv.strength >= 6 && isNear(price, lv.price, 2.0))
  if (nearbyStrong.length === 0) penalty -= 5
  if (htfDirection && htfDirection !== direction && htfDirection !== 'NEUTRAL') penalty -= 8
  if (ema21 && ema21 > 0) {
    const distPct = Math.abs(price - ema21) / ema21 * 100
    if (distPct > 5) penalty -= 5
  }
  if (fearGreed != null) {
    if (direction === 'LONG' && fearGreed > 85) penalty -= 5
    else if (direction === 'SHORT' && fearGreed < 15) penalty -= 5
  }
  return Math.max(penalty, -15)
}

function classifyScore(score: number): string {
  if (score >= 85) return 'PREMIUM'
  if (score >= 70) return 'STRONG'
  if (score >= 55) return 'VALID'
  if (score >= 40) return 'WEAK'
  return 'NO ENTRAR'
}

// ── v2: Enhanced TP/SL with structural levels ───────────────────────────────

const ATR_BUFFER: Record<string, number> = { '1H': 0.5, '4H': 0.8, '1D': 1.0, '1W': 1.5 }
const MAX_SL_PCT: Record<string, number> = { '1H': 2.0, '4H': 4.0, '1D': 7.0, '1W': 12.0 }
const MIN_RR1: Record<string, number> = { '1H': 1.0, '4H': 1.2, '1D': 1.2, '1W': 1.5 }
const MIN_RR2: Record<string, number> = { '1H': 1.5, '4H': 2.0, '1D': 2.0, '1W': 2.5 }
const MAX_TP1_PCT: Record<string, number> = { '1H': 2.0, '4H': 4.0, '1D': 6.0, '1W': 10.0 }
const MAX_TP2_PCT: Record<string, number> = { '1H': 4.0, '4H': 7.0, '1D': 10.0, '1W': 18.0 }

function findFibPrice(fibs: FibonacciLevel[], targetRatio: number, price: number, side: 'above' | 'below'): number | null {
  for (const fib of fibs) {
    if (fib.type === 'extension') continue
    const lvls = fib.levels as Record<string, number>
    for (const [ratioStr, fibPrice] of Object.entries(lvls)) {
      const ratio = parseFloat(ratioStr)
      if (Math.abs(ratio - targetRatio) < 0.01 && typeof fibPrice === 'number') {
        if (side === 'below' && fibPrice < price) return fibPrice
        if (side === 'above' && fibPrice > price) return fibPrice
      }
    }
  }
  return null
}

function findFibExtension(fibs: FibonacciLevel[], targetRatio: number, beyondPrice: number, side: 'above' | 'below'): number | null {
  for (const fib of fibs) {
    if (fib.type !== 'extension') continue
    const lvls = fib.levels as Record<string, number>
    for (const [ratioStr, fibPrice] of Object.entries(lvls)) {
      const ratio = parseFloat(ratioStr)
      if (Math.abs(ratio - targetRatio) < 0.01 && typeof fibPrice === 'number') {
        if (side === 'above' && fibPrice > beyondPrice) return fibPrice
        if (side === 'below' && fibPrice < beyondPrice) return fibPrice
      }
    }
  }
  return null
}

function buildLevelsResult(
  entry: number, sl: number, tp1: number, tp2: number,
  slMethod: string, tp1Method: string, tp2Method: string,
  timeframe = '4H',
): TradingLevels {
  // Cap TP values to max % per timeframe
  const maxTp1Pct = MAX_TP1_PCT[timeframe] ?? 4.0
  const maxTp2Pct = MAX_TP2_PCT[timeframe] ?? 7.0
  const tp1Pct = Math.abs(tp1 - entry) / entry * 100
  const tp2Pct = Math.abs(tp2 - entry) / entry * 100

  if (tp1Pct > maxTp1Pct) {
    tp1 = tp1 > entry ? entry * (1 + maxTp1Pct / 100) : entry * (1 - maxTp1Pct / 100)
    tp1Method = tp1Method + '_capped'
  }
  if (tp2Pct > maxTp2Pct) {
    tp2 = tp2 > entry ? entry * (1 + maxTp2Pct / 100) : entry * (1 - maxTp2Pct / 100)
    tp2Method = tp2Method + '_capped'
  }

  const risk = Math.abs(entry - sl)
  const reward1 = Math.abs(tp1 - entry)
  const reward2 = Math.abs(tp2 - entry)
  return {
    entry,
    sl: Math.round(sl),
    tp1: Math.round(tp1),
    tp2: Math.round(tp2),
    riskReward1: risk > 0 ? Math.round((reward1 / risk) * 100) / 100 : 0,
    riskReward2: risk > 0 ? Math.round((reward2 / risk) * 100) / 100 : 0,
    slPercent: -Math.round((risk / entry) * 10000) / 100,
    tp1Percent: Math.round((reward1 / entry) * 10000) / 100,
    tp2Percent: Math.round((reward2 / entry) * 10000) / 100,
    method: `SL: ${slMethod} | TP1: ${tp1Method} | TP2: ${tp2Method}`,
    slMethod,
    tp1Method,
    tp2Method,
  }
}

function computeEnhancedLevels(
  direction: 'LONG' | 'SHORT',
  price: number,
  atr: number | null,
  bbUpper: number | null,
  bbMid: number | null,
  bbLower: number | null,
  sma50: number | null,
  sma200: number | null,
  timeframe: string,
  _confidence: number,
  priceLevels: PriceLevelType[],
  fibs: FibonacciLevel[],
): TradingLevels | null {
  if (!atr || atr <= 0) return null

  const buffer = atr * (ATR_BUFFER[timeframe] ?? 1.5)
  const maxSlPct = MAX_SL_PCT[timeframe] ?? 4.0
  const minRR1Val = MIN_RR1[timeframe] ?? 1.5
  const minRR2Val = MIN_RR2[timeframe] ?? 2.5

  let sl: number, tp1: number, tp2: number
  let slMethod = '', tp1Method = '', tp2Method = ''

  if (direction === 'LONG') {
    // === SL: Strong support > Fib 0.786 > BB lower > SMA > ATR ===
    const supports = priceLevels
      .filter(lv => lv.type === 'support' && lv.price < price && lv.strength >= 10)
      .sort((a, b) => b.price - a.price)
    const fib786 = findFibPrice(fibs, 0.786, price, 'below')

    if (supports.length > 0 && (price - supports[0].price) / price * 100 <= maxSlPct) {
      sl = supports[0].price - buffer
      slMethod = 'gran_soporte'
    } else if (fib786 && (price - fib786) / price * 100 <= maxSlPct) {
      sl = fib786 - buffer
      slMethod = 'fib_0786'
    } else if (bbLower && bbLower < price) {
      sl = bbLower - atr * 0.2
      slMethod = 'bb_lower'
    } else if (sma200 && sma200 < price && (price - sma200) / price * 100 <= maxSlPct) {
      sl = sma200 - atr * 0.2
      slMethod = 'sma200'
    } else if (sma50 && sma50 < price && (price - sma50) / price * 100 <= maxSlPct) {
      sl = sma50 - atr * 0.2
      slMethod = 'sma50'
    } else {
      sl = price - buffer * 1.5
      slMethod = 'atr'
    }

    if (Math.abs(price - sl) / price * 100 > maxSlPct) {
      sl = price * (1 - maxSlPct / 100)
      slMethod = 'atr_capped'
    }

    const risk = Math.abs(price - sl)
    if (risk === 0) return null

    // === TP1: Strong resistance > BB mid > ATR ===
    const resistances = priceLevels
      .filter(lv => lv.type === 'resistance' && lv.price > price && lv.strength >= 8)
      .sort((a, b) => a.price - b.price)

    if (resistances.length > 0 && (resistances[0].price - price) / risk >= minRR1Val) {
      tp1 = resistances[0].price
      tp1Method = 'strong_resistance'
    } else if (bbMid && bbMid > price && (bbMid - price) / risk >= minRR1Val) {
      tp1 = bbMid
      tp1Method = 'bb_mid'
    } else {
      tp1 = price + risk * minRR1Val
      tp1Method = 'atr'
    }

    if ((tp1 - price) / risk < minRR1Val) {
      tp1 = price + risk * minRR1Val
      tp1Method = 'min_rr'
    }

    // === TP2: Fib 1.618 at level > Next resistance > Fib 1.618 > BB upper > ATR ===
    const nextRes = priceLevels
      .filter(lv => lv.type === 'resistance' && lv.price > tp1 && lv.strength >= 8)
      .sort((a, b) => a.price - b.price)
    const fib1618 = findFibExtension(fibs, 1.618, tp1, 'above')

    if (fib1618 && nextRes.length > 0 && isNear(fib1618, nextRes[0].price, 1.5)) {
      tp2 = fib1618
      tp2Method = 'fib_1618_at_level'
    } else if (nextRes.length > 0) {
      tp2 = nextRes[0].price
      tp2Method = 'next_resistance'
    } else if (fib1618) {
      tp2 = fib1618
      tp2Method = 'fib_1618'
    } else if (bbUpper && bbUpper > tp1) {
      tp2 = bbUpper
      tp2Method = 'bb_upper'
    } else {
      tp2 = price + risk * minRR2Val
      tp2Method = 'atr'
    }

    if ((tp2 - price) / risk < minRR2Val) {
      tp2 = price + risk * minRR2Val
      tp2Method = 'min_rr'
    }
  } else {
    // === SHORT ===
    const resistances = priceLevels
      .filter(lv => lv.type === 'resistance' && lv.price > price && lv.strength >= 10)
      .sort((a, b) => a.price - b.price)
    const fib786 = findFibPrice(fibs, 0.786, price, 'above')

    if (resistances.length > 0 && (resistances[0].price - price) / price * 100 <= maxSlPct) {
      sl = resistances[0].price + buffer
      slMethod = 'gran_resistencia'
    } else if (fib786 && (fib786 - price) / price * 100 <= maxSlPct) {
      sl = fib786 + buffer
      slMethod = 'fib_0786'
    } else if (bbUpper && bbUpper > price) {
      sl = bbUpper + atr * 0.2
      slMethod = 'bb_upper'
    } else if (sma200 && sma200 > price && (sma200 - price) / price * 100 <= maxSlPct) {
      sl = sma200 + atr * 0.2
      slMethod = 'sma200'
    } else if (sma50 && sma50 > price && (sma50 - price) / price * 100 <= maxSlPct) {
      sl = sma50 + atr * 0.2
      slMethod = 'sma50'
    } else {
      sl = price + buffer * 1.5
      slMethod = 'atr'
    }

    if (Math.abs(sl - price) / price * 100 > maxSlPct) {
      sl = price * (1 + maxSlPct / 100)
      slMethod = 'atr_capped'
    }

    const risk = Math.abs(sl - price)
    if (risk === 0) return null

    // TP1
    const supports = priceLevels
      .filter(lv => lv.type === 'support' && lv.price < price && lv.strength >= 8)
      .sort((a, b) => b.price - a.price)

    if (supports.length > 0 && (price - supports[0].price) / risk >= minRR1Val) {
      tp1 = supports[0].price
      tp1Method = 'strong_support'
    } else if (bbMid && bbMid < price && (price - bbMid) / risk >= minRR1Val) {
      tp1 = bbMid
      tp1Method = 'bb_mid'
    } else {
      tp1 = price - risk * minRR1Val
      tp1Method = 'atr'
    }

    if ((price - tp1) / risk < minRR1Val) {
      tp1 = price - risk * minRR1Val
      tp1Method = 'min_rr'
    }

    // TP2
    const nextSup = priceLevels
      .filter(lv => lv.type === 'support' && lv.price < tp1 && lv.strength >= 8)
      .sort((a, b) => b.price - a.price)
    const fib1618 = findFibExtension(fibs, 1.618, tp1, 'below')

    if (fib1618 && nextSup.length > 0 && isNear(fib1618, nextSup[0].price, 1.5)) {
      tp2 = fib1618
      tp2Method = 'fib_1618_at_level'
    } else if (nextSup.length > 0) {
      tp2 = nextSup[0].price
      tp2Method = 'next_support'
    } else if (fib1618) {
      tp2 = fib1618
      tp2Method = 'fib_1618'
    } else if (bbLower && bbLower < tp1) {
      tp2 = bbLower
      tp2Method = 'bb_lower'
    } else {
      tp2 = price - risk * minRR2Val
      tp2Method = 'atr'
    }

    if ((price - tp2) / risk < minRR2Val) {
      tp2 = price - risk * minRR2Val
      tp2Method = 'min_rr'
    }
  }

  return buildLevelsResult(price, sl, tp1, tp2, slMethod, tp1Method, tp2Method, timeframe)
}

// Fallback: original ATR + Bollinger computation
function computeLevelsFallback(
  direction: 'LONG' | 'SHORT',
  price: number,
  atr: number | null,
  bbUpper: number | null,
  bbMid: number | null,
  bbLower: number | null,
  sma50: number | null,
  sma200: number | null,
  timeframe: string,
  confidence: number,
): TradingLevels | null {
  if (!atr || atr <= 0) return null

  const mult: Record<string, { sl: number; tp1: number; tp2: number }> = {
    '1H': { sl: 0.3, tp1: 0.5, tp2: 0.9 },
    '4H': { sl: 0.5, tp1: 0.8, tp2: 1.5 },
    '1D': { sl: 0.8, tp1: 1.2, tp2: 2.0 },
    '1W': { sl: 1.2, tp1: 2.0, tp2: 3.5 },
  }

  const m = mult[timeframe] ?? mult['4H']
  const confScale = 1.2 - (confidence / 100) * 0.4
  const atrSl = atr * m.sl * confScale
  const atrTp1 = atr * m.tp1
  const atrTp2 = atr * m.tp2

  let sl: number, tp1: number, tp2: number
  let slMethod = 'atr', tp1Method = 'atr', tp2Method = 'atr'

  if (direction === 'LONG') {
    const atrSL = price - atrSl
    if (bbLower && bbLower < price && bbLower > atrSL) { sl = bbLower - atr * 0.2; slMethod = 'bb_lower' }
    else if (sma200 && sma200 < price && sma200 > atrSL) { sl = sma200 - atr * 0.2; slMethod = 'sma200' }
    else if (sma50 && sma50 < price && sma50 > atrSL) { sl = sma50 - atr * 0.2; slMethod = 'sma50' }
    else { sl = atrSL }

    const atrTP1 = price + atrTp1
    if (bbMid && bbMid > price && Math.abs(bbMid - price) > atr * 0.3) { tp1 = Math.min(bbMid, atrTP1); tp1Method = 'bb_mid' }
    else { tp1 = atrTP1 }

    const atrTP2 = price + atrTp2
    if (bbUpper && bbUpper > tp1) { tp2 = Math.max(bbUpper, atrTP2); tp2Method = 'bb_upper' }
    else { tp2 = atrTP2 }
  } else {
    const atrSL = price + atrSl
    if (bbUpper && bbUpper > price && bbUpper < atrSL) { sl = bbUpper + atr * 0.2; slMethod = 'bb_upper' }
    else if (sma200 && sma200 > price && sma200 < atrSL) { sl = sma200 + atr * 0.2; slMethod = 'sma200' }
    else if (sma50 && sma50 > price && sma50 < atrSL) { sl = sma50 + atr * 0.2; slMethod = 'sma50' }
    else { sl = atrSL }

    const atrTP1 = price - atrTp1
    if (bbMid && bbMid < price && Math.abs(price - bbMid) > atr * 0.3) { tp1 = Math.max(bbMid, atrTP1); tp1Method = 'bb_mid' }
    else { tp1 = atrTP1 }

    const atrTP2 = price - atrTp2
    if (bbLower && bbLower < tp1) { tp2 = Math.min(bbLower, atrTP2); tp2Method = 'bb_lower' }
    else { tp2 = atrTP2 }
  }

  return buildLevelsResult(price, sl, tp1, tp2, slMethod, tp1Method, tp2Method, timeframe)
}

// ── V2 Data Interface ───────────────────────────────────────────────────────

export interface V2TradingData {
  fundingRate: OnchainMetric | null
  openInterest: OnchainMetric | null
  priceLevels: PriceLevelType[] | null
  fibLevels: FibonacciLevel[] | null
  confluences: ConfluenceZone[] | null
  latestV2Signals: SignalHistory[] | null
}

// ── Main Hook ───────────────────────────────────────────────────────────────

export function useTradingRecommendations(
  signals: TechnicalIndicator[] | null,
  bbIndicators: TechnicalIndicator[] | null,
  sentiment: SentimentData[] | null,
  onchainMetrics: { hashRate: OnchainMetric | null; nvt: OnchainMetric | null },
  cycleScore: CycleScore[] | null,
  currentPrice: number | null,
  allIndicators: TechnicalIndicator[] | null,
  v2Data?: V2TradingData,
): TradingRecommendation[] {
  return useMemo(() => {
    const signalMap: Record<string, string> = {}
    const valueMap: Record<string, number | null> = {}

    if (signals) {
      for (const s of signals) {
        if (s.signal) signalMap[s.indicator] = s.signal
        valueMap[s.indicator] = s.value
      }
    }

    // BB signal
    if (bbIndicators) {
      const bbUp = bbIndicators.find((b) => b.indicator === 'BB_UPPER')
      const bbLo = bbIndicators.find((b) => b.indicator === 'BB_LOWER')
      if (bbUp?.signal) signalMap['BB'] = bbUp.signal
      else if (bbLo?.signal) signalMap['BB'] = bbLo.signal
      valueMap['BB'] = bbUp?.value ?? bbLo?.value ?? null
    }

    // Fear & Greed
    const fg = sentiment?.find((s) => s.metric === 'FEAR_GREED')
    if (fg) {
      signalMap['FEAR_GREED'] = fgValueToSignal(fg.value)
      valueMap['FEAR_GREED'] = fg.value
    }

    // On-chain
    if (onchainMetrics.hashRate?.signal) {
      signalMap['HASH_RATE_MOM'] = onchainMetrics.hashRate.signal
      valueMap['HASH_RATE_MOM'] = onchainMetrics.hashRate.value
    }
    if (onchainMetrics.nvt?.signal) {
      signalMap['NVT_RATIO'] = onchainMetrics.nvt.signal
      valueMap['NVT_RATIO'] = onchainMetrics.nvt.value
    }

    // Cycle score
    const cs = cycleScore?.[0]
    if (cs) {
      signalMap['CYCLE_SCORE'] = cycleScoreToSignal(cs.score)
      valueMap['CYCLE_SCORE'] = cs.score
    }

    // Indicator values
    const findVal = (name: string) => {
      const found = allIndicators?.find((i) => i.indicator === name)
      return found?.value ?? null
    }

    // EMA(21)
    const ema21 = findVal('EMA_21')
    if (ema21 && currentPrice) {
      signalMap['EMA_21'] = emaToSignal(currentPrice, ema21)
      valueMap['EMA_21'] = ema21
    }

    // v2: Funding Rate and Open Interest
    if (v2Data?.fundingRate?.value != null) {
      signalMap['FUNDING_RATE'] = fundingRateToSignal(v2Data.fundingRate.value)
      valueMap['FUNDING_RATE'] = v2Data.fundingRate.value
    }
    if (v2Data?.openInterest) {
      if (v2Data.openInterest.signal) signalMap['OPEN_INTEREST'] = v2Data.openInterest.signal
      valueMap['OPEN_INTEREST'] = v2Data.openInterest.value
    }

    const atr = findVal('ATR_14')
    const bbUpperVal = findVal('BB_UPPER')
    const bbMidVal = findVal('BB_MID')
    const bbLowerVal = findVal('BB_LOWER')
    const sma50 = findVal('SMA_50')
    const sma200 = findVal('SMA_200')
    const fearGreedValue = fg?.value ?? null

    // Two-pass: first compute base directions, then extended scores with HTF context
    const timeframes = ['1H', '4H', '1D', '1W']
    const htfMap: Record<string, string> = { '1H': '4H', '4H': '1D', '1D': '1W' }

    // Pass 1: Base scores
    const baseResults = timeframes.map((tf) => {
      const weights = WEIGHTS[tf]
      let totalScore = 0
      const detail: Record<string, SignalDetail> = {}
      let bullishCount = 0
      let bearishCount = 0
      let neutralCount = 0

      for (const [key, weight] of Object.entries(weights)) {
        if (weight === 0) continue
        const sig = signalMap[key]
        const sc = signalToScore(sig || null)
        const contribution = weight * sc
        totalScore += contribution

        if (sig) {
          detail[key] = { signal: sig, weight, score: sc, rawValue: valueMap[key] ?? null, contribution }
          if (sc > 0) bullishCount++
          else if (sc < 0) bearishCount++
          else neutralCount++
        }
      }

      const direction: 'LONG' | 'SHORT' | 'NEUTRAL' = totalScore > 0.25 ? 'LONG' : totalScore < -0.25 ? 'SHORT' : 'NEUTRAL'
      const confidence = Math.min(Math.round(Math.abs(totalScore) * 100), 100)

      return { tf, direction, confidence, totalScore, detail, bullishCount, bearishCount, neutralCount }
    })

    // Pass 2: Extended scoring + enhanced TP/SL
    return baseResults.map((base) => {
      const { tf, direction, confidence, totalScore, detail, bullishCount, bearishCount, neutralCount } = base

      // HTF direction for penalty calculation
      const htfTf = htfMap[tf]
      const htfResult = htfTf ? baseResults.find(r => r.tf === htfTf) : null
      const htfDirection = htfResult?.direction ?? null

      // v2 signal from signal_history
      const v2Signal = v2Data?.latestV2Signals?.find(s => s.timeframe === tf) ?? null

      // Nearby levels
      const nearbyLevels = (v2Data?.priceLevels ?? []).filter(lv =>
        currentPrice ? isNear(currentPrice, lv.price, 3.0) : false
      )

      // Extended scoring
      let bonusLevels = 0, bonusCandles = 0, bonusOnchain = 0, penalties = 0
      let extendedScore = confidence
      let classification = classifyScore(confidence)

      if (currentPrice && direction !== 'NEUTRAL' && v2Data) {
        bonusLevels = calcLevelBonus(currentPrice, v2Data.priceLevels ?? [], v2Data.fibLevels ?? [], v2Data.confluences ?? [])
        bonusCandles = calcCandleBonus(
          v2Signal ? { pattern: v2Signal.candle_pattern, score: v2Signal.candle_score ?? 0 } : null,
          currentPrice,
          v2Data.priceLevels ?? [],
        )
        bonusOnchain = calcOnchainBonus(
          { fearGreed: fearGreedValue, fundingRate: v2Data.fundingRate?.value ?? null },
          direction,
          tf,
        )
        penalties = calcPenalties(currentPrice, direction, v2Data.priceLevels ?? [], ema21, fearGreedValue, htfDirection)

        const raw = confidence + bonusLevels + bonusCandles + bonusOnchain + penalties
        extendedScore = Math.max(0, Math.min(100, Math.round(raw)))
        classification = classifyScore(extendedScore)
      }

      // Enhanced TP/SL with structural levels, fallback to ATR+BB
      let levels: TradingLevels | null = null
      if (currentPrice && direction !== 'NEUTRAL') {
        if (v2Data?.priceLevels && v2Data.priceLevels.length > 0) {
          levels = computeEnhancedLevels(
            direction, currentPrice, atr, bbUpperVal, bbMidVal, bbLowerVal,
            sma50, sma200, tf, confidence, v2Data.priceLevels, v2Data.fibLevels ?? [],
          )
        }
        if (!levels) {
          levels = computeLevelsFallback(
            direction, currentPrice, atr, bbUpperVal, bbMidVal, bbLowerVal,
            sma50, sma200, tf, confidence,
          )
        }
      }

      return {
        timeframe: tf,
        direction,
        score: totalScore,
        confidence,
        signals: detail,
        bullishCount,
        bearishCount,
        neutralCount,
        levels,
        extendedScore,
        classification,
        bonusLevels,
        bonusCandles,
        bonusOnchain,
        penalties,
        setupType: v2Signal?.setup_type ?? null,
        candlePattern: v2Signal?.candle_pattern ?? null,
        nearbyLevels,
      }
    })
  }, [signals, bbIndicators, sentiment, onchainMetrics, cycleScore, currentPrice, allIndicators, v2Data])
}
