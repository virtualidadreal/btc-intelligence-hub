import { supabase, useSupabaseQuery } from './useSupabase'
import type { SignalHistory } from '../lib/types'

export type { SignalHistory }

export function useSignalHistory(limit = 100) {
  return useSupabaseQuery<SignalHistory[]>(
    () =>
      supabase
        .from('signal_history')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit),
    [limit],
    `signal-history-${limit}`,
  )
}

export function useSignalAccuracy() {
  const { data, ...rest } = useSignalHistory(500)

  const stats = data
    ? (() => {
        const byTf: Record<string, { correct: number; incorrect: number; tp2: number; total: number }> = {}

        for (const s of data) {
          // Use v2 outcome field first, fall back to legacy outcome_1h
          const outcome = s.outcome ?? s.outcome_1h
          if (!outcome || outcome === 'pending') continue

          if (!byTf[s.timeframe]) {
            byTf[s.timeframe] = { correct: 0, incorrect: 0, tp2: 0, total: 0 }
          }
          byTf[s.timeframe].total++

          if (outcome === 'tp1_hit' || outcome === 'tp2_hit' || outcome === 'correct') {
            byTf[s.timeframe].correct++
            if (outcome === 'tp2_hit') byTf[s.timeframe].tp2++
          } else {
            byTf[s.timeframe].incorrect++
          }
        }

        const overall = Object.values(byTf).reduce(
          (acc, v) => ({
            correct: acc.correct + v.correct,
            incorrect: acc.incorrect + v.incorrect,
            tp2: acc.tp2 + v.tp2,
            total: acc.total + v.total,
          }),
          { correct: 0, incorrect: 0, tp2: 0, total: 0 },
        )

        return {
          byTimeframe: byTf,
          overall,
          winRate: overall.total > 0 ? Math.round((overall.correct / overall.total) * 100) : 0,
        }
      })()
    : null

  return { stats, ...rest }
}
