// Mengirim notifikasi push (Web Push dengan VAPID) untuk satu baris notifications.
// Dipanggil database lewat pg_net dengan rahasia internal. Aksi public_key menyiapkan kunci VAPID sekali saja.
import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import { corsHeaders, json, rpc, selectRows } from '../_shared/supabase.ts'

type Lang = 'id' | 'en'
type Params = Record<string, unknown>

const rupiah = (n: unknown) => 'Rp' + Number(n ?? 0).toLocaleString('id-ID')
const num = (p: Params) => (p.number ? `#${String(p.number).padStart(3, '0')}` : '')

const TEXT: Record<string, Record<Lang, (p: Params) => [string, string]>> = {
  pesanan_diterima: {
    id: (p) => [`Pesanan ${num(p)} diterima`, `Jam ambil ${p.pickup_time} di ${p.tenant_name}.`],
    en: (p) => [`Order ${num(p)} accepted`, `Pickup at ${p.pickup_time} at ${p.tenant_name}.`],
  },
  mulai_disiapkan: {
    id: (p) => [`Pesanan ${num(p)} mulai disiapkan`, `${p.tenant_name} sedang menyiapkan pesananmu.`],
    en: (p) => [`Order ${num(p)} is being prepared`, `${p.tenant_name} is preparing your order.`],
  },
  siap_diambil: {
    id: (p) => [`Pesanan ${num(p)} siap diambil`, `Tunjukkan kode ${p.pickup_code} di ${p.tenant_name}.`],
    en: (p) => [`Order ${num(p)} is ready`, `Show code ${p.pickup_code} at ${p.tenant_name}.`],
  },
  pengingat_jam_ambil: {
    id: (p) => [`${p.minutes} menit lagi jam ambil`, `Pesanan ${num(p)} di ${p.tenant_name}, jam ${p.pickup_time}.`],
    en: (p) => [`Pickup in ${p.minutes} minutes`, `Order ${num(p)} at ${p.tenant_name}, ${p.pickup_time}.`],
  },
  menu_habis: {
    id: (p) => ['Ada menu yang habis', `${p.item} di pesanan ${num(p)} habis. Pilih ganti, hapus, atau batal.`],
    en: (p) => ['An item is sold out', `${p.item} in order ${num(p)} is sold out. Replace it, remove it, or cancel.`],
  },
  uang_kembali: {
    id: (p) => [`Uang kembali ${rupiah(p.amount)}`, `Pesanan ${num(p)} di ${p.tenant_name}.`],
    en: (p) => [`Refund ${rupiah(p.amount)}`, `Order ${num(p)} at ${p.tenant_name}.`],
  },
  belum_siap_boleh_batal: {
    id: (p) => [`Pesanan ${num(p)} belum siap`, 'Jam ambil sudah lewat. Kamu boleh membatalkan dengan uang kembali penuh.'],
    en: (p) => [`Order ${num(p)} is not ready yet`, 'Pickup time has passed. You can cancel for a full refund.'],
  },
  jam_ambil_digeser: {
    id: (p) => [`Jam ambil ${num(p)} digeser`, `Jam ambil baru ${p.pickup_time}, ${p.pickup_date}.`],
    en: (p) => [`Pickup time for ${num(p)} changed`, `New pickup time ${p.pickup_time}, ${p.pickup_date}.`],
  },
  pesanan_dibatalkan: {
    id: (p) => [`Pesanan ${num(p)} dibatalkan`, p.amount ? `Uang kembali ${rupiah(p.amount)}.` : `Jam ambil ${p.pickup_time}.`],
    en: (p) => [`Order ${num(p)} cancelled`, p.amount ? `Refund ${rupiah(p.amount)}.` : `Pickup time ${p.pickup_time}.`],
  },
  tidak_diambil: {
    id: (p) => [`Pesanan ${num(p)} tidak diambil`, `${p.tenant_name} sudah tutup.`],
    en: (p) => [`Order ${num(p)} was not picked up`, `${p.tenant_name} has closed.`],
  },
  balasan_laporan: {
    id: (p) => ['Laporanmu dibalas', `Pesanan ${num(p)} di ${p.tenant_name}.`],
    en: (p) => ['Your report has a reply', `Order ${num(p)} at ${p.tenant_name}.`],
  },
  pesanan_baru: {
    id: (p) => [`Pesanan baru ${num(p)}`, `Jam ambil ${p.pickup_time}, ${p.pickup_date}, atas nama ${p.pickup_name}.`],
    en: (p) => [`New order ${num(p)}`, `Pickup ${p.pickup_time}, ${p.pickup_date}, for ${p.pickup_name}.`],
  },
  pilihan_menu_habis: {
    id: (p) => [`Pilihan pembeli untuk ${num(p)}`, `${p.item}: ${p.action === 'ganti' ? 'diganti' : p.action === 'hapus' ? 'dihapus' : 'pesanan dibatalkan'}.`],
    en: (p) => [`Buyer's choice for ${num(p)}`, `${p.item}: ${p.action === 'ganti' ? 'replaced' : p.action === 'hapus' ? 'removed' : 'order cancelled'}.`],
  },
  setoran_terkirim: {
    id: (p) => ['Setoran terkirim (simulasi)', `${rupiah(p.amount)} untuk ${p.orders} pesanan.`],
    en: (p) => ['Payout sent (simulated)', `${rupiah(p.amount)} for ${p.orders} orders.`],
  },
  pendaftaran_disetujui: {
    id: (p) => ['Pendaftaran disetujui', `${p.tenant_name} sudah tampil untuk pembeli.`],
    en: (p) => ['Registration approved', `${p.tenant_name} is now visible to buyers.`],
  },
  pendaftaran_ditolak: {
    id: (p) => ['Pendaftaran perlu diperbaiki', `Alasan: ${p.reason}`],
    en: (p) => ['Registration needs changes', `Reason: ${p.reason}`],
  },
  ringkasan_pesanan_masuk: {
    id: (p) => [`${p.count} pesanan masuk saat tutup`, `Cek papan pesanan ${p.tenant_name}.`],
    en: (p) => [`${p.count} orders came in while closed`, `Check the ${p.tenant_name} order board.`],
  },
  pendaftaran_baru: {
    id: (p) => ['Pendaftaran penjual baru', `${p.tenant_name} menunggu persetujuan.`],
    en: (p) => ['New seller registration', `${p.tenant_name} is waiting for approval.`],
  },
  laporan_baru: {
    id: (p) => ['Laporan baru', `Pesanan ${num(p)} di ${p.tenant_name}.`],
    en: (p) => ['New report', `Order ${num(p)} at ${p.tenant_name}.`],
  },
  tenant_ditangguhkan: {
    id: (p) => [`${p.tenant_name} ditangguhkan`, `Alasan: ${p.reason}. Pesanan aktif dibatalkan dengan uang kembali penuh.`],
    en: (p) => [`${p.tenant_name} is suspended`, `Reason: ${p.reason}. Active orders were cancelled with a full refund.`],
  },
  tenant_diaktifkan: {
    id: (p) => [`${p.tenant_name} aktif lagi`, 'Tenant sudah tampil lagi untuk pembeli.'],
    en: (p) => [`${p.tenant_name} is active again`, 'The tenant is visible to buyers again.'],
  },
  chat_baru: {
    id: (p) => [`Pesan baru di pesanan ${num(p)}`, `${p.from === 'tenant' ? p.tenant_name : 'Pembeli'}: ${p.snippet}`],
    en: (p) => [`New message on order ${num(p)}`, `${p.from === 'tenant' ? p.tenant_name : 'Buyer'}: ${p.snippet}`],
  },
  pengingat_menyiapkan: {
    id: (p) => [`Saatnya menyiapkan ${num(p)}`, `Jam ambil ${p.pickup_time} atas nama ${p.pickup_name}. Butuh sekitar ${p.minutes} menit.`],
    en: (p) => [`Time to prepare ${num(p)}`, `Pickup ${p.pickup_time} for ${p.pickup_name}. Takes about ${p.minutes} minutes.`],
  },
  kabar_pagi: {
    id: (p) => [`${p.tenant_name} sudah buka`, `Pesanan ${num(p)} tercatat untuk jam ${p.pickup_time} hari ini.`],
    en: (p) => [`${p.tenant_name} is open`, `Order ${num(p)} is set for ${p.pickup_time} today.`],
  },
  jam_tersedia: {
    id: (p) => [`Jam ${p.pickup_time} di ${p.tenant_name} tersedia`, 'Ada tempat kosong. Yang lebih dulu membayar mendapat tempat.'],
    en: (p) => [`${p.pickup_time} at ${p.tenant_name} is open`, 'A spot opened up. Whoever pays first gets it.'],
  },
  jadi_karyawan: {
    id: (p) => [`Kamu jadi karyawan ${p.tenant_name}`, 'Buka mode Penjual untuk menangani pesanan.'],
    en: (p) => [`You are now staff at ${p.tenant_name}`, 'Open Seller mode to handle orders.'],
  },
}

