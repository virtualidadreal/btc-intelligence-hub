import { supabase, useSupabaseQuery } from './useSupabase'

export interface SignalHistory {
  id: number
  date: string
  timeframe: string
  direction: string
  confidence: number
  score: number
  price_at_signal: number
  price_1h_later: number | null
  outcome_1h: string | null
  created_at: string
}

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
        const byTf: Record<string, { correct: number; incorrect: number; total: number }> = {}

        for (const s of data) {
          if (!s.outcome_1h) continue
          if (!byTf[s.timeframe]) {
            byTf[s.timeframe] = { correct: 0, incorrect: 0, total: 0 }
          }
          byTf[s.timeframe].total++
          if (s.outcome_1h === 'correct') byTf[s.timeframe].correct++
          else byTf[s.timeframe].incorrect++
        }

        const overall = Object.values(byTf).reduce(
          (acc, v) => ({ correct: acc.correct + v.correct, incorrect: acc.incorrect + v.incorrect, total: acc.total + v.total }),
          { correct: 0, incorrect: 0, total: 0 },
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
