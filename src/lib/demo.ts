import { callFunction, supabase, toAppError } from './supabase'

// Sesi asal anggota tim disimpan sebelum pindah ke akun demo, supaya bisa kembali tanpa masuk ulang.
const ORIGIN_KEY = 'jaminin:sesi-asal'

export function hasOriginSession(): boolean {
  try {
    return !!localStorage.getItem(ORIGIN_KEY)
  } catch {
    return false
  }
}

export async function switchToDemo(userId: string, currentIsDemo: boolean): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const current = data.session
  const { token_hash } = await callFunction<{ token_hash: string }>('demo-masuk', { user_id: userId })
  if (current && !currentIsDemo && !hasOriginSession()) {
    try {
      localStorage.setItem(ORIGIN_KEY, current.refresh_token)
    } catch {
      // Tanpa penyimpanan, anggota tim masuk ulang secara biasa setelah demo.
    }
  }
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
  if (error) throw toAppError(error)
}

export async function returnToOrigin(): Promise<boolean> {
  let token: string | null
  try {
    token = localStorage.getItem(ORIGIN_KEY)
    localStorage.removeItem(ORIGIN_KEY)
  } catch {
    token = null
  }
  if (!token) return false
  const { error } = await supabase.auth.refreshSession({ refresh_token: token })
  if (error) throw toAppError(error)
  return true
}
