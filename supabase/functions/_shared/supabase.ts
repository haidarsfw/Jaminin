// Pemanggil REST Supabase tanpa pustaka luar, supaya fungsi juga bisa jalan di lingkungan tanpa akses registry.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-jaminin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const baseUrl = Deno.env.get('SUPABASE_URL') ?? ''

// Kunci baru (SUPABASE_SECRET_KEYS) didahulukan, kunci lama service_role sebagai cadangan.
function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

// Kunci baru bukan JWT, jadi hanya dikirim di header apikey. Kunci lama juga dikirim sebagai Bearer.
function serviceHeaders(): Record<string, string> {
  const key = secretKey()
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`
  return headers
}

export type Result<T> = { data: T | null; error: string | null; status: number }

async function parse<T>(res: Response): Promise<Result<T>> {
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const b = body as { message?: string; msg?: string; error_description?: string } | null
    return { data: null, error: b?.message ?? b?.msg ?? b?.error_description ?? String(res.status), status: res.status }
  }
  return { data: body as T, error: null, status: res.status }
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: serviceHeaders(), body: JSON.stringify(args) })
  return parse<T>(res)
}

export async function selectRows<T>(table: string, query: string): Promise<Result<T[]>> {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, { headers: serviceHeaders() })
  return parse<T[]>(res)
}

export async function authAdmin<T>(path: string, init: { method: string; body?: unknown }): Promise<Result<T>> {
  const res = await fetch(`${baseUrl}/auth/v1/admin/${path}`, {
    method: init.method,
    headers: serviceHeaders(),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return parse<T>(res)
}

// Memastikan pemanggil adalah pengguna yang masuk, dari token di header Authorization.
export async function callerId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token.startsWith('sb_')) return null
  const res = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: secretKey(), Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string }
  return user.id ?? null
}
