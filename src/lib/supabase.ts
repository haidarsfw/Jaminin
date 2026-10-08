import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

export const supabaseUrl = url

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Kode error dari fungsi database (contoh 'slot_full') dan dari Edge Function dibawa apa adanya untuk diterjemahkan.
export class AppError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const e = error as { message?: string; code?: string } | null
  const message = e?.message ?? ''
  if (/^[a-z_]+$/.test(message)) return new AppError(message)
  if (e?.code === '42501') return new AppError('forbidden')
  if (/fetch|network|Failed to fetch/i.test(message)) return new AppError('network')
  return new AppError('unknown')
}

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => Promise<{ data: T; error: unknown }>)(fn, args)
  if (error) throw toAppError(error)
  return data
}

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  let res: Response
  try {
    res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AppError('network')
  }
  const payload = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string }
  if (!res.ok || payload.ok === false) throw new AppError(payload.error ?? 'unknown')
  return payload
}

export function publicImage(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from('tenant-media').getPublicUrl(path).data.publicUrl
}
