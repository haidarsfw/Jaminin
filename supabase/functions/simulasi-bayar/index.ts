// Simulator Bayar: siapa pun yang memegang kode bayar bisa membayar, seperti QRIS sungguhan (usulan U14).
// Lunas hanya ditetapkan di sini lewat fungsi database yang sama dengan jalur penyedia pembayaran nanti.
import { corsHeaders, json, rpc } from '../_shared/supabase.ts'

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let code = ''
  try {
    const body = await req.json()
    code = String(body?.code ?? '').trim().toUpperCase()
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400)
  }
  if (!CODE.test(code)) return json({ ok: false, error: 'invalid_code' }, 400)

  const { data, error } = await rpc<{ ok: boolean }>('internal_confirm_payment', { p_code: code })
  if (error) {
    console.error('internal_confirm_payment', error)
    return json({ ok: false, error: 'server_error' }, 500)
  }
  return json(data, data?.ok ? 200 : 400)
})
