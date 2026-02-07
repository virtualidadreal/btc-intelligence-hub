import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import HelpButton from '../components/common/HelpButton'
import PageHeader from '../components/common/PageHeader'
import { useActiveAlerts } from '../hooks/useAlerts'
import { formatDate } from '../lib/utils'
import { useI18n } from '../lib/i18n'

const SEV_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-bearish', bg: 'bg-bearish/10 border-bearish/20' },
  warning: { icon: AlertTriangle, color: 'text-neutral-signal', bg: 'bg-neutral-signal/10 border-neutral-signal/20' },
  info: { icon: Info, color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/20' },
}

export default function Alerts() {
  const { t, ta } = useI18n()
  const { data: alerts, loading } = useActiveAlerts()

  if (loading) return <div className="p-6"><PageHeader title={t('alerts.title')} /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('alerts.title')} subtitle={`${alerts?.length || 0} ${t('common.activeAlerts')}`}>
        <HelpButton
          title={t('alerts.helpTitle')}
          content={ta('alerts')}
        />
      </PageHeader>
      {!alerts?.length ? (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-8 backdrop-blur-sm text-center">
          <CheckCircle className="w-12 h-12 text-bullish mx-auto mb-3" />
          <p className="text-text-secondary">{t('alerts.noAlerts')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const config = SEV_CONFIG[a.severity as keyof typeof SEV_CONFIG] || SEV_CONFIG.info
            const Icon = config.icon
            return (
              <div key={a.id} className={`rounded-xl border p-4 backdrop-blur-sm ${config.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-text-primary">{a.title}</h3>
                      <span className={`text-xs font-mono uppercase ${config.color}`}>{a.severity}</span>
                    </div>
                    {a.description && <p className="text-sm text-text-secondary mt-1">{a.description}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-text-muted">
                      <span>{t('alerts.type')} {a.type}</span>
                      {a.signal && <span>{t('alerts.signal')} {a.signal}</span>}
                      <span>{formatDate(a.date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
