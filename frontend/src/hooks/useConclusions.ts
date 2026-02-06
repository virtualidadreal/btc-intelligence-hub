import { supabase, useSupabaseQuery } from './useSupabase'
import type { Conclusion } from '../lib/types'

export function useConclusions(category?: string, limit = 50) {
  return useSupabaseQuery<Conclusion[]>(() => {
    let query = supabase
      .from('conclusions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (category) query = query.eq('category', category)
    return query.limit(limit)
  }, [category, limit])
}
