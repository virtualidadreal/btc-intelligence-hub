import { supabase, useSupabaseQuery } from './useSupabase'
import type { CycleScore } from '../lib/types'

export function useLatestCycleScore() {
  return useSupabaseQuery<CycleScore[]>(
    () =>
      supabase
        .from('cycle_score_history')
        .select('*')
        .order('date', { ascending: false })
        .limit(1),
    [],
    'latest-cycle-score',
  )
}

export function useCycleScoreHistory(limit = 90) {
  return useSupabaseQuery<CycleScore[]>(
    () =>
      supabase
        .from('cycle_score_history')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit),
    [limit],
    `cycle-score-history-${limit}`,
  )
}
