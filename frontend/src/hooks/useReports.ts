import { supabase, useSupabaseQuery } from './useSupabase'
import type { Report } from '../lib/types'

export function useReports(limit = 20) {
  return useSupabaseQuery<Report[]>(
    () =>
      supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
    [limit],
    `reports-${limit}`,
  )
}
