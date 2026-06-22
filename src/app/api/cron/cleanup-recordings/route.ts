/**
 * POST /api/cron/cleanup-recordings
 *
 * Deletes recordings older than RECORDING_RETENTION_DAYS (default 30) from
 * Supabase Storage and clears call_logs.recording_url for those rows.
 * Runs daily via GitHub Actions crons.yml.
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const retentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || '30', 10)
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  const svc = createServiceClient()

  // Find call logs with recordings older than the retention window
  const { data: rows, error: fetchError } = await svc
    .from('call_logs')
    .select('id, ultravox_call_id, recording_url, ended_at')
    .not('recording_url', 'is', null)
    .lt('ended_at', cutoff)
    .limit(500)

  if (fetchError) {
    console.error('[cleanup-recordings] Fetch failed:', fetchError.message)
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: `No recordings older than ${retentionDays} days` })
  }

  const paths = rows.map((r) => r.recording_url as string)

  // Delete files from storage
  const { error: storageError } = await svc.storage
    .from('recordings')
    .remove(paths)

  if (storageError) {
    console.error('[cleanup-recordings] Storage delete failed:', storageError.message)
    return NextResponse.json({ ok: false, error: storageError.message }, { status: 500 })
  }

  // Clear recording_url on the affected rows
  const ids = rows.map((r) => r.id)
  const { error: updateError } = await svc
    .from('call_logs')
    .update({ recording_url: null })
    .in('id', ids)

  if (updateError) {
    // Non-fatal: storage is already cleaned, just log
    console.error('[cleanup-recordings] recording_url clear failed:', updateError.message)
  }

  console.log(`[cleanup-recordings] Deleted ${paths.length} recordings older than ${retentionDays} days (cutoff=${cutoff})`)
  return NextResponse.json({ ok: true, deleted: paths.length, retentionDays, cutoff })
}