const URGENT = new Set(['pesanan_baru', 'siap_diambil', 'menu_habis', 'belum_siap_boleh_batal', 'pengingat_jam_ambil', 'pengingat_menyiapkan', 'jam_tersedia'])

async function ensureVapid(): Promise<string> {
  const current = await selectRows<{ vapid_public_key: string | null }>('app_settings', 'select=vapid_public_key&id=eq.1')
  const existing = current.data?.[0]?.vapid_public_key
  if (existing) return existing
  const keys = await webpush.generateVapidKeys({ extractable: true })
  const exported = await webpush.exportVapidKeys(keys)
  const publicKey = await webpush.exportApplicationServerKey(keys)
  await rpc('internal_set_vapid', { p_public: publicKey, p_keys_json: JSON.stringify(exported) })
  const again = await selectRows<{ vapid_public_key: string | null }>('app_settings', 'select=vapid_public_key&id=eq.1')
  return again.data?.[0]?.vapid_public_key ?? publicKey
}

type Payload = {
  id: string
  kind: string
  params: Params & { order_id?: string }
  url: string | null
  language: string
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[]
  vapid_private: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  let body: { action?: string; notification_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400)
  }

  if (body.action === 'public_key') {
    return json({ ok: true, public_key: await ensureVapid() })
  }

  const secret = req.headers.get('x-jaminin-secret') ?? ''
  const { data: payload, error } = await rpc<Payload>('internal_push_payload', {
    p_notification: body.notification_id,
    p_secret: secret,
  })
  if (error) return json({ ok: false, error: 'forbidden' }, 403)
  if (!payload) return json({ ok: false, error: 'not_found' }, 404)

  const subs = payload.subscriptions
  if (subs.length === 0 || !payload.vapid_private) {
    await rpc('internal_push_result', { p_notification: payload.id, p_secret: secret, p_status: 'tanpa_langganan', p_gone_ids: [] })
    return json({ ok: true, sent: 0 })
  }

  const lang: Lang = payload.language === 'en' ? 'en' : 'id'
  const render = TEXT[payload.kind]?.[lang]
  const [title, text] = render ? render(payload.params ?? {}) : ['Jaminin', '']

  const vapidKeys = await webpush.importVapidKeys(JSON.parse(payload.vapid_private))
  const server = await webpush.ApplicationServer.new({
    contactInformation: Deno.env.get('SUPABASE_URL') ?? 'https://jaminin.app',
    vapidKeys,
  })

  const message = JSON.stringify({ title, body: text, url: payload.url ?? '/', tag: payload.params?.order_id ?? payload.id })
  const gone: string[] = []
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await server.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(message, {
          urgency: URGENT.has(payload.kind) ? webpush.Urgency.High : webpush.Urgency.Normal,
          ttl: 3600,
        })
        sent += 1
      } catch (e) {
        if (e instanceof webpush.PushMessageError && (e.isGone() || e.response.status === 404)) gone.push(s.id)
        else console.error('push gagal', String(e))
      }
    }),
  )

  await rpc('internal_push_result', {
    p_notification: payload.id,
    p_secret: secret,
    p_status: sent > 0 ? 'terkirim' : 'gagal',
    p_gone_ids: gone,
  })
  return json({ ok: true, sent })
})
