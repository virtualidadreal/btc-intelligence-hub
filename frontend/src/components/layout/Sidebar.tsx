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
  X,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/trading', label: 'Trading', icon: CandlestickChart },
  { to: '/cycles', label: 'Ciclos', icon: RefreshCcw },
  { to: '/technical', label: 'Tecnico', icon: TrendingUp },
  { to: '/onchain', label: 'On-Chain', icon: Link2 },
  { to: '/macro', label: 'Macro', icon: Globe },
  { to: '/sentiment', label: 'Sentimiento', icon: MessageCircle },
  { to: '/cycle-score', label: 'Cycle Score', icon: Target },
  { to: '/risk', label: 'Riesgo', icon: Shield },
  { to: '/alerts', label: 'Alertas', icon: AlertTriangle },
  { to: '/conclusions', label: 'Conclusiones', icon: Brain },
  { to: '/reports', label: 'Informes', icon: FileText },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
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
          {navItems.map(({ to, label, icon: Icon }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border text-xs text-text-muted">
          v1.0.0
        </div>
      </aside>
    </>
  )
}
