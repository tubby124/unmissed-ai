export async function sendAlert(
  botToken: string,
  chatId: string,
  message: string,
  chatId2?: string
): Promise<boolean> {
  const botPrefix = botToken.slice(0, 12) + '...'
  const targets = [chatId, ...(chatId2 ? [chatId2] : [])]
  console.log(`[telegram] Sending to ${targets.length} recipient(s) via bot=${botPrefix} messageLen=${message.length}`)

  const send = async (cid: string): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: cid, text: message, parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(10_000),
        })
        if (res.ok) {
          console.log(`[telegram] Sent OK to chatId=${cid}${attempt > 0 ? ' (retry)' : ''}`)
          return true
        }

        const status = res.status
        const body = await res.text().catch(() => '(unreadable)')

        // Permanent failures — don't retry
        if (status === 400 || status === 403 || status === 404) {
          console.error(`[telegram] Permanent failure HTTP ${status} for chatId=${cid} bot=${botPrefix} — ${body}`)
          return false
        }

        // Rate limited — respect Retry-After if present, cap at 10s
        if (status === 429 && attempt === 0) {
          const retryAfter = Math.min(parseInt(res.headers.get('Retry-After') || '5', 10), 10)
          console.warn(`[telegram] Rate limited (429) for chatId=${cid}, retrying in ${retryAfter}s`)
          await new Promise(r => setTimeout(r, retryAfter * 1000))
          continue
        }

        // Other server errors — retry once after 3s
        if (attempt === 0) {
          console.warn(`[telegram] HTTP ${status} for chatId=${cid} bot=${botPrefix} — retrying in 3s — ${body}`)
          await new Promise(r => setTimeout(r, 3000))
          continue
        }

        console.error(`[telegram] HTTP ${status} for chatId=${cid} bot=${botPrefix} after retry — ${body}`)
        return false
      } catch (err) {
        if (attempt === 0) {
          console.warn(`[telegram] Network error for chatId=${cid} bot=${botPrefix} — retrying in 3s`)
          await new Promise(r => setTimeout(r, 3000))
          continue
        }
        console.error(`[telegram] Network error for chatId=${cid} bot=${botPrefix} after retry —`, err)
        return false
      }
    }
    return false
  }

  const results = await Promise.all(targets.map(send))
  return results[0]
}
