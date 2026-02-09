import { useState, useEffect, useRef, useCallback } from 'react'

export interface KlineData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const BINANCE_API = 'https://api.binance.com/api/v3/klines'

export const TF_TO_INTERVAL: Record<string, string> = {
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
  '1W': '1w',
}

const REFRESH_MS: Record<string, number> = {
  '1H': 60_000,     // 60s
  '4H': 300_000,    // 5min
  '1D': 0,          // no auto-refresh (Supabase)
  '1W': 900_000,    // 15min
}

function parseKlines(raw: unknown[][]): KlineData[] {
  return raw.map((k) => ({
    date: new Date(k[0] as number).toISOString(),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }))
}

export function useBinanceKlines(
  interval: string,
  limit = 500,
): { data: KlineData[] | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<KlineData[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isFirstFetch = useRef(true)

  const fetchKlines = useCallback(async (binanceInterval: string, isRefresh: boolean) => {
    if (!isRefresh) setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BINANCE_API}?symbol=BTCUSDT&interval=${binanceInterval}&limit=${limit}`)
      if (!res.ok) throw new Error(`Binance API ${res.status}`)
      const raw: unknown[][] = await res.json()
      const klines = parseKlines(raw)
      setData(klines)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      if (!isRefresh) setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    const binanceInterval = TF_TO_INTERVAL[interval]
    if (!binanceInterval) {
      setData(null)
      return
    }

    isFirstFetch.current = true
    fetchKlines(binanceInterval, false)
    isFirstFetch.current = false

    const refreshMs = REFRESH_MS[interval] || 0
    if (refreshMs <= 0) return

    const timer = setInterval(() => {
      fetchKlines(binanceInterval, true)
    }, refreshMs)

    return () => clearInterval(timer)
  }, [interval, fetchKlines])

  return { data, loading, error }
}
