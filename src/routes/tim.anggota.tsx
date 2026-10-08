import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, ErrorState, Field, Input, LoadingState, Notice, PageHeader, Select } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { rpc, toAppError, type Enums } from '@/lib/supabase'

export const Route = createFileRoute('/tim/anggota')({
  component: Members,
})

type Member = { user_id: string; full_name: string; email: string; role: Enums<'peran_tim'>; created_at: string }

// Admin menambah anggota lewat email akun yang sudah terdaftar, sehingga email tidak perlu ditulis di repo.
function Members() {
  const { t } = useTranslation()
  const { teamRole, user, refresh } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = teamRole === 'admin'
  const members = useQuery({ queryKey: ['anggota'], queryFn: () => rpc<Member[]>('team_list_members') })
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Enums<'peran_tim'>>('admin')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: ['anggota'] })
      await refresh()
      setNotice(done)
      return true
    } catch (e) {
      setError(t(`galat.${toAppError(e).code}`, { defaultValue: t('galat.unknown') }))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('akun.galat_email'))
      return
    }
    const ok = await run('tambah', () => rpc('team_add_member', { p_email: email.trim(), p_role: role }), t('anggota.ditambah'))
    if (ok) setEmail('')
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('anggota.judul')} description={isAdmin ? t('anggota.sub_admin') : t('anggota.sub_staf')} />
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {isAdmin && (
        <Card>
          <form onSubmit={add} noValidate className="space-y-3">
            <h2 className="text-lg font-bold">{t('anggota.tambah')}</h2>
            <p className="text-sm text-muted">{t('anggota.tambah_isi')}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <Field label={t('akun.email')}>
                {(p) => <Input id={p.id} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              <Field label={t('anggota.peran')}>
                {(p) => (
                  <Select id={p.id} value={role} onChange={(e) => setRole(e.target.value as Enums<'peran_tim'>)}>
                    <option value="admin">{t('anggota.admin')}</option>
                    <option value="staf">{t('anggota.staf')}</option>
                  </Select>
                )}
              </Field>
            </div>
            <Button type="submit" variant="primary" busy={busy === 'tambah'} busyText={t('umum.menyimpan')}>
              {t('anggota.tambah')}
            </Button>
          </form>
        </Card>
      )}
      <Card className="space-y-2">
        <h2 className="text-lg font-bold">{t('anggota.daftar')}</h2>
        <p className="text-sm text-muted">{t('anggota.hak')}</p>
        {members.isPending && <LoadingState />}
        {members.isError && <ErrorState onRetry={() => void members.refetch()} />}
        <ul className="divide-y divide-line-soft">
          {(members.data ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {m.full_name || m.email} {m.user_id === user?.id && <span className="font-normal text-muted">({t('anggota.anda')})</span>}
                </p>
                <p className="break-all text-sm text-muted">{m.email}</p>
              </div>
              {isAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`peran-${m.user_id}`}>
                    {t('anggota.peran_untuk', { name: m.full_name || m.email })}
                  </label>
                  <Select
                    id={`peran-${m.user_id}`}
                    value={m.role}
                    className="w-32"
                    disabled={busy !== null}
                    onChange={(e) => void run(`peran-${m.user_id}`, () => rpc('team_update_member', { p_user: m.user_id, p_role: e.target.value }), t('anggota.diubah'))}
                  >
                    <option value="admin">{t('anggota.admin')}</option>
                    <option value="staf">{t('anggota.staf')}</option>
                  </Select>
                  <Button
                    small
                    variant="danger"
                    busy={busy === `hapus-${m.user_id}`}
                    busyText={t('umum.memproses')}
                    onClick={() => {
                      if (window.confirm(t('anggota.hapus_tanya', { name: m.full_name || m.email })))
                        void run(`hapus-${m.user_id}`, () => rpc('team_update_member', { p_user: m.user_id, p_role: null }), t('anggota.dihapus'))
                    }}
                  >
                    {t('umum.hapus')}
                  </Button>
                </div>
              ) : (
                <span className="text-sm font-semibold">{t(`anggota.${m.role}`)}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
