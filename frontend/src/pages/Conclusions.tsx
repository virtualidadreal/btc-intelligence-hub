import { useState } from 'react'
import { Bot, User, Tag } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { useConclusions } from '../hooks/useConclusions'
import { formatDate } from '../lib/utils'

const CATEGORIES = ['all', 'technical', 'onchain', 'macro', 'sentiment', 'cycle', 'general']

export default function Conclusions() {
  const [category, setCategory] = useState<string>('all')
  const { data: conclusions, loading } = useConclusions(category === 'all' ? undefined : category)

  if (loading) return <div className="p-6"><PageHeader title="Conclusions" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>

  const validated = conclusions?.filter((c) => c.validated_outcome) || []
  const correct = validated.filter((c) => c.validated_outcome === 'correct').length
  const accuracy = validated.length > 0 ? ((correct / validated.length) * 100).toFixed(0) : 'N/A'

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Conclusions" subtitle="Intelligence journal">
        {validated.length > 0 && (
          <div className="text-right">
            <span className="text-2xl font-mono font-bold text-accent-btc">{accuracy}%</span>
            <span className="text-xs text-text-muted block">accuracy ({validated.length} validated)</span>
          </div>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors ${
              category === cat ? 'bg-accent-btc/20 text-accent-btc border border-accent-btc/30' : 'text-text-muted hover:text-text-secondary border border-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {!conclusions?.length ? (
        <EmptyState message="No conclusions" command='btc-intel conclude --add "text" --title "title"' />
      ) : (
        <div className="space-y-4">
          {conclusions.map((c) => (
            <div key={c.id} className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {c.source === 'ai' || c.source === 'mixed' ? (
                    <Bot className="w-4 h-4 text-accent-purple" />
                  ) : (
                    <User className="w-4 h-4 text-accent-blue" />
                  )}
                  <h3 className="font-semibold text-text-primary">{c.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-bg-tertiary px-1.5 py-0.5 rounded">{c.confidence}/10</span>
                  {c.validated_outcome && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      c.validated_outcome === 'correct' ? 'bg-bullish/20 text-bullish' : c.validated_outcome === 'incorrect' ? 'bg-bearish/20 text-bearish' : 'bg-neutral-signal/20 text-neutral-signal'
                    }`}>
                      {c.validated_outcome}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-text-secondary mt-2">{c.content}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-text-muted">{formatDate(c.date)}</span>
                <span className="text-xs bg-bg-tertiary/50 px-1.5 py-0.5 rounded text-text-muted">{c.category}</span>
                {c.tags && c.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-text-muted" />
                    {c.tags.map((t) => (
                      <span key={t} className="text-[10px] text-text-muted">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {c.data_snapshot && (
                <div className="flex gap-3 mt-2 text-[10px] font-mono text-text-muted">
                  {(c.data_snapshot as Record<string, number>).btc_price != null && <span>BTC: ${Number((c.data_snapshot as Record<string, number>).btc_price).toLocaleString()}</span>}
                  {(c.data_snapshot as Record<string, number>).cycle_score != null && <span>Score: {String((c.data_snapshot as Record<string, number>).cycle_score)}</span>}
                  {(c.data_snapshot as Record<string, number>).rsi != null && <span>RSI: {String((c.data_snapshot as Record<string, number>).rsi)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
