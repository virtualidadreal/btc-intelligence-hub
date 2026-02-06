import { supabase, useSupabaseQuery } from './useSupabase'
import type { Cycle } from '../lib/types'

export function useCycles() {
  return useSupabaseQuery<Cycle[]>(
    () => supabase.from('cycles').select('*').order('start_date', { ascending: true }),
    [],
    'cycles',
  )
}
