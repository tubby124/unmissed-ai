export default function EmptyState({ phone }: { phone?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      {/* Phone icon with ripple rings */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-[-8px] rounded-full bg-blue-500/5 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
        <div className="relative w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      <h3 className="text-zinc-300 font-semibold mb-2">No calls yet</h3>
      {phone ? (
        <p className="text-zinc-500 text-sm max-w-xs">
          When someone calls <span className="text-zinc-400 font-mono">{phone}</span>, it will appear here in real-time.
        </p>
      ) : (
        <p className="text-zinc-500 text-sm max-w-xs">
          When your agent receives a call, it will appear here in real-time.
        </p>
      )}
    </div>
  )
}
