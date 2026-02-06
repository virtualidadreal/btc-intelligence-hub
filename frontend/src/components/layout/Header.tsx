import { Bitcoin, Menu } from 'lucide-react'
import { useLatestPrice } from '../../hooks/usePrices'
import { useBinancePrice } from '../../hooks/useBinancePrice'
import { formatPrice } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'

interface HeaderProps {
  onMenuToggle: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { t } = useI18n()
  const { data: prices } = useLatestPrice()
  const livePrice = useBinancePrice()
  const fallbackPrice = prices?.[0]

  const displayPrice = livePrice.price > 0 ? livePrice.price : fallbackPrice?.close ?? 0
  const isLive = livePrice.isLive && livePrice.price > 0

  return (
    <header className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-4 md:px-6 fixed top-0 left-0 md:left-56 right-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="md:hidden text-text-muted hover:text-text-primary">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Bitcoin size={16} className="text-accent-btc" />
          <span className="hidden sm:inline">{t('header.title')}</span>
          <span className="sm:hidden">{t('header.titleShort')}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {displayPrice > 0 && (
          <span className="font-mono text-accent-btc font-semibold">
            {formatPrice(displayPrice)}
          </span>
        )}
        {isLive ? (
          <span className="text-text-muted hidden sm:inline">{t('header.live')}</span>
        ) : fallbackPrice ? (
          <span className="text-text-muted hidden sm:inline">{fallbackPrice.date}</span>
        ) : null}
        <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-bullish animate-pulse' : displayPrice > 0 ? 'bg-neutral-signal' : 'bg-text-muted'}`} />
      </div>
    </header>
  )
}
