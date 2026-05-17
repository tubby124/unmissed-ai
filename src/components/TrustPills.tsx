import { Shield, MapPin, FileCheck, PhoneCall } from "lucide-react";

interface TrustPillsProps {
  variant?: "compact" | "full";
  className?: string;
}

const PILLS = [
  { icon: MapPin, label: "Built in Canada", title: "Saskatoon + Calgary" },
  { icon: Shield, label: "PIPEDA-compliant", title: "Canadian privacy law" },
  { icon: FileCheck, label: "CASL-compliant", title: "Canadian anti-spam law" },
  { icon: PhoneCall, label: "Two-party-consent capable", title: "Recording disclosure available for US states that require it" },
];

export default function TrustPills({ variant = "compact", className = "" }: TrustPillsProps) {
  const isCompact = variant === "compact";

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
      aria-label="Trust and compliance"
    >
      {PILLS.map(({ icon: Icon, label, title }) => (
        <li
          key={label}
          title={title}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
            isCompact ? "text-xs" : "text-sm"
          }`}
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text-2)",
          }}
        >
          <Icon size={isCompact ? 12 : 14} aria-hidden="true" style={{ color: "var(--color-primary)" }} />
          <span className="font-medium">{label}</span>
        </li>
      ))}
    </ul>
  );
}
