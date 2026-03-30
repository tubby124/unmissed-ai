'use client'

// Stub — kanban view not yet implemented
interface KanbanBoardProps {
  calls: unknown[]
  showBusiness?: boolean
  onStatusChange?: (callId: string, newStatus: string) => void
}

export default function KanbanBoard({ calls }: KanbanBoardProps) {
  if (!calls.length) return null
  return (
    <div className="text-sm py-8 text-center" style={{ color: 'var(--color-text-3)' }}>
      Kanban view coming soon
    </div>
  )
}
