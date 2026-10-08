import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { profileQueryOptions, useAuth } from '@/lib/auth'
import { LoadingState } from './ui'

// Hanya alamat di dalam aplikasi yang boleh dipakai sebagai tujuan setelah masuk.
export function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function validateNext(search: Record<string, unknown>): { next?: string } {
  return typeof search.next === 'string' ? { next: safeNext(search.next) } : {}
}

// Navigate bawaan router mengulang navigasi setiap kali dirender ulang, jadi pengalihan dijalankan sekali per pemasangan.
export function Redirect({ href }: { href: string }) {
  const navigate = useNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    void navigate({ href, replace: true })
  }, [navigate, href])
  return <LoadingState />
}

export function withNext(path: '/masuk' | '/lengkapi-profil', next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`
}

export function RequireAuth({ children, needProfile = true }: { children: ReactNode; needProfile?: boolean }) {
  const { ready, session } = useAuth()
  // Profil dibaca langsung dari cache, karena kabar dari context bisa tertinggal satu putaran setelah profil disimpan.
  const profile = useQuery(profileQueryOptions(session?.user.id ?? null))
  const href = useRouterState({ select: (s) => s.location.href })
  if (!ready || (session && profile.isPending)) return <LoadingState />
  if (!session) return <Redirect href={withNext('/masuk', href)} />
  if (needProfile && !profile.data?.profile_completed_at) return <Redirect href={withNext('/lengkapi-profil', href)} />
  return <>{children}</>
}
