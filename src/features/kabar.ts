import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { useTopic } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'

export { KABAR_KINDS, kabarText } from './kabarText'

export type Kabar = { id: string; kind: string; params: Record<string, unknown>; url: string | null; read_at: string | null; created_at: string }

export function kabarQueryKey(userId: string | null) {
  return ['kabar', userId] as const
}

// Kabar milik akun yang masuk, ikut terbarui lewat Realtime dan polling cadangan kalau WebSocket putus.
export function useKabar() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  useTopic(userId ? `user:${userId}` : null, ['notification'], () => void queryClient.invalidateQueries({ queryKey: kabarQueryKey(userId) }))
  return useQuery({
    queryKey: kabarQueryKey(userId),
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, kind, params, url, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Kabar[]
    },
  })
}

export async function markKabarRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null)
  if (error) throw error
}
