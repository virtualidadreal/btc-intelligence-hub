import { useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus, Info, Target, ShieldAlert, Bitcoin } from 'lucide-react'
import { SignalBadge } from '../components/common/MetricCard'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import HelpButton from '../components/common/HelpButton'
import { usePriceChanges } from '../hooks/usePrices'
import { useLatestCycleScore } from '../hooks/useCycleScore'
import { useLatestSignals, useLatestIndicators, useTradingRecommendations, SIGNAL_LABELS } from '../hooks/useTechnical'
import type { TradingRecommendation, SignalDetail, TradingLevels } from '../hooks/useTechnical'
import { useLatestSentiment } from '../hooks/useSentiment'
import { useSupabaseQuery, supabase } from '../hooks/useSupabase'
import type { OnchainMetric } from '../lib/types'
import { formatPrice, formatPercent, cn } from '../lib/utils'

const TIMEFRAME_DESC: Record<string, string> = {
  '1H': 'Scalping / Intraday',
  '4H': 'Intraday / Swing',
  '1D': 'Swing / Position',
  '1W': 'Position / Macro',
}

function signalExplanation(key: string, detail: SignalDetail): string {
  const label = SIGNAL_LABELS[key] || key
  const dir = detail.score > 0 ? 'alcista' : detail.score < 0 ? 'bajista' : 'neutral'
  const val = detail.rawValue != null ? detail.rawValue.toFixed(1) : '?'

  switch (key) {
    case 'RSI_14':
      if (detail.score === 1) return `${label} en ${val} — sobreventa extrema, alta probabilidad de rebote`
      if (detail.score === 0.5) return `${label} en ${val} — zona de sobreventa, momentum comprando`
      if (detail.score === -0.5) return `${label} en ${val} — zona de sobrecompra, presion vendedora`
      if (detail.score === -1) return `${label} en ${val} — sobrecompra extrema, alto riesgo de correccion`
      return `${label} en ${val} — zona neutral, sin sesgo claro`
    case 'MACD':
      if (detail.score > 0) return `${label} ${dir} — histogram positivo, momentum alcista creciente`
      if (detail.score < 0) return `${label} ${dir} — histogram negativo, momentum bajista`
      return `${label} neutral — sin cruce claro, momentum plano`
    case 'SMA_CROSS':
      if (detail.score > 0) return `${label} ${dir} — media rapida sobre lenta (golden cross), tendencia alcista`
      if (detail.score < 0) return `${label} ${dir} — media rapida bajo lenta (death cross), tendencia bajista`
      return `${label} neutral — medias convergiendo, sin direccion clara`
    case 'BB':
      if (detail.score > 0) return `Bollinger ${dir} — precio cerca de banda inferior, posible rebote`
      if (detail.score < 0) return `Bollinger ${dir} — precio cerca de banda superior, posible rechazo`
      return `Bollinger neutral — precio centrado en las bandas`
    case 'FEAR_GREED':
      if (detail.score === 1) return `Fear & Greed en ${val} — codicia extrema (contrarian: cautela)`
      if (detail.score === 0.5) return `Fear & Greed en ${val} — codicia moderada`
      if (detail.score === -0.5) return `Fear & Greed en ${val} — miedo (contrarian: oportunidad)`
      if (detail.score === -1) return `Fear & Greed en ${val} — miedo extremo (contrarian: fuerte oportunidad de compra)`
      return `Fear & Greed en ${val} — sentimiento neutral`
    case 'HASH_RATE_MOM':
      if (detail.score > 0) return `Hash Rate momentum ${dir} — mineros acumulando, red saludable`
      if (detail.score < 0) return `Hash Rate momentum ${dir} — mineros capitulando, posible presion de venta`
      return `Hash Rate estable — sin cambios significativos en la red`
    case 'NVT_RATIO':
      if (detail.score > 0) return `NVT Ratio ${dir} — red infravalorada respecto a transacciones`
      if (detail.score < 0) return `NVT Ratio ${dir} — red sobrevalorada, posible burbuja`
      return `NVT Ratio neutral — valoracion acorde al uso de red`
    case 'CYCLE_SCORE':
      if (detail.score > 0) return `Cycle Score en ${val} — fase temprana del ciclo, alto potencial alcista`
      if (detail.score < 0) return `Cycle Score en ${val} — fase avanzada del ciclo, riesgo creciente`
      return `Cycle Score en ${val} — mitad del ciclo, equilibrio riesgo/recompensa`
    default:
      return `${label}: ${val} (${dir})`
  }
}

function directionColor(dir: string) {
  if (dir === 'LONG') return 'text-bullish'
  if (dir === 'SHORT') return 'text-bearish'
  return 'text-neutral-signal'
}

