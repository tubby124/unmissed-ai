import type { TranscriptEntry } from "@/components/dashboard/BrowserTestCall"

// ── Inline transcript viewer ───────────────────────────────────────────────────

interface ResultTranscriptProps {
  transcripts: TranscriptEntry[]
  agentName: string
}

export function ResultTranscript({ transcripts, agentName }: ResultTranscriptProps) {
  const finals = transcripts.filter(t => t.isFinal)
  if (finals.length === 0) return null
  return (
    <div
      className="rounded-lg p-3 max-h-36 overflow-y-auto space-y-1 text-xs"
      style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}
    >
      {finals.map((t, i) => (
        <p key={i} style={{ color: t.speaker === "agent" ? "#6366f1" : "var(--color-text-2)" }}>
          <span className="font-medium mr-1" style={{ color: "var(--color-text-3)" }}>
            {t.speaker === "agent" ? agentName : "You:"}
          </span>
          {t.text}
        </p>
      ))}
    </div>
  )
}
