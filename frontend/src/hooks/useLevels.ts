import { supabase, useSupabaseQuery } from './useSupabase'
import type { PriceLevel, FibonacciLevel, ConfluenceZone } from '../lib/types'

export function usePriceLevels(minStrength = 0) {
  return useSupabaseQuery<PriceLevel[]>(
    () =>
      supabase
        .from('price_levels')
        .select('*')
        .gte('strength', minStrength)
        .eq('status', 'active')
        .order('strength', { ascending: false })
        .limit(50),
    [minStrength],
    `price-levels-${minStrength}`,
  )
}

export function useFibonacciLevels() {
  return useSupabaseQuery<FibonacciLevel[]>(
    () =>
      supabase
        .from('fibonacci_levels')
        .select('*')
        .eq('status', 'active')
        .order('timeframe', { ascending: true })
        .limit(30),
    [],
    'fibonacci-levels',
  )
}

export function useConfluenceZones() {
  return useSupabaseQuery<ConfluenceZone[]>(
    () =>
      supabase
        .from('confluence_zones')
        .select('*')
        .order('num_timeframes', { ascending: false })
        .limit(20),
    [],
    'confluence-zones',
  )
}
