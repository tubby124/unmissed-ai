const PHONE_LIKE = /(?:\+?1[\s.\-]*)?(?:\(?\d{3}\)?[\s.\-]*)?\d{3}[\s.\-]*\d{4}/g

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function isPlaceholderPhoneDigits(digits: string): boolean {
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits

  return (
    local === '5551234567' ||
    local === '1234567890' ||
    local === '0000000000' ||
    local === '1111111111' ||
    local === '9999999999' ||
    local.startsWith('555') ||
    local.endsWith('1234567')
  )
}

export function findPlaceholderPhone(text: string | null | undefined): string | null {
  if (!text) return null

  for (const match of text.matchAll(PHONE_LIKE)) {
    const raw = match[0]
    const digits = digitsOnly(raw)
    if (digits.length >= 7 && isPlaceholderPhoneDigits(digits)) {
      return raw.trim()
    }
  }

  return null
}

export function validateOutboundVmScript(vmScript: string | null | undefined): { ok: true } | { ok: false; error: string } {
  const placeholder = findPlaceholderPhone(vmScript)
  if (placeholder) {
    return {
      ok: false,
      error: `Outbound voicemail script contains a placeholder callback number (${placeholder}). Pin a real approved callback number before dialing.`,
    }
  }

  return { ok: true }
}
