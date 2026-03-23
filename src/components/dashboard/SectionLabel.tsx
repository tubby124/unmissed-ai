interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}

export default function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p className={`text-[11px] font-semibold tracking-[0.15em] uppercase t3 ${className ?? ''}`}>
      {children}
    </p>
  )
}
