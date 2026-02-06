import { Bitcoin } from 'lucide-react'
import { useLatestPrice } from '../../hooks/usePrices'
import { formatPrice } from '../../lib/utils'

export default function Header() {
  const { data: prices } = useLatestPrice()
  const price = prices?.[0]

  return (
    <header className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-6 fixed top-0 left-56 right-0 z-10">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Bitcoin size={16} className="text-accent-btc" />
        <span>Centro de Inteligencia Bitcoin</span>
      </div>
      <div className="flex items-center gap-4 text-xs">
        {price && (
          <span className="font-mono text-accent-btc font-semibold">
            {formatPrice(price.close)}
          </span>
        )}
        {price && (
          <span className="text-text-muted">{price.date}</span>
        )}
        <span className={`w-2 h-2 rounded-full ${price ? 'bg-bullish' : 'bg-text-muted'}`} />
      </div>
    </header>
  )
}
