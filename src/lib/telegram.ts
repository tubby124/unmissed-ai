export async function sendAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
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
      console.error('[telegram] Non-200:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[telegram] Alert failed:', err)
    return false
  }
}
