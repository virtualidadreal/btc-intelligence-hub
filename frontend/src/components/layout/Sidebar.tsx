import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  RefreshCcw,
  TrendingUp,
  CandlestickChart,
  Link2,
  Globe,
  MessageCircle,
  Target,
  AlertTriangle,
  Brain,
  FileText,
  Shield,
  Wallet,
  Info,
  X,
  Languages,
} from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import type { LucideIcon } from 'lucide-react'

const navItems: { to: string; labelKey: string; icon: LucideIcon }[] = [
  { to: '/', labelKey: 'nav.overview', icon: LayoutDashboard },
  { to: '/trading', labelKey: 'nav.trading', icon: CandlestickChart },
  { to: '/cycles', labelKey: 'nav.cycles', icon: RefreshCcw },
  { to: '/technical', labelKey: 'nav.technical', icon: TrendingUp },
  { to: '/onchain', labelKey: 'nav.onchain', icon: Link2 },
  { to: '/macro', labelKey: 'nav.macro', icon: Globe },
  { to: '/sentiment', labelKey: 'nav.sentiment', icon: MessageCircle },
  { to: '/cycle-score', labelKey: 'nav.cycleScore', icon: Target },
  { to: '/risk', labelKey: 'nav.risk', icon: Shield },
  { to: '/alerts', labelKey: 'nav.alerts', icon: AlertTriangle },
  { to: '/conclusions', labelKey: 'nav.conclusions', icon: Brain },
  { to: '/reports', labelKey: 'nav.reports', icon: FileText },
  { to: '/portfolio', labelKey: 'nav.portfolio', icon: Wallet },
  { to: '/info', labelKey: 'nav.info', icon: Info },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { lang, setLang, t } = useI18n()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />
      )}

      <aside className={`
        w-64 h-screen bg-bg-secondary border-r border-border flex flex-col fixed left-0 top-0 z-40
        transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:w-56
      `}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-lg font-bold text-accent-btc font-[family-name:var(--font-display)]">
            BTC Intel Hub
          </h1>
          <button onClick={onClose} className="md:hidden text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-bg-tertiary text-accent-blue border-r-2 border-accent-blue'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
                }`
              }
            >
              <Icon size={18} />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 transition-colors"
          >
            <Languages size={14} />
            <span className={lang === 'es' ? 'font-bold text-accent-btc' : ''}>ES</span>
            <span className="text-text-muted">/</span>
            <span className={lang === 'en' ? 'font-bold text-accent-btc' : ''}>EN</span>
          </button>
          <div className="mt-1 text-[10px] text-text-muted px-2">v1.0.0</div>
        </div>
      </aside>
    </>
  )
}
