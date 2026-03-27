'use client'

import { useState } from 'react'

interface DangerZoneCardProps {
  clientId: string
  previewMode?: boolean
}

export default function DangerZoneCard({ clientId, previewMode }: DangerZoneCardProps) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDelete() {
    if (confirmText !== 'DELETE') return
    setStatus('loading')
    try {
      const res = await fetch('/api/dashboard/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, confirmText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Deletion failed')
        setStatus('error')
        return
      }
      setStatus('done')
      // Give the user a moment to see the success message, then hard-reload to logout state
      setTimeout(() => { window.location.href = '/' }, 2500)
    } catch {
      setErrorMsg('Network error')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
        <p className="text-[12px] font-semibold text-red-400">Account deleted</p>
        <p className="text-[11px] t3 mt-1">Your account and data have been removed. Redirecting…</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-red-400/80 mb-1">Danger Zone</p>
      <p className="text-[11px] t3 mb-4">
        Permanently delete this account. Cancels your subscription, removes all data, and cannot be undone.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          disabled={previewMode}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-800/50 text-red-400 hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Delete Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-red-300/80">
            This will cancel your Stripe subscription, delete your agent, and permanently erase all call logs and settings.
            Type <span className="font-mono font-bold">DELETE</span> to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full text-[11px] bg-transparent border border-red-800/40 rounded-lg px-3 py-2 t1 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/60"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || status === 'loading'}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-red-900/60 border border-red-700/50 text-red-300 hover:bg-red-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {status === 'loading' ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirmText(''); setErrorMsg('') }}
              disabled={status === 'loading'}
              className="text-[11px] px-3 py-1.5 rounded-lg border b-theme t3 hover:bg-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {status === 'error' && (
            <p className="text-[11px] text-red-400">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  )
}
