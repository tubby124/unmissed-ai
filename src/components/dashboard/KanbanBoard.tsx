'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
  business_name?: string | null
}

function fmtDur(secs: number | null) {
  if (!secs) return null
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d`
  if (hrs > 0) return `${hrs}h`
  if (mins > 0) return `${mins}m`
  return 'now'
}

const DROPPABLE_STATUSES = ['HOT', 'WARM', 'COLD', 'JUNK', 'MISSED']

const COLUMNS: { status: string; label: string; dotClass: string; emptyLabel: string; isPulse?: boolean }[] = [
  { status: 'live', label: 'Live', dotClass: 'bg-emerald-500', emptyLabel: 'No active calls', isPulse: true },
  { status: 'HOT', label: 'Hot', dotClass: 'bg-red-500', emptyLabel: 'No hot leads' },
  { status: 'WARM', label: 'Warm', dotClass: 'bg-amber-500', emptyLabel: 'No warm leads' },
  { status: 'COLD', label: 'Cold', dotClass: 'bg-blue-500', emptyLabel: 'No cold leads' },
  { status: 'JUNK', label: 'Junk', dotClass: 'bg-gray-400', emptyLabel: 'No junk calls' },
  { status: 'MISSED', label: 'Missed', dotClass: 'bg-orange-500', emptyLabel: 'No missed calls' },
]

function KanbanCard({ call, isDragging }: { call: CallLog; isDragging?: boolean }) {
  const dur = fmtDur(call.duration_seconds)
  const snippet = call.ai_summary
    ? `${call.ai_summary.slice(0, 80)}${call.ai_summary.length > 80 ? '...' : ''}`
    : null

  return (
    <div className={`block rounded-xl border b-theme bg-surface shadow-sm p-3 transition-all duration-150 ${isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-xs font-medium t1 flex-1 truncate">
          {call.caller_phone || 'Unknown'}
        </span>
        {dur && (
          <span className="text-[10px] font-mono tabular-nums text-gray-400 shrink-0">{dur}</span>
        )}
        <span className="text-[10px] font-mono tabular-nums text-gray-400 shrink-0">{timeAgo(call.started_at)}</span>
      </div>
      {snippet && (
        <p className="text-[11px] italic text-gray-400 leading-snug line-clamp-2">{snippet}</p>
      )}
      {call.business_name && (
        <p className="text-[10px] t3 mt-1 truncate">{call.business_name}</p>
      )}
    </div>
  )
}

interface DragToast {
  id: string
  message: string
  type: 'success' | 'error'
}

export default function KanbanBoard({
  calls,
  showBusiness,
  onStatusChange,
}: {
  calls: CallLog[]
  showBusiness?: boolean
  onStatusChange?: (callId: string, newStatus: string, oldStatus: string) => void
}) {
  const [dragCallId, setDragCallId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [toasts, setToasts] = useState<DragToast[]>([])
  const dragStarted = useRef(false)

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, call: CallLog) => {
    if (call.call_status === 'live' || call.call_status === 'processing') {
      e.preventDefault()
      return
    }
    dragStarted.current = true
    setDragCallId(call.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', call.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragStarted.current = false
    setDragCallId(null)
    setDragOverCol(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, colStatus: string) => {
    if (!DROPPABLE_STATUSES.includes(colStatus)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colStatus)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent, colStatus: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverCol(prev => prev === colStatus ? null : prev)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDragOverCol(null)

    const callId = e.dataTransfer.getData('text/plain')
    if (!callId) return

    const call = calls.find(c => c.id === callId)
    if (!call || call.call_status === targetStatus) {
      setDragCallId(null)
      return
    }

    const oldStatus = call.call_status ?? ''

    // Optimistic update via parent callback
    if (onStatusChange) {
      onStatusChange(callId, targetStatus, oldStatus)
    }

    setDragCallId(null)

    // Persist to API
    try {
      const res = await fetch(`/api/dashboard/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_status: targetStatus }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // Revert optimistic update
        if (onStatusChange) {
          onStatusChange(callId, oldStatus, targetStatus)
        }
        addToast(data.error || 'Failed to update status', 'error')
      } else {
        addToast(`Moved to ${targetStatus}`, 'success')
      }
    } catch {
      // Revert optimistic update
      if (onStatusChange) {
        onStatusChange(callId, oldStatus, targetStatus)
      }
      addToast('Network error — status not saved', 'error')
    }
  }, [calls, onStatusChange, addToast])

  const isDraggable = (status: string | null) => {
    return status !== 'live' && status !== 'processing'
  }

  return (
    <div className="relative">
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px] -mx-1 px-1">
        {COLUMNS.map(col => {
          const colCalls = calls.filter(c => c.call_status === col.status)
          const isDropTarget = DROPPABLE_STATUSES.includes(col.status)
          const isOver = dragOverCol === col.status && dragCallId !== null

          return (
            <div
              key={col.status}
              className={`flex-shrink-0 w-64 rounded-xl transition-all duration-150 ${
                isOver ? 'bg-blue-500/[0.06] ring-2 ring-blue-500/20' : ''
              }`}
              onDragOver={isDropTarget ? (e) => handleDragOver(e, col.status) : undefined}
              onDragLeave={isDropTarget ? (e) => handleDragLeave(e, col.status) : undefined}
              onDrop={isDropTarget ? (e) => handleDrop(e, col.status) : undefined}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="relative flex w-2 h-2 shrink-0">
                  {col.isPulse && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${col.dotClass} opacity-75`} />
                  )}
                  <span className={`relative inline-flex rounded-full w-2 h-2 ${col.dotClass}`} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider t3">
                  {col.label}
                </span>
                <span className="ml-auto text-[10px] font-bold bg-hover t3 rounded-full px-2 py-0.5 tabular-nums">
                  {colCalls.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[60px]">
                {colCalls.length > 0
                  ? (
                    <AnimatePresence mode="popLayout">
                      {colCalls.map(call => {
                        const draggable = isDraggable(call.call_status)
                        const isBeingDragged = dragCallId === call.id

                        return (
                          <motion.div
                            key={call.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={!isBeingDragged ? { y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.15)' } : undefined}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            style={
                              col.status === 'live'
                                ? { boxShadow: '0 0 0 1px rgba(16,185,129,0.3), 0 0 12px rgba(16,185,129,0.15)' }
                                : col.status === 'HOT'
                                ? { borderLeft: '3px solid #ef4444' }
                                : undefined
                            }
                            draggable={draggable}
                            onDragStart={draggable ? (e) => handleDragStart(e as unknown as React.DragEvent, call) : undefined}
                            onDragEnd={draggable ? handleDragEnd : undefined}
                            className={draggable ? 'cursor-grab active:cursor-grabbing' : ''}
                          >
                            <Link
                              href={`/dashboard/calls/${call.ultravox_call_id}`}
                              draggable={false}
                              onClick={(e) => {
                                if (dragStarted.current) {
                                  e.preventDefault()
                                }
                              }}
                              className="block"
                            >
                              <KanbanCard call={call} isDragging={isBeingDragged} />
                            </Link>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  )
                  : (
                    <div className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors duration-150 ${
                      isOver
                        ? 'border-blue-500 bg-blue-500/[0.04]'
                        : 'b-theme'
                    }`}>
                      <p className="text-xs t3">
                        {isOver ? 'Drop here' : col.emptyLabel}
                      </p>
                    </div>
                  )
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Drag-and-drop toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium shadow-lg backdrop-blur-sm ${
                toast.type === 'success'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                  : 'bg-red-500/15 text-red-400 border border-red-500/25'
              }`}
            >
              {toast.type === 'success' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
