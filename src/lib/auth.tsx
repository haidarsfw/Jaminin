import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setLanguage } from './i18n'
import { supabase, type Enums, type Tables } from './supabase'

export type MyTenant = {
  id: string
  slug: string
  name: string
  status: Enums<'status_tenant'>
  role: Enums<'peran_tenant'>
  reject_reason: string | null
}

type AuthState = {
  ready: boolean
  session: Session | null
  user: User | null
  profile: Tables<'profiles'> | null
  profileLoading: boolean
  profileComplete: boolean
  teamRole: Enums<'peran_tim'> | null
  tenants: MyTenant[]
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const profileQuery = useQuery({
    queryKey: ['profil', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const rolesQuery = useQuery({
    queryKey: ['peran', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [team, tenants] = await Promise.all([
        supabase.from('team_members').select('role').eq('user_id', userId!).maybeSingle(),
        supabase.rpc('my_tenants'),
      ])
      return {
        teamRole: (team.data?.role ?? null) as Enums<'peran_tim'> | null,
        tenants: (tenants.data ?? []) as MyTenant[],
      }
    },
  })

  // Bahasa yang tersimpan di profil dipakai setelah masuk, supaya sama di semua perangkat.
  const profileLang = profileQuery.data?.language
  useEffect(() => {
    if (profileLang === 'id' || profileLang === 'en') setLanguage(profileLang)
  }, [profileLang])

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ?? null,
      profileLoading: !!userId && profileQuery.isPending,
      profileComplete: !!profileQuery.data?.profile_completed_at,
      teamRole: rolesQuery.data?.teamRole ?? null,
      tenants: rolesQuery.data?.tenants ?? [],
      refresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['profil', userId] }),
          queryClient.invalidateQueries({ queryKey: ['peran', userId] }),
        ])
      },
      signOut: async () => {
        await supabase.auth.signOut()
        queryClient.clear()
      },
    }),
    [ready, session, userId, profileQuery.data, profileQuery.isPending, rolesQuery.data, queryClient],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
