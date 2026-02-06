export default function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-bg-tertiary rounded w-full" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 animate-pulse">
      <div className="h-3 bg-bg-tertiary rounded w-1/3 mb-3" />
      <div className="h-6 bg-bg-tertiary rounded w-2/3 mb-2" />
      <div className="h-3 bg-bg-tertiary rounded w-1/4" />
    </div>
  )
}
