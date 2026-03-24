'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Detects Supabase invite/recovery hash tokens on any page and redirects
 * to the correct auth handler. Needed because Supabase's admin generateLink()
 * strips the /auth/set-password path from redirect_to, landing users on the
 * homepage with #access_token=...&type=invite in the hash.
 */
export default function AuthHashRedirect() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=recovery')) {
      router.replace('/auth/set-password' + hash)
    }
  }, [router])

  return null
}
