import { useMemo } from 'react'
import { supabase, useSupabaseQuery } from './useSupabase'
import type { TechnicalIndicator, OnchainMetric, SentimentData, CycleScore } from '../lib/types'

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

const WEIGHTS: Record<string, Record<string, number>> = {
  '1H': { RSI_14: 0.25, MACD: 0.25, SMA_CROSS: 0.00, BB: 0.15, EMA_21: 0.15, FEAR_GREED: 0.10, HASH_RATE_MOM: 0.00, NVT_RATIO: 0.00, CYCLE_SCORE: 0.10 },
  '4H': { RSI_14: 0.20, MACD: 0.20, SMA_CROSS: 0.10, BB: 0.10, EMA_21: 0.15, FEAR_GREED: 0.15, HASH_RATE_MOM: 0.05, NVT_RATIO: 0.05, CYCLE_SCORE: 0.00 },
  '1D': { RSI_14: 0.15, MACD: 0.15, SMA_CROSS: 0.15, BB: 0.10, EMA_21: 0.10, FEAR_GREED: 0.10, HASH_RATE_MOM: 0.10, NVT_RATIO: 0.05, CYCLE_SCORE: 0.10 },
  '1W': { RSI_14: 0.05, MACD: 0.10, SMA_CROSS: 0.25, BB: 0.00, EMA_21: 0.05, FEAR_GREED: 0.10, HASH_RATE_MOM: 0.15, NVT_RATIO: 0.10, CYCLE_SCORE: 0.20 },
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
}

// ATR multipliers per timeframe: shorter TF → tighter stops, longer → wider
const ATR_MULT: Record<string, { sl: number; tp1: number; tp2: number }> = {
  '1H': { sl: 0.5, tp1: 0.75, tp2: 1.5 },
  '4H': { sl: 1.0, tp1: 1.5, tp2: 3.0 },
  '1D': { sl: 1.5, tp1: 2.0, tp2: 4.0 },
  '1W': { sl: 2.5, tp1: 3.5, tp2: 7.0 },
}

function computeLevels(
  direction: 'LONG' | 'SHORT' | 'NEUTRAL',
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
  if (direction === 'NEUTRAL') return null
  if (!atr || atr <= 0) return null

  const mult = ATR_MULT[timeframe]
  // Scale tighter with higher confidence (0.8x at 100%, 1.2x at 25%)
  const confScale = 1.2 - (confidence / 100) * 0.4
  const atrSl = atr * mult.sl * confScale
  const atrTp1 = atr * mult.tp1
  const atrTp2 = atr * mult.tp2

  let sl: number
  let tp1: number
  let tp2: number
  const parts: string[] = []

  if (direction === 'LONG') {
    // SL: use BB lower or SMA as support, but never more than ATR-based
    const atrSL = price - atrSl
    if (bbLower && bbLower < price && bbLower > atrSL) {
      sl = bbLower - atr * 0.2 // small buffer below BB
      parts.push('SL: BB lower')
    } else if (sma200 && sma200 < price && sma200 > atrSL) {
      sl = sma200 - atr * 0.2
      parts.push('SL: SMA200')
    } else if (sma50 && sma50 < price && sma50 > atrSL) {
      sl = sma50 - atr * 0.2
      parts.push('SL: SMA50')
    } else {
      sl = atrSL
      parts.push('SL: ATR')
    }

    // TP1: BB mid or ATR
    const atrTP1 = price + atrTp1
    if (bbMid && bbMid > price && Math.abs(bbMid - price) > atr * 0.3) {
      tp1 = Math.min(bbMid, atrTP1)
      parts.push('TP1: BB mid')
    } else {
      tp1 = atrTP1
      parts.push('TP1: ATR')
    }

    // TP2: BB upper or ATR extended
    const atrTP2 = price + atrTp2
    if (bbUpper && bbUpper > tp1) {
      tp2 = Math.max(bbUpper, atrTP2)
      parts.push('TP2: BB upper')
    } else {
      tp2 = atrTP2
      parts.push('TP2: ATR')
    }
  } else {
    // SHORT
    const atrSL = price + atrSl
    if (bbUpper && bbUpper > price && bbUpper < atrSL) {
      sl = bbUpper + atr * 0.2
      parts.push('SL: BB upper')
    } else if (sma200 && sma200 > price && sma200 < atrSL) {
      sl = sma200 + atr * 0.2
      parts.push('SL: SMA200')
    } else if (sma50 && sma50 > price && sma50 < atrSL) {
      sl = sma50 + atr * 0.2
      parts.push('SL: SMA50')
    } else {
      sl = atrSL
      parts.push('SL: ATR')
    }

    const atrTP1 = price - atrTp1
    if (bbMid && bbMid < price && Math.abs(price - bbMid) > atr * 0.3) {
      tp1 = Math.max(bbMid, atrTP1)
      parts.push('TP1: BB mid')
    } else {
      tp1 = atrTP1
      parts.push('TP1: ATR')
    }

    const atrTP2 = price - atrTp2
    if (bbLower && bbLower < tp1) {
      tp2 = Math.min(bbLower, atrTP2)
      parts.push('TP2: BB lower')
    } else {
      tp2 = atrTP2
      parts.push('TP2: ATR')
    }
  }

  const risk = Math.abs(price - sl)
  const reward1 = Math.abs(tp1 - price)
  const reward2 = Math.abs(tp2 - price)

  return {
    entry: price,
    sl: Math.round(sl),
    tp1: Math.round(tp1),
    tp2: Math.round(tp2),
    riskReward1: risk > 0 ? Math.round((reward1 / risk) * 100) / 100 : 0,
    riskReward2: risk > 0 ? Math.round((reward2 / risk) * 100) / 100 : 0,
    slPercent: -Math.round((risk / price) * 10000) / 100,
    tp1Percent: Math.round((reward1 / price) * 10000) / 100,
    tp2Percent: Math.round((reward2 / price) * 10000) / 100,
    method: parts.join(' | '),
  }
}

