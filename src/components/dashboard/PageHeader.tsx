interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight t1">{title}</h1>
        {subtitle && (
          <p className="text-xs mt-0.5 t3">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}
