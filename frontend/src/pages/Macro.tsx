import { useMemo } from 'react'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import { useCorrelations } from '../hooks/useMacro'

export default function Macro() {
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

  if (loading) return <div className="p-6"><PageHeader title="Macro" /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>
  if (!correlations?.length) return <div className="p-6"><PageHeader title="Macro" /><EmptyState command="btc-intel analyze macro" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Macro Analysis" subtitle="BTC correlations with traditional assets">
        <HelpButton
          title="Analisis Macro"
          content={[
            "Correlaciones entre Bitcoin y activos tradicionales calculadas sobre ventanas de 30 y 90 dias.",
            "SPX (S&P 500): Indice de las 500 mayores empresas de EEUU. Correlacion positiva = BTC se mueve con las acciones. En 2022-2024, BTC ha mostrado alta correlacion con SPX.",
            "GOLD (Oro): Reserva de valor tradicional. BTC compite con el oro como 'oro digital'. Correlacion positiva indica que ambos actuan como cobertura.",
            "DXY (Indice Dolar): Mide la fuerza del dolar. Correlacion tipicamente NEGATIVA: cuando el dolar sube, BTC tiende a bajar y viceversa.",
            "US_10Y (Bono 10 anos): Rendimiento del bono del Tesoro a 10 anos. Tipos altos suelen presionar activos de riesgo como BTC.",
            "Valores cercanos a +1 o -1 indican correlacion fuerte. Cercanos a 0 = poca relacion. La matriz muestra las correlaciones cruzadas a 30 dias.",
          ]}
        />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {corrByAsset.map((c) => (
          <MetricCard
            key={c.asset}
            title={`BTC vs ${c.asset}`}
            value={c.corr30 != null ? c.corr30.toFixed(3) : 'N/A'}
            subtitle={c.corr90 != null ? `90d: ${c.corr90.toFixed(3)}` : ''}
            signal={c.corr30 != null ? (Math.abs(c.corr30) > 0.5 ? 'strong' : 'weak') : undefined}
          />
        ))}
      </div>

      {/* Correlation Heatmap */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
        <h3 className="font-display font-semibold mb-4">Correlation Matrix (30D)</h3>
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
    </div>
  )
}
