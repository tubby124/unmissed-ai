import type { ReactNode } from 'react'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-white/10 px-6 py-3 flex items-center gap-6 text-sm">
        <span className="font-semibold text-white tracking-tight">unmissed.ai</span>
        <Link href="/admin/calls" className="text-gray-400 hover:text-white transition-colors">
          Calls
        </Link>
        <Link href="/admin/prompt" className="text-gray-400 hover:text-white transition-colors">
          Prompt
        </Link>
        <Link href="/admin/costs" className="text-gray-400 hover:text-white transition-colors">
          Costs
        </Link>
        <Link href="/admin/test-lab" className="text-gray-400 hover:text-white transition-colors">
          Test Lab
        </Link>
        <Link href="/admin/insights" className="text-gray-400 hover:text-white transition-colors">
          Insights
        </Link>
        <Link href="/admin/numbers" className="text-gray-400 hover:text-white transition-colors">
          Numbers
        </Link>
      </nav>
      {children}
    </div>
  )
}
