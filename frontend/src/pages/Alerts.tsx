import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import HelpButton from '../components/common/HelpButton'
import PageHeader from '../components/common/PageHeader'
import { useActiveAlerts } from '../hooks/useAlerts'
import { formatDate } from '../lib/utils'

const SEV_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-bearish', bg: 'bg-bearish/10 border-bearish/20' },
  warning: { icon: AlertTriangle, color: 'text-neutral-signal', bg: 'bg-neutral-signal/10 border-neutral-signal/20' },
  info: { icon: Info, color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/20' },
}

export default function Alerts() {
  const { data: alerts, loading } = useActiveAlerts()

  if (loading) return <div className="p-6"><PageHeader title="Alerts" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Alerts" subtitle={`${alerts?.length || 0} active alerts`}>
        <HelpButton
          title="Sistema de Alertas"
          content={[
            "Alertas automaticas generadas por el motor de deteccion de patrones y el Cycle Score.",
            "Las alertas se crean cuando se detectan condiciones importantes: Cycle Score > 85 (euforia, senal de precaucion), Cycle Score < 15 (capitulacion, posible oportunidad), patrones tecnicos significativos.",
            "Severidad: Critical (rojo) = requiere atencion inmediata. Warning (naranja) = vigilar de cerca. Info (azul) = informativo.",
            "Signal: Cada alerta incluye una senal (bullish/bearish) indicando la direccion esperada del movimiento.",
            "Las alertas no reconocidas permanecen activas. Usa 'btc-intel alerts ack [id]' para marcarlas como leidas.",
            "Se comprueban automaticamente con: btc-intel alerts check (tambien integrado en la rutina btc-intel morning).",
          ]}
        />
      </PageHeader>
      {!alerts?.length ? (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-8 backdrop-blur-sm text-center">
          <CheckCircle className="w-12 h-12 text-bullish mx-auto mb-3" />
          <p className="text-text-secondary">No active alerts</p>
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
                      <span>Type: {a.type}</span>
                      {a.signal && <span>Signal: {a.signal}</span>}
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
