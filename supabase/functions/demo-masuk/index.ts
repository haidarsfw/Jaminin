// Panel mode demo: anggota tim (atau akun demo yang sedang dipakai tim) berpindah ke akun demo lain tanpa kata sandi.
// Mengembalikan token sekali pakai yang ditukar menjadi sesi di aplikasi (verifyOtp).
import { authAdmin, callerId, corsHeaders, json, selectRows } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const caller = await callerId(req)
  if (!caller) return json({ ok: false, error: 'not_authenticated' }, 401)

  const [team, me] = await Promise.all([
    selectRows<{ user_id: string }>('team_members', `select=user_id&user_id=eq.${caller}`),
    selectRows<{ is_demo: boolean }>('profiles', `select=is_demo&id=eq.${caller}`),
  ])
  if (!team.data?.length && !me.data?.[0]?.is_demo) return json({ ok: false, error: 'not_team' }, 403)

  let target = ''
  try {
    target = String((await req.json())?.user_id ?? '')
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(target)) return json({ ok: false, error: 'bad_request' }, 400)

  const profile = await selectRows<{ is_demo: boolean }>('profiles', `select=is_demo&id=eq.${target}`)
  if (!profile.data?.[0]?.is_demo) return json({ ok: false, error: 'not_demo_account' }, 400)

  const user = await authAdmin<{ email?: string }>(`users/${target}`, { method: 'GET' })
  if (user.error || !user.data?.email) return json({ ok: false, error: 'not_found' }, 404)

  const link = await authAdmin<{ hashed_token?: string; properties?: { hashed_token?: string } }>('generate_link', {
    method: 'POST',
    body: { type: 'magiclink', email: user.data.email },
  })
  const tokenHash = link.data?.hashed_token ?? link.data?.properties?.hashed_token
  if (link.error || !tokenHash) return json({ ok: false, error: 'link_failed' }, 500)

  return json({ ok: true, email: user.data.email, token_hash: tokenHash })
})
