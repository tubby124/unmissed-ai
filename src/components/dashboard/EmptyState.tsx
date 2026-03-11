export default function EmptyState({ phone }: { phone?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
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

      <h3 className="text-zinc-300 font-semibold mb-1">No calls yet</h3>
      <p className="text-zinc-500 text-sm mb-6 max-w-xs">
        {phone
          ? <>Your agent is live at <span className="text-zinc-400 font-mono">{phone}</span>. Make a test call to see it in action.</>
          : "Your agent is live. Make a test call to see it in action."
        }
      </p>

      {phone && (
        <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-left space-y-4">
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">How to make your first test call</p>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-semibold">1</span>
              <div>
                <p className="text-zinc-300 text-sm font-medium">Call your AI number</p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Dial <span className="font-mono text-zinc-300">{phone}</span> from your personal phone
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-semibold">2</span>
              <div>
                <p className="text-zinc-300 text-sm font-medium">Have a test conversation</p>
                <p className="text-zinc-500 text-xs mt-0.5">Try asking a question or leaving a message</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-semibold">3</span>
              <div>
                <p className="text-zinc-300 text-sm font-medium">Check back here</p>
                <p className="text-zinc-500 text-xs mt-0.5">The call log updates in real-time after the call ends</p>
              </div>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
