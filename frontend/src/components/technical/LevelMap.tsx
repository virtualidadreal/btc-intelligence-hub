import { useMemo } from 'react'
import { formatPrice } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { PriceLevel } from '../../lib/types'

interface Props {
  levels: PriceLevel[]
  currentPrice: number
}

export default function LevelMap({ levels, currentPrice }: Props) {
  const { t } = useI18n()

  const { resistances, supports } = useMemo(() => {
    const active = levels.filter((l) => l.strength >= 5)
    const res = active
      .filter((l) => l.price > currentPrice)
      .sort((a, b) => a.price - b.price)
      .slice(0, 8)
    const sup = active
      .filter((l) => l.price <= currentPrice)
      .sort((a, b) => b.price - a.price)
      .slice(0, 8)
    return { resistances: res.reverse(), supports: sup }
  }, [levels, currentPrice])

  if (!resistances.length && !supports.length) {
    return <p className="text-sm text-text-muted">{t('technical.noLevels')}</p>
  }

  return (
    <div className="space-y-1">
      {/* Resistances */}
      <div className="text-[10px] font-mono text-bearish tracking-wider">{t('technical.resistances')}</div>
      {resistances.map((l) => (
        <LevelBar key={l.id} level={l} currentPrice={currentPrice} />
      ))}

      {/* Current price divider */}
      <div className="flex items-center gap-2 py-1.5 my-1 border-y border-accent-btc/40">
        <span className="text-xs font-mono text-accent-btc font-bold w-24 text-right">
          {formatPrice(currentPrice)}
        </span>
        <div className="flex-1 h-0.5 bg-accent-btc/40 rounded" />
        <span className="text-[10px] font-mono text-accent-btc">{t('technical.currentPrice')}</span>
      </div>

      {/* Supports */}
      <div className="text-[10px] font-mono text-bullish tracking-wider">{t('technical.supports')}</div>
      {supports.map((l) => (
        <LevelBar key={l.id} level={l} currentPrice={currentPrice} />
      ))}
    </div>
  )
}

function LevelBar({ level, currentPrice }: { level: PriceLevel; currentPrice: number }) {
  const { t } = useI18n()
  const widthPct = (level.strength / 20) * 100
  const distance = ((level.price - currentPrice) / currentPrice) * 100
  const isSupport = level.price <= currentPrice

  const colorClass =
    level.strength >= 15
      ? 'bg-red-500'
      : level.strength >= 10
        ? 'bg-orange-500'
        : level.strength >= 5
          ? 'bg-yellow-500'
          : 'bg-gray-600'

  return (
    <div className="flex items-center gap-2 py-0.5 group" title={`${level.source?.join(', ') || ''} | ${level.touch_count} toques`}>
      <span className="text-xs text-text-secondary w-24 text-right font-mono">
        {formatPrice(level.price)}
      </span>
      <div className="flex-1 h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-muted w-10 text-right">{level.strength}/20</span>
      <span className={`text-[10px] font-mono w-14 text-right ${isSupport ? 'text-bullish' : 'text-bearish'}`}>
        {distance > 0 ? '+' : ''}{distance.toFixed(1)}%
      </span>
      <div className="flex gap-0.5 w-12 text-[10px]">
        {level.fib_level != null && <span title={t('technical.fibonacci')}>&#9671;</span>}
        {level.is_role_flip && <span title={t('technical.roleFlip')}>&#8693;</span>}
        {level.is_high_volume && <span title={t('technical.highVolume')}>&#9646;</span>}
        {level.is_psychological && <span title={t('technical.psychological')}>&#9679;</span>}
      </div>
    </div>
  )
}
