import { useState } from 'react'
import { FileText } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'
import HelpButton from '../components/common/HelpButton'
import PageHeader from '../components/common/PageHeader'
import { useReports } from '../hooks/useReports'
import { formatDate } from '../lib/utils'
import { useI18n } from '../lib/i18n'

export default function Reports() {
  const { t, ta } = useI18n()
  const { data: reports, loading } = useReports()
  const [selected, setSelected] = useState<number | null>(null)

  const selectedReport = reports?.find((r) => r.id === selected)

  if (loading) return <div className="p-6"><PageHeader title={t('reports.title')} /><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('reports.title')} subtitle={`${reports?.length || 0} ${t('reports.subtitle')}`}>
        <HelpButton
          title={t('reports.helpTitle')}
          content={ta('reports')}
        />
      </PageHeader>

      {!reports?.length ? (
        <EmptyState message={t('reports.noData')} command="btc-intel report --type daily" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Report List */}
          <div className="space-y-2">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selected === r.id ? 'bg-accent-btc/10 border-accent-btc/30' : 'bg-bg-secondary/60 border-border hover:border-accent-btc/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent-btc" />
                  <span className="text-sm font-semibold text-text-primary line-clamp-1">{r.title}</span>
                </div>
                <div className="flex gap-2 mt-1 text-xs text-text-muted items-center">
                  <span>{r.report_type || t('reports.report')}</span>
                  <span>{formatDate(r.created_at)}</span>
                  {r.generated_by === 'claude-sonnet' && (
                    <span className="bg-accent-purple/20 text-accent-purple px-1.5 py-0.5 rounded text-[10px] font-semibold">{t('reports.aiBadge')}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Report Viewer */}
          <div className="lg:col-span-2 rounded-xl bg-bg-secondary/60 border border-border p-6 backdrop-blur-sm">
            {selectedReport ? (
              <div>
                <h2 className="text-lg font-display font-bold mb-2">{selectedReport.title}</h2>
                <p className="text-xs text-text-muted mb-4">{formatDate(selectedReport.created_at)}</p>
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-body text-sm text-text-secondary leading-relaxed">
                    {selectedReport.content}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-text-muted">
                {t('reports.selectReport')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
