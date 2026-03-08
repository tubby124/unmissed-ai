export async function sendAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  const botPrefix = botToken.slice(0, 12) + '...'
  console.log(`[telegram] Sending to chatId=${chatId} via bot=${botPrefix} messageLen=${message.length}`)
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.error(`[telegram] Non-200 HTTP ${res.status} for chatId=${chatId} bot=${botPrefix} — ${body}`)
      return false
    }
    console.log(`[telegram] Sent OK to chatId=${chatId}`)
    return true
  } catch (err) {
    console.error(`[telegram] Network error for chatId=${chatId} bot=${botPrefix} —`, err)
    return false
  }
}
