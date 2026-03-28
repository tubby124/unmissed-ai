'use client'

import TrialExpiredHero from './TrialExpiredHero'

interface Props {
  clientId: string | null
  onUpgradeClick: () => void
}

export default function TrialExpiredSection({ clientId, onUpgradeClick }: Props) {
  return (
    <TrialExpiredHero
      clientId={clientId}
      onUpgradeClick={onUpgradeClick}
    />
  )
}