export function useTradingRecommendations(
  signals: TechnicalIndicator[] | null,
  bbIndicators: TechnicalIndicator[] | null,
  sentiment: SentimentData[] | null,
  onchainMetrics: { hashRate: OnchainMetric | null; nvt: OnchainMetric | null },
  cycleScore: CycleScore[] | null,
  currentPrice: number | null,
  allIndicators: TechnicalIndicator[] | null,
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

    // BB signal from BB_UPPER / BB_LOWER
    if (bbIndicators) {
      const bbUpper = bbIndicators.find((b) => b.indicator === 'BB_UPPER')
      const bbLower = bbIndicators.find((b) => b.indicator === 'BB_LOWER')
      if (bbUpper?.signal) signalMap['BB'] = bbUpper.signal
      else if (bbLower?.signal) signalMap['BB'] = bbLower.signal
      valueMap['BB'] = bbUpper?.value ?? bbLower?.value ?? null
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

    // Extract indicator values for level computation
    const findVal = (name: string) => {
      const found = allIndicators?.find((i) => i.indicator === name)
      return found?.value ?? null
    }

    // EMA(21) — price position relative to EMA
    const ema21 = findVal('EMA_21')
    if (ema21 && currentPrice) {
      signalMap['EMA_21'] = emaToSignal(currentPrice, ema21)
      valueMap['EMA_21'] = ema21
    }
    const atr = findVal('ATR_14')
    const bbUpper = findVal('BB_UPPER')
    const bbMid = findVal('BB_MID')
    const bbLower = findVal('BB_LOWER')
    const sma50 = findVal('SMA_50')
    const sma200 = findVal('SMA_200')

    const timeframes = ['1H', '4H', '1D', '1W']
    return timeframes.map((tf) => {
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

      const levels = currentPrice
        ? computeLevels(direction, currentPrice, atr, bbUpper, bbMid, bbLower, sma50, sma200, tf, confidence)
        : null

      return { timeframe: tf, direction, score: totalScore, confidence, signals: detail, bullishCount, bearishCount, neutralCount, levels }
    })
  }, [signals, bbIndicators, sentiment, onchainMetrics, cycleScore, currentPrice, allIndicators])
}
