import { supabase, useSupabaseQuery } from './useSupabase'
import type { Alert } from '../lib/types'

export function useActiveAlerts() {
  return useSupabaseQuery<Alert[]>(
    () =>
      supabase
        .from('alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('date', { ascending: false })
        .limit(50),
  )
}
