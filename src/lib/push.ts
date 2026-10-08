import { isIos, isStandalone } from './device'
import { callFunction, rpc, supabase } from './supabase'

export type PushResult = 'ok' | 'denied' | 'unsupported' | 'needs_install'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function vapidKey(): Promise<string> {
  const { data } = await supabase.from('app_settings').select('vapid_public_key').eq('id', 1).single()
  if (data?.vapid_public_key) return data.vapid_public_key
  const res = await callFunction<{ public_key: string }>('kirim-kabar', { action: 'public_key' })
  return res.public_key
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

// Izin notifikasi hanya diminta dari ketukan pengguna. Di iPhone dan iPad, Jaminin harus dipasang ke layar utama dulu.
export async function enablePush(): Promise<PushResult> {
  if (isIos() && !isStandalone()) return 'needs_install'
  if (!pushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const subscription =
    existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(await vapidKey()) }))
  const json = subscription.toJSON()
  await rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent.slice(0, 300),
  })
  return 'ok'
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
