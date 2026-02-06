import { useCallback } from 'react'
import { supabase, useSupabaseQuery } from './useSupabase'

export interface PortfolioPosition {
  id: number
  opened_at: string
  closed_at: string | null
  direction: string
  entry_price: number
  exit_price: number | null
  size_btc: number
  sl: number | null
  tp1: number | null
  tp2: number | null
  status: string
  pnl_usd: number | null
  pnl_percent: number | null
  notes: string | null
  created_at: string
}

export function useOpenPositions() {
  return useSupabaseQuery<PortfolioPosition[]>(
    () =>
      supabase
        .from('portfolio_positions')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false }),
    [],
    'portfolio-open',
  )
}

export function useClosedPositions(limit = 50) {
  return useSupabaseQuery<PortfolioPosition[]>(
    () =>
      supabase
        .from('portfolio_positions')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(limit),
    [limit],
    `portfolio-closed-${limit}`,
  )
}

export function usePortfolioActions() {
  const openPosition = useCallback(
    async (data: {
      direction: string
      entry_price: number
      size_btc: number
      sl?: number
      tp1?: number
      tp2?: number
      notes?: string
    }) => {
      const { error } = await supabase.from('portfolio_positions').insert({
        direction: data.direction,
        entry_price: data.entry_price,
        size_btc: data.size_btc,
        sl: data.sl || null,
        tp1: data.tp1 || null,
        tp2: data.tp2 || null,
        notes: data.notes || null,
        status: 'open',
      })
      if (error) throw error
    },
    [],
  )

  const closePosition = useCallback(
    async (id: number, exitPrice: number) => {
      // Get the position first
      const { data: pos } = await supabase
        .from('portfolio_positions')
        .select('*')
        .eq('id', id)
        .single()

      if (!pos) throw new Error('Position not found')

      const entryPrice = Number(pos.entry_price)
      const sizeBtc = Number(pos.size_btc)
      const isLong = pos.direction === 'LONG'

      const pnlPercent = isLong
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitPrice) / entryPrice) * 100
      const pnlUsd = (exitPrice - entryPrice) * sizeBtc * (isLong ? 1 : -1)

      const { error } = await supabase
        .from('portfolio_positions')
        .update({
          exit_price: exitPrice,
          closed_at: new Date().toISOString(),
          status: 'closed',
          pnl_usd: Math.round(pnlUsd * 100) / 100,
          pnl_percent: Math.round(pnlPercent * 100) / 100,
        })
        .eq('id', id)

      if (error) throw error
    },
    [],
  )

  return { openPosition, closePosition }
}
