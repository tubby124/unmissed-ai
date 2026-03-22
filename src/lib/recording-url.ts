import { createServiceClient } from '@/lib/supabase/server'

const RECORDING_BUCKET = 'recordings'
const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 3600 // 7 days

/**
 * Generate a signed URL for a recording stored in Supabase private storage.
 *
 * Accepts either:
 *   - A storage path: "abc123.mp3"
 *   - A legacy public URL: "https://xxx.supabase.co/storage/v1/object/public/recordings/abc123.mp3"
 *
 * S13-REC1: recordings bucket is PRIVATE. All access goes through signed URLs.
 */
export async function getSignedRecordingUrl(
  storedValue: string | null,
  expiresIn = DEFAULT_EXPIRY_SECONDS
): Promise<string | null> {
  if (!storedValue) return null

  const path = extractStoragePath(storedValue)
  if (!path) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from(RECORDING_BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) {
    console.error(`[recording] Signed URL failed for path=${path}:`, error.message)
    return null
  }
  return data.signedUrl
}

/**
 * Extract the storage path from either a raw path or a legacy Supabase public URL.
 *
 * "abc123.mp3"  →  "abc123.mp3"
 * "https://xxx.supabase.co/storage/v1/object/public/recordings/abc123.mp3"  →  "abc123.mp3"
 */
function extractStoragePath(value: string): string | null {
  // Already a plain path (not a URL)
  if (!value.startsWith('http')) return value

  // Legacy public URL — extract the filename after /recordings/
  const match = value.match(/\/recordings\/(.+)$/)
  return match ? match[1] : null
}
