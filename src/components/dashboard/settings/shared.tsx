'use client'

import { useState } from 'react'

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium t3 border b-theme hover:t1 hover:b-theme transition-all shrink-0"
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/></svg>
          {label ?? 'Copy'}
        </>
      )}
    </button>
  )
}

export function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0">
      <span className="text-xs t3 w-24 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono t2 truncate">{url}</span>
      <CopyButton value={url} />
    </div>
  )
}

export function ConfigRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0">
      <span className="text-xs t3 w-32 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono t2 truncate">{value}</span>
      {copyValue && <CopyButton value={copyValue} />}
    </div>
  )
}
