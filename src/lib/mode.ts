import { useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from './auth'
import type { Mode } from './modeType'

export type { Mode } from './modeType'

const KEY = 'jaminin:mode'

// Halaman bersama tetap memakai mode terakhir. Contohnya, membuka Notifikasi dari mode penjual
// tidak memindahkan tampilan ke mode pembeli.
const SHARED = ['/kabar', '/profil', '/panduan-pasang', '/simulator-bayar', '/lengkapi-profil', '/atur-sandi']

function routeMode(pathname: string): Mode | null {
  if (pathname.startsWith('/penjual')) return 'penjual'
  if (pathname.startsWith('/tim')) return 'tim'
  return SHARED.includes(pathname) ? null : 'pembeli'
}

function lastMode(): Mode | null {
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'pembeli' || v === 'penjual' || v === 'tim' ? v : null
  } catch {
    return null
  }
}

// Mode yang sedang dipakai: pembeli, penjual, atau tim. Mode penjual dan tim hanya berlaku
// untuk akun yang memang punya tenant atau peran tim.
export function useMode(): Mode {
  const { pathname } = useLocation()
  const { tenants, teamRole, rolesLoading } = useAuth()
  const direct = routeMode(pathname)
  useEffect(() => {
    if (!direct) return
    try {
      sessionStorage.setItem(KEY, direct)
    } catch {
      // Tanpa penyimpanan, halaman bersama memakai mode pembeli.
    }
  }, [direct])
  if (direct) return direct
  const last = lastMode()
  if (last && rolesLoading) return last
  if (last === 'penjual' && tenants.length > 0) return 'penjual'
  if (last === 'tim' && teamRole) return 'tim'
  return 'pembeli'
}
