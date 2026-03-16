export function slaTag(iso: string | null | undefined): { label: string; cls: string } | null {
  if (!iso) return null
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000
  if (hrs < 1) return { label: 'New', cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' }
  if (hrs < 3) return { label: `Waiting ${Math.floor(hrs)}h`, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
  return { label: `Overdue ${Math.floor(hrs)}h`, cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 motion-safe:animate-pulse' }
}
