import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'

interface RsiPoint {
  date: string
  value: number
  signal: string | null
}

interface Props {
  data: RsiPoint[]
  formatAxisDate: (iso: string) => string
  formatTooltipLabel: (label: string) => string
}

export default function RsiChart({ data, formatAxisDate, formatTooltipLabel }: Props) {
  if (!data.length) return null

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={formatAxisDate} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} width={30} />
          <Tooltip
            contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={formatTooltipLabel as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: any) => [v != null ? Number(v).toFixed(1) : '—', 'RSI']) as any}
          />

          {/* Colored zones */}
          <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.08} />
          <ReferenceArea y1={0} y2={30} fill="#22c55e" fillOpacity={0.08} />
          <ReferenceArea y1={40} y2={60} fill="#8b5cf6" fillOpacity={0.04} />

          {/* Reference lines */}
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '70', position: 'right', fill: '#ef4444', fontSize: 10 }} />
          <ReferenceLine y={50} stroke="#4b5563" strokeDasharray="2 4" />
          <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: '30', position: 'right', fill: '#22c55e', fontSize: 10 }} />

          {/* RSI line */}
          <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
