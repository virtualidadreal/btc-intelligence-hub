export interface BtcPrice {
  id: number
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  source: string
}

export interface TechnicalIndicator {
  id: number
  date: string
  indicator: string
  value: number
  signal: 'bullish' | 'bearish' | 'neutral' | 'extreme_bullish' | 'extreme_bearish' | null
  params: Record<string, unknown> | null
}

export interface OnchainMetric {
  id: number
  date: string
  metric: string
  value: number
  signal: string | null
  source: string | null
}

export interface MacroData {
  id: number
  date: string
  asset: string
  value: number
  source: string | null
}

export interface SentimentData {
  id: number
  date: string
  metric: string
  value: number
  label: string | null
  source: string | null
}

export interface Cycle {
  id: number
  name: string
  type: string
  start_date: string
  end_date: string | null
  btc_price_start: number | null
  btc_price_end: number | null
  btc_price_peak: number | null
  btc_price_bottom: number | null
  peak_date: string | null
  bottom_date: string | null
  duration_days: number | null
  roi_percent: number | null
  max_drawdown: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
}

export interface Event {
  id: number
  date: string
  title: string
  description: string | null
  category: string
  impact: 'positive' | 'negative' | 'neutral' | null
  btc_price: number | null
  source_url: string | null
}

export interface Alert {
  id: number
  date: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string | null
  metric: string | null
  current_value: number | null
  threshold_value: number | null
  signal: string | null
  acknowledged: boolean
}

export interface Conclusion {
  id: number
  date: string
  title: string
  content: string
  category: string
  source: 'user' | 'ai' | 'mixed'
  confidence: number
  tags: string[] | null
  parent_id: number | null
  version: number
  validated_outcome: 'correct' | 'incorrect' | 'partial' | 'pending' | null
  data_snapshot: Record<string, unknown> | null
  status: string
  metadata: Record<string, unknown> | null
}

export interface CycleScore {
  id: number
  date: string
  score: number
  phase: string | null
  mvrv_component: number | null
  nupl_component: number | null
  halving_component: number | null
  rsi_monthly_component: number | null
  sth_mvrv_component: number | null
  exchange_flow_component: number | null
  google_trends_component: number | null
  fear_greed_component: number | null
  cycle_comparison_component: number | null
  similar_historical: Record<string, unknown> | null
}

export interface Report {
  id: number
  title: string
  content: string
  report_type: string | null
  period_start: string | null
  period_end: string | null
  conclusion_ids: number[] | null
  cycle_score: number | null
  generated_by: string | null
  created_at: string
}
