import { Info as InfoIcon, Database, Clock, AlertTriangle, BarChart3, Globe, Brain, Shield, FileText } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { useI18n } from '../lib/i18n'

function Section({ icon: Icon, titleKey, children }: { icon: typeof InfoIcon; titleKey: string; children: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl bg-bg-secondary/60 border border-border p-4 md:p-6 backdrop-blur-sm">
      <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-accent-btc" />
        {t(titleKey)}
      </h3>
      {children}
    </div>
  )
}

export default function Info() {
  const { t } = useI18n()

  const sections = [
    { key: 'overview', icon: BarChart3 },
    { key: 'trading', icon: BarChart3 },
    { key: 'technical', icon: BarChart3 },
    { key: 'onchain', icon: Database },
    { key: 'macro', icon: Globe },
    { key: 'sentiment', icon: Brain },
    { key: 'cycles', icon: Clock },
    { key: 'risk', icon: Shield },
    { key: 'reports', icon: FileText },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader title={t('info.title')} subtitle={t('info.subtitle')} />

      {/* What is this */}
      <Section icon={InfoIcon} titleKey="info.whatTitle">
        <p className="text-sm text-text-secondary leading-relaxed">{t('info.whatDescription')}</p>
      </Section>

      {/* Section overview */}
      <Section icon={BarChart3} titleKey="info.sectionOverview">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map(({ key, icon: Icon }) => (
            <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-bg-tertiary/30">
              <Icon className="w-4 h-4 text-accent-btc mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-semibold text-text-primary">{t(`info.section.${key}.title`)}</span>
                <p className="text-xs text-text-secondary mt-0.5">{t(`info.section.${key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Data sources */}
      <Section icon={Database} titleKey="info.sourcesTitle">
        <div className="space-y-2">
          {['binance', 'coingecko', 'alternative', 'fred', 'blockchain'].map((src) => (
            <div key={src} className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-accent-btc shrink-0" />
              <span className="text-text-secondary">{t(`info.source.${src}`)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Update frequency */}
      <Section icon={Clock} titleKey="info.frequencyTitle">
        <div className="space-y-2">
          {['prices', 'indicators', 'onchain', 'sentiment'].map((item) => (
            <div key={item} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{t(`info.freq.${item}.label`)}</span>
              <span className="font-mono text-xs text-accent-btc">{t(`info.freq.${item}.value`)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Disclaimer */}
      <div className="rounded-xl bg-bearish/5 border border-bearish/20 p-4 md:p-6">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2 text-bearish">
          <AlertTriangle className="w-4 h-4" />
          {t('info.disclaimerTitle')}
        </h3>
        <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
          <p>{t('info.disclaimer1')}</p>
          <p>{t('info.disclaimer2')}</p>
          <p>{t('info.disclaimer3')}</p>
        </div>
      </div>
    </div>
  )
}