function directionBg(dir: string) {
  if (dir === 'LONG') return 'bg-bullish/10 border-bullish/20'
  if (dir === 'SHORT') return 'bg-bearish/10 border-bearish/20'
  return 'bg-neutral-signal/10 border-neutral-signal/20'
}

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  if (direction === 'LONG') return <ArrowUp className={className || 'w-5 h-5'} />
  if (direction === 'SHORT') return <ArrowDown className={className || 'w-5 h-5'} />
  return <Minus className={className || 'w-5 h-5'} />
}

function ContributionBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0
  const color = value > 0 ? 'bg-bullish' : value < 0 ? 'bg-bearish' : 'bg-neutral-signal'

  return (
    <div className="w-full flex items-center gap-1">
      <div className="flex w-1/2 justify-end">
        {value < 0 && <div className={cn(color, 'h-2 rounded-l')} style={{ width: `${pct}%` }} />}
      </div>
      <div className="w-px h-3 bg-border flex-shrink-0" />
      <div className="flex w-1/2 justify-start">
        {value > 0 && <div className={cn(color, 'h-2 rounded-r')} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  )
}

function LevelsPanel({ levels, direction }: { levels: TradingLevels; direction: string }) {
  const isLong = direction === 'LONG'

  return (
    <div className="rounded-lg border border-border bg-bg-primary/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-accent-btc" />
        <span className="text-xs font-display font-semibold text-text-secondary">Niveles de Operacion</span>
      </div>

      {/* Visual price ladder */}
      <div className="flex flex-col gap-1.5 mb-4">
        {isLong ? (
          <>
            <LevelRow label="TP2" price={levels.tp2} pct={`+${levels.tp2Percent}%`} color="text-bullish" bg="bg-bullish/10" rr={`R:R ${levels.riskReward2}`} />
            <LevelRow label="TP1" price={levels.tp1} pct={`+${levels.tp1Percent}%`} color="text-bullish" bg="bg-bullish/5" rr={`R:R ${levels.riskReward1}`} />
            <LevelRow label="ENTRY" price={levels.entry} pct="" color="text-accent-btc" bg="bg-accent-btc/10" />
            <LevelRow label="SL" price={levels.sl} pct={`${levels.slPercent}%`} color="text-bearish" bg="bg-bearish/10" />
          </>
        ) : (
          <>
            <LevelRow label="SL" price={levels.sl} pct={`${levels.slPercent}%`} color="text-bearish" bg="bg-bearish/10" />
            <LevelRow label="ENTRY" price={levels.entry} pct="" color="text-accent-btc" bg="bg-accent-btc/10" />
            <LevelRow label="TP1" price={levels.tp1} pct={`+${levels.tp1Percent}%`} color="text-bullish" bg="bg-bullish/5" rr={`R:R ${levels.riskReward1}`} />
            <LevelRow label="TP2" price={levels.tp2} pct={`+${levels.tp2Percent}%`} color="text-bullish" bg="bg-bullish/10" rr={`R:R ${levels.riskReward2}`} />
          </>
        )}
      </div>

      {/* Method explanation */}
      <div className="text-[10px] text-text-muted leading-relaxed space-y-0.5">
        <p className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Calculo basado en: {levels.method}</p>
        <p>SL ajustado por confianza de la señal. Mayor confianza = SL mas ajustado.</p>
      </div>
    </div>
  )
}

function LevelRow({ label, price, pct, color, bg, rr }: { label: string; price: number; pct: string; color: string; bg: string; rr?: string }) {
  return (
    <div className={cn('flex items-center justify-between rounded-lg px-3 py-2', bg)}>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-mono font-bold w-12', color)}>{label}</span>
        <span className="font-mono text-sm font-bold">{formatPrice(price)}</span>
      </div>
      <div className="flex items-center gap-2">
        {pct && <span className={cn('text-xs font-mono', color)}>{pct}</span>}
        {rr && <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{rr}</span>}
      </div>
    </div>
  )
}

