import { Navigate, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { LoadingState } from './ui'

// Hanya alamat di dalam aplikasi yang boleh dipakai sebagai tujuan setelah masuk.
export function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function validateNext(search: Record<string, unknown>): { next?: string } {
  return { next: typeof search.next === 'string' ? safeNext(search.next) : undefined }
}

export function RequireAuth({ children, needProfile = true }: { children: ReactNode; needProfile?: boolean }) {
  const { ready, session, profileLoading, profileComplete } = useAuth()
  const location = useLocation()
  if (!ready || (session && profileLoading)) return <LoadingState />
  if (!session) return <Navigate to="/masuk" search={{ next: location.href }} replace />
  if (needProfile && !profileComplete) return <Navigate to="/lengkapi-profil" search={{ next: location.href }} replace />
  return <>{children}</>
}
