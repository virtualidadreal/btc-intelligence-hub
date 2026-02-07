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

export interface SignalHistory {
  id: number
  date: string
  timeframe: string
  direction: string
  confidence: number
  score: number
  price_at_signal: number
  price_1h_later: number | null
  outcome_1h: string | null
  // v2 fields
  setup_type: string | null
  sl: number | null
  tp1: number | null
  tp2: number | null
  sl_method: string | null
  tp1_method: string | null
  tp2_method: string | null
  level_score: number | null
  candle_pattern: string | null
  candle_score: number | null
  onchain_bonus: number | null
  penalties: number | null
  extended_score: number | null
  nearby_levels: Record<string, unknown>[] | null
  fib_context: Record<string, unknown> | null
  outcome: string | null
  hit_at: string | null
  created_at: string
}

export interface PortfolioPosition {
  id: number
  opened_at: string
  closed_at: string | null
  direction: string
  entry_price: number
  exit_price: number | null
  size_btc: number
  sl: number | null
  tp1: number | null
  tp2: number | null
  status: string
  pnl_usd: number | null
  pnl_percent: number | null
  notes: string | null
  created_at: string
}

// Trading v2 types
export interface PriceLevel {
  id: number
  price: number
  price_low: number | null
  price_high: number | null
  type: string
  strength: number
  classification: string | null
  source: string[] | null
  timeframes: string[] | null
  touch_count: number
  last_touch_date: string | null
  fib_level: number | null
  is_role_flip: boolean
  is_psychological: boolean
  is_high_volume: boolean
  status: string
  updated_at: string
}

export interface FibonacciLevel {
  id: number
  timeframe: string
  type: string
  direction: string
  swing_low: number
  swing_high: number
  swing_low_date: string | null
  swing_high_date: string | null
  pullback_end: number | null
  levels: Record<string, unknown>
  status: string
  updated_at: string
}

export interface ConfluenceZone {
  id: number
  price_low: number
  price_high: number
  price_mid: number
  type: string
  timeframes: string[]
  fib_ratios: number[] | null
  num_timeframes: number
  strength: number
  has_gran_nivel: boolean
  status: string
  updated_at: string
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
