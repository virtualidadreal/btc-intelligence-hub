interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 md:mb-6">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-text-secondary mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
