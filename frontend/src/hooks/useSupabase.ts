import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface UseSupabaseResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryFn<T> = () => PromiseLike<{ data: T | null; error: any }>

// --- In-memory SWR cache ---
const CACHE_TTL_MS = 60_000 // 60 seconds

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>()

function getCacheKey(deps: unknown[]): string {
  return JSON.stringify(deps)
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  // Return cached data even if stale (stale-while-revalidate)
  return entry.data as T
}

function isCacheFresh(key: string): boolean {
  const entry = cache.get(key)
  if (!entry) return false
  return Date.now() - entry.timestamp < CACHE_TTL_MS
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}
// --- End cache ---

export function useSupabaseQuery<T>(
  queryFn: QueryFn<T>,
  deps: unknown[] = [],
  key?: string,
): UseSupabaseResult<T> {
  const cacheKey = key || getCacheKey(deps)
  const cachedData = getCached<T>(cacheKey)

  const [data, setData] = useState<T | null>(cachedData)
  const [loading, setLoading] = useState(cachedData === null)
  const [error, setError] = useState<string | null>(null)
  const cacheKeyRef = useRef(cacheKey)
  cacheKeyRef.current = cacheKey

  const fetchData = useCallback(async () => {
    const currentKey = getCacheKey(deps)

    // If cache is fresh, skip network request
    if (isCacheFresh(currentKey)) {
      const fresh = getCached<T>(currentKey)
      if (fresh !== null) {
        setData(fresh)
        setLoading(false)
        return
      }
    }

    // If we have stale data, don't show loading (stale-while-revalidate)
    const stale = getCached<T>(currentKey)
    if (stale === null) {
      setLoading(true)
    }

    setError(null)
    try {
      const result = await queryFn()
      if (result.error) {
        setError(result.error.message || 'Unknown error')
      } else {
        if (result.data !== null) {
          setCache(currentKey, result.data)
        }
        // Only update state if the cache key hasn't changed during the fetch
        if (cacheKeyRef.current === currentKey) {
          setData(result.data)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (cacheKeyRef.current === currentKey) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export { supabase }
