"use client"

export default function TrialBadge({ feature }: { feature?: string }) {
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{
        backgroundColor: "var(--color-warning-tint)",
        color: "var(--color-warning)",
      }}
      title={feature ? `${feature} — available on Pro` : "Available on Pro"}
    >
      Pro
    </span>
  )
}
