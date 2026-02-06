import { supabase, useSupabaseQuery } from './useSupabase'
import type { OnchainMetric } from '../lib/types'

export function useLatestOnchain() {
  return useSupabaseQuery<OnchainMetric[]>(
    () =>
      supabase
        .from('onchain_metrics')
        .select('*')
        .in('metric', ['HASH_RATE', 'HASH_RATE_MOM_30D', 'NVT_RATIO', 'TX_COUNT', 'ACTIVE_ADDRESSES', 'FUNDING_RATE', 'OPEN_INTEREST'])
        .order('date', { ascending: false })
        .limit(20),
    [],
    'latest-onchain',
  )
}

export function useOnchainHistory(metric: string, limit = 365) {
  return useSupabaseQuery<OnchainMetric[]>(
    () =>
      supabase
        .from('onchain_metrics')
        .select('*')
        .eq('metric', metric)
        .order('date', { ascending: false })
        .limit(limit),
    [metric, limit],
    `onchain-history-${metric}-${limit}`,
  )
}
