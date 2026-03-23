'use client'

import { useState, useRef } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import {
  parseCsvRaw,
  detectKeyColumns,
  columnsToMarkdownTable,
} from '@/lib/settings-utils'

interface ContextDataCardProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

export default function ContextDataCard({ client, isAdmin, previewMode }: ContextDataCardProps) {
  const [contextData, setContextData] = useState(client.context_data ?? '')
  const [contextDataLabel, setContextDataLabel] = useState(client.context_data_label ?? '')
  const [contextDataSaving, setContextDataSaving] = useState(false)
  const [contextDataSaved, setContextDataSaved] = useState(false)

  const [csvUpload, setCsvUpload] = useState<Record<string, {
    allColumns: string[]
    allRows: string[][]
    selectedColumns: string[]
    rowCount: number
    truncated: boolean
  }>>({})
  const csvInputRef = useRef<HTMLInputElement>(null)

  function patch(body: Record<string, unknown>) {
    const payload = { ...body, ...(isAdmin ? { client_id: client.id } : {}) }
    return fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  async function saveContextData() {
    setContextDataSaving(true)
    setContextDataSaved(false)
    const res = await patch({ context_data: contextData, context_data_label: contextDataLabel })
    setContextDataSaving(false)
    if (res.ok) {
      setContextDataSaved(true)
      setTimeout(() => setContextDataSaved(false), 3000)
    }
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCsvRaw(text)
      if (headers.length === 0) return
      const MAX_ROWS = 250
      const truncated = rows.length > MAX_ROWS
      const limitedRows = truncated ? rows.slice(0, MAX_ROWS) : rows
      const selected = detectKeyColumns(headers)
      setCsvUpload(prev => ({
        ...prev,
        [client.id]: { allColumns: headers, allRows: limitedRows, selectedColumns: selected, rowCount: rows.length, truncated },
      }))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="pt-4 border-t b-theme">
      <input
        type="file"
        accept=".csv"
        className="hidden"
        ref={csvInputRef}
        onChange={handleCsvUpload}
      />
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Context Data</p>
          <p className="text-[11px] t3 mt-0.5">Reference data like pricing tables, inventory, or schedules. Your agent looks up specific details here.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (csvInputRef.current) {
                csvInputRef.current.click()
              }
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border b-theme t2 hover:t1 transition-all"
          >
            Upload CSV
          </button>
          <button
            onClick={saveContextData}
            disabled={contextDataSaving || previewMode}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              contextDataSaved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-blue-500 hover:bg-blue-400 text-white'
            } disabled:opacity-40`}
          >
            {contextDataSaving ? 'Saving...' : contextDataSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Column picker — after CSV upload */}
      {csvUpload[client.id] && (
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold t1">
              {csvUpload[client.id].rowCount} rows detected
              {csvUpload[client.id].truncated && (
                <span className="ml-2 text-[10px] text-amber-400/80 font-normal">(first 250 will be used)</span>
              )}
              {' '}— select columns to include:
            </p>
            <button
              onClick={() => setCsvUpload(prev => { const c = { ...prev }; delete c[client.id]; return c })}
              className="text-[10px] t3 hover:t1"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {csvUpload[client.id].allColumns.map(col => {
              const checked = csvUpload[client.id].selectedColumns.includes(col)
              return (
                <label
                  key={col}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-all ${
                    checked ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'b-theme t3 hover:t2'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="hidden"
                    onChange={() => setCsvUpload(prev => {
                      const curr = prev[client.id]
                      const selected = checked
                        ? curr.selectedColumns.filter(c => c !== col)
                        : [...curr.selectedColumns, col]
                      return { ...prev, [client.id]: { ...curr, selectedColumns: selected } }
                    })}
                  />
                  {col}
                </label>
              )
            })}
          </div>

          {csvUpload[client.id].selectedColumns.length > 0 &&
            !csvUpload[client.id].selectedColumns.some(c => /unit|address|addr|suite|apt|door|property/i.test(c)) && (
            <p className="text-[11px] text-amber-400/80">
              No unit or address column selected — address lookup may be less accurate.
            </p>
          )}

          {csvUpload[client.id].selectedColumns.length > 0 && csvUpload[client.id].allRows.length > 0 && (
            <div>
              <p className="text-[10px] t3 mb-1.5">Preview (first 3 rows):</p>
              <div className="overflow-x-auto rounded-lg border b-theme">
                <table className="w-full">
                  <thead>
                    <tr className="border-b b-theme">
                      {csvUpload[client.id].selectedColumns.map(col => (
                        <th key={col} className="px-2 py-1 text-left text-[10px] font-semibold t3 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvUpload[client.id].allRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className="border-b b-theme last:border-0">
                        {csvUpload[client.id].selectedColumns.map((col, ci) => {
                          const colIdx = csvUpload[client.id].allColumns.indexOf(col)
                          return (
                            <td key={ci} className="px-2 py-1 text-[10px] font-mono t2 max-w-36 truncate">
                              {row[colIdx] ?? ''}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setCsvUpload(prev => { const c = { ...prev }; delete c[client.id]; return c })}
              className="px-3 py-1.5 rounded-lg text-xs t3 hover:t1 border b-theme transition-all"
            >
              Cancel
            </button>
            <button
              disabled={csvUpload[client.id].selectedColumns.length === 0}
              onClick={() => {
                const state = csvUpload[client.id]
                const markdown = columnsToMarkdownTable(state.allColumns, state.selectedColumns, state.allRows)
                setContextData(markdown)
                if (!contextDataLabel) setContextDataLabel('Tenant List')
                setCsvUpload(prev => { const c = { ...prev }; delete c[client.id]; return c })
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-40 transition-all"
            >
              Use This Data →
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 mt-4">
        <div>
          <label className="text-[11px] t3 block mb-1">Data label <span className="t3">(e.g. "Tenant List", "Menu", "Price Sheet")</span></label>
          <input
            type="text"
            value={contextDataLabel}
            onChange={e => setContextDataLabel(e.target.value)}
            placeholder="Tenant List"
            className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20"
          />
        </div>
        <div>
          <label className="text-[11px] t3 block mb-1">Data <span className="t3">(paste or upload CSV — max ~32,000 chars)</span></label>
          <textarea
            value={contextData}
            onChange={e => setContextData(e.target.value)}
            placeholder={`Unit, Tenant, Rent\n4A, John Smith, $1200\n4B, Sarah Lee, $1350`}
            className="w-full h-40 bg-black/20 border b-theme rounded-xl p-3 text-xs t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
            maxLength={32000}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] t3">{contextData.length.toLocaleString()} / 32,000 chars</p>
            {contextData.startsWith('|') && (
              <p className="text-[10px] text-green-400/70">Lookup instructions auto-injected on every call</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
