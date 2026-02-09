import { useMemo } from 'react'
import { RSI, MACD } from 'technicalindicators'
import type { KlineData } from './useBinanceKlines'

interface RsiPoint {
  date: string
  value: number
  signal: string | null
}

interface MacdPoint {
  date: string
  macd: number
  signal_line: number | null
  histogram: number | null
}

function rsiSignal(value: number): string | null {
  if (value >= 70) return 'bearish'
  if (value <= 30) return 'bullish'
  return null
}

export function useKlineIndicators(klines: KlineData[] | null): {
  rsi: RsiPoint[]
  macd: MacdPoint[]
} {
  const rsi = useMemo(() => {
    if (!klines || klines.length < 15) return []
    const closes = klines.map((k) => k.close)
    const values = RSI.calculate({ values: closes, period: 14 })
    // RSI output is shorter by `period` elements
    const offset = klines.length - values.length
    return values.map((v, i) => ({
      date: klines[i + offset].date,
      value: Math.round(v * 100) / 100,
      signal: rsiSignal(v),
    }))
  }, [klines])

  const macd = useMemo(() => {
    if (!klines || klines.length < 35) return []
    const closes = klines.map((k) => k.close)
    const result = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    })
    const offset = klines.length - result.length
    return result.map((r, i) => ({
      date: klines[i + offset].date,
      macd: r.MACD ?? 0,
      signal_line: r.signal ?? null,
      histogram: r.histogram ?? null,
    }))
  }, [klines])

  return { rsi, macd }
}
