'use client'

interface ErrorCardProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export default function ErrorCard({
  title = 'Something went wrong',
  message = 'Check your connection and try again.',
  onRetry,
}: ErrorCardProps) {
  return (
    <div className="rounded-2xl p-8 text-center card-surface">
      <p className="text-sm t1 font-medium mb-1">{title}</p>
      <p className="text-xs t3 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer hover:bg-hover"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-1)' }}
        >
          Try again
        </button>
      )}
    </div>
  )
}
