import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

type Handler = (event: string, payload: Record<string, unknown>) => void

// Mendengarkan channel privat (izin dicek RLS di realtime.messages). Data tetap diambil ulang lewat query biasa.
export function useTopic(topic: string | null, events: string[], handler: Handler): void {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  const eventsKey = events.join(',')

  useEffect(() => {
    if (!topic) return
    let channel: RealtimeChannel | null = null
    let cancelled = false
    void (async () => {
      await supabase.realtime.setAuth()
      if (cancelled) return
      channel = supabase.channel(topic, { config: { private: true } })
      for (const event of eventsKey.split(',')) {
        channel.on('broadcast', { event }, (msg) => handlerRef.current(event, (msg.payload ?? {}) as Record<string, unknown>))
      }
      channel.subscribe()
    })()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [topic, eventsKey])
}
