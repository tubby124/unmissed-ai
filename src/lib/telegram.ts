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
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cid, text: message, parse_mode: 'HTML' }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '(unreadable)')
        console.error(`[telegram] Non-200 HTTP ${res.status} for chatId=${cid} bot=${botPrefix} — ${body}`)
        return false
      }
      console.log(`[telegram] Sent OK to chatId=${cid}`)
      return true
    } catch (err) {
      console.error(`[telegram] Network error for chatId=${cid} bot=${botPrefix} —`, err)
      return false
    }
  }

  const results = await Promise.all(targets.map(send))
  return results[0]
}
