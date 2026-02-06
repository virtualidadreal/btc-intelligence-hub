import { supabase, useSupabaseQuery } from './useSupabase'
import type { BtcPrice } from '../lib/types'

export function useLatestPrice() {
  return useSupabaseQuery<BtcPrice[]>(
    () => supabase.from('btc_prices').select('*').order('date', { ascending: false }).limit(1),
    [],
    'latest-price',
  )
}

export function usePriceHistory(limit = 365) {
  return useSupabaseQuery<BtcPrice[]>(
    () => supabase.from('btc_prices').select('*').order('date', { ascending: false }).limit(limit),
    [limit],
    `price-history-${limit}`,
  )
}

export function usePriceChanges() {
  return useSupabaseQuery<BtcPrice[]>(
    () => supabase.from('btc_prices').select('*').order('date', { ascending: false }).limit(31),
    [],
    'price-changes',
  )
}
