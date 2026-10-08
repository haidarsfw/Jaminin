// Daftar dengan email dan kata sandi tanpa konfirmasi email (ronde 10), tidak bergantung pada pengaturan dashboard.
import { authAdmin, corsHeaders, json } from '../_shared/supabase.ts'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let email = ''
  let password = ''
  let fullName = ''
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
    password = String(body?.password ?? '')
    fullName = String(body?.full_name ?? '').trim().slice(0, 80)
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400)
  }
  if (!EMAIL.test(email) || email.length > 254) return json({ ok: false, error: 'invalid_email' }, 400)
  if (password.length < 6 || password.length > 72) return json({ ok: false, error: 'weak_password' }, 400)

  const { error, status } = await authAdmin('users', {
    method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: fullName ? { full_name: fullName } : {} },
  })
  if (error) {
    const taken = status === 422 || /already|registered|exists/i.test(error)
    return json({ ok: false, error: taken ? 'email_taken' : 'signup_failed' }, taken ? 409 : 400)
  }
  return json({ ok: true })
})
