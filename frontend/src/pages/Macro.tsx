import { useMemo } from 'react'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import { useCorrelations } from '../hooks/useMacro'
import { useI18n } from '../lib/i18n'

export default function Macro() {
  const { t, ta } = useI18n()
  const { data: correlations, loading } = useCorrelations()

  const corrMap = useMemo(() => {
    if (!correlations) return {}
    const map: Record<string, { value: number; date: string }> = {}
    for (const c of correlations) {
      if (!map[c.indicator]) map[c.indicator] = { value: c.value, date: c.date }
    }
    return map
  }, [correlations])

  const corrByAsset = useMemo(() => {
    const assets = ['SPX', 'GOLD', 'DXY', 'US_10Y']
    return assets.map((asset) => ({
      asset,
      corr30: corrMap[`CORR_BTC_${asset}_30D`]?.value,
      corr90: corrMap[`CORR_BTC_${asset}_90D`]?.value,
    }))
  }, [corrMap])

  const assetLabelMap: Record<string, string> = {
    SPX: t('macro.btcSpx'),
    GOLD: t('macro.btcGold'),
    DXY: t('macro.btcDxy'),
    US_10Y: t('macro.btcUs10y'),
  }

  const insights = useMemo(() => {
    const items: { type: 'bullish' | 'bearish' | 'neutral'; text: string }[] = []
    const spx = corrByAsset.find((c) => c.asset === 'SPX')
    const dxy = corrByAsset.find((c) => c.asset === 'DXY')
    const gold = corrByAsset.find((c) => c.asset === 'GOLD')

    if (spx?.corr30 != null) {
      if (spx.corr30 > 0.5) {
        items.push({ type: 'neutral', text: `${t('macro.highCorrelationSpx')} (${spx.corr30.toFixed(2)}): ${t('macro.btcRiskAsset')}` })
      } else if (spx.corr30 < 0.2) {
        items.push({ type: 'bullish', text: t('macro.lowCorrelationSpx') })
      }
    }
    if (dxy?.corr30 != null) {
      if (dxy.corr30 < -0.3) {
        items.push({ type: 'neutral', text: `${t('macro.negCorrelationDxy')} (${dxy.corr30.toFixed(2)}): ${t('macro.weakDollarFavorsBtc')}` })
      } else if (dxy.corr30 > 0.2) {
        items.push({ type: 'bearish', text: t('macro.posCorrelationDxy') })
      }
    }
    if (gold?.corr30 != null) {
      if (gold.corr30 > 0.5) {
        items.push({ type: 'bullish', text: t('macro.highCorrelationGold') })
      }
    }

    const bullish = items.filter((i) => i.type === 'bullish').length
    const bearish = items.filter((i) => i.type === 'bearish').length
    if (items.length === 0) {
      items.push({ type: 'neutral', text: t('macro.noData') })
    } else if (bullish > bearish) {
      items.push({ type: 'bullish', text: t('macro.favorable') })
    } else if (bearish > bullish) {
      items.push({ type: 'bearish', text: t('macro.unfavorable') })
    } else {
      items.push({ type: 'neutral', text: t('macro.mixed') })
    }
    return items
  }, [corrByAsset, corrMap, t])

  if (loading) return <div className="p-6"><PageHeader title="Macro" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!correlations?.length) return <div className="p-6"><PageHeader title="Macro" /><EmptyState command="btc-intel analyze macro" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('macro.title')} subtitle={t('macro.subtitle')}>
        <HelpButton
          title={t('macro.helpTitle')}
          content={ta('macro')}
        />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {corrByAsset.map((c) => (
          <MetricCard
            key={c.asset}
            title={assetLabelMap[c.asset] || `BTC vs ${c.asset}`}
            value={c.corr30 != null ? c.corr30.toFixed(3) : 'N/A'}
            subtitle={c.corr90 != null ? `90d: ${c.corr90.toFixed(3)}` : ''}
            signal={c.corr30 != null ? (Math.abs(c.corr30) > 0.5 ? t('macro.strong') : t('macro.weak')) : undefined}
          />
        ))}
      </div>

      {/* Correlation Heatmap */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-4">{t('macro.correlationMatrix')}</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-1 text-center text-xs font-mono">
          <div />
          {corrByAsset.map((c) => <div key={c.asset} className="text-text-muted py-1">{c.asset}</div>)}
          {corrByAsset.map((row) => (
            <>
              <div key={`label-${row.asset}`} className="text-text-muted py-2 text-right pr-2">{row.asset}</div>
              {corrByAsset.map((col) => {
                const val = row.asset === col.asset ? 1 : (corrMap[`CORR_BTC_${col.asset}_30D`]?.value || 0)
                const abs = Math.abs(val)
                const bg = val > 0
                  ? `rgba(34, 197, 94, ${abs * 0.5})`
                  : `rgba(239, 68, 68, ${abs * 0.5})`
                return (
                  <div key={`${row.asset}-${col.asset}`} className="py-2 rounded" style={{ backgroundColor: bg }}>
                    {val.toFixed(2)}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Interpretacion */}
      <div className="rounded-xl bg-gradient-to-br from-accent-purple/10 to-accent-btc/10 border border-accent-purple/30 p-4 md:p-6 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-3">{t('common.interpretation')}</h3>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${insight.type === 'bullish' ? 'bg-bullish' : insight.type === 'bearish' ? 'bg-bearish' : 'bg-neutral-signal'}`} />
              <p className="text-sm text-text-secondary">{insight.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
