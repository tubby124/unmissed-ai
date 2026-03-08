import { createBrowserClient as createSupaBrowserClient } from '@supabase/ssr'

export function createBrowserClient() {
  return createSupaBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
