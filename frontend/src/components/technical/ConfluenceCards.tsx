import { formatPrice } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import type { ConfluenceZone } from '../../lib/types'

interface Props {
  zones: ConfluenceZone[]
  currentPrice: number
}

export default function ConfluenceCards({ zones, currentPrice }: Props) {
  const { t } = useI18n()

  if (!zones.length) {
    return <p className="text-sm text-text-muted">{t('technical.confluence.noZones')}</p>
  }

  return (
    <div className="space-y-3">
      {zones.slice(0, 6).map((z) => {
        const isCritical = z.strength >= 15 || z.has_gran_nivel
        const isSupport = z.type === 'support'
        const distPct = ((z.price_mid - currentPrice) / currentPrice) * 100

        return (
          <div
            key={z.id}
            className={`rounded-xl border p-3 backdrop-blur-sm ${
              isCritical
                ? isSupport
                  ? 'border-bullish/40 bg-bullish/5'
                  : 'border-bearish/40 bg-bearish/5'
                : 'border-border bg-bg-secondary/40'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${isSupport ? 'bg-bullish' : 'bg-bearish'}`} />
              <span className="text-xs font-mono font-bold text-text-primary">
                {isCritical ? t('technical.confluence.critical') : t('technical.confluence.strong')}
                {' — '}
                {isSupport ? t('technical.confluence.support') : t('technical.confluence.resistance')}
              </span>
            </div>

            {/* Price range + distance */}
            <div className="text-sm font-mono text-text-primary mb-2">
              {formatPrice(z.price_low)} — {formatPrice(z.price_high)}
              <span className={`ml-2 text-xs ${distPct < 0 ? 'text-bullish' : 'text-bearish'}`}>
                ({Math.abs(distPct).toFixed(1)}% {distPct < 0 ? t('technical.confluence.below') : t('technical.confluence.above')})
              </span>
            </div>

            {/* Fibonacci ratios if any */}
            {z.fib_ratios && z.fib_ratios.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {z.fib_ratios.map((r) => (
                  <span key={r} className="text-[10px] px-1.5 py-0.5 rounded border border-accent-btc/30 bg-accent-btc/10 text-accent-btc font-mono">
                    Fib {r}
                  </span>
                ))}
              </div>
            )}

            {/* Gran Nivel badge */}
            {z.has_gran_nivel && (
              <div className="mb-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-accent-purple/30 bg-accent-purple/10 text-accent-purple font-mono">
                  {t('technical.confluence.granNivel')}
                </span>
              </div>
            )}

            {/* Timeframes */}
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>{t('technical.confluence.timeframes')}: {z.timeframes.join(' · ')}</span>
              <span>{t('technical.confluence.strength')}: <strong className="text-text-primary">{z.strength}/20</strong></span>
            </div>

            {/* Strength bar */}
            <div className="mt-1.5 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${z.strength >= 15 ? 'bg-red-500' : z.strength >= 10 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                style={{ width: `${(z.strength / 20) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
