import { supabase, useSupabaseQuery } from './useSupabase'
import type { TechnicalIndicator } from '../lib/types'

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
  return useSupabaseQuery<TechnicalIndicator[]>(
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
}
