import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'

export interface Overlays {
  emas: boolean
  bb: boolean
  sr: boolean
  fib: boolean
  patterns: boolean
  volume: boolean
}

const STORAGE_KEY = 'btc-intel-overlays'

const DEFAULTS: Overlays = { emas: true, bb: false, sr: true, fib: true, patterns: false, volume: false }

function loadOverlays(): Overlays {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return DEFAULTS
}

export function useOverlays() {
  const [overlays, setOverlays] = useState<Overlays>(loadOverlays)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlays))
  }, [overlays])

  const toggle = useCallback((key: keyof Overlays) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return { overlays, toggle }
}

interface Props {
  overlays: Overlays
  onToggle: (key: keyof Overlays) => void
}

const KEYS: (keyof Overlays)[] = ['emas', 'bb', 'sr', 'fib', 'patterns', 'volume']

export default function OverlayControls({ overlays, onToggle }: Props) {
  const { t } = useI18n()

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs text-text-muted self-center mr-1">{t('technical.overlays')}:</span>
      {KEYS.map((k) => (
        <button
          key={k}
          onClick={() => onToggle(k)}
          className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors ${
            overlays[k]
              ? 'bg-accent-btc/20 text-accent-btc border-accent-btc/30'
              : 'text-text-muted border-border hover:text-text-secondary hover:border-border/80'
          }`}
        >
          {t(`technical.overlay.${k}`)}
        </button>
      ))}
    </div>
  )
}
