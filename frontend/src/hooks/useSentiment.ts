import { supabase, useSupabaseQuery } from './useSupabase'
import type { SentimentData } from '../lib/types'

export function useLatestSentiment() {
  return useSupabaseQuery<SentimentData[]>(
    () =>
      supabase
        .from('sentiment_data')
        .select('*')
        .in('metric', ['FEAR_GREED', 'FEAR_GREED_30D'])
        .order('date', { ascending: false })
        .limit(5),
  )
}

export function useSentimentHistory(metric: string, limit = 365) {
  return useSupabaseQuery<SentimentData[]>(
    () =>
      supabase
        .from('sentiment_data')
        .select('*')
        .eq('metric', metric)
        .order('date', { ascending: false })
        .limit(limit),
    [metric, limit],
  )
}
