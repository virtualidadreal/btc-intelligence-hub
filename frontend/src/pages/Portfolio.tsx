import { useState, useMemo } from 'react'
import { Wallet, Plus, X, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import { useOpenPositions, useClosedPositions, usePortfolioActions } from '../hooks/usePortfolio'
import type { PortfolioPosition } from '../hooks/usePortfolio'
import { useBinancePrice } from '../hooks/useBinancePrice'
import { useLatestPrice } from '../hooks/usePrices'
import { formatPrice, formatPercent, cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'

function livePnl(pos: PortfolioPosition, currentPrice: number) {
  const isLong = pos.direction === 'LONG'
  const entry = Number(pos.entry_price)
  const size = Number(pos.size_btc)
  const pctChange = isLong
    ? ((currentPrice - entry) / entry) * 100
    : ((entry - currentPrice) / entry) * 100
  const pnlUsd = (currentPrice - entry) * size * (isLong ? 1 : -1)
  return { pctChange, pnlUsd }
}

export default function Portfolio() {
  const { t } = useI18n()
  const { data: openPositions, refetch: refetchOpen } = useOpenPositions()
  const { data: closedPositions, refetch: refetchClosed } = useClosedPositions()
  const { openPosition, closePosition } = usePortfolioActions()
  const livePrice = useBinancePrice()
  const { data: prices } = useLatestPrice()

  const currentPrice = livePrice.price > 0 ? livePrice.price : (prices?.[0]?.close ?? 0)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    direction: 'LONG',
    entry_price: '',
    size_btc: '',
    sl: '',
    tp1: '',
    tp2: '',
    notes: '',
  })
  const [closing, setClosing] = useState<number | null>(null)

  const stats = useMemo(() => {
    if (!closedPositions || closedPositions.length === 0) return null
    const wins = closedPositions.filter((p) => (p.pnl_usd ?? 0) > 0).length
    const totalPnl = closedPositions.reduce((s, p) => s + (p.pnl_usd ?? 0), 0)
    return {
      totalPnl,
      winRate: Math.round((wins / closedPositions.length) * 100),
      totalTrades: closedPositions.length,
      avgPnl: totalPnl / closedPositions.length,
    }
  }, [closedPositions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await openPosition({
        direction: form.direction,
        entry_price: Number(form.entry_price) || currentPrice,
        size_btc: Number(form.size_btc),
        sl: form.sl ? Number(form.sl) : undefined,
        tp1: form.tp1 ? Number(form.tp1) : undefined,
        tp2: form.tp2 ? Number(form.tp2) : undefined,
        notes: form.notes || undefined,
      })
      setShowForm(false)
      setForm({ direction: 'LONG', entry_price: '', size_btc: '', sl: '', tp1: '', tp2: '', notes: '' })
      refetchOpen()
    } catch {
      // Handle silently
    }
  }

  const handleClose = async (id: number) => {
    setClosing(id)
    try {
      await closePosition(id, currentPrice)
      refetchOpen()
      refetchClosed()
    } catch {
      // Handle silently
    }
    setClosing(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('portfolio.title')} subtitle={t('portfolio.subtitle')} />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title={t('portfolio.totalPnl')}
            value={`$${stats.totalPnl.toFixed(2)}`}
            icon={<Wallet className="w-4 h-4" />}
          />
          <MetricCard
            title={t('portfolio.winRate')}
            value={`${stats.winRate}%`}
            icon={<BarChart3 className="w-4 h-4" />}
          />
          <MetricCard
            title={t('portfolio.totalTrades')}
            value={`${stats.totalTrades}`}
            icon={<BarChart3 className="w-4 h-4" />}
          />
          <MetricCard
            title={t('portfolio.avgPnl')}
            value={`$${stats.avgPnl.toFixed(2)}`}
            icon={<BarChart3 className="w-4 h-4" />}
          />
        </div>
      )}

      {/* New Position Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setForm((f) => ({ ...f, entry_price: currentPrice > 0 ? currentPrice.toString() : '' }))
            setShowForm(!showForm)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-btc text-bg-primary rounded-lg text-sm font-semibold hover:bg-accent-btc/80 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {t('portfolio.newPosition')}
        </button>
      </div>

      {/* New Position Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t('portfolio.direction')}</label>
              <select
                value={form.direction}
                onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="LONG">{t('portfolio.long')}</option>
                <option value="SHORT">{t('portfolio.short')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t('portfolio.entryPrice')}</label>
              <input
                type="number"
                step="0.01"
                value={form.entry_price}
                onChange={(e) => setForm((f) => ({ ...f, entry_price: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t('portfolio.size')}</label>
              <input
                type="number"
                step="0.000001"
                value={form.size_btc}
                onChange={(e) => setForm((f) => ({ ...f, size_btc: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t('portfolio.stopLoss')}</label>
              <input
                type="number"
                step="0.01"
                value={form.sl}
                onChange={(e) => setForm((f) => ({ ...f, sl: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t('portfolio.takeProfit1')}</label>
              <input
                type="number"
                step="0.01"
                value={form.tp1}
                onChange={(e) => setForm((f) => ({ ...f, tp1: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t('portfolio.takeProfit2')}</label>
              <input
                type="number"
                step="0.01"
                value={form.tp2}
                onChange={(e) => setForm((f) => ({ ...f, tp2: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">{t('portfolio.notes')}</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-bullish text-bg-primary rounded-lg text-sm font-semibold hover:bg-bullish/80 transition-colors"
          >
            {t('portfolio.open')}
          </button>
        </form>
      )}

      {/* Open Positions */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-accent-btc" />
          {t('portfolio.openPositions')}
        </h3>
        {!openPositions?.length ? (
          <p className="text-sm text-text-muted">{t('portfolio.noPositions')}</p>
        ) : (
          <div className="space-y-3">
            {openPositions.map((pos) => {
              const { pctChange, pnlUsd } = currentPrice > 0 ? livePnl(pos, currentPrice) : { pctChange: 0, pnlUsd: 0 }
              const isPositive = pnlUsd >= 0
              return (
                <div key={pos.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex items-center gap-1 font-bold text-sm', pos.direction === 'LONG' ? 'text-bullish' : 'text-bearish')}>
                      {pos.direction === 'LONG' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                      {pos.direction}
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      <span>{formatPrice(Number(pos.entry_price))}</span>
                      <span className="text-text-muted mx-1">x</span>
                      <span>{Number(pos.size_btc).toFixed(4)} BTC</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={cn('text-sm font-mono font-bold', isPositive ? 'text-bullish' : 'text-bearish')}>
                        ${pnlUsd.toFixed(2)}
                      </div>
                      <div className={cn('text-xs font-mono', isPositive ? 'text-bullish' : 'text-bearish')}>
                        {formatPercent(pctChange)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleClose(pos.id)}
                      disabled={closing === pos.id}
                      className="px-3 py-1 bg-bearish/20 text-bearish rounded text-xs font-semibold hover:bg-bearish/30 transition-colors disabled:opacity-50"
                    >
                      {t('portfolio.close')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Closed Positions */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-3">{t('portfolio.closedPositions')}</h3>
        {!closedPositions?.length ? (
          <p className="text-sm text-text-muted">{t('portfolio.noHistory')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-text-muted uppercase border-b border-border/50">
                  <th className="text-left py-2 px-2">{t('portfolio.direction')}</th>
                  <th className="text-right py-2 px-2">{t('portfolio.entryPrice')}</th>
                  <th className="text-right py-2 px-2">Exit</th>
                  <th className="text-right py-2 px-2">{t('portfolio.size')}</th>
                  <th className="text-right py-2 px-2">{t('portfolio.pnl')}</th>
                  <th className="text-right py-2 px-2">{t('portfolio.pnlPercent')}</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((pos) => (
                  <tr key={pos.id} className="border-b border-border/30">
                    <td className={cn('py-2 px-2 font-mono text-xs font-bold', pos.direction === 'LONG' ? 'text-bullish' : 'text-bearish')}>
                      {pos.direction}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{formatPrice(Number(pos.entry_price))}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{pos.exit_price ? formatPrice(Number(pos.exit_price)) : '—'}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs">{Number(pos.size_btc).toFixed(4)}</td>
                    <td className={cn('py-2 px-2 text-right font-mono text-xs font-bold', (pos.pnl_usd ?? 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
                      ${(pos.pnl_usd ?? 0).toFixed(2)}
                    </td>
                    <td className={cn('py-2 px-2 text-right font-mono text-xs', (pos.pnl_percent ?? 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
                      {formatPercent(pos.pnl_percent ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
