"use client"

export default function TrialBadge({ feature }: { feature?: string }) {
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{
        backgroundColor: "rgba(245,158,11,0.1)",
        color: "#f59e0b",
        border: "1px solid rgba(245,158,11,0.2)",
      }}
      title={feature ? `${feature} requires a paid plan` : "Requires a paid plan"}
    >
      Paid plan
    </span>
  )
}
