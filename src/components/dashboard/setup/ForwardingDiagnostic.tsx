'use client'

/**
 * Forwarding Diagnostic — "Test Your Forwarding" button.
 *
 * Renders below the dial codes in MobileSetup AFTER CarrierCompatibilityCheck completes.
 * Calls /api/dashboard/forwarding-diagnostic/test which originates a real test call
 * from a dedicated diagnostic DID to the client's business line and watches what
 * answers (AI agent vs carrier VM vs ringing forever vs busy).
 *
 * Spec: ~/Downloads/Obsidian Vault/Projects/unmissed/Product/carrier-compatibility-checker-spec.md
 *
 * STATUS: SCAFFOLDED — API route exists at /api/dashboard/forwarding-diagnostic/test (also scaffolded).
 * NOT YET WIRED into MobileSetup.
 */

import { useState } from 'react'
import type { DiagnosticResult } from '@/types/carrier-compat'

interface Props {
  clientId: string
  targetPhone: string
  onResult?: (result: DiagnosticResult) => void
}

interface DiagnosticResponse {
  result: DiagnosticResult
  detail: string
  remediation: string
  runAt: string
  testCallSid: string
}

export default function ForwardingDiagnostic({ clientId, targetPhone, onResult }: Props) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [response, setResponse] = useState<DiagnosticResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runTest() {
    setState('running')
    setError(null)
    try {
      const res = await fetch('/api/dashboard/forwarding-diagnostic/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId, targetPhone }),
      })
      const json = (await res.json()) as DiagnosticResponse | { error: string }
      if (!res.ok || 'error' in json) {
        throw new Error('error' in json ? json.error : 'Diagnostic failed')
      }
      setResponse(json)
      setState('done')
      onResult?.(json.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={runTest}
        className="w-full py-3.5 rounded-xl bg-input border b-theme t2 font-semibold text-sm hover:bg-hover hover:t1 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Test your forwarding
      </button>
    )
  }

  if (state === 'running') {
    return (
      <div className="rounded-xl border b-theme bg-input px-4 py-4 flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400" />
        </span>
        <p className="text-sm t1">Calling your business line… please wait 30 seconds.</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] px-4 py-4">
        <p className="text-sm font-semibold text-red-300">Diagnostic failed to run</p>
        <p className="text-[12px] text-red-200/80 mt-1">{error}</p>
        <button onClick={runTest} className="mt-2 text-[12px] text-red-200 underline">Retry</button>
      </div>
    )
  }

  if (state === 'done' && response) {
    const passing = response.result === 'pass'
    return (
      <div className={`rounded-xl border px-4 py-4 ${passing ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-red-500/30 bg-red-500/[0.05]'}`}>
        <p className={`text-sm font-semibold ${passing ? 'text-emerald-300' : 'text-red-300'}`}>
          {passing ? 'Forwarding is live — AI agent answered.' : `Forwarding failed — ${formatFailMode(response.result)}`}
        </p>
        <p className={`text-[12px] mt-1 leading-relaxed ${passing ? 'text-emerald-200/80' : 'text-red-200/80'}`}>
          {response.detail}
        </p>
        {!passing && (
          <p className={`text-[12px] mt-2 leading-relaxed ${passing ? 'text-emerald-200/80' : 'text-red-200/80'}`}>
            <span className="font-semibold">Next:</span> {response.remediation}
          </p>
        )}
      </div>
    )
  }

  return null
}

function formatFailMode(r: DiagnosticResult): string {
  switch (r) {
    case 'fail_vm_intercept': return 'voicemail intercepted the call'
    case 'fail_ring_forever': return 'call rang out without forwarding'
    case 'fail_busy': return 'line returned busy'
    default: return 'unknown failure'
  }
}
