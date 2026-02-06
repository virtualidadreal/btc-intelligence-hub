import { Bitcoin, Menu } from 'lucide-react'
import { useLatestPrice } from '../../hooks/usePrices'
import { formatPrice } from '../../lib/utils'

interface HeaderProps {
  onMenuToggle: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { data: prices } = useLatestPrice()
  const price = prices?.[0]

  return (
    <header className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-4 md:px-6 fixed top-0 left-0 md:left-56 right-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="md:hidden text-text-muted hover:text-text-primary">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Bitcoin size={16} className="text-accent-btc" />
          <span className="hidden sm:inline">Centro de Inteligencia Bitcoin</span>
          <span className="sm:hidden">BTC Intel</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {price && (
          <span className="font-mono text-accent-btc font-semibold">
            {formatPrice(price.close)}
          </span>
        )}
        {price && (
          <span className="text-text-muted hidden sm:inline">{price.date}</span>
        )}
        <span className={`w-2 h-2 rounded-full ${price ? 'bg-bullish' : 'bg-text-muted'}`} />
      </div>
    </header>
  )
}
