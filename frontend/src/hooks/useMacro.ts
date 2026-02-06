import { supabase, useSupabaseQuery } from './useSupabase'
import type { MacroData, TechnicalIndicator } from '../lib/types'

export function useLatestMacro() {
  return useSupabaseQuery<MacroData[]>(
    () =>
      supabase
        .from('macro_data')
        .select('*')
        .in('asset', ['SPX', 'GOLD', 'DXY', 'US_10Y'])
        .order('date', { ascending: false })
        .limit(20),
  )
}

export function useCorrelations() {
  return useSupabaseQuery<TechnicalIndicator[]>(
    () =>
      supabase
        .from('technical_indicators')
        .select('*')
        .like('indicator', 'CORR_BTC_%')
        .order('date', { ascending: false })
        .limit(50),
  )
}

export function useMacroHistory(asset: string, limit = 365) {
  return useSupabaseQuery<MacroData[]>(
    () =>
      supabase
        .from('macro_data')
        .select('*')
        .eq('asset', asset)
        .order('date', { ascending: false })
        .limit(limit),
    [asset, limit],
  )
}
