import { useState, useEffect, useRef, useCallback } from 'react'

interface BinanceLivePrice {
  price: number
  timestamp: number
  isLive: boolean
}

const WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade'
const THROTTLE_MS = 1000
const MAX_RECONNECT_DELAY = 30000
const INITIAL_RECONNECT_DELAY = 1000

export function useBinancePrice(): BinanceLivePrice {
  const [state, setState] = useState<BinanceLivePrice>({
    price: 0,
    timestamp: 0,
    isLive: false,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastUpdateRef = useRef(0)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        setState((prev) => ({ ...prev, isLive: true }))
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        const now = Date.now()
        if (now - lastUpdateRef.current < THROTTLE_MS) return
        lastUpdateRef.current = now

        try {
          const data = JSON.parse(event.data)
          const price = parseFloat(data.p)
          if (price > 0) {
            setState({ price, timestamp: data.T || now, isLive: true })
          }
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setState((prev) => ({ ...prev, isLive: false }))
        scheduleReconnect()
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      scheduleReconnect()
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connect()
    }, reconnectDelayRef.current)

    // Exponential backoff
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * 2,
      MAX_RECONNECT_DELAY,
    )
  }, [connect])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  return state
}