function TimeframeDetail({ rec }: { rec: TradingRecommendation }) {
  const entries = Object.entries(rec.signals).sort((a, b) => Math.abs(b[1].contribution) - Math.abs(a[1].contribution))
  const maxAbs = entries.reduce((max, [, d]) => Math.max(max, Math.abs(d.contribution)), 0)
  const totalSignals = rec.bullishCount + rec.bearishCount + rec.neutralCount

  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className={cn('flex items-center justify-between p-4 border-b border-border', directionBg(rec.direction))}>
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 font-bold text-xl', directionColor(rec.direction))}>
            <DirectionIcon direction={rec.direction} className="w-6 h-6" />
            <span>{rec.direction}</span>
          </div>
          <span className="text-xs font-mono text-text-muted bg-bg-tertiary/60 px-2 py-0.5 rounded">{rec.timeframe}</span>
          <span className="text-xs text-text-secondary hidden sm:block">{TIMEFRAME_DESC[rec.timeframe]}</span>
        </div>
        <div className="text-right">
          <span className={cn('font-mono text-lg font-bold', directionColor(rec.direction))}>{rec.confidence}%</span>
          <span className="text-[10px] text-text-muted block">confianza</span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center gap-3 text-xs">
        <span className="text-text-muted">Score:</span>
        <span className={cn('font-mono font-bold', directionColor(rec.direction))}>{rec.score >= 0 ? '+' : ''}{rec.score.toFixed(3)}</span>
        <span className="text-text-muted ml-auto">{totalSignals} señales:</span>
        {rec.bullishCount > 0 && <span className="text-bullish font-mono">{rec.bullishCount} alcistas</span>}
        {rec.bearishCount > 0 && <span className="text-bearish font-mono">{rec.bearishCount} bajistas</span>}
        {rec.neutralCount > 0 && <span className="text-neutral-signal font-mono">{rec.neutralCount} neutral</span>}
      </div>

      {/* TP/SL Levels */}
      {rec.levels && (
        <div className="p-4 border-b border-border/50">
          <LevelsPanel levels={rec.levels} direction={rec.direction} />
        </div>
      )}

      {/* Signal table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-text-muted uppercase border-b border-border/50">
              <th className="text-left py-2 px-4">Indicador</th>
              <th className="text-right py-2 px-2">Valor</th>
              <th className="text-center py-2 px-2">Señal</th>
              <th className="text-right py-2 px-2">Peso</th>
              <th className="text-center py-2 px-2 w-28 hidden sm:table-cell">Impacto</th>
              <th className="text-right py-2 px-4">Contrib.</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, detail]) => (
              <tr key={key} className="border-b border-border/30 hover:bg-bg-tertiary/20">
                <td className="py-2 px-4 font-mono text-xs">{SIGNAL_LABELS[key] || key}</td>
                <td className="py-2 px-2 text-right font-mono text-xs text-text-secondary">
                  {detail.rawValue != null ? detail.rawValue.toFixed(1) : '—'}
                </td>
                <td className="py-2 px-2 text-center">
                  <SignalBadge signal={detail.signal} />
                </td>
                <td className="py-2 px-2 text-right font-mono text-xs text-text-muted">
                  {(detail.weight * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-2 hidden sm:table-cell">
                  <ContributionBar value={detail.contribution} maxAbs={maxAbs} />
                </td>
                <td className={cn('py-2 px-4 text-right font-mono text-xs font-bold', detail.contribution > 0 ? 'text-bullish' : detail.contribution < 0 ? 'text-bearish' : 'text-text-muted')}>
                  {detail.contribution >= 0 ? '+' : ''}{detail.contribution.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explanations */}
      <div className="p-4 space-y-1.5 border-t border-border/50 bg-bg-tertiary/20">
        <div className="flex items-center gap-1.5 mb-2">
          <Info className="w-3.5 h-3.5 text-accent-btc" />
          <span className="text-xs font-display font-semibold text-text-secondary">Razonamiento</span>
        </div>
        {entries.map(([key, detail]) => (
          <p key={key} className="text-xs text-text-secondary leading-relaxed">
            <span className={cn('font-mono font-semibold', detail.score > 0 ? 'text-bullish' : detail.score < 0 ? 'text-bearish' : 'text-neutral-signal')}>
              {detail.score > 0 ? '+' : detail.score < 0 ? '-' : '~'}
            </span>
            {' '}
            {signalExplanation(key, detail)}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function Trading() {
  const { data: prices, loading: priceLoading } = usePriceChanges()
  const { data: cycleScore } = useLatestCycleScore()
  const { data: signals } = useLatestSignals()
  const { data: allIndicators } = useLatestIndicators()
  const { data: sentiment } = useLatestSentiment()

  const { data: onchainRaw } = useSupabaseQuery<OnchainMetric[]>(
    () =>
      supabase
        .from('onchain_metrics')
        .select('*')
        .in('metric', ['HASH_RATE_MOM', 'NVT_RATIO'])
        .order('date', { ascending: false })
        .limit(4),
    [],
    'onchain-trading-signals',
  )

  const onchainMetrics = useMemo(() => {
    const hashRate = onchainRaw?.find((m) => m.metric === 'HASH_RATE_MOM') ?? null
    const nvt = onchainRaw?.find((m) => m.metric === 'NVT_RATIO') ?? null
    return { hashRate, nvt }
  }, [onchainRaw])

  const bbIndicators = useMemo(() => {
    if (!allIndicators) return null
    return allIndicators.filter((i) => i.indicator.startsWith('BB_'))
  }, [allIndicators])

  const currentPrice = useMemo(() => {
    if (!prices || prices.length === 0) return null
    return prices[0].close
  }, [prices])

  const recommendations = useTradingRecommendations(signals, bbIndicators, sentiment, onchainMetrics, cycleScore, currentPrice, allIndicators)

  if (priceLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Trading Signal" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!currentPrice) return <div className="p-6"><EmptyState command="btc-intel update-data" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title="Trading Signal" subtitle="Recomendaciones por timeframe">
        <HelpButton
          title="Trading Signal"
          content={[
            "Recomendaciones LONG/SHORT/NEUTRAL por timeframe basadas en 8 indicadores ponderados.",
            "1H: Scalping — prioriza RSI y MACD (indicadores rapidos de momentum).",
            "4H: Swing corto — equilibrio entre tecnico y sentimiento.",
            "1D: Swing/Position — incluye on-chain (NVT, Hash Rate) y ciclo.",
            "1W: Macro — maximo peso a Cycle Score, SMA Cross y fundamentales on-chain.",
            "TP1/TP2: Take Profit calculados con ATR (volatilidad) y Bollinger Bands como resistencias/soportes dinamicos.",
            "SL: Stop Loss basado en BB, SMA50/200 como soporte, o ATR si no hay soporte tecnico cercano.",
            "R:R: Ratio riesgo/recompensa. Valores > 1.5 son favorables.",
            "Mayor confianza = SL mas ajustado (la señal es mas clara, menor margen necesario).",
            "Los datos se actualizan con: btc-intel update-data && btc-intel analyze full",
          ]}
        />
      </PageHeader>

      {/* Current price reference */}
      <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm flex items-center gap-3">
        <Bitcoin className="w-5 h-5 text-accent-btc" />
        <span className="text-sm text-text-secondary">Precio actual:</span>
        <span className="font-mono text-lg font-bold">{formatPrice(currentPrice)}</span>
        {prices && prices.length > 1 && (
          <span className={cn('text-sm font-mono', prices[0].close >= prices[1].close ? 'text-bullish' : 'text-bearish')}>
            {formatPercent(((prices[0].close - prices[1].close) / prices[1].close) * 100)}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {recommendations.map((rec) => (
          <div key={rec.timeframe} className={cn('rounded-xl border p-4 backdrop-blur-sm', directionBg(rec.direction))}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-mono text-text-muted">{rec.timeframe}</span>
              <span className="text-[10px] text-text-muted">{TIMEFRAME_DESC[rec.timeframe]}</span>
            </div>
            <div className={cn('flex items-center justify-center gap-1.5 font-bold text-2xl mb-1', directionColor(rec.direction))}>
              <DirectionIcon direction={rec.direction} className="w-7 h-7" />
              <span>{rec.direction}</span>
            </div>
            <div className="text-center">
              <span className={cn('text-lg font-mono font-bold', directionColor(rec.direction))}>{rec.confidence}%</span>
            </div>
            {rec.levels && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-bullish">TP2</span>
                  <span>{formatPrice(rec.levels.tp2)}</span>
                  <span className="text-bullish">+{rec.levels.tp2Percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bullish">TP1</span>
                  <span>{formatPrice(rec.levels.tp1)}</span>
                  <span className="text-bullish">+{rec.levels.tp1Percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bearish">SL</span>
                  <span>{formatPrice(rec.levels.sl)}</span>
                  <span className="text-bearish">{rec.levels.slPercent}%</span>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-2 mt-2 text-[10px] font-mono">
              {rec.bullishCount > 0 && <span className="text-bullish">{rec.bullishCount} bull</span>}
              {rec.bearishCount > 0 && <span className="text-bearish">{rec.bearishCount} bear</span>}
              {rec.neutralCount > 0 && <span className="text-neutral-signal">{rec.neutralCount} flat</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Active signals chips */}
      {signals && signals.length > 0 && (
        <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 backdrop-blur-sm">
          <h3 className="text-xs font-display font-semibold text-text-secondary mb-2">Señales Activas</h3>
          <div className="flex flex-wrap gap-2">
            {signals.map((s) => (
              <div key={s.indicator} className="flex items-center gap-2 bg-bg-tertiary/50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-mono text-text-secondary">{s.indicator}</span>
                <span className="text-xs font-mono text-text-muted">{s.value != null ? s.value.toFixed(1) : ''}</span>
                {s.signal && <SignalBadge signal={s.signal} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed breakdown per timeframe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recommendations.map((rec) => (
          <TimeframeDetail key={rec.timeframe} rec={rec} />
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-text-muted italic text-center">
        * Los niveles TP/SL son orientativos, calculados con ATR y Bollinger Bands. No es consejo financiero. Gestiona tu riesgo.
      </p>
    </div>
  )
}
