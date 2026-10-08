import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

type Handler = (event: string, payload: Record<string, unknown>) => void
type Listener = { events: string[]; handler: { current: Handler } }
type Entry = { listeners: Set<Listener>; channel: RealtimeChannel | null; closed: boolean; timer: ReturnType<typeof setTimeout> | null }

// supabase.channel() memakai ulang channel untuk topik yang sama, jadi satu channel dipakai bersama
// dan baru dilepas setelah pemakai terakhir pergi. Tanpa ini, menutup satu halaman memutus langganan halaman lain.
const entries = new Map<string, Entry>()

// Jeda sebelum channel dilepas, supaya pindah halaman ke topik yang sama tidak meminta channel yang sedang ditutup.
const RELEASE_DELAY_MS = 2000

function join(topic: string, listener: Listener): () => void {
  let entry = entries.get(topic)
  if (entry?.timer) {
    clearTimeout(entry.timer)
    entry.timer = null
  }
  if (!entry) {
    const created: Entry = { listeners: new Set(), channel: null, closed: false, timer: null }
    entries.set(topic, created)
    entry = created
    void (async () => {
      await supabase.realtime.setAuth()
      if (created.closed) return
      const channel = supabase.channel(topic, { config: { private: true } })
      channel.on('broadcast', { event: '*' }, (msg) => {
        const payload = (msg.payload ?? {}) as Record<string, unknown>
        for (const l of created.listeners) if (l.events.includes(msg.event)) l.handler.current(msg.event, payload)
      })
      channel.subscribe()
      created.channel = channel
    })()
  }
  entry.listeners.add(listener)
  return () => {
    const current = entries.get(topic)
    if (!current || !current.listeners.delete(listener) || current.listeners.size > 0) return
    current.timer = setTimeout(() => {
      if (current.listeners.size > 0) return
      current.closed = true
      entries.delete(topic)
      if (current.channel) void supabase.removeChannel(current.channel)
    }, RELEASE_DELAY_MS)
  }
}

// Mendengarkan channel privat (izin dicek RLS di realtime.messages). Data tetap diambil ulang lewat query biasa.
export function useTopic(topic: string | null, events: string[], handler: Handler): void {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  const eventsKey = events.join(',')

  useEffect(() => {
    if (!topic) return
    return join(topic, { events: eventsKey.split(','), handler: handlerRef })
  }, [topic, eventsKey])
}
